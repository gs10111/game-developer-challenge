import { readJson, writeJson } from '../storage/localJson';

export const SCENARIOS = [
  'success',
  'empty',
  'slow',
  'jitter',
  'server-error',
  'client-error',
  'network-error',
  'timeout',
  'reads-fail',
  'timeout-after-save',
  'save-unavailable',
] as const;

export type Scenario = (typeof SCENARIOS)[number];

export const SCENARIO_LABELS: Readonly<Record<Scenario, string>> = {
  success: 'Success',
  empty: 'Empty lists',
  slow: 'Slow responses (2.5 s)',
  jitter: 'Variable latency, answers out of order',
  'server-error': 'HTTP 500 on every request',
  'client-error': 'HTTP 400 on every request',
  'network-error': 'Connection failure',
  timeout: 'No response (timeout)',
  'reads-fail': 'Ranking and history fail, saving works',
  'timeout-after-save': 'Match saved, first answer lost (timeout)',
  'save-unavailable': 'Saving unavailable (HTTP 503)',
};

const SCENARIO_KEY = 'pirate-battle.mock-scenario';

function isScenario(value: unknown): value is Scenario {
  return SCENARIOS.some((scenario) => scenario === value);
}

export function currentScenario(): Scenario {
  const stored = readJson(SCENARIO_KEY);
  return isScenario(stored) ? stored : 'success';
}

export function selectScenario(scenario: Scenario): void {
  writeJson(SCENARIO_KEY, scenario);
}

export function selectScenarioFromUrl(): void {
  const requested = new URLSearchParams(window.location.search).get('scenario');
  if (isScenario(requested)) {
    selectScenario(requested);
  }
}
