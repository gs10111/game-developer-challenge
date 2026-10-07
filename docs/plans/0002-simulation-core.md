# Plan 0002: deterministic simulation core

Approved plan of the slice, after two plan reviews. The implementer, the test-auditor and the reviewer work from this file.

## Slice

```
Slice: Deterministic simulation core: typed config, world and match creation, entity pool, seeded PRNG, quantized rotation, the per-step command mask, player movement inside the arena, and the fixed-step clock that will drive the simulation.
Requirements: PL-01, PL-05, AR-03 (unit part). Partial: SC-10, SC-12, MT-05, MT-12, PW-03.
ADRs: 0004, 0005, 0006, 0007, 0015, 0001, 0016.
Out of scope: rendering, GameApp and the requestAnimationFrame driver, keyboard and touch input, islands (PL-06), weapons, projectiles, enemies, spawner, match clock and match end, pause state, the UI store, Zod schemas, and the T3 Playwright flow (it needs rendering and input, which come in a later slice).
Path: large (it founds determinism and the game loop).
```

## Design

Each choice stays inside an accepted ADR:

- Layer direction: `src/game/config/gameConfig.ts` imports nothing. The simulation imports the config *type* from it with `import type` and receives the values as the argument of `createMatch`. `src/game/loop` may import from `src/game/sim`; the simulation imports from neither.
- Step rate: `src/game/sim/stepRate.ts` exports `STEPS_PER_SECOND = 60` and `STEP_SECONDS = 1 / STEPS_PER_SECOND`. The loop derives its step length in milliseconds from `STEPS_PER_SECOND`; no second literal.
- Config (SC-10, partial): `GameConfig = { arena: { width, height }, player: { radius, speed, turnRateDegrees } }`. Defaults: arena 960 by 540 logical units (provisional until the arena slice), player radius 24, speed 140 units per second, turn rate 150 degrees per second. Later slices add their parameters to the same object. Pool capacity is not gameplay config: `src/game/sim/limits.ts` exports `SHIP_POOL_CAPACITY = 64` (the ADR-0015 average is 21 ships; 64 is three times that).
- Ship (ADR-0006): `{ active, x, y, heading, radius, speed, turnRate, thrust, turn }`. `radius`, `speed` and `turnRate` are stamped on the ship from the config when it is acquired (turn rate converted to table units per second), so systems never read the player's config and need no change when enemies arrive. `thrust` is 0 or 1 and `turn` is -1, 0 or 1: the intent of the current step.
- World (ADR-0006): `{ step, seed, rng, commands, config, ships, player }`. `seed` keeps the original seed; `rng` is the PRNG state holder; `commands` is the mask of the step being run; `config` is the deep-frozen snapshot and the only source of the arena size; `ships` is the pool; `player` is the player's slot.
- Pool (ADR-0006): fixed capacity created once from a factory that runs only at creation, plus a `reset(slot)` function that writes every field in place, so acquiring and releasing never allocate. `acquire()` returns a reset inactive slot or `null` when exhausted, `release()` resets the slot. Iteration is by slot index. `createMatch` treats a `null` for the player as a broken invariant and throws.
- PRNG (ADR-0005): the mulberry32 algorithm of the ADR with the state in a holder `RandomSource = { state: number }` and a function `nextRandom(source)`, instead of a closure, so that a world snapshot captures it. Nothing draws from it in this slice; the spawner will.
- Rotation (ADR-0005): heading is a number in table units, 512 per turn. After each advance it is normalised to `[0, 512)`. Sine and cosine round the heading to the nearest table entry (`Math.round`, then `& 511`); cosine reads the sine table a quarter turn ahead, masked the same way. Heading 0 points to +x; y grows downward, so a growing heading turns the ship clockwise on screen and "turn right" increases it. Round-to-nearest is final: changing it later would invalidate stored replays.
- Sine table: `scripts/generate-sine-table.ts`, run with `node scripts/generate-sine-table.ts` (Node 24 strips the types), exports a pure function that builds the 512 values (first quadrant from `Math.sin`, the rest mirrored) and writes `src/game/sim/math/sineTable.ts` only when run as the entry point. The table file is committed as data and carries no header comment. `Math.sin` never runs inside the simulation. `scripts` joins the `include` of `tsconfig.node.json`.
- Commands (ADR-0005): a bitmask per step as a `const` object: `Forward = 1`, `TurnLeft = 2`, `TurnRight = 4`, `FireFront = 8`, `FireLeft = 16`, `FireRight = 32`. Left and right together cancel out. The fire bits are defined and ignored until the weapons slice.
- Step (ADR-0006): `step(world, commands)` stores the mask in `world.commands`, runs the systems in the ADR's fixed order and then increments `world.step`. Systems are `(world, dt) => void` with `dt = STEP_SECONDS`. This slice has three: player intent (the input stage: mask to the player's `thrust` and `turn`), movement, and arena bounds (the collision stage; weapons and projectiles will later sit between movement and collision).
- Movement model (PL-01), final for the challenge: constant configured speed while forward is held, along the heading; rotation at the configured rate whether or not the ship moves; no acceleration and no inertia.
- Arena bounds (PL-05, ADR-0007): in the collision stage each active ship's centre is clamped so that its collision circle stays inside the arena rectangle.
- Test configs: every test builds its own config object inline (the five numbers above, changed as the test needs). Tests in `src/game/sim` do not value-import the defaults from `src/game/config`. Tests of PL-01, PL-05 and SC-10 in subtask 3 drive the world through `step`, not by calling a system directly, which is what proves the order intent, movement, bounds.
- Match creation: `createMatch(config, seed)` deep-copies and deep-freezes the config, creates the pool, acquires the player and places it at the arena centre with heading 0 (provisional until the arena slice chooses a spawn point free of islands).
- Fixed-step clock (ADR-0004): a pure module in `src/game/loop` that owns the last timestamp and the accumulator: `createFixedStepClock(nowMs)`, `advance(clock, nowMs)` adds the elapsed time and returns how many whole steps to run, `reset(clock, nowMs)` empties the accumulator and moves the timestamp (resume), `interpolation(clock)` returns the fraction of a step left. The clamp is on the count, not on the accumulator, because the ADR's subtract-in-a-loop form runs four steps from an accumulator of five steps in floating point: `steps = Math.floor(accumulator / stepMs)`; when `steps >= 5` return 5 and set the accumulator to zero; otherwise subtract `steps * stepMs` and never let the remainder go below zero. A zero, negative or NaN elapsed time runs no step and leaves the clock usable. It never calls `requestAnimationFrame` or reads the time itself.

