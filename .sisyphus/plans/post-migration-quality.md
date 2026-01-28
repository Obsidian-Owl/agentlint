# Post-Migration Quality Improvements

## TL;DR

> **Quick Summary**: Implement all quality review improvements from the opencode SDK migration — dead code removal, runtime safety, contract fixes, documentation updates, new tests, type guard consolidation, and legacy doc annotations.
>
> **Deliverables**:
>
> - Dead PromptKit adapter removed (R1)
> - resume()/interrupt() contract resolved with real implementations (R2)
> - Zod runtime validation at tool boundary (R3)
> - Arc42 docs updated to reflect opencode SDK (M1)
> - src/opencode/README.md created (M2)
> - Unit tests for client.ts and server.ts (M3)
> - Centralized type guards replacing `as Record<string, unknown>` casts (M4)
> - zodToJsonSchema typed helper wrapper (O1)
> - Deterministic integration test for orchestrator (O2)
> - Legacy doc annotations for historical references (O3)
>
> **Estimated Effort**: Medium (10 tasks, ~2-3 days)
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: R3 → O1 (tool-adapter.ts shared file)

---

## Context

### Original Request

Implement ALL improvements (required, recommended, optional) identified by the post-migration quality review of the opencode SDK migration.

### Research Findings

- `interrupt()` IS actively called from `src/cli/commands/analyse.ts` lines 757 and 1334 (Ctrl+C handler) — MUST implement real behavior
- `resume()` is NOT called from any CLI code — can remain unimplemented with clear error
- `getSubagentConfig()` also throws "Not implemented" — same treatment as resume()
- `src/opencode/orchestrator.ts` has 2 eslint-disable comments for resume/interrupt stubs
- `src/prompts/adapters/index.ts` exports 3 symbols from dead adapter file
- `tool-adapter.ts` passes raw `unknown` args directly to handler without Zod parse

### Verification Commands

- `bun run test` — unit/integration tests (4086 passing)
- `bun run typecheck` — strict TypeScript check
- `bun run lint` — ESLint

---

## Work Objectives

### Core Objective

Bring the post-migration codebase to production quality: eliminate dead code, add runtime safety, fix contracts, consolidate types, update docs, and add missing tests.

### Definition of Done

- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes
- [ ] `bun run test` passes (all 4086+ tests)
- [ ] No `as any`, `@ts-ignore`, `@ts-expect-error` introduced
- [ ] No dead code remains from old SDK

### Must NOT Have (Guardrails)

- No `as any` or type suppressions
- No breaking changes to public interfaces
- No removal of IOrchestrator.resume()/interrupt() from the interface (callers exist)
- No mass-editing of historical docs — only add legacy headers
- No live API tests in new test files

---

## Verification Strategy

### Test Decision

- **Infrastructure exists**: YES (Bun test, 4086 tests)
- **User wants tests**: YES (tests-after for R3, M3, O2)
- **Framework**: bun test

### For each code task

- Write focused unit tests for new logic
- Run `bun run test` to verify no regressions
- Run `bun run typecheck` and `bun run lint`

---

## Task Dependency Graph

| Task | Depends On | Reason                                                               |
| ---- | ---------- | -------------------------------------------------------------------- |
| R1   | None       | Standalone dead code removal                                         |
| R2   | None       | Standalone contract fix                                              |
| R3   | None       | Standalone runtime safety fix                                        |
| M1   | None       | Pure documentation                                                   |
| M2   | None       | Pure documentation                                                   |
| M3   | None       | Tests for existing code                                              |
| M4   | None       | Refactoring existing casts                                           |
| O1   | R3         | Both modify tool-adapter.ts; R3 adds parse, O1 wraps zodToJsonSchema |
| O2   | None       | Independent integration test                                         |
| O3   | None       | Pure documentation                                                   |

## Parallel Execution Graph

```
Wave 1 (Start immediately — all independent):
├── R1: Remove dead PromptKit adapter
├── R2: Resolve resume()/interrupt() contract
├── R3: Add Zod runtime validation at tool boundary
├── M1: Update Arc42 docs
├── M2: Add src/opencode/README.md
├── M3: Add tests for client.ts and server.ts
├── M4: Consolidate SDK event parsing with type guards
├── O2: Add deterministic integration test for orchestrator
└── O3: Mark historical docs with legacy notes

Wave 2 (After R3 completes):
└── O1: Wrap zodToJsonSchema in typed helper

Critical Path: R3 → O1
Parallel Speedup: ~90% of tasks run in Wave 1
```

