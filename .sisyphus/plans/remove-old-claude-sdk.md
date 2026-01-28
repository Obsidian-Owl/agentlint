# Remove Old Claude Agent SDK & Dead Code

## TL;DR

> **Quick Summary**: Remove all `@anthropic-ai/claude-agent-sdk` imports, delete legacy orchestration files only used by the old SDK, clean up dead/unused exports, and update tests/docs.
>
> **Deliverables**:
>
> - Zero references to `@anthropic-ai/claude-agent-sdk` in codebase
> - Legacy files deleted (orchestrator.ts, streaming.ts, session-state.ts, cognitive-workspace.ts, can-use-tool.ts)
> - `ToolDefinition` type defined locally (no SDK dependency)
> - `toMcpServer()` removed from `IToolRegistry` (only used by deleted orchestrator)
> - Dead exports cleaned from context.ts, retry.ts, index.ts
> - `vfile-matter` removed from package.json
> - Tests and CLAUDE.md updated
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 1 → Task 3 → Task 9 → Task 11

---

## Context

### Original Request

Remove ALL old Claude Agent SDK code after migration to `@opencode-ai/sdk`. Clean up dead code and unused exports.

### Research Findings

**`ToolDefinition` type** (`= SdkMcpToolDefinition<any>`): Used by 38+ files via `src/tools/index.ts`. Must be replaced with a local type definition. The type is essentially opaque — `extractToolName()` probes it with `as any` casts. The new opencode SDK has its own `ToolDefinition` in `src/opencode/mcp-server.ts`.

**`toMcpServer()` method**: Only called by legacy `orchestrator.ts` (being deleted) and tests. The opencode orchestrator does NOT use it. Safe to remove from `IToolRegistry` interface entirely.

**`PermissionResult` type**: Already defined locally in `src/orchestration/types.ts:68`. The `can-use-tool.ts` file imports it from the old SDK unnecessarily — but since `createCanUseToolCallback` is only used by legacy orchestrator.ts, the entire `can-use-tool.ts` file can be deleted.

**`McpSdkServerConfigWithInstance`**: Only used by `tool-registry.ts` for `toMcpServer()`. Removing `toMcpServer()` eliminates this dependency completely.

**`createSdkMcpServer`**: Only used by `tool-registry.ts` `toMcpServer()`. Same — eliminated by removing the method.

**`cognitive-workspace.ts`**: All 4 exports only consumed by `tests/unit/orchestration/cognitive-workspace.test.ts`. No production usage.

**`context.ts`**: `createPreCompactHandler` and `buildPreservedContext` are never imported anywhere. `handleToolResult`, `isLargeResult`, `RESULT_SIZE_THRESHOLD` ARE used.

---

## Work Objectives

### Core Objective

Eliminate all `@anthropic-ai/claude-agent-sdk` dependencies and dead code from the codebase.

### Definition of Done

- [ ] `grep -r '@anthropic-ai/claude-agent-sdk' src/ tests/` returns zero results
- [ ] `bun run typecheck` passes
- [ ] `bun run test` passes
- [ ] No unused exports remain in cleaned files

### Must Have

- Local `ToolDefinition` type replacing `SdkMcpToolDefinition<any>`
- All 38+ files importing `ToolDefinition` continue to work unchanged
- `IToolRegistry` interface without `toMcpServer()`
- Clean barrel exports in `index.ts`

### Must NOT Have (Guardrails)

