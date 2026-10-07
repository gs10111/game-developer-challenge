import { describe, expect, test } from 'vitest';
import type { ConvexPolygon, Point } from '../../config/gameConfig';
import { circlePolygonOverlap } from './circlePolygon';
import type { Overlap } from './circlePolygon';
import { createIslandIndex } from './islandIndex';
import type { IslandIndex } from './islandIndex';
import { deepestIslandOverlap } from './islandOverlap';

const ARENA = { width: 960, height: 540 };
const SWEEP_MARGIN = 40;
const SWEEP_SPACING = 13.7;
const SWEEP_RADII = [3, 24, 60];

interface Circle {
  x: number;
  y: number;
  radius: number;
}

function rectangle(left: number, top: number, right: number, bottom: number): Point[] {
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

function indexOf(islands: readonly ConvexPolygon[]): IslandIndex {
  return createIslandIndex({ ...ARENA, islands });
}

function deepestOf(index: IslandIndex, { x, y, radius }: Circle): Overlap | null {
  const overlap: Overlap = { depth: NaN, normalX: NaN, normalY: NaN };
  return deepestIslandOverlap(index, x, y, radius, overlap) ? overlap : null;
}

function overlapsPartByPart(index: IslandIndex, { x, y, radius }: Circle): Overlap[] {
  const overlaps: Overlap[] = [];
  for (const part of index.parts) {
    const overlap: Overlap = { depth: NaN, normalX: NaN, normalY: NaN };
    if (circlePolygonOverlap(part, x, y, radius, overlap)) {
      overlaps.push(overlap);
    }
  }
  return overlaps;
}

function depthsPartByPart(index: IslandIndex, circle: Circle): number[] {
  return overlapsPartByPart(index, circle).map(({ depth }) => depth);
}

function ordersOf<Item>(items: readonly Item[]): Item[][] {
  if (items.length <= 1) {
    return [[...items]];
  }
  return items.flatMap((item, position) =>
    ordersOf(items.filter((_, other) => other !== position)).map((rest) => [item, ...rest]),
  );
}

function sweepAlong(length: number): number[] {
  const swept: number[] = [];
  for (let value = -SWEEP_MARGIN; value <= length + SWEEP_MARGIN; value += SWEEP_SPACING) {
    swept.push(value);
  }
  return swept;
}

function expectOverlap(actual: Overlap | null, expected: Overlap): void {
  expect(actual).not.toBeNull();
  expect(actual?.depth).toBeCloseTo(expected.depth, 9);
  expect(actual?.normalX).toBeCloseTo(expected.normalX, 9);
  expect(actual?.normalY).toBeCloseTo(expected.normalY, 9);
}

describe('deepest island overlap (ADR-0007)', () => {
  test('CB-02 the deepest overlap of a circle with the islands is the greatest among the parts under it, and the first found wins a tie', () => {
    const north = rectangle(360, 200, 425, 265);
    const east = rectangle(431, 270, 520, 330);
    const south = rectangle(360, 337, 425, 420);
    const amongThree = { x: 400, y: 300, radius: 40 };

    for (const islands of ordersOf([north, east, south])) {
      const index = indexOf(islands);

      expect(depthsPartByPart(index, amongThree).sort((first, second) => first - second)).toEqual(
        [3, 5, 9],
      );
      expectOverlap(deepestOf(index, amongThree), { depth: 9, normalX: -1, normalY: 0 });
    }

    const west = rectangle(100, 100, 300, 200);
    const farShore = rectangle(320, 100, 500, 200);
    const midChannel = { x: 310, y: 150, radius: 20 };

    for (const islands of [
      [west, farShore],
      [farShore, west],
    ]) {
      const index = indexOf(islands);

      expectOverlap(deepestOf(index, { x: 312, y: 150, radius: 20 }), {
        depth: 12,
        normalX: -1,
        normalY: 0,
      });
      expectOverlap(deepestOf(index, { x: 308, y: 150, radius: 20 }), {
        depth: 12,
        normalX: 1,
        normalY: 0,
      });
      expect(depthsPartByPart(index, midChannel)).toEqual([10, 10]);
    }
    expectOverlap(deepestOf(indexOf([west, farShore]), midChannel), {
      depth: 10,
      normalX: 1,
      normalY: 0,
    });
    expectOverlap(deepestOf(indexOf([farShore, west]), midChannel), {
      depth: 10,
      normalX: -1,
      normalY: 0,
    });

    const leftColumn = rectangle(40, 40, 108, 100);
    const rightColumn = rectangle(148, 40, 220, 100);
    const acrossTheColumns = { x: 128, y: 70, radius: 25 };
    const upperRow = rectangle(100, 60, 200, 110);
    const lowerRow = rectangle(100, 150, 200, 250);
    const acrossTheRows = { x: 150, y: 130, radius: 30 };
    const upperRight = rectangle(140, 60, 200, 112);
    const lowerLeft = rectangle(60, 140, 112, 200);
    const onTheCrossing = { x: 128, y: 128, radius: 25 };

    for (const islands of [
      [leftColumn, rightColumn],
      [rightColumn, leftColumn],
    ]) {
      const index = indexOf(islands);

      expect(depthsPartByPart(index, acrossTheColumns)).toEqual([5, 5]);
      expectOverlap(deepestOf(index, acrossTheColumns), { depth: 5, normalX: 1, normalY: 0 });
    }
    for (const islands of [
      [upperRow, lowerRow],
      [lowerRow, upperRow],
    ]) {
      const index = indexOf(islands);

      expect(depthsPartByPart(index, acrossTheRows)).toEqual([10, 10]);
      expectOverlap(deepestOf(index, acrossTheRows), { depth: 10, normalX: 0, normalY: 1 });
    }
    for (const islands of [
      [upperRight, lowerLeft],
      [lowerLeft, upperRight],
    ]) {
      const index = indexOf(islands);

      expect(depthsPartByPart(index, onTheCrossing)).toEqual([5, 5]);
      expectOverlap(deepestOf(index, onTheCrossing), { depth: 5, normalX: -0.6, normalY: 0.8 });
    }

    const archipelago = indexOf([
      rectangle(128, 0, 384, 128),
      rectangle(256, 128, 384, 256),
      rectangle(640, 384, 896, 540),
      [
        { x: 704, y: 64 },
        { x: 832, y: 128 },
        { x: 736, y: 192 },
      ],
      rectangle(128, 384, 256, 512),
      rectangle(500, 130, 560, 250),
      rectangle(500, 290, 560, 410),
    ]);
    const notTheGreatest: Circle[] = [];
    const imagined: Circle[] = [];
    let overOnePart = 0;
    let overSeveralParts = 0;
    let clear = 0;

    for (const radius of SWEEP_RADII) {
      for (const x of sweepAlong(ARENA.width)) {
        for (const y of sweepAlong(ARENA.height)) {
          const circle = { x, y, radius };
          const candidates = overlapsPartByPart(archipelago, circle);
          const greatest = Math.max(...candidates.map(({ depth }) => depth));
          const deepest = deepestOf(archipelago, circle);

          if (candidates.length === 0) {
            clear += 1;
            if (deepest !== null) {
              imagined.push(circle);
            }
            continue;
          }
          overOnePart += candidates.length === 1 ? 1 : 0;
          overSeveralParts += candidates.length > 1 ? 1 : 0;
          if (
            !candidates.some(
              (candidate) =>
                candidate.depth === greatest &&
                candidate.depth === deepest?.depth &&
                candidate.normalX === deepest.normalX &&
                candidate.normalY === deepest.normalY,
            )
          ) {
            notTheGreatest.push(circle);
          }
        }
      }
    }

    expect(notTheGreatest).toEqual([]);
    expect(imagined).toEqual([]);
    expect(overOnePart).toBeGreaterThan(1000);
    expect(overSeveralParts).toBeGreaterThan(100);
    expect(clear).toBeGreaterThan(1000);
  });

  test('CB-02 a circle clear of every part reports no overlap and leaves the result untouched', () => {
    const quay = rectangle(100, 100, 300, 200);
    const reef = [
      { x: 500, y: 100 },
      { x: 800, y: 100 },
      { x: 500, y: 500 },
    ];
    const openSea = indexOf([]);
    const harbour = indexOf([quay, reef]);
    const clearCircles = [
      { x: 200, y: 400, radius: 20 },
      { x: 200, y: 60, radius: 20 },
      { x: 200, y: 80, radius: 20 },
      { x: 320, y: 150, radius: 20 },
      { x: 312, y: 216, radius: 20 },
      { x: 97, y: 96, radius: 5 },
      { x: 700, y: 400, radius: 20 },
      { x: 400, y: 150, radius: 100 },
      { x: -50, y: -50, radius: 30 },
      { x: 1200, y: 700, radius: 30 },
    ];

    for (const index of [openSea, harbour]) {
      for (const { x, y, radius } of clearCircles) {
        const result: Overlap = { depth: 7.5, normalX: -0.25, normalY: 0.125 };

        expect(deepestIslandOverlap(index, x, y, radius, result)).toBe(false);
        expect(result).toStrictEqual({ depth: 7.5, normalX: -0.25, normalY: 0.125 });
      }
    }

    expectOverlap(deepestOf(harbour, { x: 200, y: 80.001, radius: 20 }), {
      depth: 0.001,
      normalX: 0,
      normalY: -1,
    });
    expectOverlap(deepestOf(harbour, { x: 311.4, y: 215.2, radius: 20 }), {
      depth: 1,
      normalX: 0.6,
      normalY: 0.8,
    });
    expectOverlap(deepestOf(harbour, { x: 400.5, y: 150, radius: 100 }), {
      depth: 0.5,
      normalX: -1,
      normalY: 0,
    });
    expect(deepestOf(openSea, { x: 200, y: 150, radius: 20 })).toBeNull();

    const result: Overlap = { depth: NaN, normalX: NaN, normalY: NaN };

    expect(deepestIslandOverlap(harbour, 200, 85, 20, result)).toBe(true);
    expectOverlap(result, { depth: 5, normalX: 0, normalY: -1 });

    const written = { ...result };

    expect(deepestIslandOverlap(harbour, 200, 80, 20, result)).toBe(false);
    expect(deepestIslandOverlap(harbour, 700, 400, 20, result)).toBe(false);
    expect(result).toStrictEqual(written);
  });
});
