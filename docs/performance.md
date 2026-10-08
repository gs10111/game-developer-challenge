# Performance report

Status: **one run is measured**, a two-minute match on the published build. Still missing: the three-minute match the challenge asks for, the five cycles of the memory check, and the hardware of the machine that ran it.

## What is measured

Opening the game with `?perf=1` turns a match into a benchmark run:

- a fixed pilot sails, turns both ways in a cycle of six seconds and holds every weapon, so the load does not depend on who plays;
- the health of the player is raised in the config snapshot of that match, so that it lasts its whole session time and is not cut short by a defeat. No rule changes;
- every frame, the time since the previous frame and the number of live ships and projectiles are recorded in a buffer allocated once;
- the run is not sent to the ranking or the history.

When the match ends, the result dialog shows a JSON report with one entry per match played since the page was loaded: frames, average frames per second, median, 95th and 99th percentile and longest time between frames, frames slower than 33 ms, average and maximum live ships and projectiles, and the JavaScript heap at the start and at the end of the match (Chromium only). The same list is in `window.pirateBattlePerf`.

The code is in `src/game/runtime/perf.ts`; the percentiles are nearest-rank and are unit tested.

## How to run it

1. Use the published build at https://game-developer-challenge-nine.vercel.app, or `pnpm build && pnpm preview`, in a visible Chromium tab.
2. For the three-minute match, open `/?perf=1&duration=180&seed=7`, press **Play**, keep the tab in front and copy the report from the result dialog. `duration` sets the session time of benchmark matches, in seconds, without touching the saved options.
3. For the memory check, open `/?perf=1&duration=60&cycles=5&seed=7` and press **Play** once. Five matches run in a row: when one ends, the app leaves the match screen, which destroys the session, and starts the next by itself. The report of the fifth lists the heap of all five.

## Environment of the measured run

| Item | Value |
| --- | --- |
| Hardware | Not reported |
| Operating system | Windows, 64-bit (the browser reports NT 10.0, which is Windows 10 or 11) |
| Browser | Microsoft Edge 154 (Chromium 154) |
| Window | Viewport of 436 by 610 CSS pixels, device pixel ratio 1 |
| Canvas | 1024 by 576 pixels, scaled down by CSS to fit the window |
| Build | The published production build |
| Match config | Defaults: session time 120 s, an enemy every 3 s, at most 10 enemies alive; seed 7; benchmark pilot |

## Two-minute match

Target: 60 frames per second, which is 16.7 ms between frames.

| Measure | Value |
| --- | --- |
| Frames | 7,194 in 120.07 s |
| Average frames per second | 59.92 |
| Median time between frames | 16.7 ms |
| 95th percentile time between frames | 17.2 ms |
| 99th percentile time between frames | 19.9 ms |
| Longest time between frames | 43.3 ms |
| Frames slower than 33 ms | 3 of 7,194 |
| Live ships, the player included | 4.73 on average, 8 at most |
| Live projectiles | 2.27 on average, 10 at most |
| JavaScript heap | 12.0 MB at the start, 13.46 MB at the end |

Reading: the match held the target. The median sits on the refresh interval, the 95th percentile is half a millisecond above it, and three frames in two minutes took longer than two refresh intervals.

The raw report of the run:

```json
{
  "cycle": 1,
  "seed": 7,
  "sessionSeconds": 120,
  "spawnSeconds": 3,
  "canvasWidth": 1024,
  "canvasHeight": 576,
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 Edg/154.0.0.0",
  "viewport": "436x610",
  "devicePixelRatio": 1,
  "frames": {
    "frames": 7194,
    "seconds": 120.07,
    "averageFps": 59.92,
    "medianMs": 16.7,
    "p95Ms": 17.2,
    "p99Ms": 19.9,
    "longestMs": 43.3,
    "framesOver33Ms": 3
  },
  "ships": { "average": 4.73, "maximum": 8 },
  "projectiles": { "average": 2.27, "maximum": 10 },
  "heapMegabytes": { "atStart": 12, "atEnd": 13.46 }
}
```

## Three-minute match

Not measured yet. The run above used the default session time of 120 seconds; the challenge asks for three minutes, which needs the session time set to 180 seconds in Options before the run.

## Five cycles of start, play and exit

Not measured yet. The run above is a single match, in which the heap grew by 1.46 MB; one match cannot show whether memory keeps growing from one cycle to the next.

| Cycle | Heap at start (MB) | Heap at end (MB) |
| --- | --- | --- |
| 1 | 12.0 | 13.46 |
| 2 | _not measured_ | _not measured_ |
| 3 | _not measured_ | _not measured_ |
| 4 | _not measured_ | _not measured_ |
| 5 | _not measured_ | _not measured_ |

What to look for: a heap at the start of each cycle that keeps growing by a similar amount would mean something survives the exit. Leaving a match destroys the PixiJS application with its ticker and display objects and removes the keyboard, blur and visibility listeners; the textures stay in the asset cache on purpose and are reused by the next match.

## What the design expects

The cost model of [ADR-0015](adr/0015-average-case-performance-model.md) puts a simulation step at about a thousand cheap operations for 20 enemies and 60 projectiles, far below one percent of a 16.7 ms frame. Rendering is one sprite per live entity, a tiling sprite for the water and about fifty static island tiles, with no per-frame allocation in the simulation or in the views.

## Limitations

- The measured load is well below the profile of ADR-0015: about 5 ships and 2 projectiles alive on average, against 21 and 60. The default config keeps at most 10 enemies alive, and the projectile count is lower than the fire rate of the pilot would give in open water, which suggests that many of its shots end early on a wall or an island; that was not checked. The run shows that a default match holds 60 frames per second; it does not show the headroom at the load of the profile.
- The hardware of the run was not reported, so the result is not tied to a reference machine yet.
- The window was narrow, 436 CSS pixels wide. The canvas is always rendered at 1024 by 576 and scaled by CSS, so the window size changes the compositing work, not the scene.
- `performance.memory` exists only in Chromium and is rounded by the browser unless it is started with `--enable-precise-memory-info`; a heap snapshot in the developer tools is the stronger evidence.
- Frame times come from the ticker callback, so they include the simulation and the scene update but not the time the compositor takes after it; the Performance panel of the developer tools shows that part.
- A tab that is hidden or covered does not run frames, and the match pauses; a run has to stay in front.
