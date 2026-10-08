import { cosine, sine } from '../math/rotation';
import type { Ship } from '../world';

const ONE_TABLE_UNIT = 1;

export function turnToward(ship: Ship, targetX: number, targetY: number, dt: number): -1 | 0 | 1 {
  const offsetX = targetX - ship.x;
  const offsetY = targetY - ship.y;
  if (offsetX === 0 && offsetY === 0) {
    return 0;
  }
  const aheadX = cosine(ship.heading);
  const aheadY = sine(ship.heading);
  const cross = aheadX * offsetY - aheadY * offsetX;
  const dot = aheadX * offsetX + aheadY * offsetY;
  const bandSine = sine(Math.max(ONE_TABLE_UNIT, ship.turnRate * dt));
  if (dot > 0 && cross * cross <= bandSine * bandSine * (offsetX * offsetX + offsetY * offsetY)) {
    return 0;
  }
  return cross >= 0 ? 1 : -1;
}
