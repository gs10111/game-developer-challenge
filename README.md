# Pirate Battle

A top-down 2D naval shooter built with React, TypeScript and PixiJS for the Jungle Gaming game developer challenge. The original statement, in Portuguese, is in [CHALLENGE.md](CHALLENGE.md).

**Play it at https://game-developer-challenge-nine.vercel.app.**

The game is playable: a match against Chasers and Shooters among islands, with keyboard and touch controls, pause, a result screen, a ranking and a match history served by a mock API.

[docs/README.md](docs/README.md) says what is built and what is not. [docs/requirements.md](docs/requirements.md) lists every requirement with its status, [docs/adr/](docs/adr/README.md) records the architecture decisions, and [ARCHITECTURE.md](ARCHITECTURE.md) describes the system as built.

## Play

| Action | Keyboard | Touch |
| --- | --- | --- |
| Sail forward | W or Up | ▲ |
| Turn | A / D or Left / Right | ↺ ↻ |
| Front cannon | Space | ● |
| Left and right broadsides | Q / E | ◀ ▶ |
| Pause | P or Esc | Pause button |

A match lasts the configured session time or until the ship is destroyed. Each enemy sunk by the player is worth one point; a Chaser that blows itself up on the player is worth none. The match pauses by itself when the window loses focus or the tab is hidden, and only the player resumes it.

The **Options** tab sets the game session time, from 60 to 180 whole seconds, and the enemy spawn time, from 0.5 to 10 seconds. Both are validated, saved in the browser and applied to the next match. Every other gameplay value lives in the typed config, `src/game/config/gameConfig.ts`.

On a phone the game is meant to be played in landscape; the arena keeps its 16:9 shape and always fits the screen.

## Requirements

| To | You need |
| --- | --- |
| Develop | Node 24 (see `.nvmrc`) and pnpm 10 (pinned in `packageManager`) |
| Run the E2E tests | Docker Engine with the Compose plugin, or Docker Desktop |
| Run every check without Node | Git and Docker only |

## Run it

```bash
pnpm install
pnpm dev
```

The dev server listens on http://localhost:5173.

Without Node, build and serve the production bundle from the container:

```bash
docker compose up preview
```

It listens on http://localhost:4173.

Always open the app at `http://localhost`. The mock API is a service worker, and browsers register service workers only on a secure origin: `localhost` counts, an address on the local network does not.

## Commands

| Task | Native | Container |
| --- | --- | --- |
| Dev server with HMR | `pnpm dev` | not available |
| Production build | `pnpm build` | `docker compose run --rm app pnpm build` |
| Serve the production build | `pnpm preview` | `docker compose up preview` |
| Lint | `pnpm lint` | `docker compose run --rm app pnpm lint` |
| Typecheck | `pnpm typecheck` | `docker compose run --rm app pnpm typecheck` |
| Unit tests | `pnpm test` | `docker compose run --rm app pnpm test` |
| E2E tests | not supported | `docker compose run --rm app pnpm test:e2e` |
| Update visual baselines | not supported | `docker compose run --rm app pnpm test:e2e --update-snapshots` |

The container installs the dependencies on its first command and keeps them in a named volume, so nothing has to be installed on the host.

### E2E tests

Playwright builds the app, serves the production bundle on port 4173 and tests it in Chromium, in a desktop and a mobile project. The tests run only in the container: it is the image CI uses, and screenshots taken on another operating system do not match the baselines ([ADR-0017](docs/adr/0017-containerized-environment.md)).

After a run, open `playwright-report/index.html` for the HTML report. Traces of failed tests are in `test-results/`.

### Linux hosts

The container runs as user id 1000 so that the files it writes belong to you. If your user id is different, export it first:

```bash
export HOST_UID=$(id -u) HOST_GID=$(id -g)
```

## Environment variables

The app itself reads none. The tooling reads these:

