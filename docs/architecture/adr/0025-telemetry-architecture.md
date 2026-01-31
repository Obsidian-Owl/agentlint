---
status: accepted
date: 2026-01-28
decision-makers: [Project Lead]
consulted: []
informed: []
---

# ADR-0025: Telemetry Architecture

## Context and Problem Statement

agentlint needs observability into analysis sessions to understand tool usage patterns, token consumption, error rates, and overall session health during alpha development. This telemetry supports product decisions and quality improvement.

However, Constitution Principle I (Local-First) states: "No data leaves without explicit user consent" and "No telemetry, analytics, or data collection without opt-in." Any telemetry architecture must satisfy this constraint while providing meaningful observability.

Additionally, HoneyHive (our chosen observability backend) has **no auto-instrumentation** for the Opencode SDK or Claude Agent SDK. A custom integration is required.

## Decision Drivers

- **Constitution Principle I**: Local-first, opt-in only, no secrets in CLI
- **No HoneyHive SDK support**: No auto-instrumentation for our SDK stack
- **Alpha-phase needs**: Understanding tool/LLM usage without user content
- **Graceful degradation**: Telemetry failures must never affect analysis
- **Future flexibility**: Backend should be swappable without CLI changes

## Considered Options

1. **HoneyHive Python/JS SDK direct integration** — Use HoneyHive's official SDK
2. **Custom Vercel proxy with HoneyHive API** — CLI POSTs to proxy, proxy forwards to HoneyHive
3. **OpenTelemetry (OTEL) standard** — Emit OTEL traces, user routes to any backend
4. **No telemetry** — Ship without observability

## Decision Outcome

Chosen option: **"Custom Vercel proxy with HoneyHive API"** (Option 2) because:

- HoneyHive SDK has no auto-instrumentation for our SDK stack (eliminates Option 1)
- CLI contains zero secrets — API key lives server-side in Vercel environment
- Proxy can transform schema without CLI updates
- Graceful degradation is trivial (HTTP POST failure → silently drop)
- OTEL (Option 3) is deferred as a future mode (`telemetry.mode: 'otel'`)

### Architecture

```
┌────────────────────────┐     ┌───────────────────────┐     ┌──────────────┐
│  agentlint CLI          │     │  Vercel Edge Function  │     │  HoneyHive   │
│                        │     │  /api/events           │     │              │
│  IOrchestratorTelemetry│     │                       │     │  session/    │
│  Client (interface)    │     │  Transform to          │     │   start      │
│       │                │     │  HoneyHive schema      │     │  events      │
│       ▼                │     │  (8 builder functions) │     │              │
│  AlphaTelemetryClient  │────►│                       │────►│              │
│  • Buffer events       │POST │  Secrets:             │POST │              │
│  • Flush every 10s     │JSON │  • HONEYHIVE_API_KEY  │     │              │
│  • Max 100 buffer      │     │  • HONEYHIVE_PROJECT  │     │              │
│  • 5s request timeout  │     └───────────────────────┘     └──────────────┘
└────────────────────────┘
```

### Orchestrator Telemetry Wiring

```
CLI (analyse.ts)
  │  getTelemetryClient() → AlphaTelemetryClient
  │  telemetry.sessionStart()
  │  config.telemetryClient = telemetry
  ▼
createOrchestrator(config)
  ├─ Legacy: Orchestrator (inline tracking maps, ~200 lines)
  └─ Opencode: OpencodeOrchestrator
       └─ TelemetryTracker (encapsulated)
            ├─ onToolStart/onToolComplete (FIFO queue correlation)
            ├─ onLLMUsage (token/cost/latency tracking)
            └─ onTurnStart (latency baseline)
```

### Data Tracked (When Opted In)

