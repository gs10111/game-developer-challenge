import { describe, expect, test } from 'vitest';
import { DEFAULT_GAME_CONFIG } from '../../src/game/config/gameConfig';

describe('default player (ADR-0006)', () => {
  test('SC-10 the default player health is positive', () => {
    const { health } = DEFAULT_GAME_CONFIG.player;

    expect(Number.isFinite(health)).toBe(true);
    expect(health).toBeGreaterThan(0);
  });
});