| Variable | Read by | Effect |
| --- | --- | --- |
| `HOST_UID`, `HOST_GID` | `compose.yaml` | User and group the container runs as. Default: 1000. |
| `CI` | `playwright.config.ts` | Rejects `test.only` and never reuses a server that is already running. |

## Mock API

There is no backend. [MSW](https://mswjs.io/) answers the API calls from a service worker that starts before the first render in every build, the published one included ([ADR-0012](docs/adr/0012-msw-in-production-build.md)). Confirmed records and pending submissions are kept in the browser, so they survive a refresh.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/ranking?sessionSeconds&spawnSeconds&page&pageSize` | Ranking of the matches played with the same settings, by score; ties go to the earlier match, then to the match id |
| `GET /api/players/{playerId}/matches?page&pageSize` | Match history of one player, newest first |
| `PUT /api/matches/{matchId}` | Registers a finished match. Sending the same match again returns the stored record, so retries never duplicate it ([ADR-0013](docs/adr/0013-match-submission-outbox.md)) |

The contracts are Zod schemas in `src/api/contracts.ts`, shared by the client and the handlers. Other players are fixtures.

The **Mock API scenarios** panel at the bottom of the menu selects how the mock behaves, and restores the initial data. A scenario can also be chosen in the address, as in `/?scenario=slow`.

| Scenario | Behaviour |
| --- | --- |
| `success` | Answers after 150 ms |
| `empty` | Lists come back empty |
| `slow` | Answers after 2.5 s |
| `jitter` | A fixed cycle of latencies (1200, 80, 700 and 40 ms), so answers arrive out of order |
| `server-error`, `client-error` | HTTP 500 or 400 on every request |
| `network-error` | The connection fails |
| `timeout` | No answer; the client gives up after 6 s |
| `reads-fail` | Ranking and history answer 503; saving works |
| `timeout-after-save` | The match is stored but the first answer never arrives; the retry gets the stored record |
| `save-unavailable` | Saving answers 503; the record stays pending and is sent again after recovery or a refresh |

Latencies are fixed numbers, never random, so tests are reproducible.

When the service worker cannot answer, because the browser blocks service workers or the host puts something in front of the worker script, the app notices at start-up that `GET /api/health` did not come back from the mock and routes its Axios calls to the same handlers inside the page. Contracts, fixtures, scenarios and stored records are the same; the panel says which of the two is answering. `/?mock=in-page` forces this mode.

## Tests

- Unit tests (Vitest) cover the simulation: movement, weapons, collisions, damage, both enemy types, the spawner, the match rules and replays from a seed.
- E2E tests (Playwright, desktop and mobile Chromium) drive the real controls against the production build. With `?e2e=1` the page exposes `window.pirateBattle`, which reads the state of the match and advances the simulation by whole steps; the rules, inputs, collisions and rendering are the real ones.

## Performance

Opening the game with `?perf=1` runs a match with a fixed pilot and records the time between frames, the live entities and the heap. [docs/performance.md](docs/performance.md) describes the method and holds the report.

## Assets

The sprites in `public/assets` are copied from the `assets/` folder supplied with the challenge (ships, cannon ball, explosion, fire, sand and water tiles, the title and the menu background).

## Known limitations

- Enemies head straight for the player and slide along a shore in their way; they do not plan a route around islands.
- There is no sound and no visual regression baseline yet.
- The performance report holds one measured run of two minutes (59.9 frames per second on average); the three-minute run, the memory check over five cycles and the hardware of the machine are still missing.
- The E2E tests cover the main flows, not every case listed in the challenge.
## Deploy

The game is published at https://game-developer-challenge-nine.vercel.app, from the `main` branch, on Vercel. `vercel.json` builds the project with pnpm and rewrites every route to `index.html`. The mock API is part of the build, so the published site needs no backend.

Addresses of single deployments, with a hash in the name, ask for a Vercel login; the address above does not.
