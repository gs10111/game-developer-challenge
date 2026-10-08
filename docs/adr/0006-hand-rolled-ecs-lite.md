# ADR-0006: Hand-rolled ECS-lite, no ECS library

- **Status:** Accepted
- **Date:** 2026-10-07
- **Deciders:** Gabriel da Silveira
- **Requirements:** AR-02, AR-11

## Context

A match holds at most around a hundred live entities (ships, projectiles, effects). The challenge requires movement, combat, collision and enemy behaviour to be implemented by the candidate, and evaluates architecture clarity.

## Decision

- Pre-allocated, typed pools per entity kind (`ships`, `projectiles`, `effects`) with `acquire()` and `release()`, so the steady-state loop allocates nothing.
- Systems are pure functions `(world: World, dt: number) => void`, run in a fixed order: input → AI → movement → weapons → projectiles → collision → damage → spawner → score and match rules.
- Systems communicate through the world and a per-step event queue (`shotFired`, `hit`, `destroyed`) that the renderer and audio consume after the step.

## Options considered

| Option | Assessment |
| --- | --- |
| bitECS | Minimal, data-oriented, very fast; its performance only matters far above our entity count, and TypedArray components make gameplay code noisier. |
| Miniplex | TypeScript-first with great ergonomics, but no built-in systems or scheduling, so most of the structure would still be ours. |
| Class hierarchy with `update()` per entity | Familiar, but hides system order and couples behaviour to inheritance. |
| **Hand-rolled ECS-lite** | A few hundred lines, explicit order, and all gameplay rules visibly written by us. |

## Consequences

- Easier: each system has a unit test; the step order is readable in one place.
- Harder: pool bookkeeping is manual, so released entities must be fully reset.
- As built: the event queue holds 128 pre-allocated events, is emptied at the start of every step and drops what does not fit, so whoever consumes it reads it after each step and not once per frame. Acquiring from a pool scans for the first free slot, which costs up to the pool size per acquisition and keeps slot order deterministic.
- As built: the damage stage runs after the collision stage. It applies the damage that hits banked on each ship, reports a ship that reaches zero health, releases a destroyed enemy and every spent projectile, and also gives the point for the enemy. The score is given there and not in a later stage because the released ship has lost its layer by then, and the event queue may have dropped the event and is never read back.
- As built: a ship carries a kind (the player, a Chaser, or none), and a system that applies to one kind filters on it. Enemy intent is the AI stage, between player intent and movement: it sets thrust and turn on each Chaser and leaves the other ships alone. A ship marked as exploded is handled by the damage stage before pending damage: its destruction is reported and it is released without a point. A Chaser's turning radius, its speed divided by its turn rate, has to stay below its contact distance with the player, or it could circle a still player for ever; a test pins this for the defaults and the config schema will have to enforce it.
- As built: the Shooter's rule sits in the AI stage beside the Chaser's and is chosen by the ship's kind. It judges range and facing where both ships start the step, since the stage runs before movement, and writes thrust, turn and the front fire intent every step, so no intent stays latched. A ship's weapons are an armament with a front cannon and an optional broadside, and a spawned Shooter points at the armament of the config snapshot, so spawning allocates nothing.
- As built: the spawner and the match rules run around `step`, in `advanceMatch` of `sim/match.ts`, and their state lives in a `Match` that wraps the world. `step` stays the combat step that the replay tests run; after the match has an outcome `advanceMatch` does nothing.
- Revisit: if entity counts grow by orders of magnitude, migrate components to typed arrays or adopt bitECS.

## Sources

- [NateTheGreatt/bitECS](https://github.com/NateTheGreatt/bitECS) — minimal, data-oriented ECS for TypeScript (official repository).
- [hmans/miniplex](https://github.com/hmans/miniplex) — TypeScript-first entity manager without built-in systems or scheduling (official repository).
- [ddmills/js-ecs-benchmarks](https://github.com/ddmills/js-ecs-benchmarks) — compares JavaScript ECS libraries under large synthetic loads (open-source project).
- [three.js forum: Battle Typer](https://discourse.threejs.org/t/battle-typer-typing-game-made-using-react-three-fiber/56794) — a shipped game paired an ECS for entities with Zustand for game state (forum).
