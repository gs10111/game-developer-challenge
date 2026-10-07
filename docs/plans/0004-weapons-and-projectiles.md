# Plan 0004: weapons and projectiles in the simulation

Approved plan of the slice, revised after a plan review. The implementer, the test-auditor and the reviewer work from this file.

## Slice

```
Slice: Weapons and projectiles in the simulation: the front cannon and the two broadsides with their cooldowns, projectiles that travel, expire, leave the arena or stop at an island, and the per-step event queue with the shot event.
Requirements: PL-02, PL-03, PL-09, CB-03, CB-07, CB-06 (expiry, arena and islands; hits come with the damage slice), CB-02 (projectiles). Partial: SC-10, MT-05, PW-03, FX-01 (the event only).
ADRs: 0006, 0007, 0005, 0015, 0001.
Out of scope: targets, hits, damage and health (CB-04, CB-05, CB-08); enemies and their weapons; collision layers and the pair matrix; the swept test against targets; rendering, sound and input; the match clock and pause.
Path: large.
```

## Design

Each choice stays inside an accepted ADR:

- Config (SC-10): `GameConfig.player` gains `weapons: { front: Weapon; broadside: Weapon & { spacing: number } }`, with `Weapon = { cooldownSeconds, projectileSpeed, projectileRadius, projectileLifetimeSeconds, damage }`, all `readonly`. The challenge asks for "range or lifetime" in one place and lists both as parameters in another: the config holds the lifetime, and the range is derived exactly as speed times lifetime. Defaults, provisional until balancing: front cannon cooldown 0.5 s, speed 420, radius 5, lifetime 1 s, damage 20; broadside cooldown 1.5 s, speed 360, radius 5, lifetime 0.8 s, damage 15, spacing 14.
- Three projectiles per broadside is the challenge's own rule, not a balancing value: it is a named constant of the weapons system and not a config entry.
- Seconds to steps: a cooldown or a lifetime in seconds becomes `Math.max(1, Math.round(seconds * STEPS_PER_SECOND))` steps. Cooldowns and lifetimes are counted in whole steps and never in accumulated time.
- Test fixture: `src/game/sim/testing/testWeapons.ts` exports `testWeapons()`, which returns a fresh mutable weapons object with these values: front cannon cooldown 0.5 s (30 steps), speed 300, radius 4, lifetime 2 s (120 steps, range 600), damage 20; broadside cooldown 1 s (60 steps), speed 240, radius 3, lifetime 1.5 s (90 steps, range 360), damage 12, spacing 16. Every local config builder in the existing tests adds `weapons: testWeapons()` to its player. Tests under `src/game/sim` still never value-import the defaults.
- Ship (ADR-0006): gains the fire intent of the step, `fireFront`, `fireLeft`, `fireRight`, each 0 or 1; the cooldowns `frontCooldown`, `leftCooldown`, `rightCooldown`, in steps; and `weapons`, a reference to the frozen weapons of the config snapshot or `null`. A fresh ship has intents and cooldowns at zero and `weapons: null`. `createMatch` gives the player the `player.weapons` of the world's own snapshot. The weapons and projectiles systems read weapons from the ship and never from the player's config. Ships and projectiles carry no side yet; the damage slice adds it and will touch the weapons system to stamp it.
- Player intent: besides thrust and turn, the mask sets the three fire intents of the player from `FireFront`, `FireLeft` and `FireRight`, each step, so an intent lasts only while its command is held. The command bits keep their values.
- Projectile (ADR-0006): `{ active, x, y, previousX, previousY, directionX, directionY, speed, radius, damage, remainingSteps }`, in a pool `world.projectiles` of `PROJECTILE_POOL_CAPACITY = 256` slots (exported from `limits.ts`; the ADR-0015 average is 60 live projectiles), with one fresh-projectile constant as the source of its reset, like the ship.
- Events (ADR-0006): `world.events = { count, items }`, where `items` is a fixed array of `EVENT_QUEUE_CAPACITY = 128` pre-allocated event objects (exported from `limits.ts`) and `count` says how many are valid in this step. `step` sets `count` to zero before the first system. `pushEvent` fills the next object in place and returns it, or returns `null` and drops the event when the queue is full. Events are for the renderer and the sound; the simulation never reads them back. This slice has one kind, `shotFired`, with the weapon (`front`, `left` or `right`), the muzzle position and the direction of the shot. Kinds are a `const` object of strings. Objects beyond `count` keep old data, which is the same for the same seed and command log.
- Weapons system: for each active ship with weapons, in slot order, and for the front cannon, the left broadside and the right broadside in that order:
  1. when the cooldown is above zero, it drops by one;
  2. then, when the cooldown is zero and the intent is set, the weapon fires and its cooldown becomes its cooldown in steps, C.
  So a weapon is ready when the match starts; with the command held, a shot at step s is followed by the next at step s + C exactly, and with C = 1 the weapon fires every step; each of the three weapons counts on its own. The two broadsides share the broadside's parameters and keep separate cooldowns.
