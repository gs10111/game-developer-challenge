# Standards

The code rules of Pirate Battle, in one place. Whoever implements follows them and the reviewer checks them. Every rule comes from an accepted ADR, a requirement or a project convention; when one seems to block the work, stop and report it instead of working around it.

## Code

| Prohibited | Do instead | Why |
| --- | --- | --- |
| Importing `pixi.js` or `react` in `src/game/sim` | Pure TypeScript systems | ADR-0001, ADR-0006 |
| `Math.random`, `Date.now` or `performance.now` in the simulation | Seeded PRNG and step counter | ADR-0005 |
| `Math.sin` or `Math.cos` on gameplay angles | Quantized rotation with the committed lookup table | ADR-0005 |
| `ticker.deltaMS` or variable time steps for gameplay | The fixed 60 Hz step with clamped accumulator | ADR-0004 |
| React state updated every frame | The throttled UI store | ADR-0003 |
| Allocating in the steady-state loop | Pools with `acquire` and `release` | ADR-0006 |
| Redrawing `Graphics` every frame | Scaled sprites, `BitmapText`, `ParticleContainer` | ADR-0008 |
| `app.destroy` with `texture: true` | `releaseGlobalResources: true`, keep the `Assets` cache | ADR-0002 |
| `page.route()` for API calls in tests | MSW scenarios selected through the app | ADR-0011 |
| Disabling MSW in production builds | Await `worker.start()` before rendering | ADR-0012 |
| Server-generated ids or fire-and-forget POST for match submission | Outbox plus `PUT /api/matches/{matchId}` | ADR-0013 |
| Zod parsing inside the simulation step | Zod only at the boundaries | ADR-0014 |
| Optimising without a written cost estimate | The average-case model of ADR-0015 | ADR-0015 |
| Rust or WebAssembly | TypeScript | ADR-0016 |
| Gameplay numbers hard-coded in a system | The typed config in `src/game/config` | SC-10, SC-11 |
| A dependency that no ADR names | Stop and ask for an ADR | Project convention |
| Portuguese in code, identifiers, interface text or documentation | English | SC-15 |
| Code comments, unless the user asks for them | Names that explain themselves | Project convention |

## Layers

| Layer | Rule | Why |
| --- | --- | --- |
| `src/game/sim` | Imports nothing from `pixi.js`, `react` or another layer, except the config type from `src/game/config` with `import type`. Systems are functions `(world, dt) => void`, run in the fixed order. | ADR-0001, ADR-0006 |
| `src/game/config` | Imports nothing. Its values reach the simulation as the argument of `createMatch`. | SC-10, SC-12 |
| `src/game/loop` | Pure timing that drives the simulation. May import from `src/game/sim`; the simulation never imports from it. | ADR-0004 |
| `src/game/render` | Reads `World` and the per-step event queue after the step. Values drawn in the canvas never come through the UI store. | ADR-0003, ADR-0006 |
| `src/ui` | Never holds a reference to `World`. Reaches the game only through `GameCanvas`, the `GameApp` methods, the event bus and the UI store. | ADR-0001, ADR-0003 |
| `src/api`, `src/mocks`, `src/storage` | The Axios client, the MSW handlers and the fixtures share one contract module. Zod runs here and nowhere else. | ADR-0014 |

## Tests

- The requirement ID goes in the test name, so `--grep` selects it and the report maps back to `docs/requirements.md`.
- Simulation rules are unit tests (Vitest) against `src/game/sim`, with a seeded match.
- Flows are Playwright specs of the matching T-flow: seeded scenario, the test seam, real keyboard or touch input, and time advanced with `step(n)` or the Playwright clock instead of wall-clock waits (ADR-0010).
- No `.skip`, `.todo` or `.only` to keep the suite green.

## Commands

| Check | Command | Runs |
| --- | --- | --- |
| Lint | `pnpm lint` | native |
| Types | `pnpm typecheck` | native |
| Unit tests | `pnpm test` | native |
| E2E of a slice | `docker compose run --rm app pnpm test:e2e --grep "<pattern>"` | container only (ADR-0017) |
| Update visual baselines | `docker compose run --rm app pnpm test:e2e --update-snapshots` | container only (ADR-0017) |

The `--grep` pattern is a regular expression over test names: one requirement ID, or several joined by a vertical bar, as in `--grep "PL-02|CB-05"`.

## Git

Nobody commits unless the user asks. Agents never commit and never run `git stash`, `reset`, `checkout`, `restore` or `clean`: a slice stays in the working tree, and reviews compare it with the base SHA.
