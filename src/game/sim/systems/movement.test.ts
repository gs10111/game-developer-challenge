import { describe, expect, test } from 'vitest';
import type { GameConfig } from '../../config/gameConfig';
import { Command } from '../commands';
import { createMatch } from '../createMatch';
import { acquire } from '../pool';
import { step } from '../step';
import { STEPS_PER_SECOND } from '../stepRate';
import { testPlayer } from '../testing/testPlayer';
import type { Ship, World } from '../world';

const SEED = 20261007;
const RADIANS_PER_HEADING_UNIT = (2 * Math.PI) / 512;
const DEGREES_PER_HEADING_UNIT = 360 / 512;
const SINE_TABLE_ERROR = 1e-12;
const ULP_BELOW_2048 = 2 ** -42;
const LONGEST_COURSE = 280;
const LONGEST_HOLD = 4 * STEPS_PER_SECOND;
const ACCUMULATED_ERROR = LONGEST_COURSE * SINE_TABLE_ERROR + LONGEST_HOLD * ULP_BELOW_2048;

function buildConfig() {
  return {
    arena: { width: 960, height: 540, islands: [] },
    player: testPlayer(),
  } satisfies GameConfig;
}

function hold(world: World, commands: number, steps: number): void {
  for (let count = 0; count < steps; count += 1) {
    step(world, commands);
  }
}

function launch(world: World, course: Partial<Ship>): Ship {
  const ship = acquire(world.ships);
  if (ship === null) {
    throw new Error('The ship pool has no free slot');
  }
  return Object.assign(ship, course);
}

function headingInDegrees(world: World): number {
  return world.player.heading * DEGREES_PER_HEADING_UNIT;
}

function expectClose(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThan(ACCUMULATED_ERROR);
}

