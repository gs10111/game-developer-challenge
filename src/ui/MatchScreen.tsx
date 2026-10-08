import { useEffect, useId, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { useStore } from 'zustand';
import { END_REASON_LABELS } from '../api/contracts';
import type { MatchRecord } from '../api/contracts';
import { loadMuted } from '../game/audio/sounds';
import type { GameConfig } from '../game/config/gameConfig';
import { perfReports } from '../game/runtime/perf';
import type { PerfReport } from '../game/runtime/perf';
import { createGameSession } from '../game/runtime/session';
import type { GameSession } from '../game/runtime/session';
import { Command } from '../game/sim/commands';
import { formatClock } from './format';
import { Modal } from './Modal';
import { RecordStatusLine } from './RecordStatusLine';

export interface MatchTicket {
  matchId: string;
  seed: number;
  config: GameConfig;
  playerId: string;
  playerName: string;
}

interface MatchScreenProps {
  ticket: MatchTicket;
  onFinished: (record: MatchRecord) => void;
  onPlayAgain: () => void;
  onExit: () => void;
}

type LoadState =
  | { status: 'loading'; progress: number }
  | { status: 'ready' }
  | { status: 'failed' };

interface HoldButtonProps {
  session: GameSession;
  command: number;
  label: string;
  symbol: string;
}

function HoldButton({ session, command, label, symbol }: HoldButtonProps) {
  const letGo = (): void => {
    session.release(command);
  };
  return (
    <button
      type="button"
      className="touch-button"
      aria-label={label}
      onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        session.press(command);
      }}
      onPointerUp={letGo}
      onPointerCancel={letGo}
      onLostPointerCapture={letGo}
      onContextMenu={(event) => {
        event.preventDefault();
      }}
    >
      {symbol}
    </button>
  );
}

function TouchControls({ session }: { session: GameSession }) {
  return (
    <div className="touch" data-testid="touch-controls">
      <div className="touch-group">
        <HoldButton session={session} command={Command.TurnLeft} label="Turn left" symbol="↺" />
        <HoldButton session={session} command={Command.Forward} label="Sail forward" symbol="▲" />
        <HoldButton session={session} command={Command.TurnRight} label="Turn right" symbol="↻" />
      </div>
      <div className="touch-group">
        <HoldButton
          session={session}
          command={Command.FireLeft}
          label="Fire left broadside"
          symbol="◀"
        />
        <HoldButton
          session={session}
          command={Command.FireFront}
          label="Fire front cannon"
          symbol="●"
        />
        <HoldButton
          session={session}
          command={Command.FireRight}
          label="Fire right broadside"
          symbol="▶"
        />
      </div>
    </div>
  );
}

function Hud({ session }: { session: GameSession }) {
  const score = useStore(session.hud, (state) => state.score);
  const remainingSeconds = useStore(session.hud, (state) => state.remainingSeconds);
  const health = useStore(session.hud, (state) => state.health);
  const maximumHealth = useStore(session.hud, (state) => state.maximumHealth);
  const healthId = useId();
  const assets = `${import.meta.env.BASE_URL}assets/`;

  return (
    <div className="hud" role="group" aria-label="Match status">
      <span className="hud-item">
        <img className="hud-icon" src={`${assets}icon_score.png`} alt="" />
        Score <output data-testid="hud-score">{score}</output>
      </span>
      <span className="hud-item">
        <img className="hud-icon" src={`${assets}icon_time.png`} alt="" />
        Time{' '}
        <output aria-live="off" data-testid="hud-time">
          {formatClock(remainingSeconds)}
        </output>
      </span>
      <span className="hud-item" data-low={health * 3 <= maximumHealth}>
        <img className="hud-icon" src={`${assets}icon_heart.png`} alt="" />
        <label htmlFor={healthId}>Health</label>
        <meter
          id={healthId}
          min={0}
          max={maximumHealth}
          low={maximumHealth / 3}
          high={(2 * maximumHealth) / 3}
          optimum={maximumHealth}
          value={health}
        />
        <output aria-live="off" data-testid="hud-health">
          {health}
        </output>
      </span>
    </div>
  );
}

interface ActiveMatchProps {
  session: GameSession;
  result: MatchRecord | null;
  benchmark: readonly PerfReport[] | null;
  onPlayAgain: () => void;
  onExit: () => void;
}

