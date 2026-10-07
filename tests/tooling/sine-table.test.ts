import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { buildSineTable, renderSineTableModule } from '../../scripts/generate-sine-table';
import { SINE_TABLE } from '../../src/game/sim/math/sineTable';

function readCommittedModule(): string {
  return readFileSync(new URL('../../src/game/sim/math/sineTable.ts', import.meta.url), 'utf8');
}

describe('sine table generator (ADR-0005)', () => {
  test('PW-03 the committed sine table is exactly what the generator produces', () => {
    const generated = buildSineTable();

    expect(generated).toHaveLength(512);
    expect(SINE_TABLE).toEqual(generated);
    expect(readCommittedModule()).toBe(renderSineTableModule(generated));
  });
});
