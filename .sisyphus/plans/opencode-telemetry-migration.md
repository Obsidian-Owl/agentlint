# Opencode Telemetry Migration

## TL;DR

> **Quick Summary**: Migrate HoneyHive telemetry instrumentation from legacy orchestrator to Opencode orchestrator, extracting shared utilities and eliminating legacy duplication patterns.
>
> **Deliverables**:
>
> - `src/opencode/telemetry-tracker.ts` — Extracted tool/LLM tracking with memory bounds
> - `src/orchestration/telemetry-utils.ts` — Shared truncation + error extraction utilities
> - `src/opencode/orchestrator.ts` — Wired to telemetry tracker
> - `src/opencode/streaming.ts` — Enhanced to emit telemetry metadata on tool/message events
> - Unit tests for all new modules
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 → Task 2 → Task 3 → Task 4 → Task 5

---

## Context

### Original Request

Migrate all HoneyHive telemetry instrumentation from the legacy `Orchestrator` (src/orchestration/orchestrator.ts) to the `OpencodeOrchestrator` (src/opencode/orchestrator.ts). The Opencode migration completely dropped telemetry — config fields exist but are ignored. Additionally, apply design uplifts: extract truncation utilities, eliminate the duplicated tool_result tracking path, and cleanly separate event parsing from telemetry tracking.

### Key Design Decisions

1. **Approach (B) — Orchestrator processes raw events for telemetry**: Rather than enhancing StreamAdapter to pass through telemetry metadata, the orchestrator will consume raw events directly for telemetry while StreamAdapter continues handling UI chunks. This avoids bloating StreamChunk with telemetry-only data and mirrors the legacy pattern where telemetry was orchestrator-owned.
2. **Extracted TelemetryTracker class**: Instead of inlining ~150 lines of tracking state/logic into the orchestrator (as legacy does), extract a focused `TelemetryTracker` class that owns tool tracking maps, memory bounds, orphan cleanup, and the `trackTool`/`trackLLM` dispatch.
3. **Shared truncation utils**: Extract `truncateToolOutput`, `truncateToolInput`, `extractErrorMessage` from legacy orchestrator into `src/orchestration/telemetry-utils.ts` so both orchestrators can use them.
4. **StreamAdapter enhanced with metadata**: StreamAdapter will extract and pass through timing/input/output data in `metadata` fields of tool_start/tool_result chunks, so the TelemetryTracker can correlate events without re-parsing raw events.

### Research Findings

- Opencode SDK events `tool.call.started` have `{ name: string }` data; `tool.call.completed` also have `{ name: string }` — no toolId concept, tools are identified by name
- `message.updated` events carry `tokens: { input, output, reasoning, cache: { read, write } }`, `cost: number`, `finish: string` — this is the LLM usage data source
- The legacy orchestrator uses toolId-based maps (Claude SDK provides tool_use_id); Opencode events use tool name only. The tracker needs a different correlation strategy — tool name + start timestamp, since multiple concurrent calls to the same tool are possible (use a stack/queue per tool name).
- `OrchestratorConfig` already has `telemetryClient`, `telemetrySessionId`, `telemetryParentEventId` — the Opencode orchestrator already accepts these, just ignores them.
- `exactOptionalPropertyTypes` is enforced — must only set optional fields when values are defined (use conditional assignment pattern from legacy).

---

## Work Objectives

### Core Objective

Restore full telemetry parity with legacy orchestrator in Opencode path, with cleaner architecture.

### Concrete Deliverables

- `src/orchestration/telemetry-utils.ts` — shared truncation + error extraction
- `src/opencode/telemetry-tracker.ts` — encapsulated tracking state + dispatch
- Updated `src/opencode/orchestrator.ts` — wired to TelemetryTracker
- Updated `src/opencode/streaming.ts` — enriched metadata on events
- `tests/unit/orchestration/telemetry-utils.test.ts`
- `tests/unit/opencode/telemetry-tracker.test.ts`
- Updated `tests/unit/opencode/orchestrator.test.ts`

