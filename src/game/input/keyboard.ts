import { Command } from '../sim/commands';
import { press, release } from './commandState';
import type { CommandState } from './commandState';

const KEY_COMMANDS: Readonly<Record<string, number>> = {
  KeyW: Command.Forward,
  ArrowUp: Command.Forward,
  KeyA: Command.TurnLeft,
  ArrowLeft: Command.TurnLeft,
  KeyD: Command.TurnRight,
  ArrowRight: Command.TurnRight,
  Space: Command.FireFront,
  KeyQ: Command.FireLeft,
  KeyE: Command.FireRight,
};

const PAUSE_KEYS: readonly string[] = ['KeyP', 'Escape'];

export interface KeyboardOptions {
  capturing: () => boolean;
  onPauseKey: () => void;
}

export function attachKeyboard(state: CommandState, options: KeyboardOptions): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (!options.capturing()) {
      return;
    }
    if (PAUSE_KEYS.includes(event.code)) {
      event.preventDefault();
      if (!event.repeat) {
        options.onPauseKey();
      }
      return;
    }
    const command = KEY_COMMANDS[event.code];
    if (command !== undefined) {
      event.preventDefault();
      press(state, command);
    }
  };
  const onKeyUp = (event: KeyboardEvent): void => {
    const command = KEY_COMMANDS[event.code];
    if (command !== undefined) {
      release(state, command);
    }
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  };
}
