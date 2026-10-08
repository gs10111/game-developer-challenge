# Architecture

This document describes the system as it is built, and grows with each slice. The reasoning behind each decision is in [docs/adr/](docs/adr/README.md), and the status of every requirement is in [docs/requirements.md](docs/requirements.md).

## Layers

| Layer | Path | Role | Built so far |
| --- | --- | --- | --- |
| Config | `src/game/config` | Typed gameplay parameters and their defaults | Arena size, islands, player movement, health and weapons, the Chaser and the Shooter |
| Simulation | `src/game/sim` | The rules of the game, in pure TypeScript | World, match creation, pools, PRNG, rotation, commands, movement, weapons, projectiles, the event queue, islands, collision with islands and arena bounds, layers, hits, damage and score, ship kinds, the Chaser's pursuit and impact, the Shooter's range and fire |
| Loop | `src/game/loop` | Timing that drives the simulation | Fixed-step clock |
| Runtime | `src/game/runtime` | One match on screen: loop, pause, interface store | Game session |
| Render | `src/game/render` | PixiJS scene | Arena, ships, health bars, projectiles, effects |
| Input | `src/game/input` | Keyboard and touch, sampled once per step | Command mask, keyboard |
| UI | `src/ui` | React screens, HUD and dialogs | Menu, options, match, result, ranking, history |
| API and mocks | `src/api`, `src/mocks`, `src/storage` | Axios, TanStack Query, the outbox and the MSW handlers | Ranking, history, match registration, scenarios |

Dependencies point one way. The config imports nothing. The simulation imports only the config's type and receives the values when a match is created. The loop imports the simulation. Neither `pixi.js` nor `react` can be imported in the simulation: ESLint rejects it, together with `Math.random`, `Date.now` and `performance.now` ([ADR-0001](docs/adr/0001-imperative-react-pixi-bridge.md), [ADR-0005](docs/adr/0005-deterministic-simulation-and-replay.md)).

## Simulation

The continuous state of a match lives in one mutable `World` ([ADR-0006](docs/adr/0006-hand-rolled-ecs-lite.md)):

| Field | Holds |
| --- | --- |
| `step` | Number of steps run since the match started |
| `seed`, `rng` | The match seed and the state of the random generator |
| `commands` | The command mask of the step being run |
| `config` | A deep-frozen copy of the config, taken when the match is created |
| `islands` | The island parts with their edge normals and bounding boxes, and the grid that finds the parts near a ship |
| `ships`, `player` | The ship pool and the player's slot in it |
| `projectiles` | The projectile pool |
| `events` | What happened in the last step, for the renderer and the sound |
| `score` | Enemies destroyed by the player |

`createMatch(config, seed)` copies and freezes the config, so later changes to the options reach only the next match. It builds the island index and the pool, and places the player at the centre of the arena.

`step(world, commands)` advances the match by one sixtieth of a second. It stores the command mask, empties the event queue and runs the systems in a fixed order: player intent, enemy intent, movement, weapons, projectiles, the collision stage (island collision, arena bounds, blocked ships, projectile hits, Chaser impacts, projectile obstacles) and the damage stage. Each system is a function of the world and the step length. Movement, weapons and collision act on every active ship and read speed, turn rate and radius from the ship itself, where they were stamped from the config, so enemies reuse them unchanged.

Pools have a fixed capacity, reset a slot in place when it is acquired or released, and are scanned by slot index. The step allocates nothing.

### Determinism

The same seed and the same command log always produce the same match ([ADR-0005](docs/adr/0005-deterministic-simulation-and-replay.md)):

- Commands are a bitmask per step: forward, turn left, turn right, front shot, left broadside, right broadside.
- Randomness comes from a mulberry32 generator whose state is part of the world.
- A heading is a number in units of 1/512 of a turn, kept in `[0, 512)`. Sine and cosine read the nearest entry of a table that is generated once by `scripts/generate-sine-table.ts` and committed, so no engine-dependent trigonometry runs during a match.
- Within a step a ship turns first and then moves along its new heading.

The rounding rule and the turn-then-move order are part of the replay format: changing either invalidates recorded matches.

### Movement

The player moves forward at the configured speed while the forward command is held and turns at the configured rate whether or not it is moving. There is no acceleration and no inertia. Before a ship moves, movement records where it was.

### Weapons and projectiles

A ship carries its armament, three fire intents and three cooldowns. An armament is a front cannon and, for the player, a broadside; a ship without a broadside ignores the side intents. The player's intents come from the command mask each step, so moving, turning and firing combine freely. Weapon parameters live in the config: cooldown, projectile speed, radius, lifetime and damage for the front cannon and for the broadside, plus the spacing between the broadside's three projectiles.

