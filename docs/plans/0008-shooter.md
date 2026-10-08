# Plan 0008: the Shooter

Approved plan of the slice, revised after a plan review. The implementer, the test-auditor and the reviewer work from this file.

## Slice

```
Slice: The Shooter in the config and in the simulation: it approaches the player, holds its position inside its attack range, and fires its front cannon at the player only from there.
Requirements: EN-04. Partial: EN-05 (the Shooter's turn and speed), EN-06, SC-10, CB-04, CB-07, CB-08, PL-04, MT-02, PW-03.
ADRs: 0006, 0005, 0007, 0015, 0016.
Out of scope: steering around islands (EN-07) and a line-of-fire check, so a Shooter can fire into an island that stands between it and the player; spawning (EN-08 to EN-11); the end of the match; ships blocking each other; rendering, sound and input.
Path: large.
```

## Design

Each choice stays inside an accepted ADR. The Shooter reuses the pursuit of plan 0007 and the weapons, projectiles, hits and damage of plans 0004 to 0006; this slice adds a kind, a rule in the AI stage and one cannon-only armament.

- Config (SC-10): `GameConfig.enemies` gains `shooter: { radius, speed, turnRateDegrees, health, attackRange, weapons: { front: Weapon } }`, all `readonly`. Defaults, provisional until balancing: radius 22, speed 70, turn rate 90 degrees per second, health 40, attack range 260; front cannon with cooldown 1.6 s, projectile speed 260, radius 5, lifetime 1.2 s, damage 10.
- Two constraints on those numbers, each pinned by a test of the defaults and left for the config schema to enforce:
  - a shot has to be able to reach a player at the edge of the attack range, so the distance a projectile travels, its speed per step times its lifetime in whole steps, is at least the attack range. The defaults give 312 against 260. The inequality is conservative: the muzzle and the two radii add to the real reach;
  - a Shooter that faces the player within the band of plan 0007 holds its heading, so a shot fired from the edge of the range must still hit a still player: the attack range times the sine of the band is below the player's radius plus the projectile's. The defaults give a band of 2 table units and 260 × 0.0245 = 6.4 against 29.
- Armament: the config exports `Armament`, `{ readonly front: Weapon; readonly broadside?: Weapons['broadside'] }`. `Weapons` keeps both weapons required and is assignable to it, and so is the Shooter's `{ front }`. `Ship.weapons` becomes `Armament | null`, so a spawned Shooter points at the object of the config snapshot and nothing is allocated. The weapons system keeps counting the side cooldowns down for every armed ship and fires a broadside only when the armament has one; a side intent on a cannon-only ship fires nothing and starts no cooldown.
- Test fixture: `testConfig` gains a test Shooter: radius 22, speed 60 (1 unit per step), turn rate 168.75 degrees per second (4 heading units per step), health 40, attack range 300; front cannon with cooldown 1 s (60 steps), projectile speed 300 (5 units per step), radius 4, lifetime 1.5 s (90 steps, range 450), damage 10. Its band is 4 units: 300 × 0.0491 = 14.7 against 28.
- Ship (ADR-0006): `ShipKind` gains `Shooter`, and the ship gains `attackRange`, 0 on a fresh ship.
- Spawning one: `spawnShooter(world, x, y, heading)` in `src/game/sim/spawnEnemy.ts` acquires a ship and stamps it from `world.config.enemies.shooter`: the `Enemy` layer, the `Shooter` kind, radius, speed, turn rate in heading units per second, `health` and `maxHealth`, attack range, `weapons` pointing at the snapshot's armament, the given position as both position and previous position, the given heading. Its cannon is ready. It returns the ship, or `null` when the pool is full.
- Shooter intent (EN-04), a function of `src/game/sim/systems/enemyIntent.ts` beside the Chaser's rule, for each active ship of the `Shooter` kind, in slot order. With `(offsetX, offsetY)` the player minus the ship and `inRange = offsetX² + offsetY² <= attackRange²`, the range being measured between centres and a Shooter exactly at its range being within it:
  1. `turn` is `turnToward` the player, always, so the Shooter keeps facing the player while it holds;
  2. `thrust` is 0 when in range and 1 otherwise: it approaches until it is in range and then holds its position, and approaches again when the player leaves the range;
  3. `fireFront` is 1 when in range and `turn` is 0, that is, when it faces the player within the band, and 0 otherwise. The weapons system then fires once per cooldown, like any ship's.
  Range and facing are judged where both ships start the step, because the AI stage runs before movement. The shot leaves in that step even when the player's movement then carries it out of range; tests measure the distance before calling `step`. The Shooter never sets a side intent. It aims at where the player is, with no lead.
