import type { GameConfig } from '../config/gameConfig';
import { createIslandIndex } from './collision/islandIndex';
import { SHIP_POOL_CAPACITY } from './limits';
import { HEADING_UNITS_PER_TURN } from './math/rotation';
import { acquire, createPool } from './pool';
import type { Pool } from './pool';
import { createRandomSource } from './random';
import { createShip, resetShip } from './world';
import type { Ship, World } from './world';

const DEGREES_PER_TURN = 360;

function headingUnitsFromDegrees(degrees: number): number {
  return (degrees * HEADING_UNITS_PER_TURN) / DEGREES_PER_TURN;
}

function frozenCopy<Value>(value: Value): Value {
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    const items: readonly unknown[] = value;
    return Object.freeze(items.map((item) => frozenCopy(item))) as Value;
  }
  const copy: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    copy[key] = frozenCopy(nested);
  }
  return Object.freeze(copy) as Value;
}

function acquirePlayer(ships: Pool<Ship>, config: GameConfig): Ship {
  const player = acquire(ships);
  if (player === null) {
    throw new Error('The ship pool has no free slot for the player');
  }
  player.x = config.arena.width / 2;
  player.y = config.arena.height / 2;
  player.previousX = player.x;
  player.previousY = player.y;
  player.radius = config.player.radius;
  player.speed = config.player.speed;
  player.turnRate = headingUnitsFromDegrees(config.player.turnRateDegrees);
  return player;
}

export function createMatch(config: GameConfig, seed: number): World {
  const snapshot = frozenCopy(config);
  const ships = createPool(SHIP_POOL_CAPACITY, createShip, resetShip);
  return {
    step: 0,
    seed,
    rng: createRandomSource(seed),
    commands: 0,
    config: snapshot,
    islands: createIslandIndex(snapshot.arena),
    ships,
    player: acquirePlayer(ships, snapshot),
  };
}
