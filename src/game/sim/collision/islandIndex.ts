import type { ConvexPolygon, GameConfig, Point } from '../../config/gameConfig';
import { ISLAND_GRID_CELL } from '../limits';

export interface IslandPart {
  readonly vertices: readonly Point[];
  readonly normals: readonly Point[];
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface IslandIndex {
  readonly parts: readonly IslandPart[];
  readonly columns: number;
  readonly rows: number;
  readonly cells: readonly (readonly number[])[];
}

export interface CellRange {
  firstColumn: number;
  lastColumn: number;
  firstRow: number;
  lastRow: number;
}

function outwardNormal(start: Point, end: Point): Point {
  const x = end.y - start.y;
  const y = start.x - end.x;
  const length = Math.sqrt(x * x + y * y);
  return { x: x / length, y: y / length };
}

function createPart(polygon: ConvexPolygon): IslandPart {
  const vertices = polygon.map(({ x, y }) => ({ x, y }));
  const normals = vertices.map((start, edge) =>
    outwardNormal(start, vertices[(edge + 1) % vertices.length] ?? start),
  );
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { x, y } of vertices) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { vertices, normals, minX, minY, maxX, maxY };
}

function cellCoordinate(position: number, count: number): number {
  return Math.min(Math.max(Math.floor(position / ISLAND_GRID_CELL), 0), count - 1);
}

export function cellRange(
  index: IslandIndex,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  out: CellRange,
): void {
  out.firstColumn = cellCoordinate(minX, index.columns);
  out.lastColumn = cellCoordinate(maxX, index.columns);
  out.firstRow = cellCoordinate(minY, index.rows);
  out.lastRow = cellCoordinate(maxY, index.rows);
}

export function createIslandIndex(arena: GameConfig['arena']): IslandIndex {
  const columns = Math.ceil(arena.width / ISLAND_GRID_CELL);
  const rows = Math.ceil(arena.height / ISLAND_GRID_CELL);
  const parts = arena.islands.map(createPart);
  const cells = Array.from({ length: columns * rows }, (): number[] => []);
  const index: IslandIndex = { parts, columns, rows, cells };
  const range: CellRange = { firstColumn: 0, lastColumn: 0, firstRow: 0, lastRow: 0 };
  for (const [position, part] of parts.entries()) {
    cellRange(index, part.minX, part.minY, part.maxX, part.maxY, range);
    for (let row = range.firstRow; row <= range.lastRow; row += 1) {
      for (let column = range.firstColumn; column <= range.lastColumn; column += 1) {
        cells[row * columns + column]?.push(position);
      }
    }
  }
  return index;
}
