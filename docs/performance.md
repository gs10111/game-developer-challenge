# Performance report

Status: **measured** on the published build, on the machine described below: a three-minute match, an earlier two-minute match, and five cycles of start, play and exit. All were run by hand in a visible window; no number here comes from an automated run.

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
2. For the three-minute match, open `/?perf=1&duration=180&seed=7`, press **Play**, keep its window visible and copy the report from the result dialog. `duration` sets the session time of benchmark matches, in seconds, without touching the saved options.
3. For the memory check, open `/?perf=1&duration=60&cycles=5&seed=7` and press **Play** once. Five matches run in a row: when one ends, the app leaves the match screen, which destroys the session, and starts the next by itself. The report of the fifth lists the heap of all five.

## Environment of the measured runs

| Item | Value |
| --- | --- |
| Hardware | Intel Core i7-4770 at 3.40 GHz, Intel HD Graphics 4600 (integrated), 12 GB of DDR3 memory |
| Operating system | Windows, 64-bit (the browser reports NT 10.0, which is Windows 10 or 11) |
| Browser | Microsoft Edge 154 (Chromium 154) |
| Window | Viewport of 1358 by 610 CSS pixels in the three-minute match and in the five cycles, and of 436 by 610 in the two-minute match; device pixel ratio 1. The resolution of the screen itself was not reported |
| Canvas | 1024 by 576 pixels, scaled down by CSS to fit the window |
| Build | The published production build |
| Match config | Defaults, with an enemy every 3 s and at most 10 enemies alive; seed 7; benchmark pilot. Session time of 180 s in the three-minute match, 120 s in the two-minute match and 60 s in each of the five cycles |

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

Measured with `/?perf=1&duration=180&seed=7`, in a window of 1358 by 610 CSS pixels. Target: 60 frames per second, which is 16.7 ms between frames.

| Measure | Value |
| --- | --- |
| Frames | 10,789 in 180.01 s |
| Average frames per second | 59.93 |
| Median time between frames | 16.7 ms |
| 95th percentile time between frames | 17.2 ms |
| 99th percentile time between frames | 18.8 ms |
| Longest time between frames | 34.9 ms |
| Frames slower than 33 ms | 2 of 10,789 |
| Live ships, the player included | 5.11 on average, 8 at most |
| Live projectiles | 2.41 on average, 10 at most |
| JavaScript heap | 11.64 MB at the start, 12.39 MB at the end |

Reading: the match held the target for its whole length on integrated graphics. The median sits on the refresh interval, the 95th percentile is half a millisecond above it, the 99th is two milliseconds above it, and two frames in three minutes took longer than two refresh intervals. The heap grew by 0.75 MB over the match.

The raw report of the run:

```json
{
  "cycle": 1,
  "seed": 7,
  "sessionSeconds": 180,
  "spawnSeconds": 3,
  "canvasWidth": 1024,
  "canvasHeight": 576,
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 Edg/154.0.0.0",
  "viewport": "1358x610",
  "devicePixelRatio": 1,
  "frames": {
    "frames": 10789,
    "seconds": 180.01,
    "averageFps": 59.93,
    "medianMs": 16.7,
    "p95Ms": 17.2,
    "p99Ms": 18.8,
    "longestMs": 34.9,
    "framesOver33Ms": 2
  },
  "ships": { "average": 5.11, "maximum": 8 },
  "projectiles": { "average": 2.41, "maximum": 10 },
  "heapMegabytes": { "atStart": 11.64, "atEnd": 12.39 }
}
```
## Five cycles of start, play and exit

Measured with `/?perf=1&duration=60&cycles=5&seed=7`: five matches of 60 seconds in a row. Between two matches the app leaves the match screen, which destroys the session, and starts the next one. The window was 1358 by 610 CSS pixels, in Edge 154, on the published build.

| Cycle | Heap at start (MB) | Heap at end (MB) | Frames per second | 95th percentile | Frames slower than 33 ms |
| --- | --- | --- | --- | --- | --- |
| 1 | 10.99 | 12.10 | 59.82 | 17.0 ms | 3 of 3,593 |
| 2 | 13.86 | 12.02 | 58.31 | 19.3 ms | 35 of 3,499 |
| 3 | 14.35 | 12.97 | 59.94 | 17.0 ms | 2 of 3,597 |
| 4 | 14.31 | 12.67 | 59.98 | 16.9 ms | 0 of 3,599 |
| 5 | 14.17 | 12.40 | 59.95 | 16.9 ms | 0 of 3,598 |

Reading:

- No continuous growth. The heap at the start of a match rises once, from 11.0 MB in the first cycle to 13.9 MB in the second, and then stays between 14.2 and 14.4 MB, a little lower in each of the last three cycles. The heap at the end stays between 12.0 and 13.0 MB. What is added after the first match is kept once and reused: the textures in the asset cache and the compiled code.
- Every match ends with less heap than the next one starts with, and from the second cycle on with less than it started with itself, so the garbage collector reclaims what a match allocates while the match runs.
- Live entities are the same in every cycle, about 5 ships and 2 projectiles on average, 8 and 9 at most, as expected from the same seed and the same pilot.
- The second cycle was disturbed: 35 frames slower than 33 ms and a 99th percentile of 33.9 ms, against 0 to 3 slow frames in the other four. The run was left in a window of its own while the machine was free for other work, which may be the cause; it was not investigated.

Leaving a match destroys the PixiJS application with its ticker and display objects and removes the keyboard, blur and visibility listeners; the textures stay in the asset cache on purpose and are reused by the next match.
## What the design expects

The cost model of [ADR-0015](adr/0015-average-case-performance-model.md) puts a simulation step at about a thousand cheap operations for 20 enemies and 60 projectiles, far below one percent of a 16.7 ms frame. Rendering is one sprite per live entity, a tiling sprite for the water and about fifty static island tiles, with no per-frame allocation in the simulation or in the views.

## Limitations

- The measured load is well below the profile of ADR-0015: about 5 ships and 2 projectiles alive on average, against 21 and 60. The default config keeps at most 10 enemies alive, and the projectile count is lower than the fire rate of the pilot would give in open water, which suggests that many of its shots end early on a wall or an island; that was not checked. The run shows that a default match holds 60 frames per second; it does not show the headroom at the load of the profile.
- The reference machine is one desktop with a processor of 2013 and integrated graphics. Nothing was measured on a phone or on another browser engine.
- The window was narrow, 436 CSS pixels wide. The canvas is always rendered at 1024 by 576 and scaled by CSS, so the window size changes the compositing work, not the scene.
- `performance.memory` exists only in Chromium and is rounded by the browser unless it is started with `--enable-precise-memory-info`; a heap snapshot in the developer tools is the stronger evidence.
- Frame times come from the ticker callback, so they include the simulation and the scene update but not the time the compositor takes after it; the Performance panel of the developer tools shows that part.
- A benchmark match does not pause when its window loses the focus, only when its tab is hidden, so it can run in a window of its own while another window is used. That window has to stay visible: the browser stops animation frames for a background tab and for a minimized or fully covered window, and the match pauses.