### Definition of Done

- [ ] `bun run test` passes (4182+ tests, 0 failures)
- [ ] `bun run typecheck` passes (0 errors)
- [ ] When `useOpencode: true` + telemetry enabled, tool events tracked with name, duration, success, input/output, errors, parent event
- [ ] LLM usage tracked with model, tokens, latency, cost, stopReason, cache tokens, provider
- [ ] Memory bounded: MAX_PENDING_TOOLS=100, TTL=5min cleanup
- [ ] Tool I/O truncated at 5000 chars

### Must Have

- Tool execution telemetry (name, duration, success, input/output, error, parent event)
- LLM usage telemetry (model, tokens, latency, cost, stopReason, cache tokens, provider)
- Memory bounds on tracking maps
- Truncation of large payloads
- Turn tracking for latency calculation
- exactOptionalPropertyTypes compliance
- No duplicated tracking paths

### Must NOT Have (Guardrails)

- No `as any`, `@ts-ignore`, `@ts-expect-error`
- No telemetry logic in StreamAdapter (it provides data via metadata, doesn't track)
- No hardcoded thresholds or judgment logic in tracker (it's data infrastructure)
- No tool orchestration logic in tracker
- No breaking changes to `IOrchestratorTelemetryClient` interface
- No breaking changes to `StreamChunk` type (metadata is already `Record<string, unknown>`)
- Do NOT modify legacy orchestrator's behavior (only extract shared utils)

---

## Verification Strategy

### Test Decision

- **Infrastructure exists**: YES (bun:test, extensive suite)
- **User wants tests**: YES (TDD for new modules)
- **Framework**: bun:test

### Approach

Each new module gets dedicated test file. Existing orchestrator tests extended for telemetry behavior. Test command: `bun run test`.

---

## Task Dependency Graph

| Task                         | Depends On | Reason                                               |
| ---------------------------- | ---------- | ---------------------------------------------------- |
| 1. Extract telemetry utils   | None       | Pure extraction from legacy, no dependencies         |
| 2. Build TelemetryTracker    | Task 1     | Uses truncation utils from Task 1                    |
| 3. Enhance StreamAdapter     | None       | Independent — adds metadata to existing events       |
| 4. Wire orchestrator         | Tasks 2, 3 | Needs TelemetryTracker (T2) and enriched events (T3) |
| 5. Integration test + verify | Task 4     | Needs full wiring to validate end-to-end             |

## Parallel Execution Graph

```
Wave 1 (Start immediately):
├── Task 1: Extract telemetry utils (no dependencies)
└── Task 3: Enhance StreamAdapter metadata (no dependencies)

Wave 2 (After Wave 1):
└── Task 2: Build TelemetryTracker (depends: Task 1)

Wave 3 (After Wave 2):
└── Task 4: Wire orchestrator to TelemetryTracker (depends: Task 2, 3)

Wave 4 (After Wave 3):
└── Task 5: Integration verification + final tests (depends: Task 4)

Critical Path: Task 1 → Task 2 → Task 4 → Task 5
Parallel Speedup: ~20% (Wave 1 parallelism)
```

---

## TODOs

- [ ] 1. Extract shared telemetry utilities

  **What to do**:
  - Create `src/orchestration/telemetry-utils.ts`
  - Extract `truncateToolOutput(output: unknown, maxLength?: number): unknown` from legacy orchestrator (lines 360-402)
  - Extract `truncateToolInput(input: Record<string, unknown>, maxLength?: number): Record<string, unknown>` (lines 412-445)
  - Extract `extractErrorMessage(output: unknown): string | undefined` (lines 503-530)
  - Export all three as named exports
  - Keep signatures identical to legacy private methods (just make public)
  - Create `tests/unit/orchestration/telemetry-utils.test.ts` with tests for:
    - String truncation at boundary
    - Array truncation (>3 items)
    - Object truncation (large JSON)
    - null/undefined passthrough
    - Input truncation with field-level detail
    - Error extraction from string, array, object formats
  - Update legacy orchestrator to import from shared utils (replace private methods with imports) — this validates the extraction didn't break anything

  **Must NOT do**:
  - Change any behavior of the truncation logic
  - Change function signatures
  - Add new truncation features (this is pure extraction)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Pure extraction refactor, single concern, straightforward
  - **Skills**: [`typescript-programmer`]
    - `typescript-programmer`: TypeScript module extraction with exports
  - **Skills Evaluated but Omitted**:
    - `git-master`: Not needed for implementation, commit handled separately

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 3)
  - **Blocks**: Task 2
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/orchestration/orchestrator.ts:360-445` — truncateToolOutput, truncateToolInput implementations to extract verbatim
  - `src/orchestration/orchestrator.ts:503-530` — extractErrorMessage implementation to extract

  **API/Type References**:
  - `src/orchestration/types.ts:84-133` — IOrchestratorTelemetryClient interface showing what toolInput/toolOutput types are

  **Test References**:
  - `tests/unit/opencode/orchestrator.test.ts` — Test structure pattern to follow (bun:test, describe/it blocks)

  **Acceptance Criteria**:
  - [ ] `src/orchestration/telemetry-utils.ts` exists with 3 exported functions
  - [ ] `tests/unit/orchestration/telemetry-utils.test.ts` covers all truncation edge cases
  - [ ] Legacy orchestrator imports from shared utils (private methods replaced)
  - [ ] `bun run test` — all 4182+ tests pass
  - [ ] `bun run typecheck` — 0 errors

  **Commit**: YES
  - Message: `refactor(orchestration): extract shared telemetry utils from legacy orchestrator`
  - Files: `src/orchestration/telemetry-utils.ts`, `src/orchestration/orchestrator.ts`, `tests/unit/orchestration/telemetry-utils.test.ts`
  - Pre-commit: `bun run test && bun run typecheck`

---

- [ ] 2. Build TelemetryTracker class

  **What to do**:
  - Create `src/opencode/telemetry-tracker.ts`
  - Class `TelemetryTracker` with constructor accepting:
    ```typescript
    {
      telemetryClient: IOrchestratorTelemetryClient;
      sessionId: string;
      parentEventId?: string;
      model: string;
      logger: INamespacedLogger;
    }
    ```
  - Internal state:
    - `toolStartTimes: Map<string, number>` — keyed by `toolName:startTime` composite key (no toolId in Opencode events)
    - `toolInputs: Map<string, Record<string, unknown>>` — same key
    - `toolCleanupCounter: number`
    - `turnCount: number`, `turnStartTime: number | undefined`
  - Public methods:
    - `onToolStart(toolName: string, input?: Record<string, unknown>): void` — stores start time + truncated input, runs cleanup every 10 calls, enforces MAX_PENDING_TOOLS=100
    - `onToolComplete(toolName: string, output?: unknown, isError?: boolean): void` — correlates with start (FIFO queue per tool name), computes duration, calls trackToolEx with exactOptionalPropertyTypes pattern
    - `onLLMUsage(data: { inputTokens: number; outputTokens: number; cacheReadTokens?: number; cacheWriteTokens?: number; cost?: number; finishReason?: string }): void` — calls trackLLMEx with all available fields
    - `onTurnStart(): void` — records turnStartTime, increments turnCount
  - Use truncation utils from Task 1
  - Memory bounds: MAX_PENDING_TOOLS=100, TOOL_TRACKING_TTL_MS=5min
  - Create `tests/unit/opencode/telemetry-tracker.test.ts`:
    - Tool start → complete → trackToolEx called with correct args
    - Tool start with no complete (orphan) → cleanup after TTL
    - MAX_PENDING_TOOLS eviction
    - LLM usage tracking with all fields
    - LLM usage tracking with minimal fields (exactOptionalPropertyTypes)
    - Tool input/output truncation applied
    - Error message extraction on failed tools
    - Multiple concurrent tools with same name (FIFO ordering)

  **Must NOT do**:
  - Make judgment calls about data (no "is this slow?", no thresholds beyond memory bounds)
  - Call any tool or orchestration logic
  - Import from StreamAdapter (no circular dependency)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Moderate complexity, new class with state management and tests
  - **Skills**: [`typescript-programmer`]
    - `typescript-programmer`: Production TypeScript with generics, Maps, and proper typing
  - **Skills Evaluated but Omitted**:
    - `prompt-engineer`: No prompts involved
    - `data-scientist`: Not data processing

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 1)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 4
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/orchestration/orchestrator.ts:90-115` — Legacy tracking maps and constants (toolIdToName, toolStartTimes, toolInputs, MAX_PENDING_TOOLS, TOOL_TRACKING_TTL_MS)
  - `src/orchestration/orchestrator.ts:745-762` — Legacy trackToolEx call pattern (exactOptionalPropertyTypes compliance)
  - `src/orchestration/orchestrator.ts:899-928` — Legacy trackLLMEx call pattern
  - `src/orchestration/orchestrator.ts:448-494` — storeToolInput bounds checking + cleanupOrphanedToolEntries

  **API/Type References**:
  - `src/orchestration/types.ts:84-133` — IOrchestratorTelemetryClient interface (the contract TelemetryTracker calls)
  - `src/orchestration/telemetry-utils.ts` — (created in Task 1) truncation + error extraction functions
  - `src/debug/types.ts` — INamespacedLogger interface

  **Documentation References**:
  - Opencode SDK event model: `tool.call.started` has `{ name: string }`, `tool.call.completed` has `{ name: string }` — NO toolId, tools identified by name only

  **Acceptance Criteria**:
  - [ ] `src/opencode/telemetry-tracker.ts` exists with TelemetryTracker class
  - [ ] `tests/unit/opencode/telemetry-tracker.test.ts` with 8+ test cases
  - [ ] `bun run test` — passes
  - [ ] `bun run typecheck` — 0 errors

  **Commit**: YES
  - Message: `feat(opencode): add TelemetryTracker for tool and LLM event tracking`
  - Files: `src/opencode/telemetry-tracker.ts`, `tests/unit/opencode/telemetry-tracker.test.ts`
  - Pre-commit: `bun run test && bun run typecheck`

---

- [ ] 3. Enhance StreamAdapter with telemetry metadata

  **What to do**:
  - Update `src/opencode/streaming.ts`:
    - Handle `message.updated` events: extract `tokens` (input, output, reasoning, cache.read, cache.write), `cost`, `finish` into a StreamChunk of type `status` with metadata containing all token/cost/finish data
    - Enhance `tool.call.started` handler: pass through full `event.data` as metadata (already does this, but ensure `input` field is included if present in event data)
    - Enhance `tool.call.completed` handler: extract timing data (`time.start`, `time.end`), `output`, `input` from event data into metadata
    - Handle `session.error` events: emit as `error` type StreamChunk
  - Update `OpencodeEvent` interface if needed (currently `data?: unknown` which is flexible enough)
  - Add tests to existing test file or create `tests/unit/opencode/streaming.test.ts`:
    - message.updated event produces chunk with token metadata
    - tool.call.completed passes timing/output in metadata
    - session.error produces error chunk
    - Unknown events still return null

  **Must NOT do**:
  - Import TelemetryTracker or telemetry client
  - Make any tracking/aggregation decisions
  - Change existing StreamChunk type definition

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small enhancement to existing class, adding event handlers following existing pattern
  - **Skills**: [`typescript-programmer`]
    - `typescript-programmer`: TypeScript event handling patterns
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: Not UI work despite TUI connection

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/opencode/streaming.ts:27-42` — Existing convertEvent switch pattern to extend
  - `src/opencode/streaming.ts:54-73` — Existing tool event handlers as template

  **API/Type References**:
  - `src/orchestration/types.ts:32-61` — StreamChunk and StreamChunkType (note: `error` type already exists)

  **Documentation References**:
  - Opencode SDK: `message.updated` has `tokens: { input, output, reasoning, cache: { read, write } }`, `cost: number`, `finish: string`
  - Opencode SDK: `tool.call.completed` data has `time: { start, end }`, `input`, `output` fields
  - Opencode SDK: `session.error` has error type and details

  **Acceptance Criteria**:
  - [ ] `message.updated` events produce status chunk with `metadata.tokens`, `metadata.cost`, `metadata.finish`
  - [ ] `tool.call.completed` metadata includes timing data when present
  - [ ] `session.error` events produce error chunk
  - [ ] `bun run test` — passes
  - [ ] `bun run typecheck` — 0 errors

  **Commit**: YES
  - Message: `feat(opencode): enhance StreamAdapter to extract telemetry metadata from events`
  - Files: `src/opencode/streaming.ts`, `tests/unit/opencode/streaming.test.ts`
  - Pre-commit: `bun run test && bun run typecheck`

---

- [ ] 4. Wire OpencodeOrchestrator to TelemetryTracker

  **What to do**:
  - Update `src/opencode/orchestrator.ts`:
    - Import TelemetryTracker
    - In constructor: if `config.telemetryClient` is provided and `config.telemetryClient.isEnabled()`, create `TelemetryTracker` instance with sessionId, parentEventId, model, logger
    - Store as `private readonly telemetryTracker: TelemetryTracker | null`
    - In `run()` method, after session starts:
      - Call `telemetryTracker?.onTurnStart()`
    - In the stream processing loop, intercept chunks AFTER yielding:
      - `tool_start` chunk → `telemetryTracker?.onToolStart(chunk.metadata?.name, chunk.metadata?.input)`
      - `tool_result` chunk → `telemetryTracker?.onToolComplete(chunk.metadata?.name, chunk.metadata?.output, chunk.metadata?.isError)`
      - `status` chunk with `metadata.tokens` → `telemetryTracker?.onLLMUsage({ inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, cost, finishReason })`
    - The tracker is wired, TelemetryTracker does the actual tracking
  - Update `tests/unit/opencode/orchestrator.test.ts`:
    - Test: telemetry client provided → TelemetryTracker created
    - Test: telemetry client not provided → no tracker, no errors
    - Test: tool events forwarded to tracker
    - Test: LLM usage events forwarded to tracker

  **Must NOT do**:
  - Duplicate any tracking logic from TelemetryTracker
  - Parse raw SDK events directly (use StreamAdapter metadata)
  - Change the generator yield behavior (telemetry is side-effect only)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Integration work connecting multiple modules, needs careful wiring
  - **Skills**: [`typescript-programmer`]
    - `typescript-programmer`: Async generator patterns, conditional initialization
  - **Skills Evaluated but Omitted**:
    - `git-master`: Commit handled separately

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 5
  - **Blocked By**: Tasks 2, 3

  **References**:

  **Pattern References**:
  - `src/opencode/orchestrator.ts:63-129` — Current run() method to modify
  - `src/opencode/orchestrator.ts:41-48` — Constructor pattern to extend
  - `src/orchestration/orchestrator.ts:108-115` — Legacy telemetry field initialization pattern

  **API/Type References**:
  - `src/opencode/telemetry-tracker.ts` — (created in Task 2) TelemetryTracker class API
  - `src/orchestration/types.ts:139-224` — OrchestratorConfig with telemetry fields

  **Test References**:
  - `tests/unit/opencode/orchestrator.test.ts` — Existing test patterns (mock server/client/sessionManager)

  **Acceptance Criteria**:
  - [ ] Orchestrator creates TelemetryTracker when telemetry config present
  - [ ] Tool start/complete events forwarded to tracker
  - [ ] LLM usage events forwarded to tracker
  - [ ] No telemetry errors when telemetry not configured
  - [ ] `bun run test` — passes
  - [ ] `bun run typecheck` — 0 errors

  **Commit**: YES
  - Message: `feat(opencode): wire OpencodeOrchestrator to TelemetryTracker`
  - Files: `src/opencode/orchestrator.ts`, `tests/unit/opencode/orchestrator.test.ts`
  - Pre-commit: `bun run test && bun run typecheck`

---

- [ ] 5. Integration verification and final cleanup

  **What to do**:
  - Run full test suite: `bun run test` — verify 4182+ tests pass
  - Run typecheck: `bun run typecheck` — verify 0 errors
  - Verify the legacy orchestrator still works unchanged (its tests should be green from Task 1 refactor)
  - Review: ensure no `as any`, `@ts-ignore`, `@ts-expect-error` introduced
  - Update `src/opencode/index.ts` to export TelemetryTracker if needed for external access
  - Verify exactOptionalPropertyTypes compliance by inspecting all trackToolEx/trackLLMEx call sites

  **Must NOT do**:
  - Change any logic — this is verification only
  - Add features not in scope

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Verification and minor cleanup only
  - **Skills**: [`typescript-programmer`]
    - `typescript-programmer`: TypeScript compliance verification
  - **Skills Evaluated but Omitted**:
    - All others: Pure verification task

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (final)
  - **Blocks**: None
  - **Blocked By**: Task 4

  **References**:

  **Pattern References**:
  - `src/opencode/index.ts` — Module export barrel file

  **Acceptance Criteria**:
  - [ ] `bun run test` — 4182+ tests, 0 failures
  - [ ] `bun run typecheck` — 0 errors
  - [ ] No `as any`, `@ts-ignore`, `@ts-expect-error` in any changed files
  - [ ] Legacy orchestrator tests still pass
  - [ ] exactOptionalPropertyTypes compliance verified

  **Commit**: YES (if any cleanup changes made)
  - Message: `chore(opencode): verify telemetry migration integration`
  - Pre-commit: `bun run test && bun run typecheck`

---

## Commit Strategy

| After Task | Message                                                                            | Files                                     | Verification                        |
| ---------- | ---------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------- |
| 1          | `refactor(orchestration): extract shared telemetry utils from legacy orchestrator` | telemetry-utils.ts, orchestrator.ts, test | `bun run test && bun run typecheck` |
| 2          | `feat(opencode): add TelemetryTracker for tool and LLM event tracking`             | telemetry-tracker.ts, test                | `bun run test && bun run typecheck` |
| 3          | `feat(opencode): enhance StreamAdapter to extract telemetry metadata from events`  | streaming.ts, test                        | `bun run test && bun run typecheck` |
| 4          | `feat(opencode): wire OpencodeOrchestrator to TelemetryTracker`                    | orchestrator.ts, test                     | `bun run test && bun run typecheck` |
| 5          | `chore(opencode): verify telemetry migration integration`                          | index.ts (if changed)                     | `bun run test && bun run typecheck` |

---

## Success Criteria

### Verification Commands

```bash
bun run test       # Expected: 4182+ tests, 0 failures
bun run typecheck  # Expected: 0 errors
```

### Final Checklist

- [ ] Tool calls tracked: name, duration, success, input/output, errors, parent event
- [ ] LLM usage tracked: model, tokens, latency, cost, stopReason, cache tokens, provider
- [ ] Memory bounded: MAX_PENDING_TOOLS=100, TTL=5min
- [ ] Truncation: 5000 char limit on tool I/O
- [ ] Turn tracking for latency
- [ ] No duplicated tracking paths (legacy anti-pattern avoided)
- [ ] Truncation utils shared between orchestrators
- [ ] All existing tests pass
- [ ] New unit tests for all new modules
- [ ] TypeScript clean
- [ ] No `as any` / `@ts-ignore` / `@ts-expect-error`
- [ ] exactOptionalPropertyTypes compliance