Cooldowns and lifetimes are whole numbers of steps, never accumulated time, which keeps them exact and suspends them for free when the simulation is paused. Each step a weapon's cooldown drops by one; when it is zero and the command is set, the weapon fires and the cooldown starts again. A held command therefore fires on the first step and then exactly once per cooldown, and the front cannon and each broadside count on their own.

The front cannon fires one projectile from the bow along the heading. A broadside fires three parallel projectiles from one side of the hull, perpendicular to the heading. A projectile moves in the step it is fired, travels in a straight line at its speed, and is removed in the step after its last move, so its range is exactly its speed times its lifetime. It is also removed when its centre crosses a wall of the arena or its circle overlaps an island.

### Events

The simulation reports what happened in a step through a queue of pre-allocated events, emptied when the next step starts. It carries three kinds: a shot, with the layer of the ship that fired, the weapon, the muzzle position and the direction; a hit, with the layer of the ship that was hit, the point of impact and the direction of the projectile or of the Chaser that rammed it; and a destruction, with the ship's layer and position. The simulation never reads the queue back. The loop driver will have to hand it to the renderer and the sound after every step, not once per frame: at 30 frames per second a frame runs two steps, and at 144 some frames run none.

### Hits, damage and score

Ships and projectiles carry a layer: player, enemy, player shot or enemy shot. A pair matrix says which layers meet, so a player's shot is tested only against enemies and an enemy's shot only against the player ([ADR-0007](docs/adr/0007-collision-strategy.md)).

A hit is found with a swept test: the segment from where the projectile was to where it is, against a circle of the ship's radius plus the projectile's, so a fast projectile cannot jump over a ship. The nearest ship on the path takes the damage. The projectile is marked as spent and its damage is banked on the ship; nothing else happens until the damage stage.

The damage stage takes the banked damage from each ship's health. An enemy that reaches zero is worth one point and leaves the match at once; the player stays at zero health, and the match rules end the match in that step. Then every spent projectile is removed. Each projectile therefore applies its damage once and is gone in the step it hits.

Three choices are worth stating:

- An enemy is inactive from the end of the step that destroys it. Shots it had already fired keep flying and can still hit the player. The challenge says destroyed enemies stop causing damage, firing and colliding; this is read as being about the enemy itself, and its list of reasons for a projectile to disappear does not include the death of whoever fired it.
- Several shots that reach one ship in the same step are all spent, even when the first would have destroyed it, as with the three shots of a broadside.
- A ship on a projectile's path wins over an island or a wall at the end of that path in the same step.

### Enemies

A ship carries a kind: the player, a Chaser, a Shooter, or none for a ship that tests place by hand. Enemy parameters live in the config under `enemies`: both types have a radius, a speed, a turn rate and a health; the Chaser adds a contact damage, and the Shooter an attack range and a front cannon. `spawnChaser(world, x, y, heading)` and `spawnShooter(world, x, y, heading)` take a free ship from the pool and stamp it from the config the match was created with, and return nothing when the pool is full. The spawner calls them.

The enemy intent system runs right after the player's ([ADR-0016](docs/adr/0016-no-rust-webassembly.md)). For each Chaser it sets the thrust and picks a turn toward the player: none when the Chaser already faces the player within the angle it turns in one step, which keeps it from swinging from side to side; otherwise right or left, by the sign of the cross product between its heading and the direction to the player. No inverse trigonometry is involved. Movement then applies the Chaser's own speed and turn rate, which is what limits how fast it turns.

The Shooter approaches the player like a Chaser until the distance between the two centres is within its attack range, and holds its position there. It keeps turning toward the player, and fires its front cannon when it is in range and faces the player within the same band; the weapons system then fires once per cooldown, as for any ship. Beyond its range it never fires, and it approaches again when the player leaves. Its shots are enemy shots: they hit only the player. It aims at where the player is, with no lead.

Range and facing are judged where both ships start the step, because the enemy intent runs before movement. A shot therefore leaves in a step that began with the player in range, even when the player sails out of it in that same step.

Two relations between the Shooter's numbers are pinned by tests of the defaults: a projectile travels at least as far as the attack range, 312 against 260, and a shot fired from the edge of the range by a Shooter anywhere inside its facing band still hits a still player.

