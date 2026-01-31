# Data Model: Rich Telemetry Unification

> **Epic**: EP23
> **Created**: 2026-01-31

---

## Overview

This epic modifies existing telemetry entities to include content capture. No new database tables or persistent storage is added - telemetry is fire-and-forget to HoneyHive.

---

## Modified Entities

### TrackLLMOptions

Extended options for tracking LLM calls with content.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| model | string | Yes | Model name (e.g., "claude-sonnet-4") |
| inputTokens | number | Yes | Prompt token count |
| outputTokens | number | Yes | Completion token count |
| provider | string | No | Provider name (default: "anthropic") |
| latencyMs | number | No | Call duration in milliseconds |
| cost | number | No | Estimated cost in USD |
| temperature | number | No | Sampling temperature |
| maxTokens | number | No | Max output tokens |
| topP | number | No | Top-p sampling parameter |
| stopReason | string | No | Why model stopped generating |
| cacheReadTokens | number | No | Tokens served from cache |
| cacheCreationTokens | number | No | Tokens written to cache |
| reasoningTokens | number | No | Extended thinking tokens |
| **promptContent** | string | No | **NEW**: Prompt messages (JSON, opt-in) |
| **completionContent** | string | No | **NEW**: Completion text (opt-in) |
| **systemInstructions** | string | No | **NEW**: System prompt (opt-in) |

### TrackToolOptions

Extended options for tracking tool calls with content.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| toolName | string | Yes | Tool name |
| durationMs | number | Yes | Execution duration |
| success | boolean | Yes | Whether tool succeeded |
| toolInput | object | No | Tool arguments (existing, sanitized) |
| toolOutput | unknown | No | Tool result (existing, truncated) |
| errorMessage | string | No | Error message if failed |
| callId | string | No | Tool call ID for linking |
| **toolInputJson** | string | No | **NEW**: Full arguments (JSON, opt-in) |
| **toolOutputJson** | string | No | **NEW**: Full result (JSON, opt-in) |
| **errorCategory** | string | No | **NEW**: Error category (auth, rate_limit, etc.) |
| **errorStack** | string | No | **NEW**: Sanitized stack trace |
| **errorIsRetryable** | boolean | No | **NEW**: Whether error is retryable |

### TelemetryEvent

Extended event with content fields.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| type | string | Yes | Event type |
| timestamp | string | Yes | ISO-8601 timestamp |
| sessionId | string | Yes | Session UUID |
| eventId | string | Yes | Event UUID |
| sequence | number | Yes | Event sequence number |
| data | object | Yes | Event-specific data |
| meta | object | Yes | Version, platform metadata |
| traceId | string | No | Trace ID for correlation |
| spanId | string | No | Span ID |
| parentSpanId | string | No | Parent span ID |
| parentEventId | string | No | Parent event ID (for hierarchy) |

**New fields in `data` for llm.usage:**
- `promptContent`: Full prompt messages (JSON string)
- `completionContent`: Full completion text
- `systemInstructions`: System prompt
- `reasoningTokens`: Extended thinking tokens

**New fields in `data` for tool.call:**
- `toolInputJson`: Full tool arguments (JSON string)
- `toolOutputJson`: Full tool result (JSON string)
- `errorCategory`: Error classification
- `errorStack`: Sanitized stack trace
- `errorIsRetryable`: Retry hint

---

## HoneyHive Schema Mapping

### LLM Event → HoneyHive Model Event

| agentlint Field | HoneyHive Field | Notes |
|-----------------|-----------------|-------|
| model | config.model | Direct |
| provider | config.provider | Direct |
| temperature | config.temperature | Direct |
| maxTokens | config.max_tokens | Direct |
| topP | config.top_p | Direct |
| inputTokens | metrics.prompt_tokens | Direct |
| outputTokens | metrics.completion_tokens | Direct |
| cacheReadTokens | metrics.cache_read_tokens | **NEW** |
| cacheCreationTokens | metrics.cache_creation_tokens | **NEW** |
| reasoningTokens | metrics.reasoning_tokens | **NEW** |
| cost | metrics.cost | Direct |
| latencyMs | metrics.latency_ms | Direct |
| promptContent | inputs.messages | **NEW** (opt-in) |
| completionContent | outputs.content | **NEW** (opt-in) |
| systemInstructions | inputs.system_instructions | **NEW** (opt-in) |
| stopReason | outputs.stop_reason | Direct |

