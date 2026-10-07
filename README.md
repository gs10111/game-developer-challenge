# Pirate Battle

A top-down 2D naval shooter built with React, TypeScript and PixiJS for the Jungle Gaming game developer challenge. The original statement, in Portuguese, is in [CHALLENGE.md](CHALLENGE.md).

The project is built in small slices. [docs/requirements.md](docs/requirements.md) lists every requirement with its status, and [docs/adr/](docs/adr/README.md) records the architecture decisions. At this stage the app is a placeholder screen that proves the toolchain end to end, including the mock API in the production build.

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

There is no backend. [MSW](https://mswjs.io/) answers the API calls from a service worker that starts before the first render in every build, the published one included ([ADR-0012](docs/adr/0012-msw-in-production-build.md)). Today it serves one example endpoint, `GET /api/health`. The ranking and match history endpoints and the selectable network scenarios are not implemented yet.

## Deploy

`vercel.json` builds the project with pnpm and rewrites every route to `index.html`.