- Firing geometry, with `h` the ship's heading after this step's movement, `(ax, ay) = (cosine(h), sine(h))` the direction it faces, and `muzzle = ship.radius + projectileRadius`:
  - Front cannon: one projectile at `ship + (ax, ay) * muzzle`, direction `(ax, ay)`.
  - Left broadside: side direction `(sx, sy) = (ay, 0 - ax)`; right broadside: `(0 - ay, ax)`. These are exactly perpendicular to the heading and need no second table read; `0 - value` keeps a zero positive. With y growing downward and heading 0 pointing to +x, the left side of a ship heading +x is -y. Three projectiles at `ship + (sx, sy) * muzzle + (ax, ay) * k * spacing` for `k` = -1, 0, 1 in that order, all with direction `(sx, sy)`.
  - Each projectile takes its speed, radius and damage from the weapon and `remainingSteps` from the weapon's lifetime; `previousX`, `previousY` equal its position. One `shotFired` event per shot, at `ship + direction * muzzle`.
  - When the projectile pool has no free slot, that projectile is not created. The cooldown starts whenever the weapon fires, even if no projectile could be created; the event is pushed when at least one projectile was created.
  - The ship's own movement adds nothing to the projectile's velocity.
- Projectiles system, for each active projectile in slot order: when `remainingSteps` is already zero, release it without moving. Otherwise record the previous position, move by `direction * speed * dt` and take one from `remainingSteps`. The contract, for a projectile with a lifetime of N steps fired at step s: it moves in the step it is fired, because weapons run before projectiles; after step s + N - 1 it is still active, N steps of travel from the muzzle, and the collision stage has seen it there; step s + N removes it without moving. Its range is therefore exactly N steps of travel.
- Projectile obstacles, in the collision stage after the three ship systems, for each active projectile in slot order: release it when its centre is outside the arena, `x < 0 || x > width || y < 0 || y > height`, so a centre exactly on a wall stays; or when its circle overlaps an island part. A circle that only touches a part does not overlap.
- No swept test against islands: at 420 units per second a projectile moves 7 units per step, far less than any island part, so sampling the end position cannot skip a part; it can miss a corner tip by a few units, which is accepted. Nothing bounds the configured speed yet; a test of the defaults checks it for the default weapons.
- Shared island overlap (follow-up of plan 0003): `deepestIslandOverlap(islands, x, y, radius, out)` in `src/game/sim/collision/islandOverlap.ts` scans the grid cells under the circle's bounding box, by row, then column, then position in the cell's list, and writes the deepest overlap into the caller-owned `out` (the first found wins a tie); it returns whether any part overlaps, and leaves `out` untouched when none does. `islandCollision`, `blockedShips` and the projectile obstacles all use it, and the two existing systems lose their own copy of the loop. It keeps one module-level `CellRange` and allocates nothing.
- Step order (ADR-0006): the event queue is emptied, then player intent, movement, weapons, projectiles, and the collision stage: island collision, arena bounds, blocked ships, projectile obstacles. Weapons fire from where the ship is after movement and before the collision stage moves it out of an island, so a shot fired while pressed against a shore can start inside it and is then removed in the same step, with its cooldown started and its event pushed.
- Arithmetic (ADR-0005): as in plan 0003, only exactly specified operations. Directions come from the sine table through `sine` and `cosine`.
- World: gains `projectiles` and `events`. Two worlds still compare with `toStrictEqual`: both are plain objects, arrays, numbers, strings and `null`.

Cost estimate against the ADR-0015 profile (21 ships, 60 projectiles, about 10 island parts): weapons, 21 ships by 3 weapons by about 5 operations, about 300; projectile movement, 60 by 6, about 400; projectile obstacles, 60 scans of up to 8 overlap tests of about 60 operations, about 30,000 in the worst case and far less in open water. With the ships' collision of plan 0003 (about 40,000 in the worst case), the step stays under 100,000 simple operations, a few tens of microseconds, under 0.5% of the 16.7 ms frame. No optimisation.