Cost estimate against the ADR-0015 profile: with 21 ships, intent, movement and bounds do about 2 table reads, 6 multiplications or additions and 4 comparisons per ship, around 250 operations per step and well under a microsecond; with the 60 projectiles that later reuse the same integration, under 1,000 operations per step, far below 0.1% of the 16.7 ms frame. No optimisation.

```
SUBTASK 1: Deterministic math: step rate, sine table, rotation helpers and PRNG
  requirements: PW-03 (partial)
  files: src/game/sim/stepRate.ts, scripts/generate-sine-table.ts, src/game/sim/math/sineTable.ts (generated, committed), src/game/sim/math/rotation.ts, src/game/sim/math/rotation.test.ts, src/game/sim/random.ts, src/game/sim/random.test.ts, tests/tooling/sine-table.test.ts, tsconfig.node.json (add "scripts" to include)
  depends on: none
  tests:
    - tests/tooling/sine-table.test.ts: "PW-03 the committed sine table is exactly what the generator produces"
    - rotation.test.ts: "PW-03 the sine table has 512 entries, is exact at the quarter turns and antisymmetric by half a turn"
    - rotation.test.ts: "PW-03 sine and cosine of a heading agree with Math.sin and Math.cos of the nearest table angle within 1e-12"
    - rotation.test.ts: "PW-03 headings below zero and at or above a full turn read the wrapped entry"
    - rotation.test.ts: "PW-03 normalising a heading keeps it in [0, 512)" (include a tiny negative residue such as -1e-15, which must not come back as 512)
    - random.test.ts: "PW-03 the generator reproduces the mulberry32 sequence of ADR-0005 for several seeds" (the ADR's closure inlined in the test as the reference)
    - random.test.ts: "PW-03 a copied state continues the same sequence"
    - random.test.ts: "PW-03 random values stay in [0, 1) and different seeds diverge"

SUBTASK 2: Config, pool, world and match creation
  requirements: SC-10 (partial), SC-12 (partial), MT-05 (partial), PW-03 (partial)
  files: src/game/config/gameConfig.ts, src/game/sim/limits.ts, src/game/sim/pool.ts, src/game/sim/pool.test.ts, src/game/sim/world.ts, src/game/sim/createMatch.ts, src/game/sim/createMatch.test.ts
  depends on: 1 (RandomSource, rotation units)
  tests:
    - createMatch.test.ts: "SC-10 the player ship takes its radius, speed and turn rate from the config the match was created with"
    - createMatch.test.ts: "SC-12 a running match keeps its config when the source changes afterwards, nested fields included, and the next match uses the new values"
    - createMatch.test.ts: "MT-05 creating a match again yields a fresh world: step zero, player at the arena centre with heading zero, nothing shared with the previous match"
    - createMatch.test.ts: "PW-03 a match keeps the seed it was created with"
    - pool.test.ts: "MT-05 a released pool slot is indistinguishable from a fresh one"
    - pool.test.ts: "PW-03 the pool hands out slots in index order and returns null when exhausted"

SUBTASK 3: Commands, step, player intent, movement and arena bounds
  requirements: PL-01, PL-05, SC-10 (partial), PW-03 (partial)
  files: src/game/sim/commands.ts, src/game/sim/step.ts, src/game/sim/step.test.ts, src/game/sim/systems/playerIntent.ts, src/game/sim/systems/movement.ts, src/game/sim/systems/movement.test.ts, src/game/sim/systems/collision/arenaBounds.ts, src/game/sim/systems/collision/arenaBounds.test.ts
  depends on: 1, 2
  tests:
    - movement.test.ts: "PL-01 holding forward for one second moves the player along its heading by the configured speed"
    - movement.test.ts: "PL-01 the player does not move without the forward command"
    - movement.test.ts: "PL-01 turning right for a quarter turn and then moving forward travels toward +y, and turning left travels toward -y"
    - movement.test.ts: "PL-01 turning rotates the player at the configured turn rate"
    - movement.test.ts: "PL-01 left and right together cancel out"
    - movement.test.ts: "PL-01 turning left from heading zero and moving forward still travels at the configured speed"
    - movement.test.ts: "PL-01 a full turn brings the player back to its starting direction"
    - movement.test.ts: "SC-10 doubling the configured speed doubles the distance travelled"
    - movement.test.ts: "SC-10 the configured turn rate sets how far the player turns in one second"
    - arenaBounds.test.ts: "PL-05 the player stops with its hull inside the arena at each of the four edges"
    - arenaBounds.test.ts: "PL-05 the player never leaves the arena when driven into a corner"
    - arenaBounds.test.ts: "SC-10 the edges follow the configured arena size and player radius"
    - step.test.ts: "PW-03 each step advances the step counter by one"
    - step.test.ts: "PW-03 replaying the same seed and command log reproduces the whole world" (a script with turns, forward and wall contact; the two worlds compared in full)

SUBTASK 4: Fixed-step clock
  requirements: AR-03 (unit part), MT-12 (partial)
  files: src/game/loop/fixedStepClock.ts, src/game/loop/fixedStepClock.test.ts
  depends on: 3 (one test drives step through the clock)
  tests:
    - "AR-03 at 30, 60 and 144 frames per second the clock runs 600 steps in ten seconds, give or take one"
    - "AR-03 at 30, 60 and 144 frames per second the player travels the configured speed times ten seconds, within one step" (test config: speed 40 in the default arena, so the 400 units fit before the wall 456 units away)
    - "AR-03 a long stall runs exactly five steps and drops the rest"
    - "AR-03 zero, negative and NaN frame times run no step and leave the clock usable"
    - "AR-03 interpolation reports the fraction of a step left in the accumulator"
    - "MT-12 after a ten second gap and a reset, the next frame runs one step" (leave part of a step in the accumulator before the gap, and use a 20 ms frame after the reset: one step, 0.2 of a step left)
  Frame times in these tests stay off exact step boundaries (20 ms frames, for example), where floating point decides the count.

ORDER: 1 → 2 → 3 → 4, sequential.
VERIFICATION: lint, typecheck and unit tests. No E2E in this slice.
AFTER THE SLICE (maestro): PL-01, PL-05, AR-03, SC-10, SC-12, MT-05, MT-12 and PW-03 move to "In progress" in docs/requirements.md (they become Done when the T3 flow exists); ADR-0005 gains a consequence line recording that the PRNG keeps its state in the world instead of a closure, and ADR-0004 one recording that the clamp is applied to the step count.
```
