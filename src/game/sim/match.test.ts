import { describe, expect, test } from 'vitest';
import type { Point } from '../config/gameConfig';
import { Command } from './commands';
import { Layer } from './collision/layers';
import { advanceMatch, startMatch } from './match';
import type { Match } from './match';
import { release } from './pool';
import { spawnChaser } from './spawnEnemy';
import { testConfig } from './testing/testConfig';
import type { Ship } from './world';

const SEED = 20261008;
const WIDTH = 1000;
const HEIGHT = 600;

interface Rectangle {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const ISLANDS: Rectangle[] = [
  { left: 200, top: 0, right: 500, bottom: 150 },
  { left: 700, top: 450, right: 1000, bottom: 600 },
  { left: 0, top: 250, right: 120, bottom: 400 },
];

function corners({ left, top, right, bottom }: Rectangle): Point[] {
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

function calmConfig(islands: Rectangle[] = [], width = WIDTH, height = HEIGHT) {
  const config = testConfig({ width, height, islands: islands.map(corners) });
  config.match.durationSeconds = 10;
  config.enemies.spawn.intervalSeconds = 0.5;
  config.enemies.spawn.maximumAlive = 60;
  config.enemies.chaser.speed = 0;
  config.enemies.chaser.turnRateDegrees = 0;
  config.enemies.shooter.speed = 0;
  config.enemies.shooter.turnRateDegrees = 0;
  config.enemies.shooter.attackRange = 0;
  return config;
}

function run(match: Match, steps: number, commands = 0): void {
  for (let count = 0; count < steps; count += 1) {
    advanceMatch(match, commands);
  }
}

function enemiesOf(match: Match): Ship[] {
  return match.world.ships.slots.filter((ship) => ship.active && ship.layer === Layer.Enemy);
}

function movePlayer(match: Match, x: number, y: number): void {
  const player = match.world.player;
  player.x = x;
  player.y = y;
  player.previousX = x;
  player.previousY = y;
}

function distanceToRectangle(ship: Ship, { left, top, right, bottom }: Rectangle): number {
  const nearestX = Math.min(Math.max(ship.x, left), right);
  const nearestY = Math.min(Math.max(ship.y, top), bottom);
  return Math.hypot(ship.x - nearestX, ship.y - nearestY);
}

function sideOf(ship: Ship): string {
  if (ship.y === ship.radius) {
    return 'top';
  }
  if (ship.x === WIDTH - ship.radius) {
    return 'right';
  }
  if (ship.y === HEIGHT - ship.radius) {
    return 'bottom';
  }
  return ship.x === ship.radius ? 'left' : 'none';
}

function vitals(match: Match) {
  const { world } = match;
  return {
    step: world.step,
    score: world.score,
    generator: world.rng.state,
    ships: world.ships.slots.map((ship) => ({ ...ship })),
    projectiles: world.projectiles.slots.map((projectile) => ({ ...projectile })),
    remainingSteps: match.remainingSteps,
    spawned: match.spawned,
    outcome: match.outcome,
  };
}

describe('match rules and spawner (ADR-0005, ADR-0006)', () => {
  test('MT-05 a fresh match has its whole duration left, no outcome and nothing spawned', () => {
    const match = startMatch(calmConfig(), SEED);

    expect(match).toMatchObject({
      durationSteps: 600,
      remainingSteps: 600,
      spawnCountdown: 30,
      spawned: 0,
      outcome: null,
    });
    expect(match.world.step).toBe(0);
    expect(match.world.player).toMatchObject({ health: 100, x: WIDTH / 2, y: HEIGHT / 2 });
    expect(enemiesOf(match)).toEqual([]);
  });

  test('MT-01 a match lasts its configured duration and ends because time ran out', () => {
    const match = startMatch(calmConfig(), SEED);

    run(match, 599);

    expect(match.outcome).toBeNull();
    expect(match.remainingSteps).toBe(1);

    run(match, 1);

    expect(match.outcome).toBe('timeUp');
    expect(match.remainingSteps).toBe(0);
    expect(match.world.step).toBe(600);
  });

  test('MT-03 the match ends when the health of the player reaches zero, with the reason recorded', () => {
    const config = calmConfig();
    config.enemies.chaser.speed = 120;
    config.enemies.chaser.contactDamage = 100;
    const match = startMatch(config, SEED);
    const { player } = match.world;
    spawnChaser(match.world, player.x + 60, player.y, 256);

    run(match, 7);

    expect(match.outcome).toBeNull();
    expect(player.health).toBe(100);

    run(match, 2);

    expect(player.health).toBe(0);
    expect(match.outcome).toBe('defeated');
    expect(match.remainingSteps).toBe(600 - 9);
    expect(match.world.score).toBe(0);
  });

  test('MT-04 nothing moves, fires, spawns or scores after the match has ended', () => {
    const match = startMatch(calmConfig(), SEED);
    run(match, 600, Command.Forward | Command.FireFront);
    const atTheEnd = vitals(match);

    run(match, 300, Command.Forward | Command.TurnLeft | Command.FireFront | Command.FireLeft);

    expect(atTheEnd.outcome).toBe('timeUp');
    expect(vitals(match)).toStrictEqual(atTheEnd);
  });

  test('EN-09 an enemy spawns every configured interval until the match ends', () => {
    const match = startMatch(calmConfig(), SEED);
    const spawnSteps: number[] = [];

    for (let count = 1; count <= 900; count += 1) {
      const before = match.spawned;
      advanceMatch(match, 0);
      if (match.spawned > before) {
        spawnSteps.push(count);
      }
    }

    expect(spawnSteps).toEqual(Array.from({ length: 20 }, (_, index) => 30 * (index + 1)));
    expect(enemiesOf(match)).toHaveLength(20);
  });

  test('EN-08 enemies spawn in the order of the configured sequence, over and over', () => {
    const config = calmConfig();
    config.enemies.spawn.sequence = ['shooter', 'chaser', 'chaser'];
    const match = startMatch(config, SEED);

    run(match, 7 * 30);

    expect(enemiesOf(match).map(({ kind }) => kind)).toEqual([
      'shooter',
      'chaser',
      'chaser',
      'shooter',
      'chaser',
      'chaser',
      'shooter',
    ]);
  });

  test('EN-10 every enemy spawns on the line its own radius inside the walls, heading in and clear of every island', () => {
    const config = calmConfig(ISLANDS);
    config.enemies.spawn.intervalSeconds = 1 / 60;
    const match = startMatch(config, SEED);

    run(match, 60);

    const spawned = enemiesOf(match);
    const headings = { top: 128, right: 256, bottom: 384, left: 0, none: -1 };
    expect(spawned.length).toBeGreaterThan(40);
    expect(new Set(spawned.map(sideOf))).toEqual(new Set(['top', 'right', 'bottom', 'left']));
    for (const ship of spawned) {
      expect(ship.heading).toBe(headings[sideOf(ship) as keyof typeof headings]);
      expect(ship.x).toBeGreaterThanOrEqual(ship.radius);
      expect(ship.x).toBeLessThanOrEqual(WIDTH - ship.radius);
      expect(ship.y).toBeGreaterThanOrEqual(ship.radius);
      expect(ship.y).toBeLessThanOrEqual(HEIGHT - ship.radius);
      for (const island of ISLANDS) {
        expect(distanceToRectangle(ship, island)).toBeGreaterThanOrEqual(ship.radius);
      }
    }
  });

  test('EN-11 every enemy spawns at least the minimum distance from the player', () => {
    const config = calmConfig(ISLANDS);
    config.enemies.spawn.intervalSeconds = 1 / 60;
    config.enemies.spawn.minimumDistance = 500;
    const match = startMatch(config, SEED);
    movePlayer(match, 150, 200);

    run(match, 60);

    const spawned = enemiesOf(match);
    expect(spawned.length).toBeGreaterThan(20);
    for (const ship of spawned) {
      expect(Math.hypot(ship.x - 150, ship.y - 200)).toBeGreaterThanOrEqual(500);
    }
  });

  test('EN-11 a spawn with no valid point stays due and happens once the player is far enough', () => {
    const config = calmConfig([], 400, 400);
    config.enemies.spawn.minimumDistance = 350;
    const match = startMatch(config, SEED);

    run(match, 100);

    expect(match.spawned).toBe(0);
    expect(match.spawnCountdown).toBe(0);

    movePlayer(match, 30, 30);
    run(match, 5);

    expect(match.spawned).toBe(1);
    expect(match.spawnCountdown).toBeGreaterThan(24);
  });

  test('EN-09 no enemy spawns while the configured maximum is alive, and one spawns as soon as there is room', () => {
    const config = calmConfig();
    config.enemies.spawn.maximumAlive = 2;
    const match = startMatch(config, SEED);

    run(match, 200);

    expect(match.spawned).toBe(2);
    expect(match.spawnCountdown).toBe(0);

    const [first] = enemiesOf(match);
    if (first !== undefined) {
      release(match.world.ships, first);
    }
    run(match, 1);

    expect(match.spawned).toBe(3);
    expect(enemiesOf(match)).toHaveLength(2);
  });

  test('PW-03 equal seeds give equal matches and different seeds do not', () => {
    const commands = Command.Forward | Command.TurnRight | Command.FireFront;
    const first = startMatch(calmConfig(ISLANDS), SEED);
    const second = startMatch(calmConfig(ISLANDS), SEED);
    const other = startMatch(calmConfig(ISLANDS), SEED + 1);

    run(first, 400, commands);
    run(second, 400, commands);
    run(other, 400, commands);

    expect(first.spawned).toBeGreaterThan(10);
    expect(vitals(second)).toStrictEqual(vitals(first));
    expect(vitals(other)).not.toEqual(vitals(first));
  });
});
