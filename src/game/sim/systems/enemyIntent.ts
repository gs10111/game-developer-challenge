import { turnToward } from '../ai/pursuit';
import { ShipKind } from '../world';
import type { Ship, World } from '../world';

function chaserIntent(ship: Ship, player: Ship, dt: number): void {
  ship.thrust = 1;
  ship.turn = turnToward(ship, player.x, player.y, dt);
}

function shooterIntent(ship: Ship, player: Ship, dt: number): void {
  const offsetX = player.x - ship.x;
  const offsetY = player.y - ship.y;
  const inRange = offsetX * offsetX + offsetY * offsetY <= ship.attackRange * ship.attackRange;
  const turn = turnToward(ship, player.x, player.y, dt);
  ship.turn = turn;
  ship.thrust = inRange ? 0 : 1;
  ship.fireFront = inRange && turn === 0 ? 1 : 0;
}

export function enemyIntent(world: World, dt: number): void {
  const player = world.player;
  const slots = world.ships.slots;
  const capacity = slots.length;
  for (let index = 0; index < capacity; index += 1) {
    const ship = slots[index];
    if (ship?.active) {
      if (ship.kind === ShipKind.Chaser) {
        chaserIntent(ship, player, dt);
      } else if (ship.kind === ShipKind.Shooter) {
        shooterIntent(ship, player, dt);
      }
    }
  }
}
