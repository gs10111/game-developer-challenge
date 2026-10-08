import { describe, expect, test } from 'vitest';
import type { Point } from '../../config/gameConfig';
import { Layer } from '../collision/layers';
import { Command } from '../commands';
import { createMatch } from '../createMatch';
import type { GameEvent } from '../events';
import { cosine, sine } from '../math/rotation';
import { spawnChaser, spawnShooter } from '../spawnEnemy';
import { step } from '../step';
import {
  activeProjectileSlots,
  activeShipSlots,
  buildConfig,
  eventsOf,
  hitAt,
  placeEnemy,
  projectileAt,
  SEED,
  shipAt,
  shotFiredAt,
} from '../testing/combatHarness';
import { ShipKind } from '../world';
import type { Ship, World } from '../world';

const UNITS_PER_TURN = 512;
const HALF_TURN = 256;
const RADIANS_PER_HEADING_UNIT = (2 * Math.PI) / UNITS_PER_TURN;
const TURN_PER_STEP = 4;
const STRIDE = 1;
const BAND = 4;
const RANGE = 300;
const COOLDOWN = 60;
const MUZZLE = 26;
const SHOT_STRIDE = 5;
const TOLERANCE = 1e-9;

function afloat(ship: Ship | null): Ship {
  if (ship === null) {
    throw new Error('The ship pool has no free slot');
  }
  return ship;
}

function shooterAt(world: World, x: number, y: number, heading: number): Ship {
  return afloat(spawnShooter(world, x, y, heading));
}

function wrapped(units: number): number {
  return units - UNITS_PER_TURN * Math.round(units / UNITS_PER_TURN);
}

function offsetTo(ship: Ship, mark: Point): number {
  const bearing = Math.atan2(mark.y - ship.y, mark.x - ship.x) / RADIANS_PER_HEADING_UNIT;
  return wrapped(bearing - ship.heading);
}

function distanceBetween(from: Point, to: Point): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

function squaredDistanceBetween(from: Point, to: Point): number {
  return (to.x - from.x) ** 2 + (to.y - from.y) ** 2;
}

function expectClose(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(TOLERANCE);
}

function course({ x, y, heading, thrust, turn }: Ship) {
  return { x, y, heading, thrust, turn };
}

function shotsFiredIn(world: World): GameEvent[] {
  return eventsOf(world).filter(({ kind }) => kind === 'shotFired');
}

