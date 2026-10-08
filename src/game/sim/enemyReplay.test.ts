import { describe, expect, test } from 'vitest';
import { Layer } from './collision/layers';
import { Command } from './commands';
import { createMatch } from './createMatch';
import type { GameEvent } from './events';
import { spawnChaser, spawnShooter } from './spawnEnemy';
import { step } from './step';
import { buildConfig, eventsOf, SEED } from './testing/combatHarness';
import type { Projectile, Ship, World } from './world';

const SCRIPT: readonly (readonly [commands: number, steps: number])[] = [
  [Command.FireFront, 80],
  [0, 80],
  [Command.Forward | Command.TurnRight, 72],
  [Command.Forward | Command.FireRight, 130],
  [Command.TurnLeft | Command.FireFront | Command.FireLeft, 40],
  [Command.Forward, 30],
];

interface Fleet {
  world: World;
  shooter: Ship;
}

interface Sighting {
  rangeOfTheShooter: number;
  ships: (Ship & { berth: number })[];
  flying: (Projectile & { berth: number })[];
  events: GameEvent[];
  health: number;
  score: number;
}

interface TurningPoint {
  step: number;
  damage: number;
  sunk: number;
  points: number;
}

function afloat(ship: Ship | null): Ship {
  if (ship === null) {
    throw new Error('The ship pool has no free slot');
  }
  return ship;
}

function commandLog(): number[] {
  return SCRIPT.flatMap(([commands, steps]) => Array.from({ length: steps }, () => commands));
}

function createFleet(): Fleet {
  const world = createMatch(buildConfig(), SEED);
  const shooter = afloat(spawnShooter(world, 600, 1000, 0));
  afloat(spawnChaser(world, 1300, 1000, 256));
  afloat(spawnChaser(world, 1000, 1300, 384));
  afloat(spawnChaser(world, 1000, 300, 128));
  return { world, shooter };
}

function advance({ world, shooter }: Fleet, commands: number): Sighting {
  const { player, ships, projectiles } = world;
  const rangeOfTheShooter = Math.hypot(player.x - shooter.x, player.y - shooter.y);
  step(world, commands);
  return {
    rangeOfTheShooter,
    ships: ships.slots.flatMap((slot, berth) => (slot.active ? [{ ...slot, berth }] : [])),
    flying: projectiles.slots.flatMap((slot, berth) => (slot.active ? [{ ...slot, berth }] : [])),
    events: eventsOf(world),
    health: player.health,
    score: world.score,
  };
}

function turningPoints(wake: Sighting[], fullHealth: number): TurningPoint[] {
  return wake.flatMap(({ events, health, score }, index) => {
    const before = wake[index - 1];
    const damage = (before?.health ?? fullHealth) - health;
    const points = score - (before?.score ?? 0);
    const sunk = events.filter(
      ({ kind, layer }) => kind === 'destroyed' && layer === Layer.Enemy,
    ).length;
    return damage === 0 && points === 0 && sunk === 0
      ? []
      : [{ step: index + 1, damage, sunk, points }];
  });
}

describe('replay with both enemy types (ADR-0005, ADR-0006)', () => {
  test('PW-03 replaying the same seed and command log reproduces a match with both enemy types', () => {
    const log = commandLog();
    const original = createFleet();
    const replayed = createFleet();
    const decoy = createFleet();
    const { player, enemies } = original.world.config;
    const cannon = enemies.shooter.weapons.front;

    const wake = log.map((commands) => advance(original, commands));
    const replayedWake = log.map((commands, index) => {
      advance(decoy, log.at(-1 - index) ?? 0);
      return advance(replayed, commands);
    });
    const volleys = wake.flatMap(({ rangeOfTheShooter, events }, index) =>
      events.some(({ kind, layer }) => kind === 'shotFired' && layer === Layer.Enemy)
        ? [{ step: index + 1, range: rangeOfTheShooter }]
        : [],
    );
    const [shotDown, rammed, holed] = turningPoints(wake, player.health);

    expect(original.world.step).toBe(432);
    expect(replayedWake).toStrictEqual(wake);
    expect(replayed.world).toStrictEqual(original.world);
    expect(replayed.world).not.toBe(original.world);
    expect(decoy.world.step).toBe(original.world.step);
    expect(decoy.world.ships).not.toEqual(original.world.ships);

    expect(volleys[0]).toEqual({ step: 101, range: enemies.shooter.attackRange });
    expect(volleys.filter(({ range }) => range > enemies.shooter.attackRange)).toEqual([]);
    expect(shotDown).toEqual({ step: 57, damage: 0, sunk: 1, points: 1 });
    expect(rammed).toEqual({ step: 129, damage: enemies.chaser.contactDamage, sunk: 1, points: 0 });
    expect(holed).toEqual({ step: 150, damage: cannon.damage, sunk: 0, points: 0 });
  });
});
