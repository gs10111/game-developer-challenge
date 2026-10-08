import { describe, expect, test } from 'vitest';
import { Command } from '../commands';
import { createMatch } from '../createMatch';
import { PROJECTILE_POOL_CAPACITY } from '../limits';
import { acquire, release } from '../pool';
import { step } from '../step';
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
import type { Projectile, Ship, World } from '../world';

const STEPS_OF_THE_LONGEST_MATCH = 10800;

interface ShotLog {
  front: number[];
  left: number[];
  right: number[];
  created: number[];
}

function launch(world: World, fitting: Partial<Ship>): Ship {
  const ship = acquire(world.ships);
  if (ship === null) {
    throw new Error('The ship pool has no free slot');
  }
  return Object.assign(ship, fitting);
}

function crowd(world: World, berths: number[] = []): void {
  const pool = world.projectiles;
  for (let count = 0; count < PROJECTILE_POOL_CAPACITY; count += 1) {
    const parked = acquire(pool);
    if (parked === null) {
      throw new Error('The projectile pool has no free slot');
    }
    Object.assign(parked, {
      x: 300,
      y: 300,
      previousX: 300,
      previousY: 300,
      directionX: 1,
      directionY: 0,
      radius: 1,
      damage: 1,
      remainingSteps: STEPS_OF_THE_LONGEST_MATCH,
    });
  }
  for (const position of berths) {
    release(pool, slotAt(world, position));
  }
}

function newcomers(world: World) {
  return world.projectiles.slots.flatMap((slot, position) =>
    slot.speed === 0 ? [] : [{ slot: position, x: slot.x, y: slot.y }],
  );
}

function shotSteps(world: World, steps: number, commandsAt: (index: number) => number): ShotLog {
  const log: ShotLog = { front: [], left: [], right: [], created: [] };
  for (let count = 0; count < steps; count += 1) {
    const index = world.step;
    const wasFlying = world.projectiles.slots.map(({ active }) => active);
    step(world, commandsAt(index));
    for (const { weapon } of eventsOf(world)) {
      if (weapon === null) {
        throw new Error('An event of a weapons step carries no weapon');
      }
      log[weapon].push(index);
    }
    for (const [position, slot] of world.projectiles.slots.entries()) {
      if (slot.active && wasFlying[position] !== true) {
        log.created.push(index);
      }
    }
  }
  return log;
}

function stepsOfRemoval(world: World, shots: Projectile[], limit: number): (number | null)[] {
  const removedAt: (number | null)[] = shots.map(() => null);
  while (world.step < limit) {
    const index = world.step;
    step(world, 0);
    for (const [position, shot] of shots.entries()) {
      if (!shot.active && removedAt[position] === null) {
        removedAt[position] = index;
      }
    }
  }
  return removedAt;
}

function every(period: number, until: number): number[] {
  const indices: number[] = [];
  for (let index = 0; index < until; index += period) {
    indices.push(index);
  }
  return indices;
}

function times(count: number, indices: number[]): number[] {
  return indices.flatMap((index) => Array.from({ length: count }, () => index));
}

