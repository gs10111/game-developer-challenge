import { STEPS_PER_SECOND } from '../sim/stepRate';

const MILLISECONDS_PER_SECOND = 1000;
const STEP_MS = MILLISECONDS_PER_SECOND / STEPS_PER_SECOND;
const MAX_STEPS_PER_FRAME = 5;

export interface FixedStepClock {
  lastMs: number;
  accumulatorMs: number;
}

export function createFixedStepClock(nowMs: number): FixedStepClock {
  return { lastMs: nowMs, accumulatorMs: 0 };
}

export function advance(clock: FixedStepClock, nowMs: number): number {
  if (Number.isNaN(nowMs)) {
    return 0;
  }
  const elapsedMs = nowMs - clock.lastMs;
  clock.lastMs = nowMs;
  if (!(elapsedMs > 0)) {
    return 0;
  }
  clock.accumulatorMs += elapsedMs;
  const steps = Math.floor(clock.accumulatorMs / STEP_MS);
  if (steps >= MAX_STEPS_PER_FRAME) {
    clock.accumulatorMs = 0;
    return MAX_STEPS_PER_FRAME;
  }
  clock.accumulatorMs = Math.max(0, clock.accumulatorMs - steps * STEP_MS);
  return steps;
}

export function reset(clock: FixedStepClock, nowMs: number): void {
  clock.lastMs = nowMs;
  clock.accumulatorMs = 0;
}

export function interpolation(clock: FixedStepClock): number {
  return clock.accumulatorMs / STEP_MS;
}
