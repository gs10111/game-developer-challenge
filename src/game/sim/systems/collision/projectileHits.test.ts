import { describe, expect, test } from 'vitest';
import type { ConvexPolygon } from '../../../config/gameConfig';
import { Layer } from '../../collision/layers';
import { createMatch } from '../../createMatch';
import { step } from '../../step';
import {
  activeProjectileSlots,
  buildConfig,
  destroyedAt,
  eventfulSteps,
  eventsOf,
  flight,
  flyingAt,
  healthChanges,
  hitAt,
  placeEnemy,
  placeProjectile,
  placeShip,
  projectileAt,
  rectangle,
  SEED,
} from '../../testing/combatHarness';
import type { HealthChange } from '../../testing/combatHarness';
import { createProjectile } from '../../world';
import type { Projectile, Ship } from '../../world';

const EASTWARD = { directionX: 1, directionY: 0 };
const WESTWARD = { directionX: -1, directionY: 0 };
const SOUTHWARD = { directionX: 0, directionY: 1 };
const NORTHWARD = { directionX: 0, directionY: -1 };

interface Grounding {
  islands: ConvexPolygon[];
  enemy: Partial<Ship>;
  shots: Partial<Projectile>[];
  blows: HealthChange[];
}

describe('projectile hits (ADR-0007)', () => {
  test("CB-04 a player's shot damages an enemy and passes through the player, and an enemy's shot damages the player and passes through other enemies", () => {
    const world = createMatch(buildConfig(), SEED);
    const { player } = world;
    const target = placeEnemy(world, { x: 1200, y: 1000 });
    const bystander = placeEnemy(world, { x: 1000, y: 760 });
    const shot = placeProjectile(world, {
      ...EASTWARD,
      layer: Layer.PlayerShot,
      speed: 300,
      x: 940,
      y: 1000,
    });
    const reply = placeProjectile(world, {
      ...SOUTHWARD,
      layer: Layer.EnemyShot,
      speed: 300,
      x: 1000,
      y: 640,
    });

    expect(eventfulSteps(world, 0, 47)).toEqual([]);
    expect(flight(shot)).toEqual(flyingAt(1175, 1000));
    expect(flight(reply)).toEqual(flyingAt(1000, 875));
    expect([player.health, target.health, bystander.health]).toEqual([100, 30, 30]);

    step(world, 0);

    expect(eventsOf(world)).toEqual([hitAt('enemy', 1176, 1000, 1, 0)]);
    expect(shot).toStrictEqual(createProjectile());
    expect(flight(reply)).toEqual(flyingAt(1000, 880));
    expect([player.health, target.health, bystander.health]).toEqual([100, 10, 30]);

    expect(eventfulSteps(world, 0, 18)).toEqual([]);
    expect(flight(reply)).toEqual(flyingAt(1000, 970));
    expect([player.health, target.health, bystander.health]).toEqual([100, 10, 30]);

    step(world, 0);

    expect(eventsOf(world)).toEqual([hitAt('player', 1000, 972, 0, 1)]);
    expect(reply).toStrictEqual(createProjectile());
    expect([player.health, target.health, bystander.health]).toEqual([80, 10, 30]);
    expect(player).toMatchObject({ active: true, layer: 'player', x: 1000, y: 1000 });
    expect(bystander).toMatchObject({ active: true, layer: 'enemy', pendingDamage: 0 });
    expect(activeProjectileSlots(world)).toEqual([]);
    expect(world.score).toBe(0);
  });

  test('CB-04 a projectile with no layer and a ship with no layer hit nothing', () => {
    const world = createMatch(buildConfig(), SEED);
    const { player } = world;
    const enemy = placeEnemy(world, { x: 1200, y: 1000 });
    const adrift = placeShip(world, { x: 1400, y: 1000, radius: 20, health: 60 });
    const northernHulk = placeShip(world, { x: 1000, y: 600, radius: 20, health: 60 });
    const beyondTheHulk = placeEnemy(world, { x: 1200, y: 600 });
    const southernHulk = placeShip(world, { x: 1000, y: 1200, radius: 20, health: 60 });
    const stray = placeProjectile(world, { ...EASTWARD, speed: 300, x: 900, y: 1000 });
    const shot = placeProjectile(world, {
      ...EASTWARD,
      layer: Layer.PlayerShot,
      speed: 300,
      x: 900,
      y: 600,
    });
    const reply = placeProjectile(world, {
      ...NORTHWARD,
      layer: Layer.EnemyShot,
      speed: 300,
      x: 1000,
      y: 1300,
    });

    expect(stray.layer).toBeNull();
    expect([adrift.layer, northernHulk.layer, southernHulk.layer]).toEqual([null, null, null]);

    expect(eventfulSteps(world, 0, 54)).toEqual([]);
    expect(flight(shot)).toEqual(flyingAt(1170, 600));
    expect(flight(reply)).toEqual(flyingAt(1000, 1030));

    step(world, 0);

    expect(eventsOf(world)).toEqual([hitAt('player', 1000, 1028, 0, -1)]);
    expect(reply).toStrictEqual(createProjectile());

    step(world, 0);

    expect(eventsOf(world)).toEqual([hitAt('enemy', 1176, 600, 1, 0)]);
    expect(shot).toStrictEqual(createProjectile());

    expect(eventfulSteps(world, 0, 54)).toEqual([]);
    expect(flight(stray)).toEqual(flyingAt(1450, 1000));
    expect(activeProjectileSlots(world)).toEqual([0]);
    expect([player.health, enemy.health, beyondTheHulk.health]).toEqual([80, 30, 10]);
    expect([adrift.health, northernHulk.health, southernHulk.health]).toEqual([60, 60, 60]);
    expect(
      [adrift, northernHulk, southernHulk, enemy].map(({ pendingDamage }) => pendingDamage),
    ).toEqual([0, 0, 0, 0]);
    expect(world.score).toBe(0);
  });

  test('CB-05 a projectile damages only the first ship on its path and is removed', () => {
    const shot = { ...EASTWARD, layer: Layer.PlayerShot };

    const world = createMatch(buildConfig(), SEED);
    const far = placeEnemy(world, { x: 380, y: 500 });
    const near = placeEnemy(world, { x: 340, y: 500 });
    const ball = placeProjectile(world, { ...shot, speed: 6000, x: 300, y: 500 });

    step(world, 0);

    expect([far.health, near.health]).toEqual([30, 10]);
    expect(eventsOf(world)).toEqual([hitAt('enemy', 316, 500, 1, 0)]);
    expect(ball).toStrictEqual(createProjectile());
    expect(activeProjectileSlots(world)).toEqual([]);

    expect(eventfulSteps(world, 0, 10)).toEqual([]);
    expect([far.health, near.health]).toEqual([30, 10]);

    const inSlotOrder = createMatch(buildConfig(), SEED);
    const nearest = placeEnemy(inSlotOrder, { x: 340, y: 500 });
    const beyond = placeEnemy(inSlotOrder, { x: 380, y: 500 });
    placeProjectile(inSlotOrder, { ...shot, speed: 6000, x: 300, y: 500 });

    step(inSlotOrder, 0);

    expect([nearest.health, beyond.health]).toEqual([10, 30]);
    expect(eventsOf(inSlotOrder)).toEqual([hitAt('enemy', 316, 500, 1, 0)]);
    expect(activeProjectileSlots(inSlotOrder)).toEqual([]);

    const underWay = createMatch(buildConfig(), SEED);
    const astern = placeEnemy(underWay, { x: 460, y: 500 });
    const ahead = placeEnemy(underWay, { x: 400, y: 500 });
    const cannonball = placeProjectile(underWay, { ...shot, speed: 300, x: 300, y: 500 });

    expect(eventfulSteps(underWay, 0, 15)).toEqual([]);
    expect(flight(cannonball)).toEqual(flyingAt(375, 500));

    step(underWay, 0);

    expect([astern.health, ahead.health]).toEqual([30, 10]);
    expect(cannonball).toStrictEqual(createProjectile());

    expect(eventfulSteps(underWay, 0, 60)).toEqual([]);
    expect([astern.health, ahead.health]).toEqual([30, 10]);
    expect(activeProjectileSlots(underWay)).toEqual([]);

    const unequal = createMatch(buildConfig(), SEED);
    const sloop = placeEnemy(unequal, { x: 350, y: 500 });
    const galleon = placeEnemy(unequal, { x: 380, y: 500, radius: 60 });
    placeProjectile(unequal, { ...shot, speed: 6000, x: 300, y: 500 });

    step(unequal, 0);

    expect([sloop.health, galleon.health]).toEqual([30, 10]);
    expect(activeProjectileSlots(unequal)).toEqual([]);

    for (const berths of [
      { lowerSlotY: 490, higherSlotY: 510 },
      { lowerSlotY: 510, higherSlotY: 490 },
    ]) {
      const abreast = createMatch(buildConfig(), SEED);
      const lowerSlot = placeEnemy(abreast, { x: 350, y: berths.lowerSlotY });
      const higherSlot = placeEnemy(abreast, { x: 350, y: berths.higherSlotY });
      placeProjectile(abreast, { ...shot, speed: 6000, x: 300, y: 500 });

      step(abreast, 0);

      expect([lowerSlot.health, higherSlot.health]).toEqual([10, 30]);
      expect(eventsOf(abreast)).toHaveLength(1);
      expect(activeProjectileSlots(abreast)).toEqual([]);
    }
  });

  test('CB-05 two projectiles that reach the same ship in one step each apply their damage once', () => {
    const world = createMatch(buildConfig(), SEED);
    const brig = placeEnemy(world, { x: 500, y: 500, health: 100 });
    const fromTheWest = placeProjectile(world, {
      ...EASTWARD,
      layer: Layer.PlayerShot,
      speed: 300,
      damage: 20,
      x: 470,
      y: 500,
    });
    const fromTheNorth = placeProjectile(world, {
      ...SOUTHWARD,
      layer: Layer.PlayerShot,
      speed: 240,
      damage: 7,
      x: 500,
      y: 470,
    });

    step(world, 0);

    expect(brig.health).toBe(100);
    expect(flight(fromTheWest)).toEqual(flyingAt(475, 500));
    expect(flight(fromTheNorth)).toEqual(flyingAt(500, 474));

    step(world, 0);

    expect(brig).toMatchObject({ active: true, health: 73, maxHealth: 100, pendingDamage: 0 });
    expect(eventsOf(world)).toEqual([
      hitAt('enemy', 476, 500, 1, 0),
      hitAt('enemy', 500, 476, 0, 1),
    ]);
    expect(fromTheWest).toStrictEqual(createProjectile());
    expect(fromTheNorth).toStrictEqual(createProjectile());

    expect(eventfulSteps(world, 0, 10)).toEqual([]);
    expect(brig.health).toBe(73);

    const volley = createMatch(buildConfig(), SEED);
    const sloop = placeEnemy(volley, { x: 500, y: 500, health: 15 });
    const behind = placeEnemy(volley, { x: 600, y: 500 });
    for (const y of [484, 500, 516]) {
      placeProjectile(volley, { ...EASTWARD, layer: Layer.PlayerShot, speed: 600, x: 475, y });
    }

    step(volley, 0);

    expect(eventsOf(volley).map(({ kind, layer }) => ({ kind, layer }))).toEqual([
      { kind: 'hit', layer: 'enemy' },
      { kind: 'hit', layer: 'enemy' },
      { kind: 'hit', layer: 'enemy' },
      { kind: 'destroyed', layer: 'enemy' },
    ]);
    expect(eventsOf(volley).at(-1)).toEqual(destroyedAt('enemy', 500, 500));
    expect(sloop.active).toBe(false);
    expect(volley.score).toBe(1);
    expect(activeProjectileSlots(volley)).toEqual([]);

    expect(eventfulSteps(volley, 0, 30)).toEqual([]);
    expect(behind.health).toBe(30);
    expect(volley.score).toBe(1);
  });

  test('CB-05 a projectile fast enough to jump over a ship in one step still hits it', () => {
    const world = createMatch(buildConfig(), SEED);
    const { player } = world;
    const sloop = placeEnemy(world, { x: 350, y: 500 });
    const skiff = placeEnemy(world, { x: 630, y: 740, radius: 6 });
    const ball = placeProjectile(world, {
      ...EASTWARD,
      layer: Layer.PlayerShot,
      speed: 6000,
      x: 300,
      y: 500,
    });
    const slug = placeProjectile(world, {
      layer: Layer.PlayerShot,
      directionX: 0.6,
      directionY: 0.8,
      speed: 6000,
      x: 600,
      y: 700,
    });
    const wide = placeProjectile(world, {
      ...EASTWARD,
      layer: Layer.PlayerShot,
      speed: 6000,
      x: 300,
      y: 530,
    });
    const reply = placeProjectile(world, {
      ...EASTWARD,
      layer: Layer.EnemyShot,
      speed: 6000,
      x: 950,
      y: 1000,
    });

    step(world, 0);

    expect([sloop.health, skiff.health, player.health]).toEqual([10, 10, 80]);
    expect(ball).toStrictEqual(createProjectile());
    expect(slug).toStrictEqual(createProjectile());
    expect(reply).toStrictEqual(createProjectile());
    expect(flight(wide)).toEqual(flyingAt(400, 530));
    expect(activeProjectileSlots(world)).toEqual([2]);
    expect(eventsOf(world).map(({ kind, layer }) => ({ kind, layer }))).toEqual([
      { kind: 'hit', layer: 'enemy' },
      { kind: 'hit', layer: 'enemy' },
      { kind: 'hit', layer: 'player' },
    ]);

    const openSea = createMatch(buildConfig(), SEED);
    const unopposed = placeProjectile(openSea, {
      ...EASTWARD,
      layer: Layer.PlayerShot,
      speed: 6000,
      x: 300,
      y: 500,
    });

    step(openSea, 0);

    expect(flight(unopposed)).toEqual(flyingAt(400, 500));
  });

  test('CB-05 a ship is hit where the step leaves it', () => {
    const shot = { layer: Layer.PlayerShot, speed: 300 };
    const thrusting = { speed: 600, thrust: 1, health: 100 } as const;
    const groundings: Grounding[] = [
      {
        islands: [rectangle(1100, 960, 1104, 1040)],
        enemy: { ...thrusting, x: 1080, y: 1000, heading: 0 },
        shots: [
          { ...shot, ...SOUTHWARD, x: 1110, y: 900, damage: 7 },
          { ...shot, ...SOUTHWARD, x: 1060, y: 900, damage: 20 },
        ],
        blows: [{ step: 18, health: 80 }],
      },
      {
        islands: [],
        enemy: { ...thrusting, x: 1980, y: 400, heading: 0 },
        shots: [
          { ...shot, directionX: 0.6, directionY: -0.8, x: 1940, y: 500, damage: 7 },
          { ...shot, ...SOUTHWARD, x: 1958, y: 300, damage: 20 },
        ],
        blows: [{ step: 19, health: 80 }],
      },
      {
        islands: [rectangle(30, 900, 300, 1100)],
        enemy: { ...thrusting, x: 20, y: 880, heading: 128 },
        shots: [
          { ...shot, ...NORTHWARD, x: 10, y: 1000, damage: 7 },
          { ...shot, ...WESTWARD, x: 300, y: 858, damage: 20 },
        ],
        blows: [
          { step: 20, health: 93 },
          { step: 55, health: 73 },
        ],
      },
    ];

    for (const { islands, enemy, shots, blows } of groundings) {
      const world = createMatch(buildConfig(islands), SEED);
      const aground = placeEnemy(world, enemy);
      for (const fields of shots) {
        placeProjectile(world, fields);
      }

      expect(healthChanges(world, aground, 0, 60)).toEqual(blows);
      expect(aground).toMatchObject({ active: true, thrust: 1, x: enemy.x, y: enemy.y });
    }
  });

  test('CB-05 a projectile that is already consumed damages nothing', () => {
    const world = createMatch(buildConfig(), SEED);
    const { player } = world;
    const sloop = placeEnemy(world, { x: 500, y: 500 });
    const brig = placeEnemy(world, { x: 500, y: 700 });
    const crossing = { ...EASTWARD, layer: Layer.PlayerShot, speed: 600 };
    const spent = placeProjectile(world, { ...crossing, x: 470, y: 500 });
    const live = placeProjectile(world, { ...crossing, x: 470, y: 700 });
    const lodged = placeProjectile(world, { ...crossing, speed: 0, x: 500, y: 500 });
    const spentReply = placeProjectile(world, {
      ...EASTWARD,
      layer: Layer.EnemyShot,
      speed: 600,
      x: 965,
      y: 1000,
    });
    const laidUp = projectileAt(world, 9);
    Object.assign(laidUp, { ...crossing, x: 480, y: 500, previousX: 470, previousY: 500 });
    Object.assign(laidUp, { radius: 4, damage: 20, remainingSteps: 60 });
    spent.consumed = true;
    lodged.consumed = true;
    spentReply.consumed = true;

    expect(activeProjectileSlots(world)).toEqual([0, 1, 2, 3]);

    step(world, 0);

    expect([sloop.health, brig.health, player.health]).toEqual([30, 10, 100]);
    expect([sloop.pendingDamage, player.pendingDamage]).toEqual([0, 0]);
    expect(eventsOf(world)).toEqual([hitAt('enemy', 476, 700, 1, 0)]);
    for (const projectile of [spent, live, lodged, spentReply]) {
      expect(projectile).toStrictEqual(createProjectile());
    }
    expect(laidUp).toMatchObject({ active: false, consumed: false, x: 480, previousX: 470 });
    expect(activeProjectileSlots(world)).toEqual([]);

    expect(eventfulSteps(world, 0, 5)).toEqual([]);
    expect([sloop.health, brig.health, player.health]).toEqual([30, 10, 100]);
  });

  test('CB-06 a projectile that only touches a ship flies on', () => {
    const tangents = [
      { ...EASTWARD, grazing: { x: 400, y: 476 }, biting: { x: 400, y: 477 } },
      { ...WESTWARD, grazing: { x: 600, y: 524 }, biting: { x: 600, y: 523 } },
      { ...SOUTHWARD, grazing: { x: 476, y: 400 }, biting: { x: 477, y: 400 } },
      { ...NORTHWARD, grazing: { x: 524, y: 600 }, biting: { x: 523, y: 600 } },
    ];

    for (const { directionX, directionY, grazing, biting } of tangents) {
      const shot = { layer: Layer.PlayerShot, directionX, directionY, speed: 300 };
      const touched = createMatch(buildConfig(), SEED);
      const sloop = placeEnemy(touched, { x: 500, y: 500 });
      const graze = placeProjectile(touched, { ...shot, ...grazing });

      expect(eventfulSteps(touched, 0, 40)).toEqual([]);
      expect(flight(graze)).toEqual(
        flyingAt(grazing.x + 200 * directionX, grazing.y + 200 * directionY),
      );
      expect(sloop).toMatchObject({ active: true, health: 30, pendingDamage: 0 });
      expect(activeProjectileSlots(touched)).toEqual([0]);

      const bitten = createMatch(buildConfig(), SEED);
      const brig = placeEnemy(bitten, { x: 500, y: 500 });
      const bite = placeProjectile(bitten, { ...shot, ...biting });

      expect(healthChanges(bitten, brig, 0, 40)).toEqual([{ step: 19, health: 10 }]);
      expect(bite).toStrictEqual(createProjectile());
    }

    const world = createMatch(buildConfig(), SEED);
    const cutter = placeEnemy(world, { x: 500, y: 500 });
    const headOn = placeProjectile(world, {
      ...EASTWARD,
      layer: Layer.PlayerShot,
      speed: 300,
      x: 451,
      y: 500,
    });

    expect(eventfulSteps(world, 0, 5)).toEqual([]);
    expect(flight(headOn)).toEqual(flyingAt(476, 500));
    expect(cutter.health).toBe(30);

    step(world, 0);

    expect(eventsOf(world)).toEqual([hitAt('enemy', 476, 500, 1, 0)]);
    expect(headOn).toStrictEqual(createProjectile());
    expect(cutter.health).toBe(10);
  });
});
