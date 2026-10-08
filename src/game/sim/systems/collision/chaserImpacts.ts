import { layersMeet } from '../../collision/layers';
import { EventKind, pushEvent } from '../../events';
import { cosine, sine } from '../../math/rotation';
import { ShipKind } from '../../world';
import type { World } from '../../world';

export function chaserImpacts(world: World): void {
  const player = world.player;
  if (!player.active) {
    return;
  }
  const slots = world.ships.slots;
  const capacity = slots.length;
  for (let index = 0; index < capacity; index += 1) {
    const ship = slots[index];
    if (
      ship?.active &&
      ship.kind === ShipKind.Chaser &&
      !ship.exploded &&
      layersMeet(ship.layer, player.layer) &&
      ship.health - ship.pendingDamage > 0
    ) {
      const offsetX = player.x - ship.x;
      const offsetY = player.y - ship.y;
      const reach = ship.radius + player.radius;
      if (offsetX * offsetX + offsetY * offsetY < reach * reach) {
        ship.exploded = true;
        player.pendingDamage += ship.contactDamage;
        pushEvent(
          world.events,
          EventKind.Hit,
          player.layer,
          null,
          ship.x + (offsetX * ship.radius) / reach,
          ship.y + (offsetY * ship.radius) / reach,
          cosine(ship.heading),
          sine(ship.heading),
        );
      }
    }
  }
}
