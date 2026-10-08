import { turnToward } from '../ai/pursuit';
import { ShipKind } from '../world';
import type { World } from '../world';

export function enemyIntent(world: World, dt: number): void {
  const player = world.player;
  const slots = world.ships.slots;
  const capacity = slots.length;
  for (let index = 0; index < capacity; index += 1) {
    const ship = slots[index];
    if (ship?.active && ship.kind === ShipKind.Chaser) {
      ship.thrust = 1;
      ship.turn = turnToward(ship, player.x, player.y, dt);
    }
  }
}
