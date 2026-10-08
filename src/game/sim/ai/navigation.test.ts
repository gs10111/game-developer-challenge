import { describe, expect, test } from 'vitest';
import type { Point } from '../../config/gameConfig';
import { Command } from '../commands';
import { Layer } from '../collision/layers';
import { createMatch } from '../createMatch';
import { spawnChaser, spawnShooter } from '../spawnEnemy';
import { step } from '../step';
import { testConfig } from '../testing/testConfig';
import type { Ship, World } from '../world';

const SEED = 20261008;

function wall(left: number, right: number): Point[] {
  return [
    { x: left, y: 200 },
    { x: right, y: 200 },
    { x: right, y: 800 },
    { x: left, y: 800 },
  ];
}

function matchWith(steers: boolean, islands: Point[][]): World {
  const config = testConfig({ width: 1000, height: 1000, islands });
  const enemies = { ...config.enemies, steersAroundIslands: steers };
  return createMatch({ ...config, enemies }, SEED);
}

function movePlayer(world: World, x: number, y: number): void {
  world.player.x = x;
  world.player.y = y;
  world.player.previousX = x;
  world.player.previousY = y;
}

function run(world: World, steps: number, commands = 0): void {
  for (let count = 0; count < steps; count += 1) {
    step(world, commands);
  }
}

function enemiesOf(world: World): Ship[] {
  return world.ships.slots.filter((ship) => ship.active && ship.layer === Layer.Enemy);
}

describe('enemy navigation around islands (ADR-0016)', () => {
  test('EN-07 a Chaser with an island between it and the player goes round it and reaches the player', () => {
    const world = matchWith(true, [wall(400, 600)]);
    movePlayer(world, 800, 500);
    spawnChaser(world, 200, 500, 0);

    run(world, 900);

    expect(world.player.health).toBe(75);
    expect(enemiesOf(world)).toEqual([]);
    expect(world.score).toBe(0);
  });

  test('EN-07 with steering switched off in the config the same Chaser is held by the island', () => {
    const world = matchWith(false, [wall(400, 600)]);
    movePlayer(world, 800, 500);
    spawnChaser(world, 200, 500, 0);

    run(world, 900);

    const [chaser] = enemiesOf(world);
    expect(world.player.health).toBe(100);
    expect(chaser).toMatchObject({ x: 380, y: 500 });
  });

  test('EN-07 a Shooter does not fire while an island hides the player, and fires after going round it', () => {
    const world = matchWith(true, [wall(480, 520)]);
    movePlayer(world, 640, 500);
    const shooter = spawnShooter(world, 400, 500, 0);
    let shotsWhileHidden = 0;
    let furthestFromStart = 0;

    for (let count = 0; count < 300; count += 1) {
      step(world, 0);
      shotsWhileHidden += world.projectiles.slots.filter((shot) => shot.active).length;
      furthestFromStart = Math.max(furthestFromStart, Math.abs((shooter?.y ?? 500) - 500));
    }

    expect(shotsWhileHidden).toBe(0);
    expect(furthestFromStart).toBeGreaterThan(200);
    expect(world.player.health).toBe(100);

    run(world, 900);

    expect(world.player.health).toBeLessThan(100);
    expect(shooter?.x).toBeGreaterThan(520);
  });

  test('EN-07 in open water enemies that steer move and fire exactly as enemies that do not', () => {
    const steering = matchWith(true, []);
    const plain = matchWith(false, []);
    for (const world of [steering, plain]) {
      spawnChaser(world, 100, 900, 384);
      spawnShooter(world, 900, 100, 128);
    }

    for (let count = 0; count < 400; count += 1) {
      const commands = Command.Forward | (count % 90 < 30 ? Command.TurnLeft : 0);
      step(steering, commands);
      step(plain, commands);
      expect(steering.ships.slots).toStrictEqual(plain.ships.slots);
    }

    expect(steering.projectiles.slots).toStrictEqual(plain.projectiles.slots);
    expect(steering.player.health).toBeLessThan(100);
  });
});
