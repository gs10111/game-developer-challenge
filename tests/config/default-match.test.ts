import { describe, expect, test } from 'vitest';
import { DEFAULT_GAME_CONFIG, OPTION_LIMITS } from '../../src/game/config/gameConfig';
import { Layer } from '../../src/game/sim/collision/layers';
import { advanceMatch, startMatch } from '../../src/game/sim/match';
import { STEPS_PER_SECOND } from '../../src/game/sim/stepRate';

describe('default match and spawn settings', () => {
  const { spawn, shooter } = DEFAULT_GAME_CONFIG.enemies;

  test('MT-01 the default match duration is within the limits of the options', () => {
    const { durationSeconds } = DEFAULT_GAME_CONFIG.match;

    expect(OPTION_LIMITS.sessionSeconds).toEqual({ minimum: 60, maximum: 180 });
    expect(durationSeconds).toBeGreaterThanOrEqual(OPTION_LIMITS.sessionSeconds.minimum);
    expect(durationSeconds).toBeLessThanOrEqual(OPTION_LIMITS.sessionSeconds.maximum);
  });

  test('SC-10 the default spawn settings have a positive interval inside the limits of the options and room for enemies', () => {
    expect(spawn.intervalSeconds).toBeGreaterThanOrEqual(OPTION_LIMITS.spawnSeconds.minimum);
    expect(spawn.intervalSeconds).toBeLessThanOrEqual(OPTION_LIMITS.spawnSeconds.maximum);
    expect(OPTION_LIMITS.spawnSeconds.minimum).toBeGreaterThan(0);
    expect(spawn.maximumAlive).toBeGreaterThan(0);
  });

  test('EN-08 the default spawn sequence holds both enemy types', () => {
    expect(new Set(spawn.sequence)).toEqual(new Set(['chaser', 'shooter']));
  });

  test('EN-11 the default minimum spawn distance keeps a new Shooter out of its attack range', () => {
    expect(spawn.minimumDistance).toBeGreaterThan(shooter.attackRange);
  });

  test('EN-08 a default match spawns both enemy types within its first sequence', () => {
    const match = startMatch(DEFAULT_GAME_CONFIG, 7);
    const steps = spawn.sequence.length * spawn.intervalSeconds * STEPS_PER_SECOND + 30;
    const seen = new Set<string | null>();

    for (let count = 0; count < steps; count += 1) {
      advanceMatch(match, 0);
      for (const ship of match.world.ships.slots) {
        if (ship.active && ship.layer === Layer.Enemy) {
          seen.add(ship.kind);
        }
      }
    }

    expect(match.spawned).toBe(spawn.sequence.length);
    expect(seen).toEqual(new Set(['chaser', 'shooter']));
  });
});
