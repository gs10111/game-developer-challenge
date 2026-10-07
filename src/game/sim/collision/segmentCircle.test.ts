import { describe, expect, test } from 'vitest';
import type { Point } from '../../config/gameConfig';
import { STEPS_PER_SECOND } from '../stepRate';
import { segmentCircleEntry } from './segmentCircle';

const TOLERANCE = 1e-9;
const HAIR = 1e-6;
const SWEEP_MARGIN = 1e-6;
const SWEEP_CENTRE = { x: 480, y: 270 };
const SWEEP_RADII = [3, 23, 28];
const SWEEP_SPEEDS = [240, 300, 420, 1200];
const SWEEP_BEARINGS = 40;
const SWEEP_HEADINGS = 24;

interface Circle {
  x: number;
  y: number;
  radius: number;
}

interface Sweep {
  start: Point;
  end: Point;
  entry: number;
}

function entryOf(start: Point, end: Point, circle: Circle): number {
  return segmentCircleEntry(start.x, start.y, end.x, end.y, circle.x, circle.y, circle.radius);
}

function entryAtRest(x: number, y: number, circle: Circle): number {
  return segmentCircleEntry(x, y, x, y, circle.x, circle.y, circle.radius);
}

function pointAt(start: Point, end: Point, fraction: number): Point {
  return {
    x: start.x + (end.x - start.x) * fraction,
    y: start.y + (end.y - start.y) * fraction,
  };
}

function gap(from: Point, to: Point): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

function distanceToSegment(start: Point, end: Point, point: Point): number {
  const alongX = end.x - start.x;
  const alongY = end.y - start.y;
  const lengthSquared = alongX * alongX + alongY * alongY;
  if (lengthSquared === 0) {
    return gap(start, point);
  }
  const along = ((point.x - start.x) * alongX + (point.y - start.y) * alongY) / lengthSquared;
  return gap(pointAt(start, end, Math.min(Math.max(along, 0), 1)), point);
}

function allAround(count: number, offset: number): number[] {
  return Array.from({ length: count }, (_, index) => ((index + offset) * 2 * Math.PI) / count);
}

function away(from: Point, angle: number, distance: number): Point {
  return { x: from.x + Math.cos(angle) * distance, y: from.y + Math.sin(angle) * distance };
}

