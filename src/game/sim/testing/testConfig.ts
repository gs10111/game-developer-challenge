import type { GameConfig } from '../../config/gameConfig';
import { testPlayer } from './testPlayer';

export function testConfig<Arena extends GameConfig['arena']>(arena: Arena) {
  return {
    arena,
    player: testPlayer(),
    enemies: {
      chaser: {
        radius: 20,
        speed: 120,
        turnRateDegrees: 168.75,
        health: 30,
        contactDamage: 25,
      },
      shooter: {
        radius: 22,
        speed: 60,
        turnRateDegrees: 168.75,
        health: 40,
        attackRange: 300,
        weapons: {
          front: {
            cooldownSeconds: 1,
            projectileSpeed: 300,
            projectileRadius: 4,
            projectileLifetimeSeconds: 1.5,
            damage: 10,
          },
        },
      },
      spawn: {
        intervalSeconds: 3600,
        minimumDistance: 300,
        maximumAlive: 8,
        sequence: ['chaser', 'shooter'],
      },
    },
    match: {
      durationSeconds: 3600,
    },
  } satisfies GameConfig;
}
