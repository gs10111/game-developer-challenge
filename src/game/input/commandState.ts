export interface CommandState {
  mask: number;
}

export function createCommandState(): CommandState {
  return { mask: 0 };
}

export function press(state: CommandState, command: number): void {
  state.mask |= command;
}

export function release(state: CommandState, command: number): void {
  state.mask &= ~command;
}

export function clear(state: CommandState): void {
  state.mask = 0;
}
