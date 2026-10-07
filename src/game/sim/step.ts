import { STEP_SECONDS } from './stepRate';
import { arenaBounds } from './systems/collision/arenaBounds';
import { blockedShips } from './systems/collision/blockedShips';
import { islandCollision } from './systems/collision/islandCollision';
import { projectileObstacles } from './systems/collision/projectileObstacles';
import { movement } from './systems/movement';
import { playerIntent } from './systems/playerIntent';
import { projectiles } from './systems/projectiles';
import { weapons } from './systems/weapons';
import type { World } from './world';

type System = (world: World, dt: number) => void;

function collision(world: World): void {
  islandCollision(world);
  arenaBounds(world);
  blockedShips(world);
  projectileObstacles(world);
}

const inputStage: System = playerIntent;
const movementStage: System = movement;
const weaponsStage: System = weapons;
const projectilesStage: System = projectiles;
const collisionStage: System = collision;

export function step(world: World, commands: number): void {
  world.commands = commands;
  world.events.count = 0;
  inputStage(world, STEP_SECONDS);
  movementStage(world, STEP_SECONDS);
  weaponsStage(world, STEP_SECONDS);
  projectilesStage(world, STEP_SECONDS);
  collisionStage(world, STEP_SECONDS);
  world.step += 1;
}