describe('player movement (ADR-0005, ADR-0006)', () => {
  test('PL-01 holding forward for one second moves the player along its heading by the configured speed', () => {
    const firstStep = createMatch(buildConfig(), SEED);

    step(firstStep, Command.Forward);

    expectClose(firstStep.player.x, 480 + 140 / STEPS_PER_SECOND);
    expect(firstStep.player.y).toBe(270);

    for (const heading of [0, 64, 128, 200, 256, 320, 384, 448, 505]) {
      const angle = heading * RADIANS_PER_HEADING_UNIT;
      const world = createMatch(buildConfig(), SEED);
      world.player.heading = heading;

      hold(world, Command.Forward, STEPS_PER_SECOND);

      expectClose(world.player.x, 480 + 140 * Math.cos(angle));
      expectClose(world.player.y, 270 + 140 * Math.sin(angle));
      expect(world.player.heading).toBe(heading);
    }
  });

  test('PL-01 the player does not move without the forward command', () => {
    const everyCommandButForward =
      Command.TurnRight | Command.FireFront | Command.FireLeft | Command.FireRight;
    const idle = createMatch(buildConfig(), SEED);
    const busy = createMatch(buildConfig(), SEED);
    const released = createMatch(buildConfig(), SEED);

    hold(idle, 0, STEPS_PER_SECOND);
    hold(busy, everyCommandButForward, STEPS_PER_SECOND);
    hold(released, Command.Forward, STEPS_PER_SECOND / 2);
    const xAtRelease = released.player.x;
    hold(released, 0, STEPS_PER_SECOND);

    expect(idle.player).toMatchObject({ x: 480, y: 270, heading: 0, thrust: 0 });
    expect(busy.player).toMatchObject({ x: 480, y: 270, thrust: 0 });
    expectClose(xAtRelease, 480 + 140 / 2);
    expect(released.player).toMatchObject({ x: xAtRelease, y: 270, thrust: 0 });
  });

  test('PL-01 turning right for a quarter turn and then moving forward travels toward +y, and turning left travels toward -y', () => {
    const quarterTurnPerSecond = buildConfig();
    quarterTurnPerSecond.player.turnRateDegrees = 90;
    const clockwise = createMatch(quarterTurnPerSecond, SEED);
    const anticlockwise = createMatch(quarterTurnPerSecond, SEED);

    hold(clockwise, Command.TurnRight, STEPS_PER_SECOND);
    hold(clockwise, Command.Forward, STEPS_PER_SECOND);
    hold(anticlockwise, Command.TurnLeft, STEPS_PER_SECOND);
    hold(anticlockwise, Command.Forward, STEPS_PER_SECOND);

    expect(clockwise.player.x).toBe(480);
    expectClose(clockwise.player.y, 270 + 140);
    expect(anticlockwise.player.x).toBe(480);
    expectClose(anticlockwise.player.y, 270 - 140);
  });

  test('PL-01 turning rotates the player at the configured turn rate', () => {
    const clockwise = createMatch(buildConfig(), SEED);
    const anticlockwise = createMatch(buildConfig(), SEED);
    const underWay = createMatch(buildConfig(), SEED);

    hold(clockwise, Command.TurnRight, STEPS_PER_SECOND / 2);
    const degreesAfterHalfASecond = headingInDegrees(clockwise);
    hold(clockwise, Command.TurnRight, STEPS_PER_SECOND / 2);
    hold(anticlockwise, Command.TurnLeft, STEPS_PER_SECOND);
    hold(underWay, Command.TurnRight | Command.Forward, STEPS_PER_SECOND);

    expectClose(degreesAfterHalfASecond, 75);
    expectClose(headingInDegrees(clockwise), 150);
    expectClose(headingInDegrees(anticlockwise), 360 - 150);
    expect(clockwise.player).toMatchObject({ x: 480, y: 270 });
    expect(anticlockwise.player).toMatchObject({ x: 480, y: 270 });
    expect(underWay.player.heading).toBe(clockwise.player.heading);
    expect(underWay.player.x).not.toBe(480);
    expect(underWay.player.y).not.toBe(270);
  });

  test('PL-01 left and right together cancel out', () => {
    const bothTurns = Command.TurnLeft | Command.TurnRight;
    const fromRest = createMatch(buildConfig(), SEED);
    const midTurn = createMatch(buildConfig(), SEED);

    hold(fromRest, bothTurns, STEPS_PER_SECOND);

    expect(fromRest.player).toMatchObject({ x: 480, y: 270, heading: 0, turn: 0 });

    hold(fromRest, bothTurns | Command.Forward, STEPS_PER_SECOND);

    expectClose(fromRest.player.x, 480 + 140);
    expect(fromRest.player).toMatchObject({ y: 270, heading: 0, turn: 0 });

    hold(midTurn, Command.TurnLeft, STEPS_PER_SECOND / 4);
    const headingBeforeBothTurns = midTurn.player.heading;
    hold(midTurn, bothTurns, STEPS_PER_SECOND);

    expect(headingBeforeBothTurns).not.toBe(0);
    expect(midTurn.player).toMatchObject({ heading: headingBeforeBothTurns, turn: 0 });
  });

  test('PL-01 turning left from heading zero and moving forward still travels at the configured speed', () => {
    const world = createMatch(buildConfig(), SEED);
    let travelled = 0;

    for (let count = 0; count < STEPS_PER_SECOND; count += 1) {
      const fromX = world.player.x;
      const fromY = world.player.y;

      step(world, Command.TurnLeft | Command.Forward);

      const strideX = world.player.x - fromX;
      const strideY = world.player.y - fromY;
      const tableAngle = Math.round(world.player.heading) * RADIANS_PER_HEADING_UNIT;
      travelled += Math.hypot(strideX, strideY);

      expect(world.player.heading).toBeGreaterThanOrEqual(0);
      expect(world.player.heading).toBeLessThan(512);
      expectClose(strideX, (140 / STEPS_PER_SECOND) * Math.cos(tableAngle));
      expectClose(strideY, (140 / STEPS_PER_SECOND) * Math.sin(tableAngle));
      expect(strideY).toBeLessThan(0);
    }

    expectClose(travelled, 140);
    expectClose(headingInDegrees(world), 360 - 150);
  });

  test('PL-01 a full turn brings the player back to its starting direction', () => {
    const quarterTurnPerSecond = buildConfig();
    quarterTurnPerSecond.player.turnRateDegrees = 90;
    const neverTurned = createMatch(quarterTurnPerSecond, SEED);
    hold(neverTurned, Command.Forward, STEPS_PER_SECOND);

    for (const turn of [Command.TurnRight, Command.TurnLeft]) {
      const world = createMatch(quarterTurnPerSecond, SEED);

      hold(world, turn, 2 * STEPS_PER_SECOND);
      const degreesAtHalfTurn = headingInDegrees(world);
      hold(world, turn, 2 * STEPS_PER_SECOND);
      const degreesAtFullTurn = headingInDegrees(world);
      hold(world, Command.Forward, STEPS_PER_SECOND);

      expectClose(degreesAtHalfTurn, 180);
      expect(degreesAtFullTurn).toBeGreaterThanOrEqual(0);
      expect(degreesAtFullTurn).toBeLessThan(360);
      expectClose(Math.min(degreesAtFullTurn, 360 - degreesAtFullTurn), 0);
      expect(world.player).toMatchObject({ x: neverTurned.player.x, y: 270 });
    }
  });

  test('PL-01 every active ship moves by the speed and turn rate stamped on it, and an inactive slot stays still', () => {
    const world = createMatch(buildConfig(), SEED);
    const cruiser = launch(world, { x: 300, y: 100, heading: 256, speed: 50, thrust: 1 });
    const spinner = launch(world, { x: 700, y: 400, turnRate: 64, turn: -1 });
    const wreck = launch(world, { x: 200, y: 450, speed: 50, turnRate: 64, thrust: 1, turn: 1 });
    wreck.active = false;

    hold(world, Command.Forward, STEPS_PER_SECOND);

    expectClose(world.player.x, 480 + 140);
    expect(world.player).toMatchObject({ y: 270, heading: 0 });
    expectClose(cruiser.x, 300 - 50);
    expect(cruiser).toMatchObject({ y: 100, heading: 256, thrust: 1, turn: 0 });
    expectClose(spinner.heading, 512 - 64);
    expect(spinner).toMatchObject({ x: 700, y: 400, thrust: 0, turn: -1 });
    expect(wreck).toMatchObject({ active: false, x: 200, y: 450, heading: 0, thrust: 1, turn: 1 });
  });

  test('PL-06 movement records where each active ship was before it moved', () => {
    const world = createMatch(buildConfig(), SEED);
    const { player } = world;
    const cruiser = launch(world, { x: 300, y: 100, heading: 256, speed: 50, thrust: 1 });
    const aground = launch(world, { x: 950, y: 400, radius: 10, speed: 90, thrust: 1 });
    const anchored = launch(world, { x: 700, y: 400, turnRate: 64, turn: -1 });
    const wreck = launch(world, { x: 200, y: 450, speed: 50, thrust: 1 });
    wreck.active = false;
    wreck.previousX = 11;
    wreck.previousY = 22;
    const underWay = [player, cruiser, aground, anchored];

    for (let count = 0; count < 2 * STEPS_PER_SECOND; count += 1) {
      const departures = underWay.map(({ x, y }) => ({ previousX: x, previousY: y }));

      step(world, Command.Forward | Command.TurnRight);

      const recorded = underWay.map(({ previousX, previousY }) => ({ previousX, previousY }));
      const stride = Math.hypot(player.x - player.previousX, player.y - player.previousY);

      expect(recorded).toEqual(departures);
      expectClose(stride, 140 / STEPS_PER_SECOND);
      expectClose(cruiser.previousX - cruiser.x, 50 / STEPS_PER_SECOND);
      expect(aground).toMatchObject({ x: 950, previousX: 950 });
      expect(anchored).toMatchObject({ x: 700, y: 400, previousX: 700, previousY: 400 });
      expect(wreck).toMatchObject({ x: 200, y: 450, previousX: 11, previousY: 22 });
    }

    expect(new Set(underWay.map(({ previousX }) => previousX)).size).toBe(underWay.length);
    expect(player.previousY).not.toBe(270);
  });

  test('SC-10 doubling the configured speed doubles the distance travelled', () => {
    for (const speed of [140, 90, 37.5]) {
      const single = buildConfig();
      single.player.speed = speed;
      const double = buildConfig();
      double.player.speed = 2 * speed;
      const slower = createMatch(single, SEED);
      const faster = createMatch(double, SEED);

      hold(slower, Command.Forward, STEPS_PER_SECOND);
      hold(faster, Command.Forward, STEPS_PER_SECOND);
      const slowerDistance = slower.player.x - 480;
      const fasterDistance = faster.player.x - 480;

      expectClose(slowerDistance, speed);
      expectClose(fasterDistance, 2 * speed);
      expectClose(fasterDistance, 2 * slowerDistance);
      expect(slower.player.y).toBe(270);
      expect(faster.player.y).toBe(270);
    }
  });

  test('SC-10 the configured turn rate sets how far the player turns in one second', () => {
    for (const degreesPerSecond of [45, 90, 150, 200]) {
      const config = buildConfig();
      config.player.turnRateDegrees = degreesPerSecond;
      const clockwise = createMatch(config, SEED);
      const anticlockwise = createMatch(config, SEED);

      hold(clockwise, Command.TurnRight, STEPS_PER_SECOND);
      hold(anticlockwise, Command.TurnLeft, STEPS_PER_SECOND);

      expectClose(headingInDegrees(clockwise), degreesPerSecond);
      expectClose(headingInDegrees(anticlockwise), 360 - degreesPerSecond);
    }
  });
});
