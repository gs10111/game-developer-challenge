import { retryMatch, useRecordStatus } from '../api/outbox';

interface RecordStatusLineProps {
  matchId: string;
}

export function RecordStatusLine({ matchId }: RecordStatusLineProps) {
  const status = useRecordStatus(matchId);

  return (
    <span role="status" data-testid="record-status" data-status={status}>
      {status === 'saved' && 'Saved to the ranking and the history.'}
      {status === 'saving' && 'Saving…'}
      {status === 'failed' && (
        <>
          Not saved yet.{' '}
          <button
            type="button"
            className="link"
            onClick={() => {
              retryMatch(matchId);
            }}
          >
            Try again
          </button>
        </>
      )}
    </span>
  );
}