- DO NOT touch `src/opencode/` files (they're the new implementation)
- DO NOT remove shared infrastructure: types.ts, config.ts, interfaces.ts, checkpoint.ts, checkpoint-types.ts, execution-context.ts
- DO NOT remove `withRetry` from retry.ts (it's used by opencode/orchestrator.ts)
- DO NOT remove `handleToolResult`, `isLargeResult`, `RESULT_SIZE_THRESHOLD` from context.ts
- DO NOT set optional fields to `undefined` (exactOptionalPropertyTypes)
- NEVER run `bun test` directly — always `bun run test`

---

## Verification Strategy

### Test Decision

- **Infrastructure exists**: YES (bun test)
- **User wants tests**: Tests-after (verify existing tests pass after changes)
- **Framework**: bun test via `bun run test`

---

## Task Dependency Graph

| Task | Depends On          | Reason                                                                 |
| ---- | ------------------- | ---------------------------------------------------------------------- |
| 1    | None                | Local type definition, no dependencies                                 |
| 2    | None                | File deletion, independent                                             |
| 3    | 1                   | tool-registry.ts needs local ToolDefinition before removing SDK import |
| 4    | None                | File deletion, independent                                             |
| 5    | None                | File deletion, independent                                             |
| 6    | None                | File deletion, independent                                             |
| 7    | None                | Dead export cleanup, independent                                       |
| 8    | None                | Dead export cleanup, independent                                       |
| 9    | 2, 3, 4, 5, 6, 7, 8 | Barrel must reflect all deletions                                      |
| 10   | 9                   | Tests depend on final state of production code                         |
| 11   | 10                  | Verification depends on all changes complete                           |
| 12   | 9                   | Docs update after code changes finalized                               |
| 13   | None                | Independent file deletion                                              |

## Parallel Execution Graph

```
Wave 1 (Start immediately — all independent):
├── Task 1: Define local ToolDefinition type
├── Task 2: Delete orchestrator.ts
├── Task 4: Delete can-use-tool.ts
├── Task 5: Delete streaming.ts, session-state.ts, cognitive-workspace.ts
├── Task 6: Delete spec contract files
├── Task 7: Clean context.ts dead exports
├── Task 8: Clean retry.ts dead exports
└── Task 13: Remove vfile-matter from package.json

Wave 2 (After Wave 1):
├── Task 3: Rewrite tool-registry.ts (depends: Task 1)
└── Task 9: Rewrite index.ts barrel (depends: Tasks 2-8)

Wave 3 (After Wave 2):
├── Task 10: Fix/remove tests (depends: Task 9)
├── Task 12: Update CLAUDE.md (depends: Task 9)
└── Task 11: Final verification (depends: Task 10)
```

Critical Path: Task 1 → Task 3 → Task 9 → Task 10 → Task 11

---

## TODOs

- [ ] 1. Define local ToolDefinition type in tool-registry.ts

  **What to do**:
  - Replace `export type ToolDefinition = SdkMcpToolDefinition<any>` with a local interface
  - The type is essentially `{ name: string; [key: string]: unknown }` based on how `extractToolName()` probes it
  - Keep it as `Record<string, unknown> & { name?: string }` or similar permissive shape since tools use `as any` casts anyway
  - Actually the simplest approach: `export type ToolDefinition = Record<string, unknown>` — the existing `extractToolName` already treats it as `any`
  - Update JSDoc to explain it's a generic tool definition shape

  **Must NOT do**:
  - Don't change how any of the 38+ files use `ToolDefinition` — it must remain compatible
  - Don't import from opencode's `ToolDefinition` (different type with different semantics)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single type alias replacement in one file
  - **Skills**: [`typescript-programmer`]
    - `typescript-programmer`: TypeScript type definition expertise

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 3
  - **Blocked By**: None

  **References**:
  - `src/orchestration/tool-registry.ts:36` — Current `ToolDefinition = SdkMcpToolDefinition<any>` definition
  - `src/orchestration/tool-registry.ts:218-244` — `extractToolName()` shows how the type is actually consumed (via `as any` casts probing `.name`, `.name.name`, `.definition.name`)
  - `src/tools/index.ts:10,177-264` — How `ToolDefinition[]` is used for tool arrays (cast with `as ToolDefinition[]`)

  **Acceptance Criteria**:
  - [ ] `ToolDefinition` is locally defined, no SDK import
  - [ ] `bun run typecheck` passes

  **Commit**: NO (groups with Task 3)

---

- [ ] 2. Delete legacy orchestrator.ts

  **What to do**:
  - Delete `src/orchestration/orchestrator.ts`
  - This file imports `query` and `SDKMessage` from `@anthropic-ai/claude-agent-sdk`
  - It also imports `createCanUseToolCallback` from `./can-use-tool` (also being deleted)

  **Must NOT do**:
  - Don't delete `src/orchestration/interfaces.ts` — `IOrchestrator` is used by opencode

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single file deletion
  - **Skills**: [`git-master`]
    - `git-master`: Clean deletion with proper git tracking

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 9
  - **Blocked By**: None

  **References**:
  - `src/orchestration/orchestrator.ts:19` — Old SDK import to verify removal
  - `src/orchestration/index.ts:83-84` — Imports from orchestrator.ts that must be removed in Task 9

  **Acceptance Criteria**:
  - [ ] `src/orchestration/orchestrator.ts` no longer exists

  **Commit**: NO (groups with Wave 1)

---

- [ ] 3. Rewrite tool-registry.ts to remove all SDK imports

  **What to do**:
  - Remove the entire `import { createSdkMcpServer, McpSdkServerConfigWithInstance, SdkMcpToolDefinition } from '@anthropic-ai/claude-agent-sdk'` import
  - Remove `toMcpServer()` method from `ToolRegistry` class (only called by deleted orchestrator.ts and tests)
  - Remove `toMcpServer()` from `IToolRegistry` interface
  - Remove `cachedMcpServer` private field
  - Update module JSDoc to remove SDK references
  - Keep: `ToolDefinition` (now local from Task 1), `IToolRegistry`, `ToolRegistry`, `createToolRegistry`, `register()`, `registerMany()`, `get()`, `list()`, `extractToolName()`

  **Must NOT do**:
  - Don't change `register()`, `registerMany()`, `get()`, `list()` signatures
  - Don't change `extractToolName()` logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Targeted removals in single file
  - **Skills**: [`typescript-programmer`]
    - `typescript-programmer`: Interface/class modification

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 9
  - **Blocked By**: Task 1

  **References**:
  - `src/orchestration/tool-registry.ts:15-19` — SDK import to remove
  - `src/orchestration/tool-registry.ts:60` — `toMcpServer()` in interface to remove
  - `src/orchestration/tool-registry.ts:96-97` — `cachedMcpServer` field to remove
  - `src/orchestration/tool-registry.ts:190-210` — `toMcpServer()` method to remove
  - `src/opencode/orchestrator.ts:10` — Imports `IToolRegistry` (must keep working)

  **Acceptance Criteria**:
  - [ ] Zero imports from `@anthropic-ai/claude-agent-sdk` in tool-registry.ts
  - [ ] `IToolRegistry` has no `toMcpServer()` method
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `refactor(orchestration): remove old Claude SDK from tool-registry, define local ToolDefinition type`
  - Files: `src/orchestration/tool-registry.ts`
  - Pre-commit: `bun run typecheck`

---

- [ ] 4. Delete can-use-tool.ts

  **What to do**:
  - Delete `src/orchestration/can-use-tool.ts`
  - Only used by legacy orchestrator.ts (being deleted in Task 2)
  - Imports `PermissionResult` from old SDK (but types.ts has a local copy)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`git-master`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 9
  - **Blocked By**: None

  **References**:
  - `src/orchestration/can-use-tool.ts:14` — Old SDK import
  - `src/orchestration/index.ts:204-205` — Barrel exports to remove in Task 9
  - `src/tui/permissions/tui-permission-handler.ts:10` — Imports `PermissionResult` from `types.ts`, NOT from can-use-tool (safe)

  **Acceptance Criteria**:
  - [ ] `src/orchestration/can-use-tool.ts` no longer exists

  **Commit**: NO (groups with Wave 1)

---

- [ ] 5. Delete legacy-only files: streaming.ts, session-state.ts, cognitive-workspace.ts

  **What to do**:
  - Delete `src/orchestration/streaming.ts` — `StreamProcessor` only used in tests. Note: `StreamChunk`, `IStreamProcessor` etc. are type-exported, but types like `StreamChunk` live in `types.ts`. Verify `IStreamProcessor` is not imported outside tests before deleting.
  - Delete `src/orchestration/session-state.ts` — Only used in its own unit test
  - Delete `src/orchestration/cognitive-workspace.ts` — All 4 exports only used in test

  **IMPORTANT**: Before deleting streaming.ts, verify that `filterByVerbosity`, `shouldDisplay`, `createStreamChunk` (exported from index.ts) are not used by production code. If they are, they must be preserved or moved.

  **Must NOT do**:
  - Don't delete types.ts (StreamChunk and other types are defined there and widely used)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Must verify import usage before deleting, moderate care needed
  - **Skills**: [`typescript-programmer`]
    - `typescript-programmer`: Import analysis

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 9
  - **Blocked By**: None

  **References**:
  - `src/orchestration/streaming.ts` — Legacy StreamProcessor
  - `src/orchestration/session-state.ts` — Legacy session persistence
  - `src/orchestration/cognitive-workspace.ts` — Test-only workspace builder
  - `src/orchestration/index.ts:108-115` — streaming.ts barrel exports to remove
  - `src/orchestration/index.ts:145-155` — session-state.ts barrel exports to remove
  - `src/orchestration/index.ts:161-166` — cognitive-workspace.ts barrel exports to remove

  **Pre-deletion verification**:
  - Run: `grep -r "filterByVerbosity\|shouldDisplay\|createStreamChunk\|StreamProcessor\|createStreamProcessor" src/ --include='*.ts' | grep -v '/orchestration/' | grep -v 'node_modules'`
  - Run: `grep -r "saveState\|loadState\|listSessions\|deleteSession\|getSessionsDir\|buildStateSummary\|SESSION_STATE_VERSION" src/ --include='*.ts' | grep -v '/orchestration/' | grep -v 'node_modules'`
  - Run: `grep -r "buildCognitiveWorkspace\|formatWorkspaceForPrompt\|createProgressSummary\|compressFindingsToSummary" src/ --include='*.ts' | grep -v '/orchestration/' | grep -v 'node_modules'`
  - If any of these return production hits, do NOT delete that file — move the used exports instead

  **Acceptance Criteria**:
  - [ ] Three files deleted (or exports moved if needed)
  - [ ] `bun run typecheck` passes after barrel update (Task 9)

  **Commit**: NO (groups with Wave 1)

---

- [ ] 6. Delete spec contract files with old SDK imports

  **What to do**:
  - Delete `specs/ep02-orchestration-core/contracts/interfaces.ts`
  - Delete `specs/ep08-act-adapters/contracts/interfaces.ts`
  - These are historical spec artifacts, not production code

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`git-master`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: None
  - **Blocked By**: None

  **Acceptance Criteria**:
  - [ ] Both spec contract files deleted

  **Commit**: NO (groups with Wave 1)

---

- [ ] 7. Clean dead exports from context.ts

  **What to do**:
  - Remove `createPreCompactHandler()` function (never imported anywhere)
  - Remove `buildPreservedContext()` function (never imported anywhere)
  - Remove the `PreCompactHandler` and `PreCompactEvent` type exports if they're only used by the deleted functions
  - Keep: `handleToolResult`, `isLargeResult`, `RESULT_SIZE_THRESHOLD`, `ToolResultSummary`

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`typescript-programmer`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 9
  - **Blocked By**: None

  **References**:
  - `src/orchestration/context.ts` — Full file; remove unused functions
  - `src/orchestration/index.ts:121-128` — Barrel exports for context.ts to trim in Task 9

  **Pre-deletion verification**:
  - Run: `grep -r "PreCompactHandler\|PreCompactEvent\|createPreCompactHandler\|buildPreservedContext" src/ tests/ --include='*.ts' | grep -v '/orchestration/context.ts' | grep -v '/orchestration/index.ts'`

  **Acceptance Criteria**:
  - [ ] `createPreCompactHandler` and `buildPreservedContext` no longer exist in context.ts
  - [ ] `bun run typecheck` passes

  **Commit**: NO (groups with Wave 1)

---

- [ ] 8. Clean dead exports from retry.ts

  **What to do**:
  - Remove `DEFAULT_RETRY_CONFIG` export (not used externally)
  - Remove `RETRYABLE_STATUS_CODES` export (not used externally)
  - Remove `isRetryableError()` export (not used externally)
  - Remove `calculateBackoff()` export (not used externally)
  - Remove `withRetryResult()` export (not used externally)
  - Keep: `withRetry()` (used by `src/opencode/orchestrator.ts:19`)
  - Keep types: `RetryConfig`, `RetryCallback` (may be needed by withRetry consumers)
  - The functions can remain as private/unexported if `withRetry` uses them internally

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`typescript-programmer`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 9
  - **Blocked By**: None

  **References**:
  - `src/orchestration/retry.ts` — Full file
  - `src/opencode/orchestrator.ts:19` — `import { withRetry }` — must keep working
  - `src/orchestration/index.ts:178-186` — Barrel exports to trim in Task 9

  **Pre-deletion verification**:
  - Run: `grep -r "DEFAULT_RETRY_CONFIG\|RETRYABLE_STATUS_CODES\|isRetryableError\|calculateBackoff\|withRetryResult\|RetryResult" src/ tests/ --include='*.ts' | grep -v '/orchestration/retry.ts' | grep -v '/orchestration/index.ts'`

  **Acceptance Criteria**:
  - [ ] Dead exports removed or unexported
  - [ ] `withRetry` still exported and functional

  **Commit**: NO (groups with Wave 1)

---

- [ ] 9. Rewrite index.ts barrel exports and factory

  **What to do**:
  - Remove `import { createLegacyOrchestrator } from './orchestrator'` (file deleted)
  - Remove `export { Orchestrator } from './orchestrator'`
  - Simplify `createOrchestrator()` to always return `OpencodeOrchestrator` (no `config.useOpencode` check)
  - Remove streaming.ts re-exports (IStreamProcessor, StreamProcessor, createStreamProcessor, filterByVerbosity, shouldDisplay, createStreamChunk)
  - Remove session-state.ts re-exports (SessionSummary, saveState, loadState, listSessions, deleteSession, getSessionsDir, getSessionFilePath, buildStateSummary, SESSION_STATE_VERSION)
  - Remove cognitive-workspace.ts re-exports (buildCognitiveWorkspace, formatWorkspaceForPrompt, createProgressSummary, compressFindingsToSummary)
  - Remove can-use-tool.ts re-exports (CanUseToolOptions, createCanUseToolCallback)
  - Trim context.ts re-exports (remove PreCompactHandler, PreCompactEvent, createPreCompactHandler, buildPreservedContext)
  - Trim retry.ts re-exports (remove withRetryResult, isRetryableError, calculateBackoff, DEFAULT_RETRY_CONFIG, RETRYABLE_STATUS_CODES, RetryResult)
  - Update module JSDoc at top of file

  **Must NOT do**:
  - Don't remove types.ts exports (StreamChunk, SessionState, etc.)
  - Don't remove config.ts exports
  - Don't remove checkpoint.ts exports
  - Don't remove execution-context.ts exports
  - Don't remove interfaces.ts exports (IOrchestrator)
  - Don't remove tool-registry.ts exports (IToolRegistry, ToolRegistry, createToolRegistry)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Many targeted edits in one file, must be precise
  - **Skills**: [`typescript-programmer`]
    - `typescript-programmer`: Barrel export management

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 10, 11, 12
  - **Blocked By**: Tasks 2, 3, 4, 5, 6, 7, 8

  **References**:
  - `src/orchestration/index.ts` — Full file (206 lines), all sections
  - Each deleted file's export section in index.ts (noted in Tasks 2-8)

  **Acceptance Criteria**:
  - [ ] `createOrchestrator()` always returns `OpencodeOrchestrator`
  - [ ] No imports from deleted files
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `refactor(orchestration): remove legacy SDK files, simplify barrel exports and factory`
  - Files: `src/orchestration/index.ts` + all deleted files from Wave 1
  - Pre-commit: `bun run typecheck`

---

- [ ] 10. Fix/remove tests referencing old SDK

  **What to do**:
  - Delete `tests/unit/orchestration/orchestrator.test.ts` (tests deleted orchestrator.ts)
  - Delete `tests/unit/orchestration/streaming.test.ts` (tests deleted streaming.ts)
  - Delete `tests/unit/orchestration/session-state.test.ts` (tests deleted session-state.ts)
  - Delete `tests/unit/orchestration/cognitive-workspace.test.ts` (tests deleted cognitive-workspace.ts)
  - Update `tests/unit/orchestration/tool-registry.test.ts`:
    - Remove `import { tool } from '@anthropic-ai/claude-agent-sdk'` (line 15)
    - Remove all `toMcpServer()` tests (describe block at line 131+)
    - Replace `tool()` calls with plain objects matching the local `ToolDefinition` type
  - Update `tests/utils/sdk-test-helpers.ts`:
    - Remove `import { tool } from '@anthropic-ai/claude-agent-sdk'`
    - Replace with local helper that creates ToolDefinition-compatible objects
  - Delete or update `tests/e2e/temporal/workflow-live.test.ts` (imports old SDK `query`)
  - Delete or update `tests/e2e/act/subagent-live.test.ts` (imports old SDK `query`)
  - Update `tests/integration/skills/registration.test.ts` — remove `toMcpServer()` calls
  - Update `tests/integration/tools/config/tool-registry.test.ts` — remove `toMcpServer()` calls

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Multiple test files, need to understand test intent to update correctly
  - **Skills**: [`typescript-programmer`]
    - `typescript-programmer`: Test code modification

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 11
  - **Blocked By**: Task 9

  **References**:
  - `tests/unit/orchestration/tool-registry.test.ts:15` — Old SDK `tool` import
  - `tests/unit/orchestration/tool-registry.test.ts:131+` — `toMcpServer()` tests to remove
  - `tests/utils/sdk-test-helpers.ts:10` — Old SDK `tool` import
  - `tests/e2e/temporal/workflow-live.test.ts:21` — Old SDK `query` import
  - `tests/e2e/act/subagent-live.test.ts:15` — Old SDK `query` import
  - `tests/integration/skills/registration.test.ts:144,156` — `toMcpServer()` calls
  - `tests/integration/tools/config/tool-registry.test.ts:116-188` — `toMcpServer()` calls

  **Acceptance Criteria**:
  - [ ] `grep -r '@anthropic-ai/claude-agent-sdk' tests/` returns zero results
  - [ ] `grep -r 'toMcpServer' tests/` returns zero results
  - [ ] `bun run test` passes

  **Commit**: YES
  - Message: `test(orchestration): remove/update tests for old Claude SDK removal`
  - Files: `tests/`
  - Pre-commit: `bun run test`

---

- [ ] 11. Final verification

  **What to do**:
  - Run `grep -r '@anthropic-ai/claude-agent-sdk' src/ tests/ specs/` → zero results
  - Run `bun run typecheck` → passes
  - Run `bun run test` → passes
  - Run `bun run lint` → passes (or document pre-existing issues)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (final)
  - **Blocks**: None
  - **Blocked By**: Tasks 10, 12

  **Acceptance Criteria**:
  - [ ] All four commands pass
  - [ ] Zero old SDK references anywhere

  **Commit**: NO (verification only)

---

- [ ] 12. Update CLAUDE.md references to old SDK

  **What to do**:
  - Update the Orchestration Module table: remove "Legacy Implementation" section (`src/orchestration/` table with Orchestrator, ToolRegistry old description, StreamProcessor, CheckpointHandler, SessionState, TelemetryUtils)
  - Update "New Implementation" to just be "Implementation" (it's the only one now)
  - Remove mention of `createSdkMcpServer`, `McpSdkServerConfigWithInstance`
  - Remove `config.useOpencode` references
  - Update `createOrchestrator()` description
  - Remove references to `cognitive-workspace`, `session-state` as files
  - Remove `StreamProcessor` from component tables
  - Update "Key patterns" section — remove "Tool definitions use adaptTool() wrapper" if that's opencode-specific; keep general patterns

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: Documentation update
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 10)
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 11
  - **Blocked By**: Task 9

  **References**:
  - `CLAUDE.md` — Full file, specifically "Orchestration Module (EP02)" section

  **Acceptance Criteria**:
  - [ ] No references to legacy orchestrator, StreamProcessor, session-state, cognitive-workspace
  - [ ] No references to `@anthropic-ai/claude-agent-sdk`

  **Commit**: YES
  - Message: `docs: update CLAUDE.md to reflect old SDK removal`
  - Files: `CLAUDE.md`

---

- [ ] 13. Remove vfile-matter from package.json

  **What to do**:
  - Remove `vfile-matter` from `dependencies` or `devDependencies` in `package.json`
  - Run `bun install` to update lockfile

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `package.json` — Find and remove `vfile-matter` entry

  **Acceptance Criteria**:
  - [ ] `vfile-matter` not in package.json
  - [ ] `bun install` succeeds

  **Commit**: YES
  - Message: `chore: remove unused vfile-matter dependency`
  - Files: `package.json`, `bun.lock`

---

## Commit Strategy

| After Task(s)             | Message                                                                                               | Verification        |
| ------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------- |
| 1 + 3                     | `refactor(orchestration): remove old Claude SDK from tool-registry, define local ToolDefinition type` | `bun run typecheck` |
| 2 + 4 + 5 + 6 + 7 + 8 + 9 | `refactor(orchestration): remove legacy SDK files, simplify barrel exports and factory`               | `bun run typecheck` |
| 10                        | `test(orchestration): remove/update tests for old Claude SDK removal`                                 | `bun run test`      |
| 12                        | `docs: update CLAUDE.md to reflect old SDK removal`                                                   | —                   |
| 13                        | `chore: remove unused vfile-matter dependency`                                                        | `bun install`       |

---

## Success Criteria

### Verification Commands

```bash
grep -r '@anthropic-ai/claude-agent-sdk' src/ tests/ specs/  # Expected: zero results
grep -r 'toMcpServer' src/                                    # Expected: zero results
bun run typecheck                                              # Expected: pass
bun run test                                                   # Expected: pass
```

### Final Checklist

- [ ] Zero `@anthropic-ai/claude-agent-sdk` references
- [ ] `ToolDefinition` is locally defined
- [ ] `createOrchestrator()` only returns Opencode
- [ ] No dead files (orchestrator.ts, streaming.ts, session-state.ts, cognitive-workspace.ts, can-use-tool.ts)
- [ ] No dead exports in context.ts, retry.ts
- [ ] Clean barrel in index.ts
- [ ] Tests pass
- [ ] Types pass
- [ ] CLAUDE.md updated
- [ ] vfile-matter removed
