# ADR-0004: Fixed timestep game loop with interpolated rendering

- **Status:** Accepted
- **Date:** 2026-10-07
- **Deciders:** Gabriel da Silveira
- **Requirements:** AR-03, MT-08, MT-09, MT-10, MT-11, MT-12

## Context

Movement, damage, cooldowns and spawns must not depend on the display refresh rate (AR-03). Pause must freeze the timer and cooldowns, and resuming must not apply movement or shots from the paused period (MT-10, MT-12). Tests need to advance the simulation deterministically (ADR-0010).

## Decision

The PixiJS ticker is not used for gameplay timing. The application starts with `autoStart: false` and a custom `requestAnimationFrame` driver runs a fixed 60 Hz simulation step with a clamped accumulator, then renders with interpolation:

```ts
const STEP_MS = 1000 / 60;
const MAX_STEPS = 5;

function frame(now: number): void {
  const dt = now - last;
  last = now;
  if (match.state === 'running') {
    acc = Math.min(acc + dt, STEP_MS * MAX_STEPS);
    while (acc >= STEP_MS) {
      simulation.step(input.sample());
      acc -= STEP_MS;
    }
  }
  renderer.draw(world, acc / STEP_MS);
  rafId = requestAnimationFrame(frame);
}
```

On resume: `acc = 0`, `input.clear()` and `last = performance.now()`.

Traced across refresh rates:

| Display | Frame time | Steps per frame | Steps per second |
| --- | --- | --- | --- |
| 30 Hz | 33.3 ms | 2 | 60 |
| 60 Hz | 16.7 ms | 1 | 60 |
| 144 Hz | 6.9 ms | 0 or 1 (one step about every 2.4 frames) | 60 |

## Options considered

| Option | Assessment |
| --- | --- |
| Variable step with `ticker.deltaMS` | Results depend on frame rate; fast projectiles can tunnel at low frame rates; not reproducible in tests. |
| Fixed step without interpolation | Deterministic, but visibly stutters on high refresh rate displays. |
| **Fixed step, clamped accumulator, interpolated render** | Deterministic, smooth, and the clamp prevents the spiral of death after a long frame. |

## Consequences

- Easier: pause, replay (ADR-0005) and test stepping all reduce to "do not call `step`" or "call `step` n times".
- Harder: the renderer keeps previous and current transforms to interpolate.
- As built: the five-step limit is applied to the step count, not to the accumulator. In floating point the subtract-in-a-loop form above runs four steps from five steps of accumulated time, so the clock divides, floors, and drops the surplus when the count reaches five.
- Revisit: if the simulation step itself grows expensive, lower `MAX_STEPS` and measure.

## Sources

- [pixijs/pixijs-skills](https://github.com/pixijs/pixijs-skills) and its [ticker skill page](https://skillselion.com/skills/pixijs/pixijs-skills/pixijs-ticker) — `autoStart: false` with your own frame driver is the recommended route to pause on tab blur or run a fixed timestep (official repository; the second link is a mirror).
- [html5gamedevs: deterministic lockstep proposal](https://www.html5gamedevs.com/topic/32258-proposal-implementing-deterministic-lockstep-for-physics-and-animations) — fixed update frequency with an accumulator, capping internal steps to avoid the spiral of death (forum).
- [pixi-vector-arcade](https://www.claudepluginhub.com/skills/rbergman-dm-game-plugins-game-dev-2/pixi-vector-arcade) — PixiJS 8 accumulator clamped to five ticks with an interpolation alpha (community).
