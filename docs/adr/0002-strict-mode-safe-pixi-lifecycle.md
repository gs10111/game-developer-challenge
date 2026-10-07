# ADR-0002: Strict Mode safe PixiJS lifecycle

- **Status:** Accepted
- **Date:** 2026-10-07
- **Deciders:** Gabriel da Silveira
- **Requirements:** AR-05, AR-08, AR-09

## Context

In development, React Strict Mode mounts, unmounts and remounts components to expose leaks. PixiJS v8 initialises asynchronously (`await app.init()`), so a cleanup can run before initialisation finishes. The game is also recreated on restart and on every navigation into the combat screen, and textures must be loaded once and reused (AR-05).

## Decision

`GameApp.init()` returns a promise, and the effect cleanup chains `destroy()` to it, so teardown never races initialisation:

```tsx
useEffect(() => {
  const game = new GameApp(configSnapshot);
  const ready = game.init(hostRef.current!);
  return () => {
    void ready.then(() => game.destroy(), () => game.destroy());
  };
}, [configSnapshot]);
```

`destroy()` is idempotent and releases everything the game created:

```ts
destroy(): void {
  if (this.destroyed) return;
  this.destroyed = true;
  this.aborter.abort();
  cancelAnimationFrame(this.rafId);
  this.app.destroy(
    { removeView: true, releaseGlobalResources: true },
    { children: true },
  );
}
```

- All DOM listeners are registered with `{ signal: this.aborter.signal }`, so one `abort()` removes them.
- `texture: true` is not passed to `destroy`: textures loaded through `Assets` stay cached and are reused by the next match.

## Options considered

| Option | Assessment |
| --- | --- |
| Disable Strict Mode | Hides leaks instead of fixing them and contradicts AR-09. |
| Ref flag that skips the second mount | Masks the bug in development; real remounts (navigation, restart) still hit it. |
| **Destroy chained to the init promise, idempotent teardown** | Correct under Strict Mode, restart and navigation, with a single exit path to test. |

## Consequences

- Easier: every exit path calls the same `destroy()`, so T9 (abandon and repeated navigation) and the five-cycle memory check (PF-03) exercise one code path.
- Harder: code that runs after `await` inside `init()` must not assume the component is still mounted; it only prepares state that `destroy()` knows how to release.
- Revisit: if memory grows across cycles, check `Assets` cache growth first, then GPU texture sources.

## Sources

- [pixijs-skills: pixijs-application](https://github.com/pixijs/pixijs-skills/blob/6aae70d76cf410432dd144029c07a1ad4bb12793/skills/pixijs-application/SKILL.md) — v8 initialises asynchronously; `releaseGlobalResources` drains global pools, and omitting it is the usual cause of flicker and stale textures when an app is recreated in the same tab (official, PixiJS).
- [SciChart: React Strict Mode and double rendering](https://www.scichart.com/blog/what-is-react-strict-mode-and-why-is-my-application-double-re-rendering/) — handled asynchronous initialisation under Strict Mode by chaining deletion to the init promise (article).
