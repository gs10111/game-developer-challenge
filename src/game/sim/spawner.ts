import type { Overlap } from './collision/circlePolygon';
import { deepestIslandOverlap } from './collision/islandOverlap';
import { Layer } from './collision/layers';
import { SPAWN_ATTEMPTS } from './limits';
import type { Match } from './match';
import { nextRandom } from './random';
import { spawnChaser, spawnShooter } from './spawnEnemy';
import { stepsFromSeconds } from './stepRate';
import type { World } from './world';

const HEADING_DOWN = 128;
const HEADING_LEFT = 256;
const HEADING_UP = 384;
const HEADING_RIGHT = 0;

const overlap: Overlap = { depth: 0, normalX: 0, normalY: 0 };
const candidate = { x: 0, y: 0, heading: 0 };

function enemiesAlive(world: World): number {
  const slots = world.ships.slots;
  const capacity = slots.length;
  let alive = 0;
  for (let index = 0; index < capacity; index += 1) {
    const ship = slots[index];
    if (ship?.active && ship.layer === Layer.Enemy) {
      alive += 1;
    }
  }
  return alive;
}

function drawCandidate(world: World, radius: number): void {
  const { width, height } = world.config.arena;
  const across = width - 2 * radius;
  const down = height - 2 * radius;
  const distance = nextRandom(world.rng) * (2 * across + 2 * down);
  if (distance < across) {
    candidate.x = radius + distance;
    candidate.y = radius;
    candidate.heading = HEADING_DOWN;
  } else if (distance < across + down) {
    candidate.x = width - radius;
    candidate.y = radius + (distance - across);
    candidate.heading = HEADING_LEFT;
  } else if (distance < 2 * across + down) {
    candidate.x = width - radius - (distance - across - down);
    candidate.y = height - radius;
    candidate.heading = HEADING_UP;
  } else {
    candidate.x = radius;
    candidate.y = height - radius - (distance - 2 * across - down);
    candidate.heading = HEADING_RIGHT;
  }
}

function candidateIsValid(world: World, radius: number, minimumDistance: number): boolean {
  const offsetX = candidate.x - world.player.x;
  const offsetY = candidate.y - world.player.y;
  if (offsetX * offsetX + offsetY * offsetY < minimumDistance * minimumDistance) {
    return false;
  }
  return !deepestIslandOverlap(world.islands, candidate.x, candidate.y, radius, overlap);
}

export function spawnDueEnemy(match: Match): void {
  if (match.spawnCountdown > 0) {
    match.spawnCountdown -= 1;
  }
  if (match.spawnCountdown > 0) {
    return;
  }
  const world = match.world;
  const { sequence, maximumAlive, minimumDistance, intervalSeconds } = world.config.enemies.spawn;
  const kind = sequence[match.spawned % sequence.length];
  if (kind === undefined || enemiesAlive(world) >= maximumAlive) {
    return;
  }
  const radius = world.config.enemies[kind].radius;
  for (let attempt = 0; attempt < SPAWN_ATTEMPTS; attempt += 1) {
    drawCandidate(world, radius);
    if (candidateIsValid(world, radius, minimumDistance)) {
      const ship =
        kind === 'chaser'
          ? spawnChaser(world, candidate.x, candidate.y, candidate.heading)
          : spawnShooter(world, candidate.x, candidate.y, candidate.heading);
      if (ship !== null) {
        match.spawned += 1;
        match.spawnCountdown = stepsFromSeconds(intervalSeconds);
      }
      return;
    }
  }
}
