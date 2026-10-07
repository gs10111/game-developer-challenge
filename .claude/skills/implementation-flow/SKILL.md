---
name: implementation-flow
description: The implementation workflow for the Pirate Battle repository (React + PixiJS + TypeScript challenge). Use it for every change in this repo, whether a feature, bug fix, refactor, test, config or documentation update, and whenever the user mentions a requirement ID (PL-, EN-, CB-, MT-, FX-, SC-, AR-, API-, MSW-, UX-, PW-, PF-, DL-), an ADR, a T1 to T12 flow, or asks to implement, build, add, fix, continue or review anything in Pirate Battle, even if they never name this skill. It scopes and plans the slice, then conducts implementation, test audit and review through agents.
---

# Pirate Battle implementation flow

The challenge is graded on behaviour a reviewer can verify and on how clearly responsibilities are separated. This flow makes every change end in the same place: a requirement implemented, proven by a test, consistent with an ADR, and recorded. Follow the six phases in order; each one ends with a gate, and when a gate cannot be met, stop and tell the user what is missing instead of working around it.

You are the **maestro**: you scope, plan, delegate and verify. Outside the tooling path you write no code and no tests; the files you write are ADRs, `docs/requirements.md` and `ARCHITECTURE.md`.

## Sources of truth

| File | Role |
| --- | --- |
| `CHALLENGE.md` | The challenge statement, in Portuguese. Final authority on what is required. |
| `README.md` | The solution's README: setup, commands, controls and network scenarios (DL-03). |
| `docs/requirements.md` | Every requirement with its ID, location, proving test and status. |
| `docs/adr/` | Accepted architecture decisions. Code follows them; changing one means writing a new ADR. |
| `.claude/skills/implementation-flow/standards.md` | Code rules, layers, test conventions and commands. The agents read it instead of this file. |
| `ARCHITECTURE.md` | The resulting system, written as the code takes shape (DL-05). |

Read the `CHALLENGE.md` section behind a requirement before implementing it: `docs/requirements.md` is a summary and can lose nuance.

## Maestro and agents

| Agent | Role |
| --- | --- |
| `implementer` | Phases 4 and 5: test first, then the minimum code, inside the standards. The only one that writes code and tests. |
| `test-auditor` | Requirement → test, test strategy and a repeat run. Fixes nothing. |
| `reviewer` | Spec, correctness, standards and ADRs on the diff; on the large path also the plan, determinism and loop cost. Read-only. |

### Paths

After Phase 1, pick the path. An explicit request ("use the standard path") outranks the table.

| Path | When | Phases 4 and 5 | Before Phase 6 |
| --- | --- | --- | --- |
| Tooling | Scaffolding, configuration or documentation with no rule to specify | You, with a smoke test | Nothing more |
| Standard | The slice stays in one of `sim`, `render`, `input`, `ui`, `api` or `mocks` | `implementer`, the whole slice | `test-auditor` in `full` mode, then `reviewer` in `standard` mode |
| Large | The slice touches more than one of them, or the canvas lifecycle, the game loop, determinism or match submission | `implementer`, one subtask at a time, each followed by `test-auditor` in `subtask` mode | `test-auditor` in `full` mode on the whole slice, then `reviewer` in `rigorous` mode |

- Standard path: when the implementer reports that the slice is larger than it looked (several layers, a change to `src/api/contracts.ts` or to a storage schema), stop and re-scope with the user.
- Large path: first ask whether the slice is large (much work, independent parts) or uncertain (nobody knows how to do it). When it is uncertain, stop and propose a short spike: more agents on an uncertain slice only produce more rework. When the plan needs more than five subtasks, stop and propose splitting the slice. Subtasks run in sequence, in plan order.

### Common rules

- **Start:** note the base SHA (`git rev-parse HEAD`). When `git status --short` shows changes left from an earlier slice, show them and ask the user whether to commit first: reviews compare the working tree with the base SHA, so one slice has to equal one diff.
- **Delegation:** paste into each agent's prompt the slice block, the approved plan, the base SHA, the mode and, on the large path, the subtask. The agent does not see this conversation.
- **Commits:** nobody commits unless the user asks, and agents never do. You prepare the message.
- **Agent stop:** when an agent returns `STOP:`, show the reason to the user and wait. Never discard working-tree changes without asking.
- **Retries:** a rejection by the test-auditor, the reviewer or Phase 6 goes back to the `implementer` with the findings. After the fix, start again from the test-auditor: no fix enters without an audit. At most two retries per slice; on the third rejection, stop and show the findings.
- **Verification:** an agent's report is a claim, not proof. Phase 6 is always yours, and you show its output.

## Phase 1: scope the slice

Pick a vertical slice small enough to finish and verify in one session, such as "front cannon, projectile lifetime and single-hit damage". Then write down:

```
Slice: <one sentence>
Requirements: <IDs from docs/requirements.md>
ADRs: <numbers that govern it>
Out of scope: <what this slice deliberately leaves for later>
```

Gate: the block above exists and the path is chosen. Show both to the user.

If the superpowers plugin is installed, `superpowers:brainstorming` helps when the slice is still fuzzy.

