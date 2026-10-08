# ADR-0015: Performance decisions use an average-case cost model

- **Status:** Accepted
- **Date:** 2026-10-07
- **Deciders:** Gabriel da Silveira
- **Requirements:** PF-01, PF-02, PF-03, PF-04, AR-03

## Context

Several design choices depend on load: the collision broad phase (ADR-0007), pooling (ADR-0006), rendering (ADR-0008) and whether any code should leave TypeScript (ADR-0016). Waiting for profiling of code that does not exist yet stalls those choices, while designing for the worst case adds machinery for a load the game never reaches. The README still requires profiling evidence in the final report (ADR-0009).

## Decision

Performance-related decisions are justified with an average-case cost model of a typical match under the default config. Each decision writes down the entity counts it assumes, the operations per simulation step, the estimated cost and its share of the 16.7 ms frame budget.

Average-case profile, used until the default config is final:

| Quantity | Average case |
| --- | --- |
| Player ships | 1 |
| Live enemies | 20 |
| Live projectiles | 60 (40 from the player, 20 from enemies) |
| Islands | 5, split into about 10 convex parts |
| Live particles | 150 |
| Simulation steps per second | 60 |
| Frame budget | 16.7 ms |

- Profiling is still delivered (ADR-0009) and acts as a check of this model, not as a precondition for decisions.
- A decision is reopened only when the configured or measured load exceeds this profile by an order of magnitude.
- The README's p95 frame time stays in the report: the average case governs design choices, not what is reported.

## Options considered

| Option | Assessment |
| --- | --- |
| Measure before deciding | Blocks the plan until most of the game exists, and invites premature optimisation once numbers appear. |
| Design for the worst case | Spatial hashes, workers or WebAssembly for loads the game never reaches. |
| **Average-case model with an order-of-magnitude revisit rule** | Decisions are made up front, their assumptions are explicit, and profiling still catches a wrong model. |

## Consequences

- Easier: every performance choice carries its own cost estimate, so reviewers can check the reasoning without running anything.
- Harder: the profile must be updated when the default spawn interval, enemy health or projectile lifetime is fixed in `gameConfig.ts`.
- As built: the default config allows at most 10 live enemies, half the profile. The model has not been checked against a measurement yet (`docs/performance.md`).
- Revisit: when the default config or a measurement moves any row by 10× or more.

## Sources

- [PixiJS: Performance Tips](https://pixijs.com/8.x/guides/concepts/performance-tips) — optimise only when needed; PixiJS handles a fair amount of content out of the box (official).
- [GameDev.net: QuadTree for 2D collision detection](https://gamedev.net/forums/topic/590388-quadtree-for-2d-collision-detection/) — spatial structures gave little or no gain over brute force at modest actor counts (forum).
- Challenge README, section 9 — profiling evidence required in the final report (primary).
