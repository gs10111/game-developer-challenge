import type { ConvexPolygon, Point } from '../../config/gameConfig';
import { Layer } from '../collision/layers';
import type { GameEvent, WeaponName } from '../events';
import { acquire } from '../pool';
import { step } from '../step';
import type { Projectile, Ship, World } from '../world';
import { testConfig } from './testConfig';

export const SEED = 20261007;

const STEPS_OF_THE_LONGEST_MATCH = 10800;

export interface HealthChange {
  step: number;
  health: number;
}

export function rectangle(left: number, top: number, right: number, bottom: number): Point[] {
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

export function buildConfig(islands: ConvexPolygon[] = []) {
  return testConfig({ width: 2000, height: 2000, islands });
}

export function placeShip(world: World, fields: Partial<Ship>): Ship {
  const ship = acquire(world.ships);
  if (ship === null) {
    throw new Error('The ship pool has no free slot');
  }
  Object.assign(ship, fields);
  ship.previousX = ship.x;
  ship.previousY = ship.y;
  if (fields.maxHealth === undefined) {
    ship.maxHealth = ship.health;
  }
  return ship;
}

export function placeEnemy(world: World, fields: Partial<Ship>): Ship {
  return placeShip(world, { layer: Layer.Enemy, radius: 20, health: 30, ...fields });
}

export function placeProjectile(world: World, fields: Partial<Projectile>): Projectile {
  const projectile = acquire(world.projectiles);
  if (projectile === null) {
    throw new Error('The projectile pool has no free slot');
  }
  Object.assign(
    projectile,
    { radius: 4, damage: 20, remainingSteps: STEPS_OF_THE_LONGEST_MATCH },
    fields,
  );
  projectile.previousX = projectile.x;
  projectile.previousY = projectile.y;
  return projectile;
}

export function hold(world: World, commands: number, steps: number): void {
  for (let count = 0; count < steps; count += 1) {
    step(world, commands);
  }
}

export function shipAt(world: World, position: number): Ship {
  const slot = world.ships.slots[position];
  if (slot === undefined) {
    throw new Error('The ship pool has no such slot');
  }
  return slot;
}

export function projectileAt(world: World, position: number): Projectile {
  const slot = world.projectiles.slots[position];
  if (slot === undefined) {
    throw new Error('The projectile pool has no such slot');
  }
  return slot;
}

export function activeShipSlots(world: World): number[] {
  return world.ships.slots.flatMap((slot, position) => (slot.active ? [position] : []));
}

export function activeProjectileSlots(world: World): number[] {
  return world.projectiles.slots.flatMap((slot, position) => (slot.active ? [position] : []));
}

export function flight({ active, consumed, x, y }: Projectile) {
  return { active, consumed, x, y };
}

export function flyingAt(x: number, y: number) {
  return { active: true, consumed: false, x, y };
}

export function eventsOf(world: World): GameEvent[] {
  return world.events.items.slice(0, world.events.count).map((event) => ({ ...event }));
}

export function eventfulSteps(world: World, commands: number, steps: number): number[] {
  const eventful: number[] = [];
  for (let count = 0; count < steps; count += 1) {
    step(world, commands);
    if (world.events.count > 0) {
      eventful.push(world.step);
    }
  }
  return eventful;
}

export function healthChanges(
  world: World,
  ship: Ship,
  commands: number,
  steps: number,
): HealthChange[] {
  const changes: HealthChange[] = [];
  for (let count = 0; count < steps; count += 1) {
    const before = ship.health;
    step(world, commands);
    if (ship.health !== before) {
      changes.push({ step: world.step, health: ship.health });
    }
  }
  return changes;
}

export function shotFiredAt(
  layer: Layer | null,
  weapon: WeaponName,
  x: number,
  y: number,
  directionX: number,
  directionY: number,
): GameEvent {
  return { kind: 'shotFired', layer, weapon, x, y, directionX, directionY };
}

export function hitAt(
  layer: Layer | null,
  x: number,
  y: number,
  directionX: number,
  directionY: number,
): GameEvent {
  return { kind: 'hit', layer, weapon: null, x, y, directionX, directionY };
}

export function destroyedAt(layer: Layer | null, x: number, y: number): GameEvent {
  return { kind: 'destroyed', layer, weapon: null, x, y, directionX: 0, directionY: 0 };
}
