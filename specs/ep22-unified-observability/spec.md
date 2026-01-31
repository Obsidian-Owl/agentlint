# Feature Specification: Unified Observability Architecture

> **Epic**: EP22
> **Created**: 2026-01-30
> **Status**: ✅ Implemented
> **Author**: Claude Code
> **Completed**: 2026-01-30
> **Dependencies**: EP11 (Quality & Security), EP02 (Orchestration Core)

---

## 1. Overview

EP22 unifies agentlint's two separate observability systems—local debug logging and HoneyHive telemetry—into a coherent, OpenTelemetry-based architecture with shared trace IDs. This enables seamless debugging where a single trace ID correlates local log files, HoneyHive UI traces, and checkpoint replay files.

### 1.1 Problem Statement

agentlint currently has two disconnected observability systems:

| System | Data Goes To | Issues |
|--------|-------------|--------|
| **Local Debug Logging** | `~/.agentlint/logs/*.ndjson` | No trace correlation, missing SSE events, no span hierarchy |
| **HoneyHive Telemetry** | Vercel proxy → HoneyHive | Disabled by default, missing SSE/TUI events, no local correlation |

**Result**: When debugging issues like "SSE events not flowing" or "run conflict errors", developers must manually correlate timestamps across systems with no guaranteed linkage.

### 1.2 Solution

Implement OpenTelemetry-based instrumentation that:
1. Generates UUID v7 trace IDs at session start
2. Propagates trace context to all operations via AsyncLocalStorage
3. Auto-injects trace/span IDs into local structured logs
4. Exports spans to HoneyHive when opted in (same trace IDs)
5. Stores trace context in checkpoints for replay

### 1.3 Business Context

**Why Now?**: The TUI architecture work (EP17) exposed critical observability gaps:
- "Cannot start a new run" race condition was invisible without span hierarchy
- SSE streaming issues required manual log correlation
- TUI state transitions had zero logging

**Alignment**: This epic supports:
- **Constitution Principle I (Local-First)**: Local logging always on, remote opt-in
- **Constitution Principle IX (Agent-Aware)**: Observability designed for agent debugging needs

### 1.4 Out of Scope

- Metrics dashboards (traces/logs only, no aggregation)
- Real-time alerting infrastructure
- OpenTelemetry Collector deployment (users bring their own)
- Cost attribution per user (future EP)

---

## 2. User Scenarios

> Prioritized: P0 (critical), P1 (must-have), P2 (should-have)

### US-001 [P0]: Unified Trace Correlation

**As a** developer debugging an agentlint issue,
**I want** a single trace ID that links local logs, HoneyHive UI, and checkpoint files,
**So that** I can follow a complete session execution across all observability surfaces.

**Acceptance Criteria:**
- [ ] Given agentlint starts a session, then a UUID v7 trace ID is generated at CLI entry
- [ ] Given the trace ID exists, then all local log lines include `trace_id` and `span_id` fields
- [ ] Given HoneyHive is enabled, then traces in HoneyHive UI use the same trace ID as local logs
- [ ] Given a checkpoint file, then it includes the session's trace context for replay correlation
- [ ] Given a log line, then I can search HoneyHive with the same trace_id and find matching spans

**Test Scenarios:**
- Run `agentlint analyze` with both local logging and HoneyHive enabled
- Extract trace_id from local log file
- Search HoneyHive for that trace_id
- Verify spans match between local and remote

---

### US-002 [P0]: Agentic Span Hierarchy

**As a** developer analyzing agent behavior,
**I want** spans organized in a session → trace → span hierarchy following GenAI conventions,
**So that** I can understand the agent's decision tree and tool orchestration flow.

**Acceptance Criteria:**
- [ ] Given a session starts, then a root span is created with `gen_ai.operation.name: invoke_agent`
- [ ] Given a tool is called, then a child span is created with tool name, input (truncated), and output
- [ ] Given an LLM call is made, then a span captures model, tokens, latency, cost, and finish reason
- [ ] Given multiple concurrent tool calls, then parent-child relationships are preserved
- [ ] Given spans are viewed, then they follow OpenTelemetry GenAI semantic conventions

