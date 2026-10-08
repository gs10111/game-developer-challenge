import { describe, expect, test } from 'vitest';
import { Layer } from './collision/layers';
import { createMatch } from './createMatch';
import { SHIP_POOL_CAPACITY } from './limits';
import { release } from './pool';
import { spawnChaser, spawnShooter } from './spawnEnemy';
import { activeShipSlots, shipAt } from './testing/combatHarness';
import { testConfig } from './testing/testConfig';
import { testWeapons } from './testing/testWeapons';
import { createShip, ShipKind } from './world';
import type { Ship, World } from './world';

const SEED = 20261007;

const STANDARD_STAMP = {
  radius: 20,
  speed: 120,
  turnRate: 240,
  health: 30,
  maxHealth: 30,
  contactDamage: 25,
};

const STANDARD_SHOOTER_STAMP = {
  radius: 22,
  speed: 60,
  turnRate: 240,
  health: 40,
  maxHealth: 40,
  attackRange: 300,
};

const STANDARD_CANNON = {
  cooldownSeconds: 1,
  projectileSpeed: 300,
  projectileRadius: 4,
  projectileLifetimeSeconds: 1.5,
  damage: 10,
};

const LEFTOVERS: Partial<Ship> = {
  layer: Layer.Player,
  kind: ShipKind.Player,
  x: 11,
  y: 12,
  previousX: 13,
  previousY: 14,
  heading: 15,
  radius: 16,
  speed: 17,
  turnRate: 18,
  health: 19,
  maxHealth: 21,
  pendingDamage: 22,
  contactDamage: 23,
  attackRange: 28,
  exploded: true,
  thrust: 1,
  turn: -1,
  fireFront: 1,
  fireLeft: 1,
  fireRight: 1,
  frontCooldown: 24,
  leftCooldown: 26,
  rightCooldown: 27,
  weapons: testWeapons(),
};

function buildConfig() {
  return testConfig({ width: 960, height: 540, islands: [] });
}

function chaserPlaced(x: number, y: number, heading: number): Ship {
  return {
    ...createShip(),
    ...STANDARD_STAMP,
    active: true,
    layer: 'enemy',
    kind: 'chaser',
    x,
    y,
    previousX: x,
    previousY: y,
    heading,
  };
}

function shooterAt(world: World, x: number, y: number, heading: number): Ship {
  const shooter = spawnShooter(world, x, y, heading);
  if (shooter === null) {
    throw new Error('The ship pool has no free slot');
  }
  return shooter;
}

function shooterPlaced(world: World, x: number, y: number, heading: number): Ship {
  return {
    ...createShip(),
    ...STANDARD_SHOOTER_STAMP,
    active: true,
    layer: 'enemy',
    kind: 'shooter',
    x,
    y,
    previousX: x,
    previousY: y,
    heading,
    weapons: world.config.enemies.shooter.weapons,
  };
}

function shooterStamp({
  radius,
  speed,
  turnRate,
  health,
  maxHealth,
  attackRange,
  weapons,
}: Ship) {
  return { radius, speed, turnRate, health, maxHealth, attackRange, weapons };
}

