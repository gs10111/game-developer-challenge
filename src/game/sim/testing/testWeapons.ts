import type { Weapons } from '../../config/gameConfig';

export function testWeapons() {
  return {
    front: {
      cooldownSeconds: 0.5,
      projectileSpeed: 300,
      projectileRadius: 4,
      projectileLifetimeSeconds: 2,
      damage: 20,
    },
    broadside: {
      cooldownSeconds: 1,
      projectileSpeed: 240,
      projectileRadius: 3,
      projectileLifetimeSeconds: 1.5,
      damage: 12,
      spacing: 16,
    },
  } satisfies Weapons;
}
