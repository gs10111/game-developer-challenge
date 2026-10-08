import { keepPreviousData, useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { historyPageSchema, matchRecordSchema, PAGE_SIZE, rankingPageSchema } from './contracts';
import type { HistoryPage, MatchConfig, MatchRecord, RankingPage } from './contracts';

const REQUEST_TIMEOUT_MS = 6000;
const FRESH_FOR_MS = 10_000;

export const http = axios.create({ baseURL: '/api', timeout: REQUEST_TIMEOUT_MS });

export const RANKING_KEY = 'ranking';
export const HISTORY_KEY = 'history';

export async function fetchRanking(
  config: MatchConfig,
  page: number,
  signal: AbortSignal,
): Promise<RankingPage> {
  const response = await http.get<unknown>('/ranking', {
    params: { ...config, page, pageSize: PAGE_SIZE },
    signal,
  });
  return rankingPageSchema.parse(response.data);
}

export async function fetchHistory(
  playerId: string,
  page: number,
  signal: AbortSignal,
): Promise<HistoryPage> {
  const response = await http.get<unknown>(`/players/${encodeURIComponent(playerId)}/matches`, {
    params: { page, pageSize: PAGE_SIZE },
    signal,
  });
  return historyPageSchema.parse(response.data);
}

export async function registerMatch(record: MatchRecord): Promise<MatchRecord> {
  const response = await http.put<unknown>(
    `/matches/${encodeURIComponent(record.matchId)}`,
    record,
  );
  return matchRecordSchema.parse(response.data);
}

export function useRanking(config: MatchConfig, page: number) {
  return useQuery({
    queryKey: [RANKING_KEY, config.sessionSeconds, config.spawnSeconds, page],
    queryFn: ({ signal }) => fetchRanking(config, page, signal),
    placeholderData: keepPreviousData,
    staleTime: FRESH_FOR_MS,
    refetchOnMount: 'always',
  });
}

export function useHistory(playerId: string, page: number) {
  return useQuery({
    queryKey: [HISTORY_KEY, playerId, page],
    queryFn: ({ signal }) => fetchHistory(playerId, page, signal),
    placeholderData: keepPreviousData,
    staleTime: FRESH_FOR_MS,
    refetchOnMount: 'always',
  });
}
