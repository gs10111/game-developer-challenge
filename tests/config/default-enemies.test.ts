import { describe, expect, test } from 'vitest';
import { DEFAULT_GAME_CONFIG } from '../../src/game/config/gameConfig';
import { STEPS_PER_SECOND } from '../../src/game/sim/stepRate';

const RADIANS_PER_DEGREE = Math.PI / 180;
const HEADING_UNITS_PER_TURN = 512;
const DEGREES_PER_TURN = 360;
const RADIANS_PER_HEADING_UNIT = (2 * Math.PI) / HEADING_UNITS_PER_TURN;
const ONE_TABLE_UNIT = 1;
const CHASER_VALUES = ['radius', 'speed', 'turnRateDegrees', 'health', 'contactDamage'] as const;
const SHOOTER_VALUES = ['radius', 'speed', 'turnRateDegrees', 'health', 'attackRange'] as const;
const CANNON_VALUES = [
  'cooldownSeconds',
  'projectileSpeed',
  'projectileRadius',
  'projectileLifetimeSeconds',
  'damage',
] as const;

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

  test('SC-10 the default Shooter has positive radius, speed, turn rate, health and attack range, and a front cannon with positive values', () => {
    const { shooter } = DEFAULT_GAME_CONFIG.enemies;
    const { front } = shooter.weapons;
    const values = [
      ...SHOOTER_VALUES.map((value) => shooter[value]),
      ...CANNON_VALUES.map((value) => front[value]),
    ];

    expect(Object.keys(shooter).sort()).toEqual([...SHOOTER_VALUES, 'weapons'].sort());
    expect(Object.keys(shooter.weapons)).toEqual(['front']);
    expect(Object.keys(front).sort()).toEqual([...CANNON_VALUES].sort());
    expect(values).toHaveLength(SHOOTER_VALUES.length + CANNON_VALUES.length);
    for (const value of values) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
  });

  test("EN-04 the default Shooter's shots travel at least as far as its attack range", () => {
    const { shooter } = DEFAULT_GAME_CONFIG.enemies;
    const { front } = shooter.weapons;
    const stride = front.projectileSpeed / STEPS_PER_SECOND;
    const lifetimeInSteps = Math.max(
      1,
      Math.round(front.projectileLifetimeSeconds * STEPS_PER_SECOND),
    );

    expect(shooter.attackRange).toBeGreaterThan(0);
    expect(stride * lifetimeInSteps).toBeGreaterThanOrEqual(shooter.attackRange);
  });

  test('EN-04 the default Shooter facing a still player at the edge of its range cannot miss', () => {
    const { shooter } = DEFAULT_GAME_CONFIG.enemies;
    const turnPerStep =
      (shooter.turnRateDegrees * HEADING_UNITS_PER_TURN) / DEGREES_PER_TURN / STEPS_PER_SECOND;
    const band = Math.round(Math.max(ONE_TABLE_UNIT, turnPerStep));
    const widestMiss = shooter.attackRange * Math.sin(band * RADIANS_PER_HEADING_UNIT);
    const hitDistance = DEFAULT_GAME_CONFIG.player.radius + shooter.weapons.front.projectileRadius;

    expect(band).toBeGreaterThanOrEqual(ONE_TABLE_UNIT);
    expect(widestMiss).toBeGreaterThan(0);
    expect(widestMiss).toBeLessThan(hitDistance);
  });
});
