import type { GameConfig } from '../config/gameConfig';
import type { Pool } from './pool';
import type { RandomSource } from './random';

export interface Ship {
  active: boolean;
  x: number;
  y: number;
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
  readonly ships: Pool<Ship>;
  readonly player: Ship;
}

export function createShip(): Ship {
  return {
    active: false,
    x: 0,
    y: 0,
    heading: 0,
    radius: 0,
    speed: 0,
    turnRate: 0,
    thrust: 0,
    turn: 0,
  };
}

export function resetShip(ship: Ship): void {
  ship.active = false;
  ship.x = 0;
  ship.y = 0;
  ship.heading = 0;
  ship.radius = 0;
  ship.speed = 0;
  ship.turnRate = 0;
  ship.thrust = 0;
  ship.turn = 0;
}
