# Plan 0007: enemy types and the Chaser

Approved plan of the slice, revised after a plan review. The implementer, the test-auditor and the reviewer work from this file.

## Slice

```
Slice: Enemy types in the config and the Chaser in the simulation: it pursues the player with a limited turn rate, damages the player when it reaches it, and explodes there without scoring.
Requirements: EN-01, EN-02, EN-03, EN-05. Partial: PL-04 (the Chaser's impact), CB-08 (contact damage), SC-10, MT-05, PW-03, FX-02 (the event only).
ADRs: 0006, 0007, 0005, 0015, 0016, 0001.
Out of scope: steering around islands (EN-07; this Chaser heads straight for the player and slides along a shore in its way); the Shooter (EN-04); spawning (EN-08 to EN-11); the end of the match; rendering, sound and input.
Path: large.
```

## Design

Each choice stays inside an accepted ADR. ADR-0016 already counts the enemy AI as seek computations and short rays against islands; this slice builds the seek, and the rays come with the steering slice.

- Config (SC-10): `GameConfig` gains `enemies: { chaser: { radius, speed, turnRateDegrees, health, contactDamage } }`, all `readonly`. The Shooter adds its own entry later. Defaults, provisional until balancing: radius 18, speed 110, turn rate 160 degrees per second, health 30, contact damage 25.
- A constraint on those numbers: a Chaser always thrusts, so it travels on a circle of radius speed divided by turn rate in radians per second while it turns. When that radius is larger than the contact distance, the sum of the Chaser's and the player's radii, a Chaser can circle a still player for ever without reaching it. The numbers keep the turning radius below the contact distance: the defaults give 110 / 2.79 = 39.4 against 18 + 24 = 42. A test of the defaults pins the relation, and the config schema will have to enforce it.
- Test fixture: `src/game/sim/testing/testConfig.ts` exports `testConfig(arena)`, generic over its arena argument so that the result stays mutable, which returns a complete fresh config: the given arena, `testPlayer()` and test enemies (Chaser radius 20, speed 120, turn rate 168.75 degrees per second, health 30, contact damage 25). That turn rate is 240 heading units per second, exactly 4 per step, which keeps headings whole in tests; its turning radius is 40.7, below the contact distance of 20 + 24 = 44. Every config builder in the tests builds on `testConfig` and overrides only what its tests set, so a later top-level section of the config needs no edit in the builders. The builders are in `src/game/loop/fixedStepClock.test.ts`, and under `src/game/sim`: `createMatch.test.ts` (two), `step.test.ts`, `systems/movement.test.ts`, `systems/playerIntent.test.ts`, `systems/projectiles.test.ts`, `systems/collision/arenaBounds.test.ts`, `systems/collision/islandCollision.test.ts`, `systems/collision/projectileObstacles.test.ts`, `testing/combatHarness.ts` and `testing/weaponsHarness.ts`.
- Ship (ADR-0006): gains `kind` (`ShipKind` or `null`; `ShipKind` is a `const` object of strings with `Player` and `Chaser`), `contactDamage` and `exploded`. A fresh ship has `kind: null`, `contactDamage: 0` and `exploded: false`. `createMatch` gives the player the `Player` kind.
- Degrees to heading units: the private conversion of `createMatch.ts` moves to `math/rotation.ts` as the exported `headingUnitsFromDegrees(degrees)`, used by both the player and the enemies.
- Spawning one enemy: `spawnChaser(world, x, y, heading)` in `src/game/sim/spawnEnemy.ts` acquires a ship and stamps it from `world.config.enemies.chaser`: the `Enemy` layer, the `Chaser` kind, radius, speed, turn rate in heading units per second, `health` and `maxHealth`, contact damage, the given position as both position and previous position, the given heading, no weapons. It returns the ship, or `null` when the pool is full. Tests use it, and the spawner will.
- Pursuit (EN-01, EN-05): `src/game/sim/ai/pursuit.ts` exports `turnToward(ship, targetX, targetY, dt)`, which returns -1, 0 or 1 with exact arithmetic and no inverse trigonometry. With `(ax, ay) = (cosine(h), sine(h))`, `(dx, dy)` the target minus the ship, `cross = ax * dy - ay * dx` and `dot = ax * dx + ay * dy`:
  1. when `dx` and `dy` are both zero, 0;
  2. the ship counts as facing the target when `dot > 0` and `cross² <= s² * (dx² + dy²)`, with `s = sine(Math.max(1, ship.turnRate * dt))`: the sine of the table angle nearest the angle it turns in one step, and of one table unit at least. Then 0, so that it does not swing from side to side;
  3. otherwise 1 when `cross >= 0` and -1 when it is below zero. With y growing downward, a positive cross puts the target clockwise of the heading, which is a turn to the right; a target dead astern turns the ship right.
  `sine` rounds its argument to the nearest table unit, so the band is a whole number of units: at 120 degrees per second a step is 2.84 units and the band is 3.
