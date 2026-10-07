import { layersMeet } from '../../collision/layers';
import { segmentCircleEntry } from '../../collision/segmentCircle';
import { EventKind, pushEvent } from '../../events';
import type { Projectile, Ship, World } from '../../world';

const NO_ENTRY = 1;

function hitTheFirstShipOnThePath(world: World, projectile: Projectile): void {
  const startX = projectile.previousX;
  const startY = projectile.previousY;
  const endX = projectile.x;
  const endY = projectile.y;
  const layer = projectile.layer;
  const radius = projectile.radius;
  const slots = world.ships.slots;
  const capacity = slots.length;
  let target: Ship | null = null;
  let entry = NO_ENTRY;
  for (let index = 0; index < capacity; index += 1) {
    const ship = slots[index];
    if (ship?.active && layersMeet(ship.layer, layer)) {
      const fraction = segmentCircleEntry(
        startX,
        startY,
        endX,
        endY,
        ship.x,
        ship.y,
        ship.radius + radius,
      );
      if (fraction >= 0 && fraction < entry) {
        entry = fraction;
        target = ship;
      }
    }
  }
  if (target !== null) {
    projectile.consumed = true;
    target.pendingDamage += projectile.damage;
    pushEvent(
      world.events,
      EventKind.Hit,
      target.layer,
      null,
      startX + (endX - startX) * entry,
      startY + (endY - startY) * entry,
      projectile.directionX,
      projectile.directionY,
    );
  }
}

export function projectileHits(world: World): void {
  const slots = world.projectiles.slots;
  const capacity = slots.length;
  for (let index = 0; index < capacity; index += 1) {
    const projectile = slots[index];
    if (projectile?.active && !projectile.consumed) {
      hitTheFirstShipOnThePath(world, projectile);
    }
  }
}
