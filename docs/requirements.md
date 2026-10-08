# Requirements matrix

Every "must" in the challenge statement ([CHALLENGE.md](../CHALLENGE.md)), with an ID, where it is implemented, which test proves it and its status. The statement (Portuguese) is the authority; this file is the working index used by `docs/adr/` and by the implementation flow in `.claude/skills/implementation-flow/`. Section titles carry the statement section they come from, and "the README" in a requirement means the solution's own `README.md`.

- **Test:** T1 to T12 are the mandatory Playwright flows (statement section 8, listed at the end); U is a unit test of the simulation; Doc is verified by documentation or a report.
- **Status:** Pending → In progress → Done → Tested. Tested means its test passes in CI.
- **Where:** `src/game/sim` (pure rules), `src/game/render` (PixiJS), `src/game/input`, `src/game/config`, `src/ui` (React), `src/api` (Axios + TanStack Query), `src/mocks` (MSW), `src/storage`, `e2e/`.

## Player (Challenge 2)

| ID | Requirement | Where | Test | Status |
| --- | --- | --- | --- | --- |
| PL-01 | Move forward and rotate both ways, with speeds from the config | `sim/systems/movement` | T3, U | In progress |
| PL-02 | Front cannon fires one projectile | `sim/systems/weapons` | T4, U | In progress |
| PL-03 | Broadside fires three parallel projectiles, with separate left and right commands | `sim/systems/weapons` | T4, U | In progress |
| PL-04 | Limited health, reduced by enemy projectiles and by Chaser impact | `sim/systems/collision/chaserImpacts`, `sim/systems/damage` | T4, T5, U | In progress |
| PL-05 | Movement restricted to the visible arena | `sim/systems/collision` | T3, U | In progress |
| PL-06 | Cannot cross islands | `sim/systems/collision` | T3, U | In progress |
| PL-07 | Keyboard controls for movement, rotation and attacks | `input/keyboard` | T3, T4 | Pending |
| PL-08 | Touch controls for the same commands | `input/touch`, `ui/TouchControls` | T9 | Pending |
| PL-09 | Move and fire at the same time | `input` (per-step command state), `sim/systems/playerIntent` | T4, U | In progress |
| PL-10 | Controls shown in the interface (menu and match) | `ui/ControlsHelp` | T1 | Pending |

## Enemies and spawning (Challenge 2)

| ID | Requirement | Where | Test | Status |
| --- | --- | --- | --- | --- |
| EN-01 | Chaser pursues the player | `sim/ai/pursuit`, `sim/systems/enemyIntent` | T5, U | In progress |
| EN-02 | Chaser damages the player on contact and explodes on impact | `sim/systems/collision/chaserImpacts`, `sim/systems/damage` | T5, U | In progress |
| EN-03 | A Chaser destroying itself on the player scores no point | `sim/systems/damage` | T4, T5, U | In progress |
| EN-04 | Shooter approaches and fires only within the configured attack range | `sim/ai/shooter` | T5 | Pending |
| EN-05 | Enemies move and rotate with limited turn speed | `sim/systems/enemyIntent`, `sim/systems/movement` | T5, U | In progress |
| EN-06 | Enemies take damage and have their own health | `sim/systems/damage` | T4, U | In progress |
| EN-07 | Enemies respect island collision and steer around islands | `sim/ai/steering`, `sim/systems/collision` | T5 | Pending |
| EN-08 | Both enemy types appear in a default match (mix in the config) | `sim/systems/spawner`, `config` | T5 | Pending |
| EN-09 | Spawn at the configured interval until the match ends | `sim/systems/spawner` | T5 | Pending |
| EN-10 | Spawn point free of obstacles | `sim/systems/spawner` | T5, U | Pending |
| EN-11 | Spawn point away from the player (minimum distance in the config) | `sim/systems/spawner` | T5, U | Pending |

## Arena, collisions and combat (Challenge 2)