describe('shooter intent (ADR-0005, ADR-0006)', () => {
  test('EN-04 a Shooter beyond its attack range approaches the player and does not fire', () => {
    const approaches = [
      { x: 500, y: 1000, heading: 0, steps: 199 },
      { x: 1000, y: 1450, heading: 384, steps: 149 },
      { x: 600, y: 600, heading: 64, steps: 250 },
    ];

    for (const { x, y, heading, steps } of approaches) {
      const world = createMatch(buildConfig(), SEED);
      const { player } = world;
      const shooter = shooterAt(world, x, y, heading);
      const start = distanceBetween(shooter, player);

      for (let count = 1; count <= steps; count += 1) {
        const before = distanceBetween(shooter, player);

        expect(before).toBeGreaterThan(RANGE);
        expect(Math.abs(offsetTo(shooter, player))).toBeLessThan(BAND);

        step(world, 0);

        expect(shooter).toMatchObject({
          active: true,
          heading,
          thrust: 1,
          turn: 0,
          fireFront: 0,
          frontCooldown: 0,
        });
        expectClose(before - distanceBetween(shooter, player), STRIDE);
        expect(world.events.count).toBe(0);
        expect(activeProjectileSlots(world)).toEqual([]);
      }

      expectClose(distanceBetween(shooter, player), start - steps * STRIDE);
      expect(distanceBetween(shooter, player)).toBeGreaterThan(RANGE);
      expect(shooter.weapons).toBe(world.config.enemies.shooter.weapons);
      expect(course(player)).toEqual({ x: 1000, y: 1000, heading: 0, thrust: 0, turn: 0 });
      expect(player.health).toBe(100);
    }
  });

  test('EN-04 a Shooter stops where it comes within its attack range and fires its front cannon toward the player', () => {
    const world = createMatch(buildConfig(), SEED);
    const { player } = world;
    const shooter = shooterAt(world, 649.5, 1000, 0);

    for (let count = 1; count <= 51; count += 1) {
      expect(distanceBetween(shooter, player)).toBeGreaterThan(RANGE);

      step(world, 0);

      expect(shooter).toMatchObject({
        x: 649.5 + count * STRIDE,
        y: 1000,
        thrust: 1,
        turn: 0,
        fireFront: 0,
      });
      expect(world.events.count).toBe(0);
    }

    expect(distanceBetween(shooter, player)).toBe(299.5);

    step(world, 0);

    expect(shooter).toMatchObject({
      x: 700.5,
      y: 1000,
      heading: 0,
      thrust: 0,
      turn: 0,
      fireFront: 1,
      frontCooldown: COOLDOWN,
    });
    expect(eventsOf(world)).toEqual([shotFiredAt('enemy', 'front', 726.5, 1000, 1, 0)]);
    expect(activeProjectileSlots(world)).toEqual([0]);
    expect(projectileAt(world, 0)).toMatchObject({
      layer: 'enemyShot',
      x: 731.5,
      y: 1000,
      directionX: 1,
      directionY: 0,
      speed: 300,
      radius: 4,
      damage: 10,
      remainingSteps: 89,
    });

    for (let count = 1; count <= 40; count += 1) {
      step(world, 0);

      expect(shooter).toMatchObject({
        x: 700.5,
        y: 1000,
        heading: 0,
        thrust: 0,
        turn: 0,
        fireFront: 1,
        frontCooldown: COOLDOWN - count,
      });
      expect(world.events.count).toBe(0);
    }
    expect(activeProjectileSlots(world)).toEqual([0]);
    expect(projectileAt(world, 0)).toMatchObject({ x: 731.5 + 40 * SHOT_STRIDE, y: 1000 });

    const offTheBow = [
      { x: 640.5, y: 1000, heading: 2, approach: 60 },
      { x: 1000, y: 1380.5, heading: 382, approach: 81 },
    ];

    for (const { x, y, heading, approach } of offTheBow) {
      const oblique = createMatch(buildConfig(), SEED);
      const gunner = shooterAt(oblique, x, y, heading);
      const aheadX = cosine(heading);
      const aheadY = sine(heading);
      let steps = 0;

      while (distanceBetween(gunner, oblique.player) > RANGE && steps < 2 * approach) {
        step(oblique, 0);
        steps += 1;

        expect(gunner).toMatchObject({ heading, thrust: 1, turn: 0, fireFront: 0 });
        expect(oblique.events.count).toBe(0);
      }
      const berth = { x: gunner.x, y: gunner.y };
      const reached = distanceBetween(gunner, oblique.player);

      expect(steps).toBe(approach);
      expect(reached).toBeLessThan(RANGE);
      expect(reached).toBeGreaterThan(RANGE - STRIDE);
      expect(Math.abs(offsetTo(gunner, oblique.player))).toBeGreaterThan(2);
      expect(Math.abs(offsetTo(gunner, oblique.player))).toBeLessThan(BAND);

      step(oblique, 0);

      expect(gunner).toMatchObject({
        ...berth,
        heading,
        thrust: 0,
        turn: 0,
        fireFront: 1,
        frontCooldown: COOLDOWN,
      });
      expect(eventsOf(oblique)).toEqual([
        shotFiredAt(
          'enemy',
          'front',
          berth.x + aheadX * MUZZLE,
          berth.y + aheadY * MUZZLE,
          aheadX,
          aheadY,
        ),
      ]);

      for (let count = 1; count <= 20; count += 1) {
        step(oblique, 0);

        expect(gunner).toMatchObject({ ...berth, heading, thrust: 0, turn: 0 });
        expect(oblique.events.count).toBe(0);
      }
    }
  });

  test('EN-04 a Shooter exactly at its attack range is within it, and one a unit beyond is not', () => {
    const becalmed = buildConfig();
    becalmed.enemies.shooter.speed = 0;
    const stations = [
      { atRange: { x: 700, y: 1000 }, beyond: { x: 699, y: 1000 }, heading: 0 },
      { atRange: { x: 1000, y: 1300 }, beyond: { x: 1000, y: 1301 }, heading: 384 },
      { atRange: { x: 820, y: 760 }, beyond: { x: 819, y: 760 }, heading: 76 },
      { atRange: { x: 1240, y: 1180 }, beyond: { x: 1240, y: 1181 }, heading: 308 },
    ];

    for (const { atRange, beyond, heading } of stations) {
      const aheadX = cosine(heading);
      const aheadY = sine(heading);
      const reached = createMatch(buildConfig(), SEED);
      const inside = shooterAt(reached, atRange.x, atRange.y, heading);

      expect(squaredDistanceBetween(inside, reached.player)).toBe(RANGE * RANGE);
      expect(Math.abs(offsetTo(inside, reached.player))).toBeLessThan(1);

      step(reached, 0);

      expect(inside).toMatchObject({
        ...atRange,
        heading,
        thrust: 0,
        turn: 0,
        fireFront: 1,
        frontCooldown: COOLDOWN,
      });
      expect(eventsOf(reached)).toEqual([
        shotFiredAt(
          'enemy',
          'front',
          atRange.x + aheadX * MUZZLE,
          atRange.y + aheadY * MUZZLE,
          aheadX,
          aheadY,
        ),
      ]);

      const short = createMatch(becalmed, SEED);
      const outside = shooterAt(short, beyond.x, beyond.y, heading);

      expect(squaredDistanceBetween(outside, short.player)).toBeGreaterThan(RANGE * RANGE);
      expect(distanceBetween(outside, short.player)).toBeLessThanOrEqual(RANGE + 1);
      expect(Math.abs(offsetTo(outside, short.player))).toBeLessThan(1);

      for (let count = 1; count <= 70; count += 1) {
        step(short, 0);

        expect(outside).toMatchObject({
          ...beyond,
          heading,
          thrust: 1,
          turn: 0,
          fireFront: 0,
          frontCooldown: 0,
        });
        expect(short.events.count).toBe(0);
      }
      expect(activeProjectileSlots(short)).toEqual([]);
      expect(short.player.health).toBe(100);
    }
  });

  test('EN-04 a Shooter within its range that does not face the player turns before it fires', () => {
    const sightings = [
      { heading: 126, side: -1, turning: 31, facing: 2 },
      { heading: 386, side: 1, turning: 31, facing: 510 },
      { heading: 254, side: -1, turning: 63, facing: 2 },
    ];

    for (const { heading, side, turning, facing } of sightings) {
      const world = createMatch(buildConfig(), SEED);
      const { player } = world;
      const shooter = shooterAt(world, 800, 1000, heading);
      const aheadX = cosine(facing);
      const aheadY = sine(facing);

      expect(distanceBetween(shooter, player)).toBe(200);

      for (let count = 1; count <= turning; count += 1) {
        expect(Math.abs(offsetTo(shooter, player))).toBeGreaterThan(BAND);

        step(world, 0);

        expect(shooter).toMatchObject({
          x: 800,
          y: 1000,
          thrust: 0,
          turn: side,
          fireFront: 0,
          frontCooldown: 0,
        });
        expect(wrapped(shooter.heading - (heading + side * count * TURN_PER_STEP))).toBe(0);
        expect(world.events.count).toBe(0);
        expect(activeProjectileSlots(world)).toEqual([]);
      }

      expect(shooter.heading).toBe(facing);
      expect(Math.abs(offsetTo(shooter, player))).toBeLessThan(BAND);

      step(world, 0);

      expect(shooter).toMatchObject({
        x: 800,
        y: 1000,
        heading: facing,
        thrust: 0,
        turn: 0,
        fireFront: 1,
        frontCooldown: COOLDOWN,
      });
      expect(eventsOf(world)).toEqual([
        shotFiredAt('enemy', 'front', 800 + aheadX * MUZZLE, 1000 + aheadY * MUZZLE, aheadX, aheadY),
      ]);
      expect(aheadX).toBeGreaterThan(0.999);
      expect(Math.sign(aheadY)).toBe(0 - side);
    }
  });

  test('EN-04 a Shooter approaches again when the player leaves its range, and stops firing', () => {
    const world = createMatch(buildConfig(), SEED);
    const { player } = world;
    const shooter = shooterAt(world, 701, 1000, 0);
    const shots: number[] = [];

    for (let index = 0; index < COOLDOWN; index += 1) {
      expect(distanceBetween(shooter, player)).toBe(299);

      step(world, 0);

      if (shotsFiredIn(world).length > 0) {
        shots.push(index);
      }
      expect(shooter).toMatchObject({
        x: 701,
        y: 1000,
        heading: 0,
        thrust: 0,
        turn: 0,
        fireFront: 1,
      });
    }

    expect(shots).toEqual([0]);
    expect(shooter.frontCooldown).toBe(1);
    expect(distanceBetween(shooter, player)).toBe(299);

    step(world, Command.Forward);

    expect(eventsOf(world)).toEqual([shotFiredAt('enemy', 'front', 727, 1000, 1, 0)]);
    expect(shooter).toMatchObject({
      x: 701,
      y: 1000,
      thrust: 0,
      turn: 0,
      fireFront: 1,
      frontCooldown: COOLDOWN,
    });
    expectClose(player.x, 1000 + 7 / 3);
    expect(distanceBetween(shooter, player)).toBeGreaterThan(RANGE);

    for (let count = 1; count <= 140; count += 1) {
      expect(distanceBetween(shooter, player)).toBeGreaterThan(RANGE);

      step(world, Command.Forward);

      expect(shooter).toMatchObject({
        x: 701 + count * STRIDE,
        y: 1000,
        heading: 0,
        thrust: 1,
        turn: 0,
        fireFront: 0,
      });
      expect(shotsFiredIn(world)).toEqual([]);
    }

    expect(shooter.frontCooldown).toBe(0);
    expect(distanceBetween(shooter, player)).toBeGreaterThan(RANGE + 100);
  });

  test('EN-04 a Shooter on top of the player fires and hits in that step', () => {
    const world = createMatch(buildConfig(), SEED);
    const { player } = world;
    const shooter = shooterAt(world, 1000, 1000, 128);

    step(world, 0);

    expect(eventsOf(world)).toEqual([
      shotFiredAt('enemy', 'front', 1000, 1026, 0, 1),
      hitAt('player', 1000, 1026, 0, 1),
    ]);
    expect(shooter).toMatchObject({
      active: true,
      x: 1000,
      y: 1000,
      heading: 128,
      thrust: 0,
      turn: 0,
      fireFront: 1,
      frontCooldown: COOLDOWN,
      health: 40,
    });
    expect(player).toMatchObject({ active: true, health: 90, pendingDamage: 0 });
    expect(activeProjectileSlots(world)).toEqual([]);

    step(world, 0);

    expect(world.events.count).toBe(0);
    expect(shooter).toMatchObject({ x: 1000, y: 1000, thrust: 0, turn: 0, frontCooldown: 59 });
    expect(player.health).toBe(90);

    for (const heading of [0, 77, 300, 511]) {
      const crowded = createMatch(buildConfig(), SEED);
      const aboard = shooterAt(crowded, 1000, 1000, heading);
      const muzzleX = 1000 + cosine(heading) * MUZZLE;
      const muzzleY = 1000 + sine(heading) * MUZZLE;

      step(crowded, 0);

      expect(eventsOf(crowded)).toEqual([
        shotFiredAt('enemy', 'front', muzzleX, muzzleY, cosine(heading), sine(heading)),
        hitAt('player', muzzleX, muzzleY, cosine(heading), sine(heading)),
      ]);
      expect(aboard).toMatchObject({ x: 1000, y: 1000, heading, thrust: 0, turn: 0, fireFront: 1 });
      expect(crowded.player).toMatchObject({ health: 90, pendingDamage: 0 });
      expect(activeProjectileSlots(crowded)).toEqual([]);
    }
  });

  test('EN-05 a Shooter turns no faster than its turn rate and moves no faster than its speed', () => {
    const sluggish = buildConfig();
    sluggish.enemies.shooter.speed = 30;
    sluggish.enemies.shooter.turnRateDegrees = 112.5;
    const rigs = [
      { config: buildConfig(), turnPerStep: 4, stride: 1 },
      { config: sluggish, turnPerStep: 8 / 3, stride: 0.5 },
    ];
    const starts = [
      { y: 1000, side: 1 },
      { y: 1010, side: -1 },
    ];

    for (const { config, turnPerStep, stride } of rigs) {
      for (const { y, side } of starts) {
        const world = createMatch(config, SEED);
        const { player } = world;
        const shooter = shooterAt(world, 1600, y, 0);
        const stepsOfHalfACircle = HALF_TURN / turnPerStep;
        let travelled = 0;
        let approach = 0;

        expect(Math.abs(offsetTo(shooter, player))).toBeGreaterThan(HALF_TURN - 2);

        for (let count = 1; count <= stepsOfHalfACircle; count += 1) {
          const from = course(shooter);

          step(world, 0);

          const swing = wrapped(shooter.heading - from.heading);
          const moved = distanceBetween(from, shooter);
          travelled += moved;

          expect(shooter).toMatchObject({ thrust: 1, turn: side, fireFront: 0 });
          expect(Math.abs(swing)).toBeLessThanOrEqual(turnPerStep + TOLERANCE);
          expectClose(swing, side * turnPerStep);
          expect(moved).toBeLessThanOrEqual(stride + TOLERANCE);
          expectClose(moved, stride);
          expectClose(wrapped(shooter.heading - side * count * turnPerStep), 0);
        }

        expectClose(Math.abs(wrapped(shooter.heading)), HALF_TURN);
        expectClose(travelled, stepsOfHalfACircle * stride);
        expect(distanceBetween(shooter, player)).toBeGreaterThan(RANGE + 200);

        while (distanceBetween(shooter, player) > RANGE && approach < 1000) {
          const from = course(shooter);

          step(world, 0);
          approach += 1;

          const swing = wrapped(shooter.heading - from.heading);
          const moved = distanceBetween(from, shooter);

          expect(shooter).toMatchObject({ thrust: 1, fireFront: 0 });
          expect(Math.abs(swing)).toBeLessThanOrEqual(turnPerStep + TOLERANCE);
          expect(moved).toBeLessThanOrEqual(stride + TOLERANCE);
          expectClose(moved, stride);
        }

        expect(approach).toBeGreaterThan(250 / stride);
        expect(distanceBetween(shooter, player)).toBeLessThanOrEqual(RANGE);
        expect(distanceBetween(shooter, player)).toBeGreaterThan(RANGE - stride);

        for (let count = 1; count <= 5; count += 1) {
          const from = course(shooter);

          step(world, 0);

          expect(shooter.thrust).toBe(0);
          expect(distanceBetween(from, shooter)).toBe(0);
          expect(Math.abs(wrapped(shooter.heading - from.heading))).toBeLessThanOrEqual(
            turnPerStep + TOLERANCE,
          );
        }
      }
    }
  });

  test("EN-04 the Shooter's rule gives no intent to the player, to a Chaser, to a ship of no kind or to an inactive slot, and the Chaser's rule gives none to a Shooter", () => {
    const world = createMatch(buildConfig(), SEED);
    const { player } = world;
    const cannon = world.config.enemies.shooter.weapons;
    const shooter = shooterAt(world, 800, 1000, 0);
    const chaser = afloat(spawnChaser(world, 400, 1000, 0));
    Object.assign(chaser, { attackRange: 2000, weapons: cannon });
    const adrift = placeEnemy(world, {
      x: 1000,
      y: 800,
      heading: 128,
      speed: 60,
      turnRate: 240,
      attackRange: RANGE,
      weapons: cannon,
    });
    const underOrders = placeEnemy(world, {
      x: 1600,
      y: 400,
      heading: 0,
      speed: 120,
      turnRate: 240,
      attackRange: RANGE,
      thrust: 1,
      turn: -1,
      fireFront: 1,
    });
    const laidUp = shipAt(world, 9);
    Object.assign(laidUp, {
      layer: Layer.Enemy,
      kind: ShipKind.Shooter,
      x: 1200,
      y: 1000,
      previousX: 1200,
      previousY: 1000,
      heading: 256,
      radius: 22,
      speed: 60,
      turnRate: 240,
      health: 40,
      maxHealth: 40,
      attackRange: RANGE,
      weapons: cannon,
    });
    const fired: GameEvent[] = [];

    expect(adrift.kind).toBeNull();
    expect(underOrders.kind).toBeNull();
    expect(distanceBetween(shooter, player)).toBe(200);
    expect(distanceBetween(adrift, player)).toBe(200);
    expect(distanceBetween(laidUp, player)).toBe(200);
    expect(offsetTo(chaser, player)).toBe(0);
    expect(offsetTo(adrift, player)).toBe(0);
    expect(Math.abs(offsetTo(laidUp, player))).toBe(0);
    expect(activeShipSlots(world)).toEqual([0, 1, 2, 3, 4]);

    for (let count = 1; count <= 20; count += 1) {
      step(world, 0);
      fired.push(...eventsOf(world));

      expect(course(player)).toEqual({ x: 1000, y: 1000, heading: 0, thrust: 0, turn: 0 });
      expect(player.fireFront).toBe(0);
      expect(course(shooter)).toEqual({ x: 800, y: 1000, heading: 0, thrust: 0, turn: 0 });
      expect(shooter.fireFront).toBe(1);
      expect(chaser).toMatchObject({ y: 1000, heading: 0, thrust: 1, turn: 0, fireFront: 0 });
      expectClose(chaser.x, 400 + 2 * count);
      expect(course(adrift)).toEqual({ x: 1000, y: 800, heading: 128, thrust: 0, turn: 0 });
      expect(adrift.fireFront).toBe(0);
      expect(underOrders).toMatchObject({ thrust: 1, turn: -1, fireFront: 1 });
      expect(underOrders.heading).toBe(UNITS_PER_TURN - count * TURN_PER_STEP);
      expect(course(laidUp)).toEqual({ x: 1200, y: 1000, heading: 256, thrust: 0, turn: 0 });
      expect(laidUp.fireFront).toBe(0);
    }

    expect(fired).toEqual([shotFiredAt('enemy', 'front', 826, 1000, 1, 0)]);
    expect(activeProjectileSlots(world)).toEqual([0]);
    expect(laidUp.active).toBe(false);
    expect(underOrders.y).toBeLessThan(400 - 5);
    expect(activeShipSlots(world)).toEqual([0, 1, 2, 3, 4]);

    step(world, Command.TurnLeft | Command.FireFront);

    expect(player).toMatchObject({ x: 1000, y: 1000, thrust: 0, turn: -1, fireFront: 1 });
    expect(course(shooter)).toEqual({ x: 800, y: 1000, heading: 0, thrust: 0, turn: 0 });
    expect(chaser).toMatchObject({ thrust: 1, fireFront: 0 });
    expect(adrift).toMatchObject({ thrust: 0, turn: 0, fireFront: 0 });
  });
});
