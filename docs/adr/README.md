# Architecture Decision Records

This folder records the main architecture decisions of Pirate Battle. Each record states the context, the decision, the options considered, the consequences and the sources that back it. `ARCHITECTURE.md` describes the resulting system and links here for the reasoning.

| ADR | Decision | Status | Requirements | As built |
| --- | --- | --- | --- | --- |
| [0001](0001-imperative-react-pixi-bridge.md) | Imperative React ↔ PixiJS bridge with a typed event bus | Accepted | AR-01, AR-02, AR-04 | With changes |
| [0002](0002-strict-mode-safe-pixi-lifecycle.md) | Strict Mode safe PixiJS lifecycle | Accepted | AR-05, AR-08, AR-09 | With changes |
| [0003](0003-mutable-simulation-state-throttled-ui-store.md) | Mutable simulation state, throttled UI store | Accepted | AR-04, AR-10, MT-07 | As decided |
| [0004](0004-fixed-timestep-game-loop.md) | Fixed timestep game loop with interpolated rendering | Accepted | AR-03, MT-08 to MT-12 | As decided |
| [0005](0005-deterministic-simulation-and-replay.md) | Deterministic simulation and input replay | Accepted | PW-03, EN-10, EN-11 | As decided |
| [0006](0006-hand-rolled-ecs-lite.md) | Hand-rolled ECS-lite, no ECS library | Accepted | AR-02, AR-11 | With changes |
| [0007](0007-collision-strategy.md) | Circles, SAT for islands, layer filtering, measured broad phase | Accepted | CB-01 to CB-08, PL-05, PL-06, EN-07 | As decided |
| [0008](0008-rendering-strategy.md) | Rendering with atlases, scaled sprites, BitmapText and ParticleContainer | Accepted | FX-01 to FX-05, MT-06, PF-01 | Partly |
| [0009](0009-profiling-metrics.md) | Profiling report includes draw calls | Accepted | PF-01 to PF-04 | Partly |
| [0010](0010-e2e-testing-strategy.md) | Deterministic E2E testing through a test seam | Accepted | PW-01 to PW-07 | Partly |
| [0011](0011-network-scenarios-via-msw.md) | Network scenarios controlled by MSW, not by `page.route()` | Accepted | MSW-03 to MSW-10, T10 to T12 | With changes |
| [0012](0012-msw-in-production-build.md) | MSW enabled in the published build | Accepted | MSW-11, DL-02 | With a fallback added |
| [0013](0013-match-submission-outbox.md) | Idempotent match submission through a local outbox | Accepted | API-11 to API-16 | With changes |
| [0014](0014-zod-at-boundaries.md) | Zod 4 schemas at the boundaries only | Accepted | API-01, SC-02 to SC-04, SC-07, SC-10 | Partly |
| [0015](0015-average-case-performance-model.md) | Performance decisions use an average-case cost model | Accepted | PF-01 to PF-04, AR-03 | Not measured yet |
| [0016](0016-no-rust-webassembly.md) | TypeScript only, no Rust/WebAssembly | Accepted | AR-02, AR-11, DL-08 | As decided |
| [0017](0017-containerized-environment.md) | Native development, containerized E2E and CI on the official Playwright image | Accepted | DL-01, DL-04, DL-07, PW-02, PW-07 | As decided, in CI only |

## Conventions

- The last column says how the decision stands in the code. Each record ends its consequences with "As built" lines that state what was built differently and what was not built.
- One decision per file, numbered in order (`NNNN-short-title.md`) and never renumbered.
- A changed decision gets a new record that supersedes the old one; the old file stays, with its status set to `Superseded by NNNN`.
- Requirement IDs (PL, EN, CB, MT, FX, SC, AR, API, MSW, UX, PW, PF, DL) are defined in [../requirements.md](../requirements.md); T1 to T12 are the twelve mandatory E2E flows.
- Sources prefer official documentation. Community material, forum threads and mirrors are labelled as such.
- New records start from [template.md](template.md).
- Records up to 0016 call the challenge statement "the README". It now lives in [CHALLENGE.md](../../CHALLENGE.md), and `README.md` is the solution's own.
