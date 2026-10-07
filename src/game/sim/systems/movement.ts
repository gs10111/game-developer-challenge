import { cosine, normaliseHeading, sine } from '../math/rotation';
import type { World } from '../world';

export function movement(world: World, dt: number): void {
  const slots = world.ships.slots;
  const capacity = slots.length;
  for (let index = 0; index < capacity; index += 1) {
    const ship = slots[index];
    if (ship?.active) {
      const distance = ship.thrust * ship.speed * dt;
      ship.heading = normaliseHeading(ship.heading + ship.turn * ship.turnRate * dt);
      ship.x += cosine(ship.heading) * distance;
      ship.y += sine(ship.heading) * distance;
    }
  }
}
