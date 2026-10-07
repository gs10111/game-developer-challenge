import { describe, expect, test } from 'vitest';
import type { ConvexPolygon, Point } from '../../config/gameConfig';
import { circlePolygonOverlap } from './circlePolygon';
import type { Overlap } from './circlePolygon';
import { createIslandIndex } from './islandIndex';
import type { IslandPart } from './islandIndex';

const TOLERANCE = 1e-9;
const HAIR = 1e-12;
const UNIT_LENGTH_ERROR = 1e-12;
const SWEEP_MARGIN = 70;
const SWEEP_SPACING = 7.3;
const SWEEP_RADII = [0.5, 9, 24, 60];

const QUAY: ConvexPolygon = [
  { x: 100, y: 100 },
  { x: 300, y: 100 },
  { x: 300, y: 200 },
  { x: 100, y: 200 },
];

const REEF: ConvexPolygon = [
  { x: 100, y: 100 },
  { x: 400, y: 100 },
  { x: 100, y: 500 },
];

const SKERRY: ConvexPolygon = [
  { x: 100, y: 100 },
  { x: 400, y: 160 },
  { x: 225, y: 390 },
];

interface Push {
  centre: Point;
  radius: number;
  left: number;
}

function partOf(polygon: ConvexPolygon): IslandPart {
  const [part] = createIslandIndex({ width: 960, height: 540, islands: [polygon] }).parts;
  if (part === undefined) {
    throw new Error('The index built no part');
  }
  return part;
}

function overlapOf(part: IslandPart, x: number, y: number, radius: number): Overlap | null {
  const overlap: Overlap = { depth: NaN, normalX: NaN, normalY: NaN };
  return circlePolygonOverlap(part, x, y, radius, overlap) ? overlap : null;
}

function expectOverlap(actual: Overlap | null, expected: Overlap): void {
  expect(actual).not.toBeNull();
  expect(actual?.depth).toBeCloseTo(expected.depth, 9);
  expect(actual?.normalX).toBeCloseTo(expected.normalX, 9);
  expect(actual?.normalY).toBeCloseTo(expected.normalY, 9);
}

function edgeEnd(polygon: ConvexPolygon, edge: number): Point {
  const end = polygon[(edge + 1) % polygon.length];
  if (end === undefined) {
    throw new Error('The polygon has no such edge');
  }
  return end;
}

function centroidOf(polygon: ConvexPolygon): Point {
  return {
    x: polygon.reduce((sum, vertex) => sum + vertex.x, 0) / polygon.length,
    y: polygon.reduce((sum, vertex) => sum + vertex.y, 0) / polygon.length,
  };
}

function awayFrom(origin: Point, target: Point, distance: number): Point {
  const length = Math.hypot(target.x - origin.x, target.y - origin.y);
  return {
    x: target.x + ((target.x - origin.x) / length) * distance,
    y: target.y + ((target.y - origin.y) / length) * distance,
  };
}

function delicateCentres(polygon: ConvexPolygon): Point[] {
  const centroid = centroidOf(polygon);
  const centres: Point[] = [];
  for (const [edge, start] of polygon.entries()) {
    const end = edgeEnd(polygon, edge);
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const outward = { x: (end.y - start.y) / length, y: (start.x - end.x) / length };

    centres.push(start);
    centres.push(awayFrom(centroid, start, HAIR));
    for (const fraction of [0.25, 1 / 3, 0.5, 0.7]) {
      const onTheEdge = {
        x: start.x + (end.x - start.x) * fraction,
        y: start.y + (end.y - start.y) * fraction,
      };

      centres.push(onTheEdge);
      centres.push({ x: onTheEdge.x + outward.x * HAIR, y: onTheEdge.y + outward.y * HAIR });
    }
  }
  return centres;
}

function sweepAcross(coordinates: readonly number[]): number[] {
  const last = Math.max(...coordinates) + SWEEP_MARGIN;
  const swept: number[] = [];
  for (let value = Math.min(...coordinates) - SWEEP_MARGIN; value <= last; value += SWEEP_SPACING) {
    swept.push(value);
  }
  return swept;
}

