import { describe, expect, test } from 'vitest';
import type { GameConfig } from '../../../config/gameConfig';
import { Command } from '../../commands';
import { createMatch } from '../../createMatch';
import { acquire } from '../../pool';
import { step } from '../../step';
import { STEPS_PER_SECOND } from '../../stepRate';
import type { Ship, World } from '../../world';

const SEED = 20261007;
const SINE_TABLE_ERROR = 1e-12;
const ULP_BELOW_2048 = 2 ** -42;
const COURSE_BACK_FROM_THE_EDGE = 140;
const ACCUMULATED_ERROR =
  COURSE_BACK_FROM_THE_EDGE * SINE_TABLE_ERROR + STEPS_PER_SECOND * ULP_BELOW_2048;

function buildConfig() {
  return {
    arena: { width: 960, height: 540, islands: [] },
    player: { radius: 24, speed: 140, turnRateDegrees: 90 },
  } satisfies GameConfig;
}

function hold(world: World, commands: number, steps: number): void {
  for (let count = 0; count < steps; count += 1) {
    step(world, commands);
  }
}

function holdInsideTheArena(world: World, commands: number, steps: number): void {
  const { arena } = world.config;
  const { player } = world;

  for (let count = 0; count < steps; count += 1) {
    step(world, commands);

    expect(player.x - player.radius).toBeGreaterThanOrEqual(0);
    expect(player.x + player.radius).toBeLessThanOrEqual(arena.width);
    expect(player.y - player.radius).toBeGreaterThanOrEqual(0);
    expect(player.y + player.radius).toBeLessThanOrEqual(arena.height);
  }
}

function launch(world: World, course: Partial<Ship>): Ship {
  const ship = acquire(world.ships);
  if (ship === null) {
    throw new Error('The ship pool has no free slot');
  }
  return Object.assign(ship, course);
}

function expectClose(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThan(ACCUMULATED_ERROR);
}

describe('arena bounds (ADR-0007)', () => {
  test('PL-05 the player stops with its hull inside the arena at each of the four edges', () => {
    const edges = [
      { quarterTurnsRight: 0, x: 960 - 24, y: 270, xSailedBack: 960 - 24 - 140, ySailedBack: 270 },
      { quarterTurnsRight: 1, x: 480, y: 540 - 24, xSailedBack: 480, ySailedBack: 540 - 24 - 140 },
      { quarterTurnsRight: 2, x: 24, y: 270, xSailedBack: 24 + 140, ySailedBack: 270 },
      { quarterTurnsRight: 3, x: 480, y: 24, xSailedBack: 480, ySailedBack: 24 + 140 },
    ];

    for (const edge of edges) {
      const world = createMatch(buildConfig(), SEED);

      hold(world, Command.TurnRight, edge.quarterTurnsRight * STEPS_PER_SECOND);
      hold(world, Command.Forward, 5 * STEPS_PER_SECOND);

      expect(world.player).toMatchObject({ x: edge.x, y: edge.y });

      hold(world, Command.Forward, STEPS_PER_SECOND);

      expect(world.player).toMatchObject({ x: edge.x, y: edge.y });

      hold(world, Command.TurnRight, 2 * STEPS_PER_SECOND);
      hold(world, Command.Forward, STEPS_PER_SECOND);

      expectClose(world.player.x, edge.xSailedBack);
      expectClose(world.player.y, edge.ySailedBack);
    }
  });

  test('PL-05 the player never leaves the arena when driven into a corner', () => {
    const corners = [
      { eighthTurnsRight: 1, x: 960 - 24, y: 540 - 24 },
      { eighthTurnsRight: 3, x: 24, y: 540 - 24 },
      { eighthTurnsRight: 5, x: 24, y: 24 },
      { eighthTurnsRight: 7, x: 960 - 24, y: 24 },
    ];
    const circlingInTheCorner = [
      Command.Forward | Command.TurnRight,
      Command.Forward | Command.TurnLeft,
    ];

    for (const corner of corners) {
      const world = createMatch(buildConfig(), SEED);
      hold(world, Command.TurnRight, corner.eighthTurnsRight * (STEPS_PER_SECOND / 2));

      holdInsideTheArena(world, Command.Forward, 8 * STEPS_PER_SECOND);

      expect(world.player).toMatchObject({ x: corner.x, y: corner.y });

      for (const commands of circlingInTheCorner) {
        holdInsideTheArena(world, commands, 4 * STEPS_PER_SECOND);
      }
    }
  });

  test('PL-05 every active ship is held inside the arena by its own radius, and an inactive slot is left where it is', () => {
    const world = createMatch(buildConfig(), SEED);
    const brig = launch(world, { x: 300, y: 100, heading: 256, radius: 40, speed: 200, thrust: 1 });
    const sloop = launch(world, { x: 700, y: 400, heading: 128, radius: 8, speed: 200, thrust: 1 });
    const wreck = launch(world, { x: -40, y: 600, radius: 10 });
    wreck.active = false;

    hold(world, Command.Forward, 4 * STEPS_PER_SECOND);

    expect(world.player).toMatchObject({ x: 960 - 24, y: 270 });
    expect(brig).toMatchObject({ x: 40, y: 100 });
    expect(sloop).toMatchObject({ x: 700, y: 540 - 8 });
    expect(wreck).toMatchObject({ active: false, x: -40, y: 600 });
  });

  test('SC-10 the edges follow the configured arena size and player radius', () => {
    const layouts = [
      { width: 400, height: 300, radius: 10 },
      { width: 1280, height: 720, radius: 40 },
      { width: 960, height: 540, radius: 60 },
    ];

    for (const layout of layouts) {
      const edges = [
        { quarterTurnsRight: 0, x: layout.width - layout.radius, y: layout.height / 2 },
        { quarterTurnsRight: 1, x: layout.width / 2, y: layout.height - layout.radius },
        { quarterTurnsRight: 2, x: layout.radius, y: layout.height / 2 },
        { quarterTurnsRight: 3, x: layout.width / 2, y: layout.radius },
      ];

      for (const edge of edges) {
        const config = buildConfig();
        config.arena.width = layout.width;
        config.arena.height = layout.height;
        config.player.radius = layout.radius;
        const world = createMatch(config, SEED);

        hold(world, Command.TurnRight, edge.quarterTurnsRight * STEPS_PER_SECOND);
        hold(world, Command.Forward, 6 * STEPS_PER_SECOND);

        expect(world.player).toMatchObject({ x: edge.x, y: edge.y });
      }
    }
  });
});
