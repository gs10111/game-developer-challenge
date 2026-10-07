import type { Overlap } from '../../collision/circlePolygon';
import type { IslandIndex } from '../../collision/islandIndex';
import { deepestIslandOverlap } from '../../collision/islandOverlap';
import { ISLAND_PUSH_ROUNDS } from '../../limits';
import type { Ship, World } from '../../world';

const overlap: Overlap = { depth: 0, normalX: 0, normalY: 0 };

function pushOutOfTheDeepestOverlap(islands: IslandIndex, ship: Ship): boolean {
  if (!deepestIslandOverlap(islands, ship.x, ship.y, ship.radius, overlap)) {
    return false;
  }
  ship.x += overlap.normalX * overlap.depth;
  ship.y += overlap.normalY * overlap.depth;
  return true;
}

export function islandCollision(world: World): void {
  const islands = world.islands;
  const slots = world.ships.slots;
  const capacity = slots.length;
  for (let index = 0; index < capacity; index += 1) {
    const ship = slots[index];
    if (ship?.active) {
      let round = 0;
      while (round < ISLAND_PUSH_ROUNDS && pushOutOfTheDeepestOverlap(islands, ship)) {
        round += 1;
      }
    }
  }
}