---

## TODOs

- [ ] 1. R1: Remove dead PromptKit adapter

  **What to do**:
  - Delete `src/prompts/adapters/claude-agent-sdk.ts` entirely
  - Edit `src/prompts/adapters/index.ts`: remove lines 2-6 (the export block for claude-agent-sdk)
  - Keep `export * from './types';` (line 1)
  - Run `bun run typecheck` — if anything breaks, it reveals hidden consumers
  - Run `bun run test`

  **Must NOT do**:
  - Don't remove `src/prompts/adapters/types.ts` or its export
  - Don't modify any other adapter files

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Trivial deletion — 2 file edits, no logic
  - **Skills**: [`git-master`]
    - `git-master`: Clean atomic commit for the deletion
  - **Skills Omitted**:
    - `typescript-programmer`: No code writing needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/prompts/adapters/claude-agent-sdk.ts` — File to delete (54 lines, dead code)
  - `src/prompts/adapters/index.ts:1-7` — Remove lines 2-6, keep line 1

  **Acceptance Criteria**:
  - [ ] `src/prompts/adapters/claude-agent-sdk.ts` does not exist
  - [ ] `src/prompts/adapters/index.ts` only exports from `./types`
  - [ ] `bun run typecheck` passes
  - [ ] `bun run test` passes

  **Commit**: YES
  - Message: `fix: remove dead PromptKit claude-agent-sdk adapter`
  - Files: `src/prompts/adapters/claude-agent-sdk.ts` (deleted), `src/prompts/adapters/index.ts`

---

- [ ] 2. R2: Resolve resume()/interrupt() contract

  **What to do**:
  - In `src/opencode/orchestrator.ts`:
    - **interrupt()** (line 168-169): Implement real behavior — set `this._isActive = false` and return. This is called by Ctrl+C handler in analyse.ts. Remove the eslint-disable comment.
    - **resume()** (line 162-164): Replace generic error with descriptive `OrchestrationError` using `SessionResumeError` from `src/errors/orchestration.ts`. Keep eslint-disable for `require-yield` (it genuinely never yields). Remove the `void sessionId` line; use sessionId in the error message.
    - **getSubagentConfig()** (line 176-178): Replace with descriptive error mentioning opencode orchestrator doesn't support subagents yet.
  - Add unit test in `tests/unit/opencode/orchestrator.test.ts`:
    - Test that `interrupt()` sets isActive to false
    - Test that `resume()` throws with descriptive error containing the session ID
    - Test that `getSubagentConfig()` throws with descriptive error

  **Must NOT do**:
  - Don't remove resume()/interrupt() from IOrchestrator interface (CLI depends on interrupt)
  - Don't use `as any` or type suppressions
  - Don't implement full resume logic (not needed yet)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small targeted changes to existing methods
  - **Skills**: [`typescript-programmer`, `git-master`]
    - `typescript-programmer`: Need correct TypeScript for error construction and type-safe implementation
    - `git-master`: Atomic commit
  - **Skills Omitted**:
    - `prompt-engineer`: No prompt work

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/opencode/orchestrator.ts:161-178` — Stub methods to fix
  - `src/orchestration/interfaces.ts:17-63` — IOrchestrator interface contract
  - `src/errors/orchestration.ts:22,72-93` — SessionResumeError class
  - `src/cli/commands/analyse.ts:751-769` — Ctrl+C handler calling interrupt()
  - `src/cli/commands/analyse.ts:1328-1346` — Second interrupt() call site

  **Acceptance Criteria**:
  - [ ] `interrupt()` sets `_isActive = false` without throwing
  - [ ] `resume()` throws `SessionResumeError` with session ID in message
  - [ ] `getSubagentConfig()` throws descriptive error
  - [ ] No eslint-disable comments remain for interrupt()
  - [ ] Test file `tests/unit/opencode/orchestrator.test.ts` exists with 3+ tests
  - [ ] `bun run test` passes
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `fix: implement interrupt() and clarify resume()/getSubagentConfig() contracts`
  - Files: `src/opencode/orchestrator.ts`, `tests/unit/opencode/orchestrator.test.ts`

---

