import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, test } from 'vitest';
import { simulationGuardrails } from '../../eslint.config.js';

const simulationFile = 'src/game/sim/probe.ts';
const simulationTestFile = 'src/game/sim/probe.test.ts';
const nestedSimulationFile = 'src/game/sim/systems/collision/probe.ts';
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

  test.each([
    [simulationFile, '../loop/fixedStepClock'],
    [simulationFile, '../render/ships'],
    [simulationFile, '../input/keyboard'],
    [simulationFile, '../../ui/Hud'],
    [simulationFile, '../../api/contracts'],
    [simulationFile, '../../mocks/handlers'],
    [simulationFile, '../../storage/settings'],
    [nestedSimulationFile, '../../../loop/fixedStepClock'],
  ])('AR-02 the simulation file %s cannot import %s', async (filePath, moduleName) => {
    const source = `import '${moduleName}';\n`;

    expect(await reportedRules(source, filePath)).toEqual(['no-restricted-imports']);
  });

  test('AR-02 the simulation may import its own modules', async () => {
    const source = `import { step } from './step';\nimport { sine } from '../math/rotation';\nexport const probe = [step, sine];\n`;

    expect(await reportedRules(source, simulationFile)).toEqual([]);
  });

  test('AR-02 the simulation imports the config as a type only', async () => {
    const valueImport = `import { DEFAULT_GAME_CONFIG } from '../config/gameConfig';\nexport const probe = DEFAULT_GAME_CONFIG;\n`;
    const typeImport = `import type { GameConfig } from '../config/gameConfig';\nexport type Probe = GameConfig;\n`;

    expect(await reportedRules(valueImport, simulationFile)).toEqual([
      '@typescript-eslint/no-restricted-imports',
    ]);
    expect(await reportedRules(valueImport, simulationTestFile)).toEqual([
      '@typescript-eslint/no-restricted-imports',
    ]);
    expect(await reportedRules(typeImport, simulationFile)).toEqual([]);
  });

  test.each(['Math.random()', 'Date.now()', 'performance.now()'])(
    'AR-02 the simulation cannot call %s, in sources or in tests',
    async (call) => {
      const source = `export const probe = ${call};\n`;

      expect(await reportedRules(source, simulationFile)).toEqual(['no-restricted-properties']);
      expect(await reportedRules(source, simulationTestFile)).toEqual(['no-restricted-properties']);
    },
  );

  test.each(['Math.sin(1)', 'Math.cos(1)', 'Math.atan2(1, 2)', 'Math.hypot(3, 4)', 'Math.pow(2, 3)'])(
    'AR-02 simulation sources cannot call %s, while tests may use it as an oracle',
    async (call) => {
      const source = `export const probe = ${call};\n`;

      expect(await reportedRules(source, simulationFile)).toEqual(['no-restricted-properties']);
      expect(await reportedRules(source, nestedSimulationFile)).toEqual([
        'no-restricted-properties',
      ]);
      expect(await reportedRules(source, simulationTestFile)).toEqual([]);
    },
  );

  test('AR-02 simulation sources cannot use the exponent operator, and exact arithmetic passes', async () => {
    const exponent = `export const probe = (side: number) => side ** 2;\n`;
    const compound = `export function probe(side: number) {\n  let area = side;\n  area **= 2;\n  return area;\n}\n`;
    const exact = `export const probe = (side: number) => Math.sqrt(side * side + 1) / 2;\n`;

    expect(await reportedRules(exponent, simulationFile)).toEqual(['no-restricted-syntax']);
    expect(await reportedRules(compound, simulationFile)).toEqual(['no-restricted-syntax']);
    expect(await reportedRules(exponent, simulationTestFile)).toEqual([]);
    expect(await reportedRules(exact, simulationFile)).toEqual([]);
  });

  test('AR-02 the guardrails leave the other layers alone', async () => {
    const source = `import 'react';\nimport '../game/loop/fixedStepClock';\nexport const probe = [Math.random(), Math.sin(1)];\n`;

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
    const guardrailRules = [
      'no-restricted-imports',
      '@typescript-eslint/no-restricted-imports',
      'no-restricted-properties',
      'no-restricted-syntax',
    ];

    for (const rule of guardrailRules) {
      expect(await severityOf(simulationFile, rule)).toBe(2);
      expect(await severityOf(interfaceFile, rule)).toBeUndefined();
    }
  });
});
