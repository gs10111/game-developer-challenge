import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { z } from 'zod';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { readJson, removeKey, writeJson } from '../storage/localJson';
import { matchRecordSchema } from './contracts';
import type { MatchRecord } from './contracts';
import { HISTORY_KEY, RANKING_KEY, registerMatch } from './matches';

const OUTBOX_KEY = 'pirate-battle.outbox';
const LAST_RESULT_KEY = 'pirate-battle.last-result';
const SEND_RETRIES = 2;

interface OutboxState {
  pending: MatchRecord[];
  failed: string[];
}

function loadPending(): MatchRecord[] {
  const stored = z.array(matchRecordSchema).safeParse(readJson(OUTBOX_KEY));
  return stored.success ? stored.data : [];
}

export const outbox = createStore<OutboxState>(() => ({ pending: loadPending(), failed: [] }));

function setPending(pending: MatchRecord[]): void {
  writeJson(OUTBOX_KEY, pending);
  outbox.setState({ pending });
}

export function enqueueMatch(record: MatchRecord): void {
  const others = outbox.getState().pending.filter(({ matchId }) => matchId !== record.matchId);
  setPending([...others, record]);
}

export function confirmMatch(matchId: string): void {
  setPending(outbox.getState().pending.filter((record) => record.matchId !== matchId));
}

export function markFailed(matchId: string): void {
  const { failed } = outbox.getState();
  if (!failed.includes(matchId)) {
    outbox.setState({ failed: [...failed, matchId] });
  }
}

export function retryMatch(matchId: string): void {
  outbox.setState({ failed: outbox.getState().failed.filter((id) => id !== matchId) });
}

export function retryAllMatches(): void {
  outbox.setState({ failed: [] });
}

export function loadLastResult(): MatchRecord | null {
  const stored = matchRecordSchema.safeParse(readJson(LAST_RESULT_KEY));
  return stored.success ? stored.data : null;
}

export function saveLastResult(record: MatchRecord): void {
  writeJson(LAST_RESULT_KEY, record);
}

export function forgetLocalRecords(): void {
  removeKey(OUTBOX_KEY);
  removeKey(LAST_RESULT_KEY);
  outbox.setState({ pending: [], failed: [] });
}

export type RecordStatus = 'saved' | 'saving' | 'failed';

export function useRecordStatus(matchId: string): RecordStatus {
  const pending = useStore(outbox, (state) =>
    state.pending.some((record) => record.matchId === matchId),
  );
  const failed = useStore(outbox, (state) => state.failed.includes(matchId));
  if (!pending) {
    return 'saved';
  }
  return failed ? 'failed' : 'saving';
}

export function useOutboxSync(): void {
  const queryClient = useQueryClient();
  const pending = useStore(outbox, (state) => state.pending);
  const failed = useStore(outbox, (state) => state.failed);
  const inFlight = useRef(new Set<string>());
  const { mutate } = useMutation({
    mutationFn: registerMatch,
    retry: SEND_RETRIES,
    onSuccess: (_saved, record) => {
      confirmMatch(record.matchId);
      void queryClient.invalidateQueries({ queryKey: [RANKING_KEY] });
      void queryClient.invalidateQueries({ queryKey: [HISTORY_KEY] });
    },
    onError: (_error, record) => {
      markFailed(record.matchId);
    },
    onSettled: (_saved, _error, record) => {
      inFlight.current.delete(record.matchId);
    },
  });

  useEffect(() => {
    for (const record of pending) {
      if (!failed.includes(record.matchId) && !inFlight.current.has(record.matchId)) {
        inFlight.current.add(record.matchId);
        mutate(record);
      }
    }
  }, [pending, failed, mutate]);
}
