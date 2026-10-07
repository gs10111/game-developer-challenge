import { describe, expect, test } from 'vitest';
import type { Point } from '../../config/gameConfig';
import { Layer } from '../collision/layers';
import { Command } from '../commands';
import { createMatch } from '../createMatch';
import { acquire } from '../pool';
import { step } from '../step';
import { STEPS_PER_SECOND } from '../stepRate';
import { testWeapons } from '../testing/testWeapons';
import {
  buildConfig,
  cooldowns,
  course,
  eventsOf,
  EVERY_WEAPON,
  flying,
  hold,
  SEED,
  slotAt,
  stamp,
} from '../testing/weaponsHarness';
import { createProjectile } from '../world';
import type { Projectile, Ship, World } from '../world';

const TOLERANCE = 1e-9;
const RADIANS_PER_HEADING_UNIT = (2 * Math.PI) / 512;
const QUARTER_TURN = 128;
const HEADINGS = [0, 37, 64, 128, 200, 256, 300, 384, 450, 505];
const FRONT_MUZZLE = 24 + 4;
const FRONT_STRIDE = 300 / STEPS_PER_SECOND;
const BROADSIDE_MUZZLE = 24 + 3;
const BROADSIDE_STRIDE = 240 / STEPS_PER_SECOND;
const BROADSIDE_SPACING = 16;
const BROADSIDES = [
  { command: Command.FireLeft, quarterTurn: -QUARTER_TURN },
  { command: Command.FireRight, quarterTurn: QUARTER_TURN },
];

interface Squadron {
  world: World;
  raider: Ship;
  neutral: Ship;
}

