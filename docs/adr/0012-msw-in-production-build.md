# ADR-0012: MSW enabled in the published build

- **Status:** Accepted
- **Date:** 2026-10-07
- **Deciders:** Gabriel da Silveira
- **Requirements:** MSW-11, DL-02

## Context

The published build has no backend: ranking and history must work through the mocks when the deployed URL is opened or reloaded. Most MSW setups disable the worker in production builds.

## Decision

The worker always starts, in development and in production, and the React tree renders only after it is ready:

```tsx
async function enableMocking(): Promise<void> {
  const { worker } = await import('./mocks/browser');
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: import.meta.env.PROD,
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  });
}

void enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(<App />);
});
```

- `mockServiceWorker.js` is committed in `public/` and regenerated when MSW is upgraded.
- The dynamic import keeps MSW out of the main chunk.
- A post-deploy smoke test opens the deployed URL and checks that the ranking tab loads.

## Options considered

| Option | Assessment |
| --- | --- |
| Production guard (`if (import.meta.env.PROD) return`) | The common boilerplate; breaks the published demo. |
| Start the worker without awaiting it | The first requests race the worker and escape the mocks. |
| **Always start, await before rendering** | The demo behaves exactly like development. |

## Consequences

- Easier: one code path everywhere.
- Harder: the first load waits for worker registration, so the loading screen covers it.
- Revisit: when a real API exists, gate the worker behind an explicit `VITE_USE_MOCKS` flag instead of the build mode.

## Sources

- [AWS sample: UX-first mocking](https://aws-samples.github.io/sample-innovation-patterns/developer-docs/web-client/ux-first-mocking) — typical setup that never starts the worker in a production build; shown here as the counterexample (article).
- [msw issue #1653](https://github.com/mswjs/msw/issues/1653) — requests fired before `worker.start()` resolves are not mocked; await it before rendering (issue).
