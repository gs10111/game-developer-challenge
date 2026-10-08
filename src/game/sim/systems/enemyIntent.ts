import { routeToPlayer } from '../ai/navigation';
import type { Route } from '../ai/navigation';
import { turnToward } from '../ai/pursuit';
import { ShipKind } from '../world';
import type { Ship, World } from '../world';

const route: Route = { x: 0, y: 0, direct: true };

function findRoute(world: World, ship: Ship, steers: boolean): void {
  if (steers) {
    routeToPlayer(world, ship.x, ship.y, route);
  } else {
    route.x = world.player.x;
    route.y = world.player.y;
    route.direct = true;
  }
}

function chaserIntent(ship: Ship, dt: number): void {
  ship.thrust = 1;
  ship.turn = turnToward(ship, route.x, route.y, dt);
}

function shooterIntent(ship: Ship, player: Ship, dt: number): void {
  const offsetX = player.x - ship.x;
  const offsetY = player.y - ship.y;
  const inRange = offsetX * offsetX + offsetY * offsetY <= ship.attackRange * ship.attackRange;
  const holds = inRange && route.direct;
  const turn = turnToward(ship, holds ? player.x : route.x, holds ? player.y : route.y, dt);
  ship.turn = turn;
  ship.thrust = holds ? 0 : 1;
  ship.fireFront = holds && turn === 0 ? 1 : 0;
}

export function enemyIntent(world: World, dt: number): void {
  const player = world.player;
  const steers = world.config.enemies.steersAroundIslands;
  const slots = world.ships.slots;
  const capacity = slots.length;
  for (let index = 0; index < capacity; index += 1) {
    const ship = slots[index];
    if (ship?.active) {
      if (ship.kind === ShipKind.Chaser) {
        findRoute(world, ship, steers);
        chaserIntent(ship, dt);
      } else if (ship.kind === ShipKind.Shooter) {
        findRoute(world, ship, steers);
        shooterIntent(ship, player, dt);
      }
    }
  }
}
