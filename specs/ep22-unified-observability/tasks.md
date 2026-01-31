# Tasks: EP22 Unified Observability Architecture

> **Epic**: EP22
> **Generated**: 2026-01-30
> **Updated**: 2026-01-30 (final cross-validation: Opencode SDK integration + multi-provider support)
> **Total Tasks**: 86
> **MVP Tasks**: 69 (includes refactoring, HoneyHive gaps, and SDK integration fixes)

---

## Summary

| Phase | Tasks | Parallelizable |
|-------|-------|----------------|
| Setup | 5 | 3 |
| **Refactoring** | 10 | 4 |
| Foundational | 10 | 4 |
| **HoneyHive/OTel Gap Fixes** | 7 | 3 |
| **Opencode SDK Integration Fixes** | 10 | 4 |
| US-001: Unified Trace Correlation (P0) | 10 | 4 |
| US-002: Agentic Span Hierarchy (P0) | 9 | 4 |
| US-003: SSE Streaming Observability (P1) | 5 | 2 |
| US-004: TUI State Observability (P1) | 4 | 2 |
| US-005: Remote Observability Opt-In (P1) | 6 | 2 |
| US-006: Checkpoint Trace Context (P2) | 4 | 1 |
| Polish | 6 | 2 |

**Requirements Coverage**:
- FR-001 to FR-006: US-001, US-002 (P0)
- FR-007 to FR-010: US-003, US-004, US-005 (P1)
- FR-011: US-006 (P2)
- NFR-001 to NFR-005: Polish phase

---

## Phase 1: Setup

**Goal**: Add dependencies and create module structure

- [ ] T001 [P] Add OpenTelemetry dependencies to package.json (`@opentelemetry/api`, `@opentelemetry/sdk-trace-node`, `@opentelemetry/exporter-trace-otlp-http`, `@opentelemetry/semantic-conventions`, `@opentelemetry/resources`)
- [ ] T002 [P] Add uuid package for UUID v7 generation (`uuid@^9.0.0`)
- [ ] T003 [P] Create `src/observability/` directory structure per plan.md
- [ ] T004 Create `src/observability/index.ts` with module exports
- [ ] T005 Add OBSERVABILITY namespace to `src/debug/namespaces.ts`

**Checkpoint**: Setup complete
- [ ] Dependencies installed (`bun install`)
- [ ] Module structure exists
- [ ] No TypeScript errors

---

## Phase 2: Refactoring (Tech Debt Cleanup)

**Goal**: Clean up existing telemetry tech debt before adding observability layer

### Type System Cleanup

- [ ] T006 Extract shared telemetry types to `src/telemetry/types.ts`
  - Move `ITelemetryClient` interface definition
  - Create shared types for tool/LLM tracking options
- [ ] T007 Remove duplicate `IOrchestratorTelemetryClient` from `src/orchestration/types.ts`
  - Import from `src/telemetry/types.ts` instead
  - Update all consumers to use shared import
- [ ] T008 [P] Add optional `trace_id`, `span_id` fields to `LogEntry` in `src/debug/types.ts`
  - Fields must be optional for backward compatibility
- [ ] T009 [P] Add optional `traceId`, `spanId`, `parentSpanId` fields to `TelemetryEvent` in `src/telemetry/events.ts`

### Console.* Replacement

- [ ] T010 [P] Replace `console.error/warn` in `src/telemetry/index.ts` with DebugLogger (5 calls)
- [ ] T011 [P] Replace `console.error` in `src/telemetry/alpha-client.ts` with DebugLogger (1 call)

### Configuration Consolidation

- [ ] T012 Create `src/telemetry/constants.ts` with centralized configuration
  - Move: MAX_PENDING_TOOLS, TOOL_TRACKING_TTL_MS, CLEANUP_INTERVAL from telemetry-tracker.ts
  - Move: FLUSH_INTERVAL_MS, MAX_BUFFER_SIZE, REQUEST_TIMEOUT_MS from alpha-client.ts
  - Move: truncation defaults (5000 chars) from telemetry-utils.ts
- [ ] T013 Update `src/opencode/telemetry-tracker.ts` to use centralized constants
- [ ] T014 Update `src/telemetry/alpha-client.ts` to use centralized constants

### Cleanup Verification

- [ ] T015 Unit test: Verify no circular dependencies after type extraction in `tests/unit/telemetry/types.test.ts`