**Test Scenarios:**
- Run analysis with multiple tool calls
- Verify span tree shows correct parent-child relationships
- Verify tool spans have `gen_ai.operation.name: execute_tool` attribute
- Verify LLM spans have `gen_ai.usage.input_tokens` / `output_tokens` attributes

---

### US-003 [P1]: SSE Streaming Observability

**As a** developer debugging streaming issues,
**I want** visibility into SSE event flow without log noise,
**So that** I can diagnose issues like "events not reaching TUI" or "stream timeouts".

**Acceptance Criteria:**
- [ ] Given SSE streaming starts, then a span is created for the stream lifecycle
- [ ] Given key streaming milestones occur, then span events are recorded (first_token, stream_complete)
- [ ] Given SSE events flow, then aggregate statistics are captured (event counts by type, not per-event logs)
- [ ] Given a streaming error or timeout, then the error is captured with context
- [ ] Given streaming completes, then duration and event counts are in the span

**Test Scenarios:**
- Run analysis with SSE streaming
- Verify stream span shows duration, event counts, first token latency
- Simulate stream timeout, verify error captured in span
- Verify individual SSE events are NOT logged (noise reduction)

---

### US-004 [P1]: TUI State Transition Observability

**As a** developer debugging TUI issues,
**I want** visibility into TUI state machine transitions,
**So that** I can diagnose issues like "input disabled when it shouldn't be".

**Acceptance Criteria:**
- [ ] Given TUI state changes, then a log entry records `from` and `to` states
- [ ] Given agent work state changes, then a log entry records the phase transition
- [ ] Given a user question is asked, then a span event captures the question metadata
- [ ] Given a permission is requested, then a span event captures the tool and pattern
- [ ] Given render cycles occur, then they are NOT logged (noise reduction)

**Test Scenarios:**
- Run TUI flow through welcome → analyzing → idle states
- Verify state transitions appear in logs with trace_id
- Verify render calls are not logged
- Verify question flow creates appropriate span events

---

### US-005 [P1]: Remote Observability Opt-In

**As a** privacy-conscious user,
**I want** remote observability to be explicitly opt-in with clear consent,
**So that** I control when my session data leaves my machine.

**Acceptance Criteria:**
- [ ] Given default configuration, then HoneyHive export is disabled
- [ ] Given `AGENTLINT_TELEMETRY=alpha` env var, then HoneyHive export is enabled
- [ ] Given first-time opt-in, then user sees a consent message explaining what data is sent
- [ ] Given opt-in, then only sanitized data is sent (no file contents, prompts redacted)
- [ ] Given local observability, then it is always enabled regardless of remote setting

**Test Scenarios:**
- Run without env var, verify no HoneyHive API calls
- Run with env var, verify HoneyHive receives traces
- Verify consent message appears on first opt-in
- Verify sensitive data is redacted in HoneyHive spans

---

### US-006 [P2]: Checkpoint Trace Context

**As a** developer replaying a failed session,
**I want** checkpoint files to include trace context,
**So that** I can correlate replay execution with original session traces.

**Acceptance Criteria:**
- [ ] Given a checkpoint is written, then it includes `trace_id` and `span_id` of the checkpoint moment
- [ ] Given a session is replayed from checkpoint, then logs reference the original trace_id
- [ ] Given replay execution, then new spans are created as children of the checkpoint span
- [ ] Given a replay completes, then I can view both original and replay spans in a single trace view

