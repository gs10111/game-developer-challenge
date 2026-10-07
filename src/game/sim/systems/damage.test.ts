import { describe, expect, test } from 'vitest';
import { Layer } from '../collision/layers';
import { createMatch } from '../createMatch';
import { step } from '../step';
import {
  activeProjectileSlots,
  activeShipSlots,
  buildConfig,
  destroyedAt,
  eventsOf,
  flight,
  flyingAt,
  hold,
  placeEnemy,
  placeProjectile,
  placeShip,
  SEED,
  shipAt,
} from '../testing/combatHarness';
import { testWeapons } from '../testing/testWeapons';
import { createProjectile, createShip } from '../world';
import type { Ship } from '../world';

function vitals({ active, health, maxHealth, pendingDamage }: Ship) {
  return { active, health, maxHealth, pendingDamage };
}

function afloatWith(health: number, maxHealth: number) {
  return { active: true, health, maxHealth, pendingDamage: 0 };
}

describe('damage stage (ADR-0006)', () => {
  test('EN-06 a ship loses its pending damage from its health, and the pending damage is cleared', () => {
    const world = createMatch(buildConfig(), SEED);
    const sloop = placeEnemy(world, { x: 300, y: 400, health: 30 });
    const brig = placeEnemy(world, { x: 500, y: 400, health: 45.5 });
    const untouched = placeEnemy(world, { x: 700, y: 400, health: 30 });
    const neutral = placeShip(world, { x: 900, y: 400, radius: 20, health: 60 });
    sloop.pendingDamage = 12;
    brig.pendingDamage = 2.25;
    neutral.pendingDamage = 59;
    world.player.pendingDamage = 25;

    step(world, 0);

    expect(vitals(sloop)).toEqual(afloatWith(18, 30));
    expect(vitals(brig)).toEqual(afloatWith(43.25, 45.5));
    expect(vitals(untouched)).toEqual(afloatWith(30, 30));
    expect(vitals(neutral)).toEqual(afloatWith(1, 60));
    expect(vitals(world.player)).toEqual(afloatWith(75, 100));
    expect(sloop).toMatchObject({ layer: 'enemy', x: 300, y: 400, radius: 20 });
    expect(neutral).toMatchObject({ layer: null, x: 900, y: 400, radius: 20 });

    hold(world, 0, 3);

    expect(vitals(sloop)).toEqual(afloatWith(18, 30));
    expect(vitals(brig)).toEqual(afloatWith(43.25, 45.5));
    expect(vitals(neutral)).toEqual(afloatWith(1, 60));
    expect(vitals(world.player)).toEqual(afloatWith(75, 100));

    sloop.pendingDamage += 5;
    sloop.pendingDamage += 6;
    untouched.pendingDamage = 0.5;

    step(world, 0);

    expect(vitals(sloop)).toEqual(afloatWith(7, 30));
    expect(vitals(untouched)).toEqual(afloatWith(29.5, 30));
    expect(vitals(brig)).toEqual(afloatWith(43.25, 45.5));
    expect(activeShipSlots(world)).toEqual([0, 1, 2, 3, 4]);
    expect(world.score).toBe(0);
    expect(eventsOf(world)).toEqual([]);
  });

  test('EN-06 an inactive slot keeps its pending damage and its health', () => {
    const world = createMatch(buildConfig(), SEED);
    const afloat = placeEnemy(world, { x: 300, y: 400, health: 30 });
    const sunkLongAgo = shipAt(world, 2);
    const laidUp = shipAt(world, 5);
    Object.assign(sunkLongAgo, {
      layer: Layer.Enemy,
      x: 500,
      y: 400,
      radius: 20,
      health: 30,
      maxHealth: 30,
      pendingDamage: 30,
    });
    Object.assign(laidUp, { health: 30, maxHealth: 30, pendingDamage: 10 });
    afloat.pendingDamage = 10;

    expect(activeShipSlots(world)).toEqual([0, 1]);

    step(world, 0);

    expect(sunkLongAgo).toStrictEqual({
      ...createShip(),
      layer: 'enemy',
      x: 500,
      y: 400,
      radius: 20,
      health: 30,
      maxHealth: 30,
      pendingDamage: 30,
    });
    expect(laidUp).toStrictEqual({
      ...createShip(),
      health: 30,
      maxHealth: 30,
      pendingDamage: 10,
    });
    expect(vitals(afloat)).toEqual(afloatWith(20, 30));
    expect(activeShipSlots(world)).toEqual([0, 1]);
    expect(world.score).toBe(0);
    expect(eventsOf(world)).toEqual([]);

    hold(world, 0, 3);

    expect(vitals(sunkLongAgo)).toEqual({
      active: false,
      health: 30,
      maxHealth: 30,
      pendingDamage: 30,
    });
    expect(vitals(laidUp)).toEqual({
      active: false,
      health: 30,
      maxHealth: 30,
      pendingDamage: 10,
    });
    expect(world.score).toBe(0);
  });

  test("PL-04 the player's health stops at zero and the player stays in the match", () => {
    const world = createMatch(buildConfig(), SEED);
    const player = world.player;

    player.pendingDamage = 30;
    step(world, 0);

    expect(vitals(player)).toEqual(afloatWith(70, 100));

    const beforeTheLastBlow = { ...player };
    player.pendingDamage = 85;
    step(world, 0);

    expect(vitals(player)).toEqual(afloatWith(0, 100));
    expect(player).toStrictEqual({ ...beforeTheLastBlow, health: 0 });
    expect(player).toMatchObject({ layer: 'player', x: 1000, y: 1000, radius: 24 });
    expect(player.weapons).toEqual(testWeapons());
    expect(world.player).toBe(player);
    expect(shipAt(world, 0)).toBe(player);
    expect(activeShipSlots(world)).toEqual([0]);

    player.pendingDamage = 15;
    step(world, 0);

    expect(vitals(player)).toEqual(afloatWith(0, 100));

    hold(world, 0, 5);

    expect(player).toStrictEqual({ ...beforeTheLastBlow, health: 0 });
    expect(activeShipSlots(world)).toEqual([0]);

    const sunkAtOnce = createMatch(buildConfig(), SEED);
    sunkAtOnce.player.pendingDamage = 100;
    step(sunkAtOnce, 0);

    expect(vitals(sunkAtOnce.player)).toEqual(afloatWith(0, 100));

    const frail = buildConfig();
    frail.player.health = 40;
    const short = createMatch(frail, SEED);
    short.player.pendingDamage = 39.5;
    step(short, 0);

    expect(vitals(short.player)).toEqual(afloatWith(0.5, 40));

    short.player.pendingDamage = 1000;
    step(short, 0);

    expect(vitals(short.player)).toEqual(afloatWith(0, 40));
    expect(short.player.layer).toBe('player');
  });

  test('CB-08 an enemy whose health reaches zero is removed in that step and its slot is free', () => {
    const world = createMatch(buildConfig(), SEED);
    const sunk = placeEnemy(world, { x: 300, y: 400, health: 30 });
    const holed = placeEnemy(world, { x: 500, y: 400, health: 30 });
    const blownApart = placeEnemy(world, {
      x: 700,
      y: 400,
      health: 30,
      heading: 128,
      speed: 90,
      turnRate: 64,
      weapons: testWeapons(),
    });
    sunk.pendingDamage = 30;
    holed.pendingDamage = 29;
    blownApart.pendingDamage = 75;

    expect(activeShipSlots(world)).toEqual([0, 1, 2, 3]);

    step(world, 0);

    expect(sunk).toStrictEqual(createShip());
    expect(blownApart).toStrictEqual(createShip());
    expect(vitals(holed)).toEqual(afloatWith(1, 30));
    expect(holed).toMatchObject({ layer: 'enemy', x: 500, y: 400 });
    expect(activeShipSlots(world)).toEqual([0, 2]);

    step(world, 0);

    expect(sunk).toStrictEqual(createShip());
    expect(blownApart).toStrictEqual(createShip());
    expect(activeShipSlots(world)).toEqual([0, 2]);

    const next = placeEnemy(world, { x: 900, y: 400, health: 50 });
    const afterNext = placeShip(world, { x: 1100, y: 400, radius: 20, health: 10 });

    expect(next).toBe(sunk);
    expect(afterNext).toBe(blownApart);
    expect(next).toStrictEqual({
      ...createShip(),
      active: true,
      layer: 'enemy',
      x: 900,
      y: 400,
      previousX: 900,
      previousY: 400,
      radius: 20,
      health: 50,
      maxHealth: 50,
    });
    expect(activeShipSlots(world)).toEqual([0, 1, 2, 3]);

    step(world, 0);

    expect(vitals(next)).toEqual(afloatWith(50, 50));
    expect(vitals(afterNext)).toEqual(afloatWith(10, 10));
    expect(activeShipSlots(world)).toEqual([0, 1, 2, 3]);

    holed.pendingDamage = 1;
    step(world, 0);

    expect(holed).toStrictEqual(createShip());
    expect(activeShipSlots(world)).toEqual([0, 1, 3]);
  });

  test('MT-02 each enemy destroyed adds one point, and a damaged enemy, a destroyed player and a ship with no layer add none', () => {
    const world = createMatch(buildConfig(), SEED);
    const first = placeEnemy(world, { x: 300, y: 400, health: 30 });
    const second = placeEnemy(world, { x: 500, y: 400, health: 10 });
    const damaged = placeEnemy(world, { x: 700, y: 400, health: 30 });
    const third = placeEnemy(world, { x: 900, y: 400, health: 45 });
    const fresh = placeEnemy(world, { x: 1100, y: 400, health: 30 });
    first.pendingDamage = 30;
    second.pendingDamage = 500;
    damaged.pendingDamage = 29;
    third.pendingDamage = 45.5;

    expect(world.score).toBe(0);

    step(world, 0);

    expect(world.score).toBe(3);
    expect(activeShipSlots(world)).toEqual([0, 3, 5]);

    hold(world, 0, 4);

    expect(world.score).toBe(3);

    damaged.pendingDamage = 1;
    step(world, 0);

    expect(world.score).toBe(4);

    fresh.pendingDamage = 30;
    step(world, 0);

    expect(world.score).toBe(5);
    expect(activeShipSlots(world)).toEqual([0]);

    hold(world, 0, 4);

    expect(world.score).toBe(5);

    const skirmish = createMatch(buildConfig(), SEED);
    const scarred = placeEnemy(skirmish, { x: 300, y: 400, health: 30 });
    scarred.pendingDamage = 10;
    step(skirmish, 0);
    scarred.pendingDamage = 19.5;
    step(skirmish, 0);

    expect(vitals(scarred)).toEqual(afloatWith(0.5, 30));
    expect(skirmish.score).toBe(0);

    const defeat = createMatch(buildConfig(), SEED);
    defeat.player.pendingDamage = 100;
    step(defeat, 0);

    expect(defeat.player.health).toBe(0);
    expect(defeat.score).toBe(0);

    defeat.player.pendingDamage = 40;
    step(defeat, 0);

    expect(defeat.score).toBe(0);

    const flotsam = createMatch(buildConfig(), SEED);
    const derelict = placeShip(flotsam, { x: 300, y: 400, radius: 20, health: 30 });
    derelict.pendingDamage = 30;
    step(flotsam, 0);

    expect(derelict.health).toBe(0);
    expect(flotsam.score).toBe(0);

    derelict.pendingDamage = 30;
    step(flotsam, 0);

    expect(flotsam.score).toBe(0);

    const melee = createMatch(buildConfig(), SEED);
    const prize = placeEnemy(melee, { x: 300, y: 400, health: 30 });
    const hulk = placeShip(melee, { x: 500, y: 400, radius: 20, health: 30 });
    const bruised = placeEnemy(melee, { x: 700, y: 400, health: 30 });
    prize.pendingDamage = 30;
    hulk.pendingDamage = 30;
    bruised.pendingDamage = 12;
    melee.player.pendingDamage = 100;
    step(melee, 0);

    expect(melee.score).toBe(1);
  });

  test('FX-02 a ship whose health reaches zero pushes one event with its layer and position, and none in later steps', () => {
    const world = createMatch(buildConfig(), SEED);
    const raider = placeEnemy(world, { x: 300, y: 400, health: 30 });
    const survivor = placeEnemy(world, { x: 500, y: 640, health: 30 });
    raider.pendingDamage = 30;
    survivor.pendingDamage = 29;
    world.player.pendingDamage = 100;

    step(world, 0);

    expect(eventsOf(world)).toStrictEqual([
      {
        kind: 'destroyed',
        layer: 'player',
        weapon: null,
        x: 1000,
        y: 1000,
        directionX: 0,
        directionY: 0,
      },
      {
        kind: 'destroyed',
        layer: 'enemy',
        weapon: null,
        x: 300,
        y: 400,
        directionX: 0,
        directionY: 0,
      },
    ]);
    expect(raider).toStrictEqual(createShip());
    expect(world.player).toMatchObject({ active: true, health: 0, x: 1000, y: 1000 });

    step(world, 0);

    expect(eventsOf(world)).toEqual([]);

    world.player.pendingDamage = 40;
    survivor.pendingDamage = 0.5;
    step(world, 0);

    expect(world.player.health).toBe(0);
    expect(survivor.health).toBe(0.5);
    expect(eventsOf(world)).toEqual([]);

    survivor.pendingDamage = 7;
    step(world, 0);

    expect(eventsOf(world)).toStrictEqual([destroyedAt('enemy', 500, 640)]);
    expect(survivor).toStrictEqual(createShip());

    hold(world, 0, 3);

    expect(eventsOf(world)).toEqual([]);
    expect(world.events.count).toBe(0);
  });

  test('CB-06 a consumed projectile is removed in the step, and one that is not consumed stays', () => {
    const world = createMatch(buildConfig(), SEED);
    const eastward = { directionX: 1, directionY: 0, speed: 120 };
    const shot = { ...eastward, layer: Layer.PlayerShot };
    const reply = { ...eastward, layer: Layer.EnemyShot };
    const spent = placeProjectile(world, { ...shot, x: 300, y: 600 });
    const flying = placeProjectile(world, { ...shot, x: 300, y: 700 });
    const spentReply = placeProjectile(world, { ...reply, x: 300, y: 800 });
    const flyingReply = placeProjectile(world, { ...reply, x: 300, y: 900 });
    const spentStray = placeProjectile(world, { ...eastward, x: 300, y: 1100 });
    spent.consumed = true;
    spentReply.consumed = true;
    spentStray.consumed = true;

    expect(activeProjectileSlots(world)).toEqual([0, 1, 2, 3, 4]);

    step(world, 0);

    expect(spent).toStrictEqual(createProjectile());
    expect(spentReply).toStrictEqual(createProjectile());
    expect(spentStray).toStrictEqual(createProjectile());
    expect(flight(flying)).toEqual(flyingAt(302, 700));
    expect(flight(flyingReply)).toEqual(flyingAt(302, 900));
    expect(flying).toMatchObject({ layer: 'playerShot', radius: 4, damage: 20 });
    expect(activeProjectileSlots(world)).toEqual([1, 3]);
    expect(vitals(world.player)).toEqual(afloatWith(100, 100));
    expect(world.score).toBe(0);
    expect(eventsOf(world)).toEqual([]);

    const next = placeProjectile(world, { ...shot, x: 300, y: 1300 });

    expect(next).toBe(spent);
    expect(placeProjectile(world, { ...eastward, x: 300, y: 1400 })).toBe(spentReply);

    hold(world, 0, 2);

    expect(flight(flying)).toEqual(flyingAt(306, 700));
    expect(flight(next)).toEqual(flyingAt(304, 1300));
    expect(activeProjectileSlots(world)).toEqual([0, 1, 2, 3]);

    flying.consumed = true;
    step(world, 0);

    expect(flying).toStrictEqual(createProjectile());
    expect(flight(flyingReply)).toEqual(flyingAt(308, 900));
    expect(activeProjectileSlots(world)).toEqual([0, 2, 3]);
  });
});
