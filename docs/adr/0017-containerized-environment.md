# ADR-0017: Native development, containerized E2E and CI on the official Playwright image

- **Status:** Accepted
- **Date:** 2026-10-07
- **Deciders:** Gabriel da Silveira
- **Requirements:** DL-01, DL-04, DL-07, PW-02, PW-07

## Context

Screenshots differ between operating systems, so ADR-0010 requires visual baselines to come from the Playwright image that CI uses. A container is therefore part of the workflow; the open question is how much of the workflow moves into it.

A reviewer should be able to run the checks and the production build with only Git and Docker Engine with the Compose plugin (Docker Desktop on macOS and Windows). A containerized dev server adds little for a reviewer, needs file polling for HMR on Docker Desktop, and would slow down the verification loop of every slice.

Three host differences break a naive container setup: native binaries inside `node_modules` are platform-specific, file ownership on a Linux bind mount follows numeric user ids, and Git on Windows checks files out with CRLF line endings.

## Decision

Split of responsibilities:

- Native is the default path for the dev server, lint, typecheck and unit tests: `pnpm dev`, `pnpm lint`, `pnpm typecheck`, `pnpm test`.
- The container is the only supported path for E2E and visual baselines, and CI uses it for every check.
- Every check also runs in the container with `docker compose run --rm app pnpm <script>`, so a reviewer without Node can lint, typecheck, test and build. Only the HMR dev server is native-only.

Image:

- One image: `mcr.microsoft.com/playwright:v1.63.0-noble`. The tag always equals the exact `@playwright/test` version in `package.json`. CI builds and uses the same image.
- Node is the one the image ships (Node 24). `.nvmrc` records the exact version printed by `node --version` in the image, and `engines.node` pins the same major.
- pnpm 10 is pinned in `packageManager` (`pnpm@10.34.6`) and installed in the image with `npm install -g pnpm@10.34.6`. Corepack is not used.
- The image holds no project code and no dependencies. Its entrypoint runs `pnpm install --frozen-lockfile` before every command, so the dependency volume always matches the lockfile.
- A unit test fails when the image tag and `@playwright/test`, or the image's pnpm and `packageManager`, drift apart.

Dependencies:

- Dependency install scripts stay blocked, which is the pnpm 10 default. The allow-list is `onlyBuiltDependencies` in `pnpm-workspace.yaml`, where pnpm 10 documents it, and lists only the packages that `pnpm install` reports as needing a script. That is `msw` alone: its postinstall keeps `public/mockServiceWorker.js` in step with the installed version. Vite 8 builds on Rolldown and no longer depends on esbuild.

Compose:

- Two services share the image: `app` (one-off commands) and `preview` (`pnpm build`, then `pnpm preview --host`, on port 4173). There is no containerized dev server.
- The source tree is bind-mounted from the host. `node_modules` and the pnpm store live in named volumes and are never mounted from the host.
- Containers never run as root. Every service runs as `${HOST_UID:-1000}:${HOST_GID:-1000}`, and `HOME`, the pnpm store and `node_modules` are writable by any user id. Linux hosts whose user id is not 1000, GitHub runners included, export `HOST_UID` and `HOST_GID` first.
- The port is published on `127.0.0.1` only, and the app is always opened at `http://localhost`: the MSW service worker registers only in a secure context, which `localhost` is and a LAN address is not.
- Services set `init: true` and `ipc: host`, as Playwright recommends for Chromium.

Vite:

- Dev server on port 5173 and preview on port 4173, both with `strictPort`.
- The config sets no `host`, so native servers listen on loopback only. The `preview` service passes `--host` because a published port needs it.

Tests:

- Playwright starts its own server through `webServer` (`pnpm build`, then `pnpm preview` on port 4173) and always tests the production build.
- Visual baselines are created and updated only inside the container, with `docker compose run --rm app pnpm test:e2e --update-snapshots` (ADR-0010). The image sets an environment flag and visual comparisons are skipped without it, so a native run can neither create nor validate a baseline.
- CI builds the image and runs lint, typecheck, unit tests and E2E with the same `docker compose run --rm app` commands the README documents.

Repository files:

- `.dockerignore` lists `node_modules`, `dist`, `playwright-report`, `test-results` and `.git`.
- `.gitattributes` forces LF, so the entrypoint script and text fixtures checked out on Windows still run in the Linux container.

Outside the container:

- Performance profiling (ADR-0009) runs on the host, in Chrome with a real GPU: headless Chromium in the container renders in software.
- The Vercel deploy builds natively with pnpm.

## Options considered

| Option | Assessment |
| --- | --- |
| Everything in the container, dev server included | HMR needs file polling on Docker Desktop, every slice pays a slower lint, typecheck and unit loop for identical results, and a reviewer does not develop in the project. |
| No local container, baselines produced by a CI job | Nothing to install, but every visual change becomes a push and a wait. |
| `node_modules` bind-mounted from the host | Native binaries installed on macOS or Windows do not run on the container's Linux. |
| Dependencies baked into the image | Faster first command, but after a lockfile change the existing named volume shadows the image's `node_modules` and serves stale packages. |
| pnpm through Corepack | No longer distributed with Node from v25, and it downloads pnpm at run time. |
| Run as root (the image default) | Reports, snapshots and `dist` end up owned by root on Linux hosts. |
| Run as the image's `pwuser` | `pwuser` is created after the `ubuntu` user that `ubuntu:noble` ships with id 1000, so it gets id 1001 and cannot write to a bind mount owned by id 1000, the usual first user on Linux. To confirm with `id pwuser` in the image. |
| Entrypoint starts as root and drops to the bind mount's owner | No configuration on any host, but the container starts privileged and the entrypoint grows into something to audit. |
| **Native for the fast loop; one Playwright image for E2E, baselines and CI** | The container is used where the environment changes the result, and nowhere it only adds waiting. |

## Consequences

- Easier: the everyday loop stays native and fast; baselines never depend on a developer machine; CI runs the README commands verbatim; a reviewer needs only Docker to test, build and open the production build.
- Harder: lint, typecheck and unit tests can run in two environments. The container result is the one that counts, and CI enforces it.
- Harder: the first pull is large, because the image carries Chromium, Firefox and WebKit and only Chromium is used; every container command pays for an install check; upgrading Playwright changes `package.json` and the `Dockerfile` together.
- Revisit: if the image size dominates CI time, cache the image between runs before considering a second image. If WebGL output differs between runners, apply the ADR-0010 fallback of a software renderer for the visual project.

## Sources

- [Playwright: Docker](https://playwright.dev/docs/docker) — pin the image to the Playwright version or the browsers are not found; the image runs as root by default; `--ipc=host` and `--init` are recommended for Chromium (official).
- [Playwright `Dockerfile.noble` at v1.63.0](https://github.com/microsoft/playwright/blob/v1.63.0/utils/docker/Dockerfile.noble) — the image is `ubuntu:noble` with `NODE_VERSION=24` and `adduser pwuser` (official source).
- [emsdk: update Docker image to Ubuntu Noble](https://skia.googlesource.com/external/github.com/emscripten-core/emsdk/+/8c687bcf28e2aedfedc06df3423262b4a912f306%5E%21/) — the `ubuntu:noble` base image already contains a non-root `ubuntu` user with id 1000 (open-source project, mirror).
- [pnpm 10: Settings](https://pnpm.io/10.x/settings) — since v10 dependency lifecycle scripts do not run unless listed in `onlyBuiltDependencies`; settings are read from `pnpm-workspace.yaml`; `managePackageManagerVersions` follows the `packageManager` field (official).
- [Node.js: Corepack](https://nodejs.org/download/release/latest-v25.x/docs/api/corepack.html) — Corepack is no longer distributed starting with Node.js v25 (official).
- [Vite: Server Options](https://vite.dev/config/server-options) — `strictPort` exits when the port is taken; `host: true` listens on all addresses, LAN included (official).
- [MDN: Using Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers) — service workers require HTTPS, and `localhost` is treated as a secure origin (reference documentation).
- [ADR-0009](0009-profiling-metrics.md), [ADR-0010](0010-e2e-testing-strategy.md), [ADR-0012](0012-msw-in-production-build.md) — profiling on a production build, container-generated baselines, and the MSW worker in every build.
