# Plan 0006: targets, damage and score in the simulation

Approved plan of the slice, revised after a plan review. It builds on the state added by plan 0005. The implementer, the test-auditor and the reviewer work from this file.

## Slice

```
Slice: Targets, damage and score in the simulation: the swept test of a projectile against ships, single damage per projectile, health, the destruction of enemies and the point each one is worth.
Requirements: CB-04, CB-05, CB-06 (removal on hit), EN-06, MT-02. Partial: PL-04 (projectiles; the Chaser's impact comes with the enemies slice), CB-08 (firing and collisions; contact damage comes with the Chaser), PW-03, FX-02 and FX-04 (the events only).
ADRs: 0007, 0006, 0005, 0015, 0001.
Out of scope: enemy types, their config, AI and spawning; the Chaser's contact damage and EN-03; the end of the match when the player's health reaches zero (MT-03, MT-04); rendering, sound and input.
Path: large.
```

## Design

Each choice stays inside an accepted ADR. Plan 0005 already gave ships a `layer`, `health`, `maxHealth` and `pendingDamage`, projectiles a `layer` and a `consumed` flag, the world a `score`, and events a `layer` with the kinds `hit` and `destroyed`.

- Swept test (ADR-0007): `segmentCircleEntry(startX, startY, endX, endY, centreX, centreY, radius)` in `src/game/sim/collision/segmentCircle.ts` returns the fraction of the segment, from 0 to below 1, at which it first enters the circle, or -1 when it does not:
  1. when the start is strictly inside the circle, 0;
  2. with `d` the segment, `f` the start minus the centre, `a = d·d`, `b = 2 f·d`, `c = f·f - radius²`: when `a` is zero, -1; when the discriminant `b² - 4ac` is zero or less, -1, so a segment that only touches the circle misses;
  3. `t = (-b - sqrt(discriminant)) / (2a)`; the result is `t` when `0 <= t < 1`, else -1. A segment that ends exactly on the circle has only touched it, and one that starts on it and points outward has `t < 0`.
  The segments of successive steps tile a projectile's path, so an entry exactly at the end of one is found at the start of the next. Whether a segment touches or crosses is the sign of a rounded discriminant: tests of the touching case use coordinates that are exact in floating point.
- Projectile hits, a new system in the collision stage, after the three ship systems and before the projectile obstacles. For each active projectile that is not consumed, in slot order: among the active ships whose layer meets the projectile's layer (`layersMeet`), in slot order, take the one with the smallest `segmentCircleEntry` from the projectile's previous position to its position, against the ship's position with radius `ship.radius + projectile.radius`; the first found wins a tie. When there is one: the projectile becomes `consumed`, the ship's `pendingDamage` grows by the projectile's `damage`, and a `hit` event is pushed with the ship's layer, a `null` weapon, the point of impact and the projectile's direction. Ships are tested where the collision stage left them in this step, after islands and walls have moved them. A shot fired in this step sweeps from its muzzle, so a target that covers the muzzle is hit at once.
- Order against obstacles: hits run before the projectile obstacles, so a ship on the projectile's path in a step wins over an island or a wall at the end of that path. The obstacles need no change: a consumed projectile that they also remove has already banked its damage.
- Damage, a new stage after the collision stage:
  1. for each active ship in slot order with `pendingDamage` above zero: `health` becomes `Math.max(0, health - pendingDamage)` and `pendingDamage` becomes zero. When the health was above zero and is now zero, a `destroyed` event is pushed with the ship's layer, a `null` weapon, its position and a zero direction, before anything is released; then a ship on the `Enemy` layer adds one to `world.score` and is released, while the player stays active at zero health (ending the match is the match slice's work);
  2. then each active consumed projectile is released.
- The score is given inside the damage stage, although ADR-0006 lists "score and match rules" as a later stage: the released ship has lost its layer by then, the event queue may have dropped the event and is never read back, and nothing between the two stages reads the score. The damage stage scores every enemy whose health it brings to zero, which is right while only the player's shots can reach an enemy.
- What follows from the two systems:
  - each projectile applies its damage once, to one ship (CB-05), and is removed in the step it hits (CB-06);
  - several projectiles that reach the same ship in one step all apply their damage and are all removed, even when the first would have destroyed it: the three shots of a broadside into one enemy are all spent;
  - an enemy destroyed in a step is inactive from the end of that step: it does not move, fire or get hit in the next one (CB-08). Shots it fired before keep flying: the challenge's "destroyed enemies stop causing damage, firing and taking part in collisions" is read as being about the enemy itself;
  - a projectile hits on the last step of its lifetime, because the collision stage sees it before the next step removes it;
  - no projectile holds a reference to a ship: the damage is banked on the ship when the hit is found, so a ship released by the damage stage leaves nothing dangling.
