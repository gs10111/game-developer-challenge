import type { GameConfig } from '../config/gameConfig';
import type { IslandIndex } from './collision/islandIndex';
import type { Pool } from './pool';
import type { RandomSource } from './random';

export interface Ship {
  active: boolean;
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  heading: number;
  radius: number;
  speed: number;
  turnRate: number;
  thrust: 0 | 1;
  turn: -1 | 0 | 1;
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
}

const FRESH_SHIP: Readonly<Ship> = Object.freeze({
  active: false,
  x: 0,
  y: 0,
  previousX: 0,
  previousY: 0,
  heading: 0,
  radius: 0,
  speed: 0,
  turnRate: 0,
  thrust: 0,
  turn: 0,
});

export function resetShip(ship: Ship): void {
  Object.assign(ship, FRESH_SHIP);
}

export function createShip(): Ship {
  return { ...FRESH_SHIP };
}