- Enemy intent, a new system in the AI stage, between player intent and movement: for each active ship of the `Chaser` kind, in slot order, `thrust` is 1 and `turn` is `turnToward` the player's position. Ships of other kinds are left alone. The movement system then applies the ship's own speed and turn rate, which is what limits the turn (EN-05).
- Chaser impacts, a new system in the collision stage, after projectile hits and before projectile obstacles. For each active Chaser that has not exploded, in slot order: when the player is active, the layers of the two meet, the Chaser still has health left after the damage banked on it in this step (`health - pendingDamage > 0`), and the two circles overlap (the distance between centres is below the sum of the radii; touching does not count): the Chaser becomes `exploded` and the player's `pendingDamage` grows by the Chaser's `contactDamage`.
- Damage stage: in its ship pass, a ship that has `exploded` is handled before pending damage: a `destroyed` event with its layer and position is pushed, and the ship is released without a point. Otherwise the pass is unchanged.
- What follows:
  - a Chaser that reaches the player damages it once and is gone at the end of that step (EN-02); the `destroyed` event is what the renderer will turn into the explosion;
  - its self-destruction on the player scores nothing (EN-03), because the point is given only for health brought to zero by damage;
  - a Chaser that the player's shots bring to zero in the very step it would reach the player does not explode: the player takes no damage and gets the point. It was destroyed by the player's attacks, and a destroyed enemy causes no damage (CB-08). The hit and the contact are both judged where the Chaser ends the step;
  - a Chaser hit but not destroyed in the step it reaches the player still explodes, with no point: what destroys it is its own explosion;
  - several Chasers that reach the player in one step each apply their damage;
  - the player's health drops by the contact damage through the same pending damage as a shot (PL-04), also when it is already at zero.
- Step order (ADR-0006): the event queue is emptied, then player intent, enemy intent, movement, weapons, projectiles, the collision stage (island collision, arena bounds, blocked ships, projectile hits, Chaser impacts, projectile obstacles) and the damage stage.
- Islands: the Chaser is a ship like any other, so islands and walls block it and it slides along a shore. It does not look ahead yet, and can be held by an island that stands between it and the player; EN-07 is the next slice. The tests of this slice run in open water, and so does the approach of the Chaser that reaches the player in the replay.
- Arithmetic (ADR-0005): only exactly specified operations; no `Math.atan2`, which lint rejects in simulation sources.
- World equality: the new fields are strings, numbers, booleans and `null`.

Cost estimate against the ADR-0015 profile (20 enemies): enemy intent, 20 ships by about 20 operations, 400; Chaser impacts, 20 distance tests of about 8 operations, 160. Both are noise beside the hits of plan 0006. No optimisation.