**Checkpoint**: Refactoring complete
- [ ] No duplicate interfaces in codebase
- [ ] No `console.*` calls in telemetry modules (verified by grep)
- [ ] LogEntry and TelemetryEvent support trace context
- [ ] All telemetry constants in single file

---

## Phase 3: Foundational

**Goal**: Core trace context infrastructure

### Types and Interfaces

- [ ] T016 [P] Create `src/observability/types.ts` with TraceContext, SpanOptions, ActiveSpan interfaces (copy from contracts/interfaces.ts)
- [ ] T017 [P] Create `src/observability/config.ts` with ObservabilityConfig, DEFAULT_OBSERVABILITY_CONFIG

### Core Infrastructure

- [ ] T018 Implement UUID v7 trace ID generation in `src/observability/trace-id.ts`
  - Function: `generateTraceId(): string` - returns 32 hex chars
  - Function: `generateSpanId(): string` - returns 16 hex chars
- [ ] T019 Implement AsyncLocalStorage context provider in `src/observability/trace-context.ts`
  - `TraceContextProvider` class with `run()`, `getContext()`, `withSpan()`
  - Uses AsyncLocalStorage for automatic propagation
- [ ] T020 Create `src/observability/span-factory.ts` with TracingSpanFactory
  - Factory methods: `createSessionSpan()`, `createToolSpan()`, `createLLMSpan()`, `createStreamSpan()`
  - All methods apply GenAI semantic convention attributes

### Tests (write first)

- [ ] T021 [P] Unit test: UUID v7 generation produces valid 32-char hex string in `tests/unit/observability/trace-id.test.ts`
- [ ] T022 [P] Unit test: TraceContextProvider propagates context across async boundaries in `tests/unit/observability/trace-context.test.ts`
- [ ] T023 Unit test: TracingSpanFactory creates spans with correct GenAI attributes in `tests/unit/observability/span-factory.test.ts`

### Integration

- [ ] T024 Update `src/observability/index.ts` to export all foundational components
- [ ] T025 Verify foundational components work together with integration test in `tests/integration/observability/foundation.test.ts`

**Checkpoint**: Foundation ready
- [ ] All unit tests pass
- [ ] TraceContext propagates through async code
- [ ] Span factory creates valid OTel spans

---

## Phase 3.5: HoneyHive/OTel Gap Fixes

**Goal**: Ensure maximum observability value by implementing all attributes HoneyHive and OTel GenAI conventions expect
**Reference**: [analysis-honeyhive-gaps.md](./analysis-honeyhive-gaps.md)

### Anthropic Cache Token Tracking (GAP-001)

- [ ] T025a [P] Update `src/observability/instrumentation/orchestrator.ts` to capture cache tokens from Anthropic responses
  - Extract `cache_creation_input_tokens` and `cache_read_input_tokens` from usage object
  - Add to LLM span attributes

### LLM Hyperparameters (GAP-003)

- [ ] T025b [P] Update LLM span creation to include request hyperparameters
  - Capture: temperature, max_tokens, top_p, top_k, stop_sequences from request
  - Store in span attributes per GenAI conventions

### Response Details (GAP-009)

- [ ] T025c [P] Update LLM span to capture response details
  - Extract response.id from Anthropic response
  - Extract response.model (actual model, may differ from requested)
  - Calculate tokens_per_second metric

### Content Capture (GAP-004, GAP-006)

- [ ] T025d Implement opt-in content capture in `src/observability/content-capture.ts`
  - Check `AGENTLINT_CAPTURE_CONTENT` env var
  - Implement truncation to configured max lengths
  - Sanitize before capture (redact secrets)
- [ ] T025e Add tool call arguments/results capture (opt-in)
  - Capture `gen_ai.tool.call.arguments` (JSON stringified, truncated)
  - Capture `gen_ai.tool.call.result` (JSON stringified, truncated)
  - Generate `gen_ai.tool.call.id` for each tool invocation

### Analysis Events (GAP-005, from analysis-report.md)

- [ ] T025f Emit `agentlint.finding.detected` span events from orchestrator
  - Hook into finding detection in analysis phase
  - Include type, severity, finding_id attributes
- [ ] T025g Emit `agentlint.recommendation.generated` span events from orchestrator
  - Hook into recommendation generation
  - Include type, finding_id attributes

