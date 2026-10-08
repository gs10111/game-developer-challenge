import { describe, expect, test } from 'vitest';
import { Command } from '../commands';
import { createMatch } from '../createMatch';
import { acquire } from '../pool';
import { step } from '../step';
import { STEPS_PER_SECOND } from '../stepRate';
import { testConfig } from '../testing/testConfig';
import type { Ship, World } from '../world';

const SEED = 20261007;

const MOVES = [
  { commands: 0, intents: { thrust: 0, turn: 0 } },
  { commands: Command.Forward, intents: { thrust: 1, turn: 0 } },
  { commands: Command.TurnLeft, intents: { thrust: 0, turn: -1 } },
  { commands: Command.TurnRight, intents: { thrust: 0, turn: 1 } },
  { commands: Command.Forward | Command.TurnLeft, intents: { thrust: 1, turn: -1 } },
  { commands: Command.Forward | Command.TurnRight, intents: { thrust: 1, turn: 1 } },
  { commands: Command.TurnLeft | Command.TurnRight, intents: { thrust: 0, turn: 0 } },
  {
    commands: Command.Forward | Command.TurnLeft | Command.TurnRight,
    intents: { thrust: 1, turn: 0 },
  },
];

const SHOTS = [
  { commands: 0, intents: { fireFront: 0, fireLeft: 0, fireRight: 0 } },
  { commands: Command.FireFront, intents: { fireFront: 1, fireLeft: 0, fireRight: 0 } },
  { commands: Command.FireLeft, intents: { fireFront: 0, fireLeft: 1, fireRight: 0 } },
  { commands: Command.FireRight, intents: { fireFront: 0, fireLeft: 0, fireRight: 1 } },
  {
    commands: Command.FireFront | Command.FireLeft,
    intents: { fireFront: 1, fireLeft: 1, fireRight: 0 },
  },
  {
    commands: Command.FireFront | Command.FireRight,
    intents: { fireFront: 1, fireLeft: 0, fireRight: 1 },
  },
  {
    commands: Command.FireLeft | Command.FireRight,
    intents: { fireFront: 0, fireLeft: 1, fireRight: 1 },
  },
  {
    commands: Command.FireFront | Command.FireLeft | Command.FireRight,
    intents: { fireFront: 1, fireLeft: 1, fireRight: 1 },
  },
];

function buildConfig() {
  return testConfig({ width: 960, height: 540, islands: [] });
}

function launch(world: World, course: Partial<Ship>): Ship {
  const ship = acquire(world.ships);
  if (ship === null) {
    throw new Error('The ship pool has no free slot');
  }
  return Object.assign(ship, course);
}

function fireIntents({ fireFront, fireLeft, fireRight }: Ship) {
  return { fireFront, fireLeft, fireRight };
}

describe('player intent (ADR-0005, ADR-0006)', () => {
  test("PL-09 the fire commands set the player's fire intents and leave its thrust and turn as the other commands set them", () => {
    for (const move of MOVES) {
      const holdingFire = createMatch(buildConfig(), SEED);
      step(holdingFire, move.commands);
      const { x, y, heading } = holdingFire.player;

      for (const shot of SHOTS) {
        const world = createMatch(buildConfig(), SEED);
        const escort = launch(world, { x: 300, y: 100, fireLeft: 1 });

        step(world, move.commands | shot.commands);

        expect(world.player).toMatchObject({ ...shot.intents, ...move.intents, x, y, heading });
        expect(fireIntents(escort)).toEqual({ fireFront: 0, fireLeft: 1, fireRight: 0 });
      }
    }
  });

  test('PL-09 a fire intent lasts only while its command is held', () => {
    const world = createMatch(buildConfig(), SEED);
    const { player } = world;

    step(world, Command.Forward | Command.FireFront);
    expect(fireIntents(player)).toEqual({ fireFront: 1, fireLeft: 0, fireRight: 0 });

    step(world, Command.Forward);
    expect(fireIntents(player)).toEqual({ fireFront: 0, fireLeft: 0, fireRight: 0 });

    step(world, Command.FireLeft | Command.FireRight);
    expect(fireIntents(player)).toEqual({ fireFront: 0, fireLeft: 1, fireRight: 1 });

    step(world, Command.FireRight);
    expect(fireIntents(player)).toEqual({ fireFront: 0, fireLeft: 0, fireRight: 1 });

    step(world, Command.TurnLeft);
    expect(fireIntents(player)).toEqual({ fireFront: 0, fireLeft: 0, fireRight: 0 });

    for (let count = 0; count < 2 * STEPS_PER_SECOND; count += 1) {
      step(world, Command.FireFront | Command.FireLeft);
      expect(fireIntents(player)).toEqual({ fireFront: 1, fireLeft: 1, fireRight: 0 });
    }

    step(world, 0);
    expect(fireIntents(player)).toEqual({ fireFront: 0, fireLeft: 0, fireRight: 0 });
  });
});
