# Security Audit Remediation Plan

## TL;DR

> **Quick Summary**: Remediate all 15 security findings from post-migration audit, prioritized CRITICAL → LOW. Focuses on input sanitization, type safety, and secret redaction across the codebase.
>
> **Deliverables**:
>
> - 15 security findings fixed across ~20 files
> - New `sanitizePromptInput()` utility
> - Hardened type guards, redacted error output everywhere
> - All existing tests passing, typecheck clean
>
> **Estimated Effort**: Medium (2-3 days)
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: Task 1 → Task 9 (verification)

---

## Context

### Original Request

Remediate all 15 findings from a security audit of the agentlint project after Opencode SDK migration. Findings span 5 severity levels across streaming, CLI, persistence, orchestration, and TUI layers.

### Project Constraints

- `bun run test` (NEVER `bun test`), `bun run typecheck`
- `exactOptionalPropertyTypes` — never assign `undefined` to optional fields
- ESLint strict: no `as any`, no `@ts-ignore`, `@typescript-eslint/unbound-method`
- Pre-commit hooks enforce typecheck + ESLint + Prettier
- Constitution: local-first, causal-first, agent-aware

---

## Work Objectives

### Core Objective

Fix all 15 security findings without breaking existing functionality or violating project linting/type constraints.

### Definition of Done

- [ ] All 15 findings addressed
- [ ] `bun run test` passes
- [ ] `bun run typecheck` passes
- [ ] ESLint clean (no new warnings)

### Must NOT Have (Guardrails)

- No `as any` or `@ts-ignore` escape hatches
- No setting optional properties to `undefined` (use omission or deletion)
- No new dependencies for security fixes
- No changes to public API contracts
- M5 (MCP auth): documentation-only, no implementation (local-first by design)

---

## Verification Strategy

### Test Decision

- **Infrastructure exists**: YES
- **User wants tests**: Tests-after (verify existing pass; add unit tests for new `sanitizePromptInput` utility)
- **Framework**: Bun test via `bun run test`

---

## Task Dependency Graph

| Task | Depends On | Reason                             | Findings           |
| ---- | ---------- | ---------------------------------- | ------------------ |
| 1    | None       | Standalone critical fix            | C1                 |
| 2    | None       | New utility, no deps               | H1                 |
| 3    | None       | Standalone guard fixes             | H2                 |
| 4    | None       | Standalone redaction wrapping      | H3, H5, H6 (M6)    |
| 5    | None       | Standalone output fix              | H4                 |
| 6    | None       | Standalone JSON.parse hardening    | M1                 |
| 7    | None       | Standalone concurrency fix         | M2, M3             |
| 8    | None       | Standalone fixes                   | M4, M5, M7, L1, L2 |
| 9    | 1-8        | Final verification needs all fixes | ALL                |

## Parallel Execution Graph

```
Wave 1 (Start immediately — ALL independent):
├── Task 1: [C1] Unsafe Object.assign in streaming.ts
├── Task 2: [H1] Prompt injection sanitization utility + application
├── Task 3: [H2] Harden event type guards
├── Task 4: [H3+H5+M6] Redact all error/telemetry output
├── Task 5: [H4] Remove stack traces from JSON/TUI output
├── Task 6: [M1] Safe JSON deserialization
├── Task 7: [M2+M3] Orchestrator race condition + session cleanup
└── Task 8: [M4+M5+M7+L1+L2] Remaining medium/low fixes

Wave 2 (After Wave 1):
└── Task 9: Full verification (typecheck + test + lint)

Critical Path: Any Wave 1 task → Task 9
Parallel Speedup: ~80% (all substantive work parallel)
```

---

## TODOs

