import { useState } from 'react';
import type { ReactNode } from 'react';
import { END_REASON_LABELS, PAGE_SIZE } from '../api/contracts';
import type { MatchConfig } from '../api/contracts';
import { useHistory, useRanking } from '../api/matches';
import { formatClock, formatDate } from './format';

interface PagerProps {
  page: number;
  total: number;
  onChange: (page: number) => void;
}

function Pager({ page, total, onChange }: PagerProps) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <nav className="pager" aria-label="Pages">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => {
          onChange(page - 1);
        }}
      >
        Previous
      </button>
      <span data-testid="page-indicator">
        Page {page} of {pages}
      </span>
      <button
        type="button"
        disabled={page >= pages}
        onClick={() => {
          onChange(page + 1);
        }}
      >
        Next
      </button>
    </nav>
  );
}

interface BoardProps {
  name: string;
  pending: boolean;
  failed: boolean;
  fetching: boolean;
  empty: boolean;
  emptyMessage: string;
  onRetry: () => void;
  children: ReactNode;
}

function Board({
  name,
  pending,
  failed,
  fetching,
  empty,
  emptyMessage,
  onRetry,
  children,
}: BoardProps) {
  if (pending) {
    return <p role="status">Loading the {name}…</p>;
  }
  if (failed) {
    return (
      <div role="alert" className="notice">
        <p>The {name} could not be loaded.</p>
        <button type="button" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }
  if (empty) {
    return <p data-testid="empty-list">{emptyMessage}</p>;
  }
  return (
    <>
      {children}
      <p role="status" className="hint">
        {fetching && 'Updating…'}
      </p>
    </>
  );
}

interface RankingPanelProps {
  config: MatchConfig;
  playerId: string;
}

export function RankingPanel({ config, playerId }: RankingPanelProps) {
  const [page, setPage] = useState(1);
  const ranking = useRanking(config, page);
  const items = ranking.data?.items ?? [];

  return (
    <section aria-label="Ranking">
      <p className="hint">
        Matches of {config.sessionSeconds} seconds with an enemy every {config.spawnSeconds}{' '}
        seconds. Ties go to the earlier match.
      </p>
      <Board
        name="ranking"
        pending={ranking.isPending}
        failed={ranking.isError}
        fetching={ranking.isFetching}
        empty={items.length === 0}
        emptyMessage="No matches with these settings yet."
        onRetry={() => {
          void ranking.refetch();
        }}
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Captain</th>
              <th scope="col">Score</th>
              <th scope="col">Date</th>
            </tr>
          </thead>
          <tbody>
            {items.map((entry) => (
              <tr key={entry.matchId} className={entry.playerId === playerId ? 'own' : undefined}>
                <td>{entry.rank}</td>
                <td>{entry.playerName}</td>
                <td>{entry.score}</td>
                <td>{formatDate(entry.finishedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pager page={page} total={ranking.data?.total ?? 0} onChange={setPage} />
      </Board>
    </section>
  );
}

interface HistoryPanelProps {
  playerId: string;
}

export function HistoryPanel({ playerId }: HistoryPanelProps) {
  const [page, setPage] = useState(1);
  const history = useHistory(playerId, page);
  const items = history.data?.items ?? [];

  return (
    <section aria-label="Match History">
      <Board
        name="match history"
        pending={history.isPending}
        failed={history.isError}
        fetching={history.isFetching}
        empty={items.length === 0}
        emptyMessage="You have not finished a match yet."
        onRetry={() => {
          void history.refetch();
        }}
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Score</th>
              <th scope="col">Duration</th>
              <th scope="col">Ended by</th>
            </tr>
          </thead>
          <tbody>
            {items.map((record) => (
              <tr key={record.matchId}>
                <td>{formatDate(record.finishedAt)}</td>
                <td>{record.score}</td>
                <td>{formatClock(record.durationSeconds)}</td>
                <td>{END_REASON_LABELS[record.endReason]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pager page={page} total={history.data?.total ?? 0} onChange={setPage} />
      </Board>
    </section>
  );
}
