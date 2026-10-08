export type EnemyKind = 'chaser' | 'shooter';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export type ConvexPolygon = readonly Point[];

export interface Weapon {
  readonly cooldownSeconds: number;
  readonly projectileSpeed: number;
  readonly projectileRadius: number;
  readonly projectileLifetimeSeconds: number;
  readonly damage: number;
}

export interface Weapons {
  readonly front: Weapon;
  readonly broadside: Weapon & { readonly spacing: number };
}

export interface Armament {
  readonly front: Weapon;
  readonly broadside?: Weapons['broadside'];
}

export interface GameConfig {
  readonly arena: {
    readonly width: number;
    readonly height: number;
    readonly islands: readonly ConvexPolygon[];
  };
  readonly player: {
    readonly radius: number;
    readonly speed: number;
    readonly turnRateDegrees: number;
    readonly health: number;
    readonly weapons: Weapons;
  };
  readonly enemies: {
    readonly chaser: {
      readonly radius: number;
      readonly speed: number;
      readonly turnRateDegrees: number;
      readonly health: number;
      readonly contactDamage: number;
    };
    readonly shooter: {
      readonly radius: number;
      readonly speed: number;
      readonly turnRateDegrees: number;
      readonly health: number;
      readonly attackRange: number;
      readonly weapons: { readonly front: Weapon };
    };
    readonly spawn: {
      readonly intervalSeconds: number;
      readonly minimumDistance: number;
      readonly maximumAlive: number;
      readonly sequence: readonly EnemyKind[];
    };
  };
  readonly match: {
    readonly durationSeconds: number;
  };
}

export const OPTION_LIMITS = {
  sessionSeconds: { minimum: 60, maximum: 180 },
  spawnSeconds: { minimum: 0.5, maximum: 10 },
} as const;

export const DEFAULT_GAME_CONFIG: GameConfig = {
  arena: {
    width: 1024,
    height: 576,
    islands: [
      [
        { x: 128, y: 0 },
        { x: 384, y: 0 },
        { x: 384, y: 128 },
        { x: 128, y: 128 },
      ],
      [
        { x: 256, y: 128 },
        { x: 384, y: 128 },
        { x: 384, y: 256 },
        { x: 256, y: 256 },
      ],
      [
        { x: 640, y: 384 },
        { x: 896, y: 384 },
        { x: 896, y: 576 },
        { x: 640, y: 576 },
      ],
      [
        { x: 704, y: 64 },
        { x: 832, y: 64 },
        { x: 832, y: 192 },
        { x: 704, y: 192 },
      ],
      [
        { x: 128, y: 384 },
        { x: 256, y: 384 },
        { x: 256, y: 512 },
        { x: 128, y: 512 },
      ],
    ],
  },
  player: {
    radius: 24,
    speed: 140,
    turnRateDegrees: 150,
    health: 100,
    weapons: {
      front: {
        cooldownSeconds: 0.5,
        projectileSpeed: 420,
        projectileRadius: 5,
        projectileLifetimeSeconds: 1,
        damage: 20,
      },
      broadside: {
        cooldownSeconds: 1.5,
        projectileSpeed: 360,
        projectileRadius: 5,
        projectileLifetimeSeconds: 0.8,
        damage: 15,
        spacing: 14,
      },
    },
  },
  enemies: {
    chaser: {
      radius: 18,
      speed: 110,
      turnRateDegrees: 160,
      health: 30,
      contactDamage: 25,
    },
    shooter: {
      radius: 22,
      speed: 70,
      turnRateDegrees: 90,
      health: 40,
      attackRange: 260,
      weapons: {
        front: {
          cooldownSeconds: 1.6,
          projectileSpeed: 260,
          projectileRadius: 5,
          projectileLifetimeSeconds: 1.2,
          damage: 10,
        },
      },
    },
    spawn: {
      intervalSeconds: 3,
      minimumDistance: 320,
      maximumAlive: 10,
      sequence: ['chaser', 'shooter', 'chaser'],
    },
  },
  match: {
    durationSeconds: 120,
  },
};
