# ADR-0016: TypeScript only, no Rust/WebAssembly

- **Status:** Accepted
- **Date:** 2026-10-07
- **Deciders:** Gabriel da Silveira
- **Requirements:** AR-02, AR-11, DL-08

## Context

Compiling simulation hot paths from Rust to WebAssembly was considered as a differentiator. The README makes TypeScript in strict mode mandatory, gives 35 of 100 points to gameplay rules that must be implemented by the candidate, and gives 5 points to performance and documentation together.

## Decision

All game code, simulation included, is TypeScript. No Rust, no WebAssembly.

Average-case cost per simulation step (profile from ADR-0015):

| Work per step | Operations |
| --- | --- |
| Movement integration | 81 bodies (21 ships, 60 projectiles) |
| Collision (ADR-0007) | about 860 circle and SAT tests |
| Enemy AI | 20 seek computations, 60 short ray-versus-island tests |
| Weapons, damage, spawner, score | tens of branches |

This is on the order of a thousand cheap operations per step, estimated in the tens of microseconds: well under 1% of the 16.7 ms frame budget. A 2× to 3× WebAssembly speedup would save microseconds per frame, while rendering, which stays in PixiJS on the JavaScript side either way, dominates the frame.

## Options considered

| Option | Assessment |
| --- | --- |
| Whole simulation in Rust/WebAssembly | Moves the most heavily graded code out of the required language; adds a second toolchain to CI and deploy; the test seam (ADR-0010) reads state across the boundary. |
| Hot paths only (collision) in WebAssembly | Saves microseconds; adds boundary copies, Wasm memory lifecycle under Strict Mode (ADR-0002) and build complexity. |
| **TypeScript only** | Meets the mandatory stack, keeps every rule reviewable in one language, and the average case leaves the budget almost untouched. |

## Consequences

- Easier: one toolchain, one language for reviewers, no boundary in tests or profiling.
- Harder: nothing measurable at the average case.
- As built: the enemy AI is the seek plus a route by island corners, not short rays. A graph of corner nodes with the shortest distances between them is built once per match; an enemy that cannot see the player tests its line of sight to each node, and the lines from the nodes to the player are tested once per step (`src/game/sim/ai/navigation.ts`). With 10 enemies and about a dozen nodes that is a few hundred segment tests per step at most, the same order as the estimate above.
- Revisit: only if a future mode raises the average case by about 100× (a bullet-hell variant, for example), and then only for an isolated, benchmarked module.

## Sources

- Challenge README, sections 1 and 10 — mandatory stack and evaluation weights (primary).
- [ADR-0015](0015-average-case-performance-model.md) — the average-case profile used above.
- [ADR-0007](0007-collision-strategy.md) — the collision cost model.
