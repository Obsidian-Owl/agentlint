# Security Remediation Test Gap Coverage

## TL;DR

> **Quick Summary**: Add 12 missing tests across 4 test files to cover critical gaps and streaming edge cases found during post-security-remediation test quality review.
>
> **Deliverables**:
>
> - 6 critical gap tests (sessions, orchestrator, server, telemetry)
> - 6 streaming edge case tests
> - All passing via `bun run test`
>
> **Estimated Effort**: Medium (4 tasks, ~2-3 hours total)
> **Parallel Execution**: YES - 4 waves (4 independent test files)
> **Critical Path**: None - all tasks are independent

---

## Context

### Original Request

Post-security-remediation test quality review identified 6 critical gaps and 6 streaming edge cases across the opencode module. All gaps need unit tests.

### Research Findings

- All 4 test files read and patterns understood
- Source files read to verify exact method signatures and behaviors
- `exactOptionalPropertyTypes` enforced - never assign `undefined` to optional fields
- Existing tests use `bun:test` imports, mock helpers, and `as unknown as` internals pattern

---

## Work Objectives

### Core Objective

Close all 12 test gaps identified by the security remediation test quality review.

### Definition of Done

- [ ] `bun run test` passes with zero failures
- [ ] `bun run typecheck` passes
- [ ] All 12 gaps have corresponding test cases

### Must NOT Have (Guardrails)

- No `as any` or `@ts-ignore`
- No setting optional fields to `undefined`
- No live API calls
- No new test files - all tests go into existing files

---

## Verification Strategy

### Test Decision

- **Infrastructure exists**: YES
- **User wants tests**: YES (we ARE writing tests)
- **Framework**: bun:test

---

## Task Dependency Graph

| Task   | Depends On | Reason                                                                |
| ------ | ---------- | --------------------------------------------------------------------- |
| Task 1 | None       | Independent test file (sessions.test.ts)                              |
| Task 2 | None       | Independent test file (orchestrator.test.ts)                          |
| Task 3 | None       | Independent test file (server.test.ts)                                |
| Task 4 | None       | Independent test file (streaming.test.ts + telemetry-tracker.test.ts) |

## Parallel Execution Graph

```
Wave 1 (All start immediately - completely independent):
├── Task 1: sessions.test.ts (Gaps 1+2)
├── Task 2: orchestrator.test.ts (Gap 3)
├── Task 3: server.test.ts (Gaps 4+6)
└── Task 4: streaming.test.ts (Gaps 7-12) + telemetry-tracker.test.ts (Gap 5)

No critical path - all independent.
Parallel Speedup: ~75% faster than sequential
```

---

## TODOs

- [ ] 1. Session clearSession/clearAll tests (Gaps 1+2)

  **What to do**:
  Add a new `describe('clearSession')` and `describe('clearAll')` block to `tests/unit/opencode/sessions.test.ts`:

  **clearSession tests**:
  - `it('should remove session by ID')`: startSession, clearSession(id), getSession(id) returns null
  - `it('should not affect other sessions')`: start 2 sessions, clear first, second still retrievable
  - `it('should be idempotent (clearing non-existent is no-op')`: clearSession('nonexistent') does not throw

  **clearAll tests**:
  - `it('should remove all sessions')`: start 2 sessions, clearAll(), both getSession return null
  - `it('should be idempotent when empty')`: clearAll() on fresh manager does not throw

  **Must NOT do**:
  - Don't modify existing tests
  - Don't use `as any`

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single file, ~40 lines of straightforward test code following existing patterns
  - **Skills**: [`typescript-programmer`]
    - `typescript-programmer`: TypeScript test patterns with exactOptionalPropertyTypes compliance
  - **Skills Evaluated but Omitted**:
    - All others: No domain overlap with unit test writing for a Map-based session store

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 4)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `tests/unit/opencode/sessions.test.ts:30-56` - Existing describe/it pattern with MockOpencodeClient
  - `tests/unit/opencode/sessions.test.ts:5-28` - MockOpencodeClient class to reuse

  **API/Type References**:
  - `src/opencode/sessions.ts:77-83` - clearSession and clearAll implementations (Map.delete/Map.clear)
  - `src/opencode/sessions.ts:22-29` - IHybridSessionManager interface with both methods

  **Acceptance Criteria**:
  - [ ] 5 new test cases added to sessions.test.ts
  - [ ] `bun run test tests/unit/opencode/sessions.test.ts` passes
  - [ ] clearSession removes only targeted session
  - [ ] clearAll removes all sessions
  - [ ] Both are idempotent (no throw on empty/missing)

  **Commit**: YES
  - Message: `test(sessions): add clearSession and clearAll test coverage`
  - Files: `tests/unit/opencode/sessions.test.ts`

