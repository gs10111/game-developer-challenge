# Requirements matrix

Every "must" in the challenge statement ([CHALLENGE.md](../CHALLENGE.md)), with an ID, where it is implemented, which test proves it and its status. The statement (Portuguese) is the authority; this file is the working index used by `docs/adr/` and by the implementation flow in `.claude/skills/implementation-flow/`. Section titles carry the statement section they come from, and "the README" in a requirement means the solution's own `README.md`.

- **Test:** T1 to T12 are the mandatory Playwright flows (statement section 8, listed at the end); U is a unit test of the simulation; Doc is verified by documentation or a report.
- **Status:** Pending → In progress → Done → Tested. Done means built and working; In progress means partly built, and the gap is listed in [README.md](README.md); Pending means not built. No row is marked Tested yet: the table of the twelve E2E flows at the end says how far each flow is covered.
- **Where:** `src/game/sim` (pure rules), `src/game/render` (PixiJS), `src/game/input`, `src/game/config`, `src/ui` (React), `src/api` (Axios + TanStack Query), `src/mocks` (MSW), `src/storage`, `e2e/`.

## Player (Challenge 2)

| ID | Requirement | Where | Test | Status |
| --- | --- | --- | --- | --- |
| PL-01 | Move forward and rotate both ways, with speeds from the config | `sim/systems/movement` | T3, U | Done |
| PL-02 | Front cannon fires one projectile | `sim/systems/weapons` | T4, U | Done |
| PL-03 | Broadside fires three parallel projectiles, with separate left and right commands | `sim/systems/weapons` | T4, U | Done |
| PL-04 | Limited health, reduced by enemy projectiles and by Chaser impact | `sim/systems/collision/chaserImpacts`, `sim/systems/damage` | T4, T5, U | Done |
| PL-05 | Movement restricted to the visible arena | `sim/systems/collision` | T3, U | Done |
| PL-06 | Cannot cross islands | `sim/systems/collision` | T3, U | Done |
| PL-07 | Keyboard controls for movement, rotation and attacks | `input/keyboard` | T3, T4 | Done |
| PL-08 | Touch controls for the same commands | `input/commandState`, `ui/MatchScreen` | T9 | Done |
| PL-09 | Move and fire at the same time | `input` (per-step command state), `sim/systems/playerIntent` | T4, U | Done |
| PL-10 | Controls shown in the interface (menu and match) | `ui/MainMenu` | T1 | Done |

## Enemies and spawning (Challenge 2)

| ID | Requirement | Where | Test | Status |
| --- | --- | --- | --- | --- |
| EN-01 | Chaser pursues the player | `sim/ai/pursuit`, `sim/systems/enemyIntent` | T5, U | Done |
| EN-02 | Chaser damages the player on contact and explodes on impact | `sim/systems/collision/chaserImpacts`, `sim/systems/damage` | T5, U | Done |
| EN-03 | A Chaser destroying itself on the player scores no point | `sim/systems/damage` | T4, T5, U | Done |
| EN-04 | Shooter approaches and fires only within the configured attack range | `sim/systems/enemyIntent`, `sim/spawnEnemy` | T5, U | Done |
| EN-05 | Enemies move and rotate with limited turn speed | `sim/systems/enemyIntent`, `sim/systems/movement` | T5, U | Done |
| EN-06 | Enemies take damage and have their own health | `sim/systems/damage` | T4, U | Done |
| EN-07 | Enemies respect island collision and steer around islands | `sim/ai/steering`, `sim/systems/collision` | T5 | In progress |
| EN-08 | Both enemy types appear in a default match (mix in the config) | `sim/spawner`, `config` | T5 | Done |
| EN-09 | Spawn at the configured interval until the match ends | `sim/spawner` | T5 | Done |
| EN-10 | Spawn point free of obstacles | `sim/spawner` | T5, U | Done |
| EN-11 | Spawn point away from the player (minimum distance in the config) | `sim/spawner` | T5, U | Done |

## Arena, collisions and combat (Challenge 2)

