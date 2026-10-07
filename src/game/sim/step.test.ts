import { describe, expect, test } from 'vitest';
import type { GameConfig, Point } from '../config/gameConfig';
import { Command } from './commands';
import { createMatch } from './createMatch';
import { acquire } from './pool';
import { step } from './step';
import type { Ship, World } from './world';

const SEED = 20261007;
const STEPS_OF_THE_LONGEST_MATCH = 10800;

const SCRIPT: readonly (readonly [commands: number, steps: number])[] = [
  [Command.Forward, 60],
  [Command.Forward | Command.TurnRight, 36],
  [Command.Forward | Command.FireFront, 150],
  [Command.TurnLeft, 18],
  [Command.Forward | Command.FireLeft | Command.FireRight, 300],
  [Command.Forward | Command.TurnLeft, 90],
  [Command.Forward | Command.TurnLeft | Command.TurnRight, 45],
  [0, 10],
  [Command.TurnRight | Command.FireRight, 25],
  [Command.Forward, 40],
];

interface Fleet {
  world: World;
  escort: Ship;
  wreck: Ship;
}

interface Sighting {
  player: Ship;
  escort: Ship;
}

function rectangle(left: number, top: number, right: number, bottom: number): Point[] {
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

function buildConfig() {
  return {
    arena: {
      width: 960,
      height: 540,
      islands: [
        rectangle(600, 200, 700, 340),
        rectangle(740, 380, 830, 440),
        [
          { x: 100, y: 40 },
          { x: 200, y: 140 },
          { x: 100, y: 140 },
        ],
      ],
    },
    player: { radius: 24, speed: 140, turnRateDegrees: 150 },
  } satisfies GameConfig;
}

function commandLog(): number[] {
  return SCRIPT.flatMap(([commands, steps]) => Array.from({ length: steps }, () => commands));
}

function launch(world: World, course: Partial<Ship>): Ship {
  const ship = acquire(world.ships);
  if (ship === null) {
    throw new Error('The ship pool has no free slot');
  }
  Object.assign(ship, course);
  ship.previousX = ship.x;
  ship.previousY = ship.y;
  return ship;
}

function createFleet(): Fleet {
  const world = createMatch(buildConfig(), SEED);
  const escort = launch(world, { x: 300, y: 100, heading: 256, radius: 30, speed: 50, thrust: 1 });
  const wreck = launch(world, { x: -40, y: 200, radius: 10, speed: 50, thrust: 1 });
  wreck.active = false;
  return { world, escort, wreck };
}

function sight(fleet: Fleet): Sighting {
  return { player: { ...fleet.world.player }, escort: { ...fleet.escort } };
}

describe('simulation step (ADR-0005, ADR-0006)', () => {
  test('PW-03 each step advances the step counter by one', () => {
    const world = createMatch(buildConfig(), SEED);
    const masks = [
      0,
      Command.Forward,
      Command.TurnLeft | Command.FireFront,
      Command.Forward | Command.TurnRight | Command.FireLeft | Command.FireRight,
      0,
    ];

    expect(world.step).toBe(0);
    for (const [index, commands] of masks.entries()) {
      step(world, commands);

      expect(world.step).toBe(index + 1);
      expect(world.commands).toBe(commands);
    }

    for (let count = masks.length; count < STEPS_OF_THE_LONGEST_MATCH; count += 1) {
      step(world, Command.Forward | Command.TurnRight);
    }

    expect(world.step).toBe(STEPS_OF_THE_LONGEST_MATCH);
    expect(world.seed).toBe(SEED);
  });

  test('PW-03 replaying the same seed and command log reproduces the whole world', () => {
    const log = commandLog();
    const original = createFleet();
    const wake = log.map((commands) => {
      step(original.world, commands);
      return sight(original);
    });

    const replayed = createFleet();
    const decoy = createFleet();
    const replayedWake = log.map((commands, index) => {
      step(decoy.world, log.at(-1 - index) ?? 0);
      step(replayed.world, commands);
      return sight(replayed);
    });

    const alongsideTheQuay = wake.filter(
      ({ player }) => player.x === 600 - 24 && player.y > 200 && player.y < 340,
    );
    const alongsideTheCay = wake.filter(
      ({ player }) => player.x === 830 + 24 && player.y > 380 && player.y < 440,
    );
    const roundingTheCay = wake.filter(
      ({ player }) =>
        player.x > 830 &&
        player.y < 380 &&
        Math.abs(Math.hypot(player.x - 830, player.y - 380) - 24) < 1e-9,
    );
    const escortUpTheReef = wake.filter(
      ({ escort }) => escort.x < escort.previousX && escort.y < escort.previousY,
    );
    const escortWedged = wake.filter(
      ({ escort }) => escort.x === original.escort.x && escort.y === original.escort.y,
    );

    expect(original.world.step).toBe(log.length);
    expect(new Set(wake.map(({ player }) => player.heading)).size).toBeGreaterThan(100);
    expect(wake.some(({ player }) => player.y === 540 - 24)).toBe(true);
    expect(wake.some(({ player }) => player.x === 960 - 24)).toBe(true);
    expect(alongsideTheQuay.length).toBeGreaterThan(40);
    expect(new Set(alongsideTheQuay.map(({ player }) => player.y)).size).toBeGreaterThan(20);
    expect(alongsideTheCay.length).toBeGreaterThan(40);
    expect(roundingTheCay.length).toBeGreaterThan(3);
    expect(escortUpTheReef.length).toBeGreaterThan(100);
    expect(escortWedged.length).toBeGreaterThan(400);
    expect(original.escort).toMatchObject({ active: true, heading: 256, thrust: 1, turn: 0 });
    expect(original.escort.x).toBeGreaterThan(100 + 30);
    expect(original.escort.x).toBeLessThan(140);
    expect(original.escort.y).toBeGreaterThanOrEqual(30);
    expect(original.escort.y).toBeLessThan(31);
    expect(original.wreck).toMatchObject({ active: false, x: -40, y: 200, thrust: 1 });

    expect(replayedWake).toEqual(wake);
    expect(replayed.world).toStrictEqual(original.world);
    expect(replayed.world).not.toBe(original.world);
    expect(decoy.world).not.toEqual(original.world);
  });
});
