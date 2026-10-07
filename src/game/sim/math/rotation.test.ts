import { describe, expect, test } from 'vitest';
import { HEADING_UNITS_PER_TURN, cosine, normaliseHeading, sine } from './rotation';
import { SINE_TABLE } from './sineTable';

const RADIANS_PER_ENTRY = (2 * Math.PI) / 512;

function tableEntry(index: number): number {
  return SINE_TABLE[index] ?? Number.NaN;
}

describe('quantized rotation (ADR-0005)', () => {
  test('PW-03 the sine table has 512 entries, is exact at the quarter turns and antisymmetric by half a turn', () => {
    const quarterTurns = [0, 128, 256, 384];

    expect(SINE_TABLE).toHaveLength(512);
    expect(HEADING_UNITS_PER_TURN).toBe(512);
    expect(quarterTurns.map((heading) => tableEntry(heading))).toEqual([0, 1, 0, -1]);
    expect(quarterTurns.map((heading) => sine(heading))).toEqual([0, 1, 0, -1]);
    expect(quarterTurns.map((heading) => cosine(heading))).toEqual([1, 0, -1, 0]);
    for (let entry = 0; entry < 256; entry += 1) {
      expect(tableEntry(entry) + tableEntry(entry + 256)).toBe(0);
    }
  });

  test('PW-03 sine and cosine of a heading agree with Math.sin and Math.cos of the nearest table angle within 1e-12', () => {
    const offsetsInsideTheEntry = [-0.49, -0.25, 0, 0.25, 0.49];

    for (let entry = 0; entry < 512; entry += 1) {
      const angle = entry * RADIANS_PER_ENTRY;

      for (const offset of offsetsInsideTheEntry) {
        const heading = entry + offset;

        expect(Math.abs(sine(heading) - Math.sin(angle))).toBeLessThan(1e-12);
        expect(Math.abs(cosine(heading) - Math.cos(angle))).toBeLessThan(1e-12);
      }
    }
    expect(sine(10.5)).toBe(tableEntry(11));
    expect(cosine(10.5)).toBe(tableEntry(11 + 128));
  });

  test('PW-03 headings below zero and at or above a full turn read the wrapped entry', () => {
    const wrappedEntries: readonly (readonly [heading: number, entry: number])[] = [
      [-0.4, 0],
      [-1, 511],
      [-37, 475],
      [-512, 0],
      [-549, 475],
      [-10.5, 502],
      [511.6, 0],
      [512, 0],
      [549, 37],
      [1224, 200],
      [5000, 392],
    ];

    for (const [heading, entry] of wrappedEntries) {
      expect(sine(heading)).toBe(tableEntry(entry));
      expect(cosine(heading)).toBe(tableEntry((entry + 128) % 512));
    }
  });

  test('PW-03 normalising a heading keeps it in [0, 512)', () => {
    const alreadyInside = [0, 3.5555555555555554, 128, 511.75, 511.99999999999994];
    const wrapped: readonly (readonly [heading: number, normalised: number])[] = [
      [512, 0],
      [513.5, 1.5],
      [1024, 0],
      [5000, 392],
      [-1, 511],
      [-0.25, 511.75],
      [-512, 0],
      [-513, 511],
      [-1024, 0],
      [-1e-15, 0],
    ];

    for (const heading of alreadyInside) {
      expect(normaliseHeading(heading)).toBe(heading);
    }
    for (const [heading, normalised] of wrapped) {
      expect(normaliseHeading(heading)).toBe(normalised);
    }
    for (let heading = -2000; heading <= 2000; heading += 0.37) {
      const normalised = normaliseHeading(heading);

      expect(normalised).toBeGreaterThanOrEqual(0);
      expect(normalised).toBeLessThan(512);
    }
  });
});
