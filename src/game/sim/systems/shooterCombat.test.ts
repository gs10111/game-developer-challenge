import { describe, expect, test } from 'vitest';
import { Layer } from '../collision/layers';
import { Command } from '../commands';
import { createMatch } from '../createMatch';
import type { GameEvent } from '../events';
import { spawnChaser, spawnShooter } from '../spawnEnemy';
import { step } from '../step';
import {
  activeProjectileSlots,
  activeShipSlots,
  buildConfig,
  destroyedAt,
  eventfulSteps,
  eventsOf,
  flight,
  flyingAt,
  healthChanges,
  hitAt,
  projectileAt,
  SEED,
  shipAt,
  shotFiredAt,
} from '../testing/combatHarness';
import { createShip } from '../world';
import type { Ship, World } from '../world';

const COOLDOWN = 60;

interface Blow {
  step: number;
  layer: Layer | null;
}

interface ScoreChange {
  step: number;
  score: number;
}

function afloat(ship: Ship | null): Ship {
  if (ship === null) {
    throw new Error('The ship pool has no free slot');
  }
  return ship;
}

function shooterAt(world: World, x: number, y: number, heading: number): Ship {
  return afloat(spawnShooter(world, x, y, heading));
}

function vitals({ active, health, maxHealth, pendingDamage }: Ship) {
  return { active, health, maxHealth, pendingDamage };
}

function afloatWith(health: number, maxHealth: number) {
  return { active: true, health, maxHealth, pendingDamage: 0 };
}

function shotsFiredBy(world: World, layer: Layer): GameEvent[] {
  return eventsOf(world).filter((event) => event.kind === 'shotFired' && event.layer === layer);
}

function volleySteps(world: World, commands: number, steps: number, layer: Layer): number[] {
  const fired: number[] = [];
  for (let count = 0; count < steps; count += 1) {
    step(world, commands);
    fired.push(...shotsFiredBy(world, layer).map(() => world.step));
  }
  return fired;
}

function blows(world: World, commands: number, steps: number): Blow[] {
  const struck: Blow[] = [];
  for (let count = 0; count < steps; count += 1) {
    step(world, commands);
    for (const event of eventsOf(world)) {
      if (event.kind === 'hit') {
        struck.push({ step: world.step, layer: event.layer });
      }
    }
  }
  return struck;
}

function scoreChanges(world: World, commands: number, steps: number): ScoreChange[] {
  const changes: ScoreChange[] = [];
  for (let count = 0; count < steps; count += 1) {
    const before = world.score;
    step(world, commands);
    if (world.score !== before) {
      changes.push({ step: world.step, score: world.score });
    }
  }
  return changes;
}

