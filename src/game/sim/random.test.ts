import { describe, expect, test } from 'vitest';
import { createRandomSource, nextRandom } from './random';
import type { RandomSource } from './random';

function referenceMulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function draw(source: RandomSource, count: number): number[] {
  return Array.from({ length: count }, () => nextRandom(source));
}

describe('seeded random source (ADR-0005)', () => {
  test('PW-03 the generator reproduces the mulberry32 sequence of ADR-0005 for several seeds', () => {
    const seeds = [0, 1, 42, 20261007, 0x7fffffff, 0x80000000, 0xffffffff, -1, 2 ** 32 + 7];

    for (const seed of seeds) {
      const reference = referenceMulberry32(seed);
      const expected = Array.from({ length: 1000 }, () => reference());

      expect(draw(createRandomSource(seed), 1000)).toEqual(expected);
    }
  });

  test('PW-03 a copied state continues the same sequence', () => {
    const original = createRandomSource(20261007);
    const beforeTheCopy = draw(original, 5);
    const copy: RandomSource = { ...original };

    const fromTheCopy = draw(copy, 20);
    const fromTheOriginal = draw(original, 20);

    expect(fromTheCopy).toEqual(fromTheOriginal);
    expect(fromTheCopy.slice(0, 5)).not.toEqual(beforeTheCopy);
    expect(copy).toEqual(original);
  });

  test('PW-03 random values stay in [0, 1) and different seeds diverge', () => {
    const seeds = [0, 1, 2, 3, 0xffffffff];
    const sequences = seeds.map((seed) => draw(createRandomSource(seed), 10000));
    const openings = sequences.map((sequence) => sequence.slice(0, 8).join(' '));

    for (const sequence of sequences) {
      expect(Math.min(...sequence)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...sequence)).toBeLessThan(1);
    }
    expect(new Set(openings).size).toBe(seeds.length);
  });
});
