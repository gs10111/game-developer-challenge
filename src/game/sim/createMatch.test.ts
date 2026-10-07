import { describe, expect, test } from 'vitest';
import type { GameConfig } from '../config/gameConfig';
import { createMatch } from './createMatch';
import { SHIP_POOL_CAPACITY } from './limits';
import { acquire } from './pool';
import { createRandomSource, nextRandom } from './random';
import type { RandomSource } from './random';
import { createShip } from './world';

function buildConfig() {
  return {
    arena: { width: 960, height: 540 },
    player: { radius: 24, speed: 140, turnRateDegrees: 150 },
  } satisfies GameConfig;
}

function draw(source: RandomSource, count: number): number[] {
  return Array.from({ length: count }, () => nextRandom(source));
}

function reachableObjects(root: unknown, found = new Set<object>()): Set<object> {
  if (typeof root !== 'object' || root === null || found.has(root)) {
    return found;
  }
  found.add(root);
  for (const nested of Object.values(root)) {
    reachableObjects(nested, found);
  }
  return found;
}

describe('match creation (ADR-0006)', () => {
  test('SC-10 the player ship takes its radius, speed and turn rate from the config the match was created with', () => {
    const standard = buildConfig();
    const small = buildConfig();
    small.player.radius = 10;
    small.player.speed = 75.5;
    small.player.turnRateDegrees = 90;
    const nimble = buildConfig();
    nimble.player.radius = 31;
    nimble.player.speed = 300;
    nimble.player.turnRateDegrees = 180;

    expect(createMatch(standard, 1).player).toMatchObject({
      radius: 24,
      speed: 140,
      turnRate: 640 / 3,
    });
    expect(createMatch(small, 1).player).toMatchObject({ radius: 10, speed: 75.5, turnRate: 128 });
    expect(createMatch(nimble, 1).player).toMatchObject({ radius: 31, speed: 300, turnRate: 256 });
  });

  test('SC-12 a running match keeps its config when the source changes afterwards, nested fields included, and the next match uses the new values', () => {
    const source = buildConfig();
    const running = createMatch(source, 1);

    source.arena.width = 1920;
    source.arena.height = 1080;
    source.player.radius = 12;
    source.player.speed = 300;
    source.player.turnRateDegrees = 90;

    const snapshotParts = [...reachableObjects(running.config)];
    const sourceParts = reachableObjects(source);

    expect(running.config).toStrictEqual(buildConfig());
    expect(running.player).toMatchObject({ radius: 24, speed: 140, turnRate: 640 / 3 });
    expect(snapshotParts).toContain(running.config.arena);
    expect(snapshotParts).toContain(running.config.player);
    expect(snapshotParts.filter((part) => sourceParts.has(part))).toEqual([]);
    expect(snapshotParts.filter((part) => !Object.isFrozen(part))).toEqual([]);

    const next = createMatch(source, 1);

    expect(next.config).toStrictEqual(source);
    expect(next.player).toMatchObject({ radius: 12, speed: 300, turnRate: 128 });
    expect(running.config).toStrictEqual(buildConfig());
    expect(running.player).toMatchObject({ radius: 24, speed: 140, turnRate: 640 / 3 });
  });

  test('MT-05 creating a match again yields a fresh world: step zero, player at the arena centre with heading zero, nothing shared with the previous match', () => {
    const config = buildConfig();
    const previous = createMatch(config, 7);

    previous.step = 4321;
    previous.commands = 5;
    previous.player.x = 37;
    previous.player.y = 512;
    previous.player.heading = 300.5;
    previous.player.thrust = 1;
    previous.player.turn = -1;
    draw(previous.rng, 9);
    acquire(previous.ships);
    acquire(previous.ships);
    const previousState = JSON.stringify(previous);

    const next = createMatch(config, 7);
    const previousParts = reachableObjects(previous);
    const nextParts = [...reachableObjects(next)];

    expect(next.step).toBe(0);
    expect(next.commands).toBe(0);
    expect(next.rng).toStrictEqual(createRandomSource(7));
    expect(next.player).toBe(next.ships.slots[0]);
    expect(next.player).toMatchObject({
      active: true,
      x: 480,
      y: 270,
      heading: 0,
      thrust: 0,
      turn: 0,
    });
    expect(next.ships.slots).toHaveLength(SHIP_POOL_CAPACITY);
    expect(next.ships.slots.filter((ship) => ship.active)).toEqual([next.player]);
    for (const ship of next.ships.slots.slice(1)) {
      expect(ship).toStrictEqual(createShip());
    }

    expect(nextParts).toContain(next.config.arena);
    expect(nextParts).toContain(next.config.player);
    expect(nextParts).toContain(next.rng);
    expect(nextParts).toContain(next.ships.slots);
    expect(nextParts).toContain(next.player);
    expect(nextParts.length).toBeGreaterThan(SHIP_POOL_CAPACITY);
    expect(nextParts.filter((part) => previousParts.has(part))).toEqual([]);
    expect(JSON.stringify(previous)).toBe(previousState);

    const wide = buildConfig();
    wide.arena.width = 1200;
    wide.arena.height = 400;

    expect(createMatch(wide, 7).player).toMatchObject({ x: 600, y: 200, heading: 0 });
  });

  test('PW-03 a match keeps the seed it was created with', () => {
    const seeds = [0, 1, 20261007, 0xffffffff, -1, 2 ** 32 + 7];

    for (const seed of seeds) {
      const match = createMatch(buildConfig(), seed);

      expect(match.seed).toBe(seed);
      expect(match.rng).toStrictEqual(createRandomSource(seed));
    }

    const match = createMatch(buildConfig(), 20261007);
    const sameSeed = createMatch(buildConfig(), 20261007);
    const otherSeed = createMatch(buildConfig(), 20261008);
    const drawn = draw(match.rng, 16);

    expect(draw(sameSeed.rng, 16)).toEqual(drawn);
    expect(draw(otherSeed.rng, 16)).not.toEqual(drawn);
    expect(match.seed).toBe(20261007);
    expect(match.rng).not.toEqual(createRandomSource(20261007));
  });
});
