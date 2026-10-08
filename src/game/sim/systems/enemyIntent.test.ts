import { describe, expect, test } from 'vitest';
import type { Point } from '../../config/gameConfig';
import { Layer } from '../collision/layers';
import { Command } from '../commands';
import { createMatch } from '../createMatch';
import { spawnChaser } from '../spawnEnemy';
import { step } from '../step';
import { activeShipSlots, buildConfig, placeEnemy, SEED, shipAt } from '../testing/combatHarness';
import { ShipKind } from '../world';
import type { Ship, World } from '../world';

const UNITS_PER_TURN = 512;
const HALF_TURN = 256;
const RADIANS_PER_HEADING_UNIT = (2 * Math.PI) / UNITS_PER_TURN;
const TURN_PER_STEP = 4;
const STRIDE = 2;
const BAND = 4;
const CONTACT_DISTANCE = 44;
const TOLERANCE = 1e-9;

function chaserAt(world: World, x: number, y: number, heading: number): Ship {
  const chaser = spawnChaser(world, x, y, heading);
  if (chaser === null) {
    throw new Error('The ship pool has no free slot');
  }
  return chaser;
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

function expectClose(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(TOLERANCE);
}

function course({ x, y, heading, thrust, turn }: Ship) {
  return { x, y, heading, thrust, turn };
}

describe('enemy intent (ADR-0005, ADR-0006)', () => {
  test('EN-01 a Chaser turns toward the player and closes the distance until it faces it', () => {
    const approaches = [
      { x: 400, y: 1000, heading: 128, side: -1 },
      { x: 400, y: 1000, heading: 384, side: 1 },
      { x: 1000, y: 300, heading: 0, side: 1 },
      { x: 1000, y: 1700, heading: 0, side: -1 },
      { x: 1500, y: 1500, heading: 0, side: -1 },
      { x: 500, y: 600, heading: 420, side: 1 },
      { x: 1600, y: 1000, heading: 10, side: 1 },
      { x: 1600, y: 1000, heading: 500, side: -1 },
    ];

    for (const { x, y, heading, side } of approaches) {
      const world = createMatch(buildConfig(), SEED);
      const { player } = world;
      const chaser = chaserAt(world, x, y, heading);
      let turning = 0;

      expect(Math.sign(offsetTo(chaser, player))).toBe(side);

      while (Math.abs(offsetTo(chaser, player)) > BAND && turning < HALF_TURN / TURN_PER_STEP) {
        const headingBefore = chaser.heading;
        const offsetBefore = offsetTo(chaser, player);

        step(world, 0);
        turning += 1;

        expect(chaser).toMatchObject({ active: true, thrust: 1, turn: side });
        expect(wrapped(chaser.heading - headingBefore)).toBe(side * TURN_PER_STEP);
        expect(Math.abs(offsetTo(chaser, player))).toBeLessThan(Math.abs(offsetBefore));
      }

      expect(turning).toBeGreaterThan(10);
      expect(Math.abs(offsetTo(chaser, player))).toBeLessThanOrEqual(BAND);

      const facing = chaser.heading;
      step(world, 0);

      expect(chaser).toMatchObject({ thrust: 1, turn: 0, heading: facing });

      for (let count = 0; count < 100; count += 1) {
        const before = distanceBetween(chaser, player);

        step(world, 0);

        const closed = before - distanceBetween(chaser, player);
        expect(closed).toBeGreaterThan(1.99);
        expect(closed).toBeLessThanOrEqual(STRIDE + TOLERANCE);
        expect(Math.abs(offsetTo(chaser, player))).toBeLessThan(BAND + 1);
      }

      expect(distanceBetween(chaser, player)).toBeGreaterThan(CONTACT_DISTANCE + 100);
      expect(course(player)).toEqual({ x: 1000, y: 1000, heading: 0, thrust: 0, turn: 0 });
      expect(player.health).toBe(100);
    }
  });

  test('EN-01 a Chaser follows the player as the player moves', () => {
    const world = createMatch(buildConfig(), SEED);
    const { player } = world;
    const chaser = chaserAt(world, 100, 1000, 0);
    const anchored = createMatch(buildConfig(), SEED);
    const waiting = chaserAt(anchored, 100, 1000, 0);
    const southbound: number[] = [];
    const northbound: number[] = [];
    let nearest = distanceBetween(chaser, player);

    player.heading = 128;
    for (let count = 0; count < 240; count += 1) {
      step(world, Command.Forward);
      step(anchored, 0);
      southbound.push(chaser.turn);
      nearest = Math.min(nearest, distanceBetween(chaser, player));

      expect(Math.abs(offsetTo(chaser, player))).toBeLessThan(BAND + 1);
    }
    const headingWhenThePlayerTurnsBack = chaser.heading;
    const yWhenThePlayerTurnsBack = chaser.y;

    expect(player.x).toBe(1000);
    expectClose(player.y, 1560);
    expect(southbound.filter((turn) => turn === -1)).toEqual([]);
    expect(southbound.filter((turn) => turn === 1).length).toBeGreaterThan(5);
    expect(headingWhenThePlayerTurnsBack).toBe(
      TURN_PER_STEP * southbound.filter((turn) => turn === 1).length,
    );
    expect(headingWhenThePlayerTurnsBack).toBeGreaterThan(30);
    expect(headingWhenThePlayerTurnsBack).toBeLessThan(128);
    expect(yWhenThePlayerTurnsBack).toBeGreaterThan(1050);
    expect(waiting).toMatchObject({ active: true, y: 1000, heading: 0, thrust: 1, turn: 0 });
    expectClose(waiting.x, 100 + 240 * STRIDE);
    expect(anchored.player).toMatchObject({ x: 1000, y: 1000 });

    player.heading = 384;
    for (let count = 0; count < 480; count += 1) {
      step(world, Command.Forward);
      northbound.push(chaser.turn);
      nearest = Math.min(nearest, distanceBetween(chaser, player));

      expect(Math.abs(offsetTo(chaser, player))).toBeLessThan(BAND + 1);
    }

    expect(player.x).toBe(1000);
    expectClose(player.y, 440);
    expect(northbound.filter((turn) => turn === 1)).toEqual([]);
    expect(northbound.filter((turn) => turn === -1).length).toBeGreaterThan(10);
    expect(wrapped(chaser.heading - headingWhenThePlayerTurnsBack)).toBe(
      -TURN_PER_STEP * northbound.filter((turn) => turn === -1).length,
    );
    expect(wrapped(chaser.heading - headingWhenThePlayerTurnsBack)).toBeLessThan(-60);
    expect(chaser.y).toBeLessThan(yWhenThePlayerTurnsBack);
    expect(chaser).toMatchObject({ active: true, thrust: 1 });
    expect(nearest).toBeGreaterThan(CONTACT_DISTANCE + 100);
  });

  test('EN-01 a Chaser that faces a still player holds its heading from one step to the next', () => {
    const sightings = [
      { heading: 0, steps: 200 },
      { heading: 2, steps: 140 },
      { heading: 510, steps: 140 },
      { heading: 3, steps: 70 },
      { heading: 509, steps: 70 },
    ];

    for (const { heading, steps } of sightings) {
      const world = createMatch(buildConfig(), SEED);
      const chaser = chaserAt(world, 400, 1000, heading);
      const angle = heading * RADIANS_PER_HEADING_UNIT;

      expect(Math.abs(offsetTo(chaser, world.player))).toBeLessThan(BAND);

      for (let count = 0; count < steps; count += 1) {
        step(world, 0);

        expect(chaser).toMatchObject({ active: true, thrust: 1, turn: 0, heading });
      }
      expectClose(chaser.x, 400 + steps * STRIDE * Math.cos(angle));
      expectClose(chaser.y, 1000 + steps * STRIDE * Math.sin(angle));
    }

    const world = createMatch(buildConfig(), SEED);
    const chaser = chaserAt(world, 400, 1000, 2);
    const turns: number[] = [];
    const headings: number[] = [];
    for (let count = 0; count < 250; count += 1) {
      step(world, 0);
      turns.push(chaser.turn);
      headings.push(chaser.heading);
    }

    expect(turns.filter((turn) => turn === 1)).toEqual([]);
    expect(turns.filter((turn) => turn === -1)).toEqual([-1]);
    expect(new Set(headings)).toEqual(new Set([2, 510]));
    expect(distanceBetween(chaser, world.player)).toBeGreaterThan(CONTACT_DISTANCE + 50);
  });

  test('EN-05 a Chaser turns no faster than its turn rate and moves no faster than its speed', () => {
    const sluggish = buildConfig();
    sluggish.enemies.chaser.speed = 60;
    sluggish.enemies.chaser.turnRateDegrees = 112.5;
    const rigs = [
      { config: buildConfig(), turnPerStep: 4, stride: 2 },
      { config: sluggish, turnPerStep: 8 / 3, stride: 1 },
    ];
    const starts = [
      { y: 1000, side: 1 },
      { y: 1010, side: -1 },
    ];

    for (const { config, turnPerStep, stride } of rigs) {
      for (const { y, side } of starts) {
        const world = createMatch(config, SEED);
        const chaser = chaserAt(world, 1600, y, 0);
        const stepsOfHalfACircle = HALF_TURN / turnPerStep;
        let travelled = 0;

        expect(Math.abs(offsetTo(chaser, world.player))).toBeGreaterThan(HALF_TURN - 2);

        for (let count = 1; count <= stepsOfHalfACircle; count += 1) {
          const from = course(chaser);

          step(world, 0);

          const swing = wrapped(chaser.heading - from.heading);
          const moved = distanceBetween(from, chaser);
          travelled += moved;

          expect(chaser).toMatchObject({ thrust: 1, turn: side });
          expect(Math.abs(swing)).toBeLessThanOrEqual(turnPerStep + TOLERANCE);
          expectClose(swing, side * turnPerStep);
          expect(moved).toBeLessThanOrEqual(stride + TOLERANCE);
          expectClose(moved, stride);
          expectClose(wrapped(chaser.heading - side * count * turnPerStep), 0);
        }

        expectClose(Math.abs(wrapped(chaser.heading)), HALF_TURN);
        expectClose(travelled, stepsOfHalfACircle * stride);
        expect(distanceBetween(chaser, world.player)).toBeGreaterThan(CONTACT_DISTANCE + 100);
      }
    }
  });

  test("EN-01 the Chaser's rule gives no intent to the player, to a ship of no kind or to an inactive slot", () => {
    const world = createMatch(buildConfig(), SEED);
    const { player } = world;
    const chaser = chaserAt(world, 1000, 400, 0);
    const adrift = placeEnemy(world, { x: 400, y: 1000, heading: 128, speed: 120, turnRate: 240 });
    const underOrders = placeEnemy(world, {
      x: 1600,
      y: 400,
      heading: 0,
      speed: 120,
      turnRate: 240,
      thrust: 1,
      turn: -1,
    });
    const laidUp = shipAt(world, 9);
    Object.assign(laidUp, {
      layer: Layer.Enemy,
      kind: ShipKind.Chaser,
      x: 400,
      y: 400,
      previousX: 400,
      previousY: 400,
      heading: 384,
      radius: 20,
      speed: 120,
      turnRate: 240,
      health: 30,
      maxHealth: 30,
      contactDamage: 25,
    });

    expect(adrift.kind).toBeNull();
    expect(underOrders.kind).toBeNull();
    expect(Math.sign(offsetTo(adrift, player))).toBe(-1);
    expect(Math.sign(offsetTo(underOrders, player))).toBe(1);
    expect(Math.sign(offsetTo(laidUp, player))).toBe(1);
    expect(activeShipSlots(world)).toEqual([0, 1, 2, 3]);

    for (let count = 1; count <= 20; count += 1) {
      step(world, 0);

      expect(course(player)).toEqual({ x: 1000, y: 1000, heading: 0, thrust: 0, turn: 0 });
      expect(course(adrift)).toEqual({ x: 400, y: 1000, heading: 128, thrust: 0, turn: 0 });
      expect(course(laidUp)).toEqual({ x: 400, y: 400, heading: 384, thrust: 0, turn: 0 });
      expect(underOrders).toMatchObject({ thrust: 1, turn: -1 });
      expect(underOrders.heading).toBe(UNITS_PER_TURN - count * TURN_PER_STEP);
      expect(chaser).toMatchObject({ thrust: 1, turn: 1, heading: count * TURN_PER_STEP });
    }
    expect(laidUp.active).toBe(false);
    expect(chaser.x).toBeGreaterThan(1000 + 30);
    expect(underOrders.y).toBeLessThan(400 - 5);

    step(world, Command.TurnLeft);

    expect(player).toMatchObject({ x: 1000, y: 1000, thrust: 0, turn: -1 });

    step(world, Command.Forward | Command.TurnRight);

    expect(player).toMatchObject({ thrust: 1, turn: 1 });
    expect(course(adrift)).toEqual({ x: 400, y: 1000, heading: 128, thrust: 0, turn: 0 });
    expect(course(laidUp)).toEqual({ x: 400, y: 400, heading: 384, thrust: 0, turn: 0 });
    expect(activeShipSlots(world)).toEqual([0, 1, 2, 3]);
  });
});
