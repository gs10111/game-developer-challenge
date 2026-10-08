import { useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { forgetLocalRecords, retryAllMatches } from '../api/outbox';
import { resetDb } from '../mocks/db';
import { servedInPage } from '../mocks/inPage';
import { currentScenario, SCENARIO_LABELS, SCENARIOS, selectScenario } from '../mocks/scenarios';
import type { Scenario } from '../mocks/scenarios';

interface MockPanelProps {
  onReset: () => void;
}

export function MockPanel({ onReset }: MockPanelProps) {
  const queryClient = useQueryClient();
  const [scenario, setScenario] = useState(currentScenario);
  const selectId = useId();

  const choose = (next: Scenario): void => {
    selectScenario(next);
    setScenario(next);
    retryAllMatches();
    void queryClient.invalidateQueries();
  };

  return (
    <details className="mock-panel">
      <summary>Mock API scenarios</summary>
      <p className="hint">
        Ranking and history are served by a mock in the browser. Choose how it behaves.
      </p>
      <p className="hint" data-testid="mock-transport">
        {servedInPage()
          ? 'No service worker is available here, so the same handlers answer in the page.'
          : 'A service worker answers the requests.'}
      </p>
      <label htmlFor={selectId}>Scenario</label>
      <select
        id={selectId}
        value={scenario}
        onChange={(event) => {
          const next = SCENARIOS.find((name) => name === event.target.value);
          if (next !== undefined) {
            choose(next);
          }
        }}
      >
        {SCENARIOS.map((name) => (
          <option key={name} value={name}>
            {SCENARIO_LABELS[name]}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => {
          resetDb();
          forgetLocalRecords();
          onReset();
          choose('success');
        }}
      >
        Restore initial data
      </button>
    </details>
  );
}