- [ ] 1. **[CRITICAL] Fix unsafe Object.assign in streaming.ts**

  **What to do**:
  - In `src/opencode/streaming.ts` at lines ~71 and ~88, replace `Object.assign(metadata, event.data)` with explicit property picks
  - Only copy known safe properties: `name`, `input`, `output`, `isError`
  - Pattern: `const { name, input, output, isError } = event.data; Object.assign(metadata, { ...(name !== undefined ? { name } : {}), ... })`
  - Respect `exactOptionalPropertyTypes` — do NOT write `name: undefined`, use conditional spread

  **Must NOT do**:
  - Do not use `as any` to work around type narrowing
  - Do not change StreamChunk type definitions

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single file, surgical change, clear instructions
  - **Skills**: [`typescript-programmer`]
    - `typescript-programmer`: Needed for exactOptionalPropertyTypes-safe patterns
  - **Omitted**: `git-master` (commit handled separately)

  **Parallelization**: Wave 1 | Blocks: Task 9 | Blocked By: None

  **References**:
  - `src/opencode/streaming.ts:71,88` — the two Object.assign calls to fix
  - `src/opencode/event-guards.ts` — `isToolEventData()` shows the safe pattern
  - `src/orchestration/types.ts` — StreamChunk metadata type definition

  **Acceptance Criteria**:
  - [ ] No `Object.assign(metadata, event.data)` calls remain in streaming.ts
  - [ ] Only `name`, `input`, `output`, `isError` are copied from event data
  - [ ] `bun run typecheck` passes
  - [ ] `bun run test` passes

  **Commit**: YES
  - Message: `fix(security): replace unsafe Object.assign with explicit property mapping in streaming`
  - Files: `src/opencode/streaming.ts`

  **Complexity**: S

---

- [ ] 2. **[HIGH] Create sanitizePromptInput utility and fix prompt injection**

  **What to do**:
  - Create `src/utils/sanitize.ts` with `sanitizePromptInput(input: string): string`
    - Strip/escape newlines (replace `\n` with space or escaped form)
    - Limit length to 1000 chars (truncate with `...`)
    - Escape XML-like control sequences (`<`, `>`)
    - Strip null bytes
  - In `src/cli/commands/analyse.ts` at lines ~728 and ~1319, wrap `directory` param and `agent.prompt` with `sanitizePromptInput()` before interpolation into system prompts
  - Add unit tests in `src/utils/__tests__/sanitize.test.ts`

  **Must NOT do**:
  - Do not modify the prompt template structure itself
  - Do not add external dependencies

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: New utility + integration across one file + tests
  - **Skills**: [`typescript-programmer`]
  - **Omitted**: `prompt-engineer` (not about prompt design, just sanitization)

  **Parallelization**: Wave 1 | Blocks: Task 9 | Blocked By: None

  **References**:
  - `src/cli/commands/analyse.ts:728,1319` — injection points
  - `src/debug/redaction.ts` — pattern reference for a security utility module

  **Acceptance Criteria**:
  - [ ] `sanitizePromptInput()` exists and exported from `src/utils/sanitize.ts`
  - [ ] Both injection points in analyse.ts use the sanitizer
  - [ ] Unit tests cover: newline stripping, length limit, null byte removal, XML escape
  - [ ] `bun run test` passes

  **Commit**: YES
  - Message: `fix(security): add prompt input sanitization to prevent injection in analyse command`
  - Files: `src/utils/sanitize.ts`, `src/utils/__tests__/sanitize.test.ts`, `src/cli/commands/analyse.ts`

  **Complexity**: M

---

- [ ] 3. **[HIGH] Harden event type guards**

  **What to do**:
  - In `src/opencode/event-guards.ts`, strengthen these guards:
    - `isMessageEventData` (line ~59): Check for expected message properties (e.g., `role`, `content`)
    - `isErrorEventData` (line ~74): Check for `message` or `error` string property
    - `isTextEventData` (line ~89): Check for `text` string property
    - `isStatusEventData` (line ~104): Check for `status` string property
  - Follow the existing `isToolEventData` pattern which already validates field existence and types
  - Each guard should check: object is non-null, expected property exists, expected property has correct type

  **Must NOT do**:
  - Do not use Zod for runtime guards (too heavy for hot path)
  - Do not change function signatures

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single file, pattern already established by isToolEventData
  - **Skills**: [`typescript-programmer`]
  - **Omitted**: all others (narrow scope)

  **Parallelization**: Wave 1 | Blocks: Task 9 | Blocked By: None

  **References**:
  - `src/opencode/event-guards.ts:59,74,89,104` — guards to fix
  - `src/opencode/event-guards.ts` — `isToolEventData` is the gold pattern to replicate

  **Acceptance Criteria**:
  - [ ] All 4 guards check structural properties, not just non-null
  - [ ] Each validates at least one discriminating property with type check
  - [ ] `bun run typecheck` passes
  - [ ] `bun run test` passes

  **Commit**: YES
  - Message: `fix(security): add structural validation to event type guards`
  - Files: `src/opencode/event-guards.ts`

  **Complexity**: S

