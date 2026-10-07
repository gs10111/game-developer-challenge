import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const pureSimulation = 'The simulation is pure TypeScript (ADR-0001, ADR-0006).';
const deterministicSimulation = 'Use the seeded PRNG and the step counter (ADR-0005).';

export const simulationGuardrails = defineConfig({
  name: 'pirate-battle/simulation-guardrails',
  files: ['src/game/sim/**/*.{ts,tsx}'],
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
        ],
      },
    ],
    'no-restricted-properties': [
      'error',
      { object: 'Math', property: 'random', message: deterministicSimulation },
      { object: 'Date', property: 'now', message: deterministicSimulation },
      { object: 'performance', property: 'now', message: deterministicSimulation },
    ],
  },
});

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
