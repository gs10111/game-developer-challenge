import { Layer } from '../collision/layers';
import { EventKind, pushEvent } from '../events';
import { release } from '../pool';
import type { World } from '../world';

function applyPendingDamage(world: World): void {
  const pool = world.ships;
  const slots = pool.slots;
  const capacity = slots.length;
  for (let index = 0; index < capacity; index += 1) {
    const ship = slots[index];
    if (ship?.active && ship.pendingDamage > 0) {
      const healthBefore = ship.health;
      ship.health = Math.max(0, healthBefore - ship.pendingDamage);
      ship.pendingDamage = 0;
      if (healthBefore > 0 && ship.health === 0) {
        pushEvent(world.events, EventKind.Destroyed, ship.layer, null, ship.x, ship.y, 0, 0);
        if (ship.layer === Layer.Enemy) {
          world.score += 1;
          release(pool, ship);
        }
      }
    }
  }
}

function releaseConsumedProjectiles(world: World): void {
  const pool = world.projectiles;
  const slots = pool.slots;
  const capacity = slots.length;
  for (let index = 0; index < capacity; index += 1) {
    const projectile = slots[index];
    if (projectile?.active && projectile.consumed) {
      release(pool, projectile);
    }
  }
}

export function damage(world: World): void {
  applyPendingDamage(world);
  releaseConsumedProjectiles(world);
}
