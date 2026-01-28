# Tech Debt Remediation: OpencodeOrchestrator

## TL;DR

> **Quick Summary**: Fix 4 tech debt findings in `src/opencode/orchestrator.ts` - server cleanup on error, retry logic for startup, debug logging, and timeout handling.
>
> **Deliverables**:
>
> - Properly cleaned up server in finally block
> - Retry-wrapped server.start() and client.connect()
> - Debug logging throughout run() method
> - AbortController timeout for event stream iteration
>
> **Estimated Effort**: Short (2-3 hours)
> **Parallel Execution**: NO - sequential (all changes in same method)
> **Critical Path**: Task 1 → Task 2 → Task 3 → Task 4

---

## Context

### Original Request

Fix 4 tech debt findings identified in `src/opencode/orchestrator.ts`:

1. P1: SILENT_FAILURE - Server not stopped on error
2. P1: NO_RETRY_LOGIC - No retry for startup operations
3. P2: NO_DEBUG_LOG - No logging in run() method
4. P2: MISSING_TIMEOUT - Event stream has no timeout

### Technical Approach

All 4 fixes follow existing codebase patterns:

- Retry: `withRetry()` from `src/orchestration/retry.ts`
- Logging: `getDefaultLogger().child()` from `src/debug/logger.ts`
- Timeout: AbortController pattern (standard JavaScript)

### Test Infrastructure

- Test framework: Bun test (configured in `bunfig.toml`)
- Related tests exist: `tests/unit/opencode/*.test.ts`
- **Gap**: No existing tests for `OpencodeOrchestrator` - will add

---

## Work Objectives

### Core Objective

Remediate 4 tech debt findings to improve reliability and debuggability of the Opencode orchestrator.

### Concrete Deliverables

- Modified `src/opencode/orchestrator.ts` with all 4 fixes
- New test file `tests/unit/opencode/orchestrator.test.ts`

### Definition of Done

- [ ] `bun run test` passes
- [ ] All 4 findings verified fixed via code review
- [ ] New tests cover failure scenarios

### Must Have

- Server stops on error (no orphan processes)
- Transient failures retry with backoff
- Debug logs at key lifecycle points
- Configurable timeout for stream iteration

### Must NOT Have (Guardrails)

- Do NOT change public API signatures
- Do NOT modify other files except the target and new test
- Do NOT add new dependencies
- Do NOT increase default retry counts beyond codebase norms (8 max)
- Do NOT make timeout mandatory - keep it optional with sensible default

---

## Verification Strategy

### Test Decision

- **Infrastructure exists**: YES (Bun test)
- **User wants tests**: YES (TDD-light - tests after due to refactor nature)
- **Framework**: bun test
- **QA approach**: Tests-after for refactoring, unit tests for new behavior

---

## Execution Strategy

### Sequential Execution Required

All 4 tasks modify the same `run()` method (lines 54-75). Must be sequential to avoid merge conflicts.

```
Task 1: Add logger field + imports (foundation)
    ↓
Task 2: Add server.stop() in finally block
    ↓
Task 3: Wrap startup with withRetry()
    ↓
Task 4: Add AbortController timeout
    ↓
Task 5: Add unit tests
```

### Dependency Matrix

| Task | Depends On | Blocks | Notes                              |
| ---- | ---------- | ------ | ---------------------------------- |
| 1    | None       | 2,3,4  | Foundation: imports + logger field |
| 2    | 1          | None   | Simple finally block addition      |
| 3    | 1          | None   | Wrap startup calls                 |
| 4    | 1          | None   | Add timeout to stream iteration    |
| 5    | 1,2,3,4    | None   | Tests verify all changes           |

---

## TODOs

- [ ] 1. Add Debug Logger Infrastructure

  **What to do**:
  - Add imports: `getDefaultLogger`, `DEBUG_NAMESPACES`, `INamespacedLogger`
  - Add private field: `private readonly logger: INamespacedLogger`
  - Initialize in constructor: `this.logger = getDefaultLogger().child(DEBUG_NAMESPACES.ORCHESTRATION)`
  - Add debug logs at key points in `run()`:
    - Entry: `this.logger.debug('Starting run', { task })`
    - Server started: `this.logger.debug('Server started')`
    - Client connected: `this.logger.debug('Client connected')`
    - Session started: `this.logger.debug('Session started', { sessionId })`
    - Stream complete: `this.logger.debug('Stream complete')`
    - Finally block: `this.logger.debug('Cleanup complete')`

  **Must NOT do**:
  - Do NOT log full task content (may contain sensitive data)
  - Do NOT change log levels to info/warn (keep debug for verbose output)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single file modification, clear pattern to follow
  - **Skills**: [`dev-testing`]
    - `dev-testing`: May need to verify logging in tests

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (foundation for other tasks)
  - **Blocks**: Tasks 2, 3, 4
  - **Blocked By**: None

  **References**:
  - `src/debug/logger.ts:442-447` - `getDefaultLogger()` singleton pattern
  - `src/debug/logger.ts:152-154` - `.child()` creates namespaced logger
  - `src/debug/namespaces.ts:47` - `DEBUG_NAMESPACES.ORCHESTRATION` constant
  - `src/orchestration/retry.ts:226` - Example usage of logger.child() pattern

  **Acceptance Criteria**:
  - [ ] Imports added at top of file
  - [ ] `logger` field added to class
  - [ ] Logger initialized in constructor
  - [ ] Debug logs added at 6 key points
  - [ ] `bun run test` → PASS

  **Commit**: YES
  - Message: `fix(opencode): add debug logging to orchestrator`
  - Files: `src/opencode/orchestrator.ts`
  - Pre-commit: `bun run test`

