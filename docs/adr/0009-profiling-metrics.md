# ADR-0009: Profiling report includes draw calls

- **Status:** Accepted
- **Date:** 2026-10-07
- **Deciders:** Gabriel da Silveira
- **Requirements:** PF-01, PF-02, PF-03, PF-04

## Context

The challenge asks for FPS, frame time, entity count over a three-minute match and memory after five start, play and exit cycles, measured on a production build. PixiJS roles in this market are explicitly evaluated on batching and draw-call awareness.

## Decision

- A separate Playwright script (`e2e/perf`) runs against `vite build` + `vite preview`, plays a three-minute deterministic replay (ADR-0005) and records per frame: frame time, simulation step time, entity count and draw calls.
- Draw calls are counted in debug builds by wrapping the WebGL context's draw methods and resetting the counter each frame.
- Memory is sampled through the Chrome DevTools Protocol after each of five cycles, with a heap snapshot at the start and the end.
- Output: a JSON file plus `docs/PERFORMANCE.md` with FPS, p95 frame time, draw calls, the heap chart, hardware, browser, resolution, match config and known limitations.

## Options considered

| Option | Assessment |
| --- | --- |
| Manual DevTools screenshots | Not reproducible; hard to compare across changes. |
| **Scripted collection on a deterministic replay** | Same input every run, so numbers are comparable and can run in CI. |

## Consequences

- Easier: performance regressions show up as diffs in a JSON file.
- Harder: the draw-call counter must stay out of production builds.
- Profiling checks the average-case model from ADR-0015 instead of gating decisions: a measured load an order of magnitude above the model reopens the affected ADRs.
- Revisit: if CI hardware is too noisy, keep CI for trend only and publish numbers from the reference machine.

## Sources

- [PixiJS: Performance Tips](https://pixijs.com/8.x/guides/concepts/performance-tips) — profile before optimizing (official).
- [PixiJS Developer job post, iLogos](https://careers.ilogos.biz/jobs/7124962-pixijs-developer-crash-slot-games) — PixiJS roles expect understanding of containers, batching and draw calls (market evidence).
