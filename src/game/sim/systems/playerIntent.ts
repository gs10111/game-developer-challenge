import { Command } from '../commands';
import type { World } from '../world';

export function playerIntent(world: World): void {
  const commands = world.commands;
  const player = world.player;
  const turnsLeft = (commands & Command.TurnLeft) !== 0;
  const turnsRight = (commands & Command.TurnRight) !== 0;
  player.thrust = (commands & Command.Forward) === 0 ? 0 : 1;
  if (turnsLeft === turnsRight) {
    player.turn = 0;
  } else {
    player.turn = turnsRight ? 1 : -1;
  }
}