function rectangle(left: number, top: number, right: number, bottom: number): Point[] {
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

function moor(world: World, x: number, y: number, heading: number): Ship {
  return Object.assign(world.player, { x, y, heading });
}

function launch(world: World, fitting: Partial<Ship>): Ship {
  const ship = acquire(world.ships);
  if (ship === null) {
    throw new Error('The ship pool has no free slot');
  }
  Object.assign(ship, fitting);
  ship.previousX = ship.x;
  ship.previousY = ship.y;
  return ship;
}

function threeSides(): Squadron {
  const armed = { weapons: testWeapons(), fireFront: 1, fireLeft: 1, fireRight: 1 } as const;
  const world = createMatch(buildConfig(), SEED);
  const raider = launch(world, {
    ...armed,
    layer: Layer.Enemy,
    x: 400,
    y: 300,
    heading: QUARTER_TURN,
    radius: 20,
  });
  const neutral = launch(world, { ...armed, x: 1600, y: 1700, heading: 256, radius: 20 });
  return { world, raider, neutral };
}

function sevenOf<Value>(value: Value): Value[] {
  return Array.from({ length: 7 }, () => value);
}

function pose({ x, y, heading }: Ship) {
  return { x, y, heading };
}

function origin({ previousX, previousY, directionX, directionY }: Projectile) {
  return { x: previousX, y: previousY, directionX, directionY };
}

function facing(heading: number, quarterTurn = 0): Point {
  const angle = (Math.round(heading) + quarterTurn) * RADIANS_PER_HEADING_UNIT;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function along(from: Point, direction: Point, distance: number): Point {
  return { x: from.x + direction.x * distance, y: from.y + direction.y * distance };
}

function gap(from: Point, to: Point): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

function expectClose(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(TOLERANCE);
}

function expectAt(actual: Point, expected: Point): void {
  expectClose(actual.x, expected.x);
  expectClose(actual.y, expected.y);
}

function expectFresh(shot: Projectile, muzzle: Point, direction: Point, stride: number): void {
  expect(shot.active).toBe(true);
  expectAt({ x: shot.directionX, y: shot.directionY }, direction);
  expectAt({ x: shot.previousX, y: shot.previousY }, muzzle);
  expectAt(shot, along(muzzle, direction, stride));
}

function expectBroadside(
  world: World,
  firstSlot: number,
  muzzle: Point,
  bow: Point,
  beam: Point,
  spacing = BROADSIDE_SPACING,
  stride = BROADSIDE_STRIDE,
): void {
  for (const [position, place] of [-1, 0, 1].entries()) {
    const shot = slotAt(world, firstSlot + position);

    expectFresh(shot, along(muzzle, bow, place * spacing), beam, stride);
    expectClose(shot.directionX * bow.x + shot.directionY * bow.y, 0);
  }
}

describe('weapons (ADR-0005, ADR-0006)', () => {
  test('PL-02 the front cannon fires one projectile from the bow along the heading', () => {
    const eastward = createMatch(buildConfig(), SEED);
    const holdingFire = createMatch(buildConfig(), SEED);

    step(eastward, Command.FireFront);
    step(holdingFire, Command.Forward | Command.TurnRight);

    expect(flying(eastward)).toEqual([slotAt(eastward, 0)]);
    expect(slotAt(eastward, 0)).toMatchObject({
      x: 1033,
      y: 1000,
      previousX: 1028,
      previousY: 1000,
      directionX: 1,
      directionY: 0,
    });
    expect(flying(holdingFire)).toEqual([]);

    const bearings = [
      { heading: 0, towardX: 1, towardY: 0 },
      { heading: 37, towardX: 1, towardY: 1 },
      { heading: 128, towardX: 0, towardY: 1 },
      { heading: 200, towardX: -1, towardY: 1 },
      { heading: 256, towardX: -1, towardY: 0 },
      { heading: 300, towardX: -1, towardY: -1 },
      { heading: 384, towardX: 0, towardY: -1 },
      { heading: 450, towardX: 1, towardY: -1 },
    ];
    for (const { heading, towardX, towardY } of bearings) {
      const world = createMatch(buildConfig(), SEED);
      world.player.heading = heading;

      step(world, Command.FireFront);

      const shot = slotAt(world, 0);
      expect(flying(world)).toEqual([shot]);
      expect(Math.sign(shot.directionX)).toBe(towardX);
      expect(Math.sign(shot.directionY)).toBe(towardY);
      expect(Math.sign(shot.x - 1000)).toBe(towardX);
      expect(Math.sign(shot.y - 1000)).toBe(towardY);
    }

    for (const heading of HEADINGS) {
      const world = createMatch(buildConfig(), SEED);
      const { player } = world;
      player.heading = heading;
      const bow = facing(heading);

      step(world, Command.FireFront);

      const shot = slotAt(world, 0);
      expect(flying(world)).toEqual([shot]);
      expect(pose(player)).toEqual({ x: 1000, y: 1000, heading });
      expectFresh(shot, along(player, bow, FRONT_MUZZLE), bow, FRONT_STRIDE);
      expectClose(Math.hypot(shot.directionX, shot.directionY), 1);

      step(world, 0);

      expect(flying(world)).toEqual([shot]);
      expectAt(shot, along(player, bow, FRONT_MUZZLE + 2 * FRONT_STRIDE));
    }

    const broadBeamed = buildConfig();
    broadBeamed.player.radius = 31;
    const wide = createMatch(broadBeamed, SEED);

    step(wide, Command.FireFront);

    expect(flying(wide).map(course)).toEqual([{ x: 1040, y: 1000, directionX: 1, directionY: 0 }]);
    expect(slotAt(wide, 0)).toMatchObject({ previousX: 1035, previousY: 1000 });
  });

  test('PL-03 a broadside fires three parallel projectiles from the chosen side, perpendicular to the heading', () => {
    const port = createMatch(buildConfig(), SEED);
    const starboard = createMatch(buildConfig(), SEED);

    step(port, Command.FireLeft);
    step(starboard, Command.FireRight);

    expect(flying(port).map(course)).toEqual([
      { x: 984, y: 969, directionX: 0, directionY: -1 },
      { x: 1000, y: 969, directionX: 0, directionY: -1 },
      { x: 1016, y: 969, directionX: 0, directionY: -1 },
    ]);
    expect(flying(port).map(({ previousY }) => previousY)).toEqual([973, 973, 973]);
    expect(flying(starboard).map(course)).toEqual([
      { x: 984, y: 1031, directionX: 0, directionY: 1 },
      { x: 1000, y: 1031, directionX: 0, directionY: 1 },
      { x: 1016, y: 1031, directionX: 0, directionY: 1 },
    ]);
    expect(flying(starboard).map(({ previousY }) => previousY)).toEqual([1027, 1027, 1027]);

    const southbound = createMatch(buildConfig(), SEED);
    southbound.player.heading = QUARTER_TURN;

    step(southbound, Command.FireLeft | Command.FireRight);

    expect(flying(southbound).map(course)).toEqual([
      { x: 1031, y: 984, directionX: 1, directionY: 0 },
      { x: 1031, y: 1000, directionX: 1, directionY: 0 },
      { x: 1031, y: 1016, directionX: 1, directionY: 0 },
      { x: 969, y: 984, directionX: -1, directionY: 0 },
      { x: 969, y: 1000, directionX: -1, directionY: 0 },
      { x: 969, y: 1016, directionX: -1, directionY: 0 },
    ]);

    for (const { command, quarterTurn } of BROADSIDES) {
      for (const heading of HEADINGS) {
        const world = createMatch(buildConfig(), SEED);
        const { player } = world;
        player.heading = heading;
        const bow = facing(heading);
        const beam = facing(heading, quarterTurn);

        step(world, command);

        const aft = slotAt(world, 0);
        const midships = slotAt(world, 1);
        const fore = slotAt(world, 2);
        expect(flying(world)).toEqual([aft, midships, fore]);
        expect(pose(player)).toEqual({ x: 1000, y: 1000, heading });
        expectBroadside(world, 0, along(player, beam, BROADSIDE_MUZZLE), bow, beam);
        expect(new Set(flying(world).map(({ directionX }) => directionX)).size).toBe(1);
        expect(new Set(flying(world).map(({ directionY }) => directionY)).size).toBe(1);
        expectClose(Math.hypot(midships.directionX, midships.directionY), 1);
        expectAt(midships, along(aft, bow, BROADSIDE_SPACING));
        expectAt(fore, along(midships, bow, BROADSIDE_SPACING));
        expectClose(gap(aft, fore), 2 * BROADSIDE_SPACING);
        expectClose(
          bow.x * midships.directionY - bow.y * midships.directionX,
          Math.sign(quarterTurn),
        );
      }
    }
  });

  test('PL-03 the left and the right broadside are separate commands and can fire in the same step', () => {
    const volleys = [
      { commands: 0, towardY: [] },
      { commands: Command.Forward | Command.TurnLeft | Command.TurnRight, towardY: [] },
      { commands: Command.FireFront, towardY: [0] },
      { commands: Command.FireLeft, towardY: [-1, -1, -1] },
      { commands: Command.FireRight, towardY: [1, 1, 1] },
      { commands: Command.FireLeft | Command.FireRight, towardY: [-1, -1, -1, 1, 1, 1] },
      { commands: Command.FireFront | Command.FireLeft, towardY: [0, -1, -1, -1] },
      { commands: Command.FireFront | Command.FireRight, towardY: [0, 1, 1, 1] },
      { commands: EVERY_WEAPON, towardY: [0, -1, -1, -1, 1, 1, 1] },
    ];
    for (const { commands, towardY } of volleys) {
      const world = createMatch(buildConfig(), SEED);

      step(world, commands);

      expect(flying(world).map(({ directionY }) => directionY)).toEqual(towardY);
    }

    const both = createMatch(buildConfig(), SEED);

    step(both, Command.FireLeft | Command.FireRight);

    expect(flying(both).map(course)).toEqual([
      { x: 984, y: 969, directionX: 0, directionY: -1 },
      { x: 1000, y: 969, directionX: 0, directionY: -1 },
      { x: 1016, y: 969, directionX: 0, directionY: -1 },
      { x: 984, y: 1031, directionX: 0, directionY: 1 },
      { x: 1000, y: 1031, directionX: 0, directionY: 1 },
      { x: 1016, y: 1031, directionX: 0, directionY: 1 },
    ]);

    const oneAfterTheOther = createMatch(buildConfig(), SEED);

    step(oneAfterTheOther, Command.FireLeft);
    step(oneAfterTheOther, Command.FireRight);

    expect(flying(oneAfterTheOther).map(course)).toEqual([
      { x: 984, y: 965, directionX: 0, directionY: -1 },
      { x: 1000, y: 965, directionX: 0, directionY: -1 },
      { x: 1016, y: 965, directionX: 0, directionY: -1 },
      { x: 984, y: 1031, directionX: 0, directionY: 1 },
      { x: 1000, y: 1031, directionX: 0, directionY: 1 },
      { x: 1016, y: 1031, directionX: 0, directionY: 1 },
    ]);
  });

  test('PL-09 the player moves, turns and fires in the same step, and the shot leaves from where the ship is after moving', () => {
    const manoeuvres = [
      Command.Forward | Command.TurnRight,
      Command.Forward | Command.TurnLeft,
      Command.Forward,
      Command.TurnRight,
    ];
    for (const manoeuvre of manoeuvres) {
      for (const stepsUnderWay of [0, 1, 25]) {
        const world = createMatch(buildConfig(), SEED);
        const holdingFire = createMatch(buildConfig(), SEED);
        const { player } = world;
        hold(world, manoeuvre, stepsUnderWay);
        hold(holdingFire, manoeuvre, stepsUnderWay + 1);
        const departure = pose(player);

        step(world, manoeuvre | EVERY_WEAPON);

        const bow = facing(player.heading);
        const port = facing(player.heading, -QUARTER_TURN);
        const starboard = facing(player.heading, QUARTER_TURN);
        expect(pose(player)).toEqual(pose(holdingFire.player));
        expect(pose(player)).not.toEqual(departure);
        expect(flying(world)).toHaveLength(7);
        expectFresh(slotAt(world, 0), along(player, bow, FRONT_MUZZLE), bow, FRONT_STRIDE);
        expectBroadside(world, 1, along(player, port, BROADSIDE_MUZZLE), bow, port);
        expectBroadside(world, 4, along(player, starboard, BROADSIDE_MUZZLE), bow, starboard);
      }
    }

    const world = createMatch(buildConfig(), SEED);

    step(world, Command.Forward | Command.FireFront);

    const shot = slotAt(world, 0);
    expectClose(world.player.x, 1000 + 140 / STEPS_PER_SECOND);
    expectClose(shot.previousX, 1000 + 140 / STEPS_PER_SECOND + FRONT_MUZZLE);
    expectClose(shot.x - shot.previousX, FRONT_STRIDE);
    expect(shot).toMatchObject({ active: true, y: 1000, previousY: 1000, speed: 300 });
  });

  test('CB-03 a projectile takes its speed, radius, damage and lifetime from the weapon that fired it', () => {
    const world = createMatch(buildConfig(), SEED);

    step(world, EVERY_WEAPON);

    const cannonball = slotAt(world, 0);
    const volley = [1, 2, 3, 4, 5, 6].map((position) => slotAt(world, position));
    expect(flying(world)).toEqual([cannonball, ...volley]);
    expect(stamp(cannonball)).toEqual({ speed: 300, radius: 4, damage: 20, remainingSteps: 119 });
    for (const shot of volley) {
      expect(stamp(shot)).toEqual({ speed: 240, radius: 3, damage: 12, remainingSteps: 89 });
    }

    hold(world, 0, 89);

    expect(flying(world)).toEqual([cannonball, ...volley]);
    expect(cannonball).toMatchObject({ x: 1028 + 90 * 5, y: 1000, remainingSteps: 30 });
    expect(volley.map(({ remainingSteps }) => remainingSteps)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(volley.map(({ y }) => y)).toEqual([
      973 - 90 * 4,
      973 - 90 * 4,
      973 - 90 * 4,
      1027 + 90 * 4,
      1027 + 90 * 4,
      1027 + 90 * 4,
    ]);

    step(world, 0);

    expect(flying(world)).toEqual([cannonball]);
    for (const shot of volley) {
      expect(shot).toStrictEqual(createProjectile());
    }

    hold(world, 0, 29);

    expect(cannonball).toMatchObject({
      active: true,
      x: 1028 + 120 * 5,
      y: 1000,
      speed: 300,
      radius: 4,
      damage: 20,
      remainingSteps: 0,
    });

    step(world, 0);

    expect(flying(world)).toEqual([]);
    expect(cannonball).toStrictEqual(createProjectile());

    const config = buildConfig();
    config.player.weapons.front = {
      cooldownSeconds: 0.5,
      projectileSpeed: 180,
      projectileRadius: 6,
      projectileLifetimeSeconds: 0.5,
      damage: 35,
    };
    config.player.weapons.broadside = {
      cooldownSeconds: 1,
      projectileSpeed: 120,
      projectileRadius: 2,
      projectileLifetimeSeconds: 0.25,
      damage: 7,
      spacing: 16,
    };
    const rearmed = createMatch(config, SEED);

    step(rearmed, EVERY_WEAPON);

    expect(flying(rearmed)).toStrictEqual([
      {
        active: true,
        layer: 'playerShot',
        consumed: false,
        x: 1033,
        y: 1000,
        previousX: 1030,
        previousY: 1000,
        directionX: 1,
        directionY: 0,
        speed: 180,
        radius: 6,
        damage: 35,
        remainingSteps: 29,
      },
      ...[984, 1000, 1016].map((x) => ({
        active: true,
        layer: 'playerShot',
        consumed: false,
        x,
        y: 972,
        previousX: x,
        previousY: 974,
        directionX: 0,
        directionY: -1,
        speed: 120,
        radius: 2,
        damage: 7,
        remainingSteps: 14,
      })),
      ...[984, 1000, 1016].map((x) => ({
        active: true,
        layer: 'playerShot',
        consumed: false,
        x,
        y: 1028,
        previousX: x,
        previousY: 1026,
        directionX: 0,
        directionY: 1,
        speed: 120,
        radius: 2,
        damage: 7,
        remainingSteps: 14,
      })),
    ]);

    hold(rearmed, 0, 14);

    expect(flying(rearmed).map(stamp)).toEqual([
      { speed: 180, radius: 6, damage: 35, remainingSteps: 15 },
      ...[1, 2, 3, 4, 5, 6].map(() => ({ speed: 120, radius: 2, damage: 7, remainingSteps: 0 })),
    ]);

    step(rearmed, 0);

    expect(flying(rearmed)).toEqual([slotAt(rearmed, 0)]);

    hold(rearmed, 0, 14);

    expect(slotAt(rearmed, 0)).toMatchObject({ active: true, x: 1030 + 30 * 3, remainingSteps: 0 });

    step(rearmed, 0);

    expect(flying(rearmed)).toEqual([]);
  });

  test('CB-04 a projectile takes the shot layer of the ship that fired it', () => {
    const { world, raider, neutral } = threeSides();
    const sides = [...sevenOf('playerShot'), ...sevenOf('enemyShot'), ...sevenOf(null)];

    step(world, EVERY_WEAPON);

    const shots = flying(world);
    expect([world.player.layer, raider.layer, neutral.layer]).toEqual(['player', 'enemy', null]);
    expect(shots).toHaveLength(21);
    expect(shots.map(({ layer }) => layer)).toEqual(sides);
    expect(shots.map(({ consumed }) => consumed)).toEqual(shots.map(() => false));
    expect(shots.slice(0, 7).map(course)).toEqual([
      { x: 1033, y: 1000, directionX: 1, directionY: 0 },
      { x: 984, y: 969, directionX: 0, directionY: -1 },
      { x: 1000, y: 969, directionX: 0, directionY: -1 },
      { x: 1016, y: 969, directionX: 0, directionY: -1 },
      { x: 984, y: 1031, directionX: 0, directionY: 1 },
      { x: 1000, y: 1031, directionX: 0, directionY: 1 },
      { x: 1016, y: 1031, directionX: 0, directionY: 1 },
    ]);
    expect(shots.slice(7, 14).map(course)).toEqual([
      { x: 400, y: 329, directionX: 0, directionY: 1 },
      { x: 427, y: 284, directionX: 1, directionY: 0 },
      { x: 427, y: 300, directionX: 1, directionY: 0 },
      { x: 427, y: 316, directionX: 1, directionY: 0 },
      { x: 373, y: 284, directionX: -1, directionY: 0 },
      { x: 373, y: 300, directionX: -1, directionY: 0 },
      { x: 373, y: 316, directionX: -1, directionY: 0 },
    ]);
    expect(shots.slice(14).map(course)).toEqual([
      { x: 1571, y: 1700, directionX: -1, directionY: 0 },
      { x: 1616, y: 1727, directionX: 0, directionY: 1 },
      { x: 1600, y: 1727, directionX: 0, directionY: 1 },
      { x: 1584, y: 1727, directionX: 0, directionY: 1 },
      { x: 1616, y: 1673, directionX: 0, directionY: -1 },
      { x: 1600, y: 1673, directionX: 0, directionY: -1 },
      { x: 1584, y: 1673, directionX: 0, directionY: -1 },
    ]);

    hold(world, 0, 20);

    expect(flying(world)).toEqual(shots);
    expect(shots.map(({ layer }) => layer)).toEqual(sides);
    expect(shots.map(({ consumed }) => consumed)).toEqual(shots.map(() => false));
    expect([world.player.layer, raider.layer, neutral.layer]).toEqual(['player', 'enemy', null]);
  });

  test('SC-10 the projectile speed, the lifetime and the broadside spacing follow the config', () => {
    const armouries = [
      { frontSpeed: 300, frontLifetime: 2, sideSpeed: 240, sideLifetime: 1.5, spacing: 16 },
      { frontSpeed: 450, frontLifetime: 0.75, sideSpeed: 120, sideLifetime: 0.5, spacing: 10 },
      { frontSpeed: 90, frontLifetime: 3, sideSpeed: 37.5, sideLifetime: 2.5, spacing: 22.5 },
      { frontSpeed: 600, frontLifetime: 1, sideSpeed: 480, sideLifetime: 1.25, spacing: 32 },
    ];

    for (const { frontSpeed, frontLifetime, sideSpeed, sideLifetime, spacing } of armouries) {
      const config = buildConfig();
      config.player.weapons.front.projectileSpeed = frontSpeed;
      config.player.weapons.front.projectileLifetimeSeconds = frontLifetime;
      config.player.weapons.broadside.projectileSpeed = sideSpeed;
      config.player.weapons.broadside.projectileLifetimeSeconds = sideLifetime;
      config.player.weapons.broadside.spacing = spacing;
      const bow = facing(37);
      const port = facing(37, -QUARTER_TURN);
      const starboard = facing(37, QUARTER_TURN);
      const frontSteps = frontLifetime * STEPS_PER_SECOND;
      const sideSteps = sideLifetime * STEPS_PER_SECOND;
      const sideStride = sideSpeed / STEPS_PER_SECOND;
      const sideStamp = { speed: sideSpeed, radius: 3, damage: 12, remainingSteps: sideSteps - 1 };

      const ahead = createMatch(config, SEED);
      const bowMuzzle = along(moor(ahead, 1000, 1000, 37), bow, FRONT_MUZZLE);

      step(ahead, Command.FireFront);

      const cannonball = slotAt(ahead, 0);
      expect(flying(ahead)).toEqual([cannonball]);
      expect(cannonball).toMatchObject({ speed: frontSpeed, remainingSteps: frontSteps - 1 });
      expectFresh(cannonball, bowMuzzle, bow, frontSpeed / STEPS_PER_SECOND);

      hold(ahead, 0, frontSteps - 1);

      expect(cannonball).toMatchObject({ active: true, remainingSteps: 0 });
      expectAt(cannonball, along(bowMuzzle, bow, frontSpeed * frontLifetime));

      step(ahead, 0);

      expect(flying(ahead)).toEqual([]);

      const abeam = createMatch(config, SEED);
      const portMuzzle = along(moor(abeam, 1000, 1000, 37), port, BROADSIDE_MUZZLE);
      const starboardMuzzle = along(abeam.player, starboard, BROADSIDE_MUZZLE);

      step(abeam, Command.FireLeft | Command.FireRight);

      const volley = flying(abeam);
      expect(volley).toHaveLength(6);
      expect(volley.map(stamp)).toEqual(volley.map(() => sideStamp));
      expectBroadside(abeam, 0, portMuzzle, bow, port, spacing, sideStride);
      expectBroadside(abeam, 3, starboardMuzzle, bow, starboard, spacing, sideStride);
      expectClose(gap(slotAt(abeam, 0), slotAt(abeam, 1)), spacing);
      expectClose(gap(slotAt(abeam, 3), slotAt(abeam, 5)), 2 * spacing);

      hold(abeam, 0, sideSteps - 1);

      expect(flying(abeam)).toEqual(volley);
      expect(volley.map(({ remainingSteps }) => remainingSteps)).toEqual([0, 0, 0, 0, 0, 0]);
      expectAt(slotAt(abeam, 1), along(portMuzzle, port, sideSpeed * sideLifetime));
      expectAt(slotAt(abeam, 4), along(starboardMuzzle, starboard, sideSpeed * sideLifetime));

      step(abeam, 0);

      expect(flying(abeam)).toEqual([]);
    }
  });

  test('FX-01 each shot pushes one event with its weapon, muzzle position and direction', () => {
    const world = createMatch(buildConfig(), SEED);
    const queue = [...world.events.items];

    step(world, EVERY_WEAPON);

    expect(world.events.count).toBe(3);
    expect(eventsOf(world)).toStrictEqual([
      { kind: 'shotFired', layer: 'player', weapon: 'front', x: 1028, y: 1000, directionX: 1, directionY: 0 },
      { kind: 'shotFired', layer: 'player', weapon: 'left', x: 1000, y: 973, directionX: 0, directionY: -1 },
      { kind: 'shotFired', layer: 'player', weapon: 'right', x: 1000, y: 1027, directionX: 0, directionY: 1 },
    ]);
    expect(world.events.items.filter((item, index) => item !== queue[index])).toEqual([]);
    expect(flying(world)).toHaveLength(7);

    step(world, 0);

    expect(world.events.count).toBe(0);
    expect(flying(world)).toHaveLength(7);

    const volleys = [
      { commands: 0, weapons: [] },
      { commands: Command.Forward | Command.TurnLeft, weapons: [] },
      { commands: Command.FireFront, weapons: ['front'] },
      { commands: Command.FireLeft, weapons: ['left'] },
      { commands: Command.FireRight, weapons: ['right'] },
      { commands: Command.FireLeft | Command.FireRight, weapons: ['left', 'right'] },
      { commands: Command.FireFront | Command.FireRight, weapons: ['front', 'right'] },
      { commands: Command.Forward | Command.FireFront, weapons: ['front'] },
      { commands: Command.FireFront | Command.FireLeft, weapons: ['front', 'left'] },
    ];
    for (const { commands, weapons } of volleys) {
      const match = createMatch(buildConfig(), SEED);

      step(match, commands);

      expect(eventsOf(match).map(({ weapon }) => weapon)).toEqual(weapons);
      expect(eventsOf(match).map(({ kind }) => kind)).toEqual(weapons.map(() => 'shotFired'));
    }

    for (const manoeuvre of [0, Command.Forward | Command.TurnRight]) {
      for (const heading of HEADINGS) {
        const match = createMatch(buildConfig(), SEED);
        const { player } = match;
        player.heading = heading;

        step(match, manoeuvre | EVERY_WEAPON);

        const bow = facing(player.heading);
        const port = facing(player.heading, -QUARTER_TURN);
        const starboard = facing(player.heading, QUARTER_TURN);
        const shots = eventsOf(match);
        const [front, left, right] = shots;
        if (front === undefined || left === undefined || right === undefined) {
          throw new Error('A weapon pushed no event');
        }
        expect(shots.map(({ kind, layer, weapon }) => ({ kind, layer, weapon }))).toEqual([
          { kind: 'shotFired', layer: 'player', weapon: 'front' },
          { kind: 'shotFired', layer: 'player', weapon: 'left' },
          { kind: 'shotFired', layer: 'player', weapon: 'right' },
        ]);
        expectAt(front, along(player, bow, FRONT_MUZZLE));
        expectAt({ x: front.directionX, y: front.directionY }, bow);
        expectAt(left, along(player, port, BROADSIDE_MUZZLE));
        expectAt({ x: left.directionX, y: left.directionY }, port);
        expectAt(right, along(player, starboard, BROADSIDE_MUZZLE));
        expectAt({ x: right.directionX, y: right.directionY }, starboard);
        expect(course(front)).toEqual(origin(slotAt(match, 0)));
        expect(course(left)).toEqual(origin(slotAt(match, 2)));
        expect(course(right)).toEqual(origin(slotAt(match, 5)));
      }
    }

    const { world: fleet } = threeSides();

    step(fleet, EVERY_WEAPON);

    expect(eventsOf(fleet)).toStrictEqual([
      { kind: 'shotFired', layer: 'player', weapon: 'front', x: 1028, y: 1000, directionX: 1, directionY: 0 },
      { kind: 'shotFired', layer: 'player', weapon: 'left', x: 1000, y: 973, directionX: 0, directionY: -1 },
      { kind: 'shotFired', layer: 'player', weapon: 'right', x: 1000, y: 1027, directionX: 0, directionY: 1 },
      { kind: 'shotFired', layer: 'enemy', weapon: 'front', x: 400, y: 324, directionX: 0, directionY: 1 },
      { kind: 'shotFired', layer: 'enemy', weapon: 'left', x: 423, y: 300, directionX: 1, directionY: 0 },
      { kind: 'shotFired', layer: 'enemy', weapon: 'right', x: 377, y: 300, directionX: -1, directionY: 0 },
      { kind: 'shotFired', layer: null, weapon: 'front', x: 1576, y: 1700, directionX: -1, directionY: 0 },
      { kind: 'shotFired', layer: null, weapon: 'left', x: 1600, y: 1723, directionX: 0, directionY: 1 },
      { kind: 'shotFired', layer: null, weapon: 'right', x: 1600, y: 1677, directionX: 0, directionY: -1 },
    ]);
  });

  test('CB-06 a shot whose muzzle is inside an island or beyond a wall is removed in the same step, with its event pushed', () => {
    const quay = rectangle(1100, 900, 1300, 1100);

    const openSea = createMatch(buildConfig(), SEED);
    moor(openSea, 1076, 1000, 0);

    step(openSea, Command.FireFront);

    expect(flying(openSea).map(course)).toEqual([
      { x: 1109, y: 1000, directionX: 1, directionY: 0 },
    ]);

    const ashore = createMatch(buildConfig([quay]), SEED);
    moor(ashore, 1076, 1000, 0);

    step(ashore, Command.FireFront);

    expect(flying(ashore)).toEqual([]);
    expect(slotAt(ashore, 0)).toStrictEqual(createProjectile());
    expect(eventsOf(ashore)).toStrictEqual([
      { kind: 'shotFired', layer: 'player', weapon: 'front', x: 1104, y: 1000, directionX: 1, directionY: 0 },
    ]);
    expect(pose(ashore.player)).toEqual({ x: 1076, y: 1000, heading: 0 });
    expect(cooldowns(ashore.player)).toEqual({
      frontCooldown: 30,
      leftCooldown: 0,
      rightCooldown: 0,
    });

    const pressingOn = createMatch(buildConfig([quay]), SEED);
    moor(pressingOn, 1076, 1000, 0);

    step(pressingOn, Command.Forward | Command.FireFront);

    expect(flying(pressingOn)).toEqual([]);
    expect(eventsOf(pressingOn)).toHaveLength(1);
    expect(eventsOf(pressingOn)).toMatchObject([
      { layer: 'player', weapon: 'front', y: 1000, directionX: 1 },
    ]);
    expectClose(eventsOf(pressingOn).at(0)?.x ?? 0, 1076 + 140 / STEPS_PER_SECOND + FRONT_MUZZLE);
    expectClose(pressingOn.player.x, 1076);

    const alongside = createMatch(buildConfig([quay]), SEED);
    moor(alongside, 1076, 1000, 384);

    step(alongside, Command.FireLeft | Command.FireRight);

    expect(flying(alongside).map(course)).toEqual([
      { x: 1045, y: 1016, directionX: -1, directionY: 0 },
      { x: 1045, y: 1000, directionX: -1, directionY: 0 },
      { x: 1045, y: 984, directionX: -1, directionY: 0 },
    ]);
    expect([3, 4, 5].map((position) => slotAt(alongside, position))).toStrictEqual([
      createProjectile(),
      createProjectile(),
      createProjectile(),
    ]);
    expect(eventsOf(alongside)).toStrictEqual([
      { kind: 'shotFired', layer: 'player', weapon: 'left', x: 1049, y: 1000, directionX: -1, directionY: 0 },
      { kind: 'shotFired', layer: 'player', weapon: 'right', x: 1103, y: 1000, directionX: 1, directionY: 0 },
    ]);

    const offTheCorner = createMatch(buildConfig([quay]), SEED);
    moor(offTheCorner, 1090, 874, 0);

    step(offTheCorner, Command.FireRight);

    expect(flying(offTheCorner).map(course)).toEqual([
      { x: 1074, y: 905, directionX: 0, directionY: 1 },
      { x: 1090, y: 905, directionX: 0, directionY: 1 },
    ]);
    expect(slotAt(offTheCorner, 2)).toStrictEqual(createProjectile());
    expect(eventsOf(offTheCorner)).toStrictEqual([
      { kind: 'shotFired', layer: 'player', weapon: 'right', x: 1090, y: 901, directionX: 0, directionY: 1 },
    ]);
    expect(pose(offTheCorner.player)).toEqual({ x: 1090, y: 874, heading: 0 });

    const atTheEastWall = createMatch(buildConfig(), SEED);
    moor(atTheEastWall, 2000 - 24, 1000, 0);

    step(atTheEastWall, Command.FireFront);

    expect(flying(atTheEastWall)).toEqual([]);
    expect(slotAt(atTheEastWall, 0)).toStrictEqual(createProjectile());
    expect(eventsOf(atTheEastWall)).toStrictEqual([
      { kind: 'shotFired', layer: 'player', weapon: 'front', x: 2004, y: 1000, directionX: 1, directionY: 0 },
    ]);

    const atTheNorthWall = createMatch(buildConfig(), SEED);
    moor(atTheNorthWall, 1000, 24, 0);

    step(atTheNorthWall, EVERY_WEAPON);

    expect(flying(atTheNorthWall).map(course)).toEqual([
      { x: 1033, y: 24, directionX: 1, directionY: 0 },
      { x: 984, y: 55, directionX: 0, directionY: 1 },
      { x: 1000, y: 55, directionX: 0, directionY: 1 },
      { x: 1016, y: 55, directionX: 0, directionY: 1 },
    ]);
    expect([1, 2, 3].map((position) => slotAt(atTheNorthWall, position))).toStrictEqual([
      createProjectile(),
      createProjectile(),
      createProjectile(),
    ]);
    expect(eventsOf(atTheNorthWall)).toStrictEqual([
      { kind: 'shotFired', layer: 'player', weapon: 'front', x: 1028, y: 24, directionX: 1, directionY: 0 },
      { kind: 'shotFired', layer: 'player', weapon: 'left', x: 1000, y: -3, directionX: 0, directionY: -1 },
      { kind: 'shotFired', layer: 'player', weapon: 'right', x: 1000, y: 51, directionX: 0, directionY: 1 },
    ]);
    expect(cooldowns(atTheNorthWall.player)).toEqual({
      frontCooldown: 30,
      leftCooldown: 60,
      rightCooldown: 60,
    });
  });
});