- Step order (ADR-0006): the event queue is emptied, then player intent, movement, weapons, projectiles, the collision stage (island collision, arena bounds, blocked ships, projectile hits, projectile obstacles) and the damage stage.
- Enemies in this slice are ships that tests place by hand on the `Enemy` layer, with their health, radius and, when a test needs them to shoot or move, weapons, fire intents or thrust. Nothing spawns or steers them yet.
- Test files: the step-level tests are split up front so that none passes 1000 lines, with one shared harness, `src/game/sim/testing/combatHarness.ts` (config builder on `testPlayer()`, placing ships and projectiles by hand, reading events).
- Arithmetic (ADR-0005): only exactly specified operations; `Math.sqrt` is one. Health, damage and score are plain numbers.

Cost estimate against the ADR-0015 profile (1 player, 20 enemies, 40 player shots, 20 enemy shots): projectile hits scan the 64 ship slots for each of the 60 projectiles, 3,840 layer checks, and run 40 × 20 + 20 × 1 = 820 swept tests of about 25 operations, about 25,000 operations per step; damage scans 64 ship slots and 256 projectile slots, about 400. This is the 860 cheap tests of ADR-0007. With plans 0003 and 0004 the step stays near 125,000 simple operations in the worst case, a few tens of microseconds, under 1% of the 16.7 ms frame. No optimisation.

