import { describe, expect, test } from 'vitest';
import type { Point } from '../../config/gameConfig';
import { Layer } from '../collision/layers';
import { Command } from '../commands';
import { createMatch } from '../createMatch';
import { step } from '../step';
import {
  activeProjectileSlots,
  activeShipSlots,
  buildConfig,
  destroyedAt,
  eventfulSteps,
  eventsOf,
  flight,
  flyingAt,
  healthChanges,
  hitAt,
  hold,
  placeEnemy,
  placeProjectile,
  projectileAt,
  rectangle,
  SEED,
  shipAt,
  shotFiredAt,
} from '../testing/combatHarness';
import { testWeapons } from '../testing/testWeapons';
import { createProjectile, createShip } from '../world';
import type { World } from '../world';

const TOLERANCE = 1e-9;
const RADIANS_PER_HEADING_UNIT = (2 * Math.PI) / 512;
const QUARTER_TURN = 128;
const EVERY_WEAPON = Command.FireFront | Command.FireLeft | Command.FireRight;
const EASTWARD = { directionX: 1, directionY: 0 };

interface ScoreChange {
  step: number;
  score: number;
}

function scoreChanges(world: World, commands: number, steps: number): ScoreChange[] {
  const changes: ScoreChange[] = [];
  for (let count = 0; count < steps; count += 1) {
    const before = world.score;
    step(world, commands);
    if (world.score !== before) {
      changes.push({ step: world.step, score: world.score });
    }
  }
  return changes;
}

