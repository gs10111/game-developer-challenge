# Plan 0005: state for combat

Approved plan of the slice. It was cut out of the first draft of plan 0006 after a plan review found that draft too large: this half adds the state that combat needs and changes no rule of the game. The implementer, the test-auditor and the reviewer work from this file.

## Slice

```
Slice: State for combat, with no change to any rule of the game: collision layers and their pair matrix, health and pending damage on ships, a layer and a consumed flag on projectiles, the score in the world, a player fixture for tests, and events that carry a layer.
Requirements: partial CB-04 (the matrix and the layer of a shot), SC-10, MT-05.
ADRs: 0007, 0006, 0005, 0001.
Out of scope: the swept test, hits, the damage stage and the score rule (plan 0006); enemy types, AI and spawning; rendering, sound and input.
Path: standard. Its test audit and its review run together with those of plan 0006, over both.
```

## Design

Each choice stays inside an accepted ADR:

- Layers (ADR-0007): `src/game/sim/collision/layers.ts` exports `Layer`, a `const` object of strings with `Player`, `Enemy`, `PlayerShot`, `EnemyShot` and `Island`; `layersMeet(a, b)`, the symmetric pair matrix; and `shotLayerOf(layer)`, which gives `PlayerShot` for `Player`, `EnemyShot` for `Enemy` and `null` otherwise. The pairs that meet: `Player` with `Enemy`, `EnemyShot` and `Island`; `Enemy` with `PlayerShot` and `Island`; `PlayerShot` and `EnemyShot` with `Island`. Nothing meets its own layer, shots do not meet shots, and enemies do not meet enemies. `layersMeet` with a `null` on either side is false, and it allocates nothing. Nothing reads the matrix in this slice; plan 0006 uses it for shots against ships.
- Ship (ADR-0006): gains `layer` (`Layer` or `null`), `health`, `maxHealth` and `pendingDamage`. A fresh ship has `layer: null` and the three numbers at zero. `createMatch` gives the player the `Player` layer and sets `health` and `maxHealth` to the `player.health` of the snapshot.
- Projectile (ADR-0006, ADR-0007): gains `layer` (`Layer` or `null`) and `consumed`. A fresh projectile has `layer: null` and `consumed: false`. The weapons system stamps `layer` with `shotLayerOf` of the firing ship's layer.
- Config (SC-10): `GameConfig.player` gains `health`. Default, provisional until balancing: 100.
- World: gains `score`, zero in a fresh match.
- Test fixture: `src/game/sim/testing/testPlayer.ts` exports `testPlayer()`, which returns a fresh mutable player config: radius 24, speed 140, turn rate 150 degrees per second, health 100 and `testWeapons()`. Every config builder in the tests spreads it and overrides only the values its tests set, so a later player field needs no edit in the builders. The builders are in these files: `src/game/loop/fixedStepClock.test.ts`, and under `src/game/sim`: `createMatch.test.ts` (two builders), `step.test.ts` (two), `systems/movement.test.ts`, `systems/playerIntent.test.ts`, `systems/projectiles.test.ts`, `systems/collision/arenaBounds.test.ts`, `systems/collision/islandCollision.test.ts`, `systems/collision/projectileObstacles.test.ts` and `testing/weaponsHarness.ts`.
- Events (ADR-0006): `GameEvent` becomes `{ kind, layer, weapon, x, y, directionX, directionY }` with `layer: Layer | null` and `weapon: WeaponName | null`, and `pushEvent(queue, kind, layer, weapon, x, y, directionX, directionY)`. `EventKind` gains `Hit` and `Destroyed`, which nothing pushes until plan 0006. A `shotFired` event carries the layer of the ship that fired and its weapon. A never-used event object holds `null` in both and a `shotFired` kind. The simulation still never reads the queue back.
- World equality: the new fields are numbers, booleans, strings and `null`, so two worlds still compare with `toStrictEqual`.
- No rule changes: after this slice a match plays exactly as before. Every existing test passes with only the edits listed below.