The Chaser impacts system runs in the collision stage, after the step's shots have been judged. A Chaser whose circle overlaps the player's explodes: its contact damage is banked on the player like a shot's, a hit is reported on the player at the point of contact, and the damage stage reports the Chaser's destruction and removes it without a point. A Chaser that only touches the player has not reached it.

Five things are worth stating:

- A Chaser that the player's shots bring to zero in the very step it would reach the player does not explode: the player takes no damage and gets the point. One that is hit in that step but survives the shots still explodes, with no point.
- Several Chasers that reach the player in one step each apply their damage.
- A Chaser always moves forward, so while it turns it travels on a circle whose radius is its speed divided by its turn rate. If that circle were wider than the contact distance, the sum of the two radii, the Chaser could circle a still player for ever. The defaults keep it narrower, 39.4 against 42, and a test pins the relation.
- Both enemy types head straight for the player. An island in the way holds them or makes them slide along the shore until the player moves, and a Shooter fires at an island that stands between it and the player. Steering around islands and a line-of-fire check come later.
- Ships do not block each other: enemies overlap one another, and a Shooter can sit on the player.

### Islands and collision

Ships are circles and islands are convex polygons; a concave island is written in the config as several convex parts ([ADR-0007](docs/adr/0007-collision-strategy.md)). The default arena is 16 by 9 tiles of 64 units with four islands in five rectangular parts.

When a match is created, each part gets the unit outward normal of every edge and a bounding box, and is listed in the cells of a uniform grid, from the cell that holds its lowest corner to the cell that holds its highest. A ship looks only at the parts in the cells under its own bounding box, found with the same mapping.

The overlap test finds the edge of the part that the circle's centre is furthest outside of. When the centre projects inside that edge, the circle is pushed along the edge's normal; when it projects past an end, it is pushed away from that vertex. A circle that only touches does not overlap.

The collision stage runs three systems, each over the active ships:

1. Island collision pushes the ship out of its deepest overlap, up to three times. Taking the deepest first is what lets a ship slide across the seam between two parts: the corner buried in the seam overlaps less than the shore the ship is sliding along.
2. Arena bounds clamps the ship so that its circle stays inside the arena.
3. Blocked ships sends a ship that still overlaps an island back to where it was before the step. This settles the places the first two cannot, such as a notch narrower than the hull. The heading is kept, so the ship can turn away.

A ship that starts a step clear of the islands and inside the arena ends it the same way, and a ship driven into a shore at an angle keeps the part of its movement that runs along the shore. Two things are assumed and not yet enforced: ships are placed clear of the islands, and whoever places a ship records its position as the previous one.

## Fixed-step clock

`src/game/loop/fixedStepClock.ts` turns frame timestamps into whole simulation steps ([ADR-0004](docs/adr/0004-fixed-timestep-game-loop.md)). It never reads the time itself: every timestamp is an argument, which keeps it testable and lets tests drive it.

- `advance` adds the time since the last frame to an accumulator and returns how many steps fit in it. At 30, 60 or 144 frames per second the simulation runs 60 steps per second.
- A frame never runs more than five steps. When a stall accumulates more, the surplus is dropped.
- `reset` empties the accumulator and moves the timestamp, so time spent paused or in a hidden tab is never simulated.
- `interpolation` returns the fraction of a step left over, for the renderer to draw between the last two states.

## Match flow

`src/game/sim/match.ts` wraps the world in a `Match`: the steps left, the countdown to the next spawn, the number of enemies spawned and the outcome. `advanceMatch` runs one step of the world, lets the spawner act, takes one step from the time left and sets the outcome: `defeated` when the health of the player is at zero, otherwise `timeUp` when no step is left. Once there is an outcome `advanceMatch` does nothing, which is what stops movement, attacks, damage, spawns and scoring. A new match is a new `Match`.

The spawner (`src/game/sim/spawner.ts`) follows the sequence of enemy types of the config, one enemy per interval. It draws a point on the rectangle one radius inside the walls from the seeded generator, up to eight per step, and takes the first that is clear of the islands and at least the minimum distance from the player. A spawn that cannot happen, for lack of a point or because the maximum is alive, stays due and is tried again in the next step.

These two run around `step` and not inside it, a departure from the stage list of [ADR-0006](docs/adr/0006-hand-rolled-ecs-lite.md): `step` stays the pure combat step that the replay tests exercise.

## Runtime, rendering and input

`src/game/runtime/session.ts` owns one match on screen ([ADR-0001](docs/adr/0001-imperative-react-pixi-bridge.md)). `createGameSession` loads the textures, creates the PixiJS application, starts the match and returns an imperative handle: pause, resume, press and release a command, destroy. React never renders per frame.

