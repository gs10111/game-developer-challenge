import { describe, expect, test } from 'vitest';
import type { Point } from '../../config/gameConfig';
import { Layer } from '../collision/layers';
import { Command } from '../commands';
import { createMatch } from '../createMatch';
import type { GameEvent } from '../events';
import { cosine, sine } from '../math/rotation';
import { spawnChaser } from '../spawnEnemy';
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
  hold,
  placeEnemy,
  projectileAt,
  SEED,
  shipAt,
  shotFiredAt,
} from '../testing/combatHarness';
import { testWeapons } from '../testing/testWeapons';
import { createShip } from '../world';
import type { Ship, World } from '../world';

const UNITS_PER_TURN = 512;
const TURN_PER_STEP = 4;
const STRIDE = 2;
const CHASER_RADIUS = 20;
const PLAYER_RADIUS = 24;
const PLAYER_BERTH = 1000;
const CONTACT_DISTANCE = 44;
const TURNING_RADIUS = 120 / ((168.75 * Math.PI) / 180);
const STEPS_OF_A_WHOLE_CIRCLE = UNITS_PER_TURN / TURN_PER_STEP;
const TOLERANCE = 1e-9;

interface Berth extends Point {
  heading: number;
}

interface Chase {
  side: number;
  distance: number;
  steps: number;
  reached: boolean;
  health: number;
}

interface ScoreChange {
  step: number;
  score: number;
}

function chaserAt(world: World, x: number, y: number, heading: number): Ship {
  const chaser = spawnChaser(world, x, y, heading);
  if (chaser === null) {
    throw new Error('The ship pool has no free slot');
  }
  return chaser;
}

function moor(world: World, berths: Berth[]): Ship[] {
  return berths.map(({ x, y, heading }) => chaserAt(world, x, y, heading));
}

function berthOf({ x, y }: Ship): Point {
  return { x, y };
}

function vitals({ active, health, maxHealth, pendingDamage }: Ship) {
  return { active, health, maxHealth, pendingDamage };
}

function afloatWith(health: number, maxHealth: number) {
  return { active: true, health, maxHealth, pendingDamage: 0 };
}

function rammedFrom(x: number, y: number, heading: number, hull = CHASER_RADIUS): GameEvent {
  const reach = hull + PLAYER_RADIUS;
  return hitAt(
    'player',
    x + ((PLAYER_BERTH - x) * hull) / reach,
    y + ((PLAYER_BERTH - y) * hull) / reach,
    cosine(heading),
    sine(heading),
  );
}

function distanceBetween(from: Point, to: Point): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

