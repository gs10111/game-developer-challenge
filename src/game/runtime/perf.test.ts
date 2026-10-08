import { describe, expect, test } from 'vitest';
import { Command } from '../sim/commands';
import { autopilot, summariseFrames } from './perf';

describe('performance recorder', () => {
  test('PF-02 frame times are summarised as frames per second and nearest-rank percentiles', () => {
    const deltas = new Float32Array(100).fill(16, 0, 95).fill(40, 95);

    expect(summariseFrames(deltas)).toStrictEqual({
      frames: 100,
      seconds: 1.72,
      averageFps: 58.14,
      medianMs: 16,
      p95Ms: 16,
      p99Ms: 40,
      longestMs: 40,
      framesOver33Ms: 5,
    });
  });

  test('PF-02 no frame gives an empty summary and not a division by zero', () => {
    expect(summariseFrames(new Float32Array(0))).toMatchObject({
      frames: 0,
      averageFps: 0,
      p95Ms: 0,
      longestMs: 0,
    });
  });

  test('PF-01 the benchmark pilot always sails and fires, and turns both ways in a fixed cycle', () => {
    const everyWeapon = Command.FireFront | Command.FireLeft | Command.FireRight;
    const masks = Array.from({ length: 720 }, (_, step) => autopilot(step));
    const always = Command.Forward | everyWeapon;

    expect(masks.every((mask) => (mask & always) === always)).toBe(true);
    expect(masks.filter((mask) => (mask & Command.TurnRight) !== 0)).toHaveLength(180);
    expect(masks.filter((mask) => (mask & Command.TurnLeft) !== 0)).toHaveLength(90);
    expect(masks.slice(360)).toEqual(masks.slice(0, 360));
  });
});