function facing(heading: number, quarterTurn = 0): Point {
  const angle = (heading + quarterTurn) * RADIANS_PER_HEADING_UNIT;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function expectClose(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(TOLERANCE);
}

describe('combat (ADR-0006, ADR-0007)', () => {
  test('CB-06 a projectile hits on the last step of its lifetime', () => {
    const inReach = createMatch(buildConfig(), SEED);
    const sloop = placeEnemy(inReach, { x: 1650, y: 1000 });
    const outOfReach = createMatch(buildConfig(), SEED);
    const brig = placeEnemy(outOfReach, { x: 1653, y: 1000 });

    for (const world of [inReach, outOfReach]) {
      step(world, Command.FireFront);

      expect(eventfulSteps(world, 0, 118)).toEqual([]);
      expect(projectileAt(world, 0)).toMatchObject({
        active: true,
        consumed: false,
        x: 1623,
        y: 1000,
        remainingSteps: 1,
      });
    }
    expect([sloop.health, brig.health]).toEqual([30, 30]);

    step(inReach, 0);
    step(outOfReach, 0);

    expect(sloop.health).toBe(10);
    expect(eventsOf(inReach)).toEqual([hitAt('enemy', 1626, 1000, 1, 0)]);
    expect(projectileAt(inReach, 0)).toStrictEqual(createProjectile());
    expect(brig.health).toBe(30);
    expect(eventsOf(outOfReach)).toEqual([]);
    expect(projectileAt(outOfReach, 0)).toMatchObject({
      active: true,
      consumed: false,
      x: 1628,
      remainingSteps: 0,
    });

    step(outOfReach, 0);

    expect(brig.health).toBe(30);
    expect(eventsOf(outOfReach)).toEqual([]);
    expect(projectileAt(outOfReach, 0)).toStrictEqual(createProjectile());

    const world = createMatch(buildConfig(), SEED);
    const struck = placeEnemy(world, { x: 500, y: 500 });
    const spared = placeEnemy(world, { x: 500, y: 700 });
    const shot = { ...EASTWARD, layer: Layer.PlayerShot, speed: 300 };
    const onItsLastStride = placeProjectile(world, { ...shot, x: 472, y: 500, remainingSteps: 1 });
    const expired = placeProjectile(world, { ...shot, x: 472, y: 700, remainingSteps: 0 });
    const expiredAboard = placeProjectile(world, { ...shot, x: 490, y: 700, remainingSteps: 0 });

    step(world, 0);

    expect([struck.health, spared.health]).toEqual([10, 30]);
    expect(eventsOf(world)).toEqual([hitAt('enemy', 476, 500, 1, 0)]);
    for (const projectile of [onItsLastStride, expired, expiredAboard]) {
      expect(projectile).toStrictEqual(createProjectile());
    }
  });

  test('CB-06 a projectile that reaches a ship and an island or a wall in the same step damages the ship', () => {
    const quay = rectangle(1100, 900, 1300, 1100);
    const shot = { ...EASTWARD, layer: Layer.PlayerShot, speed: 3000 };

    const world = createMatch(buildConfig([quay]), SEED);
    const moored = placeEnemy(world, { x: 1080, y: 1000 });
    const alongside = placeEnemy(world, { x: 1980, y: 500 });
    const intoTheQuay = placeProjectile(world, { ...shot, x: 1050, y: 1000 });
    const pastTheWall = placeProjectile(world, { ...shot, x: 1955, y: 500 });

    step(world, 0);

    expect([moored.health, alongside.health]).toEqual([10, 10]);
    expect(eventsOf(world)).toEqual([
      hitAt('enemy', 1056, 1000, 1, 0),
      hitAt('enemy', 1956, 500, 1, 0),
    ]);
    expect(intoTheQuay).toStrictEqual(createProjectile());
    expect(pastTheWall).toStrictEqual(createProjectile());
    expect(moored).toMatchObject({ active: true, x: 1080, y: 1000, pendingDamage: 0 });
    expect(alongside).toMatchObject({ active: true, x: 1980, y: 500, pendingDamage: 0 });

    expect(eventfulSteps(world, 0, 5)).toEqual([]);
    expect([moored.health, alongside.health]).toEqual([10, 10]);

    const deserted = createMatch(buildConfig([quay]), SEED);
    const ashore = placeProjectile(deserted, { ...shot, x: 1050, y: 1000 });
    const overboard = placeProjectile(deserted, { ...shot, x: 1955, y: 500 });
    const atSea = placeProjectile(deserted, { ...shot, x: 1050, y: 500 });

    step(deserted, 0);

    expect(eventsOf(deserted)).toEqual([]);
    expect(ashore).toStrictEqual(createProjectile());
    expect(overboard).toStrictEqual(createProjectile());
    expect(flight(atSea)).toEqual(flyingAt(1100, 500));
  });

  test('CB-06 a shot fired point blank hits in the step it is fired, with its shot and hit events, and leaves its slot free', () => {
    const world = createMatch(buildConfig(), SEED);
    const boarder = placeEnemy(world, { x: 1050, y: 1000, health: 50 });
    const volley = [
      shotFiredAt('player', 'front', 1028, 1000, 1, 0),
      hitAt('enemy', 1028, 1000, 1, 0),
    ];

    step(world, Command.FireFront);

    expect(eventsOf(world)).toEqual(volley);
    expect(boarder).toMatchObject({ active: true, health: 30, maxHealth: 50, pendingDamage: 0 });
    expect(projectileAt(world, 0)).toStrictEqual(createProjectile());
    expect(activeProjectileSlots(world)).toEqual([]);
    expect(world.player.frontCooldown).toBe(30);

    expect(eventfulSteps(world, Command.FireFront, 29)).toEqual([]);
    expect(boarder.health).toBe(30);

    step(world, Command.FireFront);

    expect(eventsOf(world)).toEqual(volley);
    expect(boarder.health).toBe(10);
    expect(projectileAt(world, 0)).toStrictEqual(createProjectile());
    expect(activeProjectileSlots(world)).toEqual([]);

    expect(eventfulSteps(world, Command.FireFront, 29)).toEqual([]);

    step(world, Command.FireFront);

    expect(eventsOf(world)).toEqual([...volley, destroyedAt('enemy', 1050, 1000)]);
    expect(boarder).toStrictEqual(createShip());
    expect(activeProjectileSlots(world)).toEqual([]);
    expect(world.score).toBe(1);

    const withinTheFirstStride = createMatch(buildConfig(), SEED);
    const close = placeEnemy(withinTheFirstStride, { x: 1055, y: 1000 });

    step(withinTheFirstStride, Command.FireFront);

    expect(eventsOf(withinTheFirstStride)).toEqual([
      shotFiredAt('player', 'front', 1028, 1000, 1, 0),
      hitAt('enemy', 1031, 1000, 1, 0),
    ]);
    expect(close.health).toBe(10);
    expect(activeProjectileSlots(withinTheFirstStride)).toEqual([]);

    const beyondTheFirstStride = createMatch(buildConfig(), SEED);
    const clear = placeEnemy(beyondTheFirstStride, { x: 1058, y: 1000 });

    step(beyondTheFirstStride, Command.FireFront);

    expect(eventsOf(beyondTheFirstStride)).toEqual([
      shotFiredAt('player', 'front', 1028, 1000, 1, 0),
    ]);
    expect(clear.health).toBe(30);
    expect(flight(projectileAt(beyondTheFirstStride, 0))).toEqual(flyingAt(1033, 1000));

    const abeam = createMatch(buildConfig(), SEED);
    const hulk = placeEnemy(abeam, { x: 1000, y: 945, radius: 30 });

    step(abeam, Command.FireLeft);

    expect(eventsOf(abeam)).toEqual([
      shotFiredAt('player', 'left', 1000, 973, 0, -1),
      hitAt('enemy', 984, 973, 0, -1),
      hitAt('enemy', 1000, 973, 0, -1),
      hitAt('enemy', 1016, 973, 0, -1),
      destroyedAt('enemy', 1000, 945),
    ]);
    expect(hulk).toStrictEqual(createShip());
    expect(activeProjectileSlots(abeam)).toEqual([]);
    expect([0, 1, 2].map((position) => projectileAt(abeam, position))).toStrictEqual([
      createProjectile(),
      createProjectile(),
      createProjectile(),
    ]);
    expect(abeam.score).toBe(1);
    expect(abeam.player.leftCooldown).toBe(60);
  });

  test('PL-04 the player loses the damage of each enemy shot that reaches it', () => {
    const heavyGuns = testWeapons();
    heavyGuns.front.damage = 35;
    const world = createMatch(buildConfig(), SEED);
    const { player } = world;
    const armed = { heading: 256, fireFront: 1 } as const;
    placeEnemy(world, { ...armed, x: 1300, y: 1000, weapons: heavyGuns });
    placeEnemy(world, { ...armed, x: 1300, y: 1040, weapons: testWeapons() });

    expect(player).toMatchObject({ health: 100, maxHealth: 100 });
    expect(healthChanges(world, player, 0, 109)).toEqual([
      { step: 50, health: 65 },
      { step: 80, health: 30 },
    ]);

    step(world, 0);

    expect(eventsOf(world)).toEqual([
      hitAt('player', 1028, 1000, -1, 0),
      destroyedAt('player', 1000, 1000),
    ]);
    expect(player).toMatchObject({
      active: true,
      layer: 'player',
      health: 0,
      maxHealth: 100,
      pendingDamage: 0,
    });
    expect(world.score).toBe(0);

    const abeam = createMatch(buildConfig(), SEED);
    placeEnemy(abeam, { x: 1000, y: 800, heading: 0, weapons: testWeapons(), fireRight: 1 });

    expect(healthChanges(abeam, abeam.player, 0, 60)).toEqual([
      { step: 38, health: 88 },
      { step: 39, health: 64 },
    ]);
    expect(abeam.player).toMatchObject({ active: true, maxHealth: 100, pendingDamage: 0 });

    const unscathed = createMatch(buildConfig(), SEED);
    placeEnemy(unscathed, { ...armed, x: 1300, y: 1040, weapons: testWeapons() });

    expect(healthChanges(unscathed, unscathed.player, EVERY_WEAPON, 240)).toEqual([]);
    expect(unscathed.player.health).toBe(100);
    expect(activeShipSlots(unscathed)).toEqual([0, 1]);
  });

  test('EN-06 an enemy survives a shot weaker than its health and is destroyed when the shots add up to it', () => {
    const world = createMatch(buildConfig(), SEED);
    const brig = placeEnemy(world, { x: 1200, y: 1000, health: 50 });

    hold(world, Command.FireFront, 30);

    expect(brig).toMatchObject({
      active: true,
      layer: 'enemy',
      x: 1200,
      y: 1000,
      health: 30,
      maxHealth: 50,
      pendingDamage: 0,
    });
    expect(world.score).toBe(0);

    hold(world, Command.FireFront, 30);

    expect(brig).toMatchObject({ active: true, health: 10, maxHealth: 50, pendingDamage: 0 });
    expect(activeShipSlots(world)).toEqual([0, 1]);

    hold(world, Command.FireFront, 29);

    expect(brig).toMatchObject({ active: true, health: 10 });

    step(world, Command.FireFront);

    expect(brig).toStrictEqual(createShip());
    expect(activeShipSlots(world)).toEqual([0]);
    expect(world.score).toBe(1);

    const hulls = [
      { health: 20, blows: [{ step: 30, health: 0 }] },
      {
        health: 20.5,
        blows: [
          { step: 30, health: 0.5 },
          { step: 60, health: 0 },
        ],
      },
      {
        health: 40,
        blows: [
          { step: 30, health: 20 },
          { step: 60, health: 0 },
        ],
      },
      {
        health: 45,
        blows: [
          { step: 30, health: 25 },
          { step: 60, health: 5 },
          { step: 90, health: 0 },
        ],
      },
    ];
    for (const { health, blows } of hulls) {
      const match = createMatch(buildConfig(), SEED);
      const enemy = placeEnemy(match, { x: 1200, y: 1000, health });

      expect(healthChanges(match, enemy, Command.FireFront, 150)).toEqual(blows);
      expect(enemy).toStrictEqual(createShip());
      expect(match.score).toBe(1);
      expect(match.player.health).toBe(100);
    }
  });

  test("MT-02 an enemy destroyed by the player's shots adds one point, once, and an enemy shot that crosses an enemy or hits the player adds none", () => {
    const world = createMatch(buildConfig(), SEED);
    const { player } = world;
    const hulk = placeEnemy(world, { x: 1000, y: 945, radius: 30, health: 12 });
    const prize = placeEnemy(world, { x: 1200, y: 1000, health: 20 });
    const secondPrize = placeEnemy(world, { x: 1400, y: 1000, health: 20 });
    const gunner = placeEnemy(world, {
      x: 600,
      y: 1000,
      heading: 0,
      weapons: testWeapons(),
      fireFront: 1,
    });
    const bystander = placeEnemy(world, { x: 800, y: 1000 });

    expect(world.score).toBe(0);
    expect(scoreChanges(world, Command.FireFront | Command.FireLeft, 150)).toEqual([
      { step: 1, score: 1 },
      { step: 30, score: 2 },
      { step: 100, score: 3 },
    ]);
    for (const sunk of [hulk, prize, secondPrize]) {
      expect(sunk).toStrictEqual(createShip());
    }
    expect(activeShipSlots(world)).toEqual([0, 4, 5]);
    expect(player).toMatchObject({ active: true, health: 40, maxHealth: 100 });
    expect(gunner).toMatchObject({ active: true, layer: 'enemy', health: 30 });
    expect(bystander).toMatchObject({ active: true, layer: 'enemy', health: 30, pendingDamage: 0 });
    expect(world.score).toBe(3);

    const underFire = createMatch(buildConfig(), SEED);
    placeEnemy(underFire, { x: 600, y: 1000, heading: 0, weapons: testWeapons(), fireFront: 1 });
    placeEnemy(underFire, { x: 800, y: 1000 });

    expect(healthChanges(underFire, underFire.player, 0, 150)).toEqual([
      { step: 70, health: 80 },
      { step: 100, health: 60 },
      { step: 130, health: 40 },
    ]);
    expect(underFire.score).toBe(0);
    expect(activeShipSlots(underFire)).toEqual([0, 1, 2]);
  });

  test('CB-08 a destroyed enemy does not fire in the next step, and a shot crosses where it was', () => {
    const world = createMatch(buildConfig(), SEED);
    const { player } = world;
    const raider = placeEnemy(world, {
      x: 1200,
      y: 1000,
      heading: QUARTER_TURN,
      health: 20,
      weapons: testWeapons(),
      fireFront: 1,
      fireRight: 1,
    });
    const consort = placeEnemy(world, { x: 1400, y: 1000 });
    const hulk = shipAt(world, 5);
    Object.assign(hulk, { layer: Layer.Enemy, x: 1300, y: 1000, radius: 20 });
    Object.assign(hulk, { health: 30, maxHealth: 30 });

    step(world, Command.FireFront);

    expect(eventsOf(world)).toEqual([
      shotFiredAt('player', 'front', 1028, 1000, 1, 0),
      shotFiredAt('enemy', 'front', 1200, 1024, 0, 1),
      shotFiredAt('enemy', 'right', 1177, 1000, -1, 0),
    ]);
    expect(activeProjectileSlots(world)).toEqual([0, 1, 2, 3, 4]);

    expect(eventfulSteps(world, Command.FireFront, 28)).toEqual([]);
    expect(raider).toMatchObject({ active: true, health: 20, frontCooldown: 2 });

    step(world, Command.FireFront);

    expect(eventsOf(world)).toEqual([
      hitAt('enemy', 1176, 1000, 1, 0),
      destroyedAt('enemy', 1200, 1000),
    ]);
    expect(raider).toStrictEqual(createShip());
    expect(activeShipSlots(world)).toEqual([0, 2]);
    expect(activeProjectileSlots(world)).toEqual([1, 2, 3, 4]);
    expect(world.score).toBe(1);

    step(world, Command.FireFront);

    expect(eventsOf(world)).toEqual([shotFiredAt('player', 'front', 1028, 1000, 1, 0)]);
    expect(raider).toStrictEqual(createShip());
    expect(activeProjectileSlots(world)).toEqual([0, 1, 2, 3, 4]);
    expect(flight(projectileAt(world, 0))).toEqual(flyingAt(1033, 1000));
    expect(flight(projectileAt(world, 1))).toEqual(flyingAt(1200, 1024 + 31 * 5));
    expect(flight(projectileAt(world, 3))).toEqual(flyingAt(1177 - 31 * 4, 1000));

    expect(eventfulSteps(world, 0, 68)).toEqual([38, 39]);
    expect(player.health).toBe(100 - 3 * 12);
    expect(consort.health).toBe(30);

    step(world, 0);

    expect(eventsOf(world)).toEqual([hitAt('enemy', 1376, 1000, 1, 0)]);
    expect(consort.health).toBe(10);
    expect(raider).toStrictEqual(createShip());
    expect(hulk).toMatchObject({ active: false, health: 30, pendingDamage: 0, x: 1300 });
    expect(activeShipSlots(world)).toEqual([0, 2]);
    expect(world.score).toBe(1);

    expect(eventfulSteps(world, 0, 60)).toEqual([]);
    expect(activeProjectileSlots(world)).toEqual([]);
  });

  test('FX-04 a hit pushes one event at the point of impact, with the layer of the ship that was hit and the direction of the projectile', () => {
    const world = createMatch(buildConfig(), SEED);
    placeEnemy(world, { x: 500, y: 500, health: 100 });
    placeEnemy(world, { x: 500, y: 700, radius: 21, health: 100 });
    placeProjectile(world, { ...EASTWARD, layer: Layer.PlayerShot, speed: 300, x: 470, y: 500 });
    placeProjectile(world, { ...EASTWARD, layer: Layer.PlayerShot, speed: 300, x: 470, y: 693 });
    placeProjectile(world, {
      layer: Layer.EnemyShot,
      directionX: 0,
      directionY: -1,
      speed: 300,
      x: 1000,
      y: 1040,
    });
    const queue = [...world.events.items];

    step(world, 0);

    expect(eventsOf(world)).toEqual([]);

    step(world, 0);

    expect(eventsOf(world)).toStrictEqual([
      { kind: 'hit', layer: 'enemy', weapon: null, x: 476, y: 500, directionX: 1, directionY: 0 },
      { kind: 'hit', layer: 'enemy', weapon: null, x: 476, y: 693, directionX: 1, directionY: 0 },
    ]);

    step(world, 0);

    expect(eventsOf(world)).toStrictEqual([
      { kind: 'hit', layer: 'player', weapon: null, x: 1000, y: 1028, directionX: 0, directionY: -1 },
    ]);
    expect(world.events.items.filter((item, index) => item !== queue[index])).toEqual([]);

    expect(eventfulSteps(world, 0, 10)).toEqual([]);

    for (const heading of [37, 200, 300, 450]) {
      const bow = facing(heading);
      const port = facing(heading, -QUARTER_TURN);
      const duel = createMatch(buildConfig(), SEED);
      duel.player.heading = heading;
      const target = placeEnemy(duel, {
        x: 1000 + 200 * bow.x + 10 * port.x,
        y: 1000 + 200 * bow.y + 10 * port.y,
        health: 100,
      });
      const reach = 200 - Math.sqrt(24 * 24 - 10 * 10);

      step(duel, Command.FireFront);

      const { directionX, directionY } = projectileAt(duel, 0);
      expectClose(directionX, bow.x);
      expectClose(directionY, bow.y);

      const impacts = Array.from({ length: 60 }, () => {
        step(duel, 0);
        return eventsOf(duel);
      }).flat();
      const [impact] = impacts;
      if (impact === undefined) {
        throw new Error('The shot pushed no event');
      }

      expect(impacts).toHaveLength(1);
      expect(impact).toMatchObject({ kind: 'hit', layer: 'enemy', weapon: null });
      expect(impact.directionX).toBe(directionX);
      expect(impact.directionY).toBe(directionY);
      expectClose(impact.x, 1000 + reach * bow.x);
      expectClose(impact.y, 1000 + reach * bow.y);
      expectClose(Math.hypot(impact.x - target.x, impact.y - target.y), 24);
      expect(target.health).toBe(80);
      expect(activeProjectileSlots(duel)).toEqual([]);
    }
  });
});