**Test Scenarios:**
- Run analysis to completion with checkpoints
- Replay from mid-session checkpoint
- Verify replay spans reference original trace context
- Verify HoneyHive (if enabled) shows unified trace

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Test |
|----|-------------|----------|-----------------|
| FR-001 | Generate UUID v7 trace ID at session start | P0 | Trace ID in first log line is valid UUID v7 |
| FR-002 | Propagate trace context via AsyncLocalStorage | P0 | All logs from session have same trace_id |
| FR-003 | Auto-inject trace_id/span_id into structured logs | P0 | Every log line has these fields |
| FR-004 | Create root span for session with GenAI attributes | P0 | HoneyHive shows session span |
| FR-005 | Create child spans for tool calls | P0 | Tool spans nested under session |
| FR-006 | Create child spans for LLM calls with token/cost data | P0 | LLM spans have usage attributes |
| FR-007 | Record SSE stream lifecycle as span with events | P1 | Stream span shows milestones |
| FR-008 | Log TUI state transitions with from/to states | P1 | State changes in logs |
| FR-009 | Export spans to HoneyHive via Vercel proxy (default) | P1 | Same trace_id in HoneyHive |
| FR-010 | Support user-provided OTLP collector endpoint (optional) | P1 | Traces appear in user's collector |
| FR-011 | Include trace context in checkpoint files | P2 | Checkpoint JSON has trace fields |

### 3.2 Non-Functional Requirements

| ID | Requirement | Target | Measurement |
|----|-------------|--------|-------------|
| NFR-001 | Observability overhead | <5% latency increase | Benchmark analysis with/without |
| NFR-002 | Memory for span tracking | <10MB per session | Memory profiling |
| NFR-003 | Log file size | <1MB per 5-minute session | File size measurement |
| NFR-004 | HoneyHive flush latency | Background, non-blocking | No user-visible delay |
| NFR-005 | Graceful degradation | Zero analysis impact on observability failure | Fault injection tests |

---

## 4. Key Entities (Data Model)

> Per Tool/Agent Boundary principle: These are data structures the observability system operates on. The agent decides what to observe.

### 4.1 Trace Context

```typescript
interface TraceContext {
  /** UUID v7 trace identifier, generated at session start */
  traceId: string;

  /** Current span identifier */
  spanId: string;

  /** Parent span identifier (for hierarchy) */
  parentSpanId?: string;

  /** W3C trace flags (sampling decision) */
  traceFlags: number;
}
```

### 4.2 Span Attributes (GenAI Conventions)

```typescript
interface AgentSpanAttributes {
  /** Operation type: invoke_agent, execute_tool, etc. */
  'gen_ai.operation.name': string;

  /** Provider: anthropic, openai, etc. */
  'gen_ai.provider.name'?: string;

  /** Session/conversation ID for multi-turn */
  'gen_ai.conversation.id': string;

  /** Model identifier */
  'gen_ai.request.model'?: string;

  /** Token usage */
  'gen_ai.usage.input_tokens'?: number;
  'gen_ai.usage.output_tokens'?: number;

  /** Tool-specific */
  'gen_ai.tool.name'?: string;
  'gen_ai.tool.success'?: boolean;
}
```

### 4.3 Structured Log Entry

```typescript
interface StructuredLogEntry {
  /** ISO timestamp */
  timestamp: string;

  /** Log level */
  level: 'debug' | 'info' | 'warn' | 'error';

  /** Logger namespace */
  namespace: string;

  /** Human-readable message */
  message: string;

  /** Trace correlation (auto-injected) */
  trace_id: string;
  span_id: string;

  /** Arbitrary structured data */
  data?: Record<string, unknown>;
}
```

---

## 5. Technical Design

### 5.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ CLI Entry (analyse.ts)                                      │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 1. Generate UUID v7 trace_id                            │ │
│ │ 2. Initialize OpenTelemetry TracerProvider              │ │
│ │ 3. Create root span: session                            │ │
│ │ 4. Store context in AsyncLocalStorage                   │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
         │
         │ context propagation
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Orchestrator / StreamAdapter / InkRenderer                  │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ - Access trace context from AsyncLocalStorage           │ │
│ │ - Create child spans for operations                     │ │
│ │ - Log with auto-injected trace_id                       │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
         │
         ├────────────────────────┬────────────────────────┐
         ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Local Exporter  │    │ HoneyHive       │    │ Checkpoint      │
│                 │    │ Exporter        │    │ Writer          │
│ - JSONL logs    │    │ (opt-in)        │    │                 │
│ - trace_id      │    │                 │    │ - trace_id      │
│ - Always on     │    │ - OTLP export   │    │ - span tree     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 5.2 Span Hierarchy Example

