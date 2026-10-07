import { circlePolygonOverlap } from './circlePolygon';
import type { Overlap } from './circlePolygon';
import { cellRange } from './islandIndex';
import type { CellRange, IslandIndex } from './islandIndex';

const range: CellRange = { firstColumn: 0, lastColumn: 0, firstRow: 0, lastRow: 0 };

export function deepestIslandOverlap(
  islands: IslandIndex,
  x: number,
  y: number,
  radius: number,
  out: Overlap,
): boolean {
  const parts = islands.parts;
  const columns = islands.columns;
  const cells = islands.cells;
  let depth = 0;
  let normalX = 0;
  let normalY = 0;
  cellRange(islands, x - radius, y - radius, x + radius, y + radius, range);
  for (let row = range.firstRow; row <= range.lastRow; row += 1) {
    for (let column = range.firstColumn; column <= range.lastColumn; column += 1) {
      const cell = cells[row * columns + column];
      const count = cell === undefined ? 0 : cell.length;
      for (let position = 0; position < count; position += 1) {
        const candidate = cell?.[position];
        const part = candidate === undefined ? undefined : parts[candidate];
        if (
          part !== undefined &&
          circlePolygonOverlap(part, x, y, radius, out) &&
          out.depth > depth
        ) {
          depth = out.depth;
          normalX = out.normalX;
          normalY = out.normalY;
        }
      }
    }
  }
  if (depth === 0) {
    return false;
  }
  out.depth = depth;
  out.normalX = normalX;
  out.normalY = normalY;
  return true;
}
