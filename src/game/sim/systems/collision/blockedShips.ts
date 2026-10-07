import { circlePolygonOverlap } from '../../collision/circlePolygon';
import type { Overlap } from '../../collision/circlePolygon';
import { cellRange } from '../../collision/islandIndex';
import type { CellRange, IslandIndex } from '../../collision/islandIndex';
import { CONTACT_TOLERANCE } from '../../limits';
import type { Ship, World } from '../../world';

const range: CellRange = { firstColumn: 0, lastColumn: 0, firstRow: 0, lastRow: 0 };
const overlap: Overlap = { depth: 0, normalX: 0, normalY: 0 };

function overlapsAnIsland(islands: IslandIndex, ship: Ship): boolean {
  const { parts, columns, cells } = islands;
  const { x, y, radius } = ship;
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
          circlePolygonOverlap(part, x, y, radius, overlap) &&
          overlap.depth > CONTACT_TOLERANCE
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

export function blockedShips(world: World): void {
  const islands = world.islands;
  const slots = world.ships.slots;
  const capacity = slots.length;
  for (let index = 0; index < capacity; index += 1) {
    const ship = slots[index];
    if (ship?.active && overlapsAnIsland(islands, ship)) {
      ship.x = ship.previousX;
      ship.y = ship.previousY;
    }
  }
}
