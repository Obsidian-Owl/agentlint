# Opencode Migration — Consolidated Plan

## TL;DR

> **Quick Summary**: Complete remaining Opencode SDK migration (causal tools) + full HoneyHive telemetry migration to Opencode orchestrator.
>
> **Remaining Work**:
>
> - **SDK Migration T12**: Migrate 2 causal tools to Opencode format
> - **Telemetry T1-T5**: Extract shared utils, build TelemetryTracker, enhance StreamAdapter, wire orchestrator, verify
>
> **Total Tasks**: 6
> **Estimated Effort**: Medium
> **Parallel Execution**: YES

---

## Task Dependency Graph

```
Wave 1 (Start immediately — all parallel):
├── C1: Migrate Causal Tools (SDK T12, no dependencies)
├── C2: Extract shared telemetry utils (Telemetry T1, no dependencies)
└── C3: Enhance StreamAdapter metadata (Telemetry T3, no dependencies)

Wave 2 (After C2):
└── C4: Build TelemetryTracker class (Telemetry T2, depends: C2)

Wave 3 (After C4 + C3):
└── C5: Wire orchestrator to TelemetryTracker (Telemetry T4, depends: C3, C4)

Wave 4 (After C5):
└── C6: Integration verification + final cleanup (Telemetry T5, depends: C5)
```

---

## TODOs

- [x] **C1. Migrate Causal Tools (2 tools)** — FROM SDK MIGRATION T12 (already done)

  **What to do**:
  - Migrate tools in `src/tools/causal/`:
    - `trace-issue-tool.ts`
    - `get-patterns-tool.ts`
  - Update imports: `tool` from adapter, not SDK
  - Update return format: remove `content` wrapper
  - Register with MCP server
  - Update tool tests

  **Must NOT do**:
  - Change causal tracing logic

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 1)
  - **Blocks**: Nothing
  - **Blocked By**: None

  **References**:
  - `src/tools/causal/*.ts` — Tool files
  - `src/opencode/tool-adapter.ts` — New tool format (see other migrated tools for pattern)

  **Acceptance Criteria**:
  - [ ] Both tools use new format
  - [ ] No SDK imports
  - [ ] Unit tests pass

  **Commit**: YES
  - Message: `refactor(tools): migrate causal tools to Opencode format`
  - Files: `src/tools/causal/*.ts`

---

- [x] **C2. Extract shared telemetry utilities** — FROM TELEMETRY T1

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
  - Update legacy orchestrator to import from shared utils (replace private methods with imports)

  **Must NOT do**:
  - Change any behavior of the truncation logic
  - Change function signatures
  - Add new truncation features (this is pure extraction)

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 1, with C1 and C3)
  - **Blocks**: C4
  - **Blocked By**: None

  **References**:
  - `src/orchestration/orchestrator.ts:360-445` — truncateToolOutput, truncateToolInput to extract verbatim
  - `src/orchestration/orchestrator.ts:503-530` — extractErrorMessage to extract
  - `src/orchestration/types.ts:84-133` — IOrchestratorTelemetryClient interface

  **Acceptance Criteria**:
  - [ ] `src/orchestration/telemetry-utils.ts` exists with 3 exported functions
  - [ ] `tests/unit/orchestration/telemetry-utils.test.ts` covers all truncation edge cases
  - [ ] Legacy orchestrator imports from shared utils (private methods replaced)
  - [ ] `bun run test` — all tests pass
  - [ ] `bun run typecheck` — 0 errors

  **Commit**: YES
  - Message: `refactor(orchestration): extract shared telemetry utils from legacy orchestrator`

---

