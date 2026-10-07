# ADR-0005: Deterministic simulation and input replay

- **Status:** Accepted
- **Date:** 2026-10-07
- **Deciders:** Gabriel da Silveira
- **Requirements:** PW-03, EN-10, EN-11, MSW-10

## Context

Tests need seeded scenarios and controlled time (PW-03). A deterministic simulation also enables match replays from the ranking and history tabs, which double as regression fixtures. JavaScript arithmetic on doubles is deterministic, but transcendental functions are not guaranteed to return identical results across engines.

## Decision

- Each match has a seed. All randomness (spawn points, enemy type mix) comes from a seeded PRNG; `Math.random`, `Date.now` and wall-clock time are banned inside the simulation by lint rule.

```ts
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- Rotation is quantized to 1/512 of a turn, and sine and cosine come from a lookup table. The table is generated once and committed as data; computing it at runtime with `Math.sin` would reintroduce engine differences.
- Inputs are recorded per step as a command bitmask (forward, left, right, front shot, left broadside, right broadside). A 180 s match is 10,800 steps, about 10.8 kB at one byte per step before run-length encoding, which suits `localStorage`.
- A match record stores seed, config snapshot and the encoded input log. A replay re-runs the simulation with the same inputs.

## Options considered

| Option | Assessment |
| --- | --- |
| Record positions every frame | Large, and proves nothing about the simulation. |
| Seed + inputs with `Math.sin`/`Math.cos` | Reproducible in the same browser, may drift across browsers. |
| **Seed + inputs + quantized angles and committed trig table** | Reproducible across browsers and small enough to store per match. |

## Consequences

- Easier: a Playwright test can load a known replay and assert the final score; bugs become reproducible from a record.
- Harder: every gameplay change invalidates stored replays, so records carry a simulation version and old versions are flagged instead of replayed.
- As built: the PRNG runs the same mulberry32 arithmetic, with its state in a holder inside the world instead of a closure, so that a snapshot of the world captures it.
- As built: a heading reads the nearest table entry (round, then wrap), and within a step a ship turns first and then moves along the new heading. Both are part of the replay format: changing either invalidates stored replays.
- Revisit: if quantized rotation feels coarse, raise the resolution (1/1024 of a turn) and regenerate the table.

## Sources

- [Rapier: Determinism (JavaScript)](https://rapier.rs/docs/user_guides/javascript/determinism) — transcendental functions such as `Math.sin` and `Math.cos` are not cross-platform deterministic (official, another library).
- [Elm Discourse: making browser games more secure](https://discourse.elm-lang.org/t/making-browser-games-more-secure-with-elm-part-2/7764) — the specification describes the cosine result as an implementation-dependent approximation (forum).
