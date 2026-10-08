# Documentation

| Document | What it holds |
| --- | --- |
| [requirements.md](requirements.md) | Every requirement of the challenge with an ID, where it lives in the code and its status, and the twelve E2E flows with how far each is covered |
| [adr/](adr/README.md) | The architecture decisions. Each record ends with "As built" lines: what was built differently and what was not built |
| [plans/](plans/README.md) | The plan and the outcome of each slice of work, and a record of the part built without plans |
| [test-report.md](test-report.md) | The results of the last run of every check, the list of E2E tests and the one failure seen in CI |
| [accessibility.md](accessibility.md) | The contrast of every text colour pair of the interface, what else is in place and what was not done |
| [performance.md](performance.md) | The performance report: the method, the reference machine, a three-minute match at 59.9 frames per second and five cycles of start, play and exit with no growth of the heap |
| [../ARCHITECTURE.md](../ARCHITECTURE.md) | The system as built |
| [../CHALLENGE.md](../CHALLENGE.md) | The statement of the challenge, in Portuguese |

## Status at delivery

Of the 136 requirements of the matrix, 133 are built, 2 are partly built and 1 is not built. The game is published at https://game-developer-challenge-nine.vercel.app. Checks at the last commit: lint, typecheck, 236 unit tests and 12 E2E tests on desktop and mobile Chromium, all passing in CI.

### Built

| Area | What works |
| --- | --- |
| Simulation | Movement, front cannon and broadsides, projectiles, islands and arena walls, collision layers, hits, damage and score, the Chaser, the Shooter, enemies that go round islands, the spawner, the match rules, and replays from a seed |
| Match on screen | PixiJS arena from the supplied assets, health bars, damage states, muzzle flash, hit spark and explosion, sound effects with a mute button, keyboard and touch controls, manual and automatic pause, HUD, loading with progress and a retry on failure |
| Screens | Main menu with Play, Options, the controls, Ranking and Match History; result dialog with score, time played, reason and record status; options validated and kept after a refresh; last result kept after a refresh |
| Ranking and history | Typed contracts, Axios, TanStack Query with pages, cache, retries and invalidation, and an outbox that registers each finished match once and keeps pending records after a failure or a refresh |
| Mock API | MSW handlers with fixtures and local persistence, eleven selectable scenarios, a panel to choose one and restore the data, and a fallback that answers in the page when the service worker cannot |
| Delivery | CI with lint, typecheck, unit and E2E tests in a container, a public deploy on Vercel with the mock active, README, ARCHITECTURE, and the test and performance reports |

### Partly built

| ID | Built | Missing |
| --- | --- | --- |
| PW-01 | Twelve E2E tests for the main flows | The cases listed per flow in [requirements.md](requirements.md): flows T2 and T12 have no test, T3 to T7 and T9 to T11 are partial |
| API-12 | A late response cannot overwrite newer data: the page is in the query key and requests carry an abort signal | A test that shows it |

Outside the matrix: only the two options and the captain name are validated, not the whole game config.

### Not built

| ID | What |
| --- | --- |
| PW-02 | Visual regression of the menu, the arena and the result screen, with versioned baselines |

Also not built, from the decisions: atlases and particles in the renderer ([ADR-0008](adr/0008-rendering-strategy.md)), the Playwright performance script with draw calls and heap snapshots ([ADR-0009](adr/0009-profiling-metrics.md)), and the post-deploy smoke test ([ADR-0012](adr/0012-msw-in-production-build.md)).

## How it was built

The simulation up to the Shooter was built slice by slice, each with a written plan, a plan review, tests first, a test audit and a code review; the plans and their outcomes are in [plans/](plans/README.md). The Shooter was merged without the audit and the review. Everything after it, from the spawner to the deploy, was built directly in one day without plans or reviews, and is recorded in [plans/0009-playable-game.md](plans/0009-playable-game.md).
