# ADR-0010: Deterministic E2E testing through a test seam

- **Status:** Accepted
- **Date:** 2026-10-07
- **Deciders:** Gabriel da Silveira
- **Requirements:** PW-01 to PW-07, UX-12

## Context

Gameplay renders to a canvas, so DOM selectors cannot observe it. Tests must use real controls, keep rules, collisions and rendering intact (PW-04, PW-05) and still be deterministic, including visual regression.

## Decision

- With `?test=1`, the app exposes a read-only seam on `window.__game`: a readiness flag, a state snapshot (entities, health, score, timer), the current seed, and `step(n)` to advance the simulation by whole steps while the real loop is paused.
- Combat tests press real keys and touch controls through Playwright, then assert on the snapshot.
- Visual snapshots of the menu, a stable arena frame and the result screen are taken only after seeding and stepping to a known frame.
- Baselines are generated inside the official Playwright Docker image that CI uses, never on a developer machine.
- Every test fails on `console.error` or an unhandled rejection (UX-12).
- DOM elements use `data-testid`; canvas assertions go through the seam.

## Options considered

| Option | Assessment |
| --- | --- |
| Pixel comparison of a live canvas | Flaky by nature: timing, GPU and fonts differ between runs. |
| Test hooks that set state directly | Fast, but skips the rules the challenge wants exercised. |
| **Read-only seam + real input + deterministic stepping** | Observes real behaviour while removing timing noise. |

## Consequences

- Easier: failures replay locally with the same seed and step count.
- Harder: the seam must never ship enabled without the flag.
- Revisit: if WebGL output differs between CI runners, force a software renderer for the visual project.

## Sources

- [playwright-testing for Phaser games](https://skills.sh/chongdashu/phaserjs-oakwoods/playwright-testing) — canvas games need a readiness and state seam, a seeded deterministic mode, and screenshots only after determinism is locked (community).
- [Argos: Fix Flaky Visual Tests](https://argos-ci.com/blog/fix-flaky-visual-tests) — baselines from different machines do not match, and requestAnimationFrame or canvas animations ignore CSS animation overrides (article).
- [starwards/starwards](https://github.com/starwards/starwards) and its [PixiJS patterns](https://www.skill-gallery.jp/skills/starwards/starwards-pixijs) — an open-source PixiJS v8 spaceship simulator tested with Playwright and `data-id` selectors (open-source project).
