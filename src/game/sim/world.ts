import type { Armament, GameConfig } from '../config/gameConfig';
import type { IslandIndex } from './collision/islandIndex';
import type { Layer } from './collision/layers';
import type { EventQueue } from './events';
import type { Pool } from './pool';
import type { RandomSource } from './random';

export const ShipKind = {
  Player: 'player',
  Chaser: 'chaser',
  Shooter: 'shooter',
} as const;

export type ShipKind = (typeof ShipKind)[keyof typeof ShipKind];

export interface Ship {
  active: boolean;
  layer: Layer | null;
  kind: ShipKind | null;
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  heading: number;
  radius: number;
  speed: number;
  turnRate: number;
  health: number;
  maxHealth: number;
  pendingDamage: number;
  contactDamage: number;
  attackRange: number;
  exploded: boolean;
  thrust: 0 | 1;
  turn: -1 | 0 | 1;
  fireFront: 0 | 1;
  fireLeft: 0 | 1;
  fireRight: 0 | 1;
  frontCooldown: number;
  leftCooldown: number;
  rightCooldown: number;
  weapons: Armament | null;
}

export interface Projectile {
  active: boolean;
  layer: Layer | null;
  consumed: boolean;
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  directionX: number;
  directionY: number;
  speed: number;
  radius: number;
  damage: number;
  remainingSteps: number;
}

export interface World {
  step: number;
  readonly seed: number;
  readonly rng: RandomSource;
  commands: number;
  readonly config: GameConfig;
  readonly islands: IslandIndex;
  readonly ships: Pool<Ship>;
  readonly player: Ship;
  readonly projectiles: Pool<Projectile>;
  readonly events: EventQueue;
  score: number;
}

const FRESH_SHIP: Readonly<Ship> = Object.freeze({
  active: false,
  layer: null,
  kind: null,
  x: 0,
  y: 0,
  previousX: 0,
  previousY: 0,
  heading: 0,
  radius: 0,
  speed: 0,
  turnRate: 0,
  health: 0,
  maxHealth: 0,
  pendingDamage: 0,
  contactDamage: 0,
  attackRange: 0,
  exploded: false,
  thrust: 0,
  turn: 0,
  fireFront: 0,
  fireLeft: 0,
  fireRight: 0,
  frontCooldown: 0,
  leftCooldown: 0,
  rightCooldown: 0,
  weapons: null,
});

export function resetShip(ship: Ship): void {
  Object.assign(ship, FRESH_SHIP);
}

export function createShip(): Ship {
  return { ...FRESH_SHIP };
}

const FRESH_PROJECTILE: Readonly<Projectile> = Object.freeze({
  active: false,
  layer: null,
  consumed: false,
  x: 0,
  y: 0,
  previousX: 0,
  previousY: 0,
  directionX: 0,
  directionY: 0,
  speed: 0,
  radius: 0,
  damage: 0,
  remainingSteps: 0,
});

export function resetProjectile(projectile: Projectile): void {
  Object.assign(projectile, FRESH_PROJECTILE);
}

export function createProjectile(): Projectile {
  return { ...FRESH_PROJECTILE };
}