function ActiveMatch({ session, result, benchmark, onPlayAgain, onExit }: ActiveMatchProps) {
  const phase = useStore(session.hud, (state) => state.phase);
  const [touch, setTouch] = useState(() => window.matchMedia('(pointer: coarse)').matches);
  const [muted, setMuted] = useState(loadMuted);

  return (
    <>
      <header className="match-bar">
        <Hud session={session} />
        <p className="visually-hidden" role="status" data-testid="match-phase">
          {phase === 'running' && 'Match running'}
          {phase === 'paused' && 'Match paused'}
          {phase === 'ended' && 'Match over'}
        </p>
        <div className="match-actions">
          <button type="button" onClick={session.pause} disabled={phase !== 'running'}>
            Pause
          </button>
          <button
            type="button"
            aria-pressed={!muted}
            onClick={() => {
              session.setMuted(!muted);
              setMuted(!muted);
            }}
          >
            Sound
          </button>
          <button
            type="button"
            aria-pressed={touch}
            onClick={() => {
              setTouch((shown) => !shown);
            }}
          >
            Touch
          </button>
          <button type="button" onClick={onExit}>
            Exit
          </button>
        </div>
      </header>
      {touch && <TouchControls session={session} />}
      {phase === 'paused' && (
        <Modal title="Paused" onDismiss={session.resume}>
          <p>The clock, the cooldowns and the ships are suspended.</p>
          <div className="actions">
            <button type="button" className="primary" autoFocus onClick={session.resume}>
              Resume
            </button>
            <button type="button" onClick={onExit}>
              Main Menu
            </button>
          </div>
        </Modal>
      )}
      {result !== null && (
        <Modal title="Match over">
          <dl className="result">
            <dt>Score</dt>
            <dd data-testid="result-score">{result.score}</dd>
            <dt>Time played</dt>
            <dd data-testid="result-time">{formatClock(result.durationSeconds)}</dd>
            <dt>Reason</dt>
            <dd data-testid="result-reason">{END_REASON_LABELS[result.endReason]}</dd>
            <dt>Record</dt>
            <dd>
              {benchmark === null ? (
                <RecordStatusLine matchId={result.matchId} />
              ) : (
                'Benchmark run, not recorded.'
              )}
            </dd>
          </dl>
          {benchmark !== null && (
            <label className="benchmark">
              Performance report
              <textarea
                readOnly
                rows={8}
                data-testid="performance-report"
                value={JSON.stringify(benchmark, null, 2)}
              />
            </label>
          )}
          <div className="actions">
            <button type="button" className="primary" autoFocus onClick={onPlayAgain}>
              Play Again
            </button>
            <button type="button" onClick={onExit}>
              Main Menu
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

export function MatchScreen({ ticket, onFinished, onPlayAgain, onExit }: MatchScreenProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const finishedRef = useRef(onFinished);
  const [attempt, setAttempt] = useState(0);
  const [load, setLoad] = useState<LoadState>({ status: 'loading', progress: 0 });
  const [session, setSession] = useState<GameSession | null>(null);
  const [result, setResult] = useState<MatchRecord | null>(null);
  const [benchmark, setBenchmark] = useState<readonly PerfReport[] | null>(null);

  useEffect(() => {
    finishedRef.current = onFinished;
  });

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) {
      return;
    }
    let cancelled = false;
    let created: GameSession | null = null;
    createGameSession({
      host,
      config: ticket.config,
      seed: ticket.seed,
      onProgress: (progress) => {
        if (!cancelled) {
          setLoad({ status: 'loading', progress });
        }
      },
      onEnd: (summary) => {
        if (cancelled) {
          return;
        }
        const record: MatchRecord = {
          matchId: ticket.matchId,
          playerId: ticket.playerId,
          playerName: ticket.playerName,
          finishedAt: new Date().toISOString(),
          score: summary.score,
          durationSeconds: summary.playedSeconds,
          endReason: summary.outcome,
          config: {
            sessionSeconds: ticket.config.match.durationSeconds,
            spawnSeconds: ticket.config.enemies.spawn.intervalSeconds,
          },
        };
        setResult(record);
        if (summary.performance !== null) {
          setBenchmark([...perfReports()]);
        }
        finishedRef.current(record);
      },
    })
      .then((ready) => {
        if (cancelled) {
          ready.destroy();
          return;
        }
        created = ready;
        setSession(ready);
        setLoad({ status: 'ready' });
      })
      .catch(() => {
        if (!cancelled) {
          setLoad({ status: 'failed' });
        }
      });
    return () => {
      cancelled = true;
      created?.destroy();
    };
  }, [attempt, ticket]);

  return (
    <main className="match">
      <h1 className="visually-hidden">Pirate Battle match</h1>
      {session !== null && (
        <ActiveMatch
          session={session}
          result={result}
          benchmark={benchmark}
          onPlayAgain={onPlayAgain}
          onExit={onExit}
        />
      )}
      <div className="arena" ref={hostRef} data-testid="arena" />
      {load.status === 'loading' && (
        <div className="overlay" role="status">
          <p>Loading the arena…</p>
          <progress max={1} value={load.progress} aria-label="Loading progress" />
        </div>
      )}
      {load.status === 'failed' && (
        <div className="overlay" role="alert">
          <p>The arena could not be loaded.</p>
          <div className="actions">
            <button
              type="button"
              className="primary"
              onClick={() => {
                setLoad({ status: 'loading', progress: 0 });
                setAttempt((count) => count + 1);
              }}
            >
              Try again
            </button>
            <button type="button" onClick={onExit}>
              Main Menu
            </button>
          </div>
        </div>
      )}
      <p className="rotate-notice">Turn your device sideways for a larger arena.</p>
      <p className="controls-hint">
        W or ↑ sail · A/D or ←/→ turn · Space front cannon · Q/E broadsides · P pause
      </p>
    </main>
  );
}
