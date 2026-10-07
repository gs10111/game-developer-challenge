export interface PoolSlot {
  active: boolean;
}

export interface Pool<Slot extends PoolSlot> {
  readonly slots: readonly Slot[];
  readonly reset: (slot: Slot) => void;
}

function isFree(slot: PoolSlot): boolean {
  return !slot.active;
}

export function createPool<Slot extends PoolSlot>(
  capacity: number,
  create: () => Slot,
  reset: (slot: Slot) => void,
): Pool<Slot> {
  return { slots: Array.from({ length: capacity }, create), reset };
}

export function acquire<Slot extends PoolSlot>(pool: Pool<Slot>): Slot | null {
  const slot = pool.slots.find(isFree);
  if (slot === undefined) {
    return null;
  }
  pool.reset(slot);
  slot.active = true;
  return slot;
}

export function release<Slot extends PoolSlot>(pool: Pool<Slot>, slot: Slot): void {
  pool.reset(slot);
  slot.active = false;
}
