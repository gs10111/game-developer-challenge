import { z } from 'zod';
import { DEFAULT_GAME_CONFIG, OPTION_LIMITS } from '../game/config/gameConfig';
import type { GameConfig } from '../game/config/gameConfig';
import { readJson, writeJson } from './localJson';

const OPTIONS_KEY = 'pirate-battle.options';
const PLAYER_KEY = 'pirate-battle.player-id';
const NAME_LENGTH = 16;

const { sessionSeconds, spawnSeconds } = OPTION_LIMITS;

export const optionsSchema = z.object({
  playerName: z
    .string()
    .trim()
    .min(1, 'Enter a name.')
    .max(NAME_LENGTH, `Use at most ${String(NAME_LENGTH)} characters.`),
  sessionSeconds: z
    .number('Enter a number of seconds.')
    .int('Use whole seconds.')
    .min(sessionSeconds.minimum, `Use at least ${String(sessionSeconds.minimum)} seconds.`)
    .max(sessionSeconds.maximum, `Use at most ${String(sessionSeconds.maximum)} seconds.`),
  spawnSeconds: z
    .number('Enter a number of seconds.')
    .min(spawnSeconds.minimum, `Use at least ${String(spawnSeconds.minimum)} seconds.`)
    .max(spawnSeconds.maximum, `Use at most ${String(spawnSeconds.maximum)} seconds.`),
});

export type Options = z.infer<typeof optionsSchema>;

export const DEFAULT_OPTIONS: Options = {
  playerName: 'Captain',
  sessionSeconds: DEFAULT_GAME_CONFIG.match.durationSeconds,
  spawnSeconds: DEFAULT_GAME_CONFIG.enemies.spawn.intervalSeconds,
};

export function loadOptions(): Options {
  const stored = optionsSchema.safeParse(readJson(OPTIONS_KEY));
  return stored.success ? stored.data : DEFAULT_OPTIONS;
}

export function saveOptions(options: Options): void {
  writeJson(OPTIONS_KEY, options);
}

export function loadPlayerId(): string {
  const stored = z.string().min(1).safeParse(readJson(PLAYER_KEY));
  if (stored.success) {
    return stored.data;
  }
  const created = crypto.randomUUID();
  writeJson(PLAYER_KEY, created);
  return created;
}

export function configFromOptions(options: Options): GameConfig {
  return {
    ...DEFAULT_GAME_CONFIG,
    match: { durationSeconds: options.sessionSeconds },
    enemies: {
      ...DEFAULT_GAME_CONFIG.enemies,
      spawn: { ...DEFAULT_GAME_CONFIG.enemies.spawn, intervalSeconds: options.spawnSeconds },
    },
  };
}