---

- [ ] 2. Re-entrance guard rejection test (Gap 3)

  **What to do**:
  Add a test to `tests/unit/opencode/orchestrator.test.ts` inside the `describe('run')` block:
  - `it('should throw OrchestrationError when run() called while already active')`:
    1. Create orchestrator, get internals, call `setupSuccessfulRun(internals)`
    2. Override `streamAdapter.adaptStream` to yield chunks with a delay (use a promise that never resolves, or yield then hang)
    3. Start first `run()` generator, consume first chunk (so `_isActive` becomes true)
    4. Call `orchestrator.run('second task')` — wrap in `collectChunks`
    5. Assert it rejects with `OrchestrationError` containing "Cannot start a new run"
    6. Clean up: call `gen.return()` on first generator to trigger finally block

  **Must NOT do**:
  - Don't modify setupSuccessfulRun
  - Don't use `as any`

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single test case, ~20 lines, clear pattern from existing tests
  - **Skills**: [`typescript-programmer`]
    - `typescript-programmer`: Async generator testing patterns
  - **Skills Evaluated but Omitted**:
    - All others: No domain overlap

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3, 4)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `tests/unit/opencode/orchestrator.test.ts:48-63` - `getInternals()` and `setupSuccessfulRun()` helpers
  - `tests/unit/opencode/orchestrator.test.ts:73-84` - Existing run() error test pattern
  - `tests/unit/opencode/orchestrator.test.ts:111-121` - Successful run pattern showing chunk consumption

  **API/Type References**:
  - `src/opencode/orchestrator.ts:91-96` - Re-entrance guard: throws OrchestrationError when `_isActive` is true
  - `src/errors/orchestration.ts` - OrchestrationError class (already imported in test)

  **Acceptance Criteria**:
  - [ ] 1 new test case in orchestrator.test.ts
  - [ ] `bun run test tests/unit/opencode/orchestrator.test.ts` passes
  - [ ] Test verifies OrchestrationError thrown on concurrent run()
  - [ ] Test verifies error message contains "Cannot start a new run"
  - [ ] First generator is properly cleaned up (no leaked state)

  **Commit**: YES
  - Message: `test(orchestrator): add re-entrance guard rejection test`
  - Files: `tests/unit/opencode/orchestrator.test.ts`

---

