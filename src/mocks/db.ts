import { z } from 'zod';
import { matchRecordSchema } from '../api/contracts';
import type { MatchConfig, MatchRecord, RankingEntry } from '../api/contracts';
import { readJson, removeKey, writeJson } from '../storage/localJson';

const DB_KEY = 'pirate-battle.mock-db';
const MILLISECONDS_PER_DAY = 86_400_000;
const FIXTURE_EPOCH = Date.UTC(2026, 8, 1, 12);

const RIVALS = [
  'Anne Bonny',
  'Blackbeard',
  'Calico Jack',
  'Mary Read',
  'Henry Morgan',
  'Grace O Malley',
  'Black Bart',
  'Ching Shih',
  'William Kidd',
  'Edward Low',
  'Stede Bonnet',
  'Jean Lafitte',
];

const FIXTURE_CONFIGS: readonly MatchConfig[] = [
  { sessionSeconds: 120, spawnSeconds: 3 },
  { sessionSeconds: 120, spawnSeconds: 3 },
  { sessionSeconds: 60, spawnSeconds: 3 },
  { sessionSeconds: 120, spawnSeconds: 3 },
  { sessionSeconds: 180, spawnSeconds: 3 },
];

function fixture(index: number): MatchRecord {
  const config = FIXTURE_CONFIGS[index % FIXTURE_CONFIGS.length] ?? {
    sessionSeconds: 120,
    spawnSeconds: 3,
  };
  const rival = index % RIVALS.length;
  const defeated = index % 4 === 3;
  return {
    matchId: `fixture-${String(index + 1).padStart(2, '0')}`,
    playerId: `rival-${String(rival + 1).padStart(2, '0')}`,
    playerName: RIVALS[rival] ?? 'Rival',
    finishedAt: new Date(FIXTURE_EPOCH + index * MILLISECONDS_PER_DAY).toISOString(),
    score: ((index * 7 + 5) % 23) + 1,
    durationSeconds: defeated ? Math.round(config.sessionSeconds * 0.6) : config.sessionSeconds,
    endReason: defeated ? 'defeated' : 'timeUp',
    config,
  };
}

export const FIXTURES: readonly MatchRecord[] = Array.from({ length: 30 }, (_, index) =>
  fixture(index),
);

function confirmed(): MatchRecord[] {
  const stored = z.array(matchRecordSchema).safeParse(readJson(DB_KEY));
  return stored.success ? stored.data : [];
}

function byScore(a: MatchRecord, b: MatchRecord): number {
  return (
    b.score - a.score ||
    a.finishedAt.localeCompare(b.finishedAt) ||
    a.matchId.localeCompare(b.matchId)
  );
}

export function rankingFor(config: MatchConfig): RankingEntry[] {
  return [...FIXTURES, ...confirmed()]
    .filter(
      (record) =>
        record.config.sessionSeconds === config.sessionSeconds &&
        record.config.spawnSeconds === config.spawnSeconds,
    )
    .sort(byScore)
    .map((record, index) => ({ ...record, rank: index + 1 }));
}

export function historyOf(playerId: string): MatchRecord[] {
  return [...FIXTURES, ...confirmed()]
    .filter((record) => record.playerId === playerId)
    .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt) || a.matchId.localeCompare(b.matchId));
}

export function saveRecord(record: MatchRecord): { record: MatchRecord; created: boolean } {
  const records = confirmed();
  const existing = records.find(({ matchId }) => matchId === record.matchId);
  if (existing !== undefined) {
    return { record: existing, created: false };
  }
  writeJson(DB_KEY, [...records, record]);
  return { record, created: true };
}

export function resetDb(): void {
  removeKey(DB_KEY);
}
