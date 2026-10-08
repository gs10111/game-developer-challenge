import type { Overlap } from '../collision/circlePolygon';
import type { IslandIndex, IslandPart } from '../collision/islandIndex';
import { deepestIslandOverlap } from '../collision/islandOverlap';
import type { World } from '../world';

const NODE_MARGIN = 6;
const SIGHT_SLACK = 2;
const SHARPEST_CORNER = 0.01;
const NEVER = -1;

export interface Route {
  x: number;
  y: number;
  direct: boolean;
}

interface Navigation {
  readonly sightMargin: number;
  readonly xs: readonly number[];
  readonly ys: readonly number[];
  readonly between: readonly number[];
  readonly toPlayer: number[];
  refreshedAt: number;
}

const overlap: Overlap = { depth: 0, normalX: 0, normalY: 0 };
const navigations = new WeakMap<IslandIndex, Navigation>();

function crosses(
  part: IslandPart,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  margin: number,
): boolean {
  if (
    Math.max(startX, endX) <= part.minX - margin ||
    Math.min(startX, endX) >= part.maxX + margin ||
    Math.max(startY, endY) <= part.minY - margin ||
    Math.min(startY, endY) >= part.maxY + margin
  ) {
    return false;
  }
  const { vertices, normals } = part;
  const edges = vertices.length;
  let enter = 0;
  let exit = 1;
  for (let edge = 0; edge < edges; edge += 1) {
    const vertex = vertices[edge];
    const normal = normals[edge];
    if (vertex !== undefined && normal !== undefined) {
      const startSide = (startX - vertex.x) * normal.x + (startY - vertex.y) * normal.y - margin;
      const endSide = (endX - vertex.x) * normal.x + (endY - vertex.y) * normal.y - margin;
      if (startSide >= 0 && endSide >= 0) {
        return false;
      }
      if (startSide > 0) {
        enter = Math.max(enter, startSide / (startSide - endSide));
      } else if (endSide > 0) {
        exit = Math.min(exit, startSide / (startSide - endSide));
      }
    }
  }
  return enter < exit;
}

function blocked(
  islands: IslandIndex,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  margin: number,
): boolean {
  const parts = islands.parts;
  const count = parts.length;
  for (let index = 0; index < count; index += 1) {
    const part = parts[index];
    if (part !== undefined && crosses(part, startX, startY, endX, endY, margin)) {
      return true;
    }
  }
  return false;
}

function distance(fromX: number, fromY: number, toX: number, toY: number): number {
  const offsetX = toX - fromX;
  const offsetY = toY - fromY;
  return Math.sqrt(offsetX * offsetX + offsetY * offsetY);
}

function build(world: World): Navigation {
  const { arena, enemies } = world.config;
  const largest = Math.max(enemies.chaser.radius, enemies.shooter.radius);
  const smallest = Math.min(enemies.chaser.radius, enemies.shooter.radius);
  const sightMargin = Math.max(0, smallest - SIGHT_SLACK);
  const reach = largest + NODE_MARGIN;
  const xs: number[] = [];
  const ys: number[] = [];
  for (const part of world.islands.parts) {
    const corners = part.vertices.length;
    for (let corner = 0; corner < corners; corner += 1) {
      const vertex = part.vertices[corner];
      const before = part.normals[(corner + corners - 1) % corners];
      const after = part.normals[corner];
      if (vertex !== undefined && before !== undefined && after !== undefined) {
        const spread = 1 + before.x * after.x + before.y * after.y;
        if (spread > SHARPEST_CORNER) {
          const x = vertex.x + ((before.x + after.x) * reach) / spread;
          const y = vertex.y + ((before.y + after.y) * reach) / spread;
          if (
            x >= largest &&
            x <= arena.width - largest &&
            y >= largest &&
            y <= arena.height - largest &&
            !deepestIslandOverlap(world.islands, x, y, largest, overlap)
          ) {
            xs.push(x);
            ys.push(y);
          }
        }
      }
    }
  }
  const count = xs.length;
  const between = new Array<number>(count * count).fill(Infinity);
  for (let from = 0; from < count; from += 1) {
    between[from * count + from] = 0;
    for (let to = from + 1; to < count; to += 1) {
      const fromX = xs[from] ?? 0;
      const fromY = ys[from] ?? 0;
      const toX = xs[to] ?? 0;
      const toY = ys[to] ?? 0;
      if (!blocked(world.islands, fromX, fromY, toX, toY, sightMargin)) {
        const length = distance(fromX, fromY, toX, toY);
        between[from * count + to] = length;
        between[to * count + from] = length;
      }
    }
  }
  for (let via = 0; via < count; via += 1) {
    for (let from = 0; from < count; from += 1) {
      for (let to = 0; to < count; to += 1) {
        const through =
          (between[from * count + via] ?? Infinity) + (between[via * count + to] ?? Infinity);
        if (through < (between[from * count + to] ?? Infinity)) {
          between[from * count + to] = through;
        }
      }
    }
  }
  return {
    sightMargin,
    xs,
    ys,
    between,
    toPlayer: new Array<number>(count).fill(Infinity),
    refreshedAt: NEVER,
  };
}

function navigationOf(world: World): Navigation {
  let navigation = navigations.get(world.islands);
  if (navigation === undefined) {
    navigation = build(world);
    navigations.set(world.islands, navigation);
  }
  return navigation;
}

function refresh(navigation: Navigation, world: World): void {
  if (navigation.refreshedAt === world.step) {
    return;
  }
  navigation.refreshedAt = world.step;
  const { xs, ys, between, toPlayer, sightMargin } = navigation;
  const count = xs.length;
  const player = world.player;
  for (let node = 0; node < count; node += 1) {
    toPlayer[node] = Infinity;
  }
  for (let last = 0; last < count; last += 1) {
    const x = xs[last] ?? 0;
    const y = ys[last] ?? 0;
    if (!blocked(world.islands, x, y, player.x, player.y, sightMargin)) {
      const leg = distance(x, y, player.x, player.y);
      for (let node = 0; node < count; node += 1) {
        const cost = (between[node * count + last] ?? Infinity) + leg;
        if (cost < (toPlayer[node] ?? Infinity)) {
          toPlayer[node] = cost;
        }
      }
    }
  }
}

export function prepareNavigation(world: World): void {
  navigationOf(world);
}

export function routeToPlayer(world: World, x: number, y: number, out: Route): void {
  const navigation = navigationOf(world);
  const player = world.player;
  out.x = player.x;
  out.y = player.y;
  out.direct = !blocked(world.islands, x, y, player.x, player.y, navigation.sightMargin);
  if (out.direct) {
    return;
  }
  refresh(navigation, world);
  const { xs, ys, toPlayer, sightMargin } = navigation;
  const count = xs.length;
  let best = Infinity;
  for (let node = 0; node < count; node += 1) {
    const nodeX = xs[node] ?? 0;
    const nodeY = ys[node] ?? 0;
    const cost = distance(x, y, nodeX, nodeY) + (toPlayer[node] ?? Infinity);
    if (cost < best && !blocked(world.islands, x, y, nodeX, nodeY, sightMargin)) {
      best = cost;
      out.x = nodeX;
      out.y = nodeY;
    }
  }
}