- [x] **C3. Enhance StreamAdapter with telemetry metadata** — FROM TELEMETRY T3

  **What to do**:
  - Update `src/opencode/streaming.ts`:
    - Handle `message.updated` events: extract `tokens` (input, output, reasoning, cache.read, cache.write), `cost`, `finish` into a StreamChunk of type `status` with metadata
    - Enhance `tool.call.started` handler: ensure `input` field is included if present
    - Enhance `tool.call.completed` handler: extract timing data, output, input into metadata
    - Handle `session.error` events: emit as `error` type StreamChunk
  - Add tests to `tests/unit/opencode/streaming.test.ts`:
    - message.updated event produces chunk with token metadata
    - tool.call.completed passes timing/output in metadata
    - session.error produces error chunk
    - Unknown events still return null

  **Must NOT do**:
  - Import TelemetryTracker or telemetry client
  - Make any tracking/aggregation decisions
  - Change existing StreamChunk type definition

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 1, with C1 and C2)
  - **Blocks**: C5
  - **Blocked By**: None

  **References**:
  - `src/opencode/streaming.ts:27-42` — Existing convertEvent switch pattern
  - `src/opencode/streaming.ts:54-73` — Existing tool event handlers
  - `src/orchestration/types.ts:32-61` — StreamChunk and StreamChunkType

  **Acceptance Criteria**:
  - [ ] `message.updated` events produce status chunk with `metadata.tokens`, `metadata.cost`, `metadata.finish`
  - [ ] `tool.call.completed` metadata includes timing data when present
  - [ ] `session.error` events produce error chunk
  - [ ] `bun run test` — passes
  - [ ] `bun run typecheck` — 0 errors

  **Commit**: YES
  - Message: `feat(opencode): enhance StreamAdapter to extract telemetry metadata from events`

---

- [x] **C4. Build TelemetryTracker class** — FROM TELEMETRY T2

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
    - `toolStartTimes: Map<string, number>` — keyed by `toolName:startTime` composite key
    - `toolInputs: Map<string, Record<string, unknown>>` — same key
    - `toolCleanupCounter: number`
    - `turnCount: number`, `turnStartTime: number | undefined`
  - Public methods:
    - `onToolStart(toolName: string, input?: Record<string, unknown>): void`
    - `onToolComplete(toolName: string, output?: unknown, isError?: boolean): void`
    - `onLLMUsage(data: { inputTokens: number; outputTokens: number; cacheReadTokens?: number; cacheWriteTokens?: number; cost?: number; finishReason?: string }): void`
    - `onTurnStart(): void`
  - Use truncation utils from C2
  - Memory bounds: MAX_PENDING_TOOLS=100, TOOL_TRACKING_TTL_MS=5min
  - Create `tests/unit/opencode/telemetry-tracker.test.ts` with 8+ tests

  **Must NOT do**:
  - Make judgment calls about data
  - Call any tool or orchestration logic
  - Import from StreamAdapter

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on C2)
  - **Blocks**: C5
  - **Blocked By**: C2

  **References**:
  - `src/orchestration/orchestrator.ts:90-115` — Legacy tracking maps and constants
  - `src/orchestration/orchestrator.ts:745-762` — Legacy trackToolEx call pattern
  - `src/orchestration/orchestrator.ts:899-928` — Legacy trackLLMEx call pattern
  - `src/orchestration/types.ts:84-133` — IOrchestratorTelemetryClient interface
  - `src/debug/types.ts` — INamespacedLogger interface

  **Acceptance Criteria**:
  - [ ] `src/opencode/telemetry-tracker.ts` exists with TelemetryTracker class
  - [ ] `tests/unit/opencode/telemetry-tracker.test.ts` with 8+ test cases
  - [ ] `bun run test` — passes
  - [ ] `bun run typecheck` — 0 errors

  **Commit**: YES
  - Message: `feat(opencode): add TelemetryTracker for tool and LLM event tracking`

---