---

- [ ] 4. **[HIGH] Wrap all error outputs with redact() — H3, H5, M6**

  **What to do**:
  - Import `redact` from `src/debug/redaction.ts` in each affected file
  - **H3 — Unredacted error output** in these files, wrap error messages/objects with `redact()`:
    - `src/tools/config/discovery.ts` (lines 379, 402, 516)
    - `src/tools/config/skills.ts` (lines 96, 103)
    - `src/orchestration/config.ts` (lines 207, 213)
    - `src/cli/commands/analyse.ts` (lines 1416, 1426)
    - `src/cli/commands/backup.ts` (lines 93, 121, 165, 230, 284)
    - `src/cli/commands/clean.ts` (line 310)
  - **H5 — Telemetry not redacted**: In `src/opencode/telemetry-tracker.ts` lines 105 and 137, apply `redact()` BEFORE `truncateToolInput/Output`
  - **M6 — Subprocess stderr**: In `src/eval/graders/llm-judge.ts` lines 236 and 292, apply `redact()` to stderr content
  - For JSON output: apply `redact()` to the error message string before it enters the JSON structure

  **Must NOT do**:
  - Do not change the redaction module itself
  - Do not suppress errors entirely — just redact sensitive content

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Many files but repetitive mechanical change
  - **Skills**: [`typescript-programmer`]
  - **Omitted**: all others

  **Parallelization**: Wave 1 | Blocks: Task 9 | Blocked By: None

  **References**:
  - `src/debug/redaction.ts` — `redact()` function to import
  - All affected files listed above with line numbers

  **Acceptance Criteria**:
  - [ ] All listed `console.error`/`console.warn` calls pass messages through `redact()`
  - [ ] Telemetry tracker applies `redact()` before truncation
  - [ ] LLM judge stderr is redacted
  - [ ] `bun run typecheck` passes
  - [ ] `bun run test` passes

  **Commit**: YES
  - Message: `fix(security): redact all error output and telemetry to prevent secret leakage`
  - Files: all 10 files listed above

  **Complexity**: M

---

- [ ] 5. **[HIGH] Remove stack traces from JSON/TUI output**

  **What to do**:
  - `src/cli/renderers/json-renderer.ts` (line ~111): Remove `error.stack` from the JSON output object entirely
  - `src/tui/renderers/tui-stream-renderer.ts` (line ~85): Only include `error.stack` when verbosity is `debug`. Check the existing verbosity/config pattern in the renderer.

  **Must NOT do**:
  - Do not remove stack traces from debug logger output (those are fine)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Two files, simple conditional/removal
  - **Skills**: [`typescript-programmer`]

  **Parallelization**: Wave 1 | Blocks: Task 9 | Blocked By: None

  **References**:
  - `src/cli/renderers/json-renderer.ts:111` — remove stack
  - `src/tui/renderers/tui-stream-renderer.ts:85` — conditional on verbosity
  - `src/orchestration/config.ts` — verbosity config pattern

  **Acceptance Criteria**:
  - [ ] JSON renderer never includes `stack` property in error output
  - [ ] TUI renderer only shows stack at debug verbosity
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `fix(security): remove stack traces from user-facing JSON and TUI output`
  - Files: `src/cli/renderers/json-renderer.ts`, `src/tui/renderers/tui-stream-renderer.ts`

  **Complexity**: S

---