- [ ] 3. R3: Add Zod runtime validation at tool boundary

  **What to do**:
  - In `src/opencode/tool-adapter.ts` line 29-30:
    - Before `sdkTool.handler(args)`, add `const parsed = zodSchema.safeParse(args);`
    - If `!parsed.success`, throw a descriptive error with `parsed.error.format()` or `parsed.error.issues`
    - Pass `parsed.data` to `sdkTool.handler()` instead of raw `args`
  - Add tests in `tests/unit/opencode/tool-adapter.test.ts`:
    - Test that valid args pass through correctly
    - Test that invalid args throw with Zod error details
    - Test that extra properties are handled (Zod's default is strip)

  **Must NOT do**:
  - Don't change the `SdkToolDefinition` interface
  - Don't use `.parse()` (throws opaque error) — use `.safeParse()` for structured error info
  - Don't suppress any type errors

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: ~10 lines of code change + focused tests
  - **Skills**: [`typescript-programmer`, `git-master`]
    - `typescript-programmer`: Zod safeParse pattern, error formatting
    - `git-master`: Atomic commit
  - **Skills Omitted**:
    - `prompt-engineer`: No prompt work

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: O1
  - **Blocked By**: None

  **References**:
  - `src/opencode/tool-adapter.ts:21-39` — adaptTool function to modify
  - `src/opencode/tool-adapter.ts:14-19` — SdkToolDefinition interface (don't change)

  **Acceptance Criteria**:
  - [ ] `adaptTool` handler calls `zodSchema.safeParse(args)` before `sdkTool.handler()`
  - [ ] Invalid args produce descriptive Zod error (not generic TypeError)
  - [ ] Valid args pass through and handler receives parsed data
  - [ ] Test file exists with 3+ test cases
  - [ ] `bun run test` passes
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `fix: add Zod runtime validation at tool adapter boundary`
  - Files: `src/opencode/tool-adapter.ts`, `tests/unit/opencode/tool-adapter.test.ts`

---

- [ ] 4. M1: Update Arc42 docs for opencode SDK

  **What to do**:
  - `docs/architecture/arc42/02-constraints.md`: Replace "Claude Agent SDK" references with "Opencode SDK (@opencode-ai/sdk)"
  - `docs/architecture/arc42/04-solution-strategy.md`: Update tech stack table (line ~45) — replace Claude Agent SDK with Opencode SDK
  - `docs/architecture/arc42/05-building-blocks.md`: Update lines ~145, 159, 229 — replace references to old SDK with opencode module descriptions
  - `docs/architecture/arc42/08-crosscutting-concepts.md`: Clarify SDK references — remove dual-SDK ambiguity, state current SDK is Opencode
  - Each file: ensure factual accuracy, don't rewrite prose unnecessarily

  **Must NOT do**:
  - Don't rewrite entire sections — targeted replacements only
  - Don't change architectural decisions, only SDK naming

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Search-and-replace in 4 markdown files
  - **Skills**: [`git-master`]
    - `git-master`: Single atomic docs commit
  - **Skills Omitted**:
    - `typescript-programmer`: No code
    - `writing`: Changes are factual corrections, not prose writing

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `docs/architecture/arc42/02-constraints.md` — Constraints section
  - `docs/architecture/arc42/04-solution-strategy.md:~45` — Tech stack table
  - `docs/architecture/arc42/05-building-blocks.md:~145,159,229` — Building block descriptions
  - `docs/architecture/arc42/08-crosscutting-concepts.md` — Crosscutting SDK references

  **Acceptance Criteria**:
  - [ ] No "Claude Agent SDK" in arc42 sections 02, 04, 05, 08 (except historical context notes)
  - [ ] "Opencode SDK" or "@opencode-ai/sdk" used consistently
  - [ ] `bun run lint` passes (markdown lint)

  **Commit**: YES
  - Message: `docs: update Arc42 sections to reflect opencode SDK migration`
  - Files: 4 arc42 markdown files

---

- [ ] 5. M2: Add src/opencode/README.md

  **What to do**:
  - Create `src/opencode/README.md` documenting:
    - Module purpose: Opencode SDK integration layer
    - Component table: orchestrator.ts, server.ts, client.ts, mcp-server.ts, tool-adapter.ts, streaming.ts, sessions.ts, telemetry-tracker.ts, index.ts — one-line description each
    - Entry points: How CLI uses this module (via orchestrator)
    - Data flow: CLI → Orchestrator → Server/Client → SDK → streaming back
    - Key patterns: tool adaptation, stream chunk conversion, telemetry tracking
  - Keep concise — 50-80 lines max

  **Must NOT do**:
  - Don't document internal implementation details
  - Don't duplicate CLAUDE.md content

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: Technical documentation writing
  - **Skills**: [`git-master`]
    - `git-master`: Atomic commit
  - **Skills Omitted**:
    - `typescript-programmer`: No code

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/opencode/index.ts` — Module public exports
  - `src/opencode/orchestrator.ts` — Main orchestration component
  - `src/opencode/server.ts` — Server lifecycle
  - `src/opencode/client.ts` — SDK client wrapper
  - `src/opencode/mcp-server.ts` — MCP server with tool registration
  - `src/opencode/tool-adapter.ts` — Zod→JSON Schema adapter
  - `src/opencode/streaming.ts` — SSE→StreamChunk conversion
  - `src/opencode/sessions.ts` — Session metadata management
  - `src/opencode/telemetry-tracker.ts` — Telemetry FIFO queue
  - CLAUDE.md "Orchestration Module" section — existing docs pattern to follow

  **Acceptance Criteria**:
  - [ ] `src/opencode/README.md` exists, 50-80 lines
  - [ ] Contains: purpose, component table, entry points, data flow
  - [ ] No internal implementation details leaked

  **Commit**: YES
  - Message: `docs: add src/opencode/README.md module documentation`
  - Files: `src/opencode/README.md`

---

- [ ] 6. M3: Add targeted tests for client.ts and server.ts

  **What to do**:
  - Create `tests/unit/opencode/client.test.ts`:
    - Test error mapping (SDK errors → agentlint error types)
    - Test config plumbing (verify config values pass through correctly)
    - Test lifecycle invariants (can't use client before init, etc.)
    - Mock the Opencode SDK — don't make real connections
  - Create `tests/unit/opencode/server.test.ts`:
    - Test error mapping (server errors → agentlint error types)
    - Test lifecycle invariants (start/stop ordering)
    - Test health check behavior
    - Mock the SDK server
  - Focus on OUR logic, not SDK passthrough

  **Must NOT do**:
  - Don't test SDK internal behavior
  - Don't make real API calls
  - Don't use `as any` for mocks — use proper typed mocks/stubs

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Moderate effort — need to understand both files and write meaningful tests
  - **Skills**: [`typescript-programmer`]
    - `typescript-programmer`: TypeScript test patterns, proper mocking
  - **Skills Omitted**:
    - `git-master`: Standard commit, no special git needs

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/opencode/client.ts` — Client to test (error mapping, config, lifecycle)
  - `src/opencode/server.ts` — Server to test (error mapping, lifecycle, health)
  - `src/errors/orchestration.ts` — Error types used in mapping
  - `tests/unit/` — Existing test patterns to follow
  - `src/orchestration/config.ts` — Config types used by client

  **Acceptance Criteria**:
  - [ ] `tests/unit/opencode/client.test.ts` exists with 3+ test cases
  - [ ] `tests/unit/opencode/server.test.ts` exists with 3+ test cases
  - [ ] Tests cover: error mapping, config plumbing, lifecycle invariants
  - [ ] No real API/network calls
  - [ ] `bun run test` passes

  **Commit**: YES
  - Message: `test: add unit tests for opencode client and server modules`
  - Files: `tests/unit/opencode/client.test.ts`, `tests/unit/opencode/server.test.ts`

---

- [ ] 7. M4: Consolidate SDK event parsing with type guards

  **What to do**:
  - Create `src/opencode/event-guards.ts` with type guard functions:
    - `isTextEvent(event: unknown): event is { type: 'text'; text: string }` (etc. for each event type)
    - Cover all event types used in orchestrator.ts and streaming.ts
  - Refactor `src/opencode/orchestrator.ts`:
    - Replace `as Record<string, unknown>` casts (lines ~186, 198, 212) with type guard calls
  - Refactor `src/opencode/streaming.ts`:
    - Replace `as Record<string, unknown>` casts (lines ~65, 71, 76, 101, 106, 131) with type guard calls
  - Add tests in `tests/unit/opencode/event-guards.test.ts`:
    - Test each guard with valid and invalid inputs

  **Must NOT do**:
  - Don't change event handling logic — only replace casts with guards
  - Don't use `as any` in guards
  - Don't create overly broad guards that match too liberally

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Moderate refactoring across 3 files with new guards module
  - **Skills**: [`typescript-programmer`]
    - `typescript-programmer`: Type guard patterns, narrowing
  - **Skills Omitted**:
    - `git-master`: Standard commit

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/opencode/orchestrator.ts:~186,198,212` — Cast sites to replace
  - `src/opencode/streaming.ts:~65,71,76,101,106,131` — Cast sites to replace
  - TypeScript handbook type guards: standard `is` predicate pattern

  **Acceptance Criteria**:
  - [ ] `src/opencode/event-guards.ts` exists with guards for each event type
  - [ ] Zero `as Record<string, unknown>` casts remain in orchestrator.ts and streaming.ts
  - [ ] All event handling still works (no behavior change)
  - [ ] `tests/unit/opencode/event-guards.test.ts` exists
  - [ ] `bun run typecheck` passes
  - [ ] `bun run test` passes

  **Commit**: YES
  - Message: `refactor: replace SDK event casts with centralized type guards`
  - Files: `src/opencode/event-guards.ts`, `src/opencode/orchestrator.ts`, `src/opencode/streaming.ts`, `tests/unit/opencode/event-guards.test.ts`

---

- [ ] 8. O1: Wrap zodToJsonSchema in typed helper

  **What to do**:
  - In `src/opencode/tool-adapter.ts`:
    - Create local helper: `function zodToInputSchema(schema: z.ZodObject<z.ZodRawShape>): Record<string, unknown>`
    - Inside, call `zodToJsonSchema(schema as never, { $refStrategy: 'none' })` and cast result
    - Replace line 23 usage with the helper call
    - The `as never` cast is now isolated in one place with a comment explaining why

  **Must NOT do**:
  - Don't export the helper (it's local to this module)
  - Don't change any other logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: ~8 lines of code, single file
  - **Skills**: [`typescript-programmer`]
    - `typescript-programmer`: Type-safe wrapper pattern
  - **Skills Omitted**:
    - `git-master`: Trivial commit

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (after R3)
  - **Blocks**: None
  - **Blocked By**: R3 (both modify tool-adapter.ts)

  **References**:
  - `src/opencode/tool-adapter.ts:22-23` — Current `as never` cast to wrap
  - `zod-to-json-schema` library types — reason for the cast

  **Acceptance Criteria**:
  - [ ] `zodToInputSchema` helper exists in tool-adapter.ts
  - [ ] `as never` only appears inside the helper, with explanatory comment
  - [ ] `adaptTool` uses the helper instead of direct call
  - [ ] `bun run typecheck` passes
  - [ ] `bun run test` passes

  **Commit**: YES (groups with R3 if same session)
  - Message: `refactor: isolate zodToJsonSchema cast in typed helper`
  - Files: `src/opencode/tool-adapter.ts`

---

- [ ] 9. O2: Add deterministic integration test for orchestrator

  **What to do**:
  - Create `tests/integration/opencode/orchestrator.test.ts`
  - Test the full lifecycle: create orchestrator → run task → collect stream chunks → verify output
  - Mock the Opencode SDK at the boundary — no real API calls
  - Verify: stream chunks emitted in correct order, session state transitions, cleanup runs
  - This tests OUR orchestration logic, not the SDK

  **Must NOT do**:
  - No live API calls (no cost)
  - No `RUN_LIVE_TESTS` dependency
  - Don't test SDK internals

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Moderate complexity — integration test with mocking
  - **Skills**: [`typescript-programmer`]
    - `typescript-programmer`: Integration test patterns, SDK mocking
  - **Skills Omitted**:
    - `git-master`: Standard commit

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/opencode/orchestrator.ts` — Full orchestrator to test
  - `src/opencode/server.ts` — Server to mock
  - `src/opencode/client.ts` — Client to mock
  - `tests/integration/` — Existing integration test patterns
  - `src/orchestration/types.ts` — StreamChunk types to verify

  **Acceptance Criteria**:
  - [ ] `tests/integration/opencode/orchestrator.test.ts` exists
  - [ ] Tests lifecycle: init → run → stream → cleanup
  - [ ] No real API calls (fully mocked)
  - [ ] `bun run test` passes (test included in standard suite)

  **Commit**: YES
  - Message: `test: add deterministic integration test for opencode orchestrator`
  - Files: `tests/integration/opencode/orchestrator.test.ts`

---

- [ ] 10. O3: Mark historical docs with legacy notes

  **What to do**:
  - Add legacy header to ADRs: `docs/architecture/adr/0002-*.md`, `0005-*.md`, `0010-*.md`, `0016-*.md`
    - Format: `> **Note (2026-01)**: This ADR references "Claude Agent SDK" which has been replaced by Opencode SDK (@opencode-ai/sdk). See migration commits for details.`
  - Add legacy header to epic planning docs referencing old SDK:
    - `docs/planning/epic-catalogue.md` EP01, EP02, EP10 entries (inline note, not top-level)
  - Add legacy header to affected spec dirs:
    - `specs/ep01-*/spec.md`, `specs/ep02-*/spec.md`, `specs/ep07-*/spec.md`, `specs/ep09-*/spec.md`, `specs/tech-debt-p3/spec.md`
  - Keep it minimal — one-line note, not rewrites

  **Must NOT do**:
  - Don't mass-edit all 51 references
  - Don't change the content of historical decisions
  - Don't rewrite spec content

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Repetitive insertion of header notes
  - **Skills**: [`git-master`]
    - `git-master`: Single atomic commit for all doc annotations
  - **Skills Omitted**:
    - `writing`: Not prose writing, just standard notes

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `docs/architecture/adr/0002-*.md` — ADR to annotate
  - `docs/architecture/adr/0005-*.md` — ADR to annotate
  - `docs/architecture/adr/0010-*.md` — ADR to annotate
  - `docs/architecture/adr/0016-*.md` — ADR to annotate
  - `docs/planning/epic-catalogue.md` — EP01, EP02, EP10 entries
  - `specs/ep01-*/spec.md`, `specs/ep02-*/spec.md`, `specs/ep07-*/spec.md`, `specs/ep09-*/spec.md`, `specs/tech-debt-p3/spec.md`

  **Acceptance Criteria**:
  - [ ] 4 ADRs have legacy note headers
  - [ ] Epic catalogue has inline notes for EP01, EP02, EP10
  - [ ] 5 spec files have legacy note headers
  - [ ] No content changes to historical decisions

  **Commit**: YES
  - Message: `docs: add legacy SDK notes to historical ADRs, epics, and specs`
  - Files: ~12 markdown files

---

## Commit Strategy

| After Task | Message                                                                         | Verification                        |
| ---------- | ------------------------------------------------------------------------------- | ----------------------------------- |
| R1         | `fix: remove dead PromptKit claude-agent-sdk adapter`                           | `bun run typecheck && bun run test` |
| R2         | `fix: implement interrupt() and clarify resume()/getSubagentConfig() contracts` | `bun run test`                      |
| R3         | `fix: add Zod runtime validation at tool adapter boundary`                      | `bun run test`                      |
| M1         | `docs: update Arc42 sections to reflect opencode SDK migration`                 | `bun run lint`                      |
| M2         | `docs: add src/opencode/README.md module documentation`                         | visual review                       |
| M3         | `test: add unit tests for opencode client and server modules`                   | `bun run test`                      |
| M4         | `refactor: replace SDK event casts with centralized type guards`                | `bun run typecheck && bun run test` |
| O1         | `refactor: isolate zodToJsonSchema cast in typed helper`                        | `bun run typecheck && bun run test` |
| O2         | `test: add deterministic integration test for opencode orchestrator`            | `bun run test`                      |
| O3         | `docs: add legacy SDK notes to historical ADRs, epics, and specs`               | visual review                       |

---

## Success Criteria

### Verification Commands

```bash
bun run typecheck   # Expected: no errors
bun run lint        # Expected: no errors
bun run test        # Expected: all tests pass (4086+ existing + new)
```

### Final Checklist

- [ ] Zero `as Record<string, unknown>` in orchestrator.ts and streaming.ts
- [ ] Zero dead code from old Claude Agent SDK
- [ ] Zod validation active at tool boundary
- [ ] interrupt() works for Ctrl+C handler
- [ ] Arc42 docs reflect current SDK
- [ ] src/opencode/ has README
- [ ] client.ts and server.ts have unit tests
- [ ] Integration test for orchestrator exists
- [ ] Historical docs annotated with legacy notes