**Checkpoint**: Gap fixes complete
- [ ] LLM spans include cache tokens when available
- [ ] LLM spans include request hyperparameters
- [ ] LLM spans include response ID and actual model
- [ ] Tool spans include call ID and opt-in content
- [ ] Finding/recommendation events emitted during analysis

---

## Phase 3.6: Opencode SDK Integration Fixes

**Goal**: Maximize observability value by fully leveraging Opencode SDK data
**Reference**: [analysis-final-gaps.md](./analysis-final-gaps.md)

### Multi-Provider Support (GAP-012)

- [ ] T025h [P] Update GenAIProvider type to include all major Opencode SDK providers
  - Add: bedrock, azure, groq, openrouter, ollama, deepseek, xai, together, github, custom, unknown
- [ ] T025i [P] Extract provider from SDK `AssistantMessage.providerID` instead of hardcoding 'anthropic'
  - Modify `src/opencode/telemetry-tracker.ts:220`
  - Map SDK providerID to GenAIProvider enum

### Reasoning Token Tracking (GAP-013)

- [ ] T025j [P] Add `gen_ai.usage.reasoning_tokens` to LLMSpanAttributes
  - Extended thinking uses significant tokens on Claude 3.5+
- [ ] T025k Extract reasoning tokens from SDK `AssistantMessage.tokens.reasoning`
  - Modify LLM span creation in orchestrator instrumentation

### Tool Correlation Architecture (GAP-016, GAP-020)

- [ ] T025l Replace FIFO queue correlation with SDK `ToolPart.callID` and `AssistantMessage.parentID`
  - Refactor `src/opencode/telemetry-tracker.ts` to use proper SDK correlation
  - Remove FIFO queue hack
- [ ] T025m Add tool state transition tracking (pending → running → completed)
  - Track time in each state from SDK ToolState
  - Add `state_transitions`, `pending_duration_ms`, `running_duration_ms` attributes

### Context Enrichment (GAP-017, GAP-018, GAP-021)

- [ ] T025n [P] Extract tool metadata, title, and attachment count from SDK responses
  - From `ToolPart.metadata`, `ToolState.title`, `ToolState.attachments`
- [ ] T025o [P] Add session path context (cwd, root) from SDK `AssistantMessage.path`
  - Track working directory and project root
- [ ] T025p Track session-level cost and token totals at span end
  - Accumulate: total_cost_usd, total_input_tokens, total_output_tokens, total_reasoning_tokens

### Error Enrichment (GAP-019)

- [ ] T025q Enhance error events with HTTP status, retryability, and error category
  - Extract from SDK `ApiError`: statusCode, isRetryable
  - Categorize: auth, api, rate_limit, timeout, unknown

**Checkpoint**: SDK integration complete
- [ ] Provider correctly extracted from SDK responses (not hardcoded)
- [ ] Reasoning tokens tracked for extended thinking
- [ ] Tool correlation uses SDK callID (no FIFO hacks)
- [ ] Tool metadata and state transitions captured
- [ ] Session path and cost totals included
- [ ] Errors enriched with SDK details

---

## Phase 4: US-001 - Unified Trace Correlation (P0)

**Goal**: Single trace ID links local logs, HoneyHive UI, and checkpoints
**Requirements**: FR-001, FR-002, FR-003

### Tests (write first)

- [ ] T026 [P] Unit test: DebugLogger auto-injects trace_id/span_id in `tests/unit/observability/logger-correlation.test.ts`
- [ ] T027 [P] Unit test: All log entries have trace context when within TraceContextProvider in `tests/unit/observability/log-correlation.test.ts`

### Implementation

- [ ] T028 Modify `src/debug/logger.ts` to import getTraceContext and auto-inject trace_id/span_id
  - Get context from TraceContextProvider
  - Add trace_id, span_id to every log entry
  - Gracefully handle missing context (log without trace fields)
- [ ] T029 Create local JSONL exporter in `src/observability/exporters/local-exporter.ts`
  - Implements SpanExporter interface
  - Writes to `~/.agentlint/logs/traces-{date}.ndjson`
  - File rotation on size limit
- [ ] T030 Initialize TraceContextProvider at CLI entry in `src/cli/commands/analyse.ts`
  - Generate trace ID at session start
  - Wrap orchestrator.run() in traceContext.run()
  - Log trace ID at session start for user visibility
- [ ] T031 [P] Unit test: Local exporter writes valid JSONL in `tests/unit/observability/local-exporter.test.ts`

