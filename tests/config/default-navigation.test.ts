import { describe, expect, test } from 'vitest';
import { DEFAULT_GAME_CONFIG } from '../../src/game/config/gameConfig';
import { createMatch } from '../../src/game/sim/createMatch';
import { spawnChaser } from '../../src/game/sim/spawnEnemy';
import { step } from '../../src/game/sim/step';

const { arena, enemies, player: playerConfig } = DEFAULT_GAME_CONFIG;
const LONGEST_CHASE_STEPS = 1800;

const PLAYER_BERTHS = [
  { x: 512, y: 288 },
  { x: 64, y: 64 },
  { x: 192, y: 192 },
  { x: 448, y: 64 },
  { x: 768, y: 288 },
  { x: 960, y: 512 },
  { x: 320, y: 448 },
];

function clearOfIslands(x: number, y: number, radius: number): boolean {
  return arena.islands.every((island) => {
    const xs = island.map((corner) => corner.x);
    const ys = island.map((corner) => corner.y);
    const nearestX = Math.min(Math.max(x, Math.min(...xs)), Math.max(...xs));
    const nearestY = Math.min(Math.max(y, Math.min(...ys)), Math.max(...ys));
    return Math.hypot(x - nearestX, y - nearestY) >= radius;
  });
}

function chaseFrom(startX: number, startY: number, berth: { x: number; y: number }): boolean {
  const world = createMatch(DEFAULT_GAME_CONFIG, 1);
  const { player } = world;
  player.x = berth.x;
  player.y = berth.y;
  player.previousX = berth.x;
  player.previousY = berth.y;
  spawnChaser(world, startX, startY, 0);
  for (let count = 0; count < LONGEST_CHASE_STEPS; count += 1) {
    step(world, 0);
    if (player.health < playerConfig.health) {
      return true;
    }
  }
  return false;
}

describe('enemy navigation in the default arena', () => {
  test('EN-07 the default config makes enemies steer around islands', () => {
    expect(enemies.steersAroundIslands).toBe(true);
  });

  test('EN-07 a Chaser reaches a still player from every part of the default arena', () => {
    const lost: string[] = [];
    let chases = 0;

    for (const berth of PLAYER_BERTHS) {
      expect(clearOfIslands(berth.x, berth.y, playerConfig.radius)).toBe(true);
      for (let startX = 48; startX <= 976; startX += 116) {
        for (let startY = 48; startY <= 528; startY += 96) {
          const far = Math.hypot(startX - berth.x, startY - berth.y) > 150;
          if (far && clearOfIslands(startX, startY, enemies.chaser.radius + 2)) {
            chases += 1;
            if (!chaseFrom(startX, startY, berth)) {
              lost.push(`from ${String(startX)},${String(startY)} to ${String(berth.x)},${String(berth.y)}`);
            }
          }
        }
      }
    }

    expect(chases).toBeGreaterThan(200);
    expect(lost).toEqual([]);
  });
});