- [ ] 6. **[MEDIUM] Harden JSON deserialization — M1**

  **What to do**:
  - `src/persistence/reviews/storage.ts` (line ~126): Wrap `JSON.parse()` in try-catch, return safe fallback. Add Zod schema validation matching the baseline pattern used elsewhere in persistence layer.
  - `src/persistence/causal/queries.ts` (line ~234): Wrap in try-catch with fallback
  - `src/persistence/learnings/indexer.ts` (line ~298): Wrap in try-catch with fallback
  - Replace `as SomeType` assertions with Zod `.safeParse()` where a schema already exists or is easy to define
  - For cases where Zod is overkill, at minimum ensure try-catch + type guard

  **Must NOT do**:
  - Do not create overly complex Zod schemas for simple structures
  - Do not change DB schema or queries

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: 3 files, moderate thought needed for schema design
  - **Skills**: [`typescript-programmer`]

  **Parallelization**: Wave 1 | Blocks: Task 9 | Blocked By: None

  **References**:
  - `src/persistence/reviews/storage.ts:126` — primary fix target
  - `src/persistence/causal/queries.ts:234`
  - `src/persistence/learnings/indexer.ts:298`
  - Look for existing Zod schemas in `src/persistence/` for baseline patterns

  **Acceptance Criteria**:
  - [ ] All 3 `JSON.parse()` sites wrapped in try-catch
  - [ ] Reviews storage uses Zod validation
  - [ ] No `as` type assertions on JSON.parse results in affected files
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `fix(security): add safe JSON deserialization with validation in persistence layer`
  - Files: 3 persistence files

  **Complexity**: M

---

- [ ] 7. **[MEDIUM] Fix orchestrator race condition and session memory leak — M2, M3**

  **What to do**:
  - **M2**: In `src/opencode/orchestrator.ts`:
    - Add a `_runPromise: Promise<void> | null` field
    - In `run()`: if `_isActive` is already true, throw or return early (prevent concurrent runs)
    - In `interrupt()`: await `_runPromise` if it exists, for clean coordination
  - **M3**: In `src/opencode/sessions.ts`:
    - Add `clearSession(sessionId: string)` method that deletes from the Map
    - Add `clearAll()` method for bulk cleanup
    - In orchestrator's `run()` finally block, call `clearSession()` for the completed session

  **Must NOT do**:
  - Do not introduce Mutex/semaphore libraries
  - Do not change the public orchestrator API signature

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Concurrency requires careful reasoning
  - **Skills**: [`typescript-programmer`]

  **Parallelization**: Wave 1 | Blocks: Task 9 | Blocked By: None

  **References**:
  - `src/opencode/orchestrator.ts:37,91,158,174` — `_isActive` usage sites
  - `src/opencode/sessions.ts:30,47` — Map storage

  **Acceptance Criteria**:
  - [ ] Concurrent `run()` calls are rejected (throws or returns)
  - [ ] `interrupt()` coordinates with active run
  - [ ] `clearSession()` exists and is called after run completes
  - [ ] `bun run typecheck` passes
  - [ ] `bun run test` passes

  **Commit**: YES
  - Message: `fix(security): prevent orchestrator race conditions and session memory leaks`
  - Files: `src/opencode/orchestrator.ts`, `src/opencode/sessions.ts`

  **Complexity**: M

---

