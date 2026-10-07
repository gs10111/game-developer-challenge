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
- Revisit: if entity counts grow by orders of magnitude, migrate components to typed arrays or adopt bitECS.

## Sources

- [NateTheGreatt/bitECS](https://github.com/NateTheGreatt/bitECS) — minimal, data-oriented ECS for TypeScript (official repository).
- [hmans/miniplex](https://github.com/hmans/miniplex) — TypeScript-first entity manager without built-in systems or scheduling (official repository).
- [ddmills/js-ecs-benchmarks](https://github.com/ddmills/js-ecs-benchmarks) — compares JavaScript ECS libraries under large synthetic loads (open-source project).
- [three.js forum: Battle Typer](https://discourse.threejs.org/t/battle-typer-typing-game-made-using-react-three-fiber/56794) — a shipped game paired an ECS for entities with Zustand for game state (forum).