describe('weapons (ADR-0005, ADR-0006)', () => {
  test('CB-07 a held fire command shoots on the first step and then exactly every cooldown, with no shot between', () => {
    const ahead = shotSteps(createMatch(buildConfig(), SEED), 200, () => Command.FireFront);
    const toPort = shotSteps(createMatch(buildConfig(), SEED), 200, () => Command.FireLeft);
    const toStarboard = shotSteps(createMatch(buildConfig(), SEED), 200, () => Command.FireRight);

    expect(ahead).toEqual({
      front: [0, 30, 60, 90, 120, 150, 180],
      left: [],
      right: [],
      created: [0, 30, 60, 90, 120, 150, 180],
    });
    expect(toPort).toEqual({
      front: [],
      left: [0, 60, 120, 180],
      right: [],
      created: [0, 0, 0, 60, 60, 60, 120, 120, 120, 180, 180, 180],
    });
    expect(toStarboard).toEqual({
      front: [],
      left: [],
      right: [0, 60, 120, 180],
      created: [0, 0, 0, 60, 60, 60, 120, 120, 120, 180, 180, 180],
    });

    const underWay = createMatch(buildConfig(), SEED);
    const manoeuvre = Command.Forward | Command.TurnLeft;
    hold(underWay, manoeuvre, 13);

    expect(shotSteps(underWay, 100, () => manoeuvre | EVERY_WEAPON)).toEqual({
      front: [13, 43, 73, 103],
      left: [13, 73],
      right: [13, 73],
      created: [...times(7, [13]), 43, ...times(7, [73]), 103],
    });
  });

  test('CB-07 a cooldown that is not a whole number of steps rounds to the nearest step, and one below a step fires every step', () => {
    const cooldownsInSeconds = [
      { seconds: 0.24, shots: [0, 14, 28, 42, 56] },
      { seconds: 0.26, shots: [0, 16, 32, 48, 64] },
      { seconds: 0.125, shots: [0, 8, 16, 24, 32] },
      { seconds: 0.99, shots: [0, 59, 118, 177, 236] },
      { seconds: 1.01, shots: [0, 61, 122, 183, 244] },
      { seconds: 1 / 60, shots: [0, 1, 2, 3, 4] },
      { seconds: 0.012, shots: [0, 1, 2, 3, 4] },
      { seconds: 0.005, shots: [0, 1, 2, 3, 4] },
    ];

    for (const { seconds, shots } of cooldownsInSeconds) {
      const config = buildConfig();
      config.player.weapons.front.cooldownSeconds = seconds;
      config.player.weapons.broadside.cooldownSeconds = seconds;
      const span = (shots.at(-1) ?? 0) + 1;
      const bothSides = Command.FireLeft | Command.FireRight;

      const ahead = shotSteps(createMatch(config, SEED), span, () => Command.FireFront);
      const abeam = shotSteps(createMatch(config, SEED), span, () => bothSides);

      expect(ahead).toEqual({ front: shots, left: [], right: [], created: shots });
      expect(abeam).toEqual({ front: [], left: shots, right: shots, created: times(6, shots) });
    }
  });

  test('CB-07 a weapon is ready when the match starts, and a command released during the cooldown fires nothing', () => {
    const atOnce = shotSteps(createMatch(buildConfig(), SEED), 1, () => EVERY_WEAPON);
    const afterAWait = shotSteps(createMatch(buildConfig(), SEED), 50, (index) =>
      index === 41 ? EVERY_WEAPON : 0,
    );

    expect(atOnce).toEqual({ front: [0], left: [0], right: [0], created: times(7, [0]) });
    expect(afterAWait).toEqual({ front: [41], left: [41], right: [41], created: times(7, [41]) });

    const triggers = [
      { held: (index: number) => index === 0, front: [0], sides: [0] },
      {
        held: (index: number) => index === 0 || (index >= 10 && index <= 12),
        front: [0],
        sides: [0],
      },
      { held: (index: number) => index === 0 || index === 29, front: [0], sides: [0] },
      { held: (index: number) => index === 0 || index === 30, front: [0, 30], sides: [0] },
      { held: (index: number) => index === 0 || index === 59, front: [0, 59], sides: [0] },
      { held: (index: number) => index === 0 || index === 60, front: [0, 60], sides: [0, 60] },
      {
        held: (index: number) => index === 0 || (index >= 20 && index < 70),
        front: [0, 30, 60],
        sides: [0, 60],
      },
      {
        held: (index: number) => index === 0 || (index >= 10 && index <= 12) || index >= 45,
        front: [0, 45, 75, 105, 135, 165, 195],
        sides: [0, 60, 120, 180],
      },
    ];
    for (const { held, front, sides } of triggers) {
      const log = shotSteps(createMatch(buildConfig(), SEED), 200, (index) =>
        held(index) ? EVERY_WEAPON : 0,
      );

      expect(log).toMatchObject({ front, left: sides, right: sides });
    }

    const world = createMatch(buildConfig(), SEED);
    const { player } = world;

    expect(cooldowns(player)).toEqual({ frontCooldown: 0, leftCooldown: 0, rightCooldown: 0 });

    step(world, EVERY_WEAPON);

    expect(cooldowns(player)).toEqual({ frontCooldown: 30, leftCooldown: 60, rightCooldown: 60 });

    step(world, 0);

    expect(cooldowns(player)).toEqual({ frontCooldown: 29, leftCooldown: 59, rightCooldown: 59 });

    hold(world, 0, 28);

    expect(cooldowns(player)).toEqual({ frontCooldown: 1, leftCooldown: 31, rightCooldown: 31 });

    step(world, 0);

    expect(cooldowns(player)).toEqual({ frontCooldown: 0, leftCooldown: 30, rightCooldown: 30 });

    hold(world, 0, 100);

    expect(cooldowns(player)).toEqual({ frontCooldown: 0, leftCooldown: 0, rightCooldown: 0 });
    expect(flying(world)).toEqual([]);
  });

  test('CB-07 the front cannon and each broadside keep their own cooldown', () => {
    const together = shotSteps(createMatch(buildConfig(), SEED), 130, () => EVERY_WEAPON);
    const staggered = shotSteps(
      createMatch(buildConfig(), SEED),
      150,
      (index) =>
        Command.FireFront |
        (index >= 7 ? Command.FireLeft : 0) |
        (index >= 19 ? Command.FireRight : 0),
    );
    const inTurn = shotSteps(
      createMatch(buildConfig(), SEED),
      20,
      (index) => [Command.FireLeft, Command.FireRight, Command.FireFront][index] ?? 0,
    );

    expect(together).toMatchObject({
      front: [0, 30, 60, 90, 120],
      left: [0, 60, 120],
      right: [0, 60, 120],
    });
    expect(staggered).toMatchObject({
      front: [0, 30, 60, 90, 120],
      left: [7, 67, 127],
      right: [19, 79, 139],
    });
    expect(inTurn).toEqual({ front: [2], left: [0], right: [1], created: [0, 0, 0, 1, 1, 1, 2] });
  });

  test('SC-10 the cooldown follows the config', () => {
    const armouries = [
      { front: 0.5, broadside: 1, ahead: [0, 30, 60, 90, 120, 150, 180], abeam: [0, 60, 120, 180] },
      { front: 0.2, broadside: 0.75, ahead: every(12, 200), abeam: [0, 45, 90, 135, 180] },
      { front: 1.5, broadside: 0.25, ahead: [0, 90, 180], abeam: every(15, 200) },
      { front: 2, broadside: 3, ahead: [0, 120], abeam: [0, 180] },
    ];

    for (const { front, broadside, ahead, abeam } of armouries) {
      const config = buildConfig();
      config.player.weapons.front.cooldownSeconds = front;
      config.player.weapons.broadside.cooldownSeconds = broadside;

      const log = shotSteps(createMatch(config, SEED), 200, () => EVERY_WEAPON);

      expect(log).toMatchObject({ front: ahead, left: abeam, right: abeam });
    }
  });

  test('CB-06 a lifetime that is not a whole number of steps rounds to the nearest step', () => {
    const lifetimes = [
      { seconds: 0.24, steps: 14 },
      { seconds: 0.26, steps: 16 },
      { seconds: 0.125, steps: 8 },
      { seconds: 0.99, steps: 59 },
      { seconds: 1.01, steps: 61 },
      { seconds: 1 / 60, steps: 1 },
      { seconds: 0.012, steps: 1 },
      { seconds: 0.005, steps: 1 },
    ];

    for (const { seconds, steps } of lifetimes) {
      const config = buildConfig();
      config.player.weapons.front.projectileLifetimeSeconds = seconds;
      config.player.weapons.broadside.projectileLifetimeSeconds = seconds;
      const world = createMatch(config, SEED);

      step(world, EVERY_WEAPON);

      const shots = flying(world);
      expect(shots).toHaveLength(7);
      expect(shots.map(({ remainingSteps }) => remainingSteps)).toEqual(times(7, [steps - 1]));

      hold(world, 0, steps - 1);

      expect(world.step).toBe(steps);
      expect(flying(world)).toEqual(shots);
      expect(shots.map(({ remainingSteps }) => remainingSteps)).toEqual(times(7, [0]));
      expect(slotAt(world, 0)).toMatchObject({ x: 1028 + steps * 5, y: 1000 });
      expect(slotAt(world, 2)).toMatchObject({ x: 1000, y: 973 - steps * 4 });
      expect(slotAt(world, 5)).toMatchObject({ x: 1000, y: 1027 + steps * 4 });
      expect(stepsOfRemoval(world, shots, steps + 5)).toEqual(times(7, [steps]));
      expect(flying(world)).toEqual([]);
    }
  });

  test('CB-07 with the projectile pool full a shot creates nothing, starts its cooldown and pushes no event, and a broadside with one or two free slots creates only those and pushes its event', () => {
    const bothSides = Command.FireLeft | Command.FireRight;
    const berths = [
      { free: [], commands: Command.FireFront, shots: [], weapons: [], cooling: [30, 0, 0] },
      { free: [], commands: bothSides, shots: [], weapons: [], cooling: [0, 60, 60] },
      { free: [], commands: EVERY_WEAPON, shots: [], weapons: [], cooling: [30, 60, 60] },
      {
        free: [9],
        commands: Command.FireFront,
        shots: [{ slot: 9, x: 1033, y: 1000 }],
        weapons: ['front'],
        cooling: [30, 0, 0],
      },
      {
        free: [9],
        commands: Command.FireLeft,
        shots: [{ slot: 9, x: 984, y: 969 }],
        weapons: ['left'],
        cooling: [0, 60, 0],
      },
      {
        free: [9],
        commands: Command.FireRight,
        shots: [{ slot: 9, x: 984, y: 1031 }],
        weapons: ['right'],
        cooling: [0, 0, 60],
      },
      {
        free: [9, 200],
        commands: Command.FireLeft,
        shots: [
          { slot: 9, x: 984, y: 969 },
          { slot: 200, x: 1000, y: 969 },
        ],
        weapons: ['left'],
        cooling: [0, 60, 0],
      },
      {
        free: [9, 200],
        commands: EVERY_WEAPON,
        shots: [
          { slot: 9, x: 1033, y: 1000 },
          { slot: 200, x: 984, y: 969 },
        ],
        weapons: ['front', 'left'],
        cooling: [30, 60, 60],
      },
      {
        free: [9, 100, 200],
        commands: bothSides,
        shots: [
          { slot: 9, x: 984, y: 969 },
          { slot: 100, x: 1000, y: 969 },
          { slot: 200, x: 1016, y: 969 },
        ],
        weapons: ['left'],
        cooling: [0, 60, 60],
      },
      {
        free: [9, 100, 200, 255],
        commands: bothSides,
        shots: [
          { slot: 9, x: 984, y: 969 },
          { slot: 100, x: 1000, y: 969 },
          { slot: 200, x: 1016, y: 969 },
          { slot: 255, x: 984, y: 1031 },
        ],
        weapons: ['left', 'right'],
        cooling: [0, 60, 60],
      },
    ];

    for (const { free, commands, shots, weapons, cooling } of berths) {
      const world = createMatch(buildConfig(), SEED);
      crowd(world, free);

      step(world, commands);

      const { frontCooldown, leftCooldown, rightCooldown } = world.player;
      expect(newcomers(world)).toEqual(shots);
      expect(eventsOf(world).map(({ weapon }) => weapon)).toEqual(weapons);
      expect([frontCooldown, leftCooldown, rightCooldown]).toEqual(cooling);
      expect(flying(world)).toHaveLength(PROJECTILE_POOL_CAPACITY - free.length + shots.length);
    }

    const oneBerth = createMatch(buildConfig(), SEED);
    crowd(oneBerth, [9]);

    step(oneBerth, Command.FireLeft);

    expect(eventsOf(oneBerth)).toStrictEqual([
      { kind: 'shotFired', layer: 'player', weapon: 'left', x: 1000, y: 973, directionX: 0, directionY: -1 },
    ]);
    expect(slotAt(oneBerth, 9)).toStrictEqual({
      active: true,
      layer: 'playerShot',
      consumed: false,
      x: 984,
      y: 969,
      previousX: 984,
      previousY: 973,
      directionX: 0,
      directionY: -1,
      speed: 240,
      radius: 3,
      damage: 12,
      remainingSteps: 89,
    });

    const becalmed = createMatch(buildConfig(), SEED);
    crowd(becalmed);

    step(becalmed, EVERY_WEAPON);

    expect(becalmed.events.count).toBe(0);
    expect(newcomers(becalmed)).toEqual([]);

    for (const position of [5, 6, 7, 8, 9, 10, 11, 12]) {
      release(becalmed.projectiles, slotAt(becalmed, position));
    }

    expect(shotSteps(becalmed, 70, () => EVERY_WEAPON)).toEqual({
      front: [30, 60],
      left: [60],
      right: [60],
      created: [30, ...times(7, [60])],
    });
    expect(newcomers(becalmed).map(({ slot }) => slot)).toEqual([5, 6, 7, 8, 9, 10, 11, 12]);
  });

  test('CB-07 a ship without weapons fires nothing', () => {
    const trigger = { fireFront: 1, fireLeft: 1, fireRight: 1 } as const;
    const guns = testWeapons();
    guns.front.cooldownSeconds = 0.25;
    guns.front.projectileSpeed = 180;
    guns.front.damage = 9;
    guns.broadside.damage = 5;
    guns.broadside.spacing = 10;
    const world = createMatch(buildConfig(), SEED);
    const merchant = launch(world, { x: 400, y: 400, heading: 128, radius: 20, ...trigger });
    const frigate = launch(world, {
      x: 1500,
      y: 400,
      heading: 256,
      radius: 30,
      ...trigger,
      weapons: guns,
    });
    const wreck = launch(world, {
      x: 400,
      y: 1500,
      radius: 20,
      ...trigger,
      frontCooldown: 5,
      leftCooldown: 6,
      rightCooldown: 7,
      weapons: testWeapons(),
    });
    wreck.active = false;

    step(world, EVERY_WEAPON);

    expect(flying(world).map(course)).toEqual([
      { x: 1033, y: 1000, directionX: 1, directionY: 0 },
      { x: 984, y: 969, directionX: 0, directionY: -1 },
      { x: 1000, y: 969, directionX: 0, directionY: -1 },
      { x: 1016, y: 969, directionX: 0, directionY: -1 },
      { x: 984, y: 1031, directionX: 0, directionY: 1 },
      { x: 1000, y: 1031, directionX: 0, directionY: 1 },
      { x: 1016, y: 1031, directionX: 0, directionY: 1 },
      { x: 1463, y: 400, directionX: -1, directionY: 0 },
      { x: 1510, y: 437, directionX: 0, directionY: 1 },
      { x: 1500, y: 437, directionX: 0, directionY: 1 },
      { x: 1490, y: 437, directionX: 0, directionY: 1 },
      { x: 1510, y: 363, directionX: 0, directionY: -1 },
      { x: 1500, y: 363, directionX: 0, directionY: -1 },
      { x: 1490, y: 363, directionX: 0, directionY: -1 },
    ]);
    expect(flying(world).map(stamp)).toEqual([
      { speed: 300, radius: 4, damage: 20, remainingSteps: 119 },
      ...times(6, [0]).map(() => ({ speed: 240, radius: 3, damage: 12, remainingSteps: 89 })),
      { speed: 180, radius: 4, damage: 9, remainingSteps: 119 },
      ...times(6, [0]).map(() => ({ speed: 240, radius: 3, damage: 5, remainingSteps: 89 })),
    ]);
    expect(eventsOf(world)).toStrictEqual([
      { kind: 'shotFired', layer: 'player', weapon: 'front', x: 1028, y: 1000, directionX: 1, directionY: 0 },
      { kind: 'shotFired', layer: 'player', weapon: 'left', x: 1000, y: 973, directionX: 0, directionY: -1 },
      { kind: 'shotFired', layer: 'player', weapon: 'right', x: 1000, y: 1027, directionX: 0, directionY: 1 },
      { kind: 'shotFired', layer: null, weapon: 'front', x: 1466, y: 400, directionX: -1, directionY: 0 },
      { kind: 'shotFired', layer: null, weapon: 'left', x: 1500, y: 433, directionX: 0, directionY: 1 },
      { kind: 'shotFired', layer: null, weapon: 'right', x: 1500, y: 367, directionX: 0, directionY: -1 },
    ]);
    expect(cooldowns(frigate)).toEqual({ frontCooldown: 15, leftCooldown: 60, rightCooldown: 60 });

    expect(shotSteps(world, 130, () => 0)).toMatchObject({
      front: [15, 30, 45, 60, 75, 90, 105, 120],
      left: [60, 120],
      right: [60, 120],
    });
    expect(merchant).toMatchObject({
      active: true,
      ...trigger,
      frontCooldown: 0,
      leftCooldown: 0,
      rightCooldown: 0,
      weapons: null,
    });
    expect(wreck).toMatchObject({
      active: false,
      ...trigger,
      frontCooldown: 5,
      leftCooldown: 6,
      rightCooldown: 7,
    });

    const disarmed = createMatch(buildConfig(), SEED);
    disarmed.player.weapons = null;

    expect(shotSteps(disarmed, 90, () => Command.Forward | EVERY_WEAPON)).toEqual({
      front: [],
      left: [],
      right: [],
      created: [],
    });
    expect(cooldowns(disarmed.player)).toEqual({
      frontCooldown: 0,
      leftCooldown: 0,
      rightCooldown: 0,
    });
    expect(disarmed.player.x).toBeGreaterThan(1100);
  });

  test('CB-07 a ship fitted with a front cannon only fires it on its cooldown and fires nothing from its sides', () => {
    const trigger = { fireFront: 1, fireLeft: 1, fireRight: 1 } as const;
    const cannonOnly = { front: testWeapons().front };
    const berth = { x: 400, y: 400, heading: 128, radius: 20 };
    const world = createMatch(buildConfig(), SEED);
    const gunboat = launch(world, { ...berth, ...trigger, weapons: cannonOnly });

    step(world, 0);

    expect(eventsOf(world)).toStrictEqual([
      { kind: 'shotFired', layer: null, weapon: 'front', x: 400, y: 424, directionX: 0, directionY: 1 },
    ]);
    expect(flying(world).map(course)).toEqual([{ x: 400, y: 429, directionX: 0, directionY: 1 }]);
    expect(flying(world).map(stamp)).toEqual([
      { speed: 300, radius: 4, damage: 20, remainingSteps: 119 },
    ]);
    expect(cooldowns(gunboat)).toEqual({ frontCooldown: 30, leftCooldown: 0, rightCooldown: 0 });

    for (let index = 1; index < 100; index += 1) {
      step(world, 0);

      expect(cooldowns(gunboat)).toEqual({
        frontCooldown: 30 - (index % 30),
        leftCooldown: 0,
        rightCooldown: 0,
      });
    }
    expect(gunboat).toMatchObject({ active: true, ...trigger });
    expect(gunboat.weapons).toBe(cannonOnly);

    const held = createMatch(buildConfig(), SEED);
    launch(held, { ...berth, ...trigger, weapons: cannonOnly });

    expect(shotSteps(held, 200, () => 0)).toEqual({
      front: [0, 30, 60, 90, 120, 150, 180],
      left: [],
      right: [],
      created: [0, 30, 60, 90, 120, 150, 180],
    });

    const refitted = createMatch(buildConfig(), SEED);
    const sloop = launch(refitted, {
      ...berth,
      ...trigger,
      frontCooldown: 11,
      leftCooldown: 7,
      rightCooldown: 65,
      weapons: cannonOnly,
    });

    expect(shotSteps(refitted, 5, () => 0)).toEqual({ front: [], left: [], right: [], created: [] });
    expect(cooldowns(sloop)).toEqual({ frontCooldown: 6, leftCooldown: 2, rightCooldown: 60 });
    expect(shotSteps(refitted, 125, () => 0)).toEqual({
      front: [10, 40, 70, 100],
      left: [],
      right: [],
      created: [10, 40, 70, 100],
    });
    expect(cooldowns(sloop)).toEqual({ frontCooldown: 1, leftCooldown: 0, rightCooldown: 0 });
  });
});
