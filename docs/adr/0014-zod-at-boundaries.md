# ADR-0014: Zod 4 schemas at the boundaries only

- **Status:** Accepted
- **Date:** 2026-10-07
- **Deciders:** Gabriel da Silveira
- **Requirements:** API-01, SC-02, SC-03, SC-04, SC-07, SC-10, UX-09

## Context

TypeScript types disappear at runtime. Data crosses trust boundaries in four places: API responses, `localStorage` (settings, last result, outbox), the Options form and the gameplay config snapshot. Stored data can be corrupted, edited by hand or written by an older version.

## Decision

- Zod 4 schemas live in `src/api/contracts.ts` and `src/storage/schemas.ts`; TypeScript types are derived with `z.infer`.
- The same contract module is imported by the Axios client, the MSW handlers and a unit test that validates every fixture.
- Storage reads use `safeParse` and fall back to defaults instead of crashing; the outbox schema carries a version.
- The Options form and the config snapshot are validated with the same schema, which also produces accessible error messages.
- Schemas are never evaluated inside the simulation step.
- Query does not retry when the error is a `ZodError`: a malformed response stays malformed.

```ts
export const MatchRecord = z.object({
  matchId: z.uuid(),
  playerId: z.string(),
  playedAt: z.iso.datetime(),
  score: z.number().int().nonnegative(),
  durationMs: z.number().int().positive(),
  endReason: z.enum(['time_up', 'player_destroyed']),
});
export type MatchRecord = z.infer<typeof MatchRecord>;
```

## Options considered

| Option | Assessment |
| --- | --- |
| TypeScript types only | No runtime guarantee; a corrupted `localStorage` entry crashes the app. |
| Hand-written type guards | Duplicated logic that drifts from the types. |
| Zod Mini | Much smaller, tree-shakable functional API; worth it under a strict bundle budget, which this project does not have. |
| **Zod 4 at the boundaries** | One source of truth for types, validation and fixtures. |

## Consequences

- Easier: a contract change fails `tsc` in the client, the handlers and the fixtures at once.
- Harder: schema and fixture updates travel together in every API change.
- As built: a record is `matchId`, `playerId`, `playerName`, `finishedAt`, `score`, `durationSeconds`, `endReason` (`timeUp` or `defeated`) and `config`, in `src/api/contracts.ts`, shared by the client and the handlers. Stored options, the outbox and the last result are read with `safeParse` and fall back to defaults. Not built: a schema for the whole game config (only the two options and the name are validated), a version in the outbox schema, the unit test that validates every fixture and the rule that a `ZodError` is not retried.
- Revisit: if bundle size becomes a constraint, switch imports to `zod/mini`.

## Sources

- [Zod 4 release notes](https://zod.dev/v4) — the core bundle is about 57% smaller than Zod 3; Zod Mini offers a tree-shakable functional API at about 1.9 kB gzipped, while regular Zod stays recommended for most projects (official).
- [Zod API](https://zod.dev/api) — `safeParse` returns either the parsed data or a `ZodError` without throwing, and `z.infer` extracts the static type (official).
