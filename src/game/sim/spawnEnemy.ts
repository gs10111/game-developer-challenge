import { Layer } from './collision/layers';
import { headingUnitsFromDegrees } from './math/rotation';
import { acquire } from './pool';
import { ShipKind } from './world';
import type { Ship, World } from './world';

export function spawnChaser(world: World, x: number, y: number, heading: number): Ship | null {
  const ship = acquire(world.ships);
  if (ship === null) {
    return null;
  }
  const { chaser } = world.config.enemies;
  ship.layer = Layer.Enemy;
  ship.kind = ShipKind.Chaser;
  ship.x = x;
  ship.y = y;
  ship.previousX = x;
  ship.previousY = y;
  ship.heading = heading;
  ship.radius = chaser.radius;
  ship.speed = chaser.speed;
  ship.turnRate = headingUnitsFromDegrees(chaser.turnRateDegrees);
  ship.health = chaser.health;
  ship.maxHealth = chaser.health;
  ship.contactDamage = chaser.contactDamage;
  return ship;
}
