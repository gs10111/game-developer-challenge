import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';
import type { GameConfig } from '../config/gameConfig';
import { clear, createCommandState, press, release } from '../input/commandState';
import { attachKeyboard } from '../input/keyboard';
import { advance, createFixedStepClock, interpolation, reset } from '../loop/fixedStepClock';
import { createRenderer } from '../render/renderer';
import { loadTextures } from '../render/textures';
import { Layer } from '../sim/collision/layers';
import { advanceMatch, startMatch } from '../sim/match';
import type { Match, MatchOutcome } from '../sim/match';
import { STEPS_PER_SECOND } from '../sim/stepRate';
import { autopilot, createPerfRecorder, perfRequested } from './perf';
import type { PerfReport } from './perf';

const MILLISECONDS_PER_SECOND = 1000;
const LONGEST_FRAME_SECONDS = 0.1;

export type MatchPhase = 'running' | 'paused' | 'ended';

export interface HudState {
  phase: MatchPhase;
  health: number;
  maximumHealth: number;
  score: number;
  remainingSeconds: number;
  outcome: MatchOutcome | null;
}

export interface MatchSummary {
  score: number;
  playedSeconds: number;
  outcome: MatchOutcome;
  performance: PerfReport | null;
}

export interface SessionOptions {
  host: HTMLElement;
  config: GameConfig;
  seed: number;
  onProgress: (fraction: number) => void;
  onEnd: (summary: MatchSummary) => void;
}

export interface GameSession {
  readonly hud: StoreApi<HudState>;
  press: (command: number) => void;
  release: (command: number) => void;
  pause: () => void;
  resume: () => void;
  destroy: () => void;
}

export interface TestSeam {
  snapshot: () => unknown;
  advance: (steps: number) => void;
}

declare global {
  interface Window {
    pirateBattle?: TestSeam;
  }
}

function readHud(match: Match, phase: MatchPhase): HudState {
  const { player, score } = match.world;
  return {
    phase,
    health: player.health,
    maximumHealth: player.maxHealth,
    score,
    remainingSeconds: Math.ceil(match.remainingSteps / STEPS_PER_SECOND),
    outcome: match.outcome,
  };
}

function sameHud(a: HudState, b: HudState): boolean {
  return (
    a.phase === b.phase &&
    a.health === b.health &&
    a.score === b.score &&
    a.remainingSeconds === b.remainingSeconds &&
    a.outcome === b.outcome
  );
}

function countActive(slots: readonly { active: boolean }[]): number {
  let active = 0;
  for (const slot of slots) {
    if (slot.active) {
      active += 1;
    }
  }
  return active;
}

function describe(match: Match, phase: MatchPhase) {
  const { world } = match;
  const { player } = world;
  return {
    phase,
    step: world.step,
    score: world.score,
    spawned: match.spawned,
    remainingSteps: match.remainingSteps,
    outcome: match.outcome,
    player: { x: player.x, y: player.y, heading: player.heading, health: player.health },
    enemies: world.ships.slots
      .filter((ship) => ship.active && ship.layer === Layer.Enemy)
      .map(({ kind, x, y, health }) => ({ kind, x, y, health })),
    projectiles: world.projectiles.slots.filter((projectile) => projectile.active).length,
  };
}

export async function createGameSession(options: SessionOptions): Promise<GameSession> {
  const textures = await loadTextures(options.onProgress);
  const renderer = await createRenderer(options.config, textures);
  const match = startMatch(options.config, options.seed);
  const commands = createCommandState();
  const clock = createFixedStepClock(performance.now());
  const hud = createStore<HudState>(() => readHud(match, 'running'));
  const recorder = perfRequested() ? createPerfRecorder() : null;
  const steppedByTests = new URLSearchParams(window.location.search).has('e2e');
  let phase: MatchPhase = 'running';
  let lastFrameMs = performance.now();

  function publish(): void {
    const next = readHud(match, phase);
    if (!sameHud(hud.getState(), next)) {
      hud.setState(next);
    }
  }

  function runSteps(steps: number): void {
    const { world } = match;
    for (let count = 0; count < steps && match.outcome === null; count += 1) {
      advanceMatch(match, recorder === null ? commands.mask : autopilot(world.step));
      for (let index = 0; index < world.events.count; index += 1) {
        const event = world.events.items[index];
        if (event !== undefined) {
          renderer.react(event, world);
        }
      }
    }
    if (match.outcome !== null && phase !== 'ended') {
      phase = 'ended';
      clear(commands);
      publish();
      options.onEnd({
        score: world.score,
        playedSeconds: (match.durationSteps - match.remainingSteps) / STEPS_PER_SECOND,
        outcome: match.outcome,
        performance:
          recorder === null
            ? null
            : recorder.finish({
                seed: options.seed,
                sessionSeconds: options.config.match.durationSeconds,
                spawnSeconds: options.config.enemies.spawn.intervalSeconds,
                canvasWidth: renderer.canvas.width,
                canvasHeight: renderer.canvas.height,
              }),
      });
    }
  }

  function pause(): void {
    if (phase === 'running') {
      phase = 'paused';
      clear(commands);
      publish();
    }
  }

  function resume(): void {
    if (phase === 'paused') {
      phase = 'running';
      clear(commands);
      reset(clock, performance.now());
      publish();
    }
  }

  function pauseWhenHidden(): void {
    if (document.hidden) {
      pause();
    }
  }

  renderer.onFrame(() => {
    const now = performance.now();
    const frameMs = now - lastFrameMs;
    const elapsedSeconds = Math.min(frameMs / MILLISECONDS_PER_SECOND, LONGEST_FRAME_SECONDS);
    lastFrameMs = now;
    if (recorder !== null && phase === 'running') {
      const { ships, projectiles } = match.world;
      recorder.frame(frameMs, countActive(ships.slots), countActive(projectiles.slots));
    }
    if (phase === 'running' && !steppedByTests) {
      runSteps(advance(clock, now));
    }
    const running = phase === 'running' && !steppedByTests;
    renderer.draw(match.world, running ? interpolation(clock) : 1, running ? elapsedSeconds : 0);
    publish();
  });

  const detachKeyboard = attachKeyboard(commands, {
    capturing: () => phase === 'running',
    onPauseKey: pause,
  });
  window.addEventListener('blur', pause);
  document.addEventListener('visibilitychange', pauseWhenHidden);
  options.host.append(renderer.canvas);
  pauseWhenHidden();

  if (steppedByTests) {
    window.pirateBattle = {
      snapshot: () => describe(match, phase),
      advance: (steps) => {
        if (phase === 'running') {
          runSteps(steps);
          publish();
        }
      },
    };
  }

  return {
    hud,
    press: (command) => {
      if (phase === 'running') {
        press(commands, command);
      }
    },
    release: (command) => {
      release(commands, command);
    },
    pause,
    resume,
    destroy: () => {
      detachKeyboard();
      window.removeEventListener('blur', pause);
      document.removeEventListener('visibilitychange', pauseWhenHidden);
      delete window.pirateBattle;
      renderer.destroy();
    },
  };
}
