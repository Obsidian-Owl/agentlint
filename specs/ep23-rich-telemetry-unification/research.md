# Research: EP23 Rich Telemetry Unification

> Comprehensive analysis of current state, gaps, and implementation path

## Executive Summary

agentlint has **two parallel observability systems** that were designed in EP22 to be unified but remain incompletely integrated:

1. **Local Observability** (`src/observability/`) - NDJSON traces with GenAI semantic conventions
2. **HoneyHive Telemetry** (`src/telemetry/`) - Events sent via Vercel proxy to HoneyHive

The systems share trace IDs (correlation exists) but NOT data richness. HoneyHive receives sparse traces because:
- LLM prompt/completion content is never sent
- Tool content exists in telemetry but isn't properly mapped
- Parent-child hierarchy is flat (all events → session)

---

## Current Architecture

### System 1: Observability Module

**Path**: `src/observability/`

| File | Purpose |
|------|---------|
| `trace-context.ts` | AsyncLocalStorage trace propagation |
| `trace-id.ts` | UUID v7 trace ID generation |
| `span-factory.ts` | GenAI-convention span creation |
| `content-capture.ts` | Opt-in tool argument/result capture |
| `exporters/local-exporter.ts` | NDJSON to `~/.agentlint/logs/` |

**Content Capture** (from `content-capture.ts`):
- Disabled by default (Constitution Principle I)
- Enabled via `AGENTLINT_CAPTURE_CONTENT=true`
- Max length: `AGENTLINT_CAPTURE_MAX_LENGTH` (default 5000)
- Uses `redact()` for secrets

### System 2: Telemetry Module

**Path**: `src/telemetry/`

| File | Purpose |
|------|---------|
| `alpha-client.ts` | HTTP client for Vercel proxy |
| `events.ts` | Event types and sanitization |
| `types.ts` | Interface definitions |

**Key Event Types**:
- `session.start` / `session.end`
- `tool.call`
- `llm.usage`
- `finding.detected`
- `prompt.used`

### System 3: Vercel Proxy

**Path**: `apps/telemetry-api/app/api/events/route.ts`

Transforms agentlint events → HoneyHive format:
- `session.start` → HoneyHive `/session/start`
- `tool.call` → HoneyHive `/events` with `event_type: 'tool'`
- `llm.usage` → HoneyHive `/events` with `event_type: 'model'`

---

## Gap Analysis

### GAP-001: No LLM Content to HoneyHive

**Current State** (from `alpha-client.ts:509-540`):
```typescript
const eventData: Record<string, unknown> = {
  model: options.model,
  provider: options.provider ?? 'anthropic',
  inputTokens: options.inputTokens,
  outputTokens: options.outputTokens,
  // NO promptContent, NO completionContent
};
```

**Impact**: HoneyHive shows token counts but not what was said

**Fix**: Add `promptContent` and `completionContent` when `AGENTLINT_CAPTURE_CONTENT=true`

### GAP-002: Tool Content Not Mapped to HoneyHive

**Current State**:
- `trackToolEx` accepts `toolInput` and `toolOutput`
- These ARE sent in telemetry events
- BUT Vercel proxy doesn't map them to HoneyHive's `inputs`/`outputs` properly

**Impact**: Tool debugging incomplete in HoneyHive

**Fix**: Update Vercel proxy `buildHoneyHiveInputs/Outputs` for tool events

### GAP-003: Flat Parent Hierarchy

**Current State** (from `alpha-client.ts:506`):
```typescript
const parentEventId = options.parentEventId ?? this.sessionEventIds.get(sessionId);
```

All events get session-start as parent → flat structure

**Impact**: No call tree visualization in HoneyHive waterfall

**Fix**: Use TelemetryTracker's turn context to assign proper parents

### GAP-004: Missing Cache Tokens in HoneyHive

**Current State**:
- `cacheReadTokens` and `cacheCreationTokens` are in telemetry events
- Vercel proxy doesn't map them to HoneyHive metrics

**Impact**: Can't track prompt caching effectiveness

**Fix**: Add to `buildHoneyHiveMetrics`:
```typescript
if (event.data.cacheReadTokens !== undefined) {
  metrics.cache_read_tokens = event.data.cacheReadTokens;
}
```

### GAP-005: Missing Reasoning Tokens

**Current State**:
- `reasoningTokens` tracked in TelemetryTracker session totals
- Not sent in individual LLM events to HoneyHive

**Impact**: Extended thinking costs not visible

**Fix**: Add to `trackLLMEx` options and Vercel proxy mapping

### GAP-006: Missing Agent Identity

**Current State**: No `gen_ai.agent.id` or `gen_ai.agent.name` in session

**Impact**: Can't filter agentlint sessions in HoneyHive

**Fix**: Add to session.start event:
```typescript
'gen_ai.agent.id': 'agentlint-cli',
'gen_ai.agent.name': 'agentlint',
```

### GAP-007: Trace ID Not Visible

**Current State**: `event.traceId` is set but not surfaced in HoneyHive metadata