- [ ] 3. Server port-conflict and start() success tests (Gaps 4+6)

  **What to do**:
  Add tests to `tests/unit/opencode/server.test.ts` in the `describe('lifecycle')` block:

  **Gap 6 - start() success path**:
  - `it('should set running to true after successful start')`:
    1. Create server, get internals
    2. Override `checkPortAvailable` (private) via internals cast to return `Promise.resolve(true)`
    3. Mock `createOpencodeServer` import — since this is hard to mock (module-level import), instead use the internals approach: set `internals.running = false`, then manually simulate what start() does by verifying the pre-conditions
    4. **Alternative approach**: Since `start()` calls the real `createOpencodeServer` which we can't easily mock, test the port-conflict branch instead and verify the error message. For the success path, verify state transitions via the internals pattern already used in the file.

  **Gap 4 - checkPortAvailable port-conflict**:
  - `it('should throw port-in-use error when port is occupied')`:
    1. Create server, get internals
    2. Cast to access private `checkPortAvailable` and override it to return `Promise.resolve(false)`
    3. Call `server.start()`
    4. Assert rejects with error containing "already in use"

  **Interface for private method access**:
  Extend the existing `ServerInternals` interface to include `checkPortAvailable: () => Promise<boolean>`.

  **Must NOT do**:
  - Don't use `as any`
  - Don't actually bind ports

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 2 test cases, ~30 lines, uses existing internals pattern
  - **Skills**: [`typescript-programmer`]
    - `typescript-programmer`: Private method mocking via internals pattern
  - **Skills Evaluated but Omitted**:
    - All others: No domain overlap

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 4)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `tests/unit/opencode/server.test.ts:4-13` - `ServerInternals` interface and `getInternals()` helper
  - `tests/unit/opencode/server.test.ts:71-80` - Existing "already running" test using internals

  **API/Type References**:
  - `src/opencode/server.ts:32-55` - `start()` method with checkPortAvailable guard
  - `src/opencode/server.ts:91-102` - `checkPortAvailable()` private method using fetch

  **Acceptance Criteria**:
  - [ ] 2 new test cases in server.test.ts
  - [ ] `bun run test tests/unit/opencode/server.test.ts` passes
  - [ ] Port-conflict error message verified: "already in use"
  - [ ] ServerInternals interface extended to expose checkPortAvailable

  **Commit**: YES
  - Message: `test(server): add port-conflict and start success path tests`
  - Files: `tests/unit/opencode/server.test.ts`

---