- Loop: the PixiJS ticker calls one frame function. It asks the fixed-step clock how many steps fit, runs them with the current command mask, hands the events of every step to the renderer and draws with the interpolation fraction ([ADR-0004](docs/adr/0004-fixed-timestep-game-loop.md)).
- Pause: the key, the button, a window that loses focus or a hidden tab pause the session. Nothing is stepped while paused, and resuming resets the clock and clears the held commands, so no time and no input of the pause is replayed.
- Interface state: a vanilla Zustand store holds the phase, health, score and whole seconds left. It is written only when one of them changes, about once a second ([ADR-0003](docs/adr/0003-mutable-simulation-state-throttled-ui-store.md)).
- Rendering (`src/game/render`): one view per pool slot, created once and hidden when the slot is free. Ships are sprites chosen by kind and by a third of health left, with a health bar above; projectiles, muzzle flashes, hit sparks and explosions come from fixed pools. Textures are loaded once through the PixiJS asset cache, with progress, and a failure is shown with a retry before the combat starts. The canvas has the size of the arena at up to twice the pixel density and is scaled by CSS, keeping 16:9.
- Input (`src/game/input`): the keyboard and the touch buttons set bits of one command mask, read once per step. Keys are captured only while the match is running.
- Lifecycle: `destroy` removes the listeners, destroys the application and its ticker and keeps the cached textures. The React effect that creates the session cancels a creation still in flight, which makes it safe under Strict Mode ([ADR-0002](docs/adr/0002-strict-mode-safe-pixi-lifecycle.md)).
- Test seam: with `?e2e=1` the session exposes `window.pirateBattle` with `snapshot()` and `advance(steps)` ([ADR-0010](docs/adr/0010-e2e-testing-strategy.md)).

## Interface

`src/ui` holds the React screens: the main menu with its four tabs (Play, Options, Ranking, Match History), the match screen with the HUD, the pause and result dialogs and the touch controls. Dialogs are native `dialog` elements opened as modals, which keeps the focus inside them. Score, time and health are also plain text in the HUD, and the phase of the match is announced once per change.

Options are validated with Zod and saved in `localStorage` together with the id of the player and the last finished match (`src/storage`, `src/api/outbox.ts`). A match takes a snapshot of the config when it starts.

## API and mock

There is no backend. The MSW service worker starts before the first render in every build, the published one included ([ADR-0012](docs/adr/0012-msw-in-production-build.md)).

- Contracts (`src/api/contracts.ts`): Zod schemas for a match record and for the pages of the ranking and the history, used by the client and by the handlers ([ADR-0014](docs/adr/0014-zod-at-boundaries.md)).
- Queries (`src/api/matches.ts`): Axios with a 6 s timeout, TanStack Query with the page in the query key, the previous page kept while the next loads, two retries, and a refetch every time a tab is shown. A response to a superseded request is discarded by its key and its abort signal.
- Outbox (`src/api/outbox.ts`): a finished match is written to a persisted list first and then sent with `PUT /api/matches/{matchId}`, which is idempotent. Success removes it and invalidates the ranking and the history; failure after the retries marks it, and the player can try again. Pending records are sent again when the app loads ([ADR-0013](docs/adr/0013-match-submission-outbox.md)). An abandoned match never reaches the list.
- Mock (`src/mocks`): the handlers keep confirmed records in `localStorage`, add fixtures for other players and consult the selected scenario on every request ([ADR-0011](docs/adr/0011-network-scenarios-via-msw.md)).
- Fallback (`src/mocks/inPage.ts`): at start-up the app asks `GET /api/health`. When the answer is not the one of the mock, an Axios adapter hands every request to the same MSW handlers through `getResponse`, in the page, with the timeout and the cancellation of the client reproduced. A static host answers unknown paths with `index.html`, so without this a browser that blocks service workers would show every list as failed.

## Current limitations

- The arena layout and the gameplay values are a first balance.
- The config is validated only for the two options of the Options tab: a malformed island, a ship or a projectile fast enough to cross an island in one step, a non-positive cooldown, a Chaser that turns wider than its contact distance, or a Shooter whose shots fall short of its attack range would not be caught.
- Enemies do not steer around islands, and a Shooter fires at an island that stands between it and the player.
- A ship held forward into a concave corner wider than a right angle does not come to rest: it shifts by up to about one unit from step to step, without ever entering an island. The default layout has only right angles, where ships settle.
- No sound, no visual regression baselines and no performance measurements yet.
