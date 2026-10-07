export const EventKind = {
  ShotFired: 'shotFired',
} as const;

export type EventKind = (typeof EventKind)[keyof typeof EventKind];

export const WeaponName = {
  Front: 'front',
  Left: 'left',
  Right: 'right',
} as const;

export type WeaponName = (typeof WeaponName)[keyof typeof WeaponName];

export interface GameEvent {
  kind: EventKind;
  weapon: WeaponName;
  x: number;
  y: number;
  directionX: number;
  directionY: number;
}

export interface EventQueue {
  count: number;
  readonly items: readonly GameEvent[];
}

function createEvent(): GameEvent {
  return {
    kind: EventKind.ShotFired,
    weapon: WeaponName.Front,
    x: 0,
    y: 0,
    directionX: 0,
    directionY: 0,
  };
}

export function createEventQueue(capacity: number): EventQueue {
  return { count: 0, items: Array.from({ length: capacity }, createEvent) };
}

export function pushEvent(
  queue: EventQueue,
  kind: EventKind,
  weapon: WeaponName,
  x: number,
  y: number,
  directionX: number,
  directionY: number,
): GameEvent | null {
  const event = queue.items[queue.count];
  if (event === undefined) {
    return null;
  }
  event.kind = kind;
  event.weapon = weapon;
  event.x = x;
  event.y = y;
  event.directionX = directionX;
  event.directionY = directionY;
  queue.count += 1;
  return event;
}
