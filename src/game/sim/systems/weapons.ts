import type { Armament, Weapon, Weapons } from '../../config/gameConfig';
import { shotLayerOf } from '../collision/layers';
import type { Layer } from '../collision/layers';
import { EventKind, pushEvent, WeaponName } from '../events';
import { cosine, sine } from '../math/rotation';
import { acquire } from '../pool';
import { STEPS_PER_SECOND } from '../stepRate';
import type { Ship, World } from '../world';

const BROADSIDE_PROJECTILES = 3;
const BROADSIDE_MIDDLE = (BROADSIDE_PROJECTILES - 1) / 2;

function stepsFromSeconds(seconds: number): number {
  return Math.max(1, Math.round(seconds * STEPS_PER_SECOND));
}

function cooled(cooldown: number): number {
  return cooldown > 0 ? cooldown - 1 : cooldown;
}

function launch(
  world: World,
  weapon: Weapon,
  layer: Layer | null,
  x: number,
  y: number,
  directionX: number,
  directionY: number,
): boolean {
  const projectile = acquire(world.projectiles);
  if (projectile === null) {
    return false;
  }
  projectile.layer = layer;
  projectile.x = x;
  projectile.y = y;
  projectile.previousX = x;
  projectile.previousY = y;
  projectile.directionX = directionX;
  projectile.directionY = directionY;
  projectile.speed = weapon.projectileSpeed;
  projectile.radius = weapon.projectileRadius;
  projectile.damage = weapon.damage;
  projectile.remainingSteps = stepsFromSeconds(weapon.projectileLifetimeSeconds);
  return true;
}

function fireFront(world: World, ship: Ship, weapon: Weapon, aheadX: number, aheadY: number): void {
  const muzzle = ship.radius + weapon.projectileRadius;
  const x = ship.x + aheadX * muzzle;
  const y = ship.y + aheadY * muzzle;
  if (launch(world, weapon, shotLayerOf(ship.layer), x, y, aheadX, aheadY)) {
    pushEvent(
      world.events,
      EventKind.ShotFired,
      ship.layer,
      WeaponName.Front,
      x,
      y,
      aheadX,
      aheadY,
    );
  }
}

function fireBroadside(
  world: World,
  ship: Ship,
  weapon: Weapons['broadside'],
  name: WeaponName,
  aheadX: number,
  aheadY: number,
  sideX: number,
  sideY: number,
): void {
  const muzzle = ship.radius + weapon.projectileRadius;
  const x = ship.x + sideX * muzzle;
  const y = ship.y + sideY * muzzle;
  const layer = shotLayerOf(ship.layer);
  let launched = false;
  for (let index = 0; index < BROADSIDE_PROJECTILES; index += 1) {
    const along = (index - BROADSIDE_MIDDLE) * weapon.spacing;
    if (launch(world, weapon, layer, x + aheadX * along, y + aheadY * along, sideX, sideY)) {
      launched = true;
    }
  }
  if (launched) {
    pushEvent(world.events, EventKind.ShotFired, ship.layer, name, x, y, sideX, sideY);
  }
}

function shipWeapons(world: World, ship: Ship, fitted: Armament): void {
  const aheadX = cosine(ship.heading);
  const aheadY = sine(ship.heading);
  const broadside = fitted.broadside;
  ship.frontCooldown = cooled(ship.frontCooldown);
  if (ship.frontCooldown === 0 && ship.fireFront === 1) {
    ship.frontCooldown = stepsFromSeconds(fitted.front.cooldownSeconds);
    fireFront(world, ship, fitted.front, aheadX, aheadY);
  }
  ship.leftCooldown = cooled(ship.leftCooldown);
  if (broadside !== undefined && ship.leftCooldown === 0 && ship.fireLeft === 1) {
    ship.leftCooldown = stepsFromSeconds(broadside.cooldownSeconds);
    fireBroadside(world, ship, broadside, WeaponName.Left, aheadX, aheadY, aheadY, 0 - aheadX);
  }
  ship.rightCooldown = cooled(ship.rightCooldown);
  if (broadside !== undefined && ship.rightCooldown === 0 && ship.fireRight === 1) {
    ship.rightCooldown = stepsFromSeconds(broadside.cooldownSeconds);
    fireBroadside(world, ship, broadside, WeaponName.Right, aheadX, aheadY, 0 - aheadY, aheadX);
  }
}

export function weapons(world: World): void {
  const slots = world.ships.slots;
  const capacity = slots.length;
  for (let index = 0; index < capacity; index += 1) {
    const ship = slots[index];
    if (ship?.active) {
      const fitted = ship.weapons;
      if (fitted !== null) {
        shipWeapons(world, ship, fitted);
      }
    }
  }
}