### Telemetry Integration

- [ ] T032 Modify `src/opencode/telemetry-tracker.ts` to pass trace context to telemetry events
  - Import getTraceContext from observability module
  - Include traceId, spanId in trackToolEx/trackLLMEx calls
- [ ] T033 Modify `src/telemetry/alpha-client.ts` record() to include trace_id in HoneyHive events
  - Add traceId to event payload when available
  - Maintain backward compatibility (optional field)

### Integration

- [ ] T034 Integration test: Run analysis, verify all logs have same trace_id in `tests/integration/observability/trace-correlation.test.ts`
- [ ] T035 Update `src/observability/index.ts` exports

**Checkpoint**: US-001 complete
- [ ] Trace ID visible at session start
- [ ] All log lines have trace_id and span_id
- [ ] HoneyHive events include trace_id
- [ ] Logs can be filtered by trace_id with grep

---

## Phase 5: US-002 - Agentic Span Hierarchy (P0)

**Goal**: Session → tool → LLM span hierarchy with GenAI conventions
**Requirements**: FR-004, FR-005, FR-006

### Tests (write first)

- [ ] T036 [P] Unit test: Session span has invoke_agent operation in `tests/unit/observability/session-span.test.ts`
- [ ] T037 [P] Unit test: Tool spans are children of session span in `tests/unit/observability/tool-span.test.ts`
- [ ] T038 [P] Unit test: LLM spans capture token usage in `tests/unit/observability/llm-span.test.ts`

### Implementation

- [ ] T039 Create orchestrator instrumentation hooks in `src/observability/instrumentation/orchestrator.ts`
  - `instrumentSession(sessionId, target)` - creates root span
  - `instrumentToolCall(toolName, input)` - creates child span
  - `instrumentLLMCall(model, tokens)` - creates child span with usage
- [ ] T040 Integrate instrumentation with `src/opencode/orchestrator.ts`
  - Create session span at run() start (wrap existing TraceContextProvider init)
  - Wrap tool calls with instrumentToolCall
  - Hook into TelemetryTracker for LLM metrics
- [ ] T041 [P] Unit test: Parent-child relationships preserved for concurrent tools in `tests/unit/observability/span-hierarchy.test.ts`

### Integration

- [ ] T042 Integration test: Run analysis with multiple tools, verify span tree in `tests/integration/observability/span-hierarchy.test.ts`
- [ ] T043 Update `src/observability/index.ts` exports
- [ ] T044 Verify legacy orchestrator status (`src/orchestration/orchestrator.ts`)
  - If still used: add equivalent instrumentation
  - If deprecated: document in CLAUDE.md

**Checkpoint**: US-002 complete
- [ ] Session span created with GenAI attributes
- [ ] Tool spans nested under session
- [ ] LLM spans capture token/cost data
- [ ] Span hierarchy matches expected tree structure

---

## Phase 6: US-003 - SSE Streaming Observability (P1)

**Goal**: Visibility into SSE event flow without noise
**Requirements**: FR-007

### Tests (write first)

- [ ] T045 [P] Unit test: Stream span captures first_token latency in `tests/unit/observability/stream-span.test.ts`
- [ ] T046 Unit test: Stream span records event counts not individual events in `tests/unit/observability/stream-aggregation.test.ts`

### Implementation

- [ ] T047 Create streaming instrumentation in `src/observability/instrumentation/streaming.ts`
  - `instrumentStream(streamId)` - creates stream span
  - `recordFirstToken(latencyMs)` - adds event
  - `recordStreamComplete(stats)` - sets attributes, ends span
- [ ] T048 Integrate with `src/opencode/streaming.ts` StreamAdapter
  - Create span at stream start
  - Record first_token event
  - Set aggregate stats on complete
- [ ] T049 [P] Integration test: Verify stream span in real analysis in `tests/integration/observability/streaming.test.ts`

**Checkpoint**: US-003 complete
- [ ] Stream span shows duration and event counts
- [ ] First token latency captured
- [ ] Individual SSE events NOT logged (noise reduction)

---

## Phase 7: US-004 - TUI State Observability (P1)

**Goal**: Visibility into TUI state machine transitions
**Requirements**: FR-008

### Tests (write first)

- [ ] T050 [P] Unit test: TUI state changes recorded with from/to in `tests/unit/observability/tui-state.test.ts`