```
SUBTASK 1: Layers, the player fixture, health and score
  requirements: CB-04 (partial), SC-10 (partial), MT-05 (partial)
  files: src/game/sim/collision/layers.ts, src/game/sim/collision/layers.test.ts, src/game/config/gameConfig.ts, tests/config/default-player.test.ts, src/game/sim/testing/testPlayer.ts, src/game/sim/world.ts (the ship and the world only), src/game/sim/createMatch.ts, src/game/sim/createMatch.test.ts, src/game/sim/pool.test.ts (the ship test and its helper), and the files with config builders listed in the Design
  depends on: none
  existing tests that need more than the builder change:
    - the helper of pool.test.ts that overwrites every ship field gives `layer` a non-null value, so that the test proves a release sets it back to `null`;
    - the counts in createMatch.test.ts that depend on the config snapshot or on the shape of the world.
  tests:
    - layers.test.ts: "CB-04 the pair matrix lets player shots meet enemies and enemy shots meet the player, and nothing meets its own layer" (every pair of the five layers and `null` asserted, both ways round)
    - layers.test.ts: "CB-04 the shots of a ship take the shot layer of its side, and a ship with no layer fires shots with none"
    - createMatch.test.ts: "SC-10 the player's health is the one of the config the match was created with"
    - createMatch.test.ts: "MT-05 a fresh match has the player at full health on the player layer and a score of zero"
    - tests/config/default-player.test.ts: "SC-10 the default player health is positive"

SUBTASK 2: Projectile layer, the consumed flag and events with a layer
  requirements: CB-04 (partial), MT-05 (partial)
  files: src/game/sim/world.ts (the projectile), src/game/sim/events.ts, src/game/sim/events.test.ts, src/game/sim/systems/weapons.ts, src/game/sim/systems/weaponsFiring.test.ts, src/game/sim/systems/weaponsCooldown.test.ts, src/game/sim/testing/weaponsHarness.ts, src/game/sim/pool.test.ts (the projectile test and its helper), src/game/sim/createMatch.test.ts, src/game/sim/step.test.ts, src/game/sim/systems/collision/projectileObstacles.test.ts
  depends on: 1
  existing assertions that change, found by reading the code; look for others of the same kinds:
    - every assertion on a `shotFired` event gains `layer: 'player'`, or the layer of the ship that fired, and every call of `pushEvent` in tests takes the new argument (createMatch.test.ts, step.test.ts, events.test.ts and the two weapons test files);
    - full projectile literals under `toStrictEqual` gain `layer` and `consumed`: the shots in weaponsFiring.test.ts and weaponsCooldown.test.ts (`layer: 'playerShot', consumed: false`), the fresh projectile in pool.test.ts and the one in projectileObstacles.test.ts (`layer: null, consumed: false`);
    - weaponsCooldown.test.ts indexes a log by the event's weapon, which no longer typechecks once the weapon may be `null`;
    - the helper of pool.test.ts that overwrites every projectile field gives `layer` a non-null value and `consumed` true.
  tests:
    - weaponsFiring.test.ts: "CB-04 a projectile takes the shot layer of the ship that fired it" (the player, an armed ship placed on the enemy layer and an armed ship with no layer; keep the three off each other's lines of fire, so that plan 0006 does not break this test)
    - weaponsFiring.test.ts: the existing "FX-01 each shot pushes one event…" asserts the layer of the ship that fired
    - events.test.ts: the existing "FX-01 the event queue keeps events in order…" carries the new fields
    - pool.test.ts: the existing "MT-05 a released projectile slot is indistinguishable from a fresh one" covers the new fields
  Keep weaponsFiring.test.ts and weaponsCooldown.test.ts under 1000 lines; move helpers to the harness if needed.

ORDER: 1 → 2, sequential.
VERIFICATION: lint, typecheck and unit tests. No E2E in this slice.
AFTER THE SLICE (maestro): recorded together with plan 0006.
```