- [ ] 8. **[MEDIUM+LOW] Remaining fixes — M4, M5, M7, L1, L2**

  **What to do**:
  - **M4** (`src/opencode/server.ts:37-44`): Before binding port 4096, attempt a test connection. If port in use, throw `new Error('Port 4096 already in use. Is another agentlint instance running?')`.
  - **M5** (`src/opencode/mcp-server.ts:114-120`): Add a code comment documenting the security model: localhost-only, short-lived process, acceptable per local-first constitution principle. No code change needed.
  - **M7** (`src/persistence/common/database.ts:145,165,193`): Replace SQL fragments in error messages with generic descriptions like `"database query failed"`. Log actual SQL at debug level using `createDebugLogger`.
  - **L1** (`src/tui/welcome/git-summary.ts:56`): Replace `() => null` with `(err) => { debugLogger.debug('git command failed', err); return null; }`. Import/create debug logger.
  - **L2** (`src/opencode/server.ts:49-58`): Wrap `serverToClose.close()` in try-catch, log warning on failure.

  **Must NOT do**:
  - M5: Do not implement auth (local-first design decision)
  - M7: Do not remove error logging, just redact SQL content

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Multiple small fixes across several files
  - **Skills**: [`typescript-programmer`]

  **Parallelization**: Wave 1 | Blocks: Task 9 | Blocked By: None

  **References**:
  - `src/opencode/server.ts:37-44,49-58` — port + close fixes
  - `src/opencode/mcp-server.ts:114-120` — doc comment only
  - `src/persistence/common/database.ts:145,165,193` — SQL in errors
  - `src/tui/welcome/git-summary.ts:56` — silent swallow
  - `src/debug/logger.ts` — debug logger pattern

  **Acceptance Criteria**:
  - [ ] Port binding throws descriptive error if port occupied
  - [ ] MCP server has security model documentation comment
  - [ ] Database errors don't contain SQL (debug-only)
  - [ ] Git summary logs errors at debug level
  - [ ] Server close() wrapped in try-catch
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `fix(security): port check, SQL redaction, error handling for remaining audit findings`
  - Files: `src/opencode/server.ts`, `src/opencode/mcp-server.ts`, `src/persistence/common/database.ts`, `src/tui/welcome/git-summary.ts`

  **Complexity**: M

---

- [ ] 9. **[VERIFICATION] Full build verification**

  **What to do**:
  - Run `bun run typecheck` — must pass clean
  - Run `bun run test` — all tests pass
  - Run ESLint: `bun run lint` — no new warnings
  - Spot-check: grep for any remaining `Object.assign(metadata, event` in streaming.ts
  - Spot-check: grep for `error.stack` in json-renderer.ts
  - Spot-check: grep for unredacted `console.error` in touched files

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Just running commands and verifying output
  - **Skills**: [`typescript-programmer`]

  **Parallelization**: Wave 2 (SEQUENTIAL after all Wave 1) | Blocks: None | Blocked By: Tasks 1-8

  **Acceptance Criteria**:
  - [ ] `bun run typecheck` → 0 errors
  - [ ] `bun run test` → all pass
  - [ ] `bun run lint` → clean
  - [ ] No regressions in grep spot-checks

  **Commit**: NO (verification only)

  **Complexity**: S

---

## Commit Strategy

| After Task | Message                                                                                   | Verification     |
| ---------- | ----------------------------------------------------------------------------------------- | ---------------- |
| 1          | `fix(security): replace unsafe Object.assign with explicit property mapping in streaming` | typecheck        |
| 2          | `fix(security): add prompt input sanitization to prevent injection in analyse command`    | typecheck + test |
| 3          | `fix(security): add structural validation to event type guards`                           | typecheck        |
| 4          | `fix(security): redact all error output and telemetry to prevent secret leakage`          | typecheck        |
| 5          | `fix(security): remove stack traces from user-facing JSON and TUI output`                 | typecheck        |
| 6          | `fix(security): add safe JSON deserialization with validation in persistence layer`       | typecheck + test |
| 7          | `fix(security): prevent orchestrator race conditions and session memory leaks`            | typecheck + test |
| 8          | `fix(security): port check, SQL redaction, error handling for remaining audit findings`   | typecheck        |
| 9          | N/A (verification only)                                                                   | full suite       |

---

## Success Criteria

### Verification Commands

```bash
bun run typecheck    # Expected: 0 errors
bun run test         # Expected: all pass
bun run lint         # Expected: clean
```

### Final Checklist

- [ ] All 15 findings addressed (C1, H1-H5, M1-M7, L1-L2)
- [ ] No `as any` or `@ts-ignore` introduced
- [ ] No `undefined` assigned to optional properties
- [ ] No new dependencies added
- [ ] All commits follow conventional format