function centresAround(polygon: ConvexPolygon): Point[] {
  const xs = sweepAcross(polygon.map((vertex) => vertex.x));
  const ys = sweepAcross(polygon.map((vertex) => vertex.y));
  return xs.flatMap((x) => ys.map((y) => ({ x, y })));
}

function distanceToSegment(start: Point, end: Point, x: number, y: number): number {
  const edgeX = end.x - start.x;
  const edgeY = end.y - start.y;
  const along = ((x - start.x) * edgeX + (y - start.y) * edgeY) / (edgeX * edgeX + edgeY * edgeY);
  const nearest = Math.min(Math.max(along, 0), 1);
  return Math.hypot(x - (start.x + nearest * edgeX), y - (start.y + nearest * edgeY));
}

function distanceToPolygon(polygon: ConvexPolygon, x: number, y: number): number {
  const toTheShore = Math.min(
    ...polygon.map((start, edge) => distanceToSegment(start, edgeEnd(polygon, edge), x, y)),
  );
  const inside = polygon.every((start, edge) => {
    const end = edgeEnd(polygon, edge);
    return (end.x - start.x) * (y - start.y) - (end.y - start.y) * (x - start.x) > 0;
  });
  return inside ? -toTheShore : toTheShore;
}

describe('circle against a convex polygon (ADR-0007)', () => {
  test("CB-02 a circle overlapping an edge is pushed out along that edge's normal by the overlap", () => {
    const quay = partOf(QUAY);
    const reef = partOf(REEF);

    expectOverlap(overlapOf(quay, 200, 85, 20), { depth: 5, normalX: 0, normalY: -1 });
    expectOverlap(overlapOf(quay, 310, 150, 20), { depth: 10, normalX: 1, normalY: 0 });
    expectOverlap(overlapOf(quay, 150, 212, 20), { depth: 8, normalX: 0, normalY: 1 });
    expectOverlap(overlapOf(quay, 95, 130, 20), { depth: 15, normalX: -1, normalY: 0 });
    expectOverlap(overlapOf(quay, 299, 85, 20), { depth: 5, normalX: 0, normalY: -1 });
    expectOverlap(overlapOf(reef, 259.6, 307.2, 20), { depth: 8, normalX: 0.8, normalY: 0.6 });
  });

  test('CB-02 a circle overlapping a corner is pushed out along the line from the vertex to its centre', () => {
    const quay = partOf(QUAY);
    const reef = partOf(REEF);

    expectOverlap(overlapOf(quay, 309, 212, 20), { depth: 5, normalX: 0.6, normalY: 0.8 });
    expectOverlap(overlapOf(quay, 88, 95, 20), { depth: 7, normalX: -12 / 13, normalY: -5 / 13 });
    expectOverlap(overlapOf(quay, 308, 85, 20), { depth: 3, normalX: 8 / 17, normalY: -15 / 17 });
    expectOverlap(overlapOf(quay, 93, 224, 30), { depth: 5, normalX: -7 / 25, normalY: 24 / 25 });
    expectOverlap(overlapOf(reef, 103, 504, 10), { depth: 5, normalX: 0.6, normalY: 0.8 });
  });

  test('CB-02 a circle whose centre is inside the part is pushed out through the nearest edge', () => {
    const quay = partOf(QUAY);
    const reef = partOf(REEF);

    expectOverlap(overlapOf(quay, 120, 150, 10), { depth: 30, normalX: -1, normalY: 0 });
    expectOverlap(overlapOf(quay, 250, 190, 5), { depth: 15, normalX: 0, normalY: 1 });
    expectOverlap(overlapOf(quay, 295, 103, 8), { depth: 11, normalX: 0, normalY: -1 });
    expectOverlap(overlapOf(quay, 200, 150, 1), { depth: 51, normalX: 0, normalY: -1 });
    expectOverlap(overlapOf(reef, 242, 294, 6), { depth: 16, normalX: 0.8, normalY: 0.6 });
  });

  test('CB-02 a circle that only touches a part, or is apart from it, does not overlap', () => {
    const quay = partOf(QUAY);
    const reef = partOf(REEF);

    expect(overlapOf(quay, 200, 80, 20)).toBeNull();
    expect(overlapOf(quay, 320, 150, 20)).toBeNull();
    expect(overlapOf(quay, 312, 216, 20)).toBeNull();
    expect(overlapOf(quay, 315, 215, 20)).toBeNull();
    expect(overlapOf(quay, 500, 400, 20)).toBeNull();
    expect(overlapOf(reef, 250 + 0.8 * 20.000001, 300 + 0.6 * 20.000001, 20)).toBeNull();

    expectOverlap(overlapOf(quay, 200, 80.001, 20), { depth: 0.001, normalX: 0, normalY: -1 });
    expectOverlap(overlapOf(quay, 311.4, 215.2, 20), { depth: 1, normalX: 0.6, normalY: 0.8 });
    expectOverlap(overlapOf(reef, 250 + 0.8 * 19.999999, 300 + 0.6 * 19.999999, 20), {
      depth: 0.000001,
      normalX: 0.8,
      normalY: 0.6,
    });
  });

  test('CB-02 a centre exactly on an edge, exactly on a vertex or a hair outside an edge still gets a finite unit vector', () => {
    for (const polygon of [SKERRY, REEF, QUAY]) {
      const part = partOf(polygon);
      const centroid = centroidOf(polygon);

      for (const centre of delicateCentres(polygon)) {
        for (const radius of [0.5, 24]) {
          const overlap = overlapOf(part, centre.x, centre.y, radius) ?? {
            depth: NaN,
            normalX: NaN,
            normalY: NaN,
          };
          const outward =
            overlap.normalX * (centre.x - centroid.x) + overlap.normalY * (centre.y - centroid.y);

          expect(Number.isFinite(overlap.depth)).toBe(true);
          expect(Number.isFinite(overlap.normalX)).toBe(true);
          expect(Number.isFinite(overlap.normalY)).toBe(true);
          expect(Math.abs(Math.hypot(overlap.normalX, overlap.normalY) - 1)).toBeLessThan(
            UNIT_LENGTH_ERROR,
          );
          expect(overlap.depth).toBeGreaterThan(0);
          expect(Math.abs(overlap.depth - radius)).toBeLessThan(TOLERANCE);
          expect(outward).toBeGreaterThan(0);
        }
      }
    }
  });

  test('CB-02 after the push the circle is tangent to the part, for circles all around a triangle and a rectangle', () => {
    for (const polygon of [SKERRY, QUAY]) {
      const part = partOf(polygon);
      const centres = [...delicateCentres(polygon), ...centresAround(polygon)];

      for (const radius of SWEEP_RADII) {
        const undetected: Point[] = [];
        const imagined: Point[] = [];
        const notTangent: Push[] = [];
        let pushed = 0;

        for (const centre of centres) {
          const penetration = radius - distanceToPolygon(polygon, centre.x, centre.y);
          const overlap = overlapOf(part, centre.x, centre.y, radius);

          if (overlap === null) {
            if (penetration > TOLERANCE) {
              undetected.push(centre);
            }
            continue;
          }
          const movedX = centre.x + overlap.normalX * overlap.depth;
          const movedY = centre.y + overlap.normalY * overlap.depth;
          const left = radius - distanceToPolygon(polygon, movedX, movedY);
          const again = overlapOf(part, movedX, movedY, radius);

          pushed += 1;
          if (penetration < -TOLERANCE) {
            imagined.push(centre);
          }
          if (
            !(overlap.depth > 0) ||
            !(Math.abs(left) <= TOLERANCE) ||
            (again !== null && !(again.depth <= TOLERANCE))
          ) {
            notTangent.push({ centre, radius, left });
          }
        }

        expect(undetected).toEqual([]);
        expect(imagined).toEqual([]);
        expect(notTangent).toEqual([]);
        expect(pushed).toBeGreaterThan(centres.length / 20);
      }
    }
  });
});
