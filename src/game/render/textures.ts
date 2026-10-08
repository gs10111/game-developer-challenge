import { Assets, Texture } from 'pixi.js';

const SHIP_FRAMES = [1, 2, 3, 7, 8, 9, 13, 14, 15];
const SAND_TILES = [1, 2, 3, 17, 18, 19, 33, 34, 35];

const NAMES: readonly string[] = [
  ...SHIP_FRAMES.map((frame) => `ship_${String(frame)}`),
  ...SAND_TILES.map((tile) => `tile_${String(tile)}`),
  'tile_73',
  'cannon_ball',
  'fire_1',
  'explosion_1',
  'explosion_2',
  'explosion_3',
];

export type GameTextures = Readonly<Record<string, Texture>>;

export async function loadTextures(onProgress: (fraction: number) => void): Promise<GameTextures> {
  const base = `${import.meta.env.BASE_URL}assets/`;
  const sources = NAMES.map((name) => ({ alias: name, src: `${base}${name}.png` }));
  return Assets.load<GameTextures>(sources, onProgress);
}

export function textureOf(textures: GameTextures, name: string): Texture {
  return textures[name] ?? Texture.EMPTY;
}
