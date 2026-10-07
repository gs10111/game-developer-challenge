import { STEP_SECONDS } from './stepRate';
import { arenaBounds } from './systems/collision/arenaBounds';
import { movement } from './systems/movement';
import { playerIntent } from './systems/playerIntent';
import type { World } from './world';

type System = (world: World, dt: number) => void;

const inputStage: System = playerIntent;
const movementStage: System = movement;
const collisionStage: System = arenaBounds;

export function step(world: World, commands: number): void {
  world.commands = commands;
  inputStage(world, STEP_SECONDS);
  movementStage(world, STEP_SECONDS);
  collisionStage(world, STEP_SECONDS);
  world.step += 1;
}
