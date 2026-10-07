import { describe, expect, test } from 'vitest';
import { DEFAULT_GAME_CONFIG } from '../../src/game/config/gameConfig';
import type { Weapon } from '../../src/game/config/gameConfig';
import { STEPS_PER_SECOND } from '../../src/game/sim/stepRate';

const TILE = 64;
const WEAPON_VALUES = [
  'cooldownSeconds',
  'projectileSpeed',
  'projectileRadius',
  'projectileLifetimeSeconds',
  'damage',
] as const;

function valuesOf(weapon: Weapon): number[] {
  return WEAPON_VALUES.map((value) => weapon[value]);
}

describe('default weapons (ADR-0007)', () => {
  test('SC-10 the default weapons have positive values, and their projectiles move less than a tile per step', () => {
    const { front, broadside } = DEFAULT_GAME_CONFIG.player.weapons;
    const values = [...valuesOf(front), ...valuesOf(broadside), broadside.spacing];

    expect(values).toHaveLength(2 * WEAPON_VALUES.length + 1);
    for (const value of values) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
    for (const weapon of [front, broadside]) {
      expect(weapon.projectileSpeed / STEPS_PER_SECOND).toBeLessThan(TILE);
    }
  });
});
