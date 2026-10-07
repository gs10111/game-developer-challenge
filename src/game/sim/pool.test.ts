import { describe, expect, test } from 'vitest';
import { Layer } from './collision/layers';
import { acquire, createPool, release } from './pool';
import type { Pool, PoolSlot } from './pool';
import { testWeapons } from './testing/testWeapons';
import { createProjectile, createShip, resetProjectile, resetShip } from './world';

interface Crate extends PoolSlot {
  cargo: number;
}

function take<Slot extends PoolSlot>(pool: Pool<Slot>): Slot {
  const slot = acquire(pool);
  if (slot === null) {
    throw new Error('The pool has no free slot');
  }
  return slot;
}

function overwriteEveryField(slot: PoolSlot, fresh: PoolSlot): void {
  for (const [field, freshValue] of Object.entries(fresh)) {
    if (typeof freshValue === 'number') {
      Reflect.set(slot, field, freshValue + 7.25);
    } else if (typeof freshValue === 'boolean') {
      Reflect.set(slot, field, !freshValue);
    } else if (field === 'weapons') {
      Reflect.set(slot, field, testWeapons());
    } else if (field === 'layer') {
      Reflect.set(slot, field, Layer.Enemy);
    } else {
      throw new Error(`No way to overwrite the field ${field}`);
    }
  }
}

function fieldsStillFresh(slot: PoolSlot, fresh: PoolSlot): string[] {
  return Object.keys(fresh).filter((field) => Reflect.get(slot, field) === Reflect.get(fresh, field));
}

describe('entity pool (ADR-0006)', () => {
  test('MT-05 a released pool slot is indistinguishable from a fresh one', () => {
    const pool = createPool(2, createShip, resetShip);
    const ship = take(pool);

    overwriteEveryField(ship, createShip());
    expect(fieldsStillFresh(ship, createShip())).toEqual([]);

    release(pool, ship);

    expect(ship).toStrictEqual(createShip());
    expect(ship).toStrictEqual(pool.slots[1]);

    overwriteEveryField(ship, createShip());
    ship.active = false;

    expect(acquire(pool)).toBe(ship);
    expect(ship).toStrictEqual({ ...createShip(), active: true });
  });

  test('MT-05 a released projectile slot is indistinguishable from a fresh one', () => {
    const pool = createPool(2, createProjectile, resetProjectile);
    const projectile = take(pool);

    overwriteEveryField(projectile, createProjectile());
    expect(fieldsStillFresh(projectile, createProjectile())).toEqual([]);

    release(pool, projectile);

    expect(projectile).toStrictEqual({
      active: false,
      layer: null,
      consumed: false,
      x: 0,
      y: 0,
      previousX: 0,
      previousY: 0,
      directionX: 0,
      directionY: 0,
      speed: 0,
      radius: 0,
      damage: 0,
      remainingSteps: 0,
    });
    expect(projectile).toStrictEqual(createProjectile());
    expect(projectile).toStrictEqual(pool.slots[1]);

    overwriteEveryField(projectile, createProjectile());
    projectile.active = false;

    expect(acquire(pool)).toBe(projectile);
    expect(projectile).toStrictEqual({ ...createProjectile(), active: true });
  });

  test('PW-03 the pool hands out slots in index order and returns null when exhausted', () => {
    let created = 0;
    const pool = createPool<Crate>(
      3,
      () => {
        created += 1;
        return { active: false, cargo: 0 };
      },
      (crate) => {
        crate.active = false;
        crate.cargo = 0;
      },
    );

    expect(created).toBe(3);
    expect(pool.slots).toHaveLength(3);
    expect(new Set(pool.slots).size).toBe(3);
    expect(pool.slots.map((slot) => slot.active)).toEqual([false, false, false]);

    const first = take(pool);
    const second = take(pool);
    const third = take(pool);

    expect(first).toBe(pool.slots[0]);
    expect(second).toBe(pool.slots[1]);
    expect(third).toBe(pool.slots[2]);
    expect(pool.slots.map((slot) => slot.active)).toEqual([true, true, true]);
    expect(acquire(pool)).toBeNull();
    expect(acquire(pool)).toBeNull();

    release(pool, second);

    expect(pool.slots.map((slot) => slot.active)).toEqual([true, false, true]);
    expect(acquire(pool)).toBe(second);
    expect(acquire(pool)).toBeNull();

    release(pool, third);
    release(pool, first);

    expect(acquire(pool)).toBe(first);
    expect(acquire(pool)).toBe(third);
    expect(acquire(pool)).toBeNull();
    expect(created).toBe(3);
    expect(pool.slots).toHaveLength(3);
  });
});
