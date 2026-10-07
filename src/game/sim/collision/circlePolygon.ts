import type { IslandPart } from './islandIndex';

export interface Overlap {
  depth: number;
  normalX: number;
  normalY: number;
}

export function circlePolygonOverlap(
  part: IslandPart,
  x: number,
  y: number,
  radius: number,
  out: Overlap,
): boolean {
  const { vertices, normals } = part;
  const count = vertices.length;
  let nearest = -1;
  let separation = -Infinity;
  for (let edge = 0; edge < count; edge += 1) {
    const vertex = vertices[edge];
    const outward = normals[edge];
    if (vertex !== undefined && outward !== undefined) {
      const distance = (x - vertex.x) * outward.x + (y - vertex.y) * outward.y;
      if (distance > separation) {
        separation = distance;
        nearest = edge;
      }
    }
  }
  const start = vertices[nearest];
  const end = vertices[(nearest + 1) % count];
  const normal = normals[nearest];
  if (start === undefined || end === undefined || normal === undefined || separation >= radius) {
    return false;
  }
  const edgeX = end.x - start.x;
  const edgeY = end.y - start.y;
  const along = (x - start.x) * edgeX + (y - start.y) * edgeY;
  if (separation <= 0 || (along > 0 && along < edgeX * edgeX + edgeY * edgeY)) {
    out.depth = radius - separation;
    out.normalX = normal.x;
    out.normalY = normal.y;
    return true;
  }
  const corner = along > 0 ? end : start;
  const offsetX = x - corner.x;
  const offsetY = y - corner.y;
  const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
  if (distance >= radius) {
    return false;
  }
  if (distance === 0) {
    out.depth = radius;
    out.normalX = normal.x;
    out.normalY = normal.y;
    return true;
  }
  out.depth = radius - distance;
  out.normalX = offsetX / distance;
  out.normalY = offsetY / distance;
  return true;
}
