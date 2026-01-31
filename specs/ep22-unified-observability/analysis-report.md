# Analysis Report: EP22 Unified Observability

> **Generated**: 2026-01-30
> **Scope**: Validate tasks against current implementation and tech debt
> **Artifacts Analyzed**: tasks.md, existing codebase

## Summary

| Category | Errors | Warnings | Info |
|----------|--------|----------|------|
| Missing Tasks (Refactoring) | 6 | 0 | 0 |
| Missing Tasks (Integration) | 4 | 0 | 0 |
| Tech Debt Not Addressed | 0 | 5 | 0 |
| Existing Code Conflicts | 0 | 2 | 0 |
| Task Coverage Gaps | 0 | 0 | 3 |

**Overall Status**: FAIL (missing critical refactoring tasks)

---

## Critical Findings: Missing Tasks

### ERROR-001: No Task to Remove Duplicate Interface

**Location**: `src/orchestration/types.ts:90-145`

**Current State**:
```typescript
/**
 * IMPORTANT: Keep in sync with ITelemetryClient in src/telemetry/index.ts
 */
export interface IOrchestratorTelemetryClient {
  // 56 lines of duplicated interface
}
```

**Impact**: This duplicate interface will conflict with the new observability types. Manual sync required.

**Missing Task**: Extract telemetry types to shared module, remove duplicate.

---

### ERROR-002: No Task to Extend Existing TelemetryEvent with Trace Context

**Location**: `src/telemetry/events.ts`

**Current State**: `TelemetryEvent` has `sessionId`, `eventId`, `parentEventId` but NO `traceId`/`spanId`.

**Impact**: EP22 spec requires trace IDs in HoneyHive events. Current event schema doesn't support this.

**Missing Task**: Extend `TelemetryEvent` interface with `traceId`, `spanId`, `parentSpanId` fields.

---

### ERROR-003: No Task to Migrate TelemetryTracker to Use Trace Context

**Location**: `src/opencode/telemetry-tracker.ts`

**Current State**: Uses FIFO queue correlation with `parentEventId` pattern. No trace context integration.

**Impact**: Tool calls tracked by TelemetryTracker won't have proper span hierarchy.

**Missing Task**: Modify `TelemetryTracker` to get trace context from `TraceContextProvider` and pass to telemetry events.

---

### ERROR-004: No Task to Replace console.* in Telemetry Modules

**Location**: Multiple files

**Current State**:
- `src/telemetry/index.ts`: 5 console.error/warn calls
- `src/telemetry/alpha-client.ts`: 1 console.error call
- `src/eval/runner.ts`: 6 console.warn calls

**Impact**: These bypass the DebugLogger and won't have trace context. Defeats unified observability goal.

**Missing Task**: Replace all `console.*` calls in telemetry/eval modules with DebugLogger.

---

### ERROR-005: No Task to Implement OTEL Mode

**Location**: `src/telemetry/index.ts:393`

**Current State**:
```typescript
case 'otel':
  console.error('[telemetry] OTEL mode not yet implemented, telemetry disabled');
  return new NoOpTelemetryClient();
```

**Impact**: EP22 adds OTLP exporter but existing `otel` mode handler returns NoOp. Needs integration.

**Missing Task**: Wire OTLP exporter to existing `AGENTLINT_TELEMETRY=otel` mode.

---

### ERROR-006: No Task to Centralize Hardcoded Configuration

**Locations**:
- `src/opencode/telemetry-tracker.ts`: MAX_PENDING_TOOLS, TOOL_TRACKING_TTL_MS, CLEANUP_INTERVAL
- `src/telemetry/alpha-client.ts`: FLUSH_INTERVAL_MS, MAX_BUFFER_SIZE, REQUEST_TIMEOUT_MS
- `src/orchestration/telemetry-utils.ts`: maxLength defaults (5000)

**Impact**: EP22 adds new config (`ObservabilityConfig`) but doesn't unify with existing constants.

**Missing Task**: Consolidate all telemetry/observability constants into unified config schema.

---

## Missing Integration Tasks

### ERROR-007: No Task to Update AlphaTelemetryClient for Trace Context

**Location**: `src/telemetry/alpha-client.ts`

**Current State**: Tracks `sessionEventIds` for hierarchy but no trace context.

**Impact**: HoneyHive events won't correlate with local trace IDs.

**Missing Task**: Modify `AlphaTelemetryClient.record()` to include trace context in events.

---

### ERROR-008: No Task to Add Trace Context to Existing Log Entry Type

**Location**: `src/debug/types.ts`

**Current State**: `LogEntry` interface has no `trace_id`/`span_id` fields.

**Impact**: T018 modifies logger but type definition not updated.

**Missing Task**: Update `LogEntry` interface in `src/debug/types.ts`.

---

### ERROR-009: No Task to Wire Observability at OpencodeOrchestrator Level

**Location**: `src/opencode/orchestrator.ts`

**Current State**: Creates `TelemetryTracker` when telemetry enabled. No observability module integration.

**Impact**: T028 says "Integrate instrumentation" but doesn't specify how OpencodeOrchestrator initializes trace context.

**Missing Task**: Explicitly task creating trace context at `OpencodeOrchestrator.run()` entry point.

---

### ERROR-010: No Task to Handle Legacy Orchestrator (if still in use)

**Location**: `src/orchestration/orchestrator.ts` (if exists)

**Question**: Is the legacy `Orchestrator` still used, or only `OpencodeOrchestrator`?

