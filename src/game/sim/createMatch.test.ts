import { describe, expect, test } from 'vitest';
import type { GameConfig } from '../config/gameConfig';
import { createIslandIndex } from './collision/islandIndex';
import { createMatch } from './createMatch';
import { createEventQueue, EventKind, pushEvent, WeaponName } from './events';
import { EVENT_QUEUE_CAPACITY, PROJECTILE_POOL_CAPACITY, SHIP_POOL_CAPACITY } from './limits';
import { acquire } from './pool';
import { createRandomSource, nextRandom } from './random';
import type { RandomSource } from './random';
import { testWeapons } from './testing/testWeapons';
import { createProjectile, createShip } from './world';

function buildConfig() {
  return {
    arena: { width: 960, height: 540, islands: [] },
    player: { radius: 24, speed: 140, turnRateDegrees: 150, weapons: testWeapons() },
  } satisfies GameConfig;
}

function buildArchipelago() {
  return {
    arena: {
      width: 960,
      height: 540,
      islands: [
        [
          { x: 100, y: 100 },
          { x: 300, y: 100 },
          { x: 300, y: 200 },
          { x: 100, y: 200 },
        ],
        [
          { x: 600, y: 300 },
          { x: 760, y: 380 },
          { x: 640, y: 460 },
        ],
      ],
    },
    player: { radius: 24, speed: 140, turnRateDegrees: 150, weapons: testWeapons() },
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

  test("SC-10 the player's weapons are the ones of the config the match was created with", () => {
    const source = buildConfig();
    source.player.weapons.front.projectileSpeed = 512;
    source.player.weapons.broadside.spacing = 9.5;
    const configured = {
      front: {
        cooldownSeconds: 0.5,
        projectileSpeed: 512,
        projectileRadius: 4,
        projectileLifetimeSeconds: 2,
        damage: 20,
      },
      broadside: {
        cooldownSeconds: 1,
        projectileSpeed: 240,
        projectileRadius: 3,
        projectileLifetimeSeconds: 1.5,
        damage: 12,
        spacing: 9.5,
      },
    };

    const world = createMatch(source, 1);
    const weaponParts = [...reachableObjects(world.player.weapons)];
    const sourceParts = reachableObjects(source);

    expect(world.player.weapons).toBe(world.config.player.weapons);
    expect(world.player.weapons).not.toBe(source.player.weapons);
    expect(world.player.weapons).toStrictEqual(configured);
    expect(weaponParts).toHaveLength(3);
    expect(weaponParts.filter((part) => sourceParts.has(part))).toEqual([]);
    expect(weaponParts.filter((part) => !Object.isFrozen(part))).toEqual([]);

    source.player.weapons.front.damage = 99;
    source.player.weapons.broadside.cooldownSeconds = 7;
    const next = createMatch(source, 1);

    expect(world.player.weapons).toStrictEqual(configured);
    expect(next.player.weapons).toBe(next.config.player.weapons);
    expect(next.player.weapons).toStrictEqual({
      front: { ...configured.front, damage: 99 },
      broadside: { ...configured.broadside, cooldownSeconds: 7 },
    });
    expect(createMatch(buildConfig(), 1).player.weapons).toStrictEqual({
      front: { ...configured.front, projectileSpeed: 300 },
      broadside: { ...configured.broadside, spacing: 16 },
    });
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

  test('SC-12 the islands of a running match are frozen arrays that keep their vertices when the source changes afterwards', () => {
    const source = buildArchipelago();
    const running = createMatch(source, 1);

    for (const part of source.arena.islands) {
      for (const vertex of part) {
        vertex.x += 50;
        vertex.y -= 25;
      }
      part.push({ x: 0, y: 0 });
    }
    source.arena.islands.push([
      { x: 800, y: 40 },
      { x: 900, y: 40 },
      { x: 850, y: 120 },
    ]);

    const { islands } = running.config.arena;
    const snapshotParts = [...reachableObjects(running.config)];
    const sourceParts = reachableObjects(source);

    expect(Array.isArray(islands)).toBe(true);
    expect(islands.map((part) => Array.isArray(part))).toEqual([true, true]);
    expect(islands).toStrictEqual(buildArchipelago().arena.islands);
    expect(snapshotParts).toContain(islands);
    for (const part of islands) {
      expect(snapshotParts).toContain(part);
      for (const vertex of part) {
        expect(snapshotParts).toContain(vertex);
      }
    }
    expect(snapshotParts).toHaveLength(16);
    expect(snapshotParts.filter((part) => sourceParts.has(part))).toEqual([]);
    expect(snapshotParts.filter((part) => !Object.isFrozen(part))).toEqual([]);

    const next = createMatch(source, 1);

    expect(next.config.arena.islands).toHaveLength(3);
    expect(next.config.arena.islands).toStrictEqual(source.arena.islands);
    expect(running.config.arena.islands).toStrictEqual(buildArchipelago().arena.islands);
  });

  test('SC-10 a match carries the island parts of the config it was created with', () => {
    const openSea = buildConfig();
    const archipelago = buildArchipelago();
    const lagoon = buildArchipelago();
    lagoon.arena.islands = [
      [
        { x: 400, y: 200 },
        { x: 560, y: 200 },
        { x: 560, y: 340 },
        { x: 400, y: 340 },
      ],
    ];

    expect(createMatch(openSea, 1).config.arena.islands).toStrictEqual([]);
    expect(createMatch(archipelago, 1).config.arena.islands).toStrictEqual([
      [
        { x: 100, y: 100 },
        { x: 300, y: 100 },
        { x: 300, y: 200 },
        { x: 100, y: 200 },
      ],
      [
        { x: 600, y: 300 },
        { x: 760, y: 380 },
        { x: 640, y: 460 },
      ],
    ]);
    expect(createMatch(lagoon, 1).config.arena.islands).toStrictEqual([
      [
        { x: 400, y: 200 },
        { x: 560, y: 200 },
        { x: 560, y: 340 },
        { x: 400, y: 340 },
      ],
    ]);
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

  test('MT-05 the player of a fresh match has its weapons ready and no fire intent', () => {
    const config = buildConfig();
    const previous = createMatch(config, 7);
    const spent = {
      fireFront: 1,
      fireLeft: 1,
      fireRight: 1,
      frontCooldown: 17,
      leftCooldown: 42,
      rightCooldown: 59,
    } as const;
    const ready = {
      fireFront: 0,
      fireLeft: 0,
      fireRight: 0,
      frontCooldown: 0,
      leftCooldown: 0,
      rightCooldown: 0,
    };
    Object.assign(previous.player, spent);

    const next = createMatch(config, 7);

    expect(next.player).toMatchObject(ready);
    expect(next.player.weapons).toBe(next.config.player.weapons);
    expect(next.player.weapons).not.toBe(previous.player.weapons);
    for (const ship of next.ships.slots.slice(1)) {
      expect(ship).toMatchObject({ ...ready, weapons: null });
    }
    expect(previous.player).toMatchObject(spent);
  });

  test('MT-05 a fresh match has no active projectile and no event', () => {
    const config = buildConfig();
    const previous = createMatch(config, 7);
    acquire(previous.projectiles);
    acquire(previous.projectiles);
    pushEvent(previous.events, EventKind.ShotFired, WeaponName.Left, 300, 120, 0, -1);
    pushEvent(previous.events, EventKind.ShotFired, WeaponName.Right, 310, 130, 0, 1);

    const next = createMatch(config, 7);
    const previousParts = reachableObjects(previous);
    const nextParts = [...reachableObjects(next)];

    expect(previous.projectiles.slots.filter(({ active }) => active)).toHaveLength(2);
    expect(previous.events.count).toBe(2);

    expect(PROJECTILE_POOL_CAPACITY).toBe(256);
    expect(next.projectiles.slots).toHaveLength(PROJECTILE_POOL_CAPACITY);
    expect(new Set(next.projectiles.slots).size).toBe(PROJECTILE_POOL_CAPACITY);
    expect(next.projectiles.slots.filter(({ active }) => active)).toEqual([]);
    for (const projectile of next.projectiles.slots) {
      expect(projectile).toStrictEqual(createProjectile());
    }
    expect(next.events.count).toBe(0);
    expect(next.events.items).toHaveLength(EVENT_QUEUE_CAPACITY);
    expect(new Set(next.events.items).size).toBe(EVENT_QUEUE_CAPACITY);
    expect(next.events).toStrictEqual(createEventQueue(EVENT_QUEUE_CAPACITY));
    expect(nextParts).toContain(next.projectiles.slots);
    expect(nextParts).toContain(next.events.items);
    expect(nextParts.filter((part) => previousParts.has(part))).toEqual([]);
  });

  test("MT-05 each match builds its own island index, and the player's previous position starts at its position", () => {
    const source = buildArchipelago();
    const previous = createMatch(source, 7);
    const next = createMatch(source, 7);
    const previousParts = reachableObjects(previous.islands);
    const nextParts = [...reachableObjects(next.islands)];

    expect(next.islands).toStrictEqual(createIslandIndex(buildArchipelago().arena));
    expect(next.islands.parts).toHaveLength(2);
    expect(next.islands.parts.map(({ vertices }) => vertices)).toStrictEqual(
      buildArchipelago().arena.islands,
    );
    expect(previous.islands).toStrictEqual(next.islands);
    expect(nextParts).toContain(next.islands.parts);
    expect(nextParts).toContain(next.islands.cells);
    expect(nextParts.filter((part) => previousParts.has(part))).toEqual([]);

    source.arena.islands.pop();
    for (const vertex of source.arena.islands.flat()) {
      vertex.x += 40;
    }
    const moved = createMatch(source, 7);

    expect(moved.islands).toStrictEqual(createIslandIndex(source.arena));
    expect(moved.islands.parts).toHaveLength(1);
    expect(moved.islands).not.toEqual(next.islands);
    expect(next.islands).toStrictEqual(createIslandIndex(buildArchipelago().arena));
    expect(createMatch(buildConfig(), 7).islands.parts).toEqual([]);

    const wide = buildArchipelago();
    wide.arena.width = 1200;
    wide.arena.height = 400;

    expect(next.player).toMatchObject({ x: 480, y: 270, previousX: 480, previousY: 270 });
    expect(moved.player).toMatchObject({ x: 480, y: 270, previousX: 480, previousY: 270 });
    expect(createMatch(wide, 7).player).toMatchObject({
      x: 600,
      y: 200,
      previousX: 600,
      previousY: 200,
    });
    for (const ship of next.ships.slots.slice(1)) {
      expect(ship).toMatchObject({ active: false, previousX: 0, previousY: 0 });
    }
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
