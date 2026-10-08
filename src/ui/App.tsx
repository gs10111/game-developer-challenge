import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import type { MatchRecord } from '../api/contracts';
import { enqueueMatch, loadLastResult, saveLastResult, useOutboxSync } from '../api/outbox';
import type { GameConfig } from '../game/config/gameConfig';
import {
  BENCHMARK_PLAYER_HEALTH,
  benchmarkPlan,
  perfReports,
  perfRequested,
} from '../game/runtime/perf';
import { configFromOptions, loadOptions, loadPlayerId } from '../storage/options';
import type { Options } from '../storage/options';
import { MainMenu } from './MainMenu';
import { MatchScreen } from './MatchScreen';
import type { MatchTicket } from './MatchScreen';

const QUERY_RETRIES = 2;
const LONGEST_RETRY_DELAY_MS = 4000;
const FIRST_RETRY_DELAY_MS = 500;
const SEED_RANGE = 4294967296;
const BETWEEN_CYCLES_MS = 1500;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: QUERY_RETRIES,
      retryDelay: (attempt) => Math.min(FIRST_RETRY_DELAY_MS * 2 ** attempt, LONGEST_RETRY_DELAY_MS),
    },
    mutations: {
      retryDelay: (attempt) => Math.min(FIRST_RETRY_DELAY_MS * 2 ** attempt, LONGEST_RETRY_DELAY_MS),
    },
  },
});

function chooseSeed(): number {
  const requested = Number(new URLSearchParams(window.location.search).get('seed'));
  return Number.isInteger(requested) && requested > 0 ? requested : Date.now() % SEED_RANGE;
}

function matchConfig(options: Options): GameConfig {
  const config = configFromOptions(options);
  if (!perfRequested()) {
    return config;
  }
  return {
    ...config,
    match: { durationSeconds: benchmarkPlan().seconds ?? config.match.durationSeconds },
    player: { ...config.player, health: BENCHMARK_PLAYER_HEALTH },
  };
}

function Shell() {
  useOutboxSync();
  const [options, setOptions] = useState<Options>(loadOptions);
  const [playerId] = useState(loadPlayerId);
  const [lastResult, setLastResult] = useState<MatchRecord | null>(loadLastResult);
  const [ticket, setTicket] = useState<MatchTicket | null>(null);

  const play = (): void => {
    setTicket({
      matchId: crypto.randomUUID(),
      seed: chooseSeed(),
      config: matchConfig(options),
      playerId,
      playerName: options.playerName,
    });
  };

  const finish = (record: MatchRecord): void => {
    if (perfRequested()) {
      if (perfReports().length < benchmarkPlan().cycles) {
        window.setTimeout(() => {
          setTicket(null);
          window.setTimeout(play, BETWEEN_CYCLES_MS);
        }, BETWEEN_CYCLES_MS);
      }
      return;
    }
    saveLastResult(record);
    setLastResult(record);
    enqueueMatch(record);
  };

  if (ticket !== null) {
    return (
      <MatchScreen
        key={ticket.matchId}
        ticket={ticket}
        onFinished={finish}
        onPlayAgain={play}
        onExit={() => {
          setTicket(null);
        }}
      />
    );
  }
  return (
    <MainMenu
      options={options}
      playerId={playerId}
      lastResult={lastResult}
      onOptionsSaved={setOptions}
      onPlay={play}
      onReset={() => {
        setLastResult(null);
      }}
    />
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Shell />
    </QueryClientProvider>
  );
}
