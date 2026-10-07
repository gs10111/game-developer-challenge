import { describe, expect, test } from 'vitest';
import type { ConvexPolygon, GameConfig, Point } from '../../../config/gameConfig';
import { Command } from '../../commands';
import { createMatch } from '../../createMatch';
import { acquire } from '../../pool';
import { step } from '../../step';
import { STEPS_PER_SECOND } from '../../stepRate';
import { testPlayer } from '../../testing/testPlayer';
import type { Ship, World } from '../../world';

const SEED = 20261007;
const TOLERANCE = 1e-9;
const RADIANS_PER_HEADING_UNIT = (2 * Math.PI) / 512;
const STRIDE = 140 / STEPS_PER_SECOND;

const DRIVE: readonly (readonly [commands: number, steps: number])[] = [
  [Command.Forward | Command.TurnLeft, 250],
  [Command.Forward, 90],
  [Command.Forward | Command.TurnRight, 140],
  [Command.Forward, 240],
  [Command.Forward | Command.TurnRight, 95],
  [Command.Forward | Command.TurnLeft, 35],
  [Command.Forward, 50],
];
const DRIVE_LAPS = 12;
const STEPS_OF_THE_LONGEST_MATCH = 10800;

function rectangle(left: number, top: number, right: number, bottom: number): Point[] {
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

function buildConfig(islands: ConvexPolygon[]) {
  return {
    arena: { width: 960, height: 540, islands },
    player: { ...testPlayer(), turnRateDegrees: 90 },
  } satisfies GameConfig;
}

function distanceToSegment(start: Point, end: Point, x: number, y: number): number {
  const edgeX = end.x - start.x;
  const edgeY = end.y - start.y;
  const along = ((x - start.x) * edgeX + (y - start.y) * edgeY) / (edgeX * edgeX + edgeY * edgeY);
  const nearest = Math.min(Math.max(along, 0), 1);
  return Math.hypot(x - (start.x + nearest * edgeX), y - (start.y + nearest * edgeY));
}

function distanceToPart(part: ConvexPolygon, x: number, y: number): number {
  let toTheShore = Infinity;
  let inside = true;
  for (const [edge, start] of part.entries()) {
    const end = part[(edge + 1) % part.length] ?? start;
    toTheShore = Math.min(toTheShore, distanceToSegment(start, end, x, y));
    inside &&= (end.x - start.x) * (y - start.y) - (end.y - start.y) * (x - start.x) > 0;
  }
  return inside ? -toTheShore : toTheShore;
}

function overlapOf(world: World, ship: Ship): number {
  return Math.max(
    ...world.config.arena.islands.map(
      (part) => ship.radius - distanceToPart(part, ship.x, ship.y),
    ),
  );
}

function isInsideTheArena(world: World, ship: Ship): boolean {
  const { arena } = world.config;
  return (
    ship.x - ship.radius >= 0 &&
    ship.x + ship.radius <= arena.width &&
    ship.y - ship.radius >= 0 &&
    ship.y + ship.radius <= arena.height
  );
}

function strideOf(ship: Ship): Point {
  const angle = Math.round(ship.heading) * RADIANS_PER_HEADING_UNIT;
  const length = (ship.thrust * ship.speed) / STEPS_PER_SECOND;
  return { x: length * Math.cos(angle), y: length * Math.sin(angle) };
}

function hold(world: World, commands: number, steps: number): void {
  for (let count = 0; count < steps; count += 1) {
    step(world, commands);
  }
}

function holdInsideTheArenaAndOutOfTheIslands(
  world: World,
  ship: Ship,
  commands: number,
  steps: number,
): void {
  for (let count = 0; count < steps; count += 1) {
    step(world, commands);

    expect(isInsideTheArena(world, ship)).toBe(true);
    expect(overlapOf(world, ship)).toBeLessThanOrEqual(TOLERANCE);
  }
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

function expectClose(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(TOLERANCE);
}

function expectTouching(world: World, ship: Ship): void {
  expect(Math.abs(overlapOf(world, ship))).toBeLessThanOrEqual(TOLERANCE);
}

describe('island collision (ADR-0007)', () => {
  test('PL-06 the player driven straight into a shore stops with its hull touching it', () => {
    const islands = [
      rectangle(600, 200, 700, 340),
      rectangle(410, 400, 550, 460),
      rectangle(260, 200, 360, 340),
      rectangle(410, 80, 550, 140),
    ];
    const shores = [
      { quarterTurnsRight: 0, x: 600 - 24, y: 270, xSailedBack: 600 - 24 - 70, ySailedBack: 270 },
      { quarterTurnsRight: 1, x: 480, y: 400 - 24, xSailedBack: 480, ySailedBack: 400 - 24 - 70 },
      { quarterTurnsRight: 2, x: 360 + 24, y: 270, xSailedBack: 360 + 24 + 70, ySailedBack: 270 },
      { quarterTurnsRight: 3, x: 480, y: 140 + 24, xSailedBack: 480, ySailedBack: 140 + 24 + 70 },
    ];

    for (const shore of shores) {
      const world = createMatch(buildConfig(islands), SEED);
      const { player } = world;

      hold(world, Command.TurnRight, shore.quarterTurnsRight * STEPS_PER_SECOND);
      holdInsideTheArenaAndOutOfTheIslands(world, player, Command.Forward, 2 * STEPS_PER_SECOND);

      expectClose(player.x, shore.x);
      expectClose(player.y, shore.y);
      expectTouching(world, player);

      holdInsideTheArenaAndOutOfTheIslands(world, player, Command.Forward, STEPS_PER_SECOND);

      expectClose(player.x, shore.x);
      expectClose(player.y, shore.y);
      expectTouching(world, player);

      hold(world, Command.TurnRight, 2 * STEPS_PER_SECOND);
      hold(world, Command.Forward, STEPS_PER_SECOND / 2);

      expectClose(player.x, shore.xSailedBack);
      expectClose(player.y, shore.ySailedBack);
    }
  });

  test('PL-06 the player driven into a shore at an angle slides along it and never enters the island', () => {
    const quay = rectangle(600, 60, 700, 500);
    const reef = [
      { x: 860, y: 60 },
      { x: 860, y: 460 },
      { x: 560, y: 460 },
    ];
    const courses = [
      { island: quay, outward: { x: -1, y: 0 }, heading: 40, steps: 180 },
      { island: quay, outward: { x: -1, y: 0 }, heading: 440, steps: 110 },
      { island: reef, outward: { x: -0.8, y: -0.6 }, heading: 0, steps: 240 },
      { island: reef, outward: { x: -0.8, y: -0.6 }, heading: 490, steps: 190 },
      { island: reef, outward: { x: -0.8, y: -0.6 }, heading: 80, steps: 120 },
    ];

    for (const { island, outward, heading, steps } of courses) {
      const world = createMatch(buildConfig([island]), SEED);
      const { player } = world;
      let alongside = 0;
      let slid = 0;
      player.heading = heading;

      for (let count = 0; count < steps; count += 1) {
        const fromX = player.x;
        const fromY = player.y;

        step(world, Command.Forward);

        const stride = strideOf(player);
        const movedX = player.x - fromX;
        const movedY = player.y - fromY;
        const movedAlongShore = movedY * outward.x - movedX * outward.y;
        const overlap = overlapOf(world, player);

        expect(overlap).toBeLessThanOrEqual(TOLERANCE);
        expectClose(movedAlongShore, stride.y * outward.x - stride.x * outward.y);
        if (alongside > 0) {
          expect(overlap).toBeGreaterThanOrEqual(-TOLERANCE);
          expectClose(movedX * outward.x + movedY * outward.y, 0);
          slid += Math.abs(movedAlongShore);
        }
        if (alongside > 0 || overlap >= -TOLERANCE) {
          alongside += 1;
        } else {
          expectClose(movedX, stride.x);
          expectClose(movedY, stride.y);
        }
      }

      expect(alongside).toBeGreaterThan(30);
      expect(slid).toBeGreaterThan(25);
    }
  });

  test('PL-06 the player rounds the corner of an island without entering it', () => {
    const island = rectangle(560, 200, 700, 340);
    const capes = [
      { heading: 472, corner: { x: 560, y: 200 }, pastTheShore: (y: number) => y < 200 },
      { heading: 40, corner: { x: 560, y: 340 }, pastTheShore: (y: number) => y > 340 },
    ];

    for (const { heading, corner, pastTheShore } of capes) {
      const world = createMatch(buildConfig([island]), SEED);
      const { player } = world;
      let alongside = 0;
      let rounding = 0;
      let clear = 0;
      player.heading = heading;

      for (let count = 0; count < 150; count += 1) {
        const fromX = player.x;
        const fromY = player.y;

        step(world, Command.Forward);

        const overlap = overlapOf(world, player);
        const touching = overlap >= -TOLERANCE;

        expect(overlap).toBeLessThanOrEqual(TOLERANCE);
        if (touching && pastTheShore(player.y)) {
          rounding += 1;

          expect(alongside).toBeGreaterThan(20);
          expect(clear).toBe(0);
          expect(player.x).toBeLessThan(corner.x);
          expectClose(Math.hypot(player.x - corner.x, player.y - corner.y), player.radius);
        } else if (touching) {
          alongside += 1;

          expect(rounding).toBe(0);
          expectClose(player.x, corner.x - player.radius);
        } else if (rounding > 0) {
          clear += 1;

          expectClose(Math.hypot(player.x - fromX, player.y - fromY), STRIDE);
        }
      }

      expect(rounding).toBeGreaterThan(8);
      expect(clear).toBeGreaterThan(40);
      expect(player.x).toBeGreaterThan(corner.x + player.radius);
      expect(pastTheShore(player.y)).toBe(true);
      expect(player.heading).toBe(heading);
    }
  });

  test('PL-06 the player never overlaps an island during a long scripted drive among several parts', () => {
    const islands = [
      rectangle(128, 0, 384, 128),
      rectangle(256, 128, 384, 256),
      rectangle(640, 384, 896, 540),
      [
        { x: 704, y: 64 },
        { x: 832, y: 128 },
        { x: 736, y: 192 },
      ],
      rectangle(128, 384, 256, 512),
    ];
    const world = createMatch(buildConfig(islands), SEED);
    const { player } = world;
    const entered: { step: number; part: number; overlap: number }[] = [];
    const outside: number[] = [];
    const touched = new Set<number>();
    const berths = new Set<string>();
    let alongside = 0;
    let inTheInnerCorner = 0;

    for (let lap = 0; lap < DRIVE_LAPS; lap += 1) {
      for (const [commands, steps] of DRIVE) {
        for (let count = 0; count < steps; count += 1) {
          step(world, commands);

          let touching = 0;
          for (const [part, polygon] of islands.entries()) {
            const overlap = player.radius - distanceToPart(polygon, player.x, player.y);

            if (!(overlap <= TOLERANCE)) {
              entered.push({ step: world.step, part, overlap });
            } else if (overlap >= -TOLERANCE) {
              touched.add(part);
              touching += 1;
            }
          }
          if (!isInsideTheArena(world, player)) {
            outside.push(world.step);
          }
          if (touching > 0) {
            alongside += 1;
            berths.add(`${String(Math.round(player.x))} ${String(Math.round(player.y))}`);
          }
          if (touching > 1) {
            inTheInnerCorner += 1;

            expectClose(player.x, 256 - player.radius);
            expectClose(player.y, 128 + player.radius);
          }
        }
      }
    }

    expect(entered).toEqual([]);
    expect(outside).toEqual([]);
    expect(world.step).toBe(STEPS_OF_THE_LONGEST_MATCH);
    expect([...touched].sort()).toEqual([0, 1, 2, 3, 4]);
    expect(alongside).toBeGreaterThan(2000);
    expect(berths.size).toBeGreaterThan(1000);
    expect(inTheInnerCorner).toBeGreaterThan(100);
  });

  test('PL-06 the player slides across the seam between two flush parts in both directions, at a steep and at a shallow angle, at the along-shore speed of its movement', () => {
    const crossings = [
      { heading: 100, seam: 480 + 30 },
      { heading: 12, seam: 480 + 80 },
      { heading: 156, seam: 480 - 30 },
      { heading: 244, seam: 480 - 80 },
    ];

    for (const { heading, seam } of crossings) {
      const west = rectangle(seam - 300, 300, seam, 400);
      const east = rectangle(seam, 300, seam + 300, 400);
      const alongShore = STRIDE * Math.cos(heading * RADIANS_PER_HEADING_UNIT);

      for (const islands of [
        [west, east],
        [east, west],
      ]) {
        const world = createMatch(buildConfig(islands), SEED);
        const { player } = world;
        let alongsideWest = 0;
        let alongsideEast = 0;
        player.heading = heading;

        for (let count = 0; count < 90; count += 1) {
          const fromX = player.x;

          step(world, Command.Forward);

          const overlap = overlapOf(world, player);

          expect(overlap).toBeLessThanOrEqual(TOLERANCE);
          expectClose(player.x - fromX, alongShore);
          if (overlap >= -TOLERANCE) {
            alongsideWest += player.x < seam ? 1 : 0;
            alongsideEast += player.x > seam ? 1 : 0;

            expectClose(player.y, 300 - player.radius);
          } else {
            expect(alongsideWest + alongsideEast).toBe(0);
          }
        }

        expect(Math.abs(alongShore)).toBeGreaterThan(0.75);
        expect(alongsideWest).toBeGreaterThan(10);
        expect(alongsideEast).toBeGreaterThan(10);
      }
    }
  });

  test('PL-06 a ship wedged in a corner narrower than its hull goes back to where it was and can still turn', () => {
    const notch = [rectangle(560, 130, 700, 250), rectangle(560, 290, 700, 410)];
    const world = createMatch(buildConfig(notch), SEED);
    const { player } = world;
    const xTouchingBothCorners = 560 - Math.sqrt(24 * 24 - 20 * 20);
    const turnPerStep = 128 / STEPS_PER_SECOND;

    holdInsideTheArenaAndOutOfTheIslands(world, player, Command.Forward, STEPS_PER_SECOND);
    const wedgedX = player.x;

    expect(wedgedX).toBeLessThanOrEqual(xTouchingBothCorners);
    expect(wedgedX).toBeGreaterThan(xTouchingBothCorners - STRIDE);
    expect(player.y).toBe(270);

    for (let count = 0; count < STEPS_PER_SECOND; count += 1) {
      step(world, Command.Forward);

      expect(player).toMatchObject({ x: wedgedX, y: 270, heading: 0, thrust: 1 });
      expect(overlapOf(world, player)).toBeLessThanOrEqual(TOLERANCE);
    }

    for (let count = 1; count <= 8; count += 1) {
      step(world, Command.Forward | Command.TurnRight);

      expect(player).toMatchObject({ x: wedgedX, y: 270, thrust: 1 });
      expectClose(player.heading, count * turnPerStep);
    }

    hold(world, Command.TurnRight, 2 * STEPS_PER_SECOND - 8);
    holdInsideTheArenaAndOutOfTheIslands(world, player, Command.Forward, STEPS_PER_SECOND);

    expectClose(player.heading, 256);
    expectClose(player.x, wedgedX - 140);
    expectClose(player.y, 270);
  });

  test('PL-05 a ship pushed by an island that touches the wall stays inside the arena and out of the island', () => {
    const quay = rectangle(600, 300, 800, 540);
    const docking = createMatch(buildConfig([quay]), SEED);
    docking.player.heading = 64;

    holdInsideTheArenaAndOutOfTheIslands(docking, docking.player, Command.Forward, 240);

    expectClose(docking.player.x, 600 - 24);
    expectClose(docking.player.y, 540 - 24);
    expectTouching(docking, docking.player);

    const leaningQuay = [
      { x: 600, y: 300 },
      { x: 800, y: 300 },
      { x: 800, y: 540 },
      { x: 600.0002, y: 540 },
    ];
    const leaning = createMatch(buildConfig([leaningQuay]), SEED);
    leaning.player.heading = 64;

    holdInsideTheArenaAndOutOfTheIslands(leaning, leaning.player, Command.Forward, 240);

    expectTouching(leaning, leaning.player);
    expect(leaning.player.y).toBeLessThanOrEqual(540 - 24);
    expect(leaning.player.y).toBeGreaterThan(540 - 24 - STRIDE);
    expect(leaning.player.x).toBeGreaterThan(600 - 24);
    expect(leaning.player.x).toBeLessThan(600.0002 - 24);

    const overhang = [
      { x: 560, y: 0 },
      { x: 700, y: 0 },
      { x: 440, y: 120 },
    ];
    const xTouchingTheOverhang = 440 + 120 - 24 - 24 * Math.SQRT2;
    const world = createMatch(buildConfig([overhang]), SEED);
    const sloop = launch(world, { x: 300, y: 24, radius: 24, speed: 140, thrust: 1 });

    holdInsideTheArenaAndOutOfTheIslands(world, sloop, 0, 180);

    expect(sloop.x).toBeLessThanOrEqual(xTouchingTheOverhang);
    expect(sloop.x).toBeGreaterThan(xTouchingTheOverhang - STRIDE);
    expect(sloop).toMatchObject({ y: 24, heading: 0, thrust: 1 });

    sloop.heading = 256;
    holdInsideTheArenaAndOutOfTheIslands(world, sloop, 0, 60);

    expect(sloop.x).toBeLessThan(xTouchingTheOverhang - 140);
    expect(sloop.y).toBe(24);
  });

  test('CB-02 every active ship is blocked by the islands, and an inactive slot is left where it is', () => {
    const world = createMatch(buildConfig([rectangle(600, 100, 700, 440)]), SEED);
    const brig = launch(world, { x: 860, y: 150, heading: 256, radius: 40, speed: 200, thrust: 1 });
    const sloop = launch(world, { x: 650, y: 520, heading: 384, radius: 8, speed: 200, thrust: 1 });
    const cutter = launch(world, { x: 500, y: 60, heading: 64, radius: 16, speed: 100, thrust: 1 });
    const wreck = launch(world, { x: 650, y: 270, radius: 10, speed: 50, thrust: 1 });
    const hulk = launch(world, { x: 500, y: 400, radius: 30, speed: 200, thrust: 1 });
    wreck.active = false;
    wreck.previousX = 500;
    wreck.previousY = 60;
    hulk.active = false;

    for (let count = 0; count < 4 * STEPS_PER_SECOND; count += 1) {
      step(world, Command.Forward);

      for (const ship of [world.player, brig, sloop, cutter]) {
        expect(overlapOf(world, ship)).toBeLessThanOrEqual(TOLERANCE);
      }
    }

    expectClose(world.player.x, 600 - 24);
    expectClose(world.player.y, 270);
    expectClose(brig.x, 700 + 40);
    expectClose(brig.y, 150);
    expectClose(sloop.x, 650);
    expectClose(sloop.y, 440 + 8);
    expectClose(cutter.x, 600 - 16);
    expect(cutter.y).toBeGreaterThan(200);
    for (const ship of [world.player, brig, sloop, cutter]) {
      expectTouching(world, ship);
    }
    expect(wreck).toMatchObject({ active: false, x: 650, y: 270, previousX: 500, previousY: 60 });
    expect(hulk).toMatchObject({ active: false, x: 500, y: 400, previousX: 500, previousY: 400 });
    expect(overlapOf(world, wreck)).toBeGreaterThan(10);
  });

  test('SC-10 moving an island in the config moves where the player stops', () => {
    const berths = [
      { island: rectangle(600, 200, 700, 340), quarterTurnsRight: 0, x: 600 - 24, y: 270 },
      { island: rectangle(650, 200, 750, 340), quarterTurnsRight: 0, x: 650 - 24, y: 270 },
      { island: rectangle(537.5, 100, 800, 500), quarterTurnsRight: 0, x: 537.5 - 24, y: 270 },
      { island: rectangle(400, 380, 560, 480), quarterTurnsRight: 1, x: 480, y: 380 - 24 },
      { island: rectangle(400, 431.25, 560, 480), quarterTurnsRight: 1, x: 480, y: 431.25 - 24 },
      { island: rectangle(100, 200, 310, 340), quarterTurnsRight: 2, x: 310 + 24, y: 270 },
    ];

    for (const berth of berths) {
      const world = createMatch(buildConfig([berth.island]), SEED);

      hold(world, Command.TurnRight, berth.quarterTurnsRight * STEPS_PER_SECOND);
      hold(world, Command.Forward, 3 * STEPS_PER_SECOND);

      expectClose(world.player.x, berth.x);
      expectClose(world.player.y, berth.y);
    }
  });
});
