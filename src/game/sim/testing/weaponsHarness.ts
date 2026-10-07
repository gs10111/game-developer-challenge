import type { ConvexPolygon, GameConfig } from '../../config/gameConfig';
import { Command } from '../commands';
import type { GameEvent } from '../events';
import { step } from '../step';
import type { Projectile, Ship, World } from '../world';
import { testPlayer } from './testPlayer';

export const SEED = 20261007;
export const EVERY_WEAPON = Command.FireFront | Command.FireLeft | Command.FireRight;

export function buildConfig(islands: ConvexPolygon[] = []) {
  return {
    arena: { width: 2000, height: 2000, islands },
    player: testPlayer(),
  } satisfies GameConfig;
}

export function hold(world: World, commands: number, steps: number): void {
  for (let count = 0; count < steps; count += 1) {
    step(world, commands);
  }
}

export function slotAt(world: World, position: number): Projectile {
  const slot = world.projectiles.slots[position];
  if (slot === undefined) {
    throw new Error('The projectile pool has no such slot');
  }
  return slot;
}

export function flying(world: World): Projectile[] {
  return world.projectiles.slots.filter(({ active }) => active);
}

export function eventsOf(world: World): GameEvent[] {
  return world.events.items.slice(0, world.events.count);
}

export function course({ x, y, directionX, directionY }: Projectile | GameEvent) {
  return { x, y, directionX, directionY };
}

export function cooldowns({ frontCooldown, leftCooldown, rightCooldown }: Ship) {
  return { frontCooldown, leftCooldown, rightCooldown };
}

export function stamp({ speed, radius, damage, remainingSteps }: Projectile) {
  return { speed, radius, damage, remainingSteps };
}