```
Session: "agentlint analyze ."
├─ trace_id: 018e5e5e-5e5e-7000-8000-0123456789ab
├─ Span: session [gen_ai.operation.name: invoke_agent]
│  │
│  ├─ Span: welcome_flow
│  │  ├─ Span: context_loading
│  │  ├─ Span: llm_greeting [gen_ai.usage.input_tokens: 523]
│  │  └─ Event: question_asked {requestId: "q_123"}
│  │
│  ├─ Span: analysis_phase
│  │  ├─ Span: tool_call [gen_ai.tool.name: session_query]
│  │  ├─ Span: tool_call [gen_ai.tool.name: config_read]
│  │  └─ Span: llm_reasoning [gen_ai.usage.output_tokens: 892]
│  │
│  └─ Span: sse_streaming
│     ├─ Event: stream_started
│     ├─ Event: first_token {latency_ms: 234}
│     └─ Event: stream_completed {chunks: 47, duration_ms: 2341}
```

### 5.3 Implementation Phases

**Phase 1: Local Observability Foundation** (Week 1-2)
- [ ] Add OpenTelemetry SDK dependencies
- [ ] Implement UUID v7 trace ID generation
- [ ] Create TraceContextProvider using AsyncLocalStorage
- [ ] Modify DebugLogger to auto-inject trace_id/span_id
- [ ] Create TracingSpanFactory for consistent span creation

**Phase 2: Span Instrumentation** (Week 2-3)
- [ ] Instrument orchestrator with session/tool/LLM spans
- [ ] Instrument StreamAdapter with SSE stream span
- [ ] Instrument InkRenderer with TUI state span events
- [ ] Add GenAI semantic convention attributes

**Phase 3: Remote Export** (Week 3-4)
- [ ] Implement HoneyHive OTLP exporter
- [ ] Add consent flow for first-time opt-in
- [ ] Verify trace correlation between local and HoneyHive
- [ ] Add sample rate configuration

**Phase 4: Checkpoint Integration** (Week 4)
- [ ] Add trace context to checkpoint schema
- [ ] Implement replay correlation logic
- [ ] Test end-to-end replay trace linkage

---

## 6. Clarifications

### Session 2026-01-30

**Q1: Should we use official @opentelemetry/* packages or a lighter custom wrapper?**
A: **Use official OTel packages.** The ~2MB bundle size is acceptable for a CLI tool. Benefits include standard compliance, HoneyHive SDK compatibility, and ecosystem support.

**Q2: For HoneyHive export, should we use their OTLP endpoint directly or continue the Vercel proxy pattern?**
A: **Support both export paths:**
- **Default**: Vercel proxy (maintains no-secrets-in-CLI principle, used by agentlint maintainers)
- **Optional**: User-provided OTLP collector endpoint for users who want to point to their own observability stack

This flexibility allows agentlint to collect telemetry via proxy while giving power users the option to send traces to their own infrastructure.

**Q3: What should be the default sample rate for HoneyHive when opted in?**
A: **1.0 (all traces).** agentlint sessions are infrequent, so cost impact is minimal. Full sampling provides the best debugging experience during alpha phase. Users can override in config if needed.

---

## 7. Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Trace correlation | 100% of logs have trace_id | Automated log validation |
| Span hierarchy accuracy | All tool calls have parent spans | Span tree validation |
| HoneyHive parity | Same trace_id in local and remote | Cross-system trace search |
| Performance overhead | <5% latency increase | Benchmark suite |
| Debug time reduction | 50% faster issue diagnosis | Developer feedback |

---

## 8. References

- [ADR-0025: Telemetry Architecture](../../docs/architecture/adr/0025-telemetry-architecture.md)
- [OpenTelemetry GenAI Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
- [W3C Trace Context](https://www.w3.org/TR/trace-context/)
- [HoneyHive OpenTelemetry SDK](https://www.honeyhive.ai/post/product-update-opentelemetry-native-sdks)