| Category       | Data                                        | Privacy                              |
| -------------- | ------------------------------------------- | ------------------------------------ |
| Tool execution | Name, duration, success/failure             | Input/output truncated to 5000 chars |
| LLM usage      | Model, tokens (in/out/cache), cost, latency | No prompt or response content        |
| Session        | Command, duration, project type             | No file paths or user content        |
| Errors         | Error category                              | Messages capped at 500 chars         |

### Data NOT Tracked

- User file contents or project data
- Prompt or response text
- File paths (beyond project type classification)
- Environment variables or credentials
- Any data when telemetry is disabled (default)

### Opt-In Mechanism

```bash
# Enable via environment variable
AGENTLINT_TELEMETRY=alpha agentlint analyse

# Enable via config file
# ~/.agentlint/config.json
{ "telemetry": { "enabled": true, "mode": "alpha" } }
```

Modes:

- `disabled` (default) — No telemetry
- `alpha` — Send to agentlint Vercel proxy → HoneyHive
- `otel` (future) — Send to user's own OTEL backend

### Key Design Decisions

**FIFO Queue for Tool Correlation (Opencode)**: The Opencode SDK has no `toolId` concept. Multiple concurrent calls to the same tool are correlated using a FIFO queue per tool name — the first `onToolComplete` matches the first `onToolStart` for that name.

**Shared Truncation Utilities**: Both legacy and Opencode orchestrators share `truncateToolOutput`, `truncateToolInput`, and `extractErrorMessage` from `src/orchestration/telemetry-utils.ts` to ensure consistent data sanitization.

**TelemetryTracker Encapsulation**: Unlike the legacy orchestrator (inline tracking across ~200 lines), the Opencode orchestrator delegates all tracking to a `TelemetryTracker` class with clear memory bounds (MAX_PENDING_TOOLS=100, TTL=5min).

**Side-Effect Only**: Telemetry tracking happens after stream chunks are yielded. Telemetry failures never block or affect the analysis stream.

### Consequences

**Good:**

- Zero secrets in CLI binary
- Graceful degradation — telemetry failures are silent
- Schema changes don't require CLI updates
- Privacy enforced at multiple layers (opt-in, truncation, sanitization)
- Backend swappable without CLI changes

**Bad:**

- Custom proxy adds deployment dependency
- No real-time debugging (buffered, 10s flush interval)
- HoneyHive schema coupling lives in Vercel function (not in CLI)

**Neutral:**

- OTEL support deferred (mode exists in config, not implemented)
- Per-tool tracking adds ~1KB memory per pending tool call

## Constitution Compliance

| Principle                | Compliance | Evidence                                                              |
| ------------------------ | ---------- | --------------------------------------------------------------------- |
| I. Local-First           | ✅ Full    | Opt-in only, zero secrets in CLI, no data without consent             |
| II. Improvement-Oriented | ✅         | Telemetry data informs product improvement                            |
| III. Causal-First        | N/A        |                                                                       |
| IV. Mixed-Methods        | N/A        |                                                                       |
| V. Contextual            | N/A        |                                                                       |
| VI. Traceable            | ✅         | Session/event IDs enable trace correlation                            |
| VII. Intelligent Tooling | ✅         | `IOrchestratorTelemetryClient` is a pure data interface — no judgment |
| VIII. Conventional       | ✅         | Follows standard proxy pattern; truncation conventions shared         |
| IX. Agent-Aware          | N/A        |                                                                       |

## EP22 Implementation: Unified Observability (v2 - 2026-01-28)

The initial version of this ADR (2025-10-XX) described a HoneyHive-based telemetry system using a Vercel proxy. EP22 implemented a **second-generation observability architecture** that replaces this with a modern OpenTelemetry-based approach while maintaining Constitution compliance.

### What Changed

**From**: Custom telemetry client → Vercel proxy → HoneyHive API

**To**: Unified OpenTelemetry traces with local NDJSON export + optional OTLP remote export

### Key Differences

