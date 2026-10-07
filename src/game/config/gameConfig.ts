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
}

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
};
