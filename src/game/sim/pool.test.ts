import { describe, expect, test } from 'vitest';
import { acquire, createPool, release } from './pool';
import type { Pool, PoolSlot } from './pool';
import { createShip, resetShip } from './world';
import type { Ship } from './world';

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

function overwriteEveryField(ship: Ship): void {
  for (const [field, freshValue] of Object.entries(createShip())) {
    if (typeof freshValue === 'number') {
      Reflect.set(ship, field, freshValue + 7.25);
    } else if (typeof freshValue === 'boolean') {
      Reflect.set(ship, field, !freshValue);
    } else {
      throw new Error(`No way to overwrite the field ${field}`);
    }
  }
}

function fieldsStillFresh(ship: Ship): string[] {
  const fresh = createShip();
  return Object.keys(fresh).filter((field) => Reflect.get(ship, field) === Reflect.get(fresh, field));
}

describe('entity pool (ADR-0006)', () => {
  test('MT-05 a released pool slot is indistinguishable from a fresh one', () => {
    const pool = createPool(2, createShip, resetShip);
    const ship = take(pool);

    overwriteEveryField(ship);
    expect(fieldsStillFresh(ship)).toEqual([]);

    release(pool, ship);

    expect(ship).toStrictEqual(createShip());
    expect(ship).toStrictEqual(pool.slots[1]);

    overwriteEveryField(ship);
    ship.active = false;

    expect(acquire(pool)).toBe(ship);
    expect(ship).toStrictEqual({ ...createShip(), active: true });
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