## Phase 2: check the decisions

- When the slice needs a choice no ADR covers (a new library, storage key, boundary or data structure), write `docs/adr/NNNN-short-title.md` from `docs/adr/template.md` with status Proposed, add it to `docs/adr/README.md`, and stop for the user's approval.
- When the slice conflicts with an accepted ADR, propose a superseding ADR instead of bending the code around the old one.

Gate: every design choice in the slice is covered by an accepted ADR.

## Phase 3: plan with proof

Write a short plan: files to create or touch, systems affected, and for each requirement ID the test that proves it.

- Unit tests (Vitest) for pure simulation rules: movement, damage, cooldowns, spawn rules, scoring, collision math.
- Playwright flows T1 to T12 for anything the player or the network touches.
- Doc for documentation-only items.

On the large path, split the plan into subtasks, each with its requirement IDs, files, dependencies and tests, and each testable on its own. Send it to the `reviewer` in `plan` mode. With a blocking critique, revise the plan once; when it is still blocked, show the plan and the critique to the user.

Gate: no requirement in the slice is without a named test, and the user approved the plan. Nothing is implemented before that. `superpowers:writing-plans` fits here.

## Phase 4: test first

On the standard and large paths the `implementer` does this phase and the next one. The rules are the same whoever writes the code.

- Simulation rules: write the Vitest tests against `src/game/sim` before the code and watch them fail for the right reason.
- Flows: add or extend the Playwright spec of the matching T-flow, using the test seam, a seeded scenario and real keyboard or touch input (ADR-0010).
- Put the requirement ID in the test name, so `--grep` selects it and the report maps back to the matrix:

```ts
test('CB-05 a projectile applies damage only once', async () => { ... });
```

Exception: scaffolding and tooling have no rules to specify. For those, add a smoke test (the app renders, the test runner runs in CI) instead of test-first.

Gate: the new tests exist and fail. `superpowers:test-driven-development` fits here.

## Phase 5: implement inside the standards

Keep to the slice. If the change grows beyond it, stop, re-scope with the user, and return to Phase 1.

The rules are in `standards.md`: what is prohibited, what to do instead and the ADR behind each rule, plus what each layer may touch.

Gate: the new tests pass and no standard is broken. On the standard and large paths, that means the `test-auditor` and the `reviewer` approved.

## Performance decisions: the average case

Every performance-related choice (data structure, broad phase, pool size, whether to optimise at all) is justified with the average-case profile in ADR-0015, not with a pending measurement and not with the worst case. Write the estimate where the decision lives (the ADR or the plan): entity counts, operations per step, estimated cost and share of the 16.7 ms frame budget.

Example, broad phase for the default profile (1 player, 20 enemies, 40 player shots, 20 enemy shots):

1. Player shots × enemies: 40 × 20 = 800 circle tests per step.
2. Enemy shots × player: 20 × 1 = 20 tests per step.
3. Ships against nearby island parts through the static grid: 21 × 2 = 42 SAT tests per step.
4. About 860 cheap tests per step, estimated in the low microseconds: far below 1% of the frame. Decision: filtered brute force, no spatial hash.

Profiling (ADR-0009) is still delivered for the report and checks the model. Reopen a decision only when the configured or measured load exceeds the profile by an order of magnitude, and update the ADR-0015 table whenever the default config changes.

## Phase 6: verify and record

Run, in this order, with the commands in `standards.md`, and fix before moving on:

1. Lint
2. Typecheck
3. Unit tests
4. The E2E tests of the slice in the container, desktop and mobile projects
5. For slices that touch the canvas lifecycle: the affected flow again with React Strict Mode on, and the console free of errors (UX-12)

Then record:

- Update the statuses in `docs/requirements.md`: Done when implemented, Tested when its test passes in CI.
- Update `ARCHITECTURE.md`, or an ADR's consequences, when what was built differs from what was planned.
- Prepare a commit message that names the IDs and ADRs, and commit only when the user asks:

```
feat(sim): front cannon with single-hit projectiles (PL-02, CB-05, ADR-0007)
```

Close with this summary. On the tooling path, the test audit and review lines read "not applicable".

```
Slice: <one sentence> (<tooling | standard | large> path)
✓/✗ Tests first:  <n> tests, red seen for <x>/<y> requirement IDs
✓/✗ Test audit:   requirements covered <x>/<y>, flaky <n>
✓/✗ Review:       <APPROVED | APPROVED WITH NOTES | NEEDS REVISION>
✓/✗ Verify:       <commands run and their results>
→ Commit message: <prepared message>
```

Gate: all commands pass and the records are updated. `superpowers:verification-before-completion` fits here.

## First slice

Until `package.json` exists, the first slice is the scaffold itself (DL-01, DL-04, DL-07, MSW-11), on the tooling path: Vite + React + TypeScript strict, ESLint, Vitest, Playwright with desktop and mobile projects, MSW worker started in every build, a GitHub Actions workflow running lint, typecheck, unit and E2E tests, and a Vercel deploy showing a placeholder screen with one mocked request. When the scripts exist, keep their names as listed in `standards.md` so this skill stays accurate.
