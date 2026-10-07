import type { GameConfig } from '../../config/gameConfig';
import { testWeapons } from './testWeapons';

export function testPlayer() {
  return {
    radius: 24,
    speed: 140,
    turnRateDegrees: 150,
    health: 100,
    weapons: testWeapons(),
  } satisfies GameConfig['player'];
}
