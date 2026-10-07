export interface RandomSource {
  state: number;
}

export function createRandomSource(seed: number): RandomSource {
  return { state: seed >>> 0 };
}

export function nextRandom(source: RandomSource): number {
  source.state = (source.state + 0x6d2b79f5) >>> 0;
  let t = source.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