**Impact**: If legacy orchestrator exists, it needs same instrumentation.

**Missing Task**: Audit and instrument legacy orchestrator OR confirm it's deprecated.

---

## Tech Debt Not Addressed (Warnings)

### WARN-001: Deprecated Interface Not Removed

**Location**: `src/tools/config/types.ts:260-272`

**Current State**: `DimensionScores` interface marked `@deprecated` but still exported.

**Recommendation**: Add cleanup task to Phase 9 (Polish).

---

### WARN-002: Empty Catch Blocks Swallow Errors

**Location**: `src/temporal/tools/list-baselines.ts:156`

**Current State**: Silent error swallowing:
```typescript
} catch {
  return isoDate;
}
```

**Recommendation**: Add error context or logging.

---

### WARN-003: Eval Runner Error Handling

**Location**: `src/eval/runner.ts:94-158`

**Current State**: Promises resolve with `null` on error instead of rejecting.

**Recommendation**: Add proper error handling task.

---

### WARN-004: Session Tools Missing Abstraction

**Location**: 7 session tools with identical TODO for database lookup

**Current State**: Repeated pattern suggests missing `SessionIdResolver` abstraction.

**Recommendation**: Out of scope for EP22, but document for future epic.

---

### WARN-005: Stub CLI Commands

**Location**: `src/cli/program.ts:100, 227`

**Current State**: Multiple commands stubbed.

**Recommendation**: Out of scope for EP22.

---

## Existing Code Conflicts (Warnings)

### WARN-006: LogEntry Type Modification Risk

**Location**: `src/debug/types.ts`

**Risk**: Adding `trace_id`/`span_id` to `LogEntry` may break existing consumers.

**Recommendation**: Make fields optional (`trace_id?: string`) for backward compatibility.

---

### WARN-007: Telemetry Module Circular Dependency

**Location**: `src/orchestration/types.ts` comment

**Current State**: Duplicate interface exists specifically to avoid circular deps.

**Risk**: New `src/observability/` module may create additional circular dependencies.

**Recommendation**: Plan import structure carefully. Consider barrel exports.

---

## Task Coverage Gaps (Info)

### INFO-001: No Benchmark for Existing Telemetry Overhead

**Current State**: T050 creates benchmark but existing telemetry overhead unknown.

**Recommendation**: Establish baseline before adding observability layer.

---

### INFO-002: No Migration Guide for Existing Logs

**Impact**: Users may have existing logs without trace IDs.

**Recommendation**: Document that trace correlation only applies to new sessions.

---

### INFO-003: No Task for Updating ADR-0025

**Location**: `docs/architecture/adr/0025-telemetry-architecture.md`

**Current State**: ADR describes current HoneyHive architecture.

**Recommendation**: Add task to update ADR with EP22 changes.

---

## Recommended Task Additions

### Phase 1.5: Refactoring (Insert After Setup)

```markdown
## Phase 1.5: Telemetry Refactoring

**Goal**: Clean up existing telemetry tech debt before adding observability

- [ ] T006a Extract telemetry types to `src/telemetry/types.ts`, remove duplicate `IOrchestratorTelemetryClient`
- [ ] T006b Add `trace_id`, `span_id`, `parent_span_id` optional fields to `LogEntry` in `src/debug/types.ts`
- [ ] T006c Add `traceId`, `spanId`, `parentSpanId` optional fields to `TelemetryEvent` in `src/telemetry/events.ts`
- [ ] T006d Replace all `console.error/warn` in `src/telemetry/` with DebugLogger
- [ ] T006e Centralize telemetry constants to `src/telemetry/config.ts` with defaults

**Checkpoint**: Tech debt cleaned
- [ ] No duplicate interfaces
- [ ] No console.* in telemetry code
- [ ] Type definitions support trace context
```

### Phase 3 Additions (US-001)

```markdown
- [ ] T023a Modify `TelemetryTracker` to pass trace context to telemetry events
- [ ] T023b Modify `AlphaTelemetryClient.record()` to include trace_id in HoneyHive events
```

### Phase 7 Additions (US-005)

```markdown
- [ ] T044a Wire OTLP exporter to existing `AGENTLINT_TELEMETRY=otel` mode in `src/telemetry/index.ts`
```

### Phase 9 Additions (Polish)

```markdown
- [ ] T050a Establish baseline telemetry overhead benchmark (before EP22)
- [ ] T052a Update ADR-0025 with EP22 architectural changes
- [ ] T052b Remove deprecated `DimensionScores` interface from `src/tools/config/types.ts`
```

---

## Summary of Required Changes

| Change Type | Count | Description |
|-------------|-------|-------------|
| New Tasks (Critical) | 10 | Refactoring + integration gaps |
| New Tasks (Recommended) | 5 | Tech debt cleanup + documentation |
| Task Renumbering | Required | Insert Phase 1.5 shifts all subsequent IDs |

**Total New Tasks**: 15
**Revised Total**: 62 tasks (was 47)
**Revised MVP**: 41 tasks (was 31) - includes refactoring phase

---

## Recommendations

1. **Insert Phase 1.5 (Refactoring)** before Foundational phase
2. **Add integration tasks** to Phases 3, 7, 9
3. **Make trace context fields optional** in existing types for backward compatibility
4. **Document migration path** for users with existing logs
5. **Update tasks.md** with renumbered task IDs

**Next Action**: Regenerate `tasks.md` with additional tasks, or create addendum file.
