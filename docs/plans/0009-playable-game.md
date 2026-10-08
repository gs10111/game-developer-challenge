# Record 0009: from the spawner to the playable game

This is not a plan. The work below was done in one day, directly, without a written plan, a plan review, a test audit or a code review, because the game had to be finished and published within the day. This file records what was built, how it was checked and what was left out, so that it can be told apart from the slices that went through the whole process.

## What was built

| Commit subject | Content |
| --- | --- |
| `feat(sim): match rules and the spawner` | `Match`, `startMatch`, `advanceMatch`, the outcome and the spawner; `enemies.spawn` and `match.durationSeconds` in the config (MT-01, MT-03, MT-04, EN-08 to EN-11) |
| `feat: playable game with PixiJS arena, menus, ranking and history on a mock API` | Session, renderer, input, screens, contracts, queries, outbox, mock handlers and scenarios, E2E tests |
| `docs(requirements): statuses as built, and a portrait notice on the match screen` | The matrix brought in line with the code; the portrait notice |
| `feat(perf): benchmark run behind ?perf=1, …` | The performance recorder, the benchmark pilot and `docs/performance.md` |
| `fix(mocks): answer in the page when the service worker cannot` | The in-page fallback of the mock |

## Decisions taken on the way

- The spawner and the match rules run around `step`, in `advanceMatch`, and their state lives in a `Match` that wraps the world. ADR-0006 lists them as stages of the step; keeping them outside left `step` and its replay tests untouched.
- The spawner follows a configured sequence of enemy types, which makes the appearance of both types certain and not a matter of chance. It spawns on the rectangle one radius inside the walls, so enemies sail in from the edges.
- A match is ended by defeat before it is ended by time when both happen in the same step.
- Steering around islands (EN-07) was left out: the challenge asks enemies to respect collisions with islands, which they do.
- The renderer uses individual sprites and a `Graphics` health bar per ship, not atlases and particles (ADR-0008), and the islands are drawn with the nine sand tiles chosen by the neighbours of each cell.
- The test seam advances whole steps on top of the running loop; it does not pause the loop (ADR-0010).
- Mock latencies are fixed numbers; there is no random generator in the mock (ADR-0011).
- When the service worker does not answer, the same handlers answer in the page (ADR-0012). The first deploy showed the ranking as failed, and the host answers unknown paths with `index.html`.
- A benchmark match raises the health of the player in its config snapshot so that it lasts its session time, and is never sent to the ranking.

## How it was checked

- Unit tests: 16 for the match rules and the spawner and 3 for the performance summary and pilot, written with the code, not before it; 230 in all.
- E2E tests: 12, run only in CI, on desktop and mobile Chromium; they passed on every push of this record.
- By hand, in a browser against the dev server: starting a match, the keyboard, firing, pause and resume, the end of a match, the saved record, ranking pages, history, options validation and persistence, and the in-page mock.
- Not checked: the benchmark run from start to finish, because the browser of the session was hidden and ran no animation frames; sound, visual baselines and the cases the flow table of [requirements.md](../requirements.md) lists as missing.

## Left out

Everything listed as partly built or not built in [../README.md](../README.md), plus the review this work did not get: nobody but its author has read the code of this record.
