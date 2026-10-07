import type { World } from '../../world';

function clamp(value: number, lowest: number, highest: number): number {
  return Math.min(Math.max(value, lowest), highest);
}

export function arenaBounds(world: World): void {
  const arena = world.config.arena;
  const slots = world.ships.slots;
  const capacity = slots.length;
  for (let index = 0; index < capacity; index += 1) {
    const ship = slots[index];
    if (ship?.active) {
      ship.x = clamp(ship.x, ship.radius, arena.width - ship.radius);
      ship.y = clamp(ship.y, ship.radius, arena.height - ship.radius);
    }
  }
}