```
SUBTASK 1: The swept test
  requirements: CB-05 (partial)
  files: src/game/sim/collision/segmentCircle.ts, src/game/sim/collision/segmentCircle.test.ts
  depends on: plan 0005
  tests:
    - "CB-05 a segment that crosses a circle enters it at the nearer intersection"
    - "CB-05 a segment that starts inside a circle enters it at its start"
    - "CB-05 a segment that only touches a circle, stops short of it, ends exactly on it or points away from it misses" (exact coordinates for the touching and ending cases)
    - "CB-05 a segment long enough to jump over a small circle still enters it"
    - "CB-05 a segment of zero length enters a circle only when it is inside it"
    - "CB-05 the entry point lies on the circle, for step-sized segments from all around it" (a sweep; the distance from the entry point to the centre equals the radius within 1e-9)

SUBTASK 2: The damage stage
  requirements: EN-06, MT-02 (partial), CB-06 (removal on hit), PL-04 (partial), CB-08 (partial), FX-02 (partial)
  files: src/game/sim/testing/combatHarness.ts, src/game/sim/systems/damage.ts, src/game/sim/systems/damage.test.ts, src/game/sim/step.ts
  depends on: plan 0005
  tests, all through `step`, with ships placed by hand and their `pendingDamage`, and projectiles with `consumed`, set by hand before the step:
    - "EN-06 a ship loses its pending damage from its health, and the pending damage is cleared"
    - "EN-06 an inactive slot keeps its pending damage and its health"
    - "PL-04 the player's health stops at zero and the player stays in the match"
    - "CB-08 an enemy whose health reaches zero is removed in that step and its slot is free"
    - "MT-02 each enemy destroyed adds one point, and a damaged enemy, a destroyed player and a ship with no layer add none"
    - "FX-02 a ship whose health reaches zero pushes one event with its layer and position, and none in later steps" (with an enemy, whose event must carry the layer and position it had before it was released, and with the player)
    - "CB-06 a consumed projectile is removed in the step, and one that is not consumed stays"

SUBTASK 3: Projectile hits
  requirements: CB-04, CB-05, CB-06 (removal on hit), MT-02, PL-04 (partial), EN-06, CB-08 (partial), FX-04 (partial)
  files: src/game/sim/systems/collision/projectileHits.ts, src/game/sim/systems/collision/projectileHits.test.ts, src/game/sim/systems/combat.test.ts, src/game/sim/testing/combatHarness.ts, src/game/sim/step.ts
  depends on: 1, 2
  tests, all through `step`; enemies are ships placed by hand on the enemy layer; results are checked after the step, so damage is already applied and the projectile already removed.
  In projectileHits.test.ts:
    - "CB-04 a player's shot damages an enemy and passes through the player, and an enemy's shot damages the player and passes through other enemies"
    - "CB-04 a projectile with no layer and a ship with no layer hit nothing"
    - "CB-05 a projectile damages only the first ship on its path and is removed" (the nearer ship sits in the higher slot; and with two ships entered at the same fraction, the lower slot takes the damage)
    - "CB-05 two projectiles that reach the same ship in one step each apply their damage once"
    - "CB-05 a projectile fast enough to jump over a ship in one step still hits it"
    - "CB-05 a ship is hit where the step leaves it" (an enemy thrusting into an island or a wall, whose position before the collision stage is on the shot's path and whose position after it is not; and the converse)
    - "CB-05 a projectile that is already consumed damages nothing"
    - "CB-06 a projectile that only touches a ship flies on" (integer positions, a lane exactly one combined radius away, a speed that is a multiple of 60)
  In combat.test.ts:
    - "CB-06 a projectile hits on the last step of its lifetime"
    - "CB-06 a projectile that reaches a ship and an island or a wall in the same step damages the ship"
    - "CB-06 a shot fired point blank hits in the step it is fired, with its shot and hit events, and leaves its slot free"
    - "PL-04 the player loses the damage of each enemy shot that reaches it"
    - "EN-06 an enemy survives a shot weaker than its health and is destroyed when the shots add up to it"
    - "MT-02 an enemy destroyed by the player's shots adds one point, once, and an enemy shot that crosses an enemy or hits the player adds none" (with real projectiles fired through the command mask)
    - "CB-08 a destroyed enemy does not fire in the next step, and a shot crosses where it was"
    - "FX-04 a hit pushes one event at the point of impact, with the layer of the ship that was hit and the direction of the projectile"

SUBTASK 4: Combat in the replay
  requirements: PW-03 (partial)
  files: src/game/sim/step.test.ts
  depends on: 3
  tests:
    - "PW-03 replaying the same seed and command log reproduces the whole world" (the existing replay test gains armed ships on the enemy layer, hits on both sides, an enemy destroyed and the score, and keeps its name; its exact numbers for where shots ended are derived again, since shots now also end on ships)

ORDER: 1 → 2 → 3 → 4, sequential.
VERIFICATION: lint, typecheck and unit tests. No E2E in this slice.
AFTER THE SLICE (maestro): CB-04, CB-05, EN-06, MT-02, PL-04, CB-08, FX-02 and FX-04 move to "In progress" in docs/requirements.md with "U" in their Test column, and the MT-02 row points to the damage stage; ARCHITECTURE.md gains layers, hits, damage and score; as-built lines go to ADR-0007 (a touching segment misses; a ship before an obstacle in the same step; hits against the ship's position at the end of the step; the shots of a destroyed enemy keep flying; several shots reaching a ship in one step are all spent) and ADR-0006 (the damage stage, what it releases and why it gives the score); the questions plan 0004 carried about the event shape and about the place of the projectile obstacles are closed.
CARRIED TO LATER SLICES: the enemies slice adds enemy types with their config, the Chaser's contact damage through the `Player` with `Enemy` pair, and EN-03; the damage stage scores every enemy whose health it brings to zero, so the Chaser's self-destruction must not go through `pendingDamage` unless it carries its cause; the match slice ends the match when the player's health reaches zero and stops a destroyed player from acting; the renderer draws health bars from `health` and `maxHealth`, and impacts and explosions from the `hit` and `destroyed` events.
```

## Outcome

- Tests first: 29 new tests across the four subtasks, plus the 6 of plan 0005. Subtasks 3 and 4 were finished by a second implementer run after a usage limit cut the first; it confirmed the red of each of their tests by temporary edits, and checked the replay's numbers against an independent trace of all 66 shots.
- Test audit, full mode, over plans 0005 and 0006: approved; 162 of 162 tests in two consecutive runs.
- Review, rigorous mode, over both plans: approved with notes. No finding on spec, correctness, standards, ADRs, determinism or loop cost. The cost estimate is conservative: the layer test runs only for active slots.
- The questions plan 0004 carried about the shape of events and about the place of the projectile obstacles are closed.

Carried to later slices, in addition to the list above:

- The two test harnesses repeat each other (`combatHarness.ts` and `weaponsHarness.ts`, and a few local helpers); one harness could serve all the step-level tests.
- An enemy placed with zero health is never destroyed, and a negative or non-finite pending damage would stay on a ship; neither can happen in the game today. The enemies slice and the config schema must require positive health and finite, non-negative damage.
- An enemy whose weapon is ready in the step a shot destroys it still fires in that step, because weapons run before the collision and damage stages.
- That shots of a destroyed enemy still damage the player is an interpretation of the challenge, recorded in ARCHITECTURE.md; it is the owner's to confirm.