- What follows:
  - a Shooter that starts a step beyond its range does not fire in it (EN-04), because the intent is written every step;
  - a Shooter in range that does not face the player turns first and fires in the first step it starts within the band;
  - a Shooter on top of the player counts as facing it and fires; the shot hits in that step;
  - its shots are enemy shots: they hit only the player (CB-04), apply their damage once (CB-05) and take the player's health through pending damage (PL-04);
  - a Shooter has its own health (EN-06), gives a point when the player's shots destroy it (MT-02) and is inactive from the end of that step (CB-08); as plan 0006 recorded, one whose cannon is ready in the step it is destroyed still fires in that step, because weapons run before hits;
  - the movement system applies the ship's own speed and turn rate, which limits both (EN-05).
- Step order (ADR-0006): unchanged.
- Arithmetic (ADR-0005): squared distances only; no square root and no inverse trigonometry.
- World equality: the new field is a number, and `weapons` points at the frozen config snapshot of its own world, as the player's does today.
- Existing tests: no rule changes for the player or the Chaser. The count of frozen parts of the config snapshot in `createMatch.test.ts` moves from 18 to 21, and the hand-written list of leftover ship fields in `spawnEnemy.test.ts` gains `attackRange`.
- The replay of `step.test.ts` is left as it is. A second, compact replay in `src/game/sim/enemyReplay.test.ts` runs both enemy types against a scripted player in open water, twice and against a decoy, and asserts only what proves the scenario is not empty.

Cost estimate against the ADR-0015 profile (20 enemies): the Shooter's rule adds one squared distance and two comparisons to the seek that enemy intent already runs, about 10 operations per Shooter. Noise. No optimisation.

