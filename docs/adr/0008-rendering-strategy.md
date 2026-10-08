# ADR-0008: Rendering with atlases, scaled sprites, BitmapText and ParticleContainer

- **Status:** Accepted
- **Date:** 2026-10-07
- **Deciders:** Gabriel da Silveira
- **Requirements:** FX-01 to FX-05, MT-06, PF-01, AR-05

## Context

The arena shows water, islands, ships with damage states, projectiles, health bars and effects. Performance is evaluated in a production build with a 60 FPS target.

## Decision

- Textures come from atlases loaded once through `Assets` bundles before combat (AR-05, AR-06).
- Layer containers in a fixed order: water, islands, ships, projectiles, effects, overlays, so consecutive objects share textures and batch well.
- Ships are sprites whose frame switches by health band (FX-03).
- Health bars are two sprites with `scale.x` set from health; no `Graphics` is redrawn per frame.
- Any text inside the canvas uses `BitmapText`; score and time live in the React HUD (ADR-0003).
- Sparks, smoke and explosion debris use `ParticleContainer` with pooled `Particle` objects.
- No culling: the whole arena fits the viewport.

## Options considered

| Option | Assessment |
| --- | --- |
| `Graphics` for bars and effects | Fast only when not modified; redrawing every frame defeats batching. |
| Sprites for particles | Works, but `Particle` is far lighter for short-lived effects. |
| **Atlases, scaled sprites, BitmapText, ParticleContainer** | Matches the official performance guidance for each object type. |

## Consequences

- Easier: draw calls stay low and predictable, which the profiling report shows (ADR-0009).
- Harder: the particle API is marked experimental, so it is wrapped behind a small `EffectsLayer` interface.
- As built: textures are individual PNG files loaded once through `Assets.load`, not atlases or bundles, and the layers are water, islands, projectiles, ships and effects. Ships switch sprite by health band, as decided. A health bar is a `Graphics` per ship redrawn only when the health changes, not two sprites. Effects are pooled sprites: a muzzle flash, a hit spark and a three-frame explosion. Not built: atlases, `ParticleContainer`, smoke, `BitmapText` and the HUD sprites of the asset pack.
- Revisit: if the arena becomes larger than the viewport, enable culling and re-measure.

## Sources

- [PixiJS: Performance Tips](https://pixijs.com/8.x/guides/concepts/performance-tips) — profile before optimizing; `Graphics` are fastest when not modified constantly; `BitmapText` for dynamic text; sprites batch with up to 16 textures; culling helps GPU-bound scenes and hurts CPU-bound ones (official).
- [PixiJS: Particle Container](https://pixijs.com/8.x/guides/components/scene-objects/particle-container) — `Particle` is much lighter than `Sprite`; the API is stable but marked experimental (official).
- [PixiJS blog: ParticleContainer in v8](https://pixijs.com/blog/particlecontainer-v8) — design and performance of the v8 particle system (official).