function expectClose(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(TOLERANCE);
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

function chase(side: number, distance: number, budget: number): Chase {
  const world = createMatch(buildConfig(), SEED);
  const chaser = chaserAt(world, 1000, 1000 - side * distance, 0);
  let steps = 0;
  while (chaser.active && steps < budget) {
    step(world, 0);
    steps += 1;
  }
  return { side, distance, steps, reached: !chaser.active, health: world.player.health };
}

describe('Chaser impact (ADR-0006, ADR-0007)', () => {
  test("EN-02 a Chaser that reaches the player takes its contact damage from the player's health and is removed in that step", () => {
    const world = createMatch(buildConfig(), SEED);
    const { player } = world;
    const chaser = chaserAt(world, 1046, 1000, 256);

    step(world, 0);

    expect(chaser).toMatchObject({ active: true, x: 1044, y: 1000, health: 30, exploded: false });
    expect(vitals(player)).toEqual(afloatWith(100, 100));

    step(world, 0);

    expect(vitals(player)).toEqual(afloatWith(75, 100));
    expect(player).toMatchObject({ layer: 'player', kind: 'player', x: 1000, y: 1000 });
    expect(chaser).toStrictEqual(createShip());
    expect(activeShipSlots(world)).toEqual([0]);

    const heavy = buildConfig();
    heavy.enemies.chaser.radius = 30;
    heavy.enemies.chaser.speed = 180;
    heavy.enemies.chaser.contactDamage = 40.5;
    const rammed = createMatch(heavy, SEED);
    const ram = chaserAt(rammed, 1000, 1060, 384);

    expect(healthChanges(rammed, rammed.player, 0, 2)).toEqual([]);
    expect(ram).toMatchObject({ active: true, x: 1000, y: 1054, exploded: false });
    expect(healthChanges(rammed, rammed.player, 0, 10)).toEqual([{ step: 3, health: 59.5 }]);
    expect(ram).toStrictEqual(createShip());
    expect(activeShipSlots(rammed)).toEqual([0]);

    const oblique = createMatch(buildConfig(), SEED);
    const fromTheNorthWest = chaserAt(oblique, 960, 960, 64);

    expect(healthChanges(oblique, oblique.player, 0, 20)).toEqual([{ step: 7, health: 75 }]);
    expect(fromTheNorthWest).toStrictEqual(createShip());

    const becalmed = buildConfig();
    becalmed.enemies.chaser.speed = 0;
    const underWay = createMatch(becalmed, SEED);
    const atAnchor = chaserAt(underWay, 1101, 1000, 256);

    expect(healthChanges(underWay, underWay.player, Command.Forward, 24)).toEqual([]);
    expectClose(underWay.player.x, 1056);
    expect(atAnchor).toMatchObject({ active: true, x: 1101, y: 1000, exploded: false });

    step(underWay, Command.Forward);

    expect(vitals(underWay.player)).toEqual(afloatWith(75, 100));
    expect(atAnchor).toStrictEqual(createShip());
    expect(activeShipSlots(underWay)).toEqual([0]);

    const harmless = createMatch(buildConfig(), SEED);
    const ofNoKind = placeEnemy(harmless, { x: 1030, y: 1000, contactDamage: 25 });
    const ofThePlayersLayer = chaserAt(harmless, 1045, 1000, 256);
    ofThePlayersLayer.layer = Layer.Player;
    const ofNoLayer = chaserAt(harmless, 955, 1000, 0);
    ofNoLayer.layer = null;

    expect(eventfulSteps(harmless, 0, 5)).toEqual([]);
    expect(vitals(harmless.player)).toEqual(afloatWith(100, 100));
    expect(ofNoKind).toMatchObject({ active: true, x: 1030, y: 1000, exploded: false });
    expect(ofThePlayersLayer).toMatchObject({ active: true, x: 1035, y: 1000, exploded: false });
    expect(ofNoLayer).toMatchObject({ active: true, x: 965, y: 1000, exploded: false });
    expect(activeShipSlots(harmless)).toEqual([0, 1, 2, 3]);

    const deserted = createMatch(buildConfig(), SEED);
    const unopposed = chaserAt(deserted, 1045, 1000, 256);
    deserted.player.active = false;

    expect(eventfulSteps(deserted, 0, 5)).toEqual([]);
    expect(unopposed).toMatchObject({ active: true, x: 1035, y: 1000, exploded: false });
    expect(deserted.player).toMatchObject({ active: false, health: 100, pendingDamage: 0 });
  });

  test('EN-02 a Chaser that only touches the player has not reached it', () => {
    const becalmed = buildConfig();
    becalmed.enemies.chaser.speed = 0;
    const broad = buildConfig();
    broad.enemies.chaser.speed = 0;
    broad.enemies.chaser.radius = 26;
    const alongside = [
      { x: 1044, y: 1000, heading: 256 },
      { x: 1000, y: 956, heading: 128 },
      { x: 956, y: 1000, heading: 37 },
      { x: 1000, y: 1044, heading: 300 },
    ];
    const alongsideTheBroadHull = [
      { x: 1030, y: 1040, heading: 0 },
      { x: 970, y: 960, heading: 64 },
      { x: 1040, y: 970, heading: 200 },
      { x: 960, y: 1030, heading: 448 },
      { x: 1050, y: 1000, heading: 256 },
    ];

    for (const { config, berths, reach } of [
      { config: becalmed, berths: alongside, reach: CONTACT_DISTANCE },
      { config: broad, berths: alongsideTheBroadHull, reach: 50 },
    ]) {
      const world = createMatch(config, SEED);
      const touching = moor(world, berths);

      expect(berths.map((berth) => distanceBetween(berth, world.player))).toEqual(
        berths.map(() => reach),
      );
      expect(eventfulSteps(world, 0, STEPS_OF_A_WHOLE_CIRCLE + 10)).toEqual([]);
      expect(vitals(world.player)).toEqual(afloatWith(100, 100));
      expect(touching.map(berthOf)).toEqual(berths.map(({ x, y }) => ({ x, y })));
      for (const chaser of touching) {
        expect(chaser).toMatchObject({ active: true, exploded: false, health: 30, thrust: 1 });
      }
      expect(activeShipSlots(world)).toHaveLength(berths.length + 1);
    }

    const overlaps = [
      { config: becalmed, x: 1043.75, y: 1000, headingOnImpact: 4 },
      { config: becalmed, x: 1000, y: 956.25, headingOnImpact: 4 },
      { config: broad, x: 1029, y: 1040, headingOnImpact: 508 },
      { config: broad, x: 970, y: 961, headingOnImpact: 4 },
    ];
    for (const { config, x, y, headingOnImpact } of overlaps) {
      const world = createMatch(config, SEED);
      const overlapping = chaserAt(world, x, y, 0);

      step(world, 0);

      expect(vitals(world.player)).toEqual(afloatWith(75, 100));
      expect(overlapping).toStrictEqual(createShip());
      expect(eventsOf(world)).toEqual([
        rammedFrom(x, y, headingOnImpact, config.enemies.chaser.radius),
        destroyedAt('enemy', x, y),
      ]);
    }
  });

  test('EN-02 several Chasers that reach the player in the same step each apply their damage', () => {
    const world = createMatch(buildConfig(), SEED);
    const { player } = world;
    const fromTheEast = chaserAt(world, 1045, 1000, 256);
    const fromTheWest = chaserAt(world, 955, 1000, 0);
    const fromTheSouth = chaserAt(world, 1000, 1045, 384);
    const stillOnItsWay = chaserAt(world, 1000, 900, 128);

    step(world, 0);

    expect(vitals(player)).toEqual(afloatWith(25, 100));
    expect(eventsOf(world)).toEqual([
      rammedFrom(1043, 1000, 256),
      rammedFrom(957, 1000, 0),
      rammedFrom(1000, 1043, 384),
      destroyedAt('enemy', 1043, 1000),
      destroyedAt('enemy', 957, 1000),
      destroyedAt('enemy', 1000, 1043),
    ]);
    for (const spent of [fromTheEast, fromTheWest, fromTheSouth]) {
      expect(spent).toStrictEqual(createShip());
    }
    expect(stillOnItsWay).toMatchObject({ active: true, x: 1000, y: 902, exploded: false });
    expect(activeShipSlots(world)).toEqual([0, 4]);
    expect(world.score).toBe(0);

    const pair = createMatch(buildConfig(), SEED);
    chaserAt(pair, 1045, 1000, 256);
    chaserAt(pair, 1049, 1000, 256);
    chaserAt(pair, 955, 1000, 0);
    chaserAt(pair, 951, 1000, 0);

    expect(healthChanges(pair, pair.player, 0, 10)).toEqual([
      { step: 1, health: 50 },
      { step: 3, health: 0 },
    ]);
    expect(activeShipSlots(pair)).toEqual([0]);
  });

  test('EN-01 a Chaser that starts with a still player abeam, on either side, from just outside contact to twice its turning radius, reaches it', () => {
    const chases: Chase[] = [];
    for (const side of [1, -1]) {
      for (let distance = CONTACT_DISTANCE; distance <= 82; distance += 0.5) {
        chases.push(chase(side, distance, STEPS_OF_A_WHOLE_CIRCLE));
      }
    }
    const farthest = Math.max(...chases.map(({ distance }) => distance));
    const toStarboard = chases.filter(({ side }) => side === 1).map(({ steps }) => steps);
    const toPort = chases.filter(({ side }) => side === -1).map(({ steps }) => steps);

    expect(TURNING_RADIUS).toBeLessThan(CONTACT_DISTANCE);
    expect(farthest).toBeGreaterThan(2 * TURNING_RADIUS);
    expect(chases).toHaveLength(2 * 77);
    expect(chases.filter(({ reached, health }) => !reached || health !== 75)).toEqual([]);
    expect(Math.max(...toStarboard)).toBeLessThan(STEPS_OF_A_WHOLE_CIRCLE);
    expect(Math.max(...toStarboard)).toBe(40);
    expect(toStarboard.slice(0, 3)).toEqual([1, 7, 11]);
    expect(toStarboard).toEqual([...toStarboard].sort((fewer, more) => fewer - more));
    expect(toPort).toEqual(toStarboard);
  });

  test("EN-03 a Chaser that explodes on the player adds no point, and one destroyed by the player's shots adds one", () => {
    const rammed = createMatch(buildConfig(), SEED);
    const ram = chaserAt(rammed, 1046, 1000, 256);

    expect(scoreChanges(rammed, 0, 60)).toEqual([]);
    expect(ram).toStrictEqual(createShip());
    expect(vitals(rammed.player)).toEqual(afloatWith(75, 100));
    expect(rammed.score).toBe(0);

    const blownUp = createMatch(buildConfig(), SEED);
    const holed = chaserAt(blownUp, 300, 1000, 0);
    holed.exploded = true;
    holed.pendingDamage = 30;
    step(blownUp, 0);

    expect(eventsOf(blownUp)).toEqual([destroyedAt('enemy', 302, 1000)]);
    expect(holed).toStrictEqual(createShip());
    expect(blownUp.score).toBe(0);

    const shotDown = createMatch(buildConfig(), SEED);
    const prize = chaserAt(shotDown, 1300, 1000, 256);

    expect(scoreChanges(shotDown, Command.FireFront, 120)).toEqual([{ step: 57, score: 1 }]);
    expect(prize).toStrictEqual(createShip());
    expect(vitals(shotDown.player)).toEqual(afloatWith(100, 100));
    expect(shotDown.score).toBe(1);

    const both = createMatch(buildConfig(), SEED);
    chaserAt(both, 954, 1000, 0);
    chaserAt(both, 1300, 1000, 256);

    expect(healthChanges(both, both.player, Command.FireFront, 1)).toEqual([]);
    expect(healthChanges(both, both.player, Command.FireFront, 1)).toEqual([
      { step: 2, health: 75 },
    ]);
    expect(both.score).toBe(0);
    expect(scoreChanges(both, Command.FireFront, 118)).toEqual([{ step: 57, score: 1 }]);
    expect(vitals(both.player)).toEqual(afloatWith(75, 100));
    expect(activeShipSlots(both)).toEqual([0]);
  });

  test("EN-03 a Chaser that the player's shots bring to zero in the step it would reach the player does not explode: no damage to the player, and the point is given", () => {
    const heavyGuns = buildConfig();
    heavyGuns.player.weapons.front.damage = 30;

    const unopposed = createMatch(heavyGuns, SEED);
    const ram = chaserAt(unopposed, 1047, 1000, 256);
    step(unopposed, 0);

    expect(ram).toMatchObject({ active: true, x: 1045, y: 1000, health: 30 });
    expect(eventsOf(unopposed)).toEqual([]);

    step(unopposed, 0);

    expect(eventsOf(unopposed)).toEqual([
      rammedFrom(1043, 1000, 256),
      destroyedAt('enemy', 1043, 1000),
    ]);
    expect(vitals(unopposed.player)).toEqual(afloatWith(75, 100));
    expect(unopposed.score).toBe(0);
    expect(ram).toStrictEqual(createShip());

    const world = createMatch(heavyGuns, SEED);
    const chaser = chaserAt(world, 1047, 1000, 256);
    step(world, 0);

    expect(chaser).toMatchObject({ active: true, x: 1045, y: 1000, health: 30 });

    step(world, Command.FireFront);

    expect(eventsOf(world)).toEqual([
      shotFiredAt('player', 'front', 1028, 1000, 1, 0),
      hitAt('enemy', 1028, 1000, 1, 0),
      destroyedAt('enemy', 1043, 1000),
    ]);
    expect(vitals(world.player)).toEqual(afloatWith(100, 100));
    expect(world.score).toBe(1);
    expect(chaser).toStrictEqual(createShip());
    expect(activeShipSlots(world)).toEqual([0]);
    expect(activeProjectileSlots(world)).toEqual([]);

    expect(eventfulSteps(world, 0, 30)).toEqual([]);
    expect(vitals(world.player)).toEqual(afloatWith(100, 100));
    expect(world.score).toBe(1);

    const abeam = createMatch(buildConfig(), SEED);
    const boarder = chaserAt(abeam, 1000, 953, 128);
    step(abeam, 0);

    expect(boarder).toMatchObject({ active: true, x: 1000, y: 955, health: 30 });

    step(abeam, Command.FireLeft);

    expect(eventsOf(abeam)).toEqual([
      shotFiredAt('player', 'left', 1000, 973, 0, -1),
      hitAt('enemy', 984, 973, 0, -1),
      hitAt('enemy', 1000, 973, 0, -1),
      hitAt('enemy', 1016, 973, 0, -1),
      destroyedAt('enemy', 1000, 957),
    ]);
    expect(vitals(abeam.player)).toEqual(afloatWith(100, 100));
    expect(abeam.score).toBe(1);
    expect(boarder).toStrictEqual(createShip());
  });

  test('EN-02 a Chaser hit but not destroyed in the step it reaches the player still explodes, with no point', () => {
    const almost = testWeapons();
    almost.front.damage = 29.5;
    const nearMiss = buildConfig();
    nearMiss.player.weapons = almost;

    for (const config of [buildConfig(), nearMiss]) {
      const world = createMatch(config, SEED);
      const chaser = chaserAt(world, 1047, 1000, 256);
      step(world, 0);

      expect(chaser).toMatchObject({ active: true, x: 1045, y: 1000, health: 30 });

      step(world, Command.FireFront);

      expect(eventsOf(world)).toEqual([
        shotFiredAt('player', 'front', 1028, 1000, 1, 0),
        hitAt('enemy', 1028, 1000, 1, 0),
        rammedFrom(1043, 1000, 256),
        destroyedAt('enemy', 1043, 1000),
      ]);
      expect(vitals(world.player)).toEqual(afloatWith(75, 100));
      expect(world.score).toBe(0);
      expect(chaser).toStrictEqual(createShip());
      expect(activeShipSlots(world)).toEqual([0]);
      expect(activeProjectileSlots(world)).toEqual([]);

      expect(scoreChanges(world, 0, 30)).toEqual([]);
      expect(vitals(world.player)).toEqual(afloatWith(75, 100));
    }
  });

  test('CB-08 a Chaser that has exploded is gone: its slot is free and it damages nothing in the next step', () => {
    const world = createMatch(buildConfig(), SEED);
    const { player } = world;
    const chaser = chaserAt(world, 1045, 1000, 256);

    expect(chaser).toBe(shipAt(world, 1));

    step(world, 0);

    expect(vitals(player)).toEqual(afloatWith(75, 100));
    expect(chaser).toStrictEqual(createShip());
    expect(activeShipSlots(world)).toEqual([0]);

    step(world, Command.FireFront);

    expect(vitals(player)).toEqual(afloatWith(75, 100));
    expect(eventsOf(world)).toEqual([shotFiredAt('player', 'front', 1028, 1000, 1, 0)]);
    expect(flight(projectileAt(world, 0))).toEqual(flyingAt(1033, 1000));
    expect(chaser).toStrictEqual(createShip());

    expect(eventfulSteps(world, 0, 60)).toEqual([]);
    expect(vitals(player)).toEqual(afloatWith(75, 100));
    expect(flight(projectileAt(world, 0))).toEqual(flyingAt(1033 + 60 * 5, 1000));
    expect(activeShipSlots(world)).toEqual([0]);
    expect(world.score).toBe(0);

    const next = chaserAt(world, 1000, 1049, 384);

    expect(next).toBe(chaser);
    expect(next).toMatchObject({ active: true, kind: 'chaser', health: 30, exploded: false });

    hold(world, 0, 2);

    expect(next).toMatchObject({ active: true, x: 1000, y: 1045, exploded: false });
    expect(vitals(player)).toEqual(afloatWith(75, 100));

    step(world, 0);

    expect(vitals(player)).toEqual(afloatWith(50, 100));
    expect(next).toStrictEqual(createShip());
    expect(eventsOf(world)).toEqual([
      rammedFrom(1000, 1043, 384),
      destroyedAt('enemy', 1000, 1043),
    ]);

    expect(eventfulSteps(world, 0, 60)).toEqual([]);
    expect(vitals(player)).toEqual(afloatWith(50, 100));
  });

  test('FX-02 an exploding Chaser pushes one destroyed event with the enemy layer and its position', () => {
    const world = createMatch(buildConfig(), SEED);
    chaserAt(world, 1046, 1000, 256);

    step(world, 0);

    expect(eventsOf(world)).toEqual([]);

    step(world, 0);

    expect(eventsOf(world)).toStrictEqual([
      rammedFrom(1042, 1000, 256),
      {
        kind: 'destroyed',
        layer: 'enemy',
        weapon: null,
        x: 1042,
        y: 1000,
        directionX: 0,
        directionY: 0,
      },
    ]);

    step(world, 0);

    expect(eventsOf(world)).toEqual([]);
    expect(eventfulSteps(world, 0, 30)).toEqual([]);

    const oblique = createMatch(buildConfig(), SEED);
    const fromTheNorthWest = chaserAt(oblique, 960, 960, 64);

    expect(eventfulSteps(oblique, 0, 6)).toEqual([]);

    const lastSeen = berthOf(fromTheNorthWest);
    step(oblique, 0);
    const [blow, explosion, ...others] = eventsOf(oblique);
    if (explosion === undefined) {
      throw new Error('The Chaser pushed no destroyed event');
    }

    expect(others).toEqual([]);
    expect(blow).toStrictEqual(rammedFrom(explosion.x, explosion.y, 64));
    expect(explosion).toMatchObject({
      kind: 'destroyed',
      layer: 'enemy',
      weapon: null,
      directionX: 0,
      directionY: 0,
    });
    expectClose(explosion.x, 960 + 7 * STRIDE * Math.SQRT1_2);
    expectClose(explosion.y, 960 + 7 * STRIDE * Math.SQRT1_2);
    expectClose(distanceBetween(lastSeen, explosion), STRIDE);
    expect(distanceBetween(lastSeen, oblique.player)).toBeGreaterThan(CONTACT_DISTANCE);
    expect(distanceBetween(explosion, oblique.player)).toBeLessThan(CONTACT_DISTANCE);
    expect(fromTheNorthWest).toStrictEqual(createShip());
    expect(eventfulSteps(oblique, 0, 30)).toEqual([]);
  });

  test('FX-04 a Chaser that reaches the player pushes a hit event with the player layer at the point of contact and along its heading, before its destroyed event', () => {
    const world = createMatch(buildConfig(), SEED);
    const ram = chaserAt(world, 1035, 1000, 256);

    step(world, 0);

    expect(eventsOf(world)).toStrictEqual([
      {
        kind: 'hit',
        layer: 'player',
        weapon: null,
        x: 1018,
        y: 1000,
        directionX: -1,
        directionY: 0,
      },
      {
        kind: 'destroyed',
        layer: 'enemy',
        weapon: null,
        x: 1033,
        y: 1000,
        directionX: 0,
        directionY: 0,
      },
    ]);
    expect(vitals(world.player)).toEqual(afloatWith(75, 100));
    expect(ram).toStrictEqual(createShip());

    step(world, 0);

    expect(eventsOf(world)).toEqual([]);

    const rudderless = buildConfig();
    rudderless.enemies.chaser.turnRateDegrees = 0;
    const crossed = createMatch(rudderless, SEED);
    chaserAt(crossed, 1035, 1011, 256);

    step(crossed, 0);

    expect(eventsOf(crossed)).toStrictEqual([
      hitAt('player', 1018, 1006, -1, 0),
      destroyedAt('enemy', 1033, 1011),
    ]);

    const pair = createMatch(buildConfig(), SEED);
    chaserAt(pair, 1000, 1035, 384);
    chaserAt(pair, 1035, 1000, 256);

    step(pair, 0);

    expect(eventsOf(pair)).toStrictEqual([
      hitAt('player', 1000, 1018, 0, -1),
      hitAt('player', 1018, 1000, -1, 0),
      destroyedAt('enemy', 1000, 1033),
      destroyedAt('enemy', 1033, 1000),
    ]);
    expect(vitals(pair.player)).toEqual(afloatWith(50, 100));

    const alongside = createMatch(buildConfig(), SEED);
    const touching = chaserAt(alongside, 1046, 1000, 256);

    step(alongside, 0);

    expect(touching).toMatchObject({ active: true, x: 1044, y: 1000, exploded: false });
    expect(eventsOf(alongside)).toEqual([]);
    expect(vitals(alongside.player)).toEqual(afloatWith(100, 100));

    const heavyGuns = buildConfig();
    heavyGuns.player.weapons.front.damage = 30;
    const shotDown = createMatch(heavyGuns, SEED);
    const prize = chaserAt(shotDown, 1035, 1000, 256);

    step(shotDown, Command.FireFront);

    expect(eventsOf(shotDown)).toStrictEqual([
      shotFiredAt('player', 'front', 1028, 1000, 1, 0),
      hitAt('enemy', 1028, 1000, 1, 0),
      destroyedAt('enemy', 1033, 1000),
    ]);
    expect(vitals(shotDown.player)).toEqual(afloatWith(100, 100));
    expect(shotDown.score).toBe(1);
    expect(prize).toStrictEqual(createShip());
  });

  test("PL-04 the player's health stops at zero under impacts and the player stays in the match", () => {
    const frail = buildConfig();
    frail.player.health = 60;
    const world = createMatch(frail, SEED);
    const { player } = world;
    moor(world, [
      { x: 1045, y: 1000, heading: 256 },
      { x: 1049, y: 1000, heading: 256 },
      { x: 1053, y: 1000, heading: 256 },
      { x: 1057, y: 1000, heading: 256 },
    ]);
    const beforeTheImpacts = { ...player };

    expect(healthChanges(world, player, 0, 4)).toEqual([
      { step: 1, health: 35 },
      { step: 3, health: 10 },
    ]);
    expect(activeShipSlots(world)).toEqual([0, 3, 4]);

    step(world, 0);

    expect(eventsOf(world)).toEqual([
      rammedFrom(1043, 1000, 256),
      destroyedAt('player', 1000, 1000),
      destroyedAt('enemy', 1043, 1000),
    ]);
    expect(vitals(player)).toEqual(afloatWith(0, 60));
    expect(player).toStrictEqual({ ...beforeTheImpacts, health: 0 });
    expect(activeShipSlots(world)).toEqual([0, 4]);

    step(world, 0);

    expect(eventsOf(world)).toEqual([]);

    step(world, 0);

    expect(eventsOf(world)).toEqual([
      rammedFrom(1043, 1000, 256),
      destroyedAt('enemy', 1043, 1000),
    ]);
    expect(vitals(player)).toEqual(afloatWith(0, 60));
    expect(player).toStrictEqual({ ...beforeTheImpacts, health: 0 });
    expect(world.player).toBe(player);
    expect(shipAt(world, 0)).toBe(player);
    expect(activeShipSlots(world)).toEqual([0]);
    expect(world.score).toBe(0);

    expect(eventfulSteps(world, 0, 10)).toEqual([]);
    expect(player).toStrictEqual({ ...beforeTheImpacts, health: 0 });

    const swarmed = createMatch(buildConfig(), SEED);
    moor(swarmed, [
      { x: 1045, y: 1000, heading: 256 },
      { x: 955, y: 1000, heading: 0 },
      { x: 1000, y: 1045, heading: 384 },
      { x: 1000, y: 955, heading: 128 },
      { x: 1045, y: 1000, heading: 256 },
    ]);

    step(swarmed, 0);

    expect(vitals(swarmed.player)).toEqual(afloatWith(0, 100));
    expect(swarmed.player).toMatchObject({ layer: 'player', kind: 'player', x: 1000, y: 1000 });
    expect(eventsOf(swarmed).map(({ kind, layer }) => ({ kind, layer }))).toEqual([
      { kind: 'hit', layer: 'player' },
      { kind: 'hit', layer: 'player' },
      { kind: 'hit', layer: 'player' },
      { kind: 'hit', layer: 'player' },
      { kind: 'hit', layer: 'player' },
      { kind: 'destroyed', layer: 'player' },
      { kind: 'destroyed', layer: 'enemy' },
      { kind: 'destroyed', layer: 'enemy' },
      { kind: 'destroyed', layer: 'enemy' },
      { kind: 'destroyed', layer: 'enemy' },
      { kind: 'destroyed', layer: 'enemy' },
    ]);
    expect(activeShipSlots(swarmed)).toEqual([0]);
    expect(swarmed.score).toBe(0);
  });
});
