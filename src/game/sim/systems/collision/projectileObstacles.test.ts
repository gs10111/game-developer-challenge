import { describe, expect, test } from 'vitest';
import type { ConvexPolygon, GameConfig, Point } from '../../../config/gameConfig';
import { createMatch } from '../../createMatch';
import { PROJECTILE_POOL_CAPACITY } from '../../limits';
import { acquire } from '../../pool';
import { step } from '../../step';
import { testWeapons } from '../../testing/testWeapons';
import { createProjectile } from '../../world';
import type { Projectile, World } from '../../world';

const SEED = 20261007;
const HAIR = 1e-10;
const STEPS_OF_THE_LONGEST_MATCH = 10800;
const FLIGHT_STEPS = 70;

function rectangle(left: number, top: number, right: number, bottom: number): Point[] {
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

function buildConfig(width: number, height: number, islands: ConvexPolygon[] = []) {
  return {
    arena: { width, height, islands },
    player: { radius: 24, speed: 140, turnRateDegrees: 150, weapons: testWeapons() },
  } satisfies GameConfig;
}

function hold(world: World, commands: number, steps: number): void {
  for (let count = 0; count < steps; count += 1) {
    step(world, commands);
  }
}

function fire(world: World, shot: Partial<Projectile>): Projectile {
  const projectile = acquire(world.projectiles);
  if (projectile === null) {
    throw new Error('The projectile pool has no free slot');
  }
  Object.assign(
    projectile,
    { radius: 4, damage: 20, remainingSteps: STEPS_OF_THE_LONGEST_MATCH },
    shot,
  );
  projectile.previousX = projectile.x;
  projectile.previousY = projectile.y;
  return projectile;
}

function stepOfRemoval(world: World, shot: Projectile, limit: number): number | null {
  for (let count = 1; count <= limit; count += 1) {
    step(world, 0);
    if (!shot.active) {
      return count;
    }
  }
  return null;
}

function slotAt(world: World, position: number): Projectile {
  const slot = world.projectiles.slots[position];
  if (slot === undefined) {
    throw new Error('The projectile pool has no such slot');
  }
  return slot;
}

function freeSlots(world: World): number[] {
  return world.projectiles.slots.flatMap((slot, position) => (slot.active ? [] : [position]));
}

describe('projectile obstacles (ADR-0007)', () => {
  test('CB-06 a projectile is removed when its centre passes a wall, at each of the four walls, and stays while its centre is inside or exactly on it', () => {
    const arenas = [
      { width: 960, height: 540 },
      { width: 400, height: 300 },
    ];

    for (const { width, height } of arenas) {
      const walls = [
        { x: width, y: height / 2, outwardX: 1, outwardY: 0 },
        { x: width / 2, y: height, outwardX: 0, outwardY: 1 },
        { x: 0, y: height / 2, outwardX: -1, outwardY: 0 },
        { x: width / 2, y: 0, outwardX: 0, outwardY: -1 },
      ];

      for (const { x, y, outwardX, outwardY } of walls) {
        const outward = { directionX: outwardX, directionY: outwardY };
        const moored = createMatch(buildConfig(width, height), SEED);
        const onTheWall = fire(moored, { ...outward, speed: 0, x, y });
        const aHairInside = fire(moored, {
          ...outward,
          speed: 0,
          x: x - outwardX * HAIR,
          y: y - outwardY * HAIR,
        });
        const aHairBeyond = fire(moored, {
          ...outward,
          speed: 0,
          x: x + outwardX * HAIR,
          y: y + outwardY * HAIR,
        });

        step(moored, 0);

        expect(onTheWall).toMatchObject({ active: true, x, y });
        expect(aHairInside.active).toBe(true);
        expect(aHairBeyond).toStrictEqual(createProjectile());

        hold(moored, 0, 30);

        expect(onTheWall).toMatchObject({ active: true, x, y });
        expect(aHairInside.active).toBe(true);
        expect(freeSlots(moored).slice(0, 2)).toEqual([2, 3]);

        const underWay = createMatch(buildConfig(width, height), SEED);
        const landing = fire(underWay, {
          ...outward,
          speed: 120,
          x: x - 4 * outwardX,
          y: y - 4 * outwardY,
        });
        const passing = fire(underWay, {
          ...outward,
          speed: 180,
          x: x - 10 * outwardX,
          y: y - 10 * outwardY,
        });

        hold(underWay, 0, 2);

        expect(landing).toMatchObject({ active: true, x, y });
        expect(passing).toMatchObject({ active: true, x: x - 4 * outwardX, y: y - 4 * outwardY });

        step(underWay, 0);

        expect(landing).toStrictEqual(createProjectile());
        expect(passing).toMatchObject({
          active: true,
          x: x - outwardX,
          y: y - outwardY,
          radius: 4,
        });

        step(underWay, 0);

        expect(passing).toStrictEqual(createProjectile());
      }

      const world = createMatch(buildConfig(width, height), SEED);
      const atRest = { directionX: 1, directionY: 0, speed: 0 };
      const inTheCorners = [
        fire(world, { ...atRest, x: 0, y: 0 }),
        fire(world, { ...atRest, x: width, y: 0 }),
        fire(world, { ...atRest, x: 0, y: height }),
        fire(world, { ...atRest, x: width, y: height }),
      ];
      const alongTheTopWall = fire(world, {
        x: width - 7,
        y: 0,
        directionX: 1,
        directionY: 0,
        speed: 120,
      });
      const acrossTheArena = fire(world, {
        x: 20,
        y: height / 2,
        directionX: 1,
        directionY: 0,
        speed: 300,
      });

      hold(world, 0, 3);

      expect(alongTheTopWall).toMatchObject({ active: true, x: width - 1, y: 0 });
      expect(freeSlots(world).slice(0, 1)).toEqual([6]);

      step(world, 0);

      expect(alongTheTopWall).toStrictEqual(createProjectile());
      expect(freeSlots(world).slice(0, 2)).toEqual([4, 6]);

      const stepsToTheFarWall = (width - 20) / 5;
      hold(world, 0, stepsToTheFarWall - 4);

      expect(acrossTheArena).toMatchObject({ active: true, x: width, y: height / 2 });
      expect(inTheCorners.map(({ active }) => active)).toEqual([true, true, true, true]);

      step(world, 0);

      expect(acrossTheArena).toStrictEqual(createProjectile());
      expect(inTheCorners.map(({ x, y }) => ({ x, y }))).toEqual([
        { x: 0, y: 0 },
        { x: width, y: 0 },
        { x: 0, y: height },
        { x: width, y: height },
      ]);
      expect(freeSlots(world).slice(0, 3)).toEqual([4, 5, 6]);
    }
  });

  test('CB-02 a projectile is removed when it overlaps an island, and passes one that it only touches or misses', () => {
    const quay = rectangle(600, 200, 700, 340);
    const reef = [
      { x: 100, y: 100 },
      { x: 400, y: 100 },
      { x: 100, y: 500 },
    ];
    const eastward = { directionX: 1, directionY: 0, speed: 300 };
    const southward = { directionX: 0, directionY: 1, speed: 300 };
    const westward = { directionX: -1, directionY: 0, speed: 300 };
    const atRest = { directionX: 1, directionY: 0, speed: 0 };
    const flights = [
      { shot: { ...eastward, x: 500, y: 270, radius: 4 }, removedAt: 20 },
      { shot: { ...eastward, x: 500, y: 270, radius: 5 }, removedAt: 20 },
      { shot: { ...eastward, x: 500, y: 270, radius: 10 }, removedAt: 19 },
      { shot: { ...southward, x: 596, y: 150, radius: 4 }, removedAt: null },
      { shot: { ...southward, x: 596.5, y: 150, radius: 4 }, removedAt: 10 },
      { shot: { ...southward, x: 580, y: 150, radius: 4 }, removedAt: null },
      { shot: { ...westward, x: 502, y: 400, radius: 4 }, removedAt: 65 },
      { shot: { ...atRest, x: 596, y: 270, radius: 4 }, removedAt: null },
      { shot: { ...atRest, x: 596 + HAIR, y: 270, radius: 4 }, removedAt: 1 },
      { shot: { ...atRest, x: 597, y: 196, radius: 5 }, removedAt: null },
      { shot: { ...atRest, x: 597 + HAIR, y: 196, radius: 5 }, removedAt: 1 },
      { shot: { ...atRest, x: 650, y: 270, radius: 4 }, removedAt: 1 },
      { shot: { ...atRest, x: 350, y: 400, radius: 4 }, removedAt: null },
      { shot: { ...atRest, x: 200, y: 200, radius: 4 }, removedAt: 1 },
    ];

    const flown = flights.map(({ shot }) => {
      const world = createMatch(buildConfig(960, 540, [quay, reef]), SEED);
      return { shot, removedAt: stepOfRemoval(world, fire(world, shot), FLIGHT_STEPS) };
    });
    const flownInOpenSea = flights.map(({ shot }) => {
      const world = createMatch(buildConfig(960, 540), SEED);
      return stepOfRemoval(world, fire(world, shot), FLIGHT_STEPS);
    });

    expect(flown).toEqual(flights);
    expect(flownInOpenSea).toEqual(flights.map(() => null));

    const world = createMatch(buildConfig(960, 540, [quay, reef]), SEED);
    const grazing = fire(world, { ...southward, x: 596, y: 150, radius: 4 });
    const clear = fire(world, { ...southward, x: 580, y: 150, radius: 4 });

    hold(world, 0, FLIGHT_STEPS);

    expect(grazing).toMatchObject({ active: true, x: 596, y: 500 });
    expect(clear).toMatchObject({ active: true, x: 580, y: 500 });
  });

  test('CB-06 the slot of a removed projectile is free for the next one', () => {
    const world = createMatch(buildConfig(960, 540, [rectangle(600, 200, 700, 340)]), SEED);
    const pool = world.projectiles;
    const afloat = { x: 300, y: 100, directionX: 1, directionY: 0, speed: 0 };
    for (let count = 0; count < PROJECTILE_POOL_CAPACITY; count += 1) {
      fire(world, afloat);
    }
    const overboard = slotAt(world, 17);
    const ashore = slotAt(world, 101);
    const spent = slotAt(world, 230);
    overboard.x = 960 + HAIR;
    ashore.x = 650;
    ashore.y = 270;
    spent.remainingSteps = 0;

    expect(freeSlots(world)).toEqual([]);
    expect(acquire(pool)).toBeNull();

    step(world, 0);

    expect(freeSlots(world)).toEqual([17, 101, 230]);
    for (const slot of [overboard, ashore, spent]) {
      expect(slot).toStrictEqual(createProjectile());
    }

    const next = fire(world, { x: 400, y: 100, directionX: 1, directionY: 0, speed: 60 });

    expect(next).toBe(overboard);
    expect(next).toStrictEqual({
      active: true,
      x: 400,
      y: 100,
      previousX: 400,
      previousY: 100,
      directionX: 1,
      directionY: 0,
      speed: 60,
      radius: 4,
      damage: 20,
      remainingSteps: STEPS_OF_THE_LONGEST_MATCH,
    });
    expect(fire(world, afloat)).toBe(ashore);
    expect(fire(world, afloat)).toBe(spent);
    expect(acquire(pool)).toBeNull();

    step(world, 0);

    expect(freeSlots(world)).toEqual([]);
    expect(next).toMatchObject({ active: true, x: 401, previousX: 400 });
  });
});
