import { STEP_SECONDS } from './stepRate';
import { arenaBounds } from './systems/collision/arenaBounds';
import { blockedShips } from './systems/collision/blockedShips';
import { islandCollision } from './systems/collision/islandCollision';
import { movement } from './systems/movement';
import { playerIntent } from './systems/playerIntent';
import type { World } from './world';

type System = (world: World, dt: number) => void;

function collision(world: World): void {
  islandCollision(world);
  arenaBounds(world);
  blockedShips(world);
}

const inputStage: System = playerIntent;
const movementStage: System = movement;
const collisionStage: System = collision;

export function step(world: World, commands: number): void {
  world.commands = commands;
  inputStage(world, STEP_SECONDS);
  movementStage(world, STEP_SECONDS);
  collisionStage(world, STEP_SECONDS);
  world.step += 1;
}
