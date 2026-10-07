# Architecture

This document describes the system as it is built, and grows with each slice. The reasoning behind each decision is in [docs/adr/](docs/adr/README.md), and the status of every requirement is in [docs/requirements.md](docs/requirements.md).

## Layers

| Layer | Path | Role | Built so far |
| --- | --- | --- | --- |
| Config | `src/game/config` | Typed gameplay parameters and their defaults | Arena size and player movement |
| Simulation | `src/game/sim` | The rules of the game, in pure TypeScript | World, match creation, pool, PRNG, rotation, commands, movement, arena bounds |
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
| `ships`, `player` | The ship pool and the player's slot in it |

`createMatch(config, seed)` copies and freezes the config, so later changes to the options reach only the next match. It creates the pool and places the player at the centre of the arena.

`step(world, commands)` advances the match by one sixtieth of a second. It stores the command mask and runs the systems in a fixed order: player intent, movement, arena bounds. Each system is a function of the world and the step length. Systems act on every active ship and read speed, turn rate and radius from the ship itself, where they were stamped from the config, so enemies will reuse them unchanged.

Pools have a fixed capacity, reset a slot in place when it is acquired or released, and are scanned by slot index. The step allocates nothing.

### Determinism

The same seed and the same command log always produce the same match ([ADR-0005](docs/adr/0005-deterministic-simulation-and-replay.md)):

- Commands are a bitmask per step: forward, turn left, turn right, front shot, left broadside, right broadside.
- Randomness comes from a mulberry32 generator whose state is part of the world.
- A heading is a number in units of 1/512 of a turn, kept in `[0, 512)`. Sine and cosine read the nearest entry of a table that is generated once by `scripts/generate-sine-table.ts` and committed, so no engine-dependent trigonometry runs during a match.
- Within a step a ship turns first and then moves along its new heading.

The rounding rule and the turn-then-move order are part of the replay format: changing either invalidates recorded matches.

### Movement and bounds

The player moves forward at the configured speed while the forward command is held and turns at the configured rate whether or not it is moving. There is no acceleration and no inertia. After movement, each active ship is clamped so that its collision circle stays inside the arena ([ADR-0007](docs/adr/0007-collision-strategy.md)).

## Fixed-step clock

`src/game/loop/fixedStepClock.ts` turns frame timestamps into whole simulation steps ([ADR-0004](docs/adr/0004-fixed-timestep-game-loop.md)). It never reads the time itself: every timestamp is an argument, which keeps it testable and lets tests drive it.

- `advance` adds the time since the last frame to an accumulator and returns how many steps fit in it. At 30, 60 or 144 frames per second the simulation runs 60 steps per second.
- A frame never runs more than five steps. When a stall accumulates more, the surplus is dropped.
- `reset` empties the accumulator and moves the timestamp, so time spent paused or in a hidden tab is never simulated.
- `interpolation` returns the fraction of a step left over, for the renderer to draw between the last two states.

## Mock API

There is no backend. The MSW service worker starts before the first render in every build, the published one included, so the deployed app behaves like development ([ADR-0012](docs/adr/0012-msw-in-production-build.md)).

## Current limitations

- The arena size, the player's start position and the movement values are provisional until the arena and balancing slices.
- Nothing is rendered yet: the rules above are exercised by unit tests only.