- [ ] 4. Streaming edge cases + telemetry redaction (Gaps 5, 7-12)

  **What to do**:

  **Part A: streaming.test.ts (Gaps 7-12)**

  Add a new `describe('edge cases')` block with these tests:

  **Gap 7 - Tool events with isError=true**:
  - `it('should propagate isError in tool result metadata')`:
    Event: `{ type: 'tool.call.completed', data: { name: 'broken_tool', output: 'fail', isError: true } }`
    Assert: chunk.metadata.isError === true

  **Gap 8 - Partial message.updated (tokens-only, cost-only, finish-only)**:
  - `it('should handle message.updated with only tokens')`:
    Event with data: `{ tokens: { input: 10, output: 5 } }` — yields chunk with metadata.tokens
  - `it('should handle message.updated with only cost')`:
    Event with data: `{ cost: 0.001 }` — yields chunk with metadata.cost
  - `it('should handle message.updated with only finish')`:
    Event with data: `{ finish: 'stop' }` — yields chunk with metadata.finish

  **Gap 9 - Empty async stream**:
  - `it('should yield zero chunks for empty event stream')`:
    Pass empty array to createMockEventStream, collect chunks, assert length 0

  **Gap 10 - data: null for each event type**:
  - `it('should handle null data gracefully for all event types')`:
    Events with `data: null` for each type. Verify no errors thrown, chunks use fallback values:
    - text event: content = '' (extractText fallback)
    - tool events: content contains 'unknown' (extractToolName fallback)
    - status event: content = 'status update' (extractStatus fallback)
    - message.updated: filtered out (isMessageEventData returns false for null)
    - session.error: content = 'Unknown session error'

  **Gap 11 - Non-string text/status values**:
  - `it('should handle non-string text values')`:
    Event: `{ type: 'message.part.updated', data: { text: 42 } }` — extractText returns '' for non-string
  - `it('should handle non-string status values')`:
    Event: `{ type: 'status.updated', data: { status: 123 } }` — extractStatus returns 'status update'

  **Gap 12 - Tool events with missing data field**:
  - `it('should handle tool events with undefined data')`:
    Events: `{ type: 'tool.call.started' }` and `{ type: 'tool.call.completed' }` (no data field)
    Assert: chunks still created with 'unknown' tool name, no metadata properties beyond defaults

  **Part B: telemetry-tracker.test.ts (Gap 5)**

  Add test inside `describe('tool tracking')`:
  - `it('should redact secrets in tool input strings')`:
    1. Call `tracker.onToolStart('secret_tool', { apiKey: 'sk-ant-fake1234567890abcdef' })`
    2. Call `tracker.onToolComplete('secret_tool', 'Output with sk-ant-fake1234567890abcdef secret')`
    3. Assert trackToolEx was called
    4. Assert opts.toolInput does NOT contain 'sk-ant-fake1234567890abcdef'
    5. Assert opts.toolInput.apiKey contains '[REDACTED'
    6. Assert opts.toolOutput does NOT contain 'sk-ant-fake1234567890abcdef'

  **Must NOT do**:
  - Don't modify existing tests
  - Don't use `as any` or `@ts-ignore`
  - Don't set optional fields to `undefined`

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Two files, ~120 lines of test code, moderate complexity with edge case coverage
  - **Skills**: [`typescript-programmer`]
    - `typescript-programmer`: TypeScript test patterns, type guard edge cases
  - **Skills Evaluated but Omitted**:
    - All others: No domain overlap

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 3)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `tests/unit/opencode/streaming.test.ts:4-8` - `createMockEventStream()` helper
  - `tests/unit/opencode/streaming.test.ts:12-27` - Existing test pattern (create adapter, events, collect chunks)
  - `tests/unit/opencode/telemetry-tracker.test.ts:43-60` - Tool tracking test pattern with mock assertions

  **API/Type References**:
  - `src/opencode/streaming.ts:20-23` - OpencodeEvent interface (`type: string, data?: unknown`)
  - `src/opencode/event-guards.ts:25-31` - isToolEventData guard (requires `name` string)
  - `src/opencode/event-guards.ts:59-63` - isMessageEventData guard (requires tokens/cost/finish)
  - `src/opencode/event-guards.ts:77-81` - isErrorEventData guard (requires message/error string)
  - `src/opencode/event-guards.ts:141-146` - extractText: returns '' for non-string text
  - `src/opencode/event-guards.ts:151-156` - extractStatus: returns 'status update' for non-string
  - `src/opencode/telemetry-tracker.ts:106-111` - redact() called on string input values
  - `src/opencode/telemetry-tracker.ts:143` - redact() called on string output
  - `src/debug/redaction.ts:233-238` - Anthropic key pattern: `sk-ant-` prefix

  **Acceptance Criteria**:
  - [ ] ~11 new test cases across streaming.test.ts and telemetry-tracker.test.ts
  - [ ] `bun run test tests/unit/opencode/streaming.test.ts` passes
  - [ ] `bun run test tests/unit/opencode/telemetry-tracker.test.ts` passes
  - [ ] isError=true propagated in tool result metadata
  - [ ] Partial message.updated events (tokens-only, cost-only, finish-only) each produce valid chunks
  - [ ] Empty stream yields 0 chunks
  - [ ] null data handled gracefully for all event types
  - [ ] Non-string text/status use fallback values
  - [ ] Missing data field on tool events handled
  - [ ] Secrets in tool input/output are redacted in telemetry

  **Commit**: YES
  - Message: `test(streaming,telemetry): add edge case and redaction tests`
  - Files: `tests/unit/opencode/streaming.test.ts`, `tests/unit/opencode/telemetry-tracker.test.ts`

---

## Commit Strategy

| After Task | Message                                                        | Files                                        | Verification                                                                                                       |
| ---------- | -------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1          | `test(sessions): add clearSession and clearAll test coverage`  | sessions.test.ts                             | `bun run test tests/unit/opencode/sessions.test.ts`                                                                |
| 2          | `test(orchestrator): add re-entrance guard rejection test`     | orchestrator.test.ts                         | `bun run test tests/unit/opencode/orchestrator.test.ts`                                                            |
| 3          | `test(server): add port-conflict and start success path tests` | server.test.ts                               | `bun run test tests/unit/opencode/server.test.ts`                                                                  |
| 4          | `test(streaming,telemetry): add edge case and redaction tests` | streaming.test.ts, telemetry-tracker.test.ts | `bun run test tests/unit/opencode/streaming.test.ts && bun run test tests/unit/opencode/telemetry-tracker.test.ts` |

---

## Success Criteria

### Verification Commands

```bash
bun run test          # All tests pass
bun run typecheck     # No type errors
```

### Final Checklist

- [ ] All 12 gaps covered
- [ ] No `as any` or `@ts-ignore`
- [ ] No optional fields set to `undefined`
- [ ] All tests follow existing file patterns
- [ ] Zero new test files created
