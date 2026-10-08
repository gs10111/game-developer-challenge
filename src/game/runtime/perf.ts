import { Command } from '../sim/commands';

const FRAME_CAPACITY = 131072;
const SLOW_FRAME_MS = 1000 / 30;
const MILLISECONDS_PER_SECOND = 1000;
const BYTES_PER_MEGABYTE = 1048576;
const AUTOPILOT_CYCLE_STEPS = 360;
const AUTOPILOT_RIGHT_TURN_STEPS = 90;
const AUTOPILOT_LEFT_TURN_START = 180;
const AUTOPILOT_LEFT_TURN_END = 225;

export const BENCHMARK_PLAYER_HEALTH = 1_000_000;

export interface FrameSummary {
  frames: number;
  seconds: number;
  averageFps: number;
  medianMs: number;
  p95Ms: number;
  p99Ms: number;
  longestMs: number;
  framesOver33Ms: number;
}

export interface PerfContext {
  seed: number;
  sessionSeconds: number;
  spawnSeconds: number;
  canvasWidth: number;
  canvasHeight: number;
}

export interface PerfReport extends PerfContext {
  cycle: number;
  userAgent: string;
  viewport: string;
  devicePixelRatio: number;
  frames: FrameSummary;
  ships: { average: number; maximum: number };
  projectiles: { average: number; maximum: number };
  heapMegabytes: { atStart: number | null; atEnd: number | null };
}

export interface PerfRecorder {
  frame: (deltaMs: number, ships: number, projectiles: number) => void;
  finish: (context: PerfContext) => PerfReport;
}

declare global {
  interface Window {
    pirateBattlePerf?: PerfReport[];
  }
}

const cycles: PerfReport[] = [];

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

function percentile(sorted: Float32Array, fraction: number): number {
  const rank = Math.max(1, Math.ceil(fraction * sorted.length));
  return rounded(sorted[rank - 1] ?? 0);
}

export function summariseFrames(deltasMs: Float32Array): FrameSummary {
  const sorted = deltasMs.slice().sort();
  const total = sorted.reduce((sum, delta) => sum + delta, 0);
  return {
    frames: sorted.length,
    seconds: rounded(total / MILLISECONDS_PER_SECOND),
    averageFps: total > 0 ? rounded((sorted.length * MILLISECONDS_PER_SECOND) / total) : 0,
    medianMs: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    p99Ms: percentile(sorted, 0.99),
    longestMs: percentile(sorted, 1),
    framesOver33Ms: sorted.filter((delta) => delta > SLOW_FRAME_MS).length,
  };
}

function heapMegabytes(): number | null {
  const { memory } = performance as Performance & { memory?: { usedJSHeapSize: number } };
  return memory === undefined ? null : rounded(memory.usedJSHeapSize / BYTES_PER_MEGABYTE);
}

export function perfRequested(): boolean {
  return new URLSearchParams(window.location.search).has('perf');
}

export function perfReports(): readonly PerfReport[] {
  return cycles;
}

export function autopilot(step: number): number {
  const phase = step % AUTOPILOT_CYCLE_STEPS;
  let mask = Command.Forward | Command.FireFront | Command.FireLeft | Command.FireRight;
  if (phase < AUTOPILOT_RIGHT_TURN_STEPS) {
    mask |= Command.TurnRight;
  } else if (phase >= AUTOPILOT_LEFT_TURN_START && phase < AUTOPILOT_LEFT_TURN_END) {
    mask |= Command.TurnLeft;
  }
  return mask;
}

export function createPerfRecorder(): PerfRecorder {
  const deltas = new Float32Array(FRAME_CAPACITY);
  const heapAtStart = heapMegabytes();
  let frames = 0;
  let shipTotal = 0;
  let shipMaximum = 0;
  let projectileTotal = 0;
  let projectileMaximum = 0;

  return {
    frame(deltaMs, ships, projectiles) {
      if (frames < FRAME_CAPACITY) {
        deltas[frames] = deltaMs;
        frames += 1;
        shipTotal += ships;
        projectileTotal += projectiles;
        shipMaximum = Math.max(shipMaximum, ships);
        projectileMaximum = Math.max(projectileMaximum, projectiles);
      }
    },
    finish(context) {
      const report: PerfReport = {
        cycle: cycles.length + 1,
        ...context,
        userAgent: navigator.userAgent,
        viewport: `${String(window.innerWidth)}x${String(window.innerHeight)}`,
        devicePixelRatio: window.devicePixelRatio,
        frames: summariseFrames(deltas.subarray(0, frames)),
        ships: { average: rounded(shipTotal / Math.max(1, frames)), maximum: shipMaximum },
        projectiles: {
          average: rounded(projectileTotal / Math.max(1, frames)),
          maximum: projectileMaximum,
        },
        heapMegabytes: { atStart: heapAtStart, atEnd: heapMegabytes() },
      };
      cycles.push(report);
      window.pirateBattlePerf = cycles;
      return report;
    },
  };
}