---

- [ ] 2. Fix Server Cleanup in Finally Block (P1: SILENT_FAILURE)

  **What to do**:
  - In `finally` block (lines 72-74), add `await this.server.stop()`
  - Wrap in try-catch to handle stop() failures gracefully
  - Log cleanup success/failure

  **Target code** (before):

  ```typescript
  } finally {
    this._isActive = false;
  }
  ```

  **Target code** (after):

  ```typescript
  } finally {
    try {
      await this.server.stop();
      this.logger.debug('Server stopped');
    } catch (stopError) {
      this.logger.warn('Server stop failed', {
        error: stopError instanceof Error ? stopError.message : String(stopError)
      });
    }
    this._isActive = false;
  }
  ```

  **Must NOT do**:
  - Do NOT throw from finally block (masks original error)
  - Do NOT skip setting `_isActive = false` if stop fails

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: ~5 line change, clear pattern
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: None
  - **Blocked By**: Task 1 (needs logger)

  **References**:
  - `src/opencode/orchestrator.ts:72-74` - Current finally block
  - `src/opencode/server.ts` - `OpencodeServerManager.stop()` method signature

  **Acceptance Criteria**:
  - [ ] `this.server.stop()` called in finally block
  - [ ] Stop failure logged but doesn't throw
  - [ ] `_isActive = false` always executed
  - [ ] `bun run test` → PASS

  **Commit**: YES
  - Message: `fix(opencode): stop server in finally block to prevent orphan processes`
  - Files: `src/opencode/orchestrator.ts`
  - Pre-commit: `bun run test`

---

- [ ] 3. Add Retry Logic for Startup Operations (P1: NO_RETRY_LOGIC)

  **What to do**:
  - Add import: `withRetry` from `../orchestration/retry`
  - Wrap `this.server.start()` with `withRetry()`
  - Wrap `this.client.connect()` with `withRetry()`
  - Use conservative retry config: `{ maxRetries: 3 }` (startup should be fast)
  - Log retry attempts via debug logger

  **Target code** (before):

  ```typescript
  await this.server.start();
  yield this.createChunk('status', 'normal', 'Server started');
  await this.client.connect();
  ```

  **Target code** (after):

  ```typescript
  await withRetry(
    () => this.server.start(),
    { maxRetries: 3 },
    (attempt, delay, error) => {
      this.logger.warn('Server start retry', { attempt, delayMs: delay, error: error.message });
    }
  );
  yield this.createChunk('status', 'normal', 'Server started');

  await withRetry(
    () => this.client.connect(),
    { maxRetries: 3 },
    (attempt, delay, error) => {
      this.logger.warn('Client connect retry', { attempt, delayMs: delay, error: error.message });
    }
  );
  ```

  **Must NOT do**:
  - Do NOT use default maxRetries (8) - too long for startup
  - Do NOT retry on non-transient errors (withRetry handles this)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Clear pattern from retry.ts, ~15 line change
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: None
  - **Blocked By**: Task 1 (needs logger for retry callback)

  **References**:
  - `src/orchestration/retry.ts:220-278` - `withRetry()` function signature and usage
  - `src/orchestration/retry.ts:52` - `RetryCallback` type for onRetry parameter
  - `src/orchestration/retry.ts:61-67` - Default config values

  **Acceptance Criteria**:
  - [ ] `withRetry` import added
  - [ ] `server.start()` wrapped with retry (maxRetries: 3)
  - [ ] `client.connect()` wrapped with retry (maxRetries: 3)
  - [ ] Retry attempts logged as warnings
  - [ ] `bun run test` → PASS

  **Commit**: YES
  - Message: `fix(opencode): add retry logic for server/client startup`
  - Files: `src/opencode/orchestrator.ts`
  - Pre-commit: `bun run test`

---