| ID | Requirement | Where | Test | Status |
| --- | --- | --- | --- | --- |
| CB-01 | Arena with water and at least one island | `config/gameConfig.ts`, `sim/collision`, `render/renderer` | T3, U, visual | Done |
| CB-02 | Islands block ships and projectiles | `sim/systems/collision` | T3, T4, U | Done |
| CB-03 | Projectiles follow configured direction, speed, damage and range or lifetime | `sim/systems/projectiles`, `sim/systems/weapons` | T4, U | Done |
| CB-04 | Player shots hit only enemies; enemy shots hit only the player | `sim/collision/layers`, `sim/systems/collision` | T4, T5, U | Done |
| CB-05 | Each projectile applies damage only once | `sim/systems/collision` (hits), `sim/systems/damage` | T4, U | Done |
| CB-06 | Projectile removed on hit, on expiry or when leaving the arena | `sim/systems/projectiles`, `sim/systems/collision` | T4, U | Done |
| CB-07 | Each weapon respects its own cooldown | `sim/systems/weapons` | T4, U | Done |
| CB-08 | A destroyed enemy stops damaging, firing and colliding in the same step: it is inactive from the end of the step that destroys it | `sim/systems/damage` | T4, T5, U | Done |

## Match rules, HUD and pause (Challenge 2)

| ID | Requirement | Where | Test | Status |
| --- | --- | --- | --- | --- |
| MT-01 | Configurable duration between 60 and 180 s of active play | `config`, `sim/match` | T1, T6 | Done |
| MT-02 | Each enemy destroyed by the player is worth 1 point | `sim/systems/damage` | T4, U | Done |
| MT-03 | Match ends when time runs out or health reaches zero, with the reason recorded | `sim/match` | T6 | Done |
| MT-04 | Ending stops movement, attacks, damage, spawns and scoring | `sim/match` | T6 | Done |
| MT-05 | Restart creates a fresh match: health, score, timer and entities reset | `sim/createMatch` | T6, U | Done |
| MT-06 | Health shown above the player and every enemy | `render/renderer` | T4, visual | Done |
| MT-07 | HUD with score and remaining time | `ui/MatchScreen` | T4, T6 | Done |
| MT-08 | Manual pause | `input`, `sim/match` | T7 | Done |
| MT-09 | Automatic pause on `blur` and on hidden tab (`visibilitychange`) | `game/runtime/session` | T7 | Done |
| MT-10 | While paused, timer, cooldowns and simulation are suspended | `sim/match` | T7 | Done |
| MT-11 | Resuming requires a player action | `ui/MatchScreen` | T7 | Done |
| MT-12 | Resuming does not apply movement or shots from the paused period | `input`, game loop | T7, U | Done |

## Animation and feedback (Challenge 2)

