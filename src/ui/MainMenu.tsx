import { useState } from 'react';
import { useStore } from 'zustand';
import { END_REASON_LABELS } from '../api/contracts';
import type { MatchRecord } from '../api/contracts';
import { outbox, retryAllMatches } from '../api/outbox';
import type { Options } from '../storage/options';
import { formatClock } from './format';
import { HistoryPanel, RankingPanel } from './Leaderboards';
import { MockPanel } from './MockPanel';
import { OptionsPanel } from './OptionsPanel';
import { RecordStatusLine } from './RecordStatusLine';

const TABS = [
  { id: 'play', label: 'Play' },
  { id: 'options', label: 'Options' },
  { id: 'ranking', label: 'Ranking' },
  { id: 'history', label: 'Match History' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const CONTROLS = [
  ['Sail forward', 'W or ↑', '▲'],
  ['Turn', 'A / D or ← / →', '↺ ↻'],
  ['Front cannon', 'Space', '●'],
  ['Left and right broadsides', 'Q / E', '◀ ▶'],
  ['Pause', 'P or Esc', 'Pause button'],
] as const;

interface MainMenuProps {
  options: Options;
  playerId: string;
  lastResult: MatchRecord | null;
  onOptionsSaved: (options: Options) => void;
  onPlay: () => void;
  onReset: () => void;
}

export function MainMenu({
  options,
  playerId,
  lastResult,
  onOptionsSaved,
  onPlay,
  onReset,
}: MainMenuProps) {
  const [tab, setTab] = useState<TabId>('play');
  const waiting = useStore(outbox, (state) => state.pending.length);
  const stuck = useStore(outbox, (state) => state.failed.length);
  const assets = `${import.meta.env.BASE_URL}assets/`;

  return (
    <main className="menu">
      <h1>
        <img src={`${assets}title_pirate_battle.png`} alt="Pirate Battle" width={384} height={128} />
      </h1>
      <div className="tabs" role="tablist" aria-label="Main menu">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls="menu-panel"
            onClick={() => {
              setTab(id);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="panel" id="menu-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === 'play' && (
          <>
            <p>
              Captain <strong>{options.playerName}</strong>, sink as many ships as you can in{' '}
              {options.sessionSeconds} seconds.
            </p>
            <div className="actions">
              <button type="button" className="primary" autoFocus onClick={onPlay}>
                Play
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('options');
                }}
              >
                Options
              </button>
            </div>
            <h2>Controls</h2>
            <table className="controls">
              <thead>
                <tr>
                  <th scope="col">Action</th>
                  <th scope="col">Keyboard</th>
                  <th scope="col">Touch</th>
                </tr>
              </thead>
              <tbody>
                {CONTROLS.map(([action, keys, touch]) => (
                  <tr key={action}>
                    <th scope="row">{action}</th>
                    <td>{keys}</td>
                    <td>{touch}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lastResult !== null && (
              <p data-testid="last-result">
                Last match: {lastResult.score} points in {formatClock(lastResult.durationSeconds)},{' '}
                {END_REASON_LABELS[lastResult.endReason].toLowerCase()}.{' '}
                <RecordStatusLine matchId={lastResult.matchId} />
              </p>
            )}
            {waiting > 0 && (
              <p className="notice" data-testid="pending-records">
                {waiting} finished {waiting === 1 ? 'match is' : 'matches are'} waiting to be
                saved.{' '}
                {stuck > 0 && (
                  <button type="button" className="link" onClick={retryAllMatches}>
                    Try again now
                  </button>
                )}
              </p>
            )}
          </>
        )}
        {tab === 'options' && <OptionsPanel options={options} onSaved={onOptionsSaved} />}
        {tab === 'ranking' && (
          <RankingPanel
            config={{ sessionSeconds: options.sessionSeconds, spawnSeconds: options.spawnSeconds }}
            playerId={playerId}
          />
        )}
        {tab === 'history' && <HistoryPanel playerId={playerId} />}
      </div>
      <MockPanel onReset={onReset} />
    </main>
  );
}
