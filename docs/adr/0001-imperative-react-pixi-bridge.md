# ADR-0001: Imperative React ↔ PixiJS bridge with a typed event bus

- **Status:** Accepted
- **Date:** 2026-10-07
- **Deciders:** Gabriel da Silveira
- **Requirements:** AR-01, AR-02, AR-04

## Context

React owns menus, forms, panels and dialogs. PixiJS owns the arena, ships, projectiles, effects and health bars. The game loop updates dozens of entities every frame, so any per-frame work routed through a React reconciler competes with the simulation and the renderer for the main thread. The lifecycle of the PixiJS application also has to be controlled precisely (ADR-0002).

## Decision

A plain TypeScript `GameApp` class owns the PixiJS `Application`, the simulation and the input layer. A single React component, `GameCanvas`, mounts it into a `ref` and is the only bridge between the two worlds.

- Game → UI: a typed event bus (`GameEvents` map, payloads checked by `tsc`, `on()` returns its own unsubscribe function) plus the throttled UI store from ADR-0003.
- UI → game: explicit methods on `GameApp` (`pause()`, `resume()`, `restart()`, `destroy()`).

## Options considered

| Option | Assessment |
| --- | --- |
| `@pixi/react` for the arena | Declarative and familiar, but every scene change passes through a React reconciler, and the library owns a lifecycle we need to control. A benchmark in a PixiJS issue showed a React renderer reaching far fewer sprites than plain PixiJS. |
| Imperative `GameApp` + string-based event bus | The shape used by Phaser's official React template. Simple, but event names and payloads are unchecked and listeners leak easily. |
| **Imperative `GameApp` + typed event bus** | Same proven shape as the Phaser template, with checked payloads and guaranteed listener cleanup. |

## Consequences

- Easier: the simulation is testable without React or PixiJS; React re-renders only on meaningful state changes.
- Harder: scene objects are created and destroyed by hand, so ownership must be explicit (ADR-0002, ADR-0006).
- Revisit: if a future screen needs declarative PixiJS composition (an editor, for example), evaluate `@pixi/react` for that screen only.

## Sources

- [phaserjs/template-react-ts](https://github.com/phaserjs/template-react-ts) — official Phaser template: a React component initialises the game and acts as the bridge, with an event bus between React and the game (official, Phaser).
- [pixi.js issue #1380](https://www.github.com/pixijs/pixi.js/issues/1380) — a React renderer over PixiJS reached roughly 20,000 sprites against roughly 50,000 in plain PixiJS. The issue predates PixiJS v8, so the numbers illustrate reconciler cost rather than serve as a current benchmark (issue).
