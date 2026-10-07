import { writeFileSync } from 'node:fs';

const ENTRIES_PER_TURN = 512;
const HALF_TURN = ENTRIES_PER_TURN / 2;
const QUARTER_TURN = ENTRIES_PER_TURN / 4;

function sineOfEntry(entry: number): number {
  if (entry <= QUARTER_TURN) {
    return Math.sin((2 * Math.PI * entry) / ENTRIES_PER_TURN);
  }
  if (entry < HALF_TURN) {
    return sineOfEntry(HALF_TURN - entry);
  }
  return 0 - sineOfEntry(entry - HALF_TURN);
}

export function buildSineTable(): number[] {
  return Array.from({ length: ENTRIES_PER_TURN }, (_, entry) => sineOfEntry(entry));
}

export function renderSineTableModule(table: readonly number[]): string {
  const entries = table.map((value) => `  ${String(value)},`);
  return ['export const SINE_TABLE: readonly number[] = [', ...entries, '];', ''].join('\n');
}

if (import.meta.main) {
  const target = new URL('../src/game/sim/math/sineTable.ts', import.meta.url);
  writeFileSync(target, renderSineTableModule(buildSineTable()));
}
