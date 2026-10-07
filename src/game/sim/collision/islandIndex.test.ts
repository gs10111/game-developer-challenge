import { describe, expect, test } from 'vitest';
import type { ConvexPolygon, GameConfig, Point } from '../../config/gameConfig';
import { ISLAND_GRID_CELL } from '../limits';
import { cellRange, createIslandIndex } from './islandIndex';
import type { CellRange, IslandIndex } from './islandIndex';

type Arena = GameConfig['arena'];

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface Chart {
  columns: number;
  rows: number;
  bounds: Box[];
}

const BOX_SIZES = [0, 48, 130];
const SWEEP_MARGIN = 200;

function rectangle(left: number, top: number, right: number, bottom: number): Point[] {
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

function buildArena(height: number): Arena {
  return {
    width: 1024,
    height,
    islands: [
      rectangle(128, 0, 384, 128),
      rectangle(256, 128, 384, 256),
      rectangle(640, 384, 896, height),
      [
        { x: 700, y: 60 },
        { x: 840, y: 130 },
        { x: 730, y: 200 },
      ],
      rectangle(150, 400, 230, 500),
      rectangle(960, 200, 1024, 330),
      [
        { x: 40, y: 250 },
        { x: 100, y: 230 },
        { x: 120, y: 300 },
        { x: 60, y: 340 },
      ],
    ],
  };
}

function at<Item>(items: readonly Item[], position: number): Item {
  const item = items[position];
  if (item === undefined) {
    throw new Error('The list is shorter than the test expects');
  }
  return item;
}

function boundsOf(polygon: ConvexPolygon): Box {
  const xs = polygon.map(({ x }) => x);
  const ys = polygon.map(({ y }) => y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

function touches(first: Box, second: Box): boolean {
  return (
    first.minX <= second.maxX &&
    first.maxX >= second.minX &&
    first.minY <= second.maxY &&
    first.maxY >= second.minY
  );
}

function sweepAlong(length: number): number[] {
  const values = new Set<number>();
  for (let value = -SWEEP_MARGIN; value <= length + SWEEP_MARGIN; value += 10) {
    values.add(value);
  }
  for (let value = -ISLAND_GRID_CELL; value <= length + ISLAND_GRID_CELL; value += 64) {
    values.add(value);
  }
  return [...values];
}

function sweepOfBoxes(arena: Arena): Box[] {
  const boxes: Box[] = [];
  for (const minX of sweepAlong(arena.width)) {
    for (const minY of sweepAlong(arena.height)) {
      for (const width of BOX_SIZES) {
        for (const height of BOX_SIZES) {
          boxes.push({ minX, minY, maxX: minX + width, maxY: minY + height });
        }
      }
    }
  }
  return boxes;
}

function isOutsideTheArena(box: Box, arena: Arena): boolean {
  return (
    box.minX >= arena.width || box.maxX <= 0 || box.minY >= arena.height || box.maxY <= 0
  );
}

function rangeOf(index: IslandIndex, box: Box): CellRange {
  const range: CellRange = { firstColumn: 0, lastColumn: -1, firstRow: 0, lastRow: -1 };
  cellRange(index, box.minX, box.minY, box.maxX, box.maxY, range);
  return range;
}

function visit(index: IslandIndex, box: Box): number[] {
  const range = rangeOf(index, box);
  const visited: number[] = [];
  for (let row = range.firstRow; row <= range.lastRow; row += 1) {
    for (let column = range.firstColumn; column <= range.lastColumn; column += 1) {
      visited.push(...(index.cells[row * index.columns + column] ?? []));
    }
  }
  return visited;
}

function cellOf(value: number, count: number): number {
  return Math.min(Math.max(Math.floor(value / ISLAND_GRID_CELL), 0), count - 1);
}

function cellStart(position: number): number {
  return position === 0 ? -Infinity : position * ISLAND_GRID_CELL;
}

function cellEnd(position: number, count: number): number {
  return position === count - 1 ? Infinity : (position + 1) * ISLAND_GRID_CELL;
}

function chart(arena: Arena): Chart {
  return {
    columns: Math.ceil(arena.width / ISLAND_GRID_CELL),
    rows: Math.ceil(arena.height / ISLAND_GRID_CELL),
    bounds: arena.islands.map(boundsOf),
  };
}

function visitCellByCell({ columns, rows, bounds }: Chart, box: Box): number[] {
  const lastRow = cellOf(box.maxY, rows);
  const lastColumn = cellOf(box.maxX, columns);
  const visited: number[] = [];
  for (let row = cellOf(box.minY, rows); row <= lastRow; row += 1) {
    for (let column = cellOf(box.minX, columns); column <= lastColumn; column += 1) {
      for (const [position, part] of bounds.entries()) {
        const inTheColumn = part.maxX >= cellStart(column) && part.minX < cellEnd(column, columns);
        const inTheRow = part.maxY >= cellStart(row) && part.minY < cellEnd(row, rows);
        if (inTheColumn && inTheRow) {
          visited.push(position);
        }
      }
    }
  }
  return visited;
}

function reachableObjects(root: unknown, found = new Set<object>()): Set<object> {
  if (typeof root !== 'object' || root === null || found.has(root)) {
    return found;
  }
  found.add(root);
  for (const nested of Object.values(root)) {
    reachableObjects(nested, found);
  }
  return found;
}

function isPlainData(value: unknown): boolean {
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every(isPlainData);
  }
  if (typeof value === 'object' && value !== null) {
    return (
      Object.getPrototypeOf(value) === Object.prototype && Object.values(value).every(isPlainData)
    );
  }
  return false;
}

function expectVectors(actual: readonly Point[], expected: readonly Point[]): void {
  expect(actual).toHaveLength(expected.length);
  for (const [position, vector] of expected.entries()) {
    expect(at(actual, position).x).toBeCloseTo(vector.x, 14);
    expect(at(actual, position).y).toBeCloseTo(vector.y, 14);
  }
}

describe('island index (ADR-0007)', () => {
  test('CB-02 the index keeps the vertices, unit outward normals and bounding box of each part', () => {
    const shoal = rectangle(100, 100, 300, 200);
    const reef = [
      { x: 500, y: 100 },
      { x: 800, y: 100 },
      { x: 500, y: 500 },
    ];
    const { parts } = createIslandIndex({ width: 960, height: 540, islands: [shoal, reef] });

    expect(parts).toHaveLength(2);
    expect(at(parts, 0).vertices).toStrictEqual(shoal);
    expect(at(parts, 0)).toMatchObject({ minX: 100, minY: 100, maxX: 300, maxY: 200 });
    expectVectors(at(parts, 0).normals, [
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
    ]);
    expect(at(parts, 1).vertices).toStrictEqual(reef);
    expect(at(parts, 1)).toMatchObject({ minX: 500, minY: 100, maxX: 800, maxY: 500 });
    expectVectors(at(parts, 1).normals, [
      { x: 0, y: -1 },
      { x: 0.8, y: 0.6 },
      { x: -1, y: 0 },
    ]);

    const arena = buildArena(576);
    const index = createIslandIndex(arena);

    expect(index.parts).toHaveLength(arena.islands.length);
    for (const [position, polygon] of arena.islands.entries()) {
      const part = at(index.parts, position);
      const { minX, minY, maxX, maxY } = part;

      expect(part.vertices).toStrictEqual(polygon);
      expect({ minX, minY, maxX, maxY }).toStrictEqual(boundsOf(polygon));
      expect(part.normals).toHaveLength(polygon.length);
      for (const [edge, start] of polygon.entries()) {
        const end = at(polygon, (edge + 1) % polygon.length);
        const normal = at(part.normals, edge);
        const heights = polygon.map(
          (vertex) => (vertex.x - start.x) * normal.x + (vertex.y - start.y) * normal.y,
        );

        expect(Math.hypot(normal.x, normal.y)).toBeCloseTo(1, 14);
        expect((end.x - start.x) * normal.x + (end.y - start.y) * normal.y).toBeCloseTo(0, 9);
        expect(Math.max(...heights)).toBeLessThan(1e-9);
        expect(Math.min(...heights)).toBeLessThan(-1);
      }
    }
  });

  test('CB-02 the grid misses no part whose bounding box overlaps the query box', () => {
    for (const arena of [buildArena(576), buildArena(512)]) {
      const index = createIslandIndex(arena);
      const bounds = arena.islands.map(boundsOf);
      const missed: { box: Box; part: number }[] = [];
      const outOfTheGrid: Box[] = [];
      let overlapping = 0;
      let overlappingFromOutside = 0;

      for (const box of sweepOfBoxes(arena)) {
        const range = rangeOf(index, box);
        const visited = new Set(visit(index, box));
        const insideTheGrid =
          range.firstColumn >= 0 &&
          range.firstColumn <= range.lastColumn &&
          range.lastColumn <= index.columns - 1 &&
          range.firstRow >= 0 &&
          range.firstRow <= range.lastRow &&
          range.lastRow <= index.rows - 1;

        if (!insideTheGrid) {
          outOfTheGrid.push(box);
        }
        for (const [part, partBounds] of bounds.entries()) {
          if (touches(partBounds, box)) {
            overlapping += 1;
            overlappingFromOutside += isOutsideTheArena(box, arena) ? 1 : 0;
            if (!visited.has(part)) {
              missed.push({ box, part });
            }
          }
        }
      }

      expect(missed).toEqual([]);
      expect(outOfTheGrid).toEqual([]);
      expect(overlapping).toBeGreaterThan(10000);
      expect(overlappingFromOutside).toBeGreaterThan(100);
    }
  });

  test("CB-02 the grid visits the cells of a query by row, then column, with each cell's parts in ascending order", () => {
    const index = createIslandIndex(buildArena(576));

    expect(index.columns).toBe(8);
    expect(index.rows).toBe(5);
    expect(index.cells).toStrictEqual([
      ...[[], [0], [0], [0], [], [3], [3], []],
      ...[[6], [0], [0, 1], [0, 1], [], [3], [3], [5]],
      ...[[6], [], [1], [1], [], [], [], [5]],
      ...[[], [4], [], [], [], [2], [2], [2]],
      ...[[], [], [], [], [], [2], [2], [2]],
    ]);
    expect(visit(index, { minX: 200, minY: 100, maxX: 300, maxY: 140 })).toEqual([0, 0, 0, 0, 1]);
    expect(visit(index, { minX: 600, minY: 100, maxX: 980, maxY: 400 })).toEqual([
      3, 3, 3, 3, 5, 5, 2, 2, 2,
    ]);

    for (const arena of [buildArena(576), buildArena(512)]) {
      const swept = createIslandIndex(arena);
      const charted = chart(arena);
      const outOfOrder: Box[] = [];
      let visits = 0;

      for (const box of sweepOfBoxes(arena)) {
        const visited = visit(swept, box);
        const expected = visitCellByCell(charted, box);

        visits += expected.length;
        if (visited.join() !== expected.join()) {
          outOfOrder.push(box);
        }
      }

      expect(outOfOrder).toEqual([]);
      expect(visits).toBeGreaterThan(10000);
    }
  });

  test('CB-02 a part touching the right or bottom wall is registered in the edge cells', () => {
    const index = createIslandIndex({
      width: 1024,
      height: 512,
      islands: [
        rectangle(960, 100, 1024, 200),
        rectangle(300, 450, 380, 512),
        rectangle(896, 384, 1024, 512),
      ],
    });

    expect(index.columns).toBe(8);
    expect(index.rows).toBe(4);
    expect(index.cells).toStrictEqual([
      ...[[], [], [], [], [], [], [], [0]],
      ...[[], [], [], [], [], [], [], [0]],
      ...[[], [], [], [], [], [], [], []],
      ...[[], [], [1], [], [], [], [], [2]],
    ]);
    expect(visit(index, { minX: 1024, minY: 120, maxX: 1070, maxY: 160 })).toEqual([0, 0]);
    expect(visit(index, { minX: 310, minY: 512, maxX: 350, maxY: 560 })).toEqual([1]);
    expect(visit(index, { minX: 1024, minY: 512, maxX: 1100, maxY: 600 })).toEqual([2]);
  });

  test('PW-03 two indexes built from the same islands are equal', () => {
    const arena = buildArena(576);
    const index = createIslandIndex(arena);
    const again = createIslandIndex(arena);
    const rebuilt = createIslandIndex(buildArena(576));
    const shifted = createIslandIndex({
      ...arena,
      islands: [rectangle(129, 0, 384, 128), ...arena.islands.slice(1)],
    });
    const indexParts = reachableObjects(index);
    const sourceParts = reachableObjects(arena);

    expect(index.parts).toHaveLength(7);
    expect(index.cells).toHaveLength(40);
    expect(again).toStrictEqual(index);
    expect(rebuilt).toStrictEqual(index);
    expect(shifted).not.toEqual(index);
    expect(isPlainData(index)).toBe(true);
    expect(again).not.toBe(index);
    expect([...reachableObjects(again)].filter((part) => indexParts.has(part))).toEqual([]);
    expect([...indexParts].filter((part) => sourceParts.has(part))).toEqual([]);
  });
});
