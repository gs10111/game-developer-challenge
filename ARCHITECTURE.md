# Architecture

This document describes the system as it is built, and grows with each slice. The reasoning behind each decision is in [docs/adr/](docs/adr/README.md), and the status of every requirement is in [docs/requirements.md](docs/requirements.md).

## Layers

| Layer | Path | Role | Built so far |
| --- | --- | --- | --- |
| Config | `src/game/config` | Typed gameplay parameters and their defaults | Arena size, islands, player movement and weapons |
| Simulation | `src/game/sim` | The rules of the game, in pure TypeScript | World, match creation, pools, PRNG, rotation, commands, movement, weapons, projectiles, the event queue, islands, collision with islands and arena bounds |
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

`createMatch(config, seed)` copies and freezes the config, so later changes to the options reach only the next match. It builds the island index and the pool, and places the player at the centre of the arena.

`step(world, commands)` advances the match by one sixtieth of a second. It stores the command mask, empties the event queue and runs the systems in a fixed order: player intent, movement, weapons, projectiles, and the collision stage (island collision, arena bounds, blocked ships, projectile obstacles). Each system is a function of the world and the step length. Systems act on every active ship and read speed, turn rate and radius from the ship itself, where they were stamped from the config, so enemies will reuse them unchanged.

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

The simulation reports what happened in a step through a queue of pre-allocated events, emptied when the next step starts. Today it carries one kind, a shot, with the weapon, the muzzle position and the direction. The simulation never reads the queue back. The loop driver will have to hand it to the renderer and the sound after every step, not once per frame: at 30 frames per second a frame runs two steps, and at 144 some frames run none.

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
- Island polygons, speeds and weapon values are not validated: a malformed part, a ship or a projectile fast enough to cross an island in one step, or a non-positive cooldown would not be caught.
- Projectiles hit nothing but islands and walls yet: targets, sides and damage come with the next slice.
- A ship held forward into a concave corner wider than a right angle does not come to rest: it shifts by up to about one unit from step to step, without ever entering an island. The default layout has only right angles, where ships settle.
- Nothing is rendered yet: the rules above are exercised by unit tests only.
