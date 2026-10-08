# Test report

State of the tests at commit `2441034`, 8 October 2026, taken from the CI run of that commit ([run 37782821163](https://github.com/gs10111/game-developer-challenge/actions/runs/37782821163)). CI runs every check inside the container of [ADR-0017](adr/0017-containerized-environment.md).

| Check | Command | Result |
| --- | --- | --- |
| Lint | `pnpm lint` | No findings |
| Typecheck | `pnpm typecheck` | No errors |
| Unit tests | `pnpm test` | 236 of 236 passing, in 42 files |
| E2E tests | `pnpm test:e2e` | 24 of 24 passing: 12 tests, each on desktop and on mobile Chromium |

## Unit tests

Vitest, in Node, with no browser. Every test name starts with the ID of the requirement it proves, so `pnpm test -t "EN-04"` runs the tests of one requirement.

| Area | What is covered |
| --- | --- |
| `src/game/sim` | Movement, weapons and cooldowns, projectiles, islands and walls, collision primitives, layers, hits, damage and score, the Chaser, the Shooter, the route of enemies around islands, the spawner, the match rules, pools, the seeded generator, the sine table, and three replays from a seed |
| `src/game/loop` | The fixed-step clock: steps per frame at 30, 60 and 144 frames per second, the clamp, the reset |
| `src/game/runtime` | The summary of frame times and the benchmark pilot |
| `tests/config` | The default config: layout, player, weapons, enemies, spawn settings, the relations between its numbers, and a Chaser reaching a still player from every part of the default arena |
| `tests/tooling` | The lint rules that keep the simulation pure and deterministic, the pinned toolchain versions, the generated sine table |

Rendering, input, the screens, the API client and the mock have no unit tests; they are covered by the E2E tests below and by nothing else.

## E2E tests

Playwright against the production build, in a desktop and a mobile project. With `?e2e=1` the tests read the state of the match and advance it by whole steps through `window.pirateBattle`; the keys, the buttons, the rules and the rendering are the real ones. Every test fails on a console error.

| Test | File |
| --- | --- |
| MSW-11 the production build serves the ranking from the mock API | `e2e/menu.spec.ts` |
| SC-02 the options are validated, saved and kept after a refresh | `e2e/menu.spec.ts` |
| API-02 the ranking is paginated and ordered by score | `e2e/menu.spec.ts` |
| API-09 an empty history and a failing ranking are shown as such, and the game stays reachable | `e2e/menu.spec.ts` |
| MSW-11 without a service worker the same handlers answer in the page | `e2e/menu.spec.ts` |
| PL-01 the player sails and turns with the keyboard and stops at the wall of the arena | `e2e/match.spec.ts` |
| PL-02 the front cannon and a broadside fire while the ship moves | `e2e/match.spec.ts` |
| EN-08 both enemy types spawn at the configured interval | `e2e/match.spec.ts` |
| MT-08 pausing suspends the match and only an action of the player resumes it | `e2e/match.spec.ts` |
| MT-03 a match that ends shows its result, saves one record and survives a refresh | `e2e/match.spec.ts` |
| MSW-08 a record that cannot be saved stays pending and is saved after the API recovers | `e2e/match.spec.ts` |
| SC-14 leaving a match abandons it, and the touch controls steer the ship | `e2e/match.spec.ts` |

How these map to the twelve flows of the challenge, and what each flow still lacks, is in the table at the end of [requirements.md](requirements.md). There are no visual regression tests.

## Where the reports are

- CI uploads the Playwright HTML report and the traces of failed tests as the `playwright-report` artifact of each run, kept for 14 days.
- After a local run in the container, the HTML report is `playwright-report/index.html` and the traces are under `test-results/`.

## Failures seen

One CI run failed, at commit `a47aec5`: the test PL-02 counted 5 projectiles where it expected 4, on desktop. The frame loop was still advancing the match beside the test, and on a slow runner the cooldown of the front cannon elapsed between two calls of the test. Since commit `d4445ce` only the test advances a match opened with `?e2e=1`. The E2E tests were never run on the development machine, where Docker did not start; CI is the only place they have run.