```
SUBTASK 1: The Shooter in the config, the armament and the fixture
  requirements: SC-10 (partial), EN-04 (partial), CB-07 (partial)
  files: src/game/config/gameConfig.ts, tests/config/default-enemies.test.ts, src/game/sim/testing/testConfig.ts, src/game/sim/world.ts (the type of `weapons`), src/game/sim/systems/weapons.ts, src/game/sim/systems/weaponsCooldown.test.ts, src/game/sim/createMatch.test.ts (only the exact count of frozen parts of the config snapshot, 18 to 21)
  depends on: none
  apart from that count, no existing assertion changes.
  tests:
    - tests/config/default-enemies.test.ts: "SC-10 the default Shooter has positive radius, speed, turn rate, health and attack range, and a front cannon with positive values"
    - tests/config/default-enemies.test.ts: "EN-04 the default Shooter's shots travel at least as far as its attack range" (speed per step times the lifetime in whole steps)
    - tests/config/default-enemies.test.ts: "EN-04 the default Shooter facing a still player at the edge of its range cannot miss" (the attack range times the sine of the facing band is below the player's radius plus the projectile's)
    - weaponsCooldown.test.ts, through `step`: "CB-07 a ship fitted with a front cannon only fires it on its cooldown and fires nothing from its sides" (side intents held for longer than a broadside cooldown: no projectile, no event, no side cooldown started, and the front cannon keeps its own count)

SUBTASK 2: The Shooter kind and its stamp
  requirements: SC-10 (partial), EN-04 (partial)
  files: src/game/sim/world.ts, src/game/sim/spawnEnemy.ts, src/game/sim/spawnEnemy.test.ts (the new tests, and `attackRange` in its hand-written list of leftover fields)
  depends on: 1
  tests:
    - spawnEnemy.test.ts: "SC-10 a spawned Shooter takes its radius, speed, turn rate, health, attack range and cannon from the config the match was created with"
    - spawnEnemy.test.ts: "EN-04 a spawned Shooter is an enemy of the Shooter kind at full health, where and how it was placed, with a ready front cannon and no broadside"
    - spawnEnemy.test.ts: "EN-04 spawning a Shooter returns null when the ship pool is full"

SUBTASK 3: Approach, hold and fire
  requirements: EN-04, EN-05 (partial)
  files: src/game/sim/systems/enemyIntent.ts, src/game/sim/systems/shooterIntent.test.ts
  depends on: 2
  tests, all through `step`, in open water, with Shooters spawned by `spawnShooter` and distances measured before the step:
    - "EN-04 a Shooter beyond its attack range approaches the player and does not fire" (it faces the player with its cannon ready)
    - "EN-04 a Shooter stops where it comes within its attack range and fires its front cannon toward the player" (it stops at the first of start − k × stride at or below the range, started off the stride grid so that it stops strictly inside; the shot's direction is the Shooter's heading, within the band of the direction to the player)
    - "EN-04 a Shooter exactly at its attack range is within it, and one a unit beyond is not" (integer positions, on an axis and on a diagonal: an offset of (180, 240) is at 300 and (181, 240) is beyond; a zero speed holds the one beyond still)
    - "EN-04 a Shooter within its range that does not face the player turns before it fires" (no shot while it turns, the first shot in the first step it starts within the band)
    - "EN-04 a Shooter approaches again when the player leaves its range, and stops firing" (a step that starts with the player in range still fires; the next ones do not)
    - "EN-04 a Shooter on top of the player fires and hits in that step"
    - "EN-05 a Shooter turns no faster than its turn rate and moves no faster than its speed" (checked at every step of a turn of half a circle and of an approach)
    - "EN-04 the Shooter's rule gives no intent to the player, to a Chaser, to a ship of no kind or to an inactive slot, and the Chaser's rule gives none to a Shooter" (`fireFront` stays 0 on the Chaser and on a ship of no kind fitted with a cannon; a Shooter in range has `thrust` 0)

SUBTASK 4: The Shooter in combat
  requirements: EN-04, CB-04 (partial), CB-07 (partial), CB-08 (partial), EN-06 (partial), PL-04 (partial), MT-02 (partial)
  files: src/game/sim/systems/shooterCombat.test.ts
  depends on: 3
  this subtask adds tests only; red is confirmed by temporary source edits, undone by hand. If a test needs a source change, the implementer stops and reports.
  tests, all through `step`, in open water:
    - "CB-07 a Shooter that keeps the player in range fires once per cooldown" (the steps of its shots over several cooldowns)
    - "PL-04 a Shooter's shot takes its damage from a still player's health, once"
    - "CB-04 a Shooter's shot passes through another enemy on its way to the player"
    - "EN-06 a Shooter loses health to the player's shots and is destroyed at zero"
    - "MT-02 a Shooter destroyed by the player's shots gives one point, once"
    - "CB-08 a destroyed Shooter fires no more, and its slot is free"

SUBTASK 5: Both enemy types in a replay
  requirements: PW-03 (partial)
  files: src/game/sim/enemyReplay.test.ts
  depends on: 4
  tests only; red is confirmed by temporary source edits, undone by hand.
  tests:
    - "PW-03 replaying the same seed and command log reproduces a match with both enemy types" (two runs equal at every step and at the end, a decoy with the log reversed that differs, and the scenario shown not to be empty: a Shooter's shot fired in a step that began with the player inside its range, the player's health dropping by the cannon's damage in a step with no Chaser explosion, a Chaser exploding on the player, and the player's shots destroying an enemy)

ORDER: 1 → 2 → 3 → 4 → 5, sequential.
VERIFICATION: lint, typecheck and unit tests. No E2E in this slice.
AFTER THE SLICE (maestro): EN-04 moves to "In progress" in docs/requirements.md with "U" in its Test column and `sim/systems/enemyIntent` in its Where cell; ARCHITECTURE.md gains the Shooter, its range rule and the armament; an as-built line goes to ADR-0006 (the Shooter's rule in the AI stage, judged at the start of the step, and the cannon-only armament).
CARRIED TO LATER SLICES: the spawner, which calls `spawnChaser` and `spawnShooter` (EN-08 to EN-11) and has to weigh its minimum distance against the attack range, since a Shooter is stamped with a ready cannon and fires in its first step in range; steering around islands and the line-of-fire check (EN-07); the config schema, which must keep a Shooter's projectile range at or above its attack range and its facing band narrow enough to hit from the edge of the range; balancing, since within about 89 units a player at full speed circles faster than the default Shooter turns, so it fires only as the bearing sweeps through its band; the match slice, which stops enemies from firing at a destroyed player.
```

## Outcome

- Tests first: 22 new tests across the five subtasks, 211 in all. The red of every test was seen, by a missing rule or by temporary source edits undone by hand.
- The full test audit and the rigorous review were not run: the owner asked to finish and deploy within the day on a limited budget, and from this slice on the work is done without agents. What stands in for them here is the plan review, the implementer's mutation proofs and the green lint, typecheck and tests.
- Known gap: none of the six combat tests fails when a Shooter fires regardless of range; the range rule is pinned by the eight intent tests and by the replay.