describe('Shooter combat (ADR-0006, ADR-0007)', () => {
  test('CB-07 a Shooter that keeps the player in range fires once per cooldown', () => {
    const world = createMatch(buildConfig(), SEED);
    const { player } = world;
    const shooter = shooterAt(world, 800, 1000, 0);
    const fromTheShooter: number[] = [];
    const fromThePlayer: number[] = [];

    for (let count = 1; count <= 300; count += 1) {
      step(world, Command.FireFront);

      for (const shot of shotsFiredBy(world, Layer.Enemy)) {
        fromTheShooter.push(count);

        expect(shot).toEqual(shotFiredAt('enemy', 'front', 826, 1000, 1, 0));
      }
      fromThePlayer.push(...shotsFiredBy(world, Layer.Player).map(() => count));

      expect(shooter).toMatchObject({
        x: 800,
        y: 1000,
        heading: 0,
        thrust: 0,
        turn: 0,
        fireFront: 1,
        frontCooldown: COOLDOWN - ((count - 1) % COOLDOWN),
        leftCooldown: 0,
        rightCooldown: 0,
      });
      expect(player).toMatchObject({ x: 1000, y: 1000, heading: 0 });
    }

    expect(fromTheShooter).toEqual([1, 61, 121, 181, 241]);
    expect(fromThePlayer).toEqual([1, 31, 61, 91, 121, 151, 181, 211, 241, 271]);
    expect(vitals(shooter)).toEqual(afloatWith(40, 40));

    const quick = buildConfig();
    quick.enemies.shooter.weapons.front.cooldownSeconds = 0.75;
    const watches = [
      { config: buildConfig(), heading: 126, steps: 240, volleys: [32, 92, 152, 212] },
      { config: quick, heading: 0, steps: 200, volleys: [1, 46, 91, 136, 181] },
    ];

    for (const { config, heading, steps, volleys } of watches) {
      const match = createMatch(config, SEED);
      const gunner = shooterAt(match, 800, 1000, heading);

      expect(volleySteps(match, 0, steps, Layer.Enemy)).toEqual(volleys);
      expect(gunner).toMatchObject({ active: true, x: 800, y: 1000, thrust: 0, fireFront: 1 });
      expect(match.player).toMatchObject({ x: 1000, y: 1000 });
    }
  });

  test("PL-04 a Shooter's shot takes its damage from a still player's health, once", () => {
    const world = createMatch(buildConfig(), SEED);
    const { player } = world;
    shooterAt(world, 800, 1000, 0);

    expect(vitals(player)).toEqual(afloatWith(100, 100));

    step(world, 0);

    expect(eventsOf(world)).toEqual([shotFiredAt('enemy', 'front', 826, 1000, 1, 0)]);
    expect(projectileAt(world, 0)).toMatchObject({ layer: 'enemyShot', x: 831, damage: 10 });
    expect(eventfulSteps(world, 0, 28)).toEqual([]);
    expect(flight(projectileAt(world, 0))).toEqual(flyingAt(971, 1000));
    expect(vitals(player)).toEqual(afloatWith(100, 100));

    step(world, 0);

    expect(world.step).toBe(30);
    expect(eventsOf(world)).toEqual([hitAt('player', 972, 1000, 1, 0)]);
    expect(vitals(player)).toEqual(afloatWith(90, 100));
    expect(player).toMatchObject({ layer: 'player', kind: 'player', x: 1000, y: 1000 });
    expect(activeProjectileSlots(world)).toEqual([]);

    expect(eventfulSteps(world, 0, 30)).toEqual([]);
    expect(vitals(player)).toEqual(afloatWith(90, 100));
    expect(healthChanges(world, player, 0, 240)).toEqual([
      { step: 90, health: 80 },
      { step: 150, health: 70 },
      { step: 210, health: 60 },
      { step: 270, health: 50 },
    ]);
    expect(activeProjectileSlots(world)).toEqual([]);
    expect(world.score).toBe(0);

    const heavy = buildConfig();
    heavy.enemies.shooter.weapons.front.damage = 12.5;
    const fromTheEdgeOfTheRange = [
      { config: buildConfig(), x: 700, y: 1000, heading: 0, health: 90 },
      { config: heavy, x: 1000, y: 1300, heading: 384, health: 87.5 },
    ];

    for (const { config, x, y, heading, health } of fromTheEdgeOfTheRange) {
      const match = createMatch(config, SEED);
      shooterAt(match, x, y, heading);

      expect(healthChanges(match, match.player, 0, 60)).toEqual([{ step: 50, health }]);
      expect(vitals(match.player)).toEqual(afloatWith(health, 100));
      expect(activeProjectileSlots(match)).toEqual([]);
    }
  });

  test("CB-04 a Shooter's shot passes through another enemy on its way to the player", () => {
    const becalmed = buildConfig();
    becalmed.enemies.chaser.speed = 0;
    const world = createMatch(becalmed, SEED);
    const { player } = world;
    const far = shooterAt(world, 700, 1000, 0);
    const chaser = afloat(spawnChaser(world, 800, 1000, 0));
    const near = shooterAt(world, 900, 1000, 0);

    step(world, 0);

    expect(eventsOf(world)).toEqual([
      shotFiredAt('enemy', 'front', 726, 1000, 1, 0),
      shotFiredAt('enemy', 'front', 926, 1000, 1, 0),
    ]);
    expect(projectileAt(world, 0)).toMatchObject({ layer: 'enemyShot', x: 731, y: 1000 });
    expect(projectileAt(world, 1)).toMatchObject({ layer: 'enemyShot', x: 931, y: 1000 });

    expect(blows(world, 0, 14)).toEqual([{ step: 10, layer: 'player' }]);
    expect(activeProjectileSlots(world)).toEqual([0]);
    expect(flight(projectileAt(world, 0))).toEqual(flyingAt(801, 1000));
    expect(chaser).toMatchObject({ layer: 'enemy', kind: 'chaser', x: 800, y: 1000, radius: 20 });
    expect(vitals(chaser)).toEqual(afloatWith(30, 30));

    expect(blows(world, 0, 20)).toEqual([]);
    expect(flight(projectileAt(world, 0))).toEqual(flyingAt(901, 1000));
    expect(near).toMatchObject({ layer: 'enemy', kind: 'shooter', x: 900, y: 1000, radius: 22 });
    expect(vitals(near)).toEqual(afloatWith(40, 40));

    expect(eventfulSteps(world, 0, 14)).toEqual([]);
    expect(flight(projectileAt(world, 0))).toEqual(flyingAt(971, 1000));
    expect(vitals(player)).toEqual(afloatWith(90, 100));

    step(world, 0);

    expect(world.step).toBe(50);
    expect(eventsOf(world)).toEqual([hitAt('player', 972, 1000, 1, 0)]);
    expect(vitals(player)).toEqual(afloatWith(80, 100));
    expect(activeProjectileSlots(world)).toEqual([]);

    expect(blows(world, 0, 70)).toEqual([
      { step: 70, layer: 'player' },
      { step: 110, layer: 'player' },
    ]);
    expect(vitals(player)).toEqual(afloatWith(60, 100));
    expect(vitals(far)).toEqual(afloatWith(40, 40));
    expect(vitals(chaser)).toEqual(afloatWith(30, 30));
    expect(vitals(near)).toEqual(afloatWith(40, 40));
    expect(activeShipSlots(world)).toEqual([0, 1, 2, 3]);
    expect(world.score).toBe(0);
  });

  test("EN-06 a Shooter loses health to the player's shots and is destroyed at zero", () => {
    const world = createMatch(buildConfig(), SEED);
    const ahead = shooterAt(world, 1200, 1000, 256);
    const astern = shooterAt(world, 800, 1000, 0);

    expect(vitals(ahead)).toEqual(afloatWith(40, 40));
    expect(healthChanges(world, ahead, Command.FireFront, 29)).toEqual([]);

    step(world, Command.FireFront);

    expect(eventsOf(world)).toEqual([
      hitAt('enemy', 1174, 1000, 1, 0),
      hitAt('player', 1028, 1000, -1, 0),
      hitAt('player', 972, 1000, 1, 0),
    ]);
    expect(vitals(ahead)).toEqual(afloatWith(20, 40));
    expect(ahead).toMatchObject({ layer: 'enemy', kind: 'shooter', x: 1200, y: 1000 });
    expect(vitals(astern)).toEqual(afloatWith(40, 40));
    expect(healthChanges(world, ahead, Command.FireFront, 29)).toEqual([]);

    step(world, Command.FireFront);

    expect(world.step).toBe(60);
    expect(eventsOf(world)).toEqual([
      hitAt('enemy', 1174, 1000, 1, 0),
      destroyedAt('enemy', 1200, 1000),
    ]);
    expect(ahead).toStrictEqual(createShip());
    expect(vitals(astern)).toEqual(afloatWith(40, 40));
    expect(activeShipSlots(world)).toEqual([0, 2]);

    const sturdy = buildConfig();
    sturdy.enemies.shooter.health = 45;
    const engagements = [
      {
        config: sturdy,
        berth: { x: 1200, y: 1000, heading: 256 },
        commands: Command.FireFront,
        wounds: [
          { step: 30, health: 25 },
          { step: 60, health: 5 },
          { step: 90, health: 0 },
        ],
      },
      {
        config: buildConfig(),
        berth: { x: 1000, y: 795, heading: 128 },
        commands: Command.FireLeft,
        wounds: [
          { step: 39, health: 28 },
          { step: 40, health: 4 },
          { step: 99, health: 0 },
        ],
      },
      {
        config: buildConfig(),
        berth: { x: 1000, y: 1205, heading: 384 },
        commands: Command.FireRight,
        wounds: [
          { step: 39, health: 28 },
          { step: 40, health: 4 },
          { step: 99, health: 0 },
        ],
      },
    ];

    for (const { config, berth, commands, wounds } of engagements) {
      const match = createMatch(config, SEED);
      const shooter = shooterAt(match, berth.x, berth.y, berth.heading);

      expect(healthChanges(match, shooter, commands, 150)).toEqual(wounds);
      expect(shooter).toStrictEqual(createShip());
      expect(activeShipSlots(match)).toEqual([0]);
    }
  });

  test("MT-02 a Shooter destroyed by the player's shots gives one point, once", () => {
    const world = createMatch(buildConfig(), SEED);
    const { player } = world;
    const shooter = shooterAt(world, 1200, 1000, 256);

    expect(scoreChanges(world, Command.FireFront, 59)).toEqual([]);
    expect(vitals(shooter)).toEqual(afloatWith(20, 40));
    expect(player.health).toBe(90);
    expect(world.score).toBe(0);

    step(world, Command.FireFront);

    expect(shooter).toStrictEqual(createShip());
    expect(world.score).toBe(1);
    expect(scoreChanges(world, Command.FireFront, 240)).toEqual([]);
    expect(world.score).toBe(1);
    expect(player.health).toBe(90);

    const pair = createMatch(buildConfig(), SEED);
    shooterAt(pair, 1200, 1000, 256);
    shooterAt(pair, 1000, 795, 128);

    expect(scoreChanges(pair, Command.FireFront | Command.FireLeft, 300)).toEqual([
      { step: 60, score: 1 },
      { step: 99, score: 2 },
    ]);
    expect(activeShipSlots(pair)).toEqual([0]);
    expect(pair.player.health).toBe(70);

    const frail = buildConfig();
    frail.enemies.shooter.health = 36;
    const raked = createMatch(frail, SEED);
    const abeam = shooterAt(raked, 1000, 795, 128);

    expect(scoreChanges(raked, Command.FireLeft, 39)).toEqual([]);
    expect(vitals(abeam)).toEqual(afloatWith(24, 36));

    step(raked, Command.FireLeft);

    expect(eventsOf(raked)).toMatchObject([
      { kind: 'hit', layer: 'enemy' },
      { kind: 'hit', layer: 'enemy' },
      { kind: 'destroyed', layer: 'enemy', x: 1000, y: 795 },
    ]);
    expect(abeam).toStrictEqual(createShip());
    expect(raked.score).toBe(1);
    expect(scoreChanges(raked, Command.FireLeft, 200)).toEqual([]);
  });

  test('CB-08 a destroyed Shooter fires no more, and its slot is free', () => {
    const world = createMatch(buildConfig(), SEED);
    const { player } = world;
    const shooter = shooterAt(world, 1200, 1000, 256);

    expect(shooter).toBe(shipAt(world, 1));
    expect(volleySteps(world, Command.FireFront, 59, Layer.Enemy)).toEqual([1]);
    expect(vitals(shooter)).toEqual(afloatWith(20, 40));
    expect(shooter).toMatchObject({ fireFront: 1, frontCooldown: 2 });

    step(world, Command.FireFront);

    expect(eventsOf(world)).toEqual([
      hitAt('enemy', 1174, 1000, 1, 0),
      destroyedAt('enemy', 1200, 1000),
    ]);
    expect(shooter).toStrictEqual(createShip());
    expect(activeShipSlots(world)).toEqual([0]);
    expect(activeProjectileSlots(world)).toEqual([]);

    step(world, Command.FireFront);

    expect(world.step).toBe(COOLDOWN + 1);
    expect(eventsOf(world)).toEqual([shotFiredAt('player', 'front', 1028, 1000, 1, 0)]);
    expect(activeProjectileSlots(world)).toEqual([0]);
    expect(projectileAt(world, 0).layer).toBe('playerShot');

    expect(volleySteps(world, 0, 240, Layer.Enemy)).toEqual([]);
    expect(shooter).toStrictEqual(createShip());
    expect(activeShipSlots(world)).toEqual([0]);
    expect(vitals(player)).toEqual(afloatWith(90, 100));
    expect(world.score).toBe(1);

    const next = shooterAt(world, 800, 1000, 0);

    expect(next).toBe(shooter);
    expect(vitals(next)).toEqual(afloatWith(40, 40));
    expect(next).toMatchObject({ kind: 'shooter', x: 800, y: 1000, frontCooldown: 0 });

    step(world, 0);

    expect(eventsOf(world)).toEqual([shotFiredAt('enemy', 'front', 826, 1000, 1, 0)]);

    const lastShot = createMatch(buildConfig(), SEED);
    const sunkAsItFires = shooterAt(lastShot, 1205, 1000, 256);

    expect(volleySteps(lastShot, Command.FireFront, 60, Layer.Enemy)).toEqual([1]);
    expect(vitals(sunkAsItFires)).toEqual(afloatWith(20, 40));
    expect(sunkAsItFires.frontCooldown).toBe(1);
    expect(lastShot.player.health).toBe(90);

    step(lastShot, Command.FireFront);

    expect(eventsOf(lastShot)).toEqual([
      shotFiredAt('player', 'front', 1028, 1000, 1, 0),
      shotFiredAt('enemy', 'front', 1179, 1000, -1, 0),
      hitAt('enemy', 1179, 1000, 1, 0),
      destroyedAt('enemy', 1205, 1000),
    ]);
    expect(sunkAsItFires).toStrictEqual(createShip());
    expect(activeShipSlots(lastShot)).toEqual([0]);

    expect(blows(lastShot, 0, 240)).toEqual([{ step: 91, layer: 'player' }]);
    expect(lastShot.player.health).toBe(80);
    expect(activeProjectileSlots(lastShot)).toEqual([]);
    expect(lastShot.score).toBe(1);
  });
});