- [ ] 4. Add Timeout for Event Stream Iteration (P2: MISSING_TIMEOUT)

  **What to do**:
  - Add configurable timeout (default: 5 minutes = 300000ms)
  - Add `streamTimeoutMs` to config or use constant
  - Create AbortController before stream iteration
  - Set timeout to abort controller
  - Check abort signal in stream loop
  - Clear timeout in finally
  - Log timeout occurrence

  **Target code** (before):

  ```typescript
  const events = this.client.subscribe() as AsyncIterable<OpencodeEvent>;
  for await (const chunk of this.streamAdapter.adaptStream(events)) {
    yield chunk;
  }
  ```

  **Target code** (after):

  ```typescript
  const STREAM_TIMEOUT_MS = 300_000; // 5 minutes
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    this.logger.warn('Stream timeout reached', { timeoutMs: STREAM_TIMEOUT_MS });
    controller.abort();
  }, STREAM_TIMEOUT_MS);

  try {
    const events = this.client.subscribe() as AsyncIterable<OpencodeEvent>;
    for await (const chunk of this.streamAdapter.adaptStream(events)) {
      if (controller.signal.aborted) {
        this.logger.debug('Stream aborted due to timeout');
        break;
      }
      yield chunk;
    }
  } finally {
    clearTimeout(timeoutId);
  }
  ```

  **Must NOT do**:
  - Do NOT make timeout too short (would interrupt valid long operations)
  - Do NOT throw on timeout (graceful degradation - just break loop)
  - Do NOT forget to clear timeout (memory leak)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Standard AbortController pattern, ~15 line change
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: Task 5
  - **Blocked By**: Task 1 (needs logger)

  **References**:
  - `src/opencode/orchestrator.ts:68-71` - Current stream iteration
  - MDN AbortController docs for pattern reference

  **Acceptance Criteria**:
  - [ ] AbortController created with timeout
  - [ ] Timeout set to 5 minutes (configurable constant)
  - [ ] Abort signal checked in loop
  - [ ] Timeout cleared in finally
  - [ ] Timeout logged as warning
  - [ ] `bun run test` → PASS

  **Commit**: YES
  - Message: `fix(opencode): add timeout for event stream to prevent hanging`
  - Files: `src/opencode/orchestrator.ts`
  - Pre-commit: `bun run test`

---

- [ ] 5. Add Unit Tests for New Behavior

  **What to do**:
  - Create `tests/unit/opencode/orchestrator.test.ts`
  - Test cases:
    1. Server cleanup on error: Mock server that throws, verify stop() called
    2. Retry on transient failure: Mock server.start() to fail twice then succeed
    3. Logging: Verify debug logs emitted (spy on logger)
    4. Timeout: Verify stream aborts after timeout (mock slow stream)

  **Must NOT do**:
  - Do NOT make tests flaky with real timeouts (use fake timers)
  - Do NOT test withRetry internals (already tested in retry.test.ts)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Test file creation, moderate complexity
  - **Skills**: [`dev-testing`]
    - `dev-testing`: Test design patterns for mocking and assertions

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (depends on all implementation)
  - **Blocks**: None (final task)
  - **Blocked By**: Tasks 1, 2, 3, 4

  **References**:
  - `tests/unit/opencode/streaming.test.ts` - Example test structure for opencode module
  - `tests/unit/opencode/sessions.test.ts` - Mocking patterns
  - `tests/unit/orchestration/orchestrator.test.ts` - Orchestrator test patterns

  **Acceptance Criteria**:
  - [ ] Test file created at `tests/unit/opencode/orchestrator.test.ts`
  - [ ] Test: server.stop() called on error
  - [ ] Test: retries on transient failure
  - [ ] Test: timeout aborts stream
  - [ ] `bun run test` → All tests PASS

  **Commit**: YES
  - Message: `test(opencode): add unit tests for orchestrator reliability features`
  - Files: `tests/unit/opencode/orchestrator.test.ts`
  - Pre-commit: `bun run test`

---

## Commit Strategy

| After Task | Message                                                                   | Files                | Verification |
| ---------- | ------------------------------------------------------------------------- | -------------------- | ------------ |
| 1          | `fix(opencode): add debug logging to orchestrator`                        | orchestrator.ts      | bun run test |
| 2          | `fix(opencode): stop server in finally block to prevent orphan processes` | orchestrator.ts      | bun run test |
| 3          | `fix(opencode): add retry logic for server/client startup`                | orchestrator.ts      | bun run test |
| 4          | `fix(opencode): add timeout for event stream to prevent hanging`          | orchestrator.ts      | bun run test |
| 5          | `test(opencode): add unit tests for orchestrator reliability features`    | orchestrator.test.ts | bun run test |

---

## Success Criteria

### Verification Commands

```bash
bun run test                    # All tests pass
bun run lint                    # No lint errors
bun run typecheck               # No type errors
```

### Final Checklist

- [ ] P1: Server stops on error → `server.stop()` in finally
- [ ] P1: Startup retries → `withRetry()` wrapper
- [ ] P2: Debug logging → `logger.debug()` at key points
- [ ] P2: Stream timeout → AbortController with 5 min default
- [ ] All tests pass (existing + new)
- [ ] No regressions in existing functionality