describe('enemy spawning (ADR-0006)', () => {
  test('SC-10 a spawned Chaser takes its radius, speed, turn rate, health and contact damage from the config the match was created with', () => {
    const light = buildConfig();
    light.enemies.chaser = {
      radius: 12,
      speed: 75.5,
      turnRateDegrees: 90,
      health: 45.5,
      contactDamage: 40,
    };
    const heavy = buildConfig();
    heavy.enemies.chaser = {
      radius: 31,
      speed: 300,
      turnRateDegrees: 180,
      health: 250,
      contactDamage: 60.5,
    };

    expect(spawnChaser(createMatch(buildConfig(), SEED), 200, 100, 0)).toMatchObject(
      STANDARD_STAMP,
    );
    expect(spawnChaser(createMatch(light, SEED), 200, 100, 0)).toMatchObject({
      radius: 12,
      speed: 75.5,
      turnRate: 128,
      health: 45.5,
      maxHealth: 45.5,
      contactDamage: 40,
    });
    expect(spawnChaser(createMatch(heavy, SEED), 200, 100, 0)).toMatchObject({
      radius: 31,
      speed: 300,
      turnRate: 256,
      health: 250,
      maxHealth: 250,
      contactDamage: 60.5,
    });

    const source = buildConfig();
    const running = createMatch(source, SEED);
    source.enemies.chaser.radius = 9;
    source.enemies.chaser.speed = 50;
    source.enemies.chaser.turnRateDegrees = 45;
    source.enemies.chaser.health = 8;
    source.enemies.chaser.contactDamage = 3;
    const next = createMatch(source, SEED);

    expect(spawnChaser(running, 200, 100, 0)).toMatchObject(STANDARD_STAMP);
    expect(spawnChaser(next, 200, 100, 0)).toMatchObject({
      radius: 9,
      speed: 50,
      turnRate: 64,
      health: 8,
      maxHealth: 8,
      contactDamage: 3,
    });
  });

  test('EN-01 a spawned Chaser is an enemy of the Chaser kind at full health, where and how it was placed, with no weapons', () => {
    const world = createMatch(buildConfig(), SEED);
    const player = { ...world.player };
    Object.assign(shipAt(world, 1), LEFTOVERS);

    const first = spawnChaser(world, 300, 120, 96);
    const second = spawnChaser(world, 812.5, 47.25, 300.5);

    expect(first).toBe(shipAt(world, 1));
    expect(first).toStrictEqual(chaserPlaced(300, 120, 96));
    expect(first).toMatchObject({
      layer: 'enemy',
      kind: 'chaser',
      health: 30,
      maxHealth: 30,
      pendingDamage: 0,
      exploded: false,
      thrust: 0,
      turn: 0,
      fireFront: 0,
      fireLeft: 0,
      fireRight: 0,
      weapons: null,
    });
    expect(second).toBe(shipAt(world, 2));
    expect(second).toStrictEqual(chaserPlaced(812.5, 47.25, 300.5));
    expect(activeShipSlots(world)).toEqual([0, 1, 2]);
    expect(world.player).toStrictEqual(player);
  });

  test('EN-01 spawning fills the ship pool in slot order and returns null when it is full', () => {
    const world = createMatch(buildConfig(), SEED);
    const spawned: (Ship | null)[] = [];
    for (let slot = 1; slot < SHIP_POOL_CAPACITY; slot += 1) {
      spawned.push(spawnChaser(world, 10 * slot, 5 * slot, slot));
    }

    expect(spawned).toHaveLength(SHIP_POOL_CAPACITY - 1);
    for (const [index, chaser] of spawned.entries()) {
      const slot = index + 1;

      expect(chaser).toBe(shipAt(world, slot));
      expect(chaser).toStrictEqual(chaserPlaced(10 * slot, 5 * slot, slot));
    }
    expect(shipAt(world, 0)).toBe(world.player);
    expect(world.player).toMatchObject({ active: true, layer: 'player', kind: 'player' });
    expect(activeShipSlots(world)).toHaveLength(SHIP_POOL_CAPACITY);

    const full = world.ships.slots.map((ship) => ({ ...ship }));

    expect(spawnChaser(world, 1, 2, 3)).toBeNull();
    expect(spawnChaser(world, 4, 5, 6)).toBeNull();
    expect(world.ships.slots).toStrictEqual(full);

    release(world.ships, shipAt(world, 20));
    release(world.ships, shipAt(world, 7));

    expect(activeShipSlots(world)).toHaveLength(SHIP_POOL_CAPACITY - 2);
    expect(spawnChaser(world, 700, 80, 256)).toBe(shipAt(world, 7));
    expect(spawnChaser(world, 710, 90, 128)).toBe(shipAt(world, 20));
    expect(shipAt(world, 7)).toStrictEqual(chaserPlaced(700, 80, 256));
    expect(shipAt(world, 20)).toStrictEqual(chaserPlaced(710, 90, 128));
    expect(spawnChaser(world, 1, 2, 3)).toBeNull();
    expect(activeShipSlots(world)).toHaveLength(SHIP_POOL_CAPACITY);
  });

  test('SC-10 a spawned Shooter takes its radius, speed, turn rate, health, attack range and cannon from the config the match was created with', () => {
    const lightCannon = {
      cooldownSeconds: 0.75,
      projectileSpeed: 210,
      projectileRadius: 3,
      projectileLifetimeSeconds: 0.9,
      damage: 7.5,
    };
    const heavyCannon = {
      cooldownSeconds: 2.5,
      projectileSpeed: 480,
      projectileRadius: 8,
      projectileLifetimeSeconds: 2,
      damage: 35,
    };
    const light = buildConfig();
    light.enemies.shooter = {
      radius: 12,
      speed: 75.5,
      turnRateDegrees: 90,
      health: 45.5,
      attackRange: 180.5,
      weapons: { front: { ...lightCannon } },
    };
    const heavy = buildConfig();
    heavy.enemies.shooter = {
      radius: 31,
      speed: 300,
      turnRateDegrees: 180,
      health: 250,
      attackRange: 640,
      weapons: { front: { ...heavyCannon } },
    };

    expect(shooterStamp(shooterAt(createMatch(buildConfig(), SEED), 200, 100, 0))).toStrictEqual({
      ...STANDARD_SHOOTER_STAMP,
      weapons: { front: STANDARD_CANNON },
    });
    expect(shooterStamp(shooterAt(createMatch(light, SEED), 200, 100, 0))).toStrictEqual({
      radius: 12,
      speed: 75.5,
      turnRate: 128,
      health: 45.5,
      maxHealth: 45.5,
      attackRange: 180.5,
      weapons: { front: lightCannon },
    });
    expect(shooterStamp(shooterAt(createMatch(heavy, SEED), 200, 100, 0))).toStrictEqual({
      radius: 31,
      speed: 300,
      turnRate: 256,
      health: 250,
      maxHealth: 250,
      attackRange: 640,
      weapons: { front: heavyCannon },
    });

    const source = buildConfig();
    const running = createMatch(source, SEED);
    source.enemies.shooter.radius = 9;
    source.enemies.shooter.speed = 50;
    source.enemies.shooter.turnRateDegrees = 45;
    source.enemies.shooter.health = 8;
    source.enemies.shooter.attackRange = 120;
    source.enemies.shooter.weapons.front.cooldownSeconds = 0.4;
    source.enemies.shooter.weapons.front.damage = 3;
    const next = createMatch(source, SEED);
    const kept = shooterAt(running, 200, 100, 0);
    const changed = shooterAt(next, 200, 100, 0);

    expect(shooterStamp(kept)).toStrictEqual({
      ...STANDARD_SHOOTER_STAMP,
      weapons: { front: STANDARD_CANNON },
    });
    expect(kept.weapons).toBe(running.config.enemies.shooter.weapons);
    expect(kept.weapons).not.toBe(source.enemies.shooter.weapons);
    expect(shooterStamp(changed)).toStrictEqual({
      radius: 9,
      speed: 50,
      turnRate: 64,
      health: 8,
      maxHealth: 8,
      attackRange: 120,
      weapons: { front: { ...STANDARD_CANNON, cooldownSeconds: 0.4, damage: 3 } },
    });
    expect(changed.weapons).toBe(next.config.enemies.shooter.weapons);
    expect(changed.weapons).not.toBe(kept.weapons);
  });

  test('EN-04 a spawned Shooter is an enemy of the Shooter kind at full health, where and how it was placed, with a ready front cannon and no broadside', () => {
    const world = createMatch(buildConfig(), SEED);
    const player = { ...world.player };
    Object.assign(shipAt(world, 1), LEFTOVERS);

    const first = shooterAt(world, 300, 120, 96);
    const second = shooterAt(world, 812.5, 47.25, 300.5);
    const chaser = spawnChaser(world, 640, 200, 32);

    expect(first).toBe(shipAt(world, 1));
    expect(first).toStrictEqual(shooterPlaced(world, 300, 120, 96));
    expect(first).toMatchObject({
      layer: 'enemy',
      kind: 'shooter',
      health: 40,
      maxHealth: 40,
      pendingDamage: 0,
      contactDamage: 0,
      exploded: false,
      thrust: 0,
      turn: 0,
      fireFront: 0,
      fireLeft: 0,
      fireRight: 0,
      frontCooldown: 0,
      leftCooldown: 0,
      rightCooldown: 0,
    });
    expect(first.weapons).toBe(world.config.enemies.shooter.weapons);
    expect(first.weapons).toStrictEqual({ front: STANDARD_CANNON });
    expect(second).toBe(shipAt(world, 2));
    expect(second).toStrictEqual(shooterPlaced(world, 812.5, 47.25, 300.5));
    expect(second.weapons).toBe(first.weapons);
    expect(chaser).toBe(shipAt(world, 3));
    expect(chaser).toStrictEqual(chaserPlaced(640, 200, 32));
    expect(activeShipSlots(world)).toEqual([0, 1, 2, 3]);
    expect(world.player).toStrictEqual(player);
  });

  test('EN-04 spawning a Shooter returns null when the ship pool is full', () => {
    const world = createMatch(buildConfig(), SEED);
    const spawned: (Ship | null)[] = [];
    for (let slot = 1; slot < SHIP_POOL_CAPACITY; slot += 1) {
      spawned.push(spawnShooter(world, 10 * slot, 5 * slot, slot));
    }

    expect(spawned).toHaveLength(SHIP_POOL_CAPACITY - 1);
    for (const [index, shooter] of spawned.entries()) {
      const slot = index + 1;

      expect(shooter).toBe(shipAt(world, slot));
      expect(shooter).toStrictEqual(shooterPlaced(world, 10 * slot, 5 * slot, slot));
    }
    expect(shipAt(world, 0)).toBe(world.player);
    expect(activeShipSlots(world)).toHaveLength(SHIP_POOL_CAPACITY);

    const full = world.ships.slots.map((ship) => ({ ...ship }));

    expect(spawnShooter(world, 1, 2, 3)).toBeNull();
    expect(spawnShooter(world, 4, 5, 6)).toBeNull();
    expect(world.ships.slots).toStrictEqual(full);

    release(world.ships, shipAt(world, 20));

    expect(activeShipSlots(world)).toHaveLength(SHIP_POOL_CAPACITY - 1);
    expect(spawnShooter(world, 700, 80, 256)).toBe(shipAt(world, 20));
    expect(shipAt(world, 20)).toStrictEqual(shooterPlaced(world, 700, 80, 256));
    expect(spawnShooter(world, 1, 2, 3)).toBeNull();
    expect(activeShipSlots(world)).toHaveLength(SHIP_POOL_CAPACITY);
  });
});