describe('segment against a circle (ADR-0007)', () => {
  test('CB-05 a segment that crosses a circle enters it at the nearer intersection', () => {
    const buoy = { x: 0, y: 0, radius: 5 };
    const wreck = { x: 100, y: 200, radius: 50 };

    expect(entryOf({ x: -10, y: 0 }, { x: 10, y: 0 }, buoy)).toBe(0.25);
    expect(entryOf({ x: 10, y: 0 }, { x: -10, y: 0 }, buoy)).toBe(0.25);
    expect(entryOf({ x: 0, y: -10 }, { x: 0, y: 10 }, buoy)).toBe(0.25);
    expect(entryOf({ x: -8, y: 3 }, { x: 8, y: 3 }, buoy)).toBe(0.25);
    expect(entryOf({ x: 8, y: 3 }, { x: -8, y: 3 }, buoy)).toBe(0.25);
    expect(entryOf({ x: 3, y: 8 }, { x: 3, y: -8 }, buoy)).toBe(0.25);
    expect(entryOf({ x: -6, y: 0 }, { x: 2, y: 0 }, buoy)).toBe(0.125);
    expect(entryOf({ x: -10, y: 0 }, { x: 0, y: 0 }, buoy)).toBe(0.5);
    expect(entryOf({ x: 40, y: 120 }, { x: 160, y: 280 }, wreck)).toBe(0.25);
    expect(entryOf({ x: 160, y: 280 }, { x: 40, y: 120 }, wreck)).toBe(0.25);
    expect(entryOf({ x: 20, y: 230 }, { x: 180, y: 230 }, wreck)).toBe(0.25);

    expect(pointAt({ x: -8, y: 3 }, { x: 8, y: 3 }, 0.25)).toEqual({ x: -4, y: 3 });
    expect(pointAt({ x: 8, y: 3 }, { x: -8, y: 3 }, 0.25)).toEqual({ x: 4, y: 3 });
    expect(pointAt({ x: 40, y: 120 }, { x: 160, y: 280 }, 0.25)).toEqual({ x: 70, y: 160 });
    expect(pointAt({ x: 160, y: 280 }, { x: 40, y: 120 }, 0.25)).toEqual({ x: 130, y: 240 });

    expect(entryOf({ x: -5, y: 0 }, { x: 5, y: 0 }, buoy)).toBe(0);
    expect(entryOf({ x: -5, y: 0 }, { x: 0, y: 0 }, buoy)).toBe(0);
    expect(entryOf({ x: 3, y: 4 }, { x: -3, y: -4 }, buoy)).toBe(0);
    expect(entryOf({ x: 70, y: 160 }, { x: 76, y: 168 }, wreck)).toBe(0);

    const inTheLastStride = entryOf({ x: -10, y: 0 }, { x: -5 + HAIR, y: 0 }, buoy);

    expect(inTheLastStride).toBeGreaterThan(0.999999);
    expect(inTheLastStride).toBeLessThan(1);
  });

  test('CB-05 a segment that starts inside a circle enters it at its start', () => {
    const buoy = { x: 0, y: 0, radius: 5 };
    const wreck = { x: 100, y: 200, radius: 50 };

    expect(entryOf({ x: 0, y: 0 }, { x: 20, y: 0 }, buoy)).toBe(0);
    expect(entryOf({ x: 3, y: 3 }, { x: 30, y: 30 }, buoy)).toBe(0);
    expect(entryOf({ x: 3, y: 3 }, { x: -30, y: -30 }, buoy)).toBe(0);
    expect(entryOf({ x: 3, y: 3 }, { x: 4, y: 2 }, buoy)).toBe(0);
    expect(entryOf({ x: -1, y: 2 }, { x: 2, y: -1 }, buoy)).toBe(0);
    expect(entryOf({ x: 100, y: 200 }, { x: 300, y: 200 }, wreck)).toBe(0);
    expect(entryOf({ x: 80, y: 170 }, { x: 400, y: 500 }, wreck)).toBe(0);
    expect(entryOf({ x: 90, y: 190 }, { x: 110, y: 215 }, wreck)).toBe(0);

    expect(entryOf({ x: 5 - HAIR, y: 0 }, { x: 9, y: 0 }, buoy)).toBe(0);
    expect(entryOf({ x: 5 - HAIR, y: 0 }, { x: 5 - HAIR, y: 7 }, buoy)).toBe(0);
    expect(entryOf({ x: 5 - HAIR, y: 0 }, { x: -9, y: 0 }, buoy)).toBe(0);
    expect(entryOf({ x: 150 - HAIR, y: 200 }, { x: 260, y: 200 }, wreck)).toBe(0);
  });

  test('CB-05 a segment that only touches a circle, stops short of it, ends exactly on it or points away from it misses', () => {
    const buoy = { x: 0, y: 0, radius: 5 };
    const wreck = { x: 100, y: 200, radius: 50 };

    expect(entryOf({ x: -10, y: 5 }, { x: 10, y: 5 }, buoy)).toBe(-1);
    expect(entryOf({ x: 10, y: -5 }, { x: -10, y: -5 }, buoy)).toBe(-1);
    expect(entryOf({ x: 5, y: -10 }, { x: 5, y: 10 }, buoy)).toBe(-1);
    expect(entryOf({ x: 11, y: -2 }, { x: -5, y: 10 }, buoy)).toBe(-1);
    expect(entryOf({ x: -5, y: 10 }, { x: 11, y: -2 }, buoy)).toBe(-1);
    expect(entryOf({ x: -10, y: 5 }, { x: 0, y: 5 }, buoy)).toBe(-1);
    expect(entryOf({ x: 0, y: 5 }, { x: 10, y: 5 }, buoy)).toBe(-1);
    expect(entryOf({ x: 60, y: 150 }, { x: 140, y: 150 }, wreck)).toBe(-1);
    expect(entryOf({ x: 210, y: 180 }, { x: 50, y: 300 }, wreck)).toBe(-1);

    expect(entryOf({ x: -10, y: 0 }, { x: -6, y: 0 }, buoy)).toBe(-1);
    expect(entryOf({ x: -10, y: 0 }, { x: -5 - HAIR, y: 0 }, buoy)).toBe(-1);
    expect(entryOf({ x: 12, y: 16 }, { x: 6, y: 8 }, buoy)).toBe(-1);
    expect(entryOf({ x: 100, y: 100 }, { x: 100, y: 149 }, wreck)).toBe(-1);

    expect(entryOf({ x: -10, y: 0 }, { x: -5, y: 0 }, buoy)).toBe(-1);
    expect(entryOf({ x: 0, y: 9 }, { x: 0, y: 5 }, buoy)).toBe(-1);
    expect(entryOf({ x: 6, y: 8 }, { x: 3, y: 4 }, buoy)).toBe(-1);
    expect(entryOf({ x: -9, y: 12 }, { x: -3, y: 4 }, buoy)).toBe(-1);
    expect(entryOf({ x: 100, y: 100 }, { x: 100, y: 150 }, wreck)).toBe(-1);
    expect(entryOf({ x: 40, y: 120 }, { x: 70, y: 160 }, wreck)).toBe(-1);

    expect(entryOf({ x: 6, y: 0 }, { x: 20, y: 0 }, buoy)).toBe(-1);
    expect(entryOf({ x: 5, y: 0 }, { x: 9, y: 0 }, buoy)).toBe(-1);
    expect(entryOf({ x: 3, y: 4 }, { x: 6, y: 8 }, buoy)).toBe(-1);
    expect(entryOf({ x: 5 + HAIR, y: 0 }, { x: 9, y: 0 }, buoy)).toBe(-1);
    expect(entryOf({ x: 70, y: 160 }, { x: 40, y: 120 }, wreck)).toBe(-1);
    expect(entryOf({ x: -10, y: 6 }, { x: 10, y: 6 }, buoy)).toBe(-1);
    expect(entryOf({ x: 300, y: 0 }, { x: 300, y: 400 }, wreck)).toBe(-1);

    expect(entryOf({ x: -10, y: 5 - HAIR }, { x: 10, y: 5 - HAIR }, buoy)).toBeGreaterThan(0);
    expect(entryOf({ x: -10, y: 0 }, { x: -5 + HAIR, y: 0 }, buoy)).toBeGreaterThan(0);
  });

  test('CB-05 a segment long enough to jump over a small circle still enters it', () => {
    const start = { x: 0, y: 0 };
    const leaps = [
      { end: { x: 1000, y: 0 }, circle: { x: 500, y: 0, radius: 1 }, flown: 499 },
      { end: { x: 300, y: 400 }, circle: { x: 150, y: 200, radius: 5 }, flown: 245 },
      { end: { x: 100, y: 0 }, circle: { x: 50, y: 1, radius: 3 }, flown: 50 - Math.sqrt(8) },
      { end: { x: 0, y: 20 }, circle: { x: -2, y: 10, radius: 3 }, flown: 10 - Math.sqrt(5) },
      { end: { x: 10000, y: 0 }, circle: { x: 9000, y: 2, radius: 3 }, flown: 9000 - Math.sqrt(5) },
    ];

    for (const { end, circle, flown } of leaps) {
      const entry = entryOf(start, end, circle);
      const point = pointAt(start, end, entry);

      expect(gap(start, circle)).toBeGreaterThan(circle.radius + 1);
      expect(gap(end, circle)).toBeGreaterThan(circle.radius + 1);
      expect(gap(start, end)).toBeGreaterThan(6 * circle.radius);
      expect(Math.abs(gap(start, point) - flown)).toBeLessThanOrEqual(TOLERANCE);
      expect(Math.abs(gap(point, circle) - circle.radius)).toBeLessThanOrEqual(TOLERANCE);
    }

    expect(entryOf(start, { x: 1000, y: 0 }, { x: 500, y: 0, radius: 1 })).toBe(0.499);
    expect(entryOf(start, { x: 300, y: 400 }, { x: 150, y: 200, radius: 5 })).toBe(0.49);
    expect(entryOf(start, { x: 1000, y: 0 }, { x: 500, y: 4, radius: 1 })).toBe(-1);
    expect(entryOf(start, { x: 100, y: 0 }, { x: 50, y: 3, radius: 3 })).toBe(-1);
    expect(entryOf(start, { x: 100, y: 0 }, { x: 150, y: 1, radius: 3 })).toBe(-1);
  });

  test('CB-05 a segment of zero length enters a circle only when it is inside it', () => {
    const buoy = { x: 0, y: 0, radius: 5 };
    const wreck = { x: 100, y: 200, radius: 50 };
    const speck = { x: 7, y: -3, radius: 0 };

    expect(entryAtRest(0, 0, buoy)).toBe(0);
    expect(entryAtRest(3, 3, buoy)).toBe(0);
    expect(entryAtRest(5 - HAIR, 0, buoy)).toBe(0);
    expect(entryAtRest(100, 200, wreck)).toBe(0);
    expect(entryAtRest(129, 239, wreck)).toBe(0);

    expect(entryAtRest(3, 4, buoy)).toBe(-1);
    expect(entryAtRest(5, 0, buoy)).toBe(-1);
    expect(entryAtRest(0, -5, buoy)).toBe(-1);
    expect(entryAtRest(5 + HAIR, 0, buoy)).toBe(-1);
    expect(entryAtRest(6, 8, buoy)).toBe(-1);
    expect(entryAtRest(130, 240, wreck)).toBe(-1);
    expect(entryAtRest(300, -400, wreck)).toBe(-1);
    expect(entryAtRest(7, -3, speck)).toBe(-1);
    expect(entryAtRest(0, 0, speck)).toBe(-1);
  });

  test('CB-05 the entry point lies on the circle, for step-sized segments from all around it', () => {
    for (const radius of SWEEP_RADII) {
      for (const speed of SWEEP_SPEEDS) {
        const circle = { ...SWEEP_CENTRE, radius };
        const stride = speed / STEPS_PER_SECOND;
        const rings = [
          radius * 0.4,
          radius - 0.3,
          radius + 0.3,
          radius + stride / 2,
          radius + stride - 0.2,
          radius + stride + 0.4,
        ];
        const outOfRange: Sweep[] = [];
        const imagined: Sweep[] = [];
        const undetected: Sweep[] = [];
        const offTheCircle: Sweep[] = [];
        const notTheFirst: Sweep[] = [];
        const startedOutside: Sweep[] = [];
        let crossed = 0;
        let startedInside = 0;
        let missed = 0;

        for (const bearing of allAround(SWEEP_BEARINGS, 0.37)) {
          for (const ring of rings) {
            const start = away(SWEEP_CENTRE, bearing, ring);

            for (const heading of allAround(SWEEP_HEADINGS, 0.19)) {
              const end = away(start, heading, stride);
              const entry = entryOf(start, end, circle);
              const nearest = distanceToSegment(start, end, SWEEP_CENTRE);
              const sweep = { start, end, entry };

              if (entry === -1) {
                missed += 1;
                if (nearest < radius - SWEEP_MARGIN) {
                  undetected.push(sweep);
                }
                continue;
              }
              if (!(entry >= 0 && entry < 1)) {
                outOfRange.push(sweep);
                continue;
              }
              if (nearest > radius + SWEEP_MARGIN) {
                imagined.push(sweep);
              }
              if (entry === 0) {
                startedInside += 1;
                if (gap(start, SWEEP_CENTRE) > radius + TOLERANCE) {
                  startedOutside.push(sweep);
                }
                continue;
              }
              const point = pointAt(start, end, entry);

              crossed += 1;
              if (!(Math.abs(gap(point, SWEEP_CENTRE) - radius) <= TOLERANCE)) {
                offTheCircle.push(sweep);
              }
              if (distanceToSegment(start, point, SWEEP_CENTRE) < radius - TOLERANCE) {
                notTheFirst.push(sweep);
              }
            }
          }
        }

        expect(outOfRange).toEqual([]);
        expect(imagined).toEqual([]);
        expect(undetected).toEqual([]);
        expect(offTheCircle).toEqual([]);
        expect(notTheFirst).toEqual([]);
        expect(startedOutside).toEqual([]);
        expect(startedInside).toBe(2 * SWEEP_BEARINGS * SWEEP_HEADINGS);
        expect(crossed).toBeGreaterThan(SWEEP_BEARINGS * 4);
        expect(missed).toBeGreaterThan(SWEEP_BEARINGS * SWEEP_HEADINGS);
      }
    }
  });
});
