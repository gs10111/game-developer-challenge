# Plan 0003: islands in the simulation

Approved plan of the slice, revised after a plan review. The implementer, the test-auditor and the reviewer work from this file.

## Slice

```
Slice: Islands in the simulation: convex island parts in the typed config, a static grid built when the match is created, the overlap of a circle with a convex polygon and its push-out vector, and a collision stage that keeps every ship out of the islands and inside the arena.
Requirements: PL-06, CB-01 (simulation part), CB-02 (ships only; projectiles come with the weapons slice). Partial: PL-05, SC-10, SC-12, MT-05, PW-03.
ADRs: 0007, 0006, 0005, 0015, 0001.
Out of scope: rendering and the tile map; projectiles against islands; enemy steering around islands (EN-07); spawn points (EN-10); collision layers and the pair matrix (first needed by projectiles); swept tests; a config schema.
Path: large.
```

## Design

Each choice stays inside an accepted ADR:

- Arithmetic (ADR-0005): simulation sources keep to the exactly specified operations: `+`, `-`, `*`, `/`, `%`, bit operations, and `Math.sqrt`, `Math.floor`, `Math.ceil`, `Math.round`, `Math.min`, `Math.max`, `Math.abs`. Lint rejects the engine-approximated `Math` functions and `**`.
- Config (SC-10, CB-01): `GameConfig.arena` gains `islands: readonly ConvexPolygon[]`, with `ConvexPolygon = readonly Point[]` and `Point = { readonly x: number; readonly y: number }`. Each entry is one convex part; a concave island is written as several parts (ADR-0007). A part has at least three vertices, no repeated vertex, and is wound clockwise as seen on screen with y growing downward: for consecutive vertices a, b, c, `(b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) > 0`. The outward normal of the edge from a to b is `(b.y - a.y, a.x - b.x)` normalised.
- Defaults during the slice: from subtask 1 until subtask 5, `DEFAULT_GAME_CONFIG` keeps the 960 by 540 arena and holds `islands: []`. Subtask 5 replaces both.
- Default layout (subtask 5), provisional until the arena is drawn: the arena becomes 1024 by 576 (16 by 9 tiles of 64), with five rectangular parts aligned to the tile grid, given as left, top, right, bottom: (128, 0, 384, 128) and (256, 128, 384, 256), which form one L-shaped island touching the top wall; (640, 384, 896, 576), touching the bottom wall; (704, 64, 832, 192); and (128, 384, 256, 512). The arena centre, where the player starts, is clear of all of them.
- Config snapshot (SC-12): `frozenCopy` in `createMatch.ts` copies an array as a frozen array, so the islands survive the snapshot as arrays. This closes a follow-up of plan 0002.
- Island index (ADR-0007): `createIslandIndex(arena)` builds, once per match, an `IslandIndex = { parts, columns, rows, cells }` of plain numbers and arrays, so that two worlds still compare with `toStrictEqual`.
  - Each part holds its vertices, the unit outward normal of each edge and its bounding box.
  - The grid covers the arena with square cells of `ISLAND_GRID_CELL = 128` units (exported from `limits.ts`): `Math.ceil(width / cell)` columns and `Math.ceil(height / cell)` rows. `cells[row * columns + column]` lists, in ascending order, the indices of the parts whose bounding box overlaps that cell; touching counts.
  - Cell coordinates are clamped to the grid both when a part is registered and when a box is queried, so a part touching the right or bottom wall and a box outside the arena both land in the edge cells.
  - `cellRange(index, minX, minY, maxX, maxY, out)` writes `firstColumn`, `lastColumn`, `firstRow` and `lastRow` into a caller-owned `CellRange`. Callers loop rows, then columns, then the cell's list. No callback and no array is created per query. A part that appears in several cells is visited several times.
  - `createMatch` does not validate polygons: the default layout is covered by a test, and the options screen never edits islands.
- Overlap (ADR-0007): `circlePolygonOverlap(part, x, y, radius, out)` returns whether the circle overlaps the part and, when it does, writes into the caller-owned `Overlap` the `depth` (greater than zero) and the unit vector `normalX`, `normalY` along which the circle must move by `depth` to end tangent. The rule, written to stay robust in floating point:
  1. Find the edge with the greatest signed distance `s` from the centre (the first one wins a tie).
  2. When `s` is at least the radius, there is no overlap.
  3. When `s` is zero or less (the centre is inside or on the boundary), or the projection of the centre on that edge falls strictly inside its segment: the vector is that edge's normal and the depth is `radius - s`. No square root and no division here.
  4. Otherwise the projection clamps to one end of the segment. Take that stored vertex and the distance from it to the centre. No overlap when the distance is at least the radius. When the distance is zero, fall back to the edge's normal with depth equal to the radius. Otherwise the vector is the centre minus the vertex, divided by the distance, and the depth is the radius minus the distance.
  A circle that only touches does not overlap.