| ID | Requirement | Where | Test | Status |
| --- | --- | --- | --- | --- |
| FX-01 | Visual effect when firing | `render/renderer`, `sim/events` (the shot event) | visual, U | Done |
| FX-02 | Explosion on destruction | `render/renderer`, `sim/events` (the destroyed event) | T5, U | Done |
| FX-03 | Ships show damage states by health band | `render/renderer` | T4, visual | Done |
| FX-04 | Noticeable feedback for attacks, impacts and damage taken | `render/renderer`, `sim/events` (the hit event, for shots and for a Chaser's impact) | T4, U | Done |
| FX-05 | Effects are short and do not hide ships or projectiles | `render` | manual | Done |
| FX-06 | Extra: firing, explosion and ambient sounds with a mute control | `audio` | manual | Pending |

## Screens, configuration and local persistence (Challenge 3)

| ID | Requirement | Where | Test | Status |
| --- | --- | --- | --- | --- |
| SC-01 | Menu with Play, Options, control instructions and the Ranking and Match History tabs | `ui/MainMenu` | T1, T10 | Done |
| SC-02 | Options with Game session time and Enemy spawn time, validated | `ui/OptionsPanel` | T1 | Done |
| SC-03 | Options saved and kept after refresh | `storage/options` | T1 | Done |
| SC-04 | Positive spawn interval with limits documented in the README | `storage/options` | T1, Doc | Done |
| SC-05 | Match screen with arena, HUD, controls and pause | `ui/MatchScreen` | T3 | Done |
| SC-06 | Result screen with score, time played, reason, submission status, Play Again and Main Menu | `ui/MatchScreen` | T8, T11 | Done |
| SC-07 | Last finished match result kept after refresh | `api/outbox` | T8 | Done |
| SC-08 | Ranking with position, player, score and pagination | `ui/Leaderboards` | T10 | Done |
| SC-09 | Match History with date, score, duration, reason and pagination | `ui/Leaderboards` | T10 | Done |
| SC-10 | All gameplay parameters in one typed config | `config/gameConfig.ts` | U, Doc | Done |
| SC-11 | Balancing changes only the config, never system logic | `config` | Doc | Done |
| SC-12 | Config snapshot taken at match start; changes apply to the next match only | `sim/createMatch` | T1, U | Done |
| SC-13 | Refresh or leaving the combat screen ends the running match | `game/runtime/session` | T9 | Done |
| SC-14 | An abandoned match is not recorded in ranking or history | `api/outbox` | T9 | Done |
| SC-15 | Interface, code identifiers and documentation in English | whole project | review | Done |
| SC-16 | Menu visual identity consistent with the assets | `ui/styles.css` | visual | In progress |

## PixiJS and architecture (Challenge 4)

| ID | Requirement | Where | Test | Status |
| --- | --- | --- | --- | --- |
| AR-01 | PixiJS for arena, ships, projectiles, effects and bars; React for menus, forms, panels and dialogs | `render`, `ui` | review | Done |
| AR-02 | Rules, rendering, input and UI state separated | `sim`, `render`, `input`, `ui`, `eslint.config.js` | lint, Doc | Done |
| AR-03 | Movement, damage and spawns independent of frame rate | `game/loop/fixedStepClock` | T3, U | Done |
| AR-04 | UI kept in sync without a React render per frame | `game/runtime/session` | React Profiler, Doc | Done |
| AR-05 | Textures loaded once and reused | `render/textures` | T2 | Done |
| AR-06 | Loading failure handled before combat, with retry | `ui/MatchScreen` | T2 | Done |
| AR-07 | Canvas fits screen and DPR, keeping proportion, input coordinates and arena limits | `render/renderer` | T9, visual mobile | Done |
| AR-08 | Listeners, ticker, timers, entities and resources released on exit or restart | `game/runtime/session` | T9, PF-03 | Done |
| AR-09 | Correct mount and unmount with React Strict Mode | `ui/MatchScreen` | T9 | Done |
| AR-10 | Continuous combat state lives in the simulation, not in React | `sim` | Doc | Done |
| AR-11 | Movement, combat, collision and AI written by the candidate, no physics engine | `sim` | Doc | Done |
| AR-12 | `ARCHITECTURE.md` with the main decisions | repository root | Doc | Done |

## Ranking and history (Challenge 5)

| ID | Requirement | Where | Test | Status |
| --- | --- | --- | --- | --- |
| API-01 | Typed contracts for ranking and history, shared with MSW | `api/contracts.ts` | Doc | Done |
| API-02 | Ranking paginated and ordered by score | `api/matches` | T10 | Done |
| API-03 | History: record finished matches and query the player's paginated history | `api/matches` | T10, T11 | Done |
| API-04 | Record with match id, player id, date, score, effective duration, reason and config | `api/contracts.ts` | T11 | Done |
| API-05 | Ranking compares only matches with the same config (`configKey`) | `mocks/handlers`, `ui/Leaderboards` | T10 | Done |
| API-06 | Deterministic tie-break | `mocks/handlers` | T10, U | Done |
| API-07 | Other players represented by fixtures | `mocks/db` | T10 | Done |
| API-08 | Axios for HTTP and TanStack Query for queries and submission | `api` | review | Done |
| API-09 | Loading, empty, error and background refresh states | `ui/MainMenu` | T10 | Done |
| API-10 | Cache, invalidation and retries configured | `ui/App` | T10, T12 | Done |
| API-11 | Both tabs refresh after a submission and when shown again | `api` | T11 | Done |
| API-12 | A late response never overwrites newer data | `api` | T12 | In progress |
| API-13 | One match produces one history record and one ranking entry | `mocks/handlers` | T11, T12 | Done |
| API-14 | Resubmissions and repeated clicks recover the existing record | `api/outbox` | T12 | Done |
| API-15 | Pending submissions kept after failure or refresh, with retry | `api/outbox`, `storage` | T11 | Done |
| API-16 | A new match can start while a submission is pending | `api/outbox` | T11 | Done |
| API-17 | API failures never block gameplay, settings or combat | `ui` | T10, T12 | Done |

## MSW and network scenarios (Challenge 6)

| ID | Requirement | Where | Test | Status |
| --- | --- | --- | --- | --- |
| MSW-01 | Network-level mocks with contracts, fixtures and handlers shared by dev, tests and demo | `mocks/` | review | Done |
| MSW-02 | Confirmed records appear in later queries, consistent across both tabs | `mocks/db` | T11 | Done |
| MSW-03 | Success, empty list and multiple pages scenarios | `mocks/scenarios` | T10 | Done |
| MSW-04 | Slowness, variable latency and out-of-order responses | `mocks/scenarios` | T12 | Done |
| MSW-05 | Timeout, connection failure and 4xx/5xx responses | `mocks/scenarios` | T10, T12 | Done |
| MSW-06 | Failure when querying ranking or history | `mocks/scenarios` | T10 | Done |
| MSW-07 | Timeout after the mock saved, recovered without duplication | `mocks/scenarios` | T12 | Done |
| MSW-08 | API unavailable at match end, submission after recovery | `mocks/scenarios` | T11 | Done |
| MSW-09 | A way to select a scenario and restore the initial state | `ui/MockPanel`, query param | T10 to T12, README | Done |
| MSW-10 | Randomness and latency controlled in tests | `mocks/handlers` | T10 to T12 | Done |
| MSW-11 | Mocks working in the published build | `main.tsx`, `e2e/menu.spec.ts` | post-deploy smoke | Done |
| MSW-12 | Confirmed records and pending submissions kept after refresh | `mocks/db` | T11 | Done |

## Interface, assets and accessibility (Challenge 7)

| ID | Requirement | Where | Test | Status |
| --- | --- | --- | --- | --- |
| UX-01 | Provided assets used as the visual base | `render`, `ui` | visual | Done |
| UX-02 | Conversions and optimisations with sources and licences included | `assets/`, `LICENSES.md` | Doc | In progress |
| UX-03 | Desktop and mobile, with usable touch and no clipping of arena or HUD | `ui`, `render/renderer` | T9, visual mobile | Done |
| UX-04 | Defined mobile orientation (landscape, with a portrait notice) | `ui/MatchScreen` | T9 | Done |
| UX-05 | Layout adapts to resize without changing match rules | `render/renderer` | T9 | Done |
| UX-06 | Visible progress or state while assets load | `ui/MatchScreen` | T2 | Done |
| UX-07 | Keyboard navigation in menus with visible focus | `ui` | T1, axe | Done |
| UX-08 | Focus management in dialogs (trap and return) | `ui/Modal` | T7 | Done |
| UX-09 | Labels, adequate contrast and accessible error messages | `ui` | T1, axe | In progress |
| UX-10 | Score, time and state in semantic markup, without per-frame announcements | `ui/MatchScreen` | T4, T7 | Done |
| UX-11 | Game keys captured only while gameplay is active | `input/keyboard` | T1, T9 | Done |
| UX-12 | No unhandled console errors in the expected flows | whole app, `e2e/fixtures.ts` | Playwright fails on `console.error` | Done |

## Playwright (Challenge 8)

| ID | Requirement | Where | Status |
| --- | --- | --- | --- |
| PW-01 | Main flows in Chromium, desktop and mobile | `playwright.config.ts` | In progress |
| PW-02 | Visual regression of menu, stable arena and result screen, with versioned baselines | `e2e/visual` | Pending |
| PW-03 | Seeded scenarios and controlled simulation time | `game/runtime/session`, `window.pirateBattle`, `sim` (seed, PRNG, sine table, replay) | Done |
| PW-04 | Instrumentation observes state without skipping rules, inputs, collisions or rendering | `game/runtime/session` | Done |
| PW-05 | Combat tests use the real controls and check their effects | `e2e/match.spec.ts` | Done |
| PW-06 | Each test starts from an isolated state | base fixture | Done |
| PW-07 | HTML report and traces of failures | `playwright.config.ts` | Done |

| Flow | Covers | Status |
| --- | --- | --- |
| T1 Options navigation, validation and persistence | SC-01 to SC-04, SC-12, UX-07, UX-09, UX-11 | Done: `e2e/menu.spec.ts`, options |
| T2 Asset loading, failures and retry | AR-05, AR-06, UX-06 | Pending: the app shows the failure and a retry, but no test drives it |
| T3 Match start, movement, rotation, arena limits and island collision | PL-01, PL-05 to PL-07, CB-01, CB-02, AR-03 | In progress: sailing, turning and the wall in `e2e/match.spec.ts`; islands only in unit tests |
| T4 Front and broadside fire, damage, cooldown and scoring without duplication | PL-02 to PL-04, PL-09, CB-03 to CB-08, MT-02, MT-06, MT-07 | In progress: front cannon and broadside in `e2e/match.spec.ts`; damage, cooldown and score only in unit tests |
| T5 Chaser and Shooter behaviour and spawn interval | EN-01 to EN-11, FX-02 | In progress: spawn interval and both types in `e2e/match.spec.ts`; behaviours only in unit tests |
| T6 End by time and by death, stopped simulation and clean restart | MT-01, MT-03 to MT-05 | In progress: end by death and the stopped simulation in `e2e/match.spec.ts`; end by time and restart only in unit tests |
| T7 Pause, focus loss and resume without timer drift | MT-08 to MT-12, UX-08 | In progress: manual pause and resume in `e2e/match.spec.ts`; loss of focus not tested |
| T8 Result display and persistence after refresh | SC-06, SC-07 | Done: `e2e/match.spec.ts`, result and refresh |
| T9 Abandoning, repeated navigation and touch controls | PL-08, SC-13, SC-14, AR-07 to AR-09, UX-03 to UX-05 | In progress: abandoning and touch controls in `e2e/match.spec.ts`; repeated navigation not tested |
| T10 Ranking and Match History: pagination, loading, empty and error | API-02, API-05 to API-07, API-09, API-10, API-17, MSW-03, MSW-05, MSW-06 | In progress: ranking pages, empty and error in `e2e/menu.spec.ts`; loading state and history pages not tested |
| T11 Submission, both tabs refreshed and pending submission after refresh | API-03, API-04, API-11, API-13, API-15, API-16, MSW-02, MSW-08, MSW-12 | In progress: record saved, history and a pending record after a refresh in `e2e/match.spec.ts`; the ranking tab is not checked after a submission |
| T12 Resubmission after timeout without duplication and late responses | API-12 to API-14, MSW-04, MSW-07 | Pending: the scenarios exist (`timeout-after-save`, `jitter`), no test uses them |

## Performance (Challenge 9)

| ID | Requirement | Where | Evidence | Status |
| --- | --- | --- | --- | --- |
| PF-01 | Combat measured in an optimised build, 60 FPS target on a documented reference machine | `vite build` + `preview` | report | In progress |
| PF-02 | FPS, p95 frame time and entity count over a three-minute match | `game/runtime/perf`, `docs/performance.md` | report + JSON | In progress |
| PF-03 | Memory after five start, play and exit cycles, investigating continuous growth | `docs/performance.md` | heap chart | In progress |
| PF-04 | Hardware, browser, resolution, match config and observed limitations | `docs/performance.md` | Doc | In progress |

## Delivery (Challenge 11)

| ID | Requirement | Where | Status |
| --- | --- | --- | --- |
| DL-00 | Time estimate sent before starting | email to the recruiter | Done |
| DL-01 | Repository with source, lockfile, assets, mocks, fixtures and tests | repository | Done |
| DL-02 | Public, working deploy matching the delivered code, with mocks active on open and reload | Vercel, `vercel.json` | In progress |
| DL-03 | README with setup, environment variables, controls, gameplay config, scenario selection and reset, commands and how to reproduce failures | `README.md` | In progress |
| DL-04 | Commands for dev, build, preview, lint, typecheck and Playwright | `package.json`, `compose.yaml` | Done |
| DL-05 | ARCHITECTURE covering React/PixiJS integration, simulation loop, collisions, resources, local persistence, ranking and history (contracts, cache, pending records), limitations and balancing | `ARCHITECTURE.md` | Done |
| DL-06 | Test and profiling reports included | `docs/performance.md`, CI artifacts | In progress |
| DL-07 | Runs from a clean checkout without private services | `compose.yaml`, `.github/workflows/ci.yml` | Done |
| DL-08 | Every mandatory technology genuinely used (React, TS strict, PixiJS, TanStack Query, Axios, MSW, Playwright) | final review | Done |
