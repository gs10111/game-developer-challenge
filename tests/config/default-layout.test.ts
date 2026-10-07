import { describe, expect, test } from 'vitest';
import { DEFAULT_GAME_CONFIG } from '../../src/game/config/gameConfig';
import type { ConvexPolygon, GameConfig, Point } from '../../src/game/config/gameConfig';
import { circlePolygonOverlap } from '../../src/game/sim/collision/circlePolygon';
import type { Overlap } from '../../src/game/sim/collision/circlePolygon';
import { createMatch } from '../../src/game/sim/createMatch';

const SEEDS = [0, 1, 20261007, 0xffffffff];
const OPEN_WATER_AROUND_THE_START_IN_HULL_RADII = 2;

interface Edge {
  readonly start: Point;
  readonly end: Point;
}

function edgesOf(part: ConvexPolygon): Edge[] {
  return part.map((start, index) => ({ start, end: part[(index + 1) % part.length] ?? start }));
}

function sideOf({ start, end }: Edge, point: Point): number {
  return (end.x - start.x) * (point.y - end.y) - (end.y - start.y) * (point.x - end.x);
}

function turnsOf(part: ConvexPolygon): number[] {
  return edgesOf(part).map((edge, index) =>
    sideOf(edge, part[(index + 2) % part.length] ?? edge.end),
  );
}

function sidesOfEveryVertex(part: ConvexPolygon): number[] {
  return edgesOf(part).flatMap((edge) => part.map((vertex) => sideOf(edge, vertex)));
}

function repeatedVertices(part: ConvexPolygon): Point[] {
  return part.filter(
    (vertex, index) =>
      part.findIndex((other) => other.x === vertex.x && other.y === vertex.y) !== index,
  );
}

function verticesOutside(arena: GameConfig['arena'], part: ConvexPolygon): Point[] {
  return part.filter(({ x, y }) => !(x >= 0 && x <= arena.width && y >= 0 && y <= arena.height));
}

describe('default layout (ADR-0007)', () => {
  test('CB-01 the default arena has at least one island', () => {
    const { islands } = DEFAULT_GAME_CONFIG.arena;

    expect(islands.length).toBeGreaterThanOrEqual(1);
    for (const seed of SEEDS) {
      const world = createMatch(DEFAULT_GAME_CONFIG, seed);

      expect(world.config.arena.islands).toStrictEqual(islands);
      expect(world.islands.parts.map(({ vertices }) => vertices)).toStrictEqual(islands);
    }
  });

  test('CB-01 every default island part is convex, wound clockwise, has no repeated vertex and lies inside the arena', () => {
    const { arena } = DEFAULT_GAME_CONFIG;

    expect(arena.islands.length).toBeGreaterThanOrEqual(1);
    for (const part of arena.islands) {
      expect(part.length).toBeGreaterThanOrEqual(3);
      expect(repeatedVertices(part)).toEqual([]);
      expect(Math.min(...turnsOf(part))).toBeGreaterThan(0);
      expect(Math.min(...sidesOfEveryVertex(part))).toBeGreaterThanOrEqual(0);
      expect(verticesOutside(arena, part)).toEqual([]);
    }
  });

  test('CB-01 the player of a match created from the defaults starts clear of every island', () => {
    const overlap: Overlap = { depth: 0, normalX: 0, normalY: 0 };

    for (const seed of SEEDS) {
      const { player, islands } = createMatch(DEFAULT_GAME_CONFIG, seed);
      const openWater = player.radius * OPEN_WATER_AROUND_THE_START_IN_HULL_RADII;

      expect(islands.parts.length).toBeGreaterThanOrEqual(1);
      for (const part of islands.parts) {
        expect(circlePolygonOverlap(part, player.x, player.y, player.radius, overlap)).toBe(false);
        expect(
          circlePolygonOverlap(part, player.x, player.y, player.radius + openWater, overlap),
        ).toBe(false);
      }
    }
  });
});