| ID | Requirement | Where | Test | Status |
| --- | --- | --- | --- | --- |
| CB-01 | Arena with water and at least one island | `config/gameConfig.ts`, `sim/collision`, `render/arena` | T3, U, visual | In progress |
| CB-02 | Islands block ships and projectiles | `sim/systems/collision` | T3, T4, U | In progress |
| CB-03 | Projectiles follow configured direction, speed, damage and range or lifetime | `sim/systems/projectiles`, `sim/systems/weapons` | T4, U | In progress |
| CB-04 | Player shots hit only enemies; enemy shots hit only the player | `sim/collision/layers`, `sim/systems/collision` | T4, T5, U | In progress |
| CB-05 | Each projectile applies damage only once | `sim/systems/collision` (hits), `sim/systems/damage` | T4, U | In progress |
| CB-06 | Projectile removed on hit, on expiry or when leaving the arena | `sim/systems/projectiles`, `sim/systems/collision` | T4, U | In progress |
| CB-07 | Each weapon respects its own cooldown | `sim/systems/weapons` | T4, U | In progress |
| CB-08 | A destroyed enemy stops damaging, firing and colliding in the same step: it is inactive from the end of the step that destroys it | `sim/systems/damage` | T4, T5, U | In progress |

## Match rules, HUD and pause (Challenge 2)

| ID | Requirement | Where | Test | Status |
| --- | --- | --- | --- | --- |
| MT-01 | Configurable duration between 60 and 180 s of active play | `config`, `sim/clock` | T1, T6 | Pending |
| MT-02 | Each enemy destroyed by the player is worth 1 point | `sim/systems/damage` | T4, U | In progress |
| MT-03 | Match ends when time runs out or health reaches zero, with the reason recorded | `sim/match` | T6 | Pending |
| MT-04 | Ending stops movement, attacks, damage, spawns and scoring | `sim/match` | T6 | Pending |
| MT-05 | Restart creates a fresh match: health, score, timer and entities reset | `sim/createMatch` | T6, U | In progress |
| MT-06 | Health shown above the player and every enemy | `render/healthBars` | T4, visual | Pending |
| MT-07 | HUD with score and remaining time | `ui/Hud` | T4, T6 | Pending |
| MT-08 | Manual pause | `input`, `sim/match` | T7 | Pending |
| MT-09 | Automatic pause on `blur` and on hidden tab (`visibilitychange`) | `game/lifecycle` | T7 | Pending |
| MT-10 | While paused, timer, cooldowns and simulation are suspended | `sim/clock` | T7 | Pending |
| MT-11 | Resuming requires a player action | `ui/PauseDialog` | T7 | Pending |
| MT-12 | Resuming does not apply movement or shots from the paused period | `input`, game loop | T7, U | In progress |

## Animation and feedback (Challenge 2)

