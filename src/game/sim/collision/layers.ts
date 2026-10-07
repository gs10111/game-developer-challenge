export const Layer = {
  Player: 'player',
  Enemy: 'enemy',
  PlayerShot: 'playerShot',
  EnemyShot: 'enemyShot',
  Island: 'island',
} as const;

export type Layer = (typeof Layer)[keyof typeof Layer];

const MEETS: Readonly<Record<Layer, readonly Layer[]>> = {
  [Layer.Player]: [Layer.Enemy, Layer.EnemyShot, Layer.Island],
  [Layer.Enemy]: [Layer.PlayerShot, Layer.Island],
  [Layer.PlayerShot]: [Layer.Island],
  [Layer.EnemyShot]: [Layer.Island],
  [Layer.Island]: [],
};

export function layersMeet(a: Layer | null, b: Layer | null): boolean {
  if (a === null || b === null) {
    return false;
  }
  return MEETS[a].includes(b) || MEETS[b].includes(a);
}

export function shotLayerOf(layer: Layer | null): Layer | null {
  if (layer === Layer.Player) {
    return Layer.PlayerShot;
  }
  if (layer === Layer.Enemy) {
    return Layer.EnemyShot;
  }
  return null;
}
