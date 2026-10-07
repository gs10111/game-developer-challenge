import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, test } from 'vitest';
import { simulationGuardrails } from '../../eslint.config.js';

const simulationFile = 'src/game/sim/probe.ts';
const interfaceFile = 'src/ui/probe.tsx';

const guardrailsOnly = new ESLint({
  overrideConfigFile: true,
  overrideConfig: [
    { files: ['**/*.{ts,tsx}'], languageOptions: { parser: tseslint.parser } },
    ...simulationGuardrails,
  ],
});

async function reportedRules(source: string, filePath: string): Promise<string[]> {
  const [result] = await guardrailsOnly.lintText(source, { filePath });
  return (result?.messages ?? []).map((message) => message.ruleId ?? 'fatal');
}

describe('simulation lint guardrails', () => {
  test.each(['pixi.js', 'react', 'react-dom', 'react/jsx-runtime', '@pixi/sound'])(
    'AR-02 the simulation cannot import %s',
    async (moduleName) => {
      const source = `import '${moduleName}';\n`;

      expect(await reportedRules(source, simulationFile)).toEqual(['no-restricted-imports']);
    },
  );

  test('AR-02 the simulation cannot import types from pixi.js', async () => {
    const source = `import type { Sprite } from 'pixi.js';\nexport type Probe = Sprite;\n`;

    expect(await reportedRules(source, simulationFile)).toEqual(['no-restricted-imports']);
  });

  test.each(['Math.random()', 'Date.now()', 'performance.now()'])(
    'AR-02 the simulation cannot call %s',
    async (call) => {
      const source = `export const probe = ${call};\n`;

      expect(await reportedRules(source, simulationFile)).toEqual(['no-restricted-properties']);
    },
  );

  test('AR-02 the guardrails leave the other layers alone', async () => {
    const source = `import 'react';\nexport const probe = Math.random();\n`;

    expect(await reportedRules(source, interfaceFile)).toEqual([]);
  });

  test('AR-02 the project lint config applies the guardrails to the simulation only', async () => {
    const projectLint = new ESLint();
    const severityOf = async (filePath: string, rule: string): Promise<unknown> => {
      const config = (await projectLint.calculateConfigForFile(filePath)) as {
        rules?: Record<string, unknown[]>;
      };
      return config.rules?.[rule]?.[0];
    };

    expect(await severityOf(simulationFile, 'no-restricted-imports')).toBe(2);
    expect(await severityOf(simulationFile, 'no-restricted-properties')).toBe(2);
    expect(await severityOf(interfaceFile, 'no-restricted-imports')).toBeUndefined();
    expect(await severityOf(interfaceFile, 'no-restricted-properties')).toBeUndefined();
  });
});