```
SUBTASK 1: Enemies in the config and the config fixture
  requirements: SC-10 (partial), EN-01 (partial)
  files: src/game/config/gameConfig.ts, tests/config/default-enemies.test.ts, src/game/sim/testing/testConfig.ts, src/game/sim/createMatch.test.ts (its builders and the count that depends on the config snapshot), and the files with config builders listed in the Design
  depends on: none
  this subtask changes no rule of the game: the 162 existing tests pass, with each config builder built on `testConfig(arena)` and no existing assertion removed or loosened.
  tests:
    - tests/config/default-enemies.test.ts: "SC-10 the default Chaser has positive radius, speed, turn rate, health and contact damage"
    - tests/config/default-enemies.test.ts: "EN-01 the default Chaser turns tighter than its contact distance with the default player" (speed divided by turn rate in radians per second is below the sum of the two radii)

SUBTASK 2: The ship's kind and the Chaser's stamp
  requirements: SC-10 (partial), MT-05 (partial), EN-01 (partial)
  files: src/game/sim/world.ts, src/game/sim/createMatch.ts, src/game/sim/createMatch.test.ts, src/game/sim/pool.test.ts, src/game/sim/math/rotation.ts, src/game/sim/math/rotation.test.ts, src/game/sim/spawnEnemy.ts, src/game/sim/spawnEnemy.test.ts
  depends on: 1
  this subtask changes no rule either. The helper of pool.test.ts that overwrites every ship field gives `kind` a non-null value.
  tests:
    - rotation.test.ts: "PW-03 a turn rate in degrees converts to heading units, 512 to the turn"
    - createMatch.test.ts: "MT-05 the player of a fresh match is of the player kind and has not exploded"
    - spawnEnemy.test.ts: "SC-10 a spawned Chaser takes its radius, speed, turn rate, health and contact damage from the config the match was created with"
    - spawnEnemy.test.ts: "EN-01 a spawned Chaser is an enemy of the Chaser kind at full health, where and how it was placed, with no weapons"
    - spawnEnemy.test.ts: "EN-01 spawning fills the ship pool in slot order and returns null when it is full"

SUBTASK 3: Pursuit
  requirements: EN-01, EN-05
  files: src/game/sim/ai/pursuit.ts, src/game/sim/ai/pursuit.test.ts, src/game/sim/systems/enemyIntent.ts, src/game/sim/systems/enemyIntent.test.ts, src/game/sim/step.ts
  depends on: 2
  tests:
    - pursuit.test.ts: "EN-01 a ship turns right toward a target clockwise of its heading and left toward one counter-clockwise, at every heading" (y grows downward; several headings and target bearings, checked against an oracle that uses Math.atan2)
    - pursuit.test.ts: "EN-01 a ship that faces its target within the band holds its heading, and one a table unit outside it turns" (a turn rate of a whole number of units per step, such as the fixture's 4)
    - pursuit.test.ts: "EN-01 the facing band is the table angle nearest one step of turning, and one unit at least" (2.84 units per step gives a band of 3; a turn rate below half a unit per step gives a band of 1)
    - pursuit.test.ts: "EN-01 a target dead astern turns the ship right, and a target at the ship's own position turns it nowhere"
    - enemyIntent.test.ts, through `step`: "EN-01 a Chaser turns toward the player and closes the distance until it faces it"
    - enemyIntent.test.ts, through `step`: "EN-01 a Chaser follows the player as the player moves"
    - enemyIntent.test.ts, through `step`: "EN-01 a Chaser that faces a still player holds its heading from one step to the next" (no swing)
    - enemyIntent.test.ts, through `step`: "EN-05 a Chaser turns no faster than its turn rate and moves no faster than its speed" (the heading change and the distance moved are checked at every step of a turn of half a circle)
    - enemyIntent.test.ts, through `step`: "EN-01 the Chaser's rule gives no intent to the player, to a ship of no kind or to an inactive slot"
  In these tests the Chaser stays too far from the player to reach it, since subtask 4 makes reaching it end the Chaser.

SUBTASK 4: Impact and explosion
  requirements: EN-01, EN-02, EN-03, PL-04 (partial), CB-08 (partial), FX-02 (partial)
  files: src/game/sim/systems/collision/chaserImpacts.ts, src/game/sim/systems/chaserImpact.test.ts, src/game/sim/systems/damage.ts, src/game/sim/step.ts
  depends on: 3
  tests, all through `step`, in open water, with Chasers spawned by `spawnChaser`:
    - "EN-02 a Chaser that reaches the player takes its contact damage from the player's health and is removed in that step"
    - "EN-02 a Chaser that only touches the player has not reached it" (integer positions exactly one combined radius apart, the Chaser held still by a zero speed)
    - "EN-02 several Chasers that reach the player in the same step each apply their damage"
    - "EN-01 a Chaser that starts with a still player abeam, on either side, from just outside contact to twice its turning radius, reaches it" (a sweep of distances on both sides; none of them circles for ever)
    - "EN-03 a Chaser that explodes on the player adds no point, and one destroyed by the player's shots adds one"
    - "EN-03 a Chaser that the player's shots bring to zero in the step it would reach the player does not explode: no damage to the player, and the point is given"
    - "EN-02 a Chaser hit but not destroyed in the step it reaches the player still explodes, with no point"
    - "CB-08 a Chaser that has exploded is gone: its slot is free and it damages nothing in the next step"
    - "FX-02 an exploding Chaser pushes one destroyed event with the enemy layer and its position"
    - "PL-04 the player's health stops at zero under impacts and the player stays in the match"

SUBTASK 5: Chasers in the replay
  requirements: PW-03 (partial)
  files: src/game/sim/step.test.ts
  depends on: 4
  tests:
    - "PW-03 replaying the same seed and command log reproduces the whole world" (the existing replay test gains Chasers, one that reaches the player across open water and one shot down on the way, and keeps its name; every number that changes is derived again and checked against a trace)

ORDER: 1 → 2 → 3 → 4 → 5, sequential.
VERIFICATION: lint, typecheck and unit tests. No E2E in this slice.
AFTER THE SLICE (maestro): EN-01, EN-02, EN-03 and EN-05 move to "In progress" in docs/requirements.md with "U" in their Test column, and their Where cells name `sim/ai/pursuit`, `sim/systems/enemyIntent` and `sim/systems/collision/chaserImpacts`; ARCHITECTURE.md gains the enemy config, the Chaser's pursuit, its impact and the constraint on its turning radius; as-built lines go to ADR-0006 (the AI stage, the exploded path of the damage stage, the turning-radius constraint) and ADR-0007 (the Chaser's contact: overlap of the two circles at the end of the step, after the step's shots).
CARRIED TO LATER SLICES: steering around islands with short rays (EN-07), after which the replay's numbers are derived again; the Shooter and its attack range (EN-04); the spawner, which calls `spawnChaser` at points clear of the islands and away from the player (EN-08 to EN-11); the config schema, which must keep a Chaser's turning radius below its contact distance; the match slice, which stops enemies from pursuing a destroyed player.
```
