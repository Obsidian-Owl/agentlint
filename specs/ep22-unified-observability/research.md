# Research Findings: EP22 Unified Observability

## Decision Log

### 1. OpenTelemetry Package Selection

**Decision**: Use official `@opentelemetry/*` packages

**Rationale**:
- Standard compliance ensures compatibility with any OTLP backend
- HoneyHive's SDK is built on OTel, enabling direct integration
- Ecosystem support means community-maintained instrumentation for common libraries
- ~2MB bundle size is acceptable for a CLI tool

**Alternatives Considered**:
| Alternative | Why Rejected |
|-------------|--------------|
| Custom lightweight wrapper | Maintenance burden, would need to implement trace propagation, span management |
| Hybrid (OTel for remote only) | Adds complexity, two different trace models would need correlation |

**References**:
- [OpenTelemetry JS SDK](https://github.com/open-telemetry/opentelemetry-js)
- [HoneyHive OTel SDK announcement](https://www.honeyhive.ai/post/product-update-opentelemetry-native-sdks)

---

### 2. Trace ID Format

**Decision**: UUID v7 (time-sortable)

**Rationale**:
- Time-ordered (k-sortable) with millisecond precision in high bits
- W3C Trace Context compatible (128-bit)
- Natural chronological sorting in log files
- Better than UUID v4 (random) for debugging (can see temporal order)

**Implementation**:
```typescript
import { v7 as uuidv7 } from 'uuid';

function generateTraceId(): string {
  return uuidv7().replace(/-/g, '');  // Remove hyphens for W3C format
}
// Example: 018e5e5e5e5e70008000012345678ab → no hyphens, 32 hex chars
```

**References**:
- [UUID v7 RFC draft](https://www.ietf.org/archive/id/draft-peabody-dispatch-new-uuid-format-04.html)
- [W3C Trace Context](https://www.w3.org/TR/trace-context/)

---

### 3. Context Propagation Mechanism

**Decision**: Node.js AsyncLocalStorage

**Rationale**:
- Native to Node.js/Bun runtime (zero dependencies)
- Automatically propagates across async boundaries
- OTel SDK uses this under the hood
- No manual context passing required

**Implementation Pattern**:
```typescript
import { AsyncLocalStorage } from 'node:async_hooks';

interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
}

const traceStorage = new AsyncLocalStorage<TraceContext>();

// At session start
traceStorage.run({ traceId, spanId: rootSpanId }, async () => {
  // All code in this async context has access to trace
  await runAnalysis();
});

// Anywhere in codebase
function getTraceContext(): TraceContext | undefined {
  return traceStorage.getStore();
}
```

**References**:
- [Node.js AsyncLocalStorage docs](https://nodejs.org/api/async_context.html)
- [OTel Context API](https://opentelemetry.io/docs/concepts/context-propagation/)

---

### 4. Export Architecture

**Decision**: Dual-path (Vercel proxy default + optional user OTLP)

**Rationale**:
- **Vercel proxy (default)**: Maintains no-secrets-in-CLI principle from ADR-0025. agentlint maintainers receive telemetry for product improvement.
- **User OTLP (optional)**: Power users can point to their own observability stack (Datadog, Grafana, self-hosted Jaeger, etc.)

**Configuration**:
```typescript
interface ObservabilityConfig {
  local: {
    enabled: boolean;  // Always true
    level: 'debug' | 'info' | 'warn' | 'error';
  };
  remote: {
    enabled: boolean;  // Default: false (opt-in)
    // Default export path (proxy)
    proxy: {
      endpoint: string;  // https://agentlint.vercel.app/api/traces
    };
    // Optional user-provided OTLP endpoint
    userEndpoint?: {
      url: string;          // e.g., https://otel.example.com:4318
      headers?: Record<string, string>;  // Auth headers
    };
    sampleRate: number;  // Default: 1.0
  };
}
```

**Environment Variables**:
```bash
# Enable remote telemetry (sends to proxy)
AGENTLINT_TELEMETRY=alpha

# Optional: Send ALSO to user's own OTLP endpoint
AGENTLINT_OTLP_ENDPOINT=https://otel.example.com:4318
AGENTLINT_OTLP_HEADERS="Authorization=Bearer xxx"
```

**References**:
- [ADR-0025: Telemetry Architecture](../../docs/architecture/adr/0025-telemetry-architecture.md)

---

### 5. GenAI Semantic Conventions

**Decision**: Follow OpenTelemetry GenAI semantic conventions

**Rationale**:
- Emerging standard for AI/ML observability
- HoneyHive and other tools recognize these attributes
- Future-proof as the standard matures

**Key Attributes**:
```typescript
// Session span
'gen_ai.operation.name': 'invoke_agent',
'gen_ai.conversation.id': sessionId,
'gen_ai.provider.name': 'anthropic',

// Tool span
'gen_ai.operation.name': 'execute_tool',
'gen_ai.tool.name': 'session_query',
'gen_ai.tool.success': true,

// LLM span
'gen_ai.request.model': 'claude-sonnet-4-20250514',
'gen_ai.usage.input_tokens': 1523,
'gen_ai.usage.output_tokens': 342,
'gen_ai.response.finish_reasons': ['end_turn'],
```

**References**:
- [OTel GenAI Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
- [GenAI Agent Spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/)

---

### 6. Log Correlation Strategy

**Decision**: Auto-inject trace_id/span_id into all structured logs

**Rationale**:
- Unified debugging surface: grep log file by trace_id to find all related entries
- Same trace_id in HoneyHive UI for cross-system correlation
- No manual logging changes required in existing code

**Implementation**:
```typescript
// Modify existing DebugLogger
class DebugLogger {
  log(level: string, message: string, data?: Record<string, unknown>) {
    const ctx = getTraceContext();
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      namespace: this.namespace,
      message,
      trace_id: ctx?.traceId,  // Auto-injected
      span_id: ctx?.spanId,    // Auto-injected
      data,
    };
    this.writeEntry(entry);
  }
}
```

**References**:
- [OTel Log Correlation](https://opentelemetry.io/docs/concepts/signals/logs/)

---

### 7. SSE Streaming Observability

**Decision**: Aggregate streaming into a single span with milestone events

**Rationale**:
- Per-chunk logging creates noise (47+ events per stream)
- Key milestones are what matter for debugging: start, first_token, complete, error
- Duration and aggregate stats captured in span attributes

**Implementation**:
```typescript
const streamSpan = tracer.startSpan('sse_streaming');
streamSpan.addEvent('stream_started');

let firstTokenLogged = false;
for await (const chunk of events) {
  if (!firstTokenLogged && chunk.type === 'message.part.updated') {
    streamSpan.addEvent('first_token', { latency_ms: Date.now() - startTime });
    firstTokenLogged = true;
  }
  // Process chunk (don't log each one)
}

streamSpan.setAttributes({
  'stream.chunks': chunkCount,
  'stream.duration_ms': Date.now() - startTime,
});
streamSpan.end();
```

**References**:
- [AI Observer patterns](https://github.com/tobilg/ai-observer)

---

## Unresolved Items

None - all clarifications resolved in spec.

## Dependencies to Add

```json
{
  "@opentelemetry/api": "^1.7.0",
  "@opentelemetry/sdk-trace-node": "^1.21.0",
  "@opentelemetry/exporter-trace-otlp-http": "^0.48.0",
  "@opentelemetry/semantic-conventions": "^1.21.0",
  "uuid": "^9.0.0"
}
```

Note: May need `@opentelemetry/resources` for service identification.