| Aspect | Original (HoneyHive) | EP22 (OpenTelemetry) |
|--------|---------------------|----------------------|
| **Architecture** | CLI → Vercel proxy → HoneyHive | CLI → LocalSpanExporter + OtlpExporter |
| **Local storage** | Buffered in memory | NDJSON files with rotation |
| **Remote export** | Via Vercel (secrets server-side) | OTLP/HTTP with data sanitization |
| **Span hierarchy** | Flat event tracking | Full Session → Tool → LLM hierarchy |
| **Semantic conventions** | Custom schema | OpenTelemetry GenAI conventions |
| **Trace correlation** | Event IDs | W3C trace IDs + parent span IDs |
| **Context propagation** | Explicit passing | AsyncLocalStorage (automatic) |
| **Privacy sanitization** | At proxy | Span exporter level |

### Architecture

```
┌─────────────────────────────┐
│  agentlint CLI              │
│                             │
│  TraceContextProvider       │  ← Root trace context (W3C trace ID)
│  (AsyncLocalStorage)        │
│         │                   │
│         ▼                   │
│  Instrumentation Points:    │
│  • Session span             │  ← Parent-child hierarchy
│  • Tool span                │     maintained via context
│  • LLM span                 │
│         │                   │
└─────────┼───────────────────┘
          │
          ├─────────────────────────────────────┐
          │                                     │
          ▼                                     ▼
  ┌─────────────────────┐         ┌──────────────────────┐
  │ LocalSpanExporter   │         │ OtlpExporter         │
  │                     │         │ (opt-in)             │
  │ ~/.agentlint/logs/  │         │                      │
  │ traces-{date}.ndjson│         │ • Sanitizes attrs    │
  │                     │         │ • Redacts prompts    │
  │ • Rotation at 10MB  │         │ • Removes file paths │
  │ • NDJSON format     │         │                      │
  └─────────────────────┘         └──────────────┬───────┘
                                                  │
                                                  ▼
                                        ┌──────────────────┐
                                        │ OTLP Endpoint    │
                                        │ (user-provided)  │
                                        │                  │
                                        │ • Jaeger         │
                                        │ • DataDog        │
                                        │ • New Relic      │
                                        │ • Custom         │
                                        └──────────────────┘
```

### Trace Context Integration

Trace context flows through the entire execution using Node.js `AsyncLocalStorage`:

```
┌──────────────────────────────────────────────────────┐
│  traceContextProvider.run(async () => {              │
│    // Trace ID: abc123... (W3C standard)             │
│    // Span ID: root0001                              │
│                                                      │
│    await instrumentSession({...}, async (span) => {  │
│      // Span ID: sess0001, parentSpanId: root0001   │
│      // Trace ID: abc123... (inherited)              │
│                                                      │
│      await toolRegistry.call('read_file', {...}, async (span) => {
│        // Span ID: tool0001, parentSpanId: sess0001 │
│        // Trace ID: abc123... (inherited)            │
│        await orchestrator.query({...}, async (span) => {
│          // Span ID: llm0001, parentSpanId: tool0001 │
│          // Trace ID: abc123... (inherited)          │
│        });                                           │
│      });                                             │
│    });                                               │
│  });                                                 │
└──────────────────────────────────────────────────────┘
```

No explicit context passing required — `AsyncLocalStorage` propagates it through the call chain.

### Span Hierarchy

**Session spans** (top-level):
- Attributes:
  - `session.id` - Unique session identifier
  - `session.model` - Claude model used (e.g., claude-sonnet-4-20250514)
  - `session.chunk_count` - Total streaming chunks received
  - `task.length` - Character length of user task
  - `task.preview` - First 100 characters of task (truncated for privacy)
- Events:
  - `session.start` - Session initialization
  - `prompt.sent` - User prompt transmitted to API
  - `stream.complete` - Streaming finished successfully (includes chunkCount attribute)
  - `stream.aborted` - Stream interrupted by user or timeout
  - `session.error` - Exception occurred (includes error message attribute)
- Duration: entire streaming phase from generator start to finally block
- Status: `ok` on success, `error` with message on failure