- Scratch objects: the `Overlap` and the `CellRange` that the systems pass in are module-level constants of each system file. Each is fully written before it is read, so nothing carries over from one ship or one world to the next. They are not world fields.
- Ship (ADR-0006): gains `previousX` and `previousY`. Movement writes them, for every active ship, before it changes the position. Whoever places a ship sets them equal to its position: `createMatch` does it for the player. `createShip` and `resetShip` are folded into one source of truth (one fresh-ship constant copied in place with `Object.assign`, which allocates nothing), so a new field cannot be reset in one place and forgotten in the other. This closes another follow-up of plan 0002.
- World: gains `islands`, the index above, built per match from the snapshot and never shared between matches.
- Collision stage (ADR-0006, ADR-0007): three systems in this order, each over the active ships in slot order.
  1. `islandCollision`: up to `ISLAND_PUSH_ROUNDS = 3` rounds per ship (exported from `limits.ts`). In each round, among the candidate parts for the ship's current bounding box, visited by ascending cell row, then column, then position in the cell's list, find the one with the greatest overlap depth; the first found wins a tie. When none overlaps, the ship is done. Otherwise move the ship by that depth along its vector and start the next round. Resolving the deepest overlap first matters where two parts meet flush: the buried corner of the neighbouring part would otherwise push the ship back along the shore.
  2. `arenaBounds`: unchanged.
  3. `blockedShips`: when the ship still overlaps any candidate part by more than `CONTACT_TOLERANCE = 1e-9` (exported from `limits.ts`), its position returns to `previousX`, `previousY`. This covers what the rounds cannot settle, such as a notch narrower than the ship or an acute corner between an island and the wall. The heading is not restored, so the ship can still turn away.
  The step order becomes: player intent, movement, island collision, arena bounds, blocked ships.
- What the stage guarantees, and when: a ship that starts a step clear of every island and inside the arena ends it the same way. It holds by induction, under two preconditions that this slice does not enforce:
  - ships are placed clear of the islands. The default layout test covers the player; the spawner will have to check its points (EN-10); a ship placed deep inside an island may stay frozen there.
  - nothing activates a ship between movement and `blockedShips`, and whoever places a ship sets `previousX`, `previousY`; otherwise the fallback would send it to the reset position.
- Sliding: a ship driven into a shore at an angle keeps the component of its movement that runs along the shore, including across the seam between two flush parts, in both directions.
- No swept test for ships: a ship moves at most a few units per step (140 units per second is 2.33 per step), far less than its radius or any island part, so it cannot pass through one. Nothing bounds the configured speed yet.
- Layer direction: unchanged. `src/game/config` imports nothing, and no file in that folder imports the simulation. The test of the default layout lives in `tests/config/`, where it may import both the defaults and the simulation. Tests under `src/game/sim` still build their configs inline, now with an `islands` array, and never value-import the defaults.

Cost estimate against the ADR-0015 profile (21 ships, about 10 convex parts): per ship, a bounding box covers at most four cells, about two candidate parts, each visited about twice; one overlap test is about 60 operations. Up to three rounds plus the check of `blockedShips`: 21 × 4 × 4 × 60, about 20,000 operations per step in the worst case and a quarter of that for a ship in open water, between 5 and 20 microseconds, around 0.1% of the 16.7 ms frame. The grid is built once per match. No further optimisation.

