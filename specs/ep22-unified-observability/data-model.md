# Data Model: EP22 Unified Observability

## Overview

This document defines the data structures for agentlint's unified observability system. All models follow OpenTelemetry conventions and are designed for both local JSONL storage and OTLP export.

## Core Entities

### 1. Trace Context

The trace context propagates through all operations in a session, enabling correlation across logs, spans, and checkpoints.

```
┌─────────────────────────────────────────────────────────────────┐
│                        TraceContext                              │
├─────────────────────────────────────────────────────────────────┤
│ traceId      │ UUID v7 (32 hex chars, no hyphens)               │
│ spanId       │ 16 hex chars                                      │
│ parentSpanId │ 16 hex chars (optional, for hierarchy)           │
│ traceFlags   │ 8-bit sampling decision (01 = sampled)           │
└─────────────────────────────────────────────────────────────────┘
```

**W3C Trace Context Format**:
```
traceparent: 00-{traceId}-{spanId}-{traceFlags}
Example:     00-018e5e5e5e5e70008000012345678ab-a1b2c3d4e5f6a7b8-01
```

### 2. Span

Spans represent operations with start/end times and attributes.

```
┌─────────────────────────────────────────────────────────────────┐
│                           Span                                   │
├─────────────────────────────────────────────────────────────────┤
│ traceId        │ From TraceContext                              │
│ spanId         │ Unique identifier for this span                │
│ parentSpanId   │ Parent span (null for root)                    │
│ name           │ Operation name (e.g., "session", "tool_call")  │
│ kind           │ INTERNAL | CLIENT | SERVER                     │
│ startTimeUnixNano │ Start timestamp (nanoseconds)               │
│ endTimeUnixNano   │ End timestamp (nanoseconds)                 │
│ status         │ { code: OK|ERROR, message?: string }           │
│ attributes     │ Key-value pairs (GenAI conventions)            │
│ events         │ Array of span events (milestones)              │
│ links          │ References to related spans                    │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Span Event

Events mark points in time within a span (e.g., first_token, stream_complete).

```
┌─────────────────────────────────────────────────────────────────┐
│                        SpanEvent                                 │
├─────────────────────────────────────────────────────────────────┤
│ name           │ Event name (e.g., "first_token")               │
│ timeUnixNano   │ Event timestamp (nanoseconds)                  │
│ attributes     │ Event-specific data                            │
└─────────────────────────────────────────────────────────────────┘
```

### 4. Structured Log Entry

Log entries with auto-injected trace context for correlation.

```
┌─────────────────────────────────────────────────────────────────┐
│                    StructuredLogEntry                            │
├─────────────────────────────────────────────────────────────────┤
│ timestamp      │ ISO 8601 string                                │
│ level          │ debug | info | warn | error                    │
│ namespace      │ Logger namespace (e.g., "agentlint:streaming") │
│ message        │ Human-readable message                         │
│ trace_id       │ From TraceContext (auto-injected)              │
│ span_id        │ From TraceContext (auto-injected)              │
│ data           │ Arbitrary structured data (optional)           │
└─────────────────────────────────────────────────────────────────┘
```

## GenAI Semantic Conventions

Following [OpenTelemetry GenAI Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) v1.39.0+.

### Session Span Attributes

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `gen_ai.operation.name` | string | Yes | `invoke_agent` |
| `gen_ai.conversation.id` | string | Yes | Session ID |
| `gen_ai.provider.name` | string | Yes | `anthropic` |
| `gen_ai.agent.id` | string | Yes | `agentlint-cli` |
| `gen_ai.agent.name` | string | Yes | `agentlint` |
| `gen_ai.agent.description` | string | No | Agent description |
| `agentlint.session.target` | string | No | Analysis target path |
| `agentlint.session.command` | string | No | CLI command invoked |
| `agentlint.project.name` | string | No | Project/directory name |
| `agentlint.project.type` | string | No | Detected project type |

**Session-End Metrics** (set when span ends):

| Attribute | Type | Description |
|-----------|------|-------------|
| `agentlint.session.tool_call_count` | number | Total tool calls in session |
| `agentlint.session.finding_count` | number | Findings detected |
| `agentlint.session.recommendation_count` | number | Recommendations generated |
| `agentlint.session.success` | boolean | Session completed successfully |

### Tool Span Attributes

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `gen_ai.operation.name` | string | Yes | `execute_tool` |
| `gen_ai.tool.name` | string | Yes | Tool name (e.g., `session_query`) |
| `gen_ai.tool.call.id` | string | No | Unique tool call identifier |
| `gen_ai.tool.type` | string | No | `function` (always for agentlint) |
| `gen_ai.tool.success` | boolean | Yes | Whether tool succeeded |
| `gen_ai.tool.call.arguments` | string | Opt-in | Tool input as JSON (truncated) |
| `gen_ai.tool.call.result` | string | Opt-in | Tool output as JSON (truncated) |
| `agentlint.tool.duration_ms` | number | No | Tool execution duration |

**Content capture**: `gen_ai.tool.call.arguments` and `gen_ai.tool.call.result` are opt-in via `AGENTLINT_CAPTURE_CONTENT=1`. Content is truncated to 5000 chars.

### LLM Span Attributes

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `gen_ai.operation.name` | string | Yes | `chat` |
| `gen_ai.request.model` | string | Yes | Model ID requested |
| `gen_ai.response.model` | string | No | Model ID that responded |
| `gen_ai.response.id` | string | No | Unique completion identifier |
| **Token Usage** | | | |
| `gen_ai.usage.input_tokens` | number | No | Total input tokens |
| `gen_ai.usage.output_tokens` | number | No | Total output tokens |
| `gen_ai.usage.cache_creation.input_tokens` | number | No | Tokens written to cache (Anthropic) |
| `gen_ai.usage.cache_read.input_tokens` | number | No | Tokens read from cache (Anthropic) |
| **Request Parameters** | | | |
| `gen_ai.request.temperature` | number | No | Temperature setting |
| `gen_ai.request.max_tokens` | number | No | Max tokens setting |
| `gen_ai.request.top_p` | number | No | Top-p sampling |
| `gen_ai.request.stop_sequences` | string[] | No | Stop sequences |
| **Response Details** | | | |
| `gen_ai.response.finish_reasons` | string[] | No | Finish reasons (e.g., `["end_turn"]`) |
| **agentlint-specific** | | | |
| `agentlint.llm.latency_ms` | number | No | LLM response latency |
| `agentlint.llm.cost_usd` | number | No | Estimated cost |
| `agentlint.llm.tokens_per_second` | number | No | Output tokens / latency |

### SSE Stream Span Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `gen_ai.operation.name` | string | `sse_streaming` |
| `agentlint.stream.chunk_count` | number | Total chunks received |
| `agentlint.stream.duration_ms` | number | Stream duration |
| `agentlint.stream.first_token_ms` | number | Time to first token |
| `agentlint.stream.event_counts` | object | Counts by event type |

### Span Events

#### TUI State Events

| Event Name | Attributes | When Recorded |
|------------|------------|---------------|
| `tui_state_change` | `from`, `to` | State machine transition |
| `agent_work_change` | `from`, `to` | Agent work phase change |
| `question_asked` | `request_id`, `question_count` | Agent asks user question |
| `permission_requested` | `tool`, `pattern` | Permission dialog shown |

#### Analysis Events

| Event Name | Attributes | When Recorded |
|------------|------------|---------------|
| `agentlint.finding.detected` | `type`, `severity`, `id` | Finding discovered |
| `agentlint.recommendation.generated` | `type`, `finding_id` | Recommendation created |
| `agentlint.checkpoint.saved` | `type`, `sequence` | Checkpoint written |

#### Evaluation Events (OTel Standard)

| Event Name | Attributes | When Recorded |
|------------|------------|---------------|
| `gen_ai.evaluation.result` | `name`, `score.value`, `score.label`, `explanation`, `response.id` | After LLM-as-judge evaluation |

#### Content Events (Opt-In)

| Event Name | Attributes | When Recorded |
|------------|------------|---------------|
| `gen_ai.client.inference.operation.details` | `input.messages`, `output.messages`, `system_instructions`, `tool.definitions` | Per LLM call (opt-in) |

**Privacy**: Content events require `AGENTLINT_CAPTURE_CONTENT=1`. Messages are truncated to 500 chars.

## Span Hierarchy

```
Session (root span)
├── gen_ai.operation.name: invoke_agent
├── gen_ai.conversation.id: {sessionId}
│
├── welcome_flow (child span)
│   ├── context_loading
│   ├── llm_greeting
│   │   ├── gen_ai.usage.input_tokens: 523
│   │   └── gen_ai.usage.output_tokens: 127
│   └── [Event: question_asked]
│
├── analysis_phase (child span)
│   ├── tool_call: session_query
│   │   ├── gen_ai.tool.name: session_query
│   │   └── gen_ai.tool.success: true
│   ├── tool_call: config_read
│   └── llm_reasoning
│       └── gen_ai.usage.output_tokens: 892
│
└── sse_streaming (child span)
    ├── [Event: stream_started]
    ├── [Event: first_token {latency_ms: 234}]
    └── [Event: stream_completed {chunks: 47}]