- [x] **C5. Wire OpencodeOrchestrator to TelemetryTracker** — FROM TELEMETRY T4

  **What to do**:
  - Update `src/opencode/orchestrator.ts`:
    - Import TelemetryTracker
    - In constructor: if `config.telemetryClient` is provided and enabled, create TelemetryTracker
    - Store as `private readonly telemetryTracker: TelemetryTracker | null`
    - In `run()`, after session starts: call `telemetryTracker?.onTurnStart()`
    - In stream processing loop, intercept chunks AFTER yielding:
      - `tool_start` → `telemetryTracker?.onToolStart()`
      - `tool_result` → `telemetryTracker?.onToolComplete()`
      - `status` with `metadata.tokens` → `telemetryTracker?.onLLMUsage()`
  - Update `tests/unit/opencode/orchestrator.test.ts` with 4 new tests

  **Must NOT do**:
  - Duplicate any tracking logic from TelemetryTracker
  - Parse raw SDK events directly
  - Change the generator yield behavior

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocks**: C6
  - **Blocked By**: C3, C4

  **References**:
  - `src/opencode/orchestrator.ts:63-129` — Current run() method
  - `src/opencode/orchestrator.ts:41-48` — Constructor pattern
  - `src/orchestration/types.ts:139-224` — OrchestratorConfig with telemetry fields

  **Acceptance Criteria**:
  - [ ] Orchestrator creates TelemetryTracker when telemetry config present
  - [ ] Tool start/complete events forwarded to tracker
  - [ ] LLM usage events forwarded to tracker
  - [ ] No telemetry errors when telemetry not configured
  - [ ] `bun run test` — passes
  - [ ] `bun run typecheck` — 0 errors

  **Commit**: YES
  - Message: `feat(opencode): wire OpencodeOrchestrator to TelemetryTracker`

---

- [x] **C6. Integration verification and final cleanup** — FROM TELEMETRY T5

  **What to do**:
  - Run full test suite: `bun run test`
  - Run typecheck: `bun run typecheck`
  - Verify legacy orchestrator still works (Task C2 refactor)
  - Review: no `as any`, `@ts-ignore`, `@ts-expect-error`
  - Update `src/opencode/index.ts` to export TelemetryTracker if needed
  - Verify exactOptionalPropertyTypes compliance
  - Mark SDK migration T12 as [x] in `opencode-sdk-migration.md`

  **Must NOT do**:
  - Change any logic — verification only
  - Add features not in scope

  **Parallelization**:
  - **Can Run In Parallel**: NO (final)
  - **Blocks**: None
  - **Blocked By**: C5

  **Acceptance Criteria**:
  - [ ] `bun run test` — all tests pass, 0 failures
  - [ ] `bun run typecheck` — 0 errors
  - [ ] No `as any` / `@ts-ignore` / `@ts-expect-error` in changed files
  - [ ] Legacy orchestrator tests still pass
  - [ ] Causal tools migrated and tested
  - [ ] Telemetry fully wired in Opencode orchestrator

  **Commit**: YES (if cleanup changes made)
  - Message: `chore(opencode): verify consolidated migration - SDK tools + telemetry`

---

## Success Criteria

### Verification Commands

```bash
bun run test       # All tests pass
bun run typecheck  # 0 errors
```

### Final Checklist

**SDK Migration (T12)**:

- [ ] Causal tools (`trace-issue-tool`, `get-patterns-tool`) use new Opencode format
- [ ] No SDK imports in `src/tools/causal/`

**Telemetry Migration**:

- [ ] Tool calls tracked: name, duration, success, input/output, errors, parent event
- [ ] LLM usage tracked: model, tokens, latency, cost, stopReason, cache tokens, provider
- [ ] Memory bounded: MAX_PENDING_TOOLS=100, TTL=5min
- [ ] Truncation: 5000 char limit on tool I/O
- [ ] Turn tracking for latency
- [ ] No duplicated tracking paths
- [ ] Truncation utils shared between orchestrators
- [ ] exactOptionalPropertyTypes compliance
- [ ] No `as any` / `@ts-ignore` / `@ts-expect-error`
