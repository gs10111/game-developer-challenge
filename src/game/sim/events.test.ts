import { describe, expect, test } from 'vitest';
import { createEventQueue, EventKind, pushEvent, WeaponName } from './events';
import type { EventQueue, GameEvent } from './events';
import { EVENT_QUEUE_CAPACITY } from './limits';

const WEAPONS = [WeaponName.Front, WeaponName.Left, WeaponName.Right];

function shotNumber(index: number): GameEvent {
  return {
    kind: EventKind.ShotFired,
    weapon: WEAPONS[index % WEAPONS.length] ?? WeaponName.Front,
    x: 100 + index,
    y: 400 - 2 * index,
    directionX: index / 128,
    directionY: -index / 256,
  };
}

function push(queue: EventQueue, shot: GameEvent): GameEvent | null {
  return pushEvent(
    queue,
    shot.kind,
    shot.weapon,
    shot.x,
    shot.y,
    shot.directionX,
    shot.directionY,
  );
}

function validEvents(queue: EventQueue): GameEvent[] {
  return queue.items.slice(0, queue.count);
}

describe('event queue (ADR-0006)', () => {
  test('FX-01 the event queue keeps events in order up to its capacity and drops the rest', () => {
    const queue = createEventQueue(EVENT_QUEUE_CAPACITY);
    const slots = [...queue.items];
    const shots = Array.from({ length: EVENT_QUEUE_CAPACITY }, (_, index) => shotNumber(index));

    expect(EVENT_QUEUE_CAPACITY).toBe(128);
    expect(queue.count).toBe(0);
    expect(slots).toHaveLength(EVENT_QUEUE_CAPACITY);
    expect(new Set(slots).size).toBe(EVENT_QUEUE_CAPACITY);

    for (const [index, shot] of shots.entries()) {
      expect(push(queue, shot)).toBe(slots[index]);
      expect(queue.count).toBe(index + 1);
    }

    expect(validEvents(queue)).toStrictEqual(shots);
    expect(validEvents(queue).slice(0, 4)).toStrictEqual([
      { kind: 'shotFired', weapon: 'front', x: 100, y: 400, directionX: 0, directionY: -0 },
      { kind: 'shotFired', weapon: 'left', x: 101, y: 398, directionX: 1 / 128, directionY: -1 / 256 },
      { kind: 'shotFired', weapon: 'right', x: 102, y: 396, directionX: 2 / 128, directionY: -2 / 256 },
      { kind: 'shotFired', weapon: 'front', x: 103, y: 394, directionX: 3 / 128, directionY: -3 / 256 },
    ]);

    const oneTooMany = shotNumber(EVENT_QUEUE_CAPACITY);

    expect(push(queue, oneTooMany)).toBeNull();
    expect(push(queue, oneTooMany)).toBeNull();
    expect(queue.count).toBe(EVENT_QUEUE_CAPACITY);
    expect(queue.items).toHaveLength(EVENT_QUEUE_CAPACITY);
    expect(queue.items.filter((item, index) => item !== slots[index])).toEqual([]);
    expect(validEvents(queue)).toStrictEqual(shots);

    const short = createEventQueue(2);

    expect(short.items).toHaveLength(2);
    expect(push(short, shotNumber(7))).toBe(short.items[0]);
    expect(push(short, shotNumber(8))).toBe(short.items[1]);
    expect(push(short, shotNumber(9))).toBeNull();
    expect(short.count).toBe(2);
    expect(validEvents(short)).toStrictEqual([shotNumber(7), shotNumber(8)]);
  });
});
