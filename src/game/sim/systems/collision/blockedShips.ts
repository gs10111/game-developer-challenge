import type { Overlap } from '../../collision/circlePolygon';
import { deepestIslandOverlap } from '../../collision/islandOverlap';
import { CONTACT_TOLERANCE } from '../../limits';
import type { World } from '../../world';

const overlap: Overlap = { depth: 0, normalX: 0, normalY: 0 };

export function blockedShips(world: World): void {
  const islands = world.islands;
  const slots = world.ships.slots;
  const capacity = slots.length;
  for (let index = 0; index < capacity; index += 1) {
    const ship = slots[index];
    if (
      ship?.active &&
      deepestIslandOverlap(islands, ship.x, ship.y, ship.radius, overlap) &&
      overlap.depth > CONTACT_TOLERANCE
    ) {
      ship.x = ship.previousX;
      ship.y = ship.previousY;
    }
  }
}
