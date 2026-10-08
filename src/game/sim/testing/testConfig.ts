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
    },
  } satisfies GameConfig;
}