**Tool spans** (children of session):
- Attributes: tool name, call ID, input size, output size, success/failure
- Events: start, completion, error (if failed)
- Duration: tool execution time

**LLM spans** (children of tool or session):
- Attributes: model, temperature, max_tokens, input/output/cache tokens, latency, estimated cost
- Events: request start, streaming chunks, completion
- Duration: API call + streaming time

**Stream spans** (children of session):
- Attributes: chunk count, streaming duration, token counts
- Events: chunk received milestones
- Duration: entire streaming phase

### Session Span Semantic Conventions

Session spans follow OpenTelemetry GenAI semantic conventions with agentlint-specific extensions.

**Attribute Naming**:

- `session.id` — Unique session identifier (UUID v4)
- `session.model` — Claude model identifier (e.g., `claude-sonnet-4-20250514`)
- `session.chunk_count` — Total streaming chunks received during analysis
- `task.length` — Character length of complete user task input
- `task.preview` — First 100 characters of user task (truncated for privacy)

**Event Naming** (past tense verb convention):

- `session.start` — Session initialization, emitted before first prompt transmission
- `prompt.sent` — User prompt successfully transmitted to Claude API
- `stream.complete` — Streaming finished successfully; includes final `chunkCount` attribute
- `stream.aborted` — Stream interrupted by user, timeout, or network failure
- `session.error` — Exception occurred; includes `error.message` attribute (capped at 500 chars)

**Rationale**:

- Follows OpenTelemetry semantic conventions where applicable (prefixes for attribute namespacing)
- Uses `session.` prefix for session-level metadata (standard in GenAI conventions)
- Uses `task.` prefix for user input metadata (distinct from `gen_ai.` which covers prompts)
- Event names use past tense (`.start`, `.complete`) to indicate state changes
- Attribute values are never truncated at capture time; truncation happens at export (OTLP layer)

### OTLP Exporter Sanitization

When exporting to OTLP endpoints, all sensitive attributes are redacted:

**Patterns redacted**:
- `gen_ai.prompt.user` / `gen_ai.prompt.system` → `[REDACTED:PROMPT]`
- `gen_ai.completion` → `[REDACTED:COMPLETION]`
- `tool.arguments.content` (file contents) → `[REDACTED:FILE_CONTENT]`
- `tool.result` (tool outputs) → `[REDACTED:TOOL_OUTPUT]`
- Anything matching API key / secret patterns → `[REDACTED:SECRET]`

**Non-sensitive attributes preserved**:
- Model names, temperatures, token counts
- Tool names and execution times
- Success/failure status
- Error messages (capped at 500 chars, file paths stripped)

### Configuration

**Environment variables** (opt-in):

```bash
# Enable OTLP export
export AGENTLINT_TELEMETRY=otel
export AGENTLINT_OTLP_ENDPOINT=http://localhost:4318/v1/traces

# OR use standard OTel fallback
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

# Configure content capture (debugging only)
export AGENTLINT_CAPTURE_CONTENT=true
export AGENTLINT_CAPTURE_MAX_LENGTH=5000
```

**Programmatic configuration**:

```typescript
import { ObservabilityConfig, DEFAULT_OBSERVABILITY_CONFIG } from './observability';

const config: ObservabilityConfig = {
  ...DEFAULT_OBSERVABILITY_CONFIG,
  otlpEnabled: true,
  otlpEndpoint: 'http://localhost:4318/v1/traces',
  localLogging: true,  // Also write local NDJSON
  sampleRate: 1.0,     // Capture all traces
};
```

### Data Comparison

| Data Category | Original System | EP22 (Local) | EP22 (OTLP) |
|---|---|---|---|
| Tool execution (name, duration, success) | Sent to HoneyHive | Local NDJSON | Exported (sanitized) |
| LLM tokens (input/output/cache) | Sent to HoneyHive | Local NDJSON | Exported (no content) |
| Session metadata | Sent to HoneyHive | Local NDJSON | Exported (no file paths) |
| File paths | Classified only | Not included | Not included |
| Prompts/completions | Truncated, sent to HoneyHive | Not captured | Redacted |
| Tool arguments/results | Truncated, sent to HoneyHive | Opt-in only | Redacted if captured |

