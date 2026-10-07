# ADR-0011: Network scenarios controlled by MSW, not by `page.route()`

- **Status:** Accepted
- **Date:** 2026-10-07
- **Deciders:** Gabriel da Silveira
- **Requirements:** MSW-03 to MSW-10, T10, T11, T12

## Context

The challenge requires success, empty, paginated, slow, out-of-order, timeout, 4xx/5xx and post-save-timeout scenarios, selectable and resettable, and shared between development, tests and the demo. MSW runs as a service worker in the browser.

## Decision

- Scenarios live in MSW handlers, driven by a seeded RNG for latency and ordering.
- A scenario is selected with `?scenario=<name>` or `window.__msw.setScenario(name)`, and `window.__msw.reset()` restores the initial data; the in-game dev panel calls the same functions.
- Playwright tests select scenarios through the app and never use `page.route()` for API calls.

## Options considered

| Option | Assessment |
| --- | --- |
| Playwright `page.route()` for failures | Requests answered by the MSW service worker are invisible to Playwright routing, so the two would fight. |
| Disable service workers in tests and mock with Playwright | Tests would no longer exercise the mocks the demo uses. |
| **Scenarios inside MSW, selected by the app** | One mock layer for development, tests and the published demo. |

## Consequences

- Easier: any failure seen in a test can be reproduced in the published build with the same query parameter.
- Harder: scenario state must reset between tests (PW-06).
- Revisit: if a real backend is added, keep the scenarios as contract fixtures.

## Sources

- [Playwright: Service Workers](https://playwright.dev/docs/service-workers) — how Playwright reports and routes service worker traffic, and the option to block service workers (official).
- [Playwright: Network](https://playwright.dev/python/docs/network) — tools such as MSW add their own service worker, which makes requests invisible to Playwright routing (official).
- [Playwright issue #23277](https://github.com/microsoft/playwright/issues/23277) — feature request to intercept MSW traffic with Playwright; closed without native support, pointing to the community `playwright-msw` package (issue).