### Implementation

- [ ] T051 Create TUI instrumentation in `src/observability/instrumentation/tui.ts`
  - `recordStateChange(from, to)` - adds span event
  - `recordAgentWorkChange(from, to)` - adds span event
  - `recordQuestionAsked(requestId, count)` - adds span event
- [ ] T052 Integrate with `src/tui/renderers/ink-renderer.ts`
  - Hook into dispatch for state transitions
  - Record state changes as span events
  - Skip render cycle logging
- [ ] T053 [P] Integration test: Run TUI flow, verify state transitions in logs in `tests/integration/observability/tui-state.test.ts`

**Checkpoint**: US-004 complete
- [ ] State transitions logged with from/to
- [ ] Question/permission events captured
- [ ] Render cycles NOT logged

---

## Phase 8: US-005 - Remote Observability Opt-In (P1)

**Goal**: Privacy-respecting remote export with clear consent
**Requirements**: FR-009, FR-010

### Tests (write first)

- [ ] T054 [P] Unit test: Remote export disabled by default in `tests/unit/observability/remote-config.test.ts`
- [ ] T055 Unit test: OTLP exporter sanitizes sensitive data in `tests/unit/observability/data-sanitization.test.ts`

### Implementation

- [ ] T056 Create OTLP exporter in `src/observability/exporters/otlp-exporter.ts`
  - Implements SpanExporter interface
  - Supports both proxy and user endpoints
  - Sanitizes prompts, file contents, API keys before export
- [ ] T057 Add consent flow to `src/cli/commands/analyse.ts`
  - Check for AGENTLINT_TELEMETRY env var
  - Show consent message on first opt-in
  - Store consent timestamp in config
- [ ] T058 Wire OTLP exporter to existing `AGENTLINT_TELEMETRY=otel` mode in `src/telemetry/index.ts`
  - Replace NoOpTelemetryClient with OTLP-enabled client
  - Support user-provided endpoint via AGENTLINT_OTLP_ENDPOINT
- [ ] T059 [P] Integration test: Verify no remote calls without opt-in in `tests/integration/observability/remote-opt-in.test.ts`

**Checkpoint**: US-005 complete
- [ ] Default: no remote export
- [ ] Opt-in: shows consent, enables export
- [ ] Sensitive data sanitized
- [ ] OTEL mode properly implemented

---

## Phase 9: US-006 - Checkpoint Trace Context (P2)

**Goal**: Checkpoint files include trace context for replay correlation
**Requirements**: FR-011

### Tests (write first)

- [ ] T060 Unit test: Checkpoint includes trace_id and span_id in `tests/unit/observability/checkpoint-trace.test.ts`

### Implementation

- [ ] T061 Modify `src/orchestration/checkpoint.ts` CheckpointHandler
  - Add trace_context to checkpoint schema
  - Get current context from TraceContextProvider
  - Include in checkpoint JSON
- [ ] T062 Implement replay correlation in `src/orchestration/checkpoint.ts`
  - On replay, read original trace_id
  - Create new spans as children of checkpoint span
  - Log original trace_id for correlation
- [ ] T063 [P] Integration test: Replay session, verify trace linkage in `tests/integration/observability/checkpoint-replay.test.ts`

**Checkpoint**: US-006 complete
- [ ] Checkpoints contain trace context
- [ ] Replay logs reference original trace_id
- [ ] Spans linkable across original and replay

---

## Phase 10: Polish

**Goal**: Performance validation, documentation, and final cleanup
**Requirements**: NFR-001 to NFR-005

### Performance

- [ ] T064 Establish baseline telemetry overhead benchmark (before EP22 changes) in `tests/benchmarks/baseline-overhead.ts`
- [ ] T065 Create benchmark for observability overhead in `tests/benchmarks/observability-overhead.ts`
  - Measure latency with/without instrumentation
  - Target: <5% increase over baseline

### Reliability

- [ ] T066 [P] Verify graceful degradation: fault injection test for exporter failures in `tests/integration/observability/fault-tolerance.test.ts`

### Documentation & Cleanup

- [ ] T067 Update CLAUDE.md with observability module documentation
- [ ] T068 Update `docs/architecture/adr/0025-telemetry-architecture.md` with EP22 changes
  - Add trace context integration
  - Document OTLP exporter
  - Update architecture diagram
- [ ] T069 [P] Remove deprecated `DimensionScores` interface from `src/tools/config/types.ts`