**Impact**: Can't correlate local NDJSON traces with HoneyHive

**Fix**: Add to `buildHoneyHiveMetadata`:
```typescript
if (event.traceId) {
  base.trace_id = event.traceId;
}
```

---

## HoneyHive Expected Schema

### For Rich Traces

**Session Creation** (`/session/start`):
```json
{
  "session": {
    "project": "agentlint",
    "session_id": "uuid",
    "session_name": "agentlint-analyse-2026-01-31",
    "config": { "app_version": "0.1.0", "agent_id": "agentlint-cli" },
    "inputs": { "command": "analyse", "directory": "/path" },
    "user_properties": { "version": "0.1.0", "platform": "darwin" }
  }
}
```

**Model Event** (`/events`):
```json
{
  "event": {
    "event_type": "model",
    "event_name": "Claude: claude-sonnet-4",
    "config": {
      "model": "claude-sonnet-4-20250514",
      "provider": "anthropic",
      "temperature": 0.7,
      "max_tokens": 4096
    },
    "inputs": {
      "messages": [...],  // CRITICAL: Prompt content
      "system_instructions": "..."
    },
    "outputs": {
      "content": "...",  // CRITICAL: Completion content
      "stop_reason": "end_turn"
    },
    "metrics": {
      "prompt_tokens": 5000,
      "completion_tokens": 1200,
      "cache_read_tokens": 1500,
      "reasoning_tokens": 0,
      "cost": 0.035
    },
    "parent_id": "turn-event-id"  // NOT session-id for proper hierarchy
  }
}
```

**Tool Event** (`/events`):
```json
{
  "event": {
    "event_type": "tool",
    "event_name": "Tool: read_file",
    "config": { "tool_name": "read_file" },
    "inputs": {
      "arguments": { "path": "/file.ts" }  // CRITICAL: Tool args
    },
    "outputs": {
      "result": "..."  // CRITICAL: Tool result
    },
    "parent_id": "llm-event-id"  // Proper hierarchy
  }
}
```

---

## OpenTelemetry GenAI Conventions

### Standard Attributes We Should Use

| Attribute | Type | Current | Gap |
|-----------|------|---------|-----|
| `gen_ai.operation.name` | string | ✅ | - |
| `gen_ai.provider.name` | string | ✅ | - |
| `gen_ai.request.model` | string | ✅ | - |
| `gen_ai.response.model` | string | ❌ | Add |
| `gen_ai.response.id` | string | ❌ | Add |
| `gen_ai.usage.input_tokens` | int | ✅ | - |
| `gen_ai.usage.output_tokens` | int | ✅ | - |
| `gen_ai.usage.cache_creation.input_tokens` | int | ❌ | Add |
| `gen_ai.usage.cache_read.input_tokens` | int | ❌ | Add |
| `gen_ai.request.temperature` | double | ❌ | Add |
| `gen_ai.request.max_tokens` | int | ❌ | Add |
| `gen_ai.request.top_p` | double | ❌ | Add |
| `gen_ai.tool.name` | string | ✅ | - |
| `gen_ai.tool.call.id` | string | ❌ | Add |
| `gen_ai.tool.call.arguments` | string | ❌ | Add (opt-in) |
| `gen_ai.tool.call.result` | string | ❌ | Add (opt-in) |
| `gen_ai.agent.id` | string | ❌ | Add |
| `gen_ai.agent.name` | string | ❌ | Add |

### Events We Should Emit

| Event | When | Current | Gap |
|-------|------|---------|-----|
| `gen_ai.client.inference.operation.details` | LLM call with content | ❌ | Add (opt-in) |
| `gen_ai.evaluation.result` | After LLM-as-judge | ❌ | Future (EP11 integration) |

---

## Implementation Priority

### Phase 1: P0 - Content Capture (Most Value)

1. **Wire content-capture.ts to telemetry** (US-001, US-002)
   - Modify `trackLLMEx` to accept content options
   - Modify `trackToolEx` to pass content to HoneyHive
   - Update Vercel proxy to map content fields

### Phase 2: P1 - Metrics & Hierarchy

2. **Add cache tokens** (US-003)
   - Already in SDK, just need mapping

3. **Add hyperparameters** (US-004)
   - Add to trackLLMEx options
   - Map in Vercel proxy

4. **Fix parent hierarchy** (US-005)
   - TelemetryTracker already has turn context
   - Need to propagate to event parent IDs

### Phase 3: P2 - Polish

5. **Agent identity** (US-006)
6. **Session-end metrics** (US-007)
7. **Error enrichment** (US-008)
8. **Trace ID visibility** (FR-012)

### Phase 4: P3 - Optional

9. **Stream instrumentation** (US-009)

---

## References

- [EP22 Spec](../ep22-unified-observability/spec.md)
- [EP22 HoneyHive Gaps](../ep22-unified-observability/analysis-honeyhive-gaps.md)
- [HoneyHive Data Model](https://docs.honeyhive.ai/datamodel)
- [OTel GenAI Conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
