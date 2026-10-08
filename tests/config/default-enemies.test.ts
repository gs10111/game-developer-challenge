import { describe, expect, test } from 'vitest';
import { DEFAULT_GAME_CONFIG } from '../../src/game/config/gameConfig';

const RADIANS_PER_DEGREE = Math.PI / 180;
const CHASER_VALUES = ['radius', 'speed', 'turnRateDegrees', 'health', 'contactDamage'] as const;

describe('default enemies (ADR-0006)', () => {
  test('SC-10 the default Chaser has positive radius, speed, turn rate, health and contact damage', () => {
    const { chaser } = DEFAULT_GAME_CONFIG.enemies;
    const values = CHASER_VALUES.map((value) => chaser[value]);

    expect(Object.keys(chaser).sort()).toEqual([...CHASER_VALUES].sort());
    for (const value of values) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
  });

  test('EN-01 the default Chaser turns tighter than its contact distance with the default player', () => {
    const { chaser } = DEFAULT_GAME_CONFIG.enemies;
    const turnRateInRadians = chaser.turnRateDegrees * RADIANS_PER_DEGREE;
    const turningRadius = chaser.speed / turnRateInRadians;
    const contactDistance = chaser.radius + DEFAULT_GAME_CONFIG.player.radius;

    expect(turnRateInRadians).toBeGreaterThan(0);
    expect(turningRadius).toBeGreaterThan(0);
    expect(turningRadius).toBeLessThan(contactDistance);
  });
});