**Checkpoint**: Polish complete
- [ ] Performance overhead <5% vs baseline
- [ ] Graceful degradation verified
- [ ] Documentation updated
- [ ] No deprecated code remaining

---

## MVP Scope

Minimum viable implementation (P0 user stories + refactoring + gap fixes + SDK integration):

| Phase | Tasks | Count |
|-------|-------|-------|
| Setup | T001-T005 | 5 |
| Refactoring | T006-T015 | 10 |
| Foundational | T016-T025 | 10 |
| HoneyHive/OTel Gap Fixes | T025a-T025g | 7 |
| Opencode SDK Integration | T025h-T025q | 10 |
| US-001 (P0) | T026-T035 | 10 |
| US-002 (P0) | T036-T044 | 9 |
| Core Polish | T067-T068 | 2 |

**Total MVP**: 63 tasks + 6 checkpoints
**Full Feature**: 86 tasks (69 MVP + 17 P1/P2)

---

## Execution Notes

### Parallelization

- Tasks marked `[P]` can run in parallel within their phase
- Complete each phase checkpoint before starting the next
- Unit tests should be written before implementation tasks in each phase

### Dependencies

- Phase 2 (Refactoring) MUST complete before Phase 3 (Foundational) - type system changes
- Phase 3 (Foundational) must complete before any user story phase
- Phase 3.5 (HoneyHive Gap Fixes) can run in parallel with Phase 3.6 after Foundational
- Phase 3.6 (SDK Integration) can run in parallel with Phase 3.5 after Foundational
- US-001 and US-002 depend on Phase 3.5 and 3.6 completion
- US-003, US-004, US-005 can run in parallel after US-001/US-002
- US-006 depends on US-001 (needs trace context in checkpoints)
- Polish depends on all user stories

### Critical Integration Points

| Existing File | Modification | Task |
|--------------|--------------|------|
| `src/orchestration/types.ts` | Remove duplicate interface | T007 |
| `src/debug/types.ts` | Add trace context fields | T008 |
| `src/telemetry/events.ts` | Add trace context fields | T009 |
| `src/telemetry/index.ts` | Replace console.*, wire OTEL | T010, T058 |
| `src/telemetry/alpha-client.ts` | Replace console.*, add trace_id | T011, T033 |
| `src/opencode/telemetry-tracker.ts` | Use constants, pass trace context | T013, T032 |
| `src/debug/logger.ts` | Auto-inject trace context | T028 |
| `src/opencode/orchestrator.ts` | Session span, tool wrapping, cache tokens | T030, T040, T025a |
| `src/opencode/streaming.ts` | Stream span instrumentation | T048 |
| `src/tui/renderers/ink-renderer.ts` | State transition events | T052 |
| `src/orchestration/checkpoint.ts` | Trace context storage | T061, T062 |

### New Files (Gap Fixes)

| New File | Purpose | Task |
|----------|---------|------|
| `src/observability/content-capture.ts` | Opt-in content capture with truncation | T025d |

### Test Commands

```bash
# Run all observability tests
bun run test -- --grep "observability"

# Run refactoring verification
bun run test -- --grep "telemetry/types"

# Run specific phase tests
bun run test -- --grep "trace-context"
bun run test -- --grep "span-hierarchy"

# Verify no console.* in telemetry
grep -r "console\." src/telemetry/ --include="*.ts"
```

### Key Files

| Component | Location |
|-----------|----------|
| **Refactoring** | |
| Shared Telemetry Types | `src/telemetry/types.ts` |
| Telemetry Constants | `src/telemetry/constants.ts` |
| **New Observability Module** | |
| Types | `src/observability/types.ts` |
| Config | `src/observability/config.ts` |
| Trace ID | `src/observability/trace-id.ts` |
| Context Provider | `src/observability/trace-context.ts` |
| Span Factory | `src/observability/span-factory.ts` |
| Local Exporter | `src/observability/exporters/local-exporter.ts` |
| OTLP Exporter | `src/observability/exporters/otlp-exporter.ts` |
| Orchestrator Instrumentation | `src/observability/instrumentation/orchestrator.ts` |
| Streaming Instrumentation | `src/observability/instrumentation/streaming.ts` |
| TUI Instrumentation | `src/observability/instrumentation/tui.ts` |
| Content Capture | `src/observability/content-capture.ts` |