| ID | Requirement | Where | Test | Status |
| --- | --- | --- | --- | --- |
| FX-01 | Visual effect when firing | `render/fx`, `sim/events` (the shot event) | visual, U | In progress |
| FX-02 | Explosion on destruction | `render/fx`, `sim/events` (the destroyed event) | T5, U | In progress |
| FX-03 | Ships show damage states by health band | `render/ships` | T4, visual | Pending |
| FX-04 | Noticeable feedback for attacks, impacts and damage taken | `render/fx`, `sim/events` (the hit event, for shots and for a Chaser's impact) | T4, U | In progress |
| FX-05 | Effects are short and do not hide ships or projectiles | `render` | manual | Pending |
| FX-06 | Extra: firing, explosion and ambient sounds with a mute control | `audio` | manual | Pending |

## Screens, configuration and local persistence (Challenge 3)

| ID | Requirement | Where | Test | Status |
| --- | --- | --- | --- | --- |
| SC-01 | Menu with Play, Options, control instructions and the Ranking and Match History tabs | `ui/screens/MainMenu` | T1, T10 | Pending |
| SC-02 | Options with Game session time and Enemy spawn time, validated | `ui/screens/Options` | T1 | Pending |
| SC-03 | Options saved and kept after refresh | `storage/settings` | T1 | Pending |
| SC-04 | Positive spawn interval with limits documented in the README | `config/schema` | T1, Doc | Pending |
| SC-05 | Match screen with arena, HUD, controls and pause | `ui/screens/Match` | T3 | Pending |
| SC-06 | Result screen with score, time played, reason, submission status, Play Again and Main Menu | `ui/screens/Result` | T8, T11 | Pending |
| SC-07 | Last finished match result kept after refresh | `storage/lastResult` | T8 | Pending |
| SC-08 | Ranking with position, player, score and pagination | `ui/tabs/RankingTab` | T10 | Pending |
| SC-09 | Match History with date, score, duration, reason and pagination | `ui/tabs/HistoryTab` | T10 | Pending |
| SC-10 | All gameplay parameters in one typed config | `config/gameConfig.ts` | U, Doc | In progress |
| SC-11 | Balancing changes only the config, never system logic | `config` | Doc | Pending |
| SC-12 | Config snapshot taken at match start; changes apply to the next match only | `sim/createMatch` | T1, U | In progress |
| SC-13 | Refresh or leaving the combat screen ends the running match | `game/lifecycle` | T9 | Pending |
| SC-14 | An abandoned match is not recorded in ranking or history | `api/outbox` | T9 | Pending |
| SC-15 | Interface, code identifiers and documentation in English | whole project | review | Pending |
| SC-16 | Menu visual identity consistent with the assets | `ui/theme` | visual | Pending |

## PixiJS and architecture (Challenge 4)

| ID | Requirement | Where | Test | Status |
| --- | --- | --- | --- | --- |
| AR-01 | PixiJS for arena, ships, projectiles, effects and bars; React for menus, forms, panels and dialogs | `render`, `ui` | review | Pending |
| AR-02 | Rules, rendering, input and UI state separated | `sim`, `render`, `input`, `ui`, `eslint.config.js` | lint, Doc | In progress |
| AR-03 | Movement, damage and spawns independent of frame rate | `game/loop` | T3, U | In progress |
| AR-04 | UI kept in sync without a React render per frame | `ui/store` | React Profiler, Doc | Pending |
| AR-05 | Textures loaded once and reused | `render/assets` | T2 | Pending |
| AR-06 | Loading failure handled before combat, with retry | `ui/screens/Loading` | T2 | Pending |
| AR-07 | Canvas fits screen and DPR, keeping proportion, input coordinates and arena limits | `render/viewport` | T9, visual mobile | Pending |
| AR-08 | Listeners, ticker, timers, entities and resources released on exit or restart | `GameApp.destroy()` | T9, PF-03 | Pending |
| AR-09 | Correct mount and unmount with React Strict Mode | `ui/GameCanvas` | T9 | Pending |
| AR-10 | Continuous combat state lives in the simulation, not in React | `sim` | Doc | Pending |
| AR-11 | Movement, combat, collision and AI written by the candidate, no physics engine | `sim` | Doc | Pending |
| AR-12 | `ARCHITECTURE.md` with the main decisions | repository root | Doc | Pending |

## Ranking and history (Challenge 5)

| ID | Requirement | Where | Test | Status |
| --- | --- | --- | --- | --- |
| API-01 | Typed contracts for ranking and history, shared with MSW | `api/contracts.ts` | Doc | Pending |
| API-02 | Ranking paginated and ordered by score | `api/ranking` | T10 | Pending |
| API-03 | History: record finished matches and query the player's paginated history | `api/history` | T10, T11 | Pending |
| API-04 | Record with match id, player id, date, score, effective duration, reason and config | `api/contracts.ts` | T11 | Pending |
| API-05 | Ranking compares only matches with the same config (`configKey`) | `mocks/handlers`, `ui/tabs/RankingTab` | T10 | Pending |
| API-06 | Deterministic tie-break | `mocks/handlers` | T10, U | Pending |
| API-07 | Other players represented by fixtures | `mocks/fixtures` | T10 | Pending |
| API-08 | Axios for HTTP and TanStack Query for queries and submission | `api` | review | Pending |
| API-09 | Loading, empty, error and background refresh states | `ui/tabs` | T10 | Pending |
| API-10 | Cache, invalidation and retries configured | `api/queryClient` | T10, T12 | Pending |
| API-11 | Both tabs refresh after a submission and when shown again | `api` | T11 | Pending |
| API-12 | A late response never overwrites newer data | `api` | T12 | Pending |
| API-13 | One match produces one history record and one ranking entry | `mocks/handlers` | T11, T12 | Pending |
| API-14 | Resubmissions and repeated clicks recover the existing record | `api/outbox` | T12 | Pending |
| API-15 | Pending submissions kept after failure or refresh, with retry | `api/outbox`, `storage` | T11 | Pending |
| API-16 | A new match can start while a submission is pending | `api/outbox` | T11 | Pending |
| API-17 | API failures never block gameplay, settings or combat | `ui` | T10, T12 | Pending |

## MSW and network scenarios (Challenge 6)

| ID | Requirement | Where | Test | Status |
| --- | --- | --- | --- | --- |
| MSW-01 | Network-level mocks with contracts, fixtures and handlers shared by dev, tests and demo | `mocks/` | review | Pending |
| MSW-02 | Confirmed records appear in later queries, consistent across both tabs | `mocks/db` | T11 | Pending |
| MSW-03 | Success, empty list and multiple pages scenarios | `mocks/scenarios` | T10 | Pending |
| MSW-04 | Slowness, variable latency and out-of-order responses | `mocks/scenarios` | T12 | Pending |
| MSW-05 | Timeout, connection failure and 4xx/5xx responses | `mocks/scenarios` | T10, T12 | Pending |
| MSW-06 | Failure when querying ranking or history | `mocks/scenarios` | T10 | Pending |
| MSW-07 | Timeout after the mock saved, recovered without duplication | `mocks/scenarios` | T12 | Pending |
| MSW-08 | API unavailable at match end, submission after recovery | `mocks/scenarios` | T11 | Pending |
| MSW-09 | A way to select a scenario and restore the initial state | `ui/DevPanel`, query param | T10 to T12, README | Pending |
| MSW-10 | Randomness and latency controlled in tests | `mocks/rng` | T10 to T12 | Pending |
| MSW-11 | Mocks working in the published build | `main.tsx`, `e2e/smoke.spec.ts` | post-deploy smoke | In progress |
| MSW-12 | Confirmed records and pending submissions kept after refresh | `mocks/db` | T11 | Pending |

## Interface, assets and accessibility (Challenge 7)

| ID | Requirement | Where | Test | Status |
| --- | --- | --- | --- | --- |
| UX-01 | Provided assets used as the visual base | `render`, `ui` | visual | Pending |
| UX-02 | Conversions and optimisations with sources and licences included | `assets/`, `LICENSES.md` | Doc | Pending |
| UX-03 | Desktop and mobile, with usable touch and no clipping of arena or HUD | `ui`, `render/viewport` | T9, visual mobile | Pending |
| UX-04 | Defined mobile orientation (landscape, with a portrait notice) | `ui/RotateNotice` | T9 | Pending |
| UX-05 | Layout adapts to resize without changing match rules | `render/viewport` | T9 | Pending |
| UX-06 | Visible progress or state while assets load | `ui/screens/Loading` | T2 | Pending |
| UX-07 | Keyboard navigation in menus with visible focus | `ui` | T1, axe | Pending |
| UX-08 | Focus management in dialogs (trap and return) | `ui/Dialog` | T7 | Pending |
| UX-09 | Labels, adequate contrast and accessible error messages | `ui` | T1, axe | Pending |
| UX-10 | Score, time and state in semantic markup, without per-frame announcements | `ui/LiveRegion` | T4, T7 | Pending |
| UX-11 | Game keys captured only while gameplay is active | `input/keyboard` | T1, T9 | Pending |
| UX-12 | No unhandled console errors in the expected flows | whole app, `e2e/fixtures.ts` | Playwright fails on `console.error` | In progress |

## Playwright (Challenge 8)

| ID | Requirement | Where | Status |
| --- | --- | --- | --- |
| PW-01 | Main flows in Chromium, desktop and mobile | `playwright.config.ts` | In progress |
| PW-02 | Visual regression of menu, stable arena and result screen, with versioned baselines | `e2e/visual` | Pending |
| PW-03 | Seeded scenarios and controlled simulation time | `page.clock`, `window.__game`, `sim` (seed, PRNG, sine table, replay) | In progress |
| PW-04 | Instrumentation observes state without skipping rules, inputs, collisions or rendering | `game/testHooks` | Pending |
| PW-05 | Combat tests use the real controls and check their effects | `e2e/combat` | Pending |
| PW-06 | Each test starts from an isolated state | base fixture | Pending |
| PW-07 | HTML report and traces of failures | `playwright.config.ts` | In progress |

| Flow | Covers | Status |
| --- | --- | --- |
| T1 Options navigation, validation and persistence | SC-01 to SC-04, SC-12, UX-07, UX-09, UX-11 | Pending |
| T2 Asset loading, failures and retry | AR-05, AR-06, UX-06 | Pending |
| T3 Match start, movement, rotation, arena limits and island collision | PL-01, PL-05 to PL-07, CB-01, CB-02, AR-03 | Pending |
| T4 Front and broadside fire, damage, cooldown and scoring without duplication | PL-02 to PL-04, PL-09, CB-03 to CB-08, MT-02, MT-06, MT-07 | Pending |
| T5 Chaser and Shooter behaviour and spawn interval | EN-01 to EN-11, FX-02 | Pending |
| T6 End by time and by death, stopped simulation and clean restart | MT-01, MT-03 to MT-05 | Pending |
| T7 Pause, focus loss and resume without timer drift | MT-08 to MT-12, UX-08 | Pending |
| T8 Result display and persistence after refresh | SC-06, SC-07 | Pending |
| T9 Abandoning, repeated navigation and touch controls | PL-08, SC-13, SC-14, AR-07 to AR-09, UX-03 to UX-05 | Pending |
| T10 Ranking and Match History: pagination, loading, empty and error | API-02, API-05 to API-07, API-09, API-10, API-17, MSW-03, MSW-05, MSW-06 | Pending |
| T11 Submission, both tabs refreshed and pending submission after refresh | API-03, API-04, API-11, API-13, API-15, API-16, MSW-02, MSW-08, MSW-12 | Pending |
| T12 Resubmission after timeout without duplication and late responses | API-12 to API-14, MSW-04, MSW-07 | Pending |

## Performance (Challenge 9)

| ID | Requirement | Where | Evidence | Status |
| --- | --- | --- | --- | --- |
| PF-01 | Combat measured in an optimised build, 60 FPS target on a documented reference machine | `vite build` + `preview` | report | Pending |
| PF-02 | FPS, p95 frame time and entity count over a three-minute match | `game/debug/metrics`, `e2e/perf` | report + JSON | Pending |
| PF-03 | Memory after five start, play and exit cycles, investigating continuous growth | `e2e/perf` | heap chart | Pending |
| PF-04 | Hardware, browser, resolution, match config and observed limitations | `docs/PERFORMANCE.md` | Doc | Pending |

## Delivery (Challenge 11)

| ID | Requirement | Where | Status |
| --- | --- | --- | --- |
| DL-00 | Time estimate sent before starting | email to the recruiter | Done |
| DL-01 | Repository with source, lockfile, assets, mocks, fixtures and tests | repository | In progress |
| DL-02 | Public, working deploy matching the delivered code, with mocks active on open and reload | Vercel, `vercel.json` | In progress |
| DL-03 | README with setup, environment variables, controls, gameplay config, scenario selection and reset, commands and how to reproduce failures | `README.md` | In progress |
| DL-04 | Commands for dev, build, preview, lint, typecheck and Playwright | `package.json`, `compose.yaml` | In progress |
| DL-05 | ARCHITECTURE covering React/PixiJS integration, simulation loop, collisions, resources, local persistence, ranking and history (contracts, cache, pending records), limitations and balancing | `ARCHITECTURE.md` | Pending |
| DL-06 | Test and profiling reports included | `reports/`, CI artifacts | Pending |
| DL-07 | Runs from a clean checkout without private services | `compose.yaml`, `.github/workflows/ci.yml` | In progress |
| DL-08 | Every mandatory technology genuinely used (React, TS strict, PixiJS, TanStack Query, Axios, MSW, Playwright) | final review | Pending |
