import { describe, expect, test } from 'vitest';
import type { Point } from '../config/gameConfig';
import { Command } from './commands';
import { Layer } from './collision/layers';
import { createMatch } from './createMatch';
import { EventKind, pushEvent, WeaponName } from './events';
import type { GameEvent } from './events';
import { EVENT_QUEUE_CAPACITY } from './limits';
import { acquire } from './pool';
import { spawnChaser } from './spawnEnemy';
import { step } from './step';
import { STEPS_PER_SECOND } from './stepRate';
import { placeEnemy } from './testing/combatHarness';
import { testConfig } from './testing/testConfig';
import { testWeapons } from './testing/testWeapons';
import { createShip } from './world';
import type { Projectile, Ship, World } from './world';

const SEED = 20261007;
const STEPS_OF_THE_LONGEST_MATCH = 10800;

const SCRIPT: readonly (readonly [commands: number, steps: number])[] = [
  [Command.Forward, 60],
  [Command.Forward | Command.TurnRight, 36],
  [Command.Forward | Command.FireFront, 150],
  [Command.TurnLeft, 18],
  [Command.Forward | Command.FireLeft | Command.FireRight, 300],
  [Command.Forward | Command.TurnLeft, 90],
  [Command.Forward | Command.TurnLeft | Command.TurnRight, 45],
  [0, 10],
  [Command.TurnRight | Command.FireRight, 25],
  [Command.Forward, 40],
];

interface Fleet {
  world: World;
  escort: Ship;
  wreck: Ship;
  raider: Ship;
  gunboat: Ship;
  fireship: Ship;
  corsair: Ship;
}

interface Shot extends Projectile {
  berth: number;
}

interface LostShot extends Shot {
  struck: boolean;
}

interface Landing extends Point {
  radius: number;
}

interface Sighting {
  player: Ship;
  escort: Ship;
  raider: Ship;
  gunboat: Ship;
  fireship: Ship;
  corsair: Ship;
  score: number;
  events: GameEvent[];
  flying: Shot[];
}

