# Performance report

Status: the measuring tool is in place; **the numbers below have not been measured yet**. The game was built in a session whose browser was not visible, where the browser does not run animation frames, so no honest frame time could be taken there. The tables are to be filled from one run in a visible tab, as described.

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
2. In **Options**, set the game session time to 180 seconds and save.
3. Open `/?perf=1&seed=7`, press **Play**, keep the tab in front for three minutes and copy the report from the result dialog.
4. For the memory check, set the session time to 60 seconds, open `/?perf=1&seed=7` and play five matches in a row with **Play Again**, or with **Main Menu** and **Play** to include leaving the match screen. The fifth report lists the heap of all five.

## Reference environment

| Item | Value |
| --- | --- |
| Hardware | _to be filled: CPU, GPU, memory_ |
| Operating system | _to be filled_ |
| Browser | _to be filled: name and version_ |
| Screen and window | _to be filled: resolution, refresh rate, device pixel ratio_ |
| Build | Production build (`vite build`), served by `vite preview` or by the deploy |
| Match config | Defaults, session time 180 s, enemy every 3 s, at most 10 enemies alive, seed 7, benchmark pilot |

## Three-minute match

Target: 60 frames per second.

| Measure | Value |
| --- | --- |
| Frames | _not measured_ |
| Average frames per second | _not measured_ |
| Median time between frames | _not measured_ |
| 95th percentile time between frames | _not measured_ |
| 99th percentile time between frames | _not measured_ |
| Longest time between frames | _not measured_ |
| Frames slower than 33 ms | _not measured_ |
| Live ships, average and maximum | _not measured_ |
| Live projectiles, average and maximum | _not measured_ |

## Five cycles of start, play and exit

| Cycle | Heap at start (MB) | Heap at end (MB) |
| --- | --- | --- |
| 1 | _not measured_ | _not measured_ |
| 2 | _not measured_ | _not measured_ |
| 3 | _not measured_ | _not measured_ |
| 4 | _not measured_ | _not measured_ |
| 5 | _not measured_ | _not measured_ |

What to look for: a heap at the start of each cycle that keeps growing by a similar amount would mean something survives the exit. Leaving a match destroys the PixiJS application with its ticker and display objects and removes the keyboard, blur and visibility listeners; the textures stay in the asset cache on purpose and are reused by the next match.

## What the design expects

The cost model of [ADR-0015](adr/0015-average-case-performance-model.md) puts a simulation step at about a thousand cheap operations for 20 enemies and 60 projectiles, far below one percent of a 16.7 ms frame, and the default config keeps at most 10 enemies alive. Rendering is one sprite per live entity, a tiling sprite for the water and about fifty static island tiles, with no per-frame allocation in the simulation or in the views. These are expectations, not results; the tables above are what counts.

## Limitations

- `performance.memory` exists only in Chromium and is rounded by the browser unless it is started with `--enable-precise-memory-info`; a heap snapshot in the developer tools is the stronger evidence.
- Frame times come from the ticker callback, so they include the simulation and the scene update but not the time the compositor takes after it; the Performance panel of the developer tools shows that part.
- A tab that is hidden or covered does not run frames, and the match pauses; a run has to stay in front.
