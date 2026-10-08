import { useId, useState } from 'react';
import type { SubmitEvent } from 'react';
import { OPTION_LIMITS } from '../game/config/gameConfig';
import { optionsSchema, saveOptions } from '../storage/options';
import type { Options } from '../storage/options';

interface OptionsPanelProps {
  options: Options;
  onSaved: (options: Options) => void;
}

interface FieldProps {
  name: string;
  label: string;
  hint: string;
  value: string;
  error: string | undefined;
  numeric: boolean;
  onChange: (value: string) => void;
}

function Field({ name, label, hint, value, error, numeric, onChange }: FieldProps) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={name}
        type="text"
        inputMode={numeric ? 'decimal' : 'text'}
        autoComplete="off"
        value={value}
        aria-invalid={error !== undefined}
        aria-describedby={`${id}-hint ${id}-error`}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      <p id={`${id}-hint`} className="hint">
        {hint}
      </p>
      <p id={`${id}-error`} className="error" role="alert">
        {error}
      </p>
    </div>
  );
}

export function OptionsPanel({ options, onSaved }: OptionsPanelProps) {
  const [playerName, setPlayerName] = useState(options.playerName);
  const [sessionSeconds, setSessionSeconds] = useState(String(options.sessionSeconds));
  const [spawnSeconds, setSpawnSeconds] = useState(String(options.spawnSeconds));
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [saved, setSaved] = useState(false);
  const { sessionSeconds: sessionLimits, spawnSeconds: spawnLimits } = OPTION_LIMITS;

  const submit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const parsed = optionsSchema.safeParse({
      playerName,
      sessionSeconds: sessionSeconds.trim() === '' ? Number.NaN : Number(sessionSeconds),
      spawnSeconds: spawnSeconds.trim() === '' ? Number.NaN : Number(spawnSeconds),
    });
    if (!parsed.success) {
      const found: Partial<Record<string, string>> = {};
      for (const issue of parsed.error.issues) {
        found[String(issue.path[0])] ??= issue.message;
      }
      setErrors(found);
      setSaved(false);
      return;
    }
    saveOptions(parsed.data);
    onSaved(parsed.data);
    setErrors({});
    setSaved(true);
  };

  return (
    <form className="options" onSubmit={submit} noValidate>
      <Field
        name="playerName"
        label="Captain name"
        hint="Shown in the ranking."
        value={playerName}
        error={errors.playerName}
        numeric={false}
        onChange={setPlayerName}
      />
      <Field
        name="sessionSeconds"
        label="Game session time (seconds)"
        hint={`Whole seconds, from ${String(sessionLimits.minimum)} to ${String(sessionLimits.maximum)}.`}
        value={sessionSeconds}
        error={errors.sessionSeconds}
        numeric
        onChange={setSessionSeconds}
      />
      <Field
        name="spawnSeconds"
        label="Enemy spawn time (seconds)"
        hint={`From ${String(spawnLimits.minimum)} to ${String(spawnLimits.maximum)} seconds between enemies.`}
        value={spawnSeconds}
        error={errors.spawnSeconds}
        numeric
        onChange={setSpawnSeconds}
      />
      <div className="actions">
        <button type="submit" className="primary">
          Save options
        </button>
        <p role="status" data-testid="options-status">
          {saved && 'Options saved. They apply to the next match.'}
        </p>
      </div>
    </form>
  );
}
