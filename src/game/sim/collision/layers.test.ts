import { describe, expect, test } from 'vitest';
import { Layer, layersMeet, shotLayerOf } from './layers';

const SIDES = [
  Layer.Player,
  Layer.Enemy,
  Layer.PlayerShot,
  Layer.EnemyShot,
  Layer.Island,
  null,
] as const;

const MATRIX: readonly { layer: Layer | null; meets: readonly (Layer | null)[] }[] = [
  { layer: 'player', meets: ['enemy', 'enemyShot', 'island'] },
  { layer: 'enemy', meets: ['player', 'playerShot', 'island'] },
  { layer: 'playerShot', meets: ['enemy', 'island'] },
  { layer: 'enemyShot', meets: ['player', 'island'] },
  { layer: 'island', meets: ['player', 'enemy', 'playerShot', 'enemyShot'] },
  { layer: null, meets: [] },
];

describe('collision layers (ADR-0007)', () => {
  test('CB-04 the pair matrix lets player shots meet enemies and enemy shots meet the player, and nothing meets its own layer', () => {
    expect(Layer).toStrictEqual({
      Player: 'player',
      Enemy: 'enemy',
      PlayerShot: 'playerShot',
      EnemyShot: 'enemyShot',
      Island: 'island',
    });
    expect(MATRIX.map(({ layer }) => layer)).toEqual(SIDES);

    expect(layersMeet(Layer.PlayerShot, Layer.Enemy)).toBe(true);
    expect(layersMeet(Layer.Enemy, Layer.PlayerShot)).toBe(true);
    expect(layersMeet(Layer.EnemyShot, Layer.Player)).toBe(true);
    expect(layersMeet(Layer.Player, Layer.EnemyShot)).toBe(true);
    expect(layersMeet(Layer.PlayerShot, Layer.Player)).toBe(false);
    expect(layersMeet(Layer.Player, Layer.PlayerShot)).toBe(false);
    expect(layersMeet(Layer.EnemyShot, Layer.Enemy)).toBe(false);
    expect(layersMeet(Layer.Enemy, Layer.EnemyShot)).toBe(false);
    expect(layersMeet(Layer.PlayerShot, Layer.EnemyShot)).toBe(false);
    expect(layersMeet(Layer.EnemyShot, Layer.PlayerShot)).toBe(false);
    for (const side of SIDES) {
      expect(layersMeet(side, side)).toBe(false);
      expect(layersMeet(side, null)).toBe(false);
      expect(layersMeet(null, side)).toBe(false);
    }

    let pairsThatMeet = 0;
    for (const { layer, meets } of MATRIX) {
      for (const other of SIDES) {
        const expected = meets.includes(other);

        expect({ layer, other, meet: layersMeet(layer, other) }).toStrictEqual({
          layer,
          other,
          meet: expected,
        });
        expect({ layer, other, meet: layersMeet(other, layer) }).toStrictEqual({
          layer,
          other,
          meet: expected,
        });
        pairsThatMeet += expected ? 1 : 0;
      }
    }

    expect(pairsThatMeet).toBe(14);
  });

  test('CB-04 the shots of a ship take the shot layer of its side, and a ship with no layer fires shots with none', () => {
    expect(shotLayerOf(Layer.Player)).toBe('playerShot');
    expect(shotLayerOf(Layer.Enemy)).toBe('enemyShot');
    expect(shotLayerOf(null)).toBeNull();
    expect(shotLayerOf(Layer.PlayerShot)).toBeNull();
    expect(shotLayerOf(Layer.EnemyShot)).toBeNull();
    expect(shotLayerOf(Layer.Island)).toBeNull();

    expect(layersMeet(shotLayerOf(Layer.Player), Layer.Enemy)).toBe(true);
    expect(layersMeet(shotLayerOf(Layer.Player), Layer.Player)).toBe(false);
    expect(layersMeet(shotLayerOf(Layer.Enemy), Layer.Player)).toBe(true);
    expect(layersMeet(shotLayerOf(Layer.Enemy), Layer.Enemy)).toBe(false);
    for (const side of SIDES) {
      expect(layersMeet(shotLayerOf(null), side)).toBe(false);
      expect(layersMeet(side, shotLayerOf(null))).toBe(false);
    }
  });
});
