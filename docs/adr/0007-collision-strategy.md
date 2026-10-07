# ADR-0007: Circles, SAT for islands, layer filtering, measured broad phase

- **Status:** Accepted
- **Date:** 2026-10-07
- **Deciders:** Gabriel da Silveira
- **Requirements:** CB-01 to CB-08, PL-05, PL-06, EN-07

## Context

Ships must not cross islands or leave the arena; projectiles hit only the opposing side, apply damage once and are removed on impact. The entity count is small (tens of ships, at most a few hundred projectiles), and islands never move.

## Decision

- Shapes: ships and projectiles are circles; islands are convex polygons (concave outlines are split into convex parts).
- Narrow phase: circle-circle and circle-polygon SAT.
- Fast projectiles use a swept test: the segment from the previous to the current position against a circle of radius `targetRadius + projectileRadius`, so nothing tunnels through a target in one step.
- Collision layers (`player`, `enemy`, `playerShot`, `enemyShot`, `island`) with a pair matrix, so impossible pairs are never tested.
- Projectiles carry a `consumed` flag set on first hit, which guarantees single damage application (CB-05).
- Broad phase: islands are indexed once in a static uniform grid; dynamic pairs use filtered brute force, chosen with the average-case model from ADR-0015:
  - player shots × enemies: 40 × 20 = 800 circle tests per step;
  - enemy shots × player: 20 × 1 = 20 circle tests per step;
  - ships against nearby island parts through the grid: about 21 ships × 2 parts = 42 SAT tests per step;
  - total: about 860 cheap tests per step, estimated in the low microseconds, far below 1% of the 16.7 ms frame budget. No spatial hash.

## Options considered

| Option | Assessment |
| --- | --- |
| Quadtree | Pays off with many objects of very different sizes; overhead dominates at our counts. |
| Spatial hash from day one | Simple and effective for dense, similarly sized objects, but the average case (ADR-0015) does not need it. |
| **Filtered brute force + static island grid** | Cheapest correct solution for the average case, with the cost written down instead of assumed. |

## Consequences

- Easier: collision code stays small and fully unit-testable.
- Harder: concave island outlines need a one-time convex decomposition.
- As built, for ships against islands: the response pushes the ship out of the deepest overlap first, for up to three rounds per step, so that the buried corner where two parts meet flush cannot push it back along the shore. The arena clamp runs next. A ship that still overlaps an island by more than 1e-9 after both returns to where it was before the step, which settles notches narrower than the hull. The grid lists a part in every cell from the one holding its lowest corner to the one holding its highest.
- As built, for projectiles against islands and walls: a projectile is tested where it ends each step, with no tolerance, and is removed when its circle overlaps an island part or its centre crosses a wall. There is no swept test against islands: a projectile moves a few units per step, far less than any island part.
- Revisit: only if the configured or measured load exceeds the average case by an order of magnitude (ADR-0015).

## Sources

- [GameDev.net: QuadTree for 2D collision detection](https://gamedev.net/forums/topic/590388-quadtree-for-2d-collision-detection/) — brute-force AABB and SAT are enough even for shoot 'em ups, and a quadtree was overkill with few actors (forum).
- [GameDev.net: Quad trees vs R-trees vs spatial hashmaps](https://www.gamedev.net/forums/topic/661021-quad-trees-vs-r-trees-vs-spacial-hashmaps/) — with around ten ships and a hundred characters, no spatial tree is needed (forum).
- [GameDev Stack Exchange question 69776](https://backiee.wasmer.app/https_gamedev_stackexchange_com/q/69776) — flat grids suit dense, similarly sized objects; quadtrees handle varied sizes better (mirror of the Q&A).
- [GameDev Stack Exchange answer 32333](https://backiee.wasmer.app/https_gamedev_stackexchange_com/a/32333) — brute force with 300 to 400 entities ran smoothly (mirror of the Q&A).
