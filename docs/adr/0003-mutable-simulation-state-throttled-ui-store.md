# ADR-0003: Mutable simulation state, throttled UI store

- **Status:** Accepted
- **Date:** 2026-10-07
- **Deciders:** Gabriel da Silveira
- **Requirements:** AR-04, AR-10, MT-07, UX-10

## Context

The combat state changes every simulation step. The React UI only needs a few values (screen, score, remaining time, pause state, match result), and re-rendering React on every frame competes with the loop for the main thread.

## Decision

- Continuous combat state lives in a mutable `World` owned by the simulation. React never holds a reference to it.
- A small UI store (Zustand vanilla store, read with `useSyncExternalStore` semantics) holds low-frequency state only.
- The loop publishes to the store at most every 100 ms and only when a value changed. Remaining time is published in whole seconds, so the timer causes at most one HUD render per second.
- Values drawn inside the canvas (health bars, damage states) are read from `World` by the renderer, never through the store.

## Options considered

| Option | Assessment |
| --- | --- |
| React state updated every frame | Around 60 renders per second for values the player reads once per second. |
| React context with the world object | Every consumer re-renders on every change; same problem with more indirection. |
| **Mutable world + throttled store** | The pattern used by well-structured React game clones; React work scales with meaningful changes, not with frame rate. |

## Consequences

- Easier: the React Profiler shows renders only on score, timer-second and screen changes, which is direct evidence for AR-04.
- Harder: anything React shows must be explicitly published; forgetting it shows stale data.
- Revisit: if a HUD value needs sub-second precision, render it inside the canvas instead of raising the publish rate.

## Sources

- [danielmackay/pacman](https://github.com/danielmackay/pacman) — a plain mutable object is mutated every frame by the loop and never seen by React; Zustand holds only low-frequency state such as phase, score, lives and level (open-source project).
- [jallen-dev/rune-pixi-react-starter](https://github.com/jallen-dev/rune-pixi-react-starter) — reads rapidly changing state through `getState` and `subscribe` to avoid re-renders (open-source project).
- [html5gamedevs: React updating virtual DOM causes PixiJS freezes](https://www.html5gamedevs.com/topic/46585-react-updating-virtual-dom-causes-pixijs-freezes) — React updates to a scoreboard and chat next to a PixiJS canvas caused visible freezes while the simulation stayed correct (forum).