### Advantages Over Original

1. **No external dependency** — Vercel proxy eliminated, no deployment needed
2. **Stronger privacy** — Sanitization at export layer, local files not transmitted
3. **Better structure** — Full trace hierarchy (session → tool → LLM) vs flat events
4. **Flexibility** — Users can route to any OTLP backend (Jaeger, DataDog, Grafana, custom)
5. **Standards** — Uses OpenTelemetry conventions, not custom schema
6. **Observability flexibility** — Local NDJSON useful even without remote export
7. **Trace correlation** — W3C standard trace IDs enable cross-system correlation

### Backward Compatibility

- Existing `IOrchestratorTelemetryClient` code still works (legacy telemetry path)
- Traces and telemetry run in parallel during transition period
- No breaking changes to public APIs
- Telemetry client will eventually be removed in a future major version

### Implementation Details

**Modules**:
- `src/observability/trace-context.ts` — AsyncLocalStorage provider
- `src/observability/span-factory.ts` — Span creation with semantic conventions
- `src/observability/exporters/local-exporter.ts` — NDJSON file export
- `src/observability/exporters/otlp-exporter.ts` — OTLP/HTTP export with sanitization
- `src/observability/content-capture.ts` — Optional content capture for debugging
- `src/observability/consent.ts` — Telemetry consent management
- `src/observability/instrumentation/orchestrator.ts` — Orchestrator integration points

**Integration points**:
- `src/opencode/orchestrator.ts` — Wraps tool calls and LLM queries in spans
- `src/opencode/streaming.ts` — Emits streaming phase events
- `src/opencode/telemetry-tracker.ts` — Creates telemetry spans

### Known Limitations

**Async Generator Span Management**

Standard OpenTelemetry span wrappers (like `withSpan()`) expect functions that return Promises. However, `OpencodeOrchestrator.runInSessionSpan()` is an async generator that yields streaming chunks over time. Due to a Node.js/V8 limitation (see [OpenTelemetry JS issue #2951](https://github.com/open-telemetry/opentelemetry-js/issues/2951) and [nodejs/node#42237](https://github.com/nodejs/node/issues/42237)), AsyncLocalStorage context does not propagate across generator yields.

**Approved Workaround Pattern:**

For async generators, use manual span lifecycle management:

1. Generate `traceId` and `spanId` at generator start using `generateTraceId()` and `generateSpanId()`
2. Track events and attributes during iteration
3. Export the span in the `finally` block with aggregated data

```typescript
async *runInSessionSpan(): AsyncGenerator<StreamChunk> {
  const traceId = generateTraceId();
  const spanId = generateSpanId();
  const startTime = Date.now();
  const events: SpanEvent[] = [];
  let status: 'ok' | 'error' = 'ok';

  try {
    events.push({ name: 'session.start', timestamp: Date.now() });
    // ... yield chunks ...
  } catch (error) {
    status = 'error';
    throw error;
  } finally {
    if (this.spanExporter) {
      this.spanExporter.export([{ traceId, spanId, startTime, ... }]);
    }
  }
}
```

This pattern ensures spans are properly exported even when generators are interrupted or error.

## Related

- [ADR-0024](0024-opencode-sdk-migration.md) — Opencode SDK migration (EP22 unified with tracing)
- [ADR-0019](0019-tool-agent-boundary-temporal.md) — Tool/agent boundary (traces are data, not judgment)
- [Arc42 §8.6](../arc42/08-crosscutting-concepts.md) — Logging & Observability section
- [CLAUDE.md § Observability Module](../../CLAUDE.md#observability-module-ep22) — Implementation guide
