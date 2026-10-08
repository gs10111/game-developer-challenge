# Architecture

This document describes the system as it is built, and grows with each slice. The reasoning behind each decision is in [docs/adr/](docs/adr/README.md), and the status of every requirement is in [docs/requirements.md](docs/requirements.md).

## Layers

| Layer | Path | Role | Built so far |
| --- | --- | --- | --- |
| Config | `src/game/config` | Typed gameplay parameters and their defaults | Arena size, islands, player movement, health and weapons, the Chaser |
| Simulation | `src/game/sim` | The rules of the game, in pure TypeScript | World, match creation, pools, PRNG, rotation, commands, movement, weapons, projectiles, the event queue, islands, collision with islands and arena bounds, layers, hits, damage and score, ship kinds, the Chaser's pursuit and impact |
| Loop | `src/game/loop` | Timing that drives the simulation | Fixed-step clock |
| Render | `src/game/render` | PixiJS scene | Not yet |
| Input | `src/game/input` | Keyboard and touch, sampled once per step | Not yet |
| UI | `src/ui` | React screens, HUD and dialogs | Placeholder screen in `src/App.tsx` |
| API and mocks | `src/api`, `src/mocks` | Axios, TanStack Query and the MSW handlers | One example handler |

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

A ship carries its weapons, three fire intents and three cooldowns. The player's intents come from the command mask each step, so moving, turning and firing combine freely. Weapon parameters live in the config: cooldown, projectile speed, radius, lifetime and damage for the front cannon and for the broadside, plus the spacing between the broadside's three projectiles.

Cooldowns and lifetimes are whole numbers of steps, never accumulated time, which keeps them exact and suspends them for free when the simulation is paused. Each step a weapon's cooldown drops by one; when it is zero and the command is set, the weapon fires and the cooldown starts again. A held command therefore fires on the first step and then exactly once per cooldown, and the front cannon and each broadside count on their own.

The front cannon fires one projectile from the bow along the heading. A broadside fires three parallel projectiles from one side of the hull, perpendicular to the heading. A projectile moves in the step it is fired, travels in a straight line at its speed, and is removed in the step after its last move, so its range is exactly its speed times its lifetime. It is also removed when its centre crosses a wall of the arena or its circle overlaps an island.

### Events

The simulation reports what happened in a step through a queue of pre-allocated events, emptied when the next step starts. It carries three kinds: a shot, with the layer of the ship that fired, the weapon, the muzzle position and the direction; a hit, with the layer of the ship that was hit, the point of impact and the direction of the projectile or of the Chaser that rammed it; and a destruction, with the ship's layer and position. The simulation never reads the queue back. The loop driver will have to hand it to the renderer and the sound after every step, not once per frame: at 30 frames per second a frame runs two steps, and at 144 some frames run none.

### Hits, damage and score

Ships and projectiles carry a layer: player, enemy, player shot or enemy shot. A pair matrix says which layers meet, so a player's shot is tested only against enemies and an enemy's shot only against the player ([ADR-0007](docs/adr/0007-collision-strategy.md)).

A hit is found with a swept test: the segment from where the projectile was to where it is, against a circle of the ship's radius plus the projectile's, so a fast projectile cannot jump over a ship. The nearest ship on the path takes the damage. The projectile is marked as spent and its damage is banked on the ship; nothing else happens until the damage stage.

The damage stage takes the banked damage from each ship's health. An enemy that reaches zero is worth one point and leaves the match at once; the player stays at zero health until the match rules, still to come, end the match. Then every spent projectile is removed. Each projectile therefore applies its damage once and is gone in the step it hits.

Three choices are worth stating:

- An enemy is inactive from the end of the step that destroys it. Shots it had already fired keep flying and can still hit the player. The challenge says destroyed enemies stop causing damage, firing and colliding; this is read as being about the enemy itself, and its list of reasons for a projectile to disappear does not include the death of whoever fired it.
- Several shots that reach one ship in the same step are all spent, even when the first would have destroyed it, as with the three shots of a broadside.
- A ship on a projectile's path wins over an island or a wall at the end of that path in the same step.

### Enemies

A ship carries a kind: the player, a Chaser, or none for a ship that tests place by hand. Enemy parameters live in the config under `enemies`; the Chaser has a radius, a speed, a turn rate, a health and a contact damage. `spawnChaser(world, x, y, heading)` takes a free ship from the pool and stamps it from the config the match was created with, and returns nothing when the pool is full. The spawner, still to come, will call it.

The enemy intent system runs right after the player's ([ADR-0016](docs/adr/0016-no-rust-webassembly.md)). For each Chaser it sets the thrust and picks a turn toward the player: none when the Chaser already faces the player within the angle it turns in one step, which keeps it from swinging from side to side; otherwise right or left, by the sign of the cross product between its heading and the direction to the player. No inverse trigonometry is involved. Movement then applies the Chaser's own speed and turn rate, which is what limits how fast it turns.

The Chaser impacts system runs in the collision stage, after the step's shots have been judged. A Chaser whose circle overlaps the player's explodes: its contact damage is banked on the player like a shot's, a hit is reported on the player at the point of contact, and the damage stage reports the Chaser's destruction and removes it without a point. A Chaser that only touches the player has not reached it.

Four things are worth stating:

- A Chaser that the player's shots bring to zero in the very step it would reach the player does not explode: the player takes no damage and gets the point. One that is hit in that step but survives the shots still explodes, with no point.
- Several Chasers that reach the player in one step each apply their damage.
- A Chaser always moves forward, so while it turns it travels on a circle whose radius is its speed divided by its turn rate. If that circle were wider than the contact distance, the sum of the two radii, the Chaser could circle a still player for ever. The defaults keep it narrower, 39.4 against 42, and a test pins the relation.
- The Chaser heads straight for the player. An island in the way holds it or makes it slide along the shore until the player moves; steering around islands comes next.

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

## Mock API

There is no backend. The MSW service worker starts before the first render in every build, the published one included, so the deployed app behaves like development ([ADR-0012](docs/adr/0012-msw-in-production-build.md)).

## Current limitations

- The arena size, the island layout, the player's start position and the movement values are provisional until the arena is drawn and the game is balanced.
- Island polygons, speeds, weapon values and enemy values are not validated: a malformed part, a ship or a projectile fast enough to cross an island in one step, a non-positive cooldown, or a Chaser that turns wider than its contact distance would not be caught.
- The Chaser is the only enemy type, and only tests spawn it: steering around islands, the Shooter and the spawner come next. Nothing ends the match yet, so a Chaser keeps pursuing a player whose health is at zero.
- A ship held forward into a concave corner wider than a right angle does not come to rest: it shifts by up to about one unit from step to step, without ever entering an island. The default layout has only right angles, where ships settle.
- Nothing is rendered yet: the rules above are exercised by unit tests only.
