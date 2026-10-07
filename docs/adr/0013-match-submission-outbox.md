# ADR-0013: Idempotent match submission through a local outbox

- **Status:** Accepted
- **Date:** 2026-10-07
- **Deciders:** Gabriel da Silveira
- **Requirements:** API-11 to API-16, MSW-07, MSW-08, MSW-12

## Context

A finished match must produce exactly one history record and one ranking entry, even with retries, double clicks, timeouts after the server saved, offline periods and page reloads. The player can start another match while a submission is pending.

## Decision

- When a match ends, the client creates a `MatchRecord` with a UUID `matchId` and stores it in an outbox in `localStorage` with status `pending`.
- Submission is `PUT /api/matches/{matchId}`: PUT because the client owns the id; the mock creates the record or returns the existing one.
- The request runs through a TanStack Query mutation with `scope: { id: 'match-submit' }`, so submissions never run in parallel.
- On success the record leaves the outbox and the ranking and history queries are invalidated. On failure it stays pending, with a retry button and an automatic retry on reconnect and on app start.

Traced: timeout after the server saved.

1. The match ends; record `m-42` enters the outbox as pending.
2. `PUT /api/matches/m-42` times out, but the mock had already stored it.
3. The player clicks retry: `PUT /api/matches/m-42` returns the existing record.
4. The outbox drops `m-42`; both tabs refetch and show one entry.

## Options considered

| Option | Assessment |
| --- | --- |
| Fire-and-forget `POST` | Retries create duplicates. |
| Persisted paused mutations only | Resume after a reload only with a default mutation function, and pausing covers offline, not timeouts or 5xx. |
| **Domain outbox + idempotent PUT + scoped mutation** | Covers every failure mode in the requirements; Query handles transport, caching and invalidation. |

## Consequences

- Easier: the outbox is a plain list, so the UI can show "pending" per match and tests can assert on it.
- Harder: the outbox schema is versioned and validated on read (ADR-0014).
- Revisit: if records grow large, store input logs separately from the outbox entry.

## Sources

- [TanStack Query: Mutations (React)](https://tanstack.com/query/latest/docs/react/guides/mutations) — persisted mutations resume after a reload only with a default mutation function, and mutations paused while offline are retried in order on reconnect (official).
- [TanStack Query: Mutations (Vue)](https://tanstack.com/query/latest/docs/framework/vue/guides/mutations) — mutations sharing a `scope.id` run in series (official; the option comes from the shared query core).