```
SUBTASK 1: Weapons in the config, the test fixture, the ship's weapon state and the fire intents
  requirements: SC-10 (partial), MT-05 (partial), PL-09 (partial)
  files: src/game/config/gameConfig.ts, tests/config/default-weapons.test.ts, src/game/sim/testing/testWeapons.ts, src/game/sim/world.ts, src/game/sim/createMatch.ts, src/game/sim/createMatch.test.ts, src/game/sim/pool.test.ts, src/game/sim/systems/playerIntent.ts, src/game/sim/systems/playerIntent.test.ts; and, only to add `weapons: testWeapons()` to their config builders: src/game/sim/step.test.ts, src/game/sim/systems/movement.test.ts, src/game/sim/systems/collision/arenaBounds.test.ts, src/game/sim/systems/collision/islandCollision.test.ts, src/game/loop/fixedStepClock.test.ts
  depends on: none
  two existing tests need more than the builder line, and both edits belong here:
    - src/game/sim/pool.test.ts: the helper that overwrites every ship field handles only numbers and booleans; it must also give `weapons` a non-null object, so that the test proves a release sets it back to `null`.
    - src/game/sim/createMatch.test.ts: the count of objects reachable from the config snapshot grows by the weapons objects.
  tests:
    - createMatch.test.ts: "SC-10 the player's weapons are the ones of the config the match was created with" (`world.player.weapons` is the very object `world.config.player.weapons`, and it is frozen)
    - createMatch.test.ts: "MT-05 the player of a fresh match has its weapons ready and no fire intent"
    - tests/config/default-weapons.test.ts: "SC-10 the default weapons have positive values, and their projectiles move less than a tile per step"
    - playerIntent.test.ts, through `step`: "PL-09 the fire commands set the player's fire intents and leave its thrust and turn as the other commands set them"
    - playerIntent.test.ts, through `step`: "PL-09 a fire intent lasts only while its command is held"
  The existing tests must still pass, including "MT-05 a released pool slot is indistinguishable from a fresh one".

SUBTASK 2: Projectile pool and event queue
  requirements: MT-05 (partial), FX-01 (partial)
  files: src/game/sim/limits.ts, src/game/sim/world.ts, src/game/sim/events.ts, src/game/sim/events.test.ts, src/game/sim/createMatch.ts, src/game/sim/createMatch.test.ts, src/game/sim/pool.test.ts, src/game/sim/step.ts, src/game/sim/step.test.ts
  depends on: 1
  tests:
    - createMatch.test.ts: "MT-05 a fresh match has no active projectile and no event"
    - pool.test.ts: "MT-05 a released projectile slot is indistinguishable from a fresh one"
    - events.test.ts: "FX-01 the event queue keeps events in order up to its capacity and drops the rest"
    - step.test.ts: "FX-01 the events of a step are gone when the next step starts" (events pushed by hand before the step)

SUBTASK 3: Shared island overlap, and projectiles that travel, expire and stop at obstacles
  requirements: CB-02 (projectiles), CB-03 (partial), CB-06 (expiry, arena, islands)
  files: src/game/sim/collision/islandOverlap.ts, src/game/sim/collision/islandOverlap.test.ts, src/game/sim/systems/collision/islandCollision.ts, src/game/sim/systems/collision/blockedShips.ts, src/game/sim/systems/projectiles.ts, src/game/sim/systems/projectiles.test.ts, src/game/sim/systems/collision/projectileObstacles.ts, src/game/sim/systems/collision/projectileObstacles.test.ts, src/game/sim/step.ts
  depends on: 2
  do the shared overlap first: the existing tests of islandCollision.test.ts and step.test.ts are its regression net and must pass unchanged.
  tests, those of the two systems through `step` with projectiles acquired from the pool and given their fields by hand:
    - islandOverlap.test.ts: "CB-02 the deepest overlap of a circle with the islands is the greatest among the parts under it, and the first found wins a tie"
    - islandOverlap.test.ts: "CB-02 a circle clear of every part reports no overlap and leaves the result untouched"
    - projectiles.test.ts: "CB-03 a projectile travels along its direction at its speed"
    - projectiles.test.ts: "CB-03 a projectile records where it was before it moved"
    - projectiles.test.ts: "CB-06 a projectile with N steps left is active after N - 1 and after N steps, having moved N times, and is removed by step N + 1 without moving"
    - projectiles.test.ts: "CB-06 an inactive projectile slot is left where it is"
    - projectileObstacles.test.ts: "CB-06 a projectile is removed when its centre passes a wall, at each of the four walls, and stays while its centre is inside or exactly on it"
    - projectileObstacles.test.ts: "CB-02 a projectile is removed when it overlaps an island, and passes one that it only touches or misses"
    - projectileObstacles.test.ts: "CB-06 the slot of a removed projectile is free for the next one"

SUBTASK 4: Weapons: firing geometry, projectile parameters and the shot event
  requirements: PL-02, PL-03, PL-09, CB-03, SC-10 (partial), FX-01 (partial)
  files: src/game/sim/systems/weapons.ts, src/game/sim/systems/weapons.test.ts, src/game/sim/step.ts
  depends on: 1, 3
  tests, all through `step` with the command mask, in open sea unless stated; positions are checked after the step, so they are the muzzle plus one step of travel:
    - weapons.test.ts: "PL-02 the front cannon fires one projectile from the bow along the heading" (headings in all four quadrants)
    - weapons.test.ts: "PL-03 a broadside fires three parallel projectiles from the chosen side, perpendicular to the heading" (positions, spacing and direction for the left and for the right, at several headings; left of a ship heading +x is -y)
    - weapons.test.ts: "PL-03 the left and the right broadside are separate commands and can fire in the same step"
    - weapons.test.ts: "PL-09 the player moves, turns and fires in the same step, and the shot leaves from where the ship is after moving"
    - weapons.test.ts: "CB-03 a projectile takes its speed, radius, damage and lifetime from the weapon that fired it"
    - weapons.test.ts: "SC-10 the projectile speed, the lifetime and the broadside spacing follow the config"
    - weapons.test.ts: "FX-01 each shot pushes one event with its weapon, muzzle position and direction"
    - weapons.test.ts: "CB-06 a shot whose muzzle is inside an island or beyond a wall is removed in the same step, with its event pushed" (this pins weapons before the collision stage)

SUBTASK 5: Weapons: cooldowns, a full pool, ships without weapons, and the replay
  requirements: CB-07, SC-10 (partial), PW-03 (partial)
  files: src/game/sim/systems/weapons.ts, src/game/sim/systems/weapons.test.ts, src/game/sim/step.test.ts
  depends on: 4
  tests, all through `step` with the command mask:
    - weapons.test.ts: "CB-07 a held fire command shoots on the first step and then exactly every cooldown, with no shot between" (the step index of every shot is asserted, for the fixture's cooldowns)
    - weapons.test.ts: "CB-07 a cooldown that is not a whole number of steps rounds to the nearest step, and one below a step fires every step"
    - weapons.test.ts: "CB-07 a weapon is ready when the match starts, and a command released during the cooldown fires nothing"
    - weapons.test.ts: "CB-07 the front cannon and each broadside keep their own cooldown"
    - weapons.test.ts: "SC-10 the cooldown follows the config"
    - weapons.test.ts: "CB-06 a lifetime that is not a whole number of steps rounds to the nearest step" (the step in which the projectile is removed is asserted)
    - weapons.test.ts: "CB-07 with the projectile pool full a shot creates nothing, starts its cooldown and pushes no event, and a broadside with one or two free slots creates only those and pushes its event"
    - weapons.test.ts: "CB-07 a ship without weapons fires nothing"
    - step.test.ts: "PW-03 replaying the same seed and command log reproduces the whole world" (the existing replay test gains shots from the three weapons, some reaching an island and a wall, and keeps its name)

ORDER: 1 → 2 → 3 → 4 → 5, sequential.
VERIFICATION: lint, typecheck and unit tests. No E2E in this slice.
AFTER THE SLICE (maestro): PL-02, PL-03, PL-09, CB-03, CB-06, CB-07 move to "In progress" in docs/requirements.md with "U" in their Test column; ARCHITECTURE.md gains weapons, projectiles and events; as-built lines go to ADR-0005 (whole-step cooldowns and lifetimes with their rounding, the firing order and a projectile moving in the step it is fired are part of the replay format), ADR-0007 (projectiles sample their end position against islands and leave the arena by their centre) and ADR-0006 (queue capacity, emptied at the start of the step, overflow dropped); the shared-loop follow-up of plan 0003 is closed.
CARRIED TO LATER SLICES: the damage slice adds targets, sides, the swept test and the collision layers, and the `hit` event; the config schema bounds the projectile speed per step and requires positive weapon values; the loop driver must hand `world.events` to the renderer and the sound after every step, not once per frame, or shots are lost at low frame rates and repeated at high ones.
```