### Tool Event → HoneyHive Tool Event

| agentlint Field | HoneyHive Field | Notes |
|-----------------|-----------------|-------|
| toolName | config.tool_name | Direct |
| callId | config.tool_call_id | **NEW** |
| toolInputJson | inputs.arguments | **NEW** (opt-in) |
| toolOutputJson | outputs.result | **NEW** (opt-in) |
| success | outputs.success | Direct |
| errorMessage | error | Direct |
| errorCategory | metadata.error_category | **NEW** |
| errorStack | metadata.error_stack | **NEW** (sanitized) |
| errorIsRetryable | metadata.error_is_retryable | **NEW** |
| durationMs | metrics.duration_ms | Direct |

### Session Event → HoneyHive Session

| agentlint Field | HoneyHive Field | Notes |
|-----------------|-----------------|-------|
| sessionId | session_id | Direct |
| command | inputs.command | Direct |
| directory | inputs.directory | Direct |
| **agent.id** | config.agent_id | **NEW** ("agentlint-cli") |
| **agent.name** | config.agent_name | **NEW** ("agentlint") |
| traceId | metadata.trace_id | **NEW** (for correlation) |

---

## Content Capture Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Content Capture Decision                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │ isContentCaptureEnabled()?    │
              │                               │
              │ Checks:                       │
              │ 1. AGENTLINT_CAPTURE_CONTENT  │
              │ 2. config.telemetry.capture   │
              └───────────────┬───────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
         [false]                          [true]
              │                               │
              ▼                               ▼
    ┌─────────────────┐         ┌─────────────────────────┐
    │ No content      │         │ Capture content:        │
    │ Only metrics    │         │                         │
    └─────────────────┘         │ 1. sanitizeContent()    │
                                │    - redact secrets     │
                                │                         │
                                │ 2. truncateContent()    │
                                │    - max 5000 chars     │
                                │                         │
                                │ 3. Include in event     │
                                └─────────────────────────┘
```

---

## Parent Hierarchy Model

```
Session Start (root)
    │
    ├── LLM Turn 1 (parent_id = session)
    │       │
    │       ├── Tool Call A (parent_id = LLM Turn 1)
    │       └── Tool Call B (parent_id = LLM Turn 1)
    │
    ├── LLM Turn 2 (parent_id = session)
    │       │
    │       └── Tool Call C (parent_id = LLM Turn 2)
    │
    └── Session End (parent_id = session)
```

**Current (flat)**: All events have `parent_id = session start`

**Target (hierarchical)**: Tool events have `parent_id = containing LLM turn`

---

## Validation Rules

### Content Capture

- **Max length**: 5000 characters per field (configurable via `AGENTLINT_CAPTURE_MAX_LENGTH`)
- **Truncation marker**: `[truncated at 5000 chars]`
- **Secret redaction**: All content passes through `redact()` before capture

### Secrets to Redact

From `src/debug/redaction.ts`:
- API keys (patterns: `sk-`, `Bearer`, `api_key=`, etc.)
- HoneyHive keys (`hh_*`)
- Linear keys (`lin_api_*`)
- Generic tokens and passwords

### Event Ordering

- `session.start` always first (sequence 0)
- Events ordered by sequence number
- `session.end` always last

---

## State Transitions

### Content Capture States

```
DISABLED (default)
    │
    │ Set AGENTLINT_CAPTURE_CONTENT=true
    │ OR config.telemetry.captureContent=true
    │
    ▼
ENABLED
    │
    │ Unset env var AND remove config
    │
    ▼
DISABLED
```

No persistent state - evaluated fresh each session.
