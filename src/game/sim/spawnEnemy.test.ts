import { describe, expect, test } from 'vitest';
import { Layer } from './collision/layers';
import { createMatch } from './createMatch';
import { SHIP_POOL_CAPACITY } from './limits';
import { release } from './pool';
import { spawnChaser } from './spawnEnemy';
import { activeShipSlots, shipAt } from './testing/combatHarness';
import { testConfig } from './testing/testConfig';
import { testWeapons } from './testing/testWeapons';
import { createShip, ShipKind } from './world';
import type { Ship } from './world';

const SEED = 20261007;

const STANDARD_STAMP = {
  radius: 20,
  speed: 120,
  turnRate: 240,
  health: 30,
  maxHealth: 30,
  contactDamage: 25,
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
    const leftovers: Partial<Ship> = {
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
    Object.assign(shipAt(world, 1), leftovers);

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
});
