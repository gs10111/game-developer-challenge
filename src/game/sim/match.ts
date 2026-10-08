import type { GameConfig } from '../config/gameConfig';
import { createMatch } from './createMatch';
import { spawnDueEnemy } from './spawner';
import { step } from './step';
import { stepsFromSeconds } from './stepRate';
import type { World } from './world';

export const MatchOutcome = {
  TimeUp: 'timeUp',
  Defeated: 'defeated',
} as const;

export type MatchOutcome = (typeof MatchOutcome)[keyof typeof MatchOutcome];

export interface Match {
  readonly world: World;
  readonly durationSteps: number;
  remainingSteps: number;
  spawnCountdown: number;
  spawned: number;
  outcome: MatchOutcome | null;
}

export function startMatch(config: GameConfig, seed: number): Match {
  const world = createMatch(config, seed);
  const durationSteps = stepsFromSeconds(world.config.match.durationSeconds);
  return {
    world,
    durationSteps,
    remainingSteps: durationSteps,
    spawnCountdown: stepsFromSeconds(world.config.enemies.spawn.intervalSeconds),
    spawned: 0,
    outcome: null,
  };
}

export function advanceMatch(match: Match, commands: number): void {
  if (match.outcome !== null) {
    return;
  }
  step(match.world, commands);
  spawnDueEnemy(match);
  match.remainingSteps -= 1;
  if (match.world.player.health <= 0) {
    match.outcome = MatchOutcome.Defeated;
  } else if (match.remainingSteps <= 0) {
    match.outcome = MatchOutcome.TimeUp;
  }
}
