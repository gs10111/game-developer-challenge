import type { Overlap } from '../../collision/circlePolygon';
import { deepestIslandOverlap } from '../../collision/islandOverlap';
import { release } from '../../pool';
import type { World } from '../../world';

const overlap: Overlap = { depth: 0, normalX: 0, normalY: 0 };

export function projectileObstacles(world: World): void {
  const width = world.config.arena.width;
  const height = world.config.arena.height;
  const islands = world.islands;
  const pool = world.projectiles;
  const slots = pool.slots;
  const capacity = slots.length;
  for (let index = 0; index < capacity; index += 1) {
    const projectile = slots[index];
    if (projectile?.active) {
      const x = projectile.x;
      const y = projectile.y;
      if (
        x < 0 ||
        x > width ||
        y < 0 ||
        y > height ||
        deepestIslandOverlap(islands, x, y, projectile.radius, overlap)
      ) {
        release(pool, projectile);
      }
    }
  }
}
