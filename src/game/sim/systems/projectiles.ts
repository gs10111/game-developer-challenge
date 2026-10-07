import { release } from '../pool';
import type { World } from '../world';

export function projectiles(world: World, dt: number): void {
  const pool = world.projectiles;
  const slots = pool.slots;
  const capacity = slots.length;
  for (let index = 0; index < capacity; index += 1) {
    const projectile = slots[index];
    if (projectile?.active) {
      if (projectile.remainingSteps === 0) {
        release(pool, projectile);
      } else {
        const distance = projectile.speed * dt;
        projectile.previousX = projectile.x;
        projectile.previousY = projectile.y;
        projectile.x += projectile.directionX * distance;
        projectile.y += projectile.directionY * distance;
        projectile.remainingSteps -= 1;
      }
    }
  }
}
