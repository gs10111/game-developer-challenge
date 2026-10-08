import { describe, expect, test } from 'vitest';
import { Command } from '../sim/commands';
import { createMatch } from '../sim/createMatch';
import { step } from '../sim/step';
import { STEPS_PER_SECOND } from '../sim/stepRate';
import { testConfig } from '../sim/testing/testConfig';
import { advance, createFixedStepClock, interpolation, reset } from './fixedStepClock';
import type { FixedStepClock } from './fixedStepClock';

const SEED = 20261007;
const START_MS = 1000;
const FRAME_RATES = [30, 60, 144];
const TEN_SECONDS = 10;
const STEPS_IN_TEN_SECONDS = 600;
const SPEED = 40;
const TRAVEL_PER_STEP = SPEED / STEPS_PER_SECOND;
const ULP_BELOW_1024 = 2 ** -43;
const ROUNDING_OF_THE_COURSE = (STEPS_IN_TEN_SECONDS + 1) * ULP_BELOW_1024;
const FRACTION_DIGITS = 9;

function buildConfig() {
  const config = testConfig({ width: 960, height: 540, islands: [] });
  config.player.speed = SPEED;
  return config;
}

function frameTime(frame: number, framesPerSecond: number): number {
  return START_MS + (frame * 1000) / framesPerSecond;
}

function clockWithAFifthOfAStepLeft(): FixedStepClock {
  const clock = createFixedStepClock(START_MS);
  advance(clock, START_MS + 20);
  return clock;
}

describe('fixed-step clock (ADR-0004)', () => {
  test('AR-03 at 30, 60 and 144 frames per second the clock runs 600 steps in ten seconds, give or take one', () => {
    for (const framesPerSecond of FRAME_RATES) {
      const clock = createFixedStepClock(START_MS);
      let steps = 0;

      for (let frame = 1; frame <= framesPerSecond * TEN_SECONDS; frame += 1) {
        steps += advance(clock, frameTime(frame, framesPerSecond));
      }

      expect(Math.abs(steps - STEPS_IN_TEN_SECONDS)).toBeLessThanOrEqual(1);
    }
  });

  test('AR-03 at 30, 60 and 144 frames per second the player travels the configured speed times ten seconds, within one step', () => {
    for (const framesPerSecond of FRAME_RATES) {
      const world = createMatch(buildConfig(), SEED);
      const clock = createFixedStepClock(START_MS);

      for (let frame = 1; frame <= framesPerSecond * TEN_SECONDS; frame += 1) {
        const steps = advance(clock, frameTime(frame, framesPerSecond));
        for (let count = 0; count < steps; count += 1) {
          step(world, Command.Forward);
        }
      }

      const travelled = world.player.x - 480;
      expect(Math.abs(travelled - SPEED * TEN_SECONDS)).toBeLessThanOrEqual(
        TRAVEL_PER_STEP + ROUNDING_OF_THE_COURSE,
      );
      expect(world.player.y).toBe(270);
    }
  });

  test('AR-03 a long stall runs exactly five steps and drops the rest', () => {
    const stalled = createFixedStepClock(START_MS);
    const justUnderFiveSteps = createFixedStepClock(START_MS);
    const justOverFiveSteps = createFixedStepClock(START_MS);

    expect(advance(stalled, START_MS + 10_000)).toBe(5);
    expect(interpolation(stalled)).toBe(0);
    expect(advance(stalled, START_MS + 10_020)).toBe(1);
    expect(interpolation(stalled)).toBeCloseTo(0.2, FRACTION_DIGITS);

    expect(advance(justOverFiveSteps, START_MS + 90)).toBe(5);
    expect(interpolation(justOverFiveSteps)).toBe(0);

    expect(advance(justUnderFiveSteps, START_MS + 80)).toBe(4);
    expect(interpolation(justUnderFiveSteps)).toBeCloseTo(0.8, FRACTION_DIGITS);
    expect(advance(justUnderFiveSteps, START_MS + 160)).toBe(5);
    expect(interpolation(justUnderFiveSteps)).toBe(0);
  });

  test('AR-03 zero, negative and NaN frame times run no step and leave the clock usable', () => {
    const repeated = clockWithAFifthOfAStepLeft();
    const rewound = clockWithAFifthOfAStepLeft();
    const garbled = clockWithAFifthOfAStepLeft();
    const neverStarted = createFixedStepClock(Number.NaN);

    expect(advance(repeated, START_MS + 20)).toBe(0);
    expect(interpolation(repeated)).toBeCloseTo(0.2, FRACTION_DIGITS);
    expect(advance(repeated, START_MS + 40)).toBe(1);
    expect(interpolation(repeated)).toBeCloseTo(0.4, FRACTION_DIGITS);

    expect(advance(rewound, START_MS - 500)).toBe(0);
    expect(interpolation(rewound)).toBeCloseTo(0.2, FRACTION_DIGITS);
    expect(advance(rewound, START_MS - 480)).toBe(1);
    expect(interpolation(rewound)).toBeCloseTo(0.4, FRACTION_DIGITS);

    expect(advance(garbled, Number.NaN)).toBe(0);
    expect(advance(garbled, Number.NaN)).toBe(0);
    expect(interpolation(garbled)).toBeCloseTo(0.2, FRACTION_DIGITS);
    expect(advance(garbled, START_MS + 40)).toBe(1);
    expect(interpolation(garbled)).toBeCloseTo(0.4, FRACTION_DIGITS);

    expect(advance(neverStarted, START_MS)).toBe(0);
    expect(interpolation(neverStarted)).toBe(0);
    expect(advance(neverStarted, START_MS + 20)).toBe(1);
    expect(interpolation(neverStarted)).toBeCloseTo(0.2, FRACTION_DIGITS);
  });

  test('AR-03 interpolation reports the fraction of a step left in the accumulator', () => {
    const clock = createFixedStepClock(START_MS);
    const frames = [
      { atMs: 5, steps: 0, left: 0.3 },
      { atMs: 10, steps: 0, left: 0.6 },
      { atMs: 20, steps: 1, left: 0.2 },
      { atMs: 45, steps: 1, left: 0.7 },
      { atMs: 90, steps: 3, left: 0.4 },
    ];

    expect(interpolation(clock)).toBe(0);
    for (const frame of frames) {
      expect(advance(clock, START_MS + frame.atMs)).toBe(frame.steps);
      expect(interpolation(clock)).toBeCloseTo(frame.left, FRACTION_DIGITS);
    }
  });

  test('MT-12 after a ten second gap and a reset, the next frame runs one step', () => {
    const clock = createFixedStepClock(START_MS);

    expect(advance(clock, START_MS + 10)).toBe(0);
    expect(interpolation(clock)).toBeCloseTo(0.6, FRACTION_DIGITS);

    reset(clock, START_MS + 10_010);

    expect(interpolation(clock)).toBe(0);
    expect(advance(clock, START_MS + 10_030)).toBe(1);
    expect(interpolation(clock)).toBeCloseTo(0.2, FRACTION_DIGITS);
  });
});
