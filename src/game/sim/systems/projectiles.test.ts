import { describe, expect, test } from 'vitest';
import type { ConvexPolygon } from '../../config/gameConfig';
import { createMatch } from '../createMatch';
import { acquire } from '../pool';
import { step } from '../step';
import { STEPS_PER_SECOND } from '../stepRate';
import { testConfig } from '../testing/testConfig';
import { createProjectile } from '../world';
import type { Projectile, World } from '../world';

const SEED = 20261007;
const TOLERANCE = 1e-9;
const STEPS_OF_THE_LONGEST_MATCH = 10800;

const COURSES = [
  { directionX: 1, directionY: 0, speed: 300 },
  { directionX: 0, directionY: 1, speed: 240 },
  { directionX: -1, directionY: 0, speed: 420 },
  { directionX: 0, directionY: -1, speed: 360 },
  { directionX: 0.6, directionY: 0.8, speed: 300 },
  { directionX: -0.8, directionY: 0.6, speed: 37.5 },
  { directionX: 0.28, directionY: -0.96, speed: 600 },
  { directionX: -0.6, directionY: -0.8, speed: 150 },
];

function buildConfig(islands: ConvexPolygon[] = []) {
  return testConfig({ width: 2000, height: 2000, islands });
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

function expectClose(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(TOLERANCE);
}

describe('projectiles (ADR-0006)', () => {
  test('CB-03 a projectile travels along its direction at its speed', () => {
    const world = createMatch(buildConfig(), SEED);
    const flights = COURSES.map((course, index) => ({
      course,
      startX: 900 + 20 * index,
      shot: fire(world, {
        ...course,
        x: 900 + 20 * index,
        y: 700,
        radius: 3 + index,
        damage: 10 + index,
      }),
    }));

    for (let count = 1; count <= STEPS_PER_SECOND; count += 1) {
      step(world, 0);

      for (const { course, startX, shot } of flights) {
        const travelled = (course.speed * count) / STEPS_PER_SECOND;

        expectClose(shot.x, startX + course.directionX * travelled);
        expectClose(shot.y, 700 + course.directionY * travelled);
      }
    }

    for (const [index, { course, startX, shot }] of flights.entries()) {
      expectClose(shot.x, startX + course.directionX * course.speed);
      expectClose(shot.y, 700 + course.directionY * course.speed);
      expectClose(Math.hypot(shot.x - startX, shot.y - 700), course.speed);
      expect(shot).toMatchObject({
        ...course,
        active: true,
        radius: 3 + index,
        damage: 10 + index,
      });
    }
    expect(world.projectiles.slots.filter(({ active }) => active)).toHaveLength(COURSES.length);
  });

  test('CB-03 a projectile records where it was before it moved', () => {
    const world = createMatch(buildConfig(), SEED);
    const shots = COURSES.map((course, index) =>
      fire(world, { ...course, x: 900 + 20 * index, y: 700 }),
    );
    const becalmed = fire(world, { x: 300, y: 400, directionX: 1, directionY: 0, speed: 0 });
    const flying = [...shots, becalmed];
    for (const shot of flying) {
      shot.previousX = 11;
      shot.previousY = 22;
    }

    for (let count = 0; count < STEPS_PER_SECOND / 2; count += 1) {
      const departures = flying.map(({ x, y }) => ({ previousX: x, previousY: y }));

      step(world, 0);

      const recorded = flying.map(({ previousX, previousY }) => ({ previousX, previousY }));

      expect(recorded).toEqual(departures);
      for (const shot of shots) {
        expectClose(
          Math.hypot(shot.x - shot.previousX, shot.y - shot.previousY),
          shot.speed / STEPS_PER_SECOND,
        );
      }
      expect(becalmed).toMatchObject({ x: 300, y: 400, previousX: 300, previousY: 400 });
    }
  });

  test('CB-06 a projectile with N steps left is active after N - 1 and after N steps, having moved N times, and is removed by step N + 1 without moving', () => {
    for (const lifetime of [1, 2, 3, 30, 90, 120]) {
      const world = createMatch(buildConfig(), SEED);
      const shot = fire(world, {
        x: 400,
        y: 300,
        directionX: 0.6,
        directionY: 0.8,
        speed: 300,
        remainingSteps: lifetime,
      });
      const outliving = fire(world, {
        x: 400,
        y: 1500,
        directionX: 1,
        directionY: 0,
        speed: 60,
        remainingSteps: lifetime + 2,
      });

      for (let count = 1; count < lifetime; count += 1) {
        step(world, 0);

        expect(shot).toMatchObject({ active: true, remainingSteps: lifetime - count });
        expectClose(shot.x, 400 + 3 * count);
        expectClose(shot.y, 300 + 4 * count);
      }

      expect(shot).toMatchObject({ active: true, remainingSteps: 1 });
      expectClose(shot.x, 400 + 3 * (lifetime - 1));
      expectClose(shot.y, 300 + 4 * (lifetime - 1));

      step(world, 0);

      expect(shot).toMatchObject({ active: true, remainingSteps: 0 });
      expectClose(shot.x, 400 + 3 * lifetime);
      expectClose(shot.y, 300 + 4 * lifetime);
      expectClose(shot.previousX, 400 + 3 * (lifetime - 1));
      expectClose(shot.previousY, 300 + 4 * (lifetime - 1));

      step(world, 0);

      expect(shot).toStrictEqual(createProjectile());
      expect(outliving).toMatchObject({ active: true, x: 400 + lifetime + 1, remainingSteps: 1 });

      step(world, 0);

      expect(outliving).toMatchObject({ active: true, x: 400 + lifetime + 2, remainingSteps: 0 });

      step(world, 0);

      expect(outliving).toStrictEqual(createProjectile());
      expect(world.projectiles.slots.filter(({ active }) => active)).toEqual([]);
    }

    const world = createMatch(buildConfig(), SEED);
    const course = { directionX: 1, directionY: 0, speed: 300 };
    const spent = fire(world, { ...course, x: 400, y: 300, remainingSteps: 0 });
    const onItsLastStep = fire(world, { ...course, x: 400, y: 600, remainingSteps: 1 });

    step(world, 0);

    expect(spent).toStrictEqual(createProjectile());
    expect(onItsLastStep).toMatchObject({
      active: true,
      x: 405,
      previousX: 400,
      remainingSteps: 0,
    });
  });

  test('CB-06 an inactive projectile slot is left where it is', () => {
    const island = [
      { x: 1200, y: 300 },
      { x: 1400, y: 300 },
      { x: 1400, y: 500 },
      { x: 1200, y: 500 },
    ];
    const world = createMatch(buildConfig([island]), SEED);
    const course = { directionX: 1, directionY: 0, speed: 300 };
    const adrift = fire(world, { ...course, x: 400, y: 300, remainingSteps: 5 });
    const spent = fire(world, { ...course, x: 500, y: 600, remainingSteps: 0 });
    const overboard = fire(world, { ...course, x: -50, y: 2100, remainingSteps: 9 });
    const ashore = fire(world, { ...course, x: 1300, y: 400, remainingSteps: 9 });
    const flying = fire(world, { ...course, x: 400, y: 900, speed: 60 });
    const idle = [adrift, spent, overboard, ashore];
    for (const slot of idle) {
      slot.active = false;
      slot.previousX = 11;
      slot.previousY = 22;
    }
    const before = idle.map((slot) => ({ ...slot }));

    expect([...idle, flying].map((slot) => world.projectiles.slots.indexOf(slot))).toEqual([
      0, 1, 2, 3, 4,
    ]);
    expect(before.map(({ active }) => active)).toEqual([false, false, false, false]);

    for (let count = 1; count <= 2 * STEPS_PER_SECOND; count += 1) {
      step(world, 0);

      expect(idle).toStrictEqual(before);
      expect(flying).toMatchObject({ active: true, x: 400 + count, y: 900 });
    }

    expect(world.projectiles.slots.filter(({ active }) => active)).toEqual([flying]);
  });
});