```
SUBTASK 1: Islands in the config and in the snapshot
  requirements: SC-10 (partial), SC-12 (partial)
  files: src/game/config/gameConfig.ts, src/game/sim/createMatch.ts, src/game/sim/createMatch.test.ts; and, only to add `islands: []` to their inline configs: src/game/sim/step.test.ts, src/game/sim/systems/movement.test.ts, src/game/sim/systems/collision/arenaBounds.test.ts, src/game/loop/fixedStepClock.test.ts
  depends on: none
  tests:
    - createMatch.test.ts: "SC-12 the islands of a running match are frozen arrays that keep their vertices when the source changes afterwards"
    - createMatch.test.ts: "SC-10 a match carries the island parts of the config it was created with"
  The existing tests of plan 0002 must still pass after `islands` becomes a required field.

SUBTASK 2: Geometry and the island index
  requirements: CB-02 (ships, geometric part), PW-03 (partial)
  files: src/game/sim/limits.ts, src/game/sim/collision/circlePolygon.ts, src/game/sim/collision/circlePolygon.test.ts, src/game/sim/collision/islandIndex.ts, src/game/sim/collision/islandIndex.test.ts
  depends on: 1 (ConvexPolygon and Point types)
  tests:
    - circlePolygon.test.ts: "CB-02 a circle overlapping an edge is pushed out along that edge's normal by the overlap"
    - circlePolygon.test.ts: "CB-02 a circle overlapping a corner is pushed out along the line from the vertex to its centre"
    - circlePolygon.test.ts: "CB-02 a circle whose centre is inside the part is pushed out through the nearest edge"
    - circlePolygon.test.ts: "CB-02 a circle that only touches a part, or is apart from it, does not overlap"
    - circlePolygon.test.ts: "CB-02 a centre exactly on an edge, exactly on a vertex or a hair outside an edge still gets a finite unit vector" (a slanted edge of a triangle, each vertex, and a centre 1e-12 outside an edge)
    - circlePolygon.test.ts: "CB-02 after the push the circle is tangent to the part, for circles all around a triangle and a rectangle" (a sweep of centres that includes the cases of the previous test; the overlap of the moved circle is at most 1e-9 and it is not apart by more than 1e-9)
    - islandIndex.test.ts: "CB-02 the index keeps the vertices, unit outward normals and bounding box of each part"
    - islandIndex.test.ts: "CB-02 the grid misses no part whose bounding box overlaps the query box" (a sweep of boxes, including boxes outside the arena, against a brute-force scan)
    - islandIndex.test.ts: "CB-02 the grid visits the cells of a query by row, then column, with each cell's parts in ascending order" (the visited sequence equals a cell-by-cell brute force)
    - islandIndex.test.ts: "CB-02 a part touching the right or bottom wall is registered in the edge cells"
    - islandIndex.test.ts: "PW-03 two indexes built from the same islands are equal"

SUBTASK 3: Previous position and the island index in the world
  requirements: PL-06 (partial), MT-05 (partial)
  files: src/game/sim/world.ts, src/game/sim/createMatch.ts, src/game/sim/createMatch.test.ts, src/game/sim/systems/movement.ts, src/game/sim/systems/movement.test.ts
  depends on: 1, 2
  tests:
    - movement.test.ts: "PL-06 movement records where each active ship was before it moved"
    - createMatch.test.ts: "MT-05 each match builds its own island index, and the player's previous position starts at its position"
  The existing "MT-05 a released pool slot is indistinguishable from a fresh one" must still pass with the new ship fields and the folded reset.

SUBTASK 4: Collision stage with islands
  requirements: PL-06, CB-02 (ships), PL-05 (partial), SC-10 (partial), PW-03 (partial)
  files: src/game/sim/step.ts, src/game/sim/step.test.ts, src/game/sim/systems/collision/islandCollision.ts, src/game/sim/systems/collision/blockedShips.ts, src/game/sim/systems/collision/islandCollision.test.ts
  depends on: 3
  tests, all driven through `step`, with islands given in inline configs:
    - islandCollision.test.ts: "PL-06 the player driven straight into a shore stops with its hull touching it"
    - islandCollision.test.ts: "PL-06 the player driven into a shore at an angle slides along it and never enters the island"
    - islandCollision.test.ts: "PL-06 the player rounds the corner of an island without entering it"
    - islandCollision.test.ts: "PL-06 the player never overlaps an island during a long scripted drive among several parts" (the overlap with every part is checked after every step and stays at or below 1e-9)
    - islandCollision.test.ts: "PL-06 the player slides across the seam between two flush parts in both directions, at a steep and at a shallow angle, at the along-shore speed of its movement" (per step, the displacement along the shore equals the along-shore component of the movement)
    - islandCollision.test.ts: "PL-06 a ship wedged in a corner narrower than its hull goes back to where it was and can still turn"
    - islandCollision.test.ts: "PL-05 a ship pushed by an island that touches the wall stays inside the arena and out of the island"
    - islandCollision.test.ts: "CB-02 every active ship is blocked by the islands, and an inactive slot is left where it is"
    - islandCollision.test.ts: "SC-10 moving an island in the config moves where the player stops"
    - step.test.ts: "PW-03 replaying the same seed and command log reproduces the whole world" (the existing replay test gains islands and contact with them, and keeps its name)

SUBTASK 5: Default layout and arena size
  requirements: CB-01 (simulation part)
  files: src/game/config/gameConfig.ts, tests/config/default-layout.test.ts
  depends on: 1, 2, 3
  tests:
    - "CB-01 the default arena has at least one island"
    - "CB-01 every default island part is convex, wound clockwise, has no repeated vertex and lies inside the arena" (convex means every vertex is on or behind every edge, not only that consecutive turns have the same sign)
    - "CB-01 the player of a match created from the defaults starts clear of every island" (the start is read from `createMatch(DEFAULT_GAME_CONFIG, seed)`)

ORDER: 1 → 2 → 3 → 4 → 5, sequential.
VERIFICATION: lint, typecheck and unit tests. No E2E in this slice.
AFTER THE SLICE (maestro): PL-06, CB-01 and CB-02 move to "In progress" in docs/requirements.md, with "U" added to their Test column; ADR-0007 gains an as-built line for the collision response (deepest-first push-out, clamp, previous-position fallback, tolerance); ARCHITECTURE.md gains the islands and the collision stage; the two follow-ups of plan 0002 are closed.
CARRIED TO LATER SLICES: the config schema validates island parts (three or more vertices, clockwise, convex, inside the arena), a start clear of the islands, and a distance per step below the hull radius; the spawner sets `previousX`, `previousY` when it places a ship and checks its points against the islands.
```