```

## Storage Schemas

### Local JSONL Log Format

Each line is a JSON object:

```json
{"timestamp":"2026-01-30T10:15:30.123Z","level":"info","namespace":"agentlint:orchestrator","message":"Session started","trace_id":"018e5e5e5e5e70008000012345678ab","span_id":"a1b2c3d4e5f6a7b8","data":{"target":"."}}
```

### Checkpoint Trace Context

Checkpoints include trace context for replay correlation:

```json
{
  "id": "cp_123",
  "timestamp": "2026-01-30T10:15:30.123Z",
  "phase": "analysis",
  "trace_context": {
    "trace_id": "018e5e5e5e5e70008000012345678ab",
    "span_id": "a1b2c3d4e5f6a7b8",
    "parent_span_id": "0000000000000000"
  },
  "state": { /* checkpoint data */ }
}
```

## Export Formats

### OTLP HTTP Export

Spans are batched and exported via OTLP HTTP protocol:

```
POST /v1/traces
Content-Type: application/json

{
  "resourceSpans": [{
    "resource": {
      "attributes": [
        {"key": "service.name", "value": {"stringValue": "agentlint"}},
        {"key": "service.version", "value": {"stringValue": "0.1.0"}}
      ]
    },
    "scopeSpans": [{
      "scope": {"name": "agentlint.observability"},
      "spans": [/* span objects */]
    }]
  }]
}
```

### Vercel Proxy Endpoint

Default export path (no API keys in CLI):

```
POST https://agentlint.vercel.app/api/traces
Authorization: Bearer {session-token}
Content-Type: application/json

{
  "spans": [/* simplified span format */],
  "metadata": {
    "cli_version": "0.1.0",
    "session_id": "...",
    "consent_timestamp": "..."
  }
}
```

## Data Retention

| Data Type | Location | Retention |
|-----------|----------|-----------|
| Local logs | `~/.agentlint/logs/` | 30 days (configurable) |
| Checkpoints | `~/.agentlint/checkpoints/` | 7 days |
| HoneyHive spans | Cloud | Per HoneyHive plan |

## Privacy Considerations

### Data Sanitization

Before export, sensitive data is redacted:

| Field | Sanitization |
|-------|--------------|
| File paths | Relative to project root |
| File contents | Never exported |
| Prompts | Truncated to 500 chars |
| Tool inputs | Truncated to 1000 chars |
| API keys | Redacted |
| Environment variables | Redacted |

### Opt-In Requirements

Per Constitution Principle I (Local-First):

1. Local logging is always enabled
2. Remote export requires explicit opt-in (`AGENTLINT_TELEMETRY=alpha`)
3. First-time opt-in shows consent message
4. User can opt-out at any time