function rectangle(left: number, top: number, right: number, bottom: number): Point[] {
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

function buildConfig() {
  return testConfig({
    width: 960,
    height: 540,
    islands: [
      rectangle(600, 200, 700, 340),
      rectangle(740, 380, 830, 440),
      [
        { x: 100, y: 40 },
        { x: 200, y: 140 },
        { x: 100, y: 140 },
      ],
    ],
  });
}

function commandLog(): number[] {
  return SCRIPT.flatMap(([commands, steps]) => Array.from({ length: steps }, () => commands));
}

function launch(world: World, course: Partial<Ship>): Ship {
  const ship = acquire(world.ships);
  if (ship === null) {
    throw new Error('The ship pool has no free slot');
  }
  Object.assign(ship, course);
  ship.previousX = ship.x;
  ship.previousY = ship.y;
  return ship;
}

function launchChaser(world: World, x: number, y: number, heading: number): Ship {
  const chaser = spawnChaser(world, x, y, heading);
  if (chaser === null) {
    throw new Error('The ship pool has no free slot');
  }
  return chaser;
}

function slowGuns(frontDamage: number) {
  const guns = testWeapons();
  guns.front.cooldownSeconds = 1.5;
  guns.front.damage = frontDamage;
  guns.broadside.cooldownSeconds = 3;
  return guns;
}

function createFleet(): Fleet {
  const config = buildConfig();
  config.enemies.chaser.health = 2 * config.player.weapons.broadside.damage;
  const world = createMatch(config, SEED);
  const escort = launch(world, { x: 300, y: 100, heading: 256, radius: 30, speed: 50, thrust: 1 });
  const wreck = launch(world, { x: -40, y: 200, radius: 10, speed: 50, thrust: 1 });
  const raider = placeEnemy(world, {
    x: 658,
    y: 437,
    heading: 192,
    weapons: slowGuns(20),
    fireFront: 1,
  });
  const gunboat = placeEnemy(world, {
    x: 861,
    y: 200,
    heading: 128,
    health: 100,
    weapons: slowGuns(10),
    fireFront: 1,
    fireRight: 1,
  });
  const fireship = launchChaser(world, 160, 400, 192);
  const corsair = launchChaser(world, 875, 495, 0);
  wreck.active = false;
  return { world, escort, wreck, raider, gunboat, fireship, corsair };
}

function sight(fleet: Fleet): Sighting {
  const { player, events, projectiles, score } = fleet.world;
  return {
    player: { ...player },
    escort: { ...fleet.escort },
    raider: { ...fleet.raider },
    gunboat: { ...fleet.gunboat },
    fireship: { ...fleet.fireship },
    corsair: { ...fleet.corsair },
    score,
    events: events.items.slice(0, events.count).map((event) => ({ ...event })),
    flying: projectiles.slots.flatMap((slot, berth) => (slot.active ? [{ ...slot, berth }] : [])),
  };
}

function volleys(wake: Sighting[], layer: Layer, weapon: WeaponName): number[] {
  return wake.flatMap(({ events }, index) =>
    events.filter((event) => event.layer === layer && event.weapon === weapon).map(() => index),
  );
}

function blows(wake: Sighting[], layer: Layer): number[] {
  return wake.flatMap(({ events }, index) =>
    events
      .filter((event) => event.kind === EventKind.Hit && event.layer === layer)
      .map(() => index),
  );
}

function range(from: Point, to: Point): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

function run({ x, y, previousX, previousY }: Ship): number {
  return Math.hypot(x - previousX, y - previousY);
}

function sinkings(wake: Sighting[], layer: Layer) {
  return wake.flatMap(({ events, player }, index) =>
    events
      .filter((event) => event.kind === EventKind.Destroyed && event.layer === layer)
      .map((event) => ({ index, x: event.x, y: event.y, range: range(player, event) })),
  );
}

function changes(values: number[]): number[][] {
  return values.flatMap((value, index) =>
    index > 0 && value !== values[index - 1] ? [[index, value]] : [],
  );
}

function strikes(blow: GameEvent, shot: Shot): boolean {
  const along = (blow.x - shot.x) * shot.directionX + (blow.y - shot.y) * shot.directionY;
  const aside = (blow.x - shot.x) * shot.directionY - (blow.y - shot.y) * shot.directionX;
  return (
    blow.kind === EventKind.Hit &&
    blow.directionX === shot.directionX &&
    blow.directionY === shot.directionY &&
    Math.abs(aside) < 1e-9 &&
    along > -1e-9 &&
    along < shot.speed / STEPS_PER_SECOND
  );
}

function lostFrom(wake: Sighting[]): LostShot[] {
  return wake.flatMap(({ flying }, index) => {
    const next = wake[index + 1];
    return next === undefined
      ? []
      : flying
          .filter(({ berth }) => next.flying.every((shot) => shot.berth !== berth))
          .map((shot) => ({ ...shot, struck: next.events.some((blow) => strikes(blow, shot)) }));
  });
}

function landing({ x, y, directionX, directionY, speed, radius }: Shot): Landing {
  return {
    x: x + (directionX * speed) / STEPS_PER_SECOND,
    y: y + (directionY * speed) / STEPS_PER_SECOND,
    radius,
  };
}

function ashore(left: number, top: number, right: number, bottom: number) {
  return ({ x, y, radius }: Landing) =>
    x > left - radius && x < right + radius && y > top - radius && y < bottom + radius;
}

function fates(lost: LostShot[]) {
  const stopped = lost
    .filter(({ remainingSteps, struck }) => remainingSteps > 0 && !struck)
    .map(landing);
  const pastTheSouthWall = stopped.filter(({ y }) => y > 540).length;
  const pastTheEastWall = stopped.filter(({ x }) => x > 960).length;
  const onTheQuay = stopped.filter(ashore(600, 200, 700, 340)).length;
  const onTheCay = stopped.filter(ashore(740, 380, 830, 440)).length;
  return {
    spent: lost.filter(({ remainingSteps }) => remainingSteps === 0).length,
    onAShip: lost.filter(({ remainingSteps, struck }) => remainingSteps > 0 && struck).length,
    pastTheSouthWall,
    pastTheEastWall,
    onTheQuay,
    onTheCay,
    elsewhere: stopped.length - pastTheSouthWall - pastTheEastWall - onTheQuay - onTheCay,
  };
}

describe('simulation step (ADR-0005, ADR-0006)', () => {
  test('PW-03 each step advances the step counter by one', () => {
    const world = createMatch(buildConfig(), SEED);
    const masks = [
      0,
      Command.Forward,
      Command.TurnLeft | Command.FireFront,
      Command.Forward | Command.TurnRight | Command.FireLeft | Command.FireRight,
      0,
    ];

    expect(world.step).toBe(0);
    for (const [index, commands] of masks.entries()) {
      step(world, commands);

      expect(world.step).toBe(index + 1);
      expect(world.commands).toBe(commands);
    }

    for (let count = masks.length; count < STEPS_OF_THE_LONGEST_MATCH; count += 1) {
      step(world, Command.Forward | Command.TurnRight);
    }

    expect(world.step).toBe(STEPS_OF_THE_LONGEST_MATCH);
    expect(world.seed).toBe(SEED);
  });

  test('FX-01 the events of a step are gone when the next step starts', () => {
    const world = createMatch(buildConfig(), SEED);
    const { events } = world;
    const slots = [...events.items];
    pushEvent(events, EventKind.ShotFired, Layer.Player, WeaponName.Front, 508, 270, 1, 0);
    pushEvent(events, EventKind.ShotFired, Layer.Player, WeaponName.Left, 480, 243, 0, -1);
    pushEvent(events, EventKind.ShotFired, Layer.Player, WeaponName.Right, 480, 297, 0, 1);

    expect(events.count).toBe(3);

    step(world, Command.Forward);

    expect(events.count).toBe(0);
    expect(world.events).toBe(events);
    expect(events.items).toHaveLength(EVENT_QUEUE_CAPACITY);
    expect(events.items.filter((item, index) => item !== slots[index])).toEqual([]);
    expect(pushEvent(events, EventKind.ShotFired, Layer.Enemy, WeaponName.Right, 12, 34, 0, 1)).toBe(
      slots[0],
    );
    expect(events.count).toBe(1);
    expect(slots[0]).toStrictEqual({
      kind: 'shotFired',
      layer: 'enemy',
      weapon: 'right',
      x: 12,
      y: 34,
      directionX: 0,
      directionY: 1,
    });

    for (let pushed = events.count; pushed < EVENT_QUEUE_CAPACITY + 5; pushed += 1) {
      pushEvent(events, EventKind.ShotFired, Layer.Player, WeaponName.Left, pushed, 2 * pushed, 0, -1);
    }

    expect(events.count).toBe(EVENT_QUEUE_CAPACITY);

    step(world, 0);

    expect(events.count).toBe(0);
    expect(events.items.filter((item, index) => item !== slots[index])).toEqual([]);

    step(world, Command.TurnLeft);

    expect(events.count).toBe(0);
  });

  test('PW-03 replaying the same seed and command log reproduces the whole world', () => {
    const log = commandLog();
    const original = createFleet();
    const wake = log.map((commands) => {
      step(original.world, commands);
      return sight(original);
    });

    const replayed = createFleet();
    const decoy = createFleet();
    const replayedWake = log.map((commands, index) => {
      step(decoy.world, log.at(-1 - index) ?? 0);
      step(replayed.world, commands);
      return sight(replayed);
    });

    const alongsideTheQuay = wake.filter(
      ({ player }) => player.x === 600 - 24 && player.y > 200 && player.y < 340,
    );
    const alongsideTheCay = wake.filter(
      ({ player }) => player.x === 830 + 24 && player.y > 380 && player.y < 440,
    );
    const roundingTheCay = wake.filter(
      ({ player }) =>
        player.x > 830 &&
        player.y < 380 &&
        Math.abs(Math.hypot(player.x - 830, player.y - 380) - 24) < 1e-9,
    );
    const escortUpTheReef = wake.filter(
      ({ escort }) => escort.x < escort.previousX && escort.y < escort.previousY,
    );
    const escortWedged = wake.filter(
      ({ escort }) => escort.x === original.escort.x && escort.y === original.escort.y,
    );
    const { chaser } = original.world.config.enemies;
    const cruise = chaser.speed / STEPS_PER_SECOND;
    const reach = chaser.radius + original.world.config.player.radius;
    const fireshipUnderWay = wake.filter(({ fireship }) => fireship.active);
    const fireshipSlowed = fireshipUnderWay.filter(
      ({ fireship }) => Math.abs(run(fireship) - cruise) > 1e-9,
    );
    const fireshipHeadings = new Set(fireshipUnderWay.map(({ fireship }) => fireship.heading));
    const fireshipTurns = new Set(fireshipUnderWay.map(({ fireship }) => fireship.turn));
    const fireshipRanges = fireshipUnderWay.map(({ player, fireship }) => range(fireship, player));
    const corsairUnderWay = wake.filter(({ corsair }) => corsair.active);
    const corsairAlongsideTheCay = wake.filter(
      ({ corsair }) => corsair.x === 830 + 20 && corsair.y > 380 && corsair.y < 440,
    );
    const corsairRanges = corsairUnderWay.map(({ player, corsair }) => range(corsair, player));
    const sunk = sinkings(wake, Layer.Enemy);
    const lost = lostFrom(wake);
    const playerShots = lost.filter(({ layer }) => layer === Layer.PlayerShot);
    const enemyShots = lost.filter(({ layer }) => layer === Layer.EnemyShot);

    expect(original.world.step).toBe(log.length);
    expect(new Set(wake.map(({ player }) => player.heading)).size).toBeGreaterThan(100);
    expect(wake.some(({ player }) => player.y === 540 - 24)).toBe(true);
    expect(wake.some(({ player }) => player.x === 960 - 24)).toBe(true);
    expect(alongsideTheQuay.length).toBeGreaterThan(40);
    expect(new Set(alongsideTheQuay.map(({ player }) => player.y)).size).toBeGreaterThan(20);
    expect(alongsideTheCay.length).toBeGreaterThan(40);
    expect(roundingTheCay.length).toBeGreaterThan(3);
    expect(escortUpTheReef.length).toBeGreaterThan(100);
    expect(escortWedged.length).toBeGreaterThan(400);
    expect(original.escort).toMatchObject({ active: true, heading: 256, thrust: 1, turn: 0 });
    expect(original.escort.x).toBeGreaterThan(100 + 30);
    expect(original.escort.x).toBeLessThan(140);
    expect(original.escort.y).toBeGreaterThanOrEqual(30);
    expect(original.escort.y).toBeLessThan(31);
    expect(original.wreck).toMatchObject({ active: false, x: -40, y: 200, thrust: 1 });
    expect(volleys(wake, Layer.Player, WeaponName.Front)).toEqual([96, 126, 156, 186, 216]);
    expect(volleys(wake, Layer.Player, WeaponName.Left)).toEqual([264, 324, 384, 444, 504]);
    expect(volleys(wake, Layer.Player, WeaponName.Right)).toEqual([264, 324, 384, 444, 504, 709]);
    expect(wake[186]?.events).toMatchObject([
      { kind: 'shotFired', layer: 'player', weapon: 'front' },
    ]);
    expect(wake[186]?.flying.filter(({ layer }) => layer === Layer.PlayerShot)).toEqual([]);
    expect(blows(wake, Layer.Enemy)).toEqual([279, 281, 281, 325, 326, 748, 749, 751]);
    expect(blows(wake, Layer.Player)).toEqual([192, 236, 279, 419, 661, 746]);
    expect(wake[0]).toMatchObject({
      player: { health: 100 },
      raider: { health: 30 },
      gunboat: { health: 100 },
      score: 0,
    });
    expect(changes(wake.map(({ raider }) => raider.health))).toEqual([
      [279, 18],
      [281, 0],
    ]);
    expect(changes(wake.map(({ gunboat }) => gunboat.health))).toEqual([
      [748, 88],
      [749, 76],
      [751, 64],
    ]);
    expect(changes(wake.map(({ player }) => player.health))).toEqual([
      [192, 80],
      [236, 55],
      [279, 35],
      [419, 25],
      [661, 15],
      [746, 5],
    ]);
    expect(changes(wake.map(({ score }) => score))).toEqual([
      [281, 1],
      [326, 2],
    ]);
    expect(wake[281]?.events).toMatchObject([
      { kind: 'hit', layer: 'enemy' },
      { kind: 'hit', layer: 'enemy' },
      { kind: 'destroyed', layer: 'enemy', x: 658, y: 437 },
    ]);
    expect(original.raider).toStrictEqual(createShip());
    expect(original.gunboat).toMatchObject({ active: true, layer: 'enemy', health: 64 });
    expect(original.world.player).toMatchObject({ active: true, health: 5, maxHealth: 100 });
    expect(original.world.score).toBe(2);
    expect(wake[0]).toMatchObject({
      fireship: { active: true, layer: 'enemy', kind: 'chaser', health: 24, contactDamage: 25 },
      corsair: { active: true, layer: 'enemy', kind: 'chaser', health: 24, contactDamage: 25 },
    });
    expect(sunk.map(({ index }) => index)).toEqual([236, 281, 326]);
    expect(fireshipUnderWay).toHaveLength(236);
    expect(fireshipUnderWay.at(-1)).toBe(wake[235]);
    expect(fireshipSlowed).toEqual([]);
    expect(fireshipHeadings.size).toBeGreaterThan(50);
    expect(fireshipTurns).toEqual(new Set([-1, 0, 1]));
    expect(Math.min(...fireshipRanges)).toBeGreaterThanOrEqual(reach);
    expect(changes(wake.map(({ fireship }) => fireship.health))).toEqual([[236, 0]]);
    expect(wake[235]).toMatchObject({ player: { health: 80 }, score: 0 });
    expect(wake[236]).toMatchObject({ player: { health: 55 }, score: 0 });
    expect(wake[236]?.events).toMatchObject([
      { kind: 'hit', layer: 'player' },
      { kind: 'destroyed', layer: 'enemy' },
    ]);
    expect(sunk[0]?.x).toBeCloseTo(539.18, 1);
    expect(sunk[0]?.y).toBeCloseTo(493.83, 1);
    expect(sunk[0]?.range).toBeLessThan(reach);
    expect(original.fireship).toStrictEqual(createShip());
    expect(corsairUnderWay).toHaveLength(326);
    expect(corsairUnderWay.at(-1)).toBe(wake[325]);
    expect(corsairAlongsideTheCay.length).toBeGreaterThan(100);
    expect(new Set(corsairAlongsideTheCay.map(({ corsair }) => corsair.y)).size).toBeGreaterThan(
      100,
    );
    expect(Math.min(...corsairRanges)).toBeGreaterThanOrEqual(reach);
    expect(changes(wake.map(({ corsair }) => corsair.health))).toEqual([
      [325, 12],
      [326, 0],
    ]);
    expect(wake[325]?.events).toMatchObject([{ kind: 'hit', layer: 'enemy' }]);
    expect(wake[326]?.events).toMatchObject([
      { kind: 'hit', layer: 'enemy' },
      { kind: 'destroyed', layer: 'enemy' },
    ]);
    expect(wake[325]).toMatchObject({ player: { health: 35 }, score: 1 });
    expect(wake[326]).toMatchObject({ player: { health: 35 }, score: 2 });
    expect(sunk[2]?.x).toBeCloseTo(726.4, 1);
    expect(sunk[2]?.y).toBeCloseTo(491.6, 1);
    expect(sunk[2]?.range).toBeGreaterThan(reach);
    expect(original.corsair).toStrictEqual(createShip());
    expect(volleys(wake, Layer.Enemy, WeaponName.Front)).toEqual([
      0, 0, 90, 90, 180, 180, 270, 270, 360, 450, 540, 630, 720,
    ]);
    expect(volleys(wake, Layer.Enemy, WeaponName.Right)).toEqual([0, 180, 360, 540, 720]);
    expect(fates(playerShots)).toEqual({
      spent: 0,
      onAShip: 8,
      pastTheSouthWall: 13,
      pastTheEastWall: 7,
      onTheQuay: 0,
      onTheCay: 2,
      elsewhere: 0,
    });
    expect(fates(enemyShots)).toEqual({
      spent: 4,
      onAShip: 5,
      pastTheSouthWall: 8,
      pastTheEastWall: 0,
      onTheQuay: 10,
      onTheCay: 0,
      elsewhere: 0,
    });
    expect(wake.at(-1)?.flying).toMatchObject([
      { layer: 'enemyShot', x: 622, y: 184, remainingSteps: 36 },
    ]);

    expect(replayedWake).toEqual(wake);
    expect(replayed.world).toStrictEqual(original.world);
    expect(replayed.world).not.toBe(original.world);
    expect(decoy.world).not.toEqual(original.world);
  });
});
