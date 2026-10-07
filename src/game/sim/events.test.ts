import { describe, expect, test } from 'vitest';
import { Layer } from './collision/layers';
import { createEventQueue, EventKind, pushEvent, WeaponName } from './events';
import type { EventQueue, GameEvent } from './events';
import { EVENT_QUEUE_CAPACITY } from './limits';

const WEAPONS = [WeaponName.Front, WeaponName.Left, WeaponName.Right];
const LAYERS = [Layer.Player, Layer.Enemy, Layer.Enemy, null];
const NEVER_USED = {
  kind: 'shotFired',
  layer: null,
  weapon: null,
  x: 0,
  y: 0,
  directionX: 0,
  directionY: 0,
};

function shotNumber(index: number): GameEvent {
  return {
    kind: EventKind.ShotFired,
    layer: LAYERS[index % LAYERS.length] ?? null,
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
    shot.layer,
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
    expect(slots).toStrictEqual(slots.map(() => NEVER_USED));
    expect(EventKind).toStrictEqual({
      ShotFired: 'shotFired',
      Hit: 'hit',
      Destroyed: 'destroyed',
    });

    for (const [index, shot] of shots.entries()) {
      expect(push(queue, shot)).toBe(slots[index]);
      expect(queue.count).toBe(index + 1);
    }

    expect(validEvents(queue)).toStrictEqual(shots);
    expect(validEvents(queue).slice(0, 4)).toStrictEqual([
      { kind: 'shotFired', layer: 'player', weapon: 'front', x: 100, y: 400, directionX: 0, directionY: -0 },
      { kind: 'shotFired', layer: 'enemy', weapon: 'left', x: 101, y: 398, directionX: 1 / 128, directionY: -1 / 256 },
      { kind: 'shotFired', layer: 'enemy', weapon: 'right', x: 102, y: 396, directionX: 2 / 128, directionY: -2 / 256 },
      { kind: 'shotFired', layer: null, weapon: 'front', x: 103, y: 394, directionX: 3 / 128, directionY: -3 / 256 },
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
    expect(short.items).toStrictEqual([NEVER_USED, NEVER_USED]);
    expect(push(short, shotNumber(7))).toBe(short.items[0]);
    expect(push(short, shotNumber(8))).toBe(short.items[1]);
    expect(push(short, shotNumber(9))).toBeNull();
    expect(short.count).toBe(2);
    expect(validEvents(short)).toStrictEqual([shotNumber(7), shotNumber(8)]);
    expect(validEvents(short).map(({ layer, weapon }) => ({ layer, weapon }))).toEqual([
      { layer: null, weapon: 'left' },
      { layer: 'player', weapon: 'right' },
    ]);

    short.count = 0;

    expect(pushEvent(short, EventKind.Hit, Layer.Enemy, null, 640, 360, 0.6, 0.8)).toBe(
      short.items[0],
    );
    expect(pushEvent(short, EventKind.Destroyed, Layer.Player, null, 12, 34, 0, 0)).toBe(
      short.items[1],
    );
    expect(pushEvent(short, EventKind.Hit, null, null, 1, 2, 1, 0)).toBeNull();
    expect(validEvents(short)).toStrictEqual([
      { kind: 'hit', layer: 'enemy', weapon: null, x: 640, y: 360, directionX: 0.6, directionY: 0.8 },
      { kind: 'destroyed', layer: 'player', weapon: null, x: 12, y: 34, directionX: 0, directionY: 0 },
    ]);
  });
});
