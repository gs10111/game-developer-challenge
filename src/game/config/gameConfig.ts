export interface GameConfig {
  readonly arena: {
    readonly width: number;
    readonly height: number;
  };
  readonly player: {
    readonly radius: number;
    readonly speed: number;
    readonly turnRateDegrees: number;
  };
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  arena: { width: 960, height: 540 },
  player: { radius: 24, speed: 140, turnRateDegrees: 150 },
};
