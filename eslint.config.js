import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const pureSimulation = 'The simulation is pure TypeScript (ADR-0001, ADR-0006).';
const deterministicSimulation = 'Use the seeded PRNG and the step counter (ADR-0005).';
const tableTrigonometry = 'Use sine and cosine from math/rotation, which read the table (ADR-0005).';
const isolatedSimulation = 'The simulation imports no other layer (ADR-0001, ADR-0006).';
const configAsArgument =
  'The simulation imports only the config type; values arrive through createMatch (SC-12).';

const platformTimeAndRandomness = [
  { object: 'Math', property: 'random', message: deterministicSimulation },
  { object: 'Date', property: 'now', message: deterministicSimulation },
  { object: 'performance', property: 'now', message: deterministicSimulation },
];

const engineTrigonometry = [
  { object: 'Math', property: 'sin', message: tableTrigonometry },
  { object: 'Math', property: 'cos', message: tableTrigonometry },
];

export const simulationGuardrails = defineConfig(
  {
    name: 'pirate-battle/simulation-guardrails',
    files: ['src/game/sim/**/*.{ts,tsx}'],
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'pixi.js', message: pureSimulation },
            { name: 'react', message: pureSimulation },
            { name: 'react-dom', message: pureSimulation },
          ],
          patterns: [
            {
              group: ['pixi.js/*', '@pixi/*', 'react/*', 'react-dom/*'],
              message: pureSimulation,
            },
            {
              regex: '^(?:\\.\\./)+(?:loop|render|input|ui|api|mocks|storage)(?:/|$)',
              message: isolatedSimulation,
            },
          ],
        },
      ],
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?:\\.\\./)+config(?:/|$)',
              allowTypeImports: true,
              message: configAsArgument,
            },
          ],
        },
      ],
      'no-restricted-properties': ['error', ...platformTimeAndRandomness],
    },
  },
  {
    name: 'pirate-battle/simulation-source-guardrails',
    files: ['src/game/sim/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-properties': ['error', ...platformTimeAndRandomness, ...engineTrigonometry],
    },
  },
);

export default defineConfig(
  globalIgnores(['dist', 'playwright-report', 'test-results', 'public/mockServiceWorker.js']),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
  simulationGuardrails,
);
