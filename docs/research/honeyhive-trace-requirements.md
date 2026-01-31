# HoneyHive Rich Trace Requirements

**Research Date**: 2026-01-31
**Purpose**: Define complete data requirements for HoneyHive observability integration to enable full trace waterfall visualization, prompt/completion replay, token cost analysis, tool call debugging, and parent-child span hierarchy.

---

## Query: What data does HoneyHive need for rich, debuggable traces?

---

## Executive Summary

HoneyHive requires a **hierarchical trace model** with **sessions as root events** containing nested **model, tool, and chain events**. Rich traces must include:

1. **Hierarchical relationships** via `session_id`, `event_id`, `parent_id`
2. **Complete LLM context** (inputs, outputs, config with hyperparameters)
3. **Execution metrics** (duration, latency, token counts, costs)
4. **Tool instrumentation** with inputs/outputs for each call
5. **OpenTelemetry compatibility** (HoneyHive fully embraces OTel standard)

**Sparse vs Rich**: "Sparse" traces lack complete inputs/outputs or tool call details. "Rich" traces capture **multi-megabyte spans** with full context for replay and debugging.

---

## Findings

### 1. HoneyHive Data Model Structure

**Source**: [Data Model Overview](https://docs.honeyhive.ai/datamodel) | [Schema Overview](https://docs.honeyhive.ai/schema-overview)

#### Core Hierarchy

```
Session (root event, equivalent to "trace")
├── Model Events (LLM requests)
├── Tool Events (external function calls, DB queries, API requests)
└── Chain Events (multi-step sequences, logical groupings)
```

**Session**: The root event grouping all subsequent events via a common `session_id`. Represents a complete interaction or process.

**Model Events**: Track execution of LLM requests (e.g., GPT-4o completions, DALL-E image generation).

**Tool Events**: Track external service requests (API calls, database queries, custom function executions like vector DB searches).

**Chain Events**: Container-type events that "contain nested events" representing multi-step reasoning or complex query pipelines.

#### Event Schema Fields

Every event contains:

| Field | Type | Purpose |
|-------|------|---------|
| `eventId` | UUID | Unique identifier for this event (e.g., `"7f22137a-6911-4ed3-bc36-110f1dde6b66"`) |
| `sessionId` | UUID | Identifies the session this event belongs to |
| `parentId` | UUID | References the parent event (enables hierarchy) |
| `event_type` | string | One of: `"session"`, `"model"`, `"tool"`, `"chain"` |
| `inputs` | object | Inputs to the event (prompt, vector query, function args) |
| `outputs` | object | Outputs of the event (completion, API response, function result) |
| `config` | object | Event configuration (model settings, tool config, etc.) |
| `metrics` | object | Performance metrics (duration, tokens, cost) |
| `metadata` | object | Additional context (product metadata, error metadata) |
| `user_properties` | object | User context (user_id, country, tier) |
| `feedback` | object | User feedback or model feedback |
| `error` | string | Error message (rate limit error, failed retrieval, etc.) |

**Source**: [Manual Instrumentation](https://docs.honeyhive.ai/sdk-reference/manual-instrumentation)

---

### 2. Model Event Schema (LLM Calls)

**Source**: [honeyhive npm package](https://www.npmjs.com/package/honeyhive) | [Schema Overview](https://docs.honeyhive.ai/schema-overview)

#### Required Fields for Model Events

```json
{
  "event_type": "model",
  "event_id": "uuid",
  "session_id": "uuid",
  "parent_id": "uuid",
  "config": {
    "provider": "openai",
    "model": "gpt-3.5-turbo",
    "hyperparameters": {
      "temperature": 0,
      "max_tokens": 1000,
      "top_p": 1,
      "presence_penalty": 0,
      "frequency_penalty": 0
    }
  },
  "inputs": {
    "messages": [
      {"role": "system", "content": "You are a helpful assistant"},
      {"role": "user", "content": "What is the capital of France?"}
    ]
  },
  "outputs": {
    "role": "assistant",
    "content": "The capital of France is Paris."
  },
  "metrics": {
    "duration": 1234,
    "prompt_tokens": 15,
    "completion_tokens": 8,
    "total_tokens": 23,
    "cost": 0.00023
  }
}
```

#### Key Config Fields

- `provider`: String - Provider name (e.g., "openai", "anthropic", "openrouter")
- `model`: String - Specific model (e.g., "gpt-4o", "claude-sonnet-4")
- `hyperparameters`: Object containing:
  - `temperature`: Number
  - `max_tokens`: Number
  - `top_p`: Number
  - `presence_penalty`: Number
  - `frequency_penalty`: Number

**Critical for Playground Replay**: The `inputs.messages` array must contain the **complete conversation history** with roles and content. The `config.hyperparameters` enable exact reproduction of the LLM call.

---

### 3. Tool Event Schema (Function Calls)

**Source**: [Manual Instrumentation](https://docs.honeyhive.ai/sdk-reference/manual-instrumentation) | [Tracing Introduction](https://docs.honeyhive.ai/tracing/introduction)

#### Tool Call Instrumentation

HoneyHive allows tracking external tool calls (vector DBs, function calls, API requests) alongside LLM invocations. Tool events support:

- **Automatic instrumentation** for supported libraries (OpenAI function calling)
- **Manual tracing** via `@trace` decorator or SDK methods

Example manual trace:

```python
@trace(name="get_weather_function", tags={"type": "external_function"})
def get_weather(location, unit="celsius"):
    # Function implementation
    return {"location": location, "temp": 72, "unit": unit}
```

#### Required Tool Event Fields

```json
{
  "event_type": "tool",
  "event_id": "uuid",
  "session_id": "uuid",
  "parent_id": "uuid",
  "config": {
    "tool_name": "get_weather_function",
    "tags": {"type": "external_function"}
  },
  "inputs": {
    "location": "San Francisco",
    "unit": "celsius"
  },
  "outputs": {
    "location": "San Francisco",
    "temp": 72,
    "unit": "celsius"
  },
  "metrics": {
    "duration": 456
  }
}
```

**Critical for Debugging**: Complete `inputs` and `outputs` for every tool call enable "replay complete chat and agent sessions to inspect every tool invocation" and "visualize execution timelines and dependency graphs."

**Source**: [Tool Call Debugging](https://docs.honeyhive.ai/sdk-reference/manual-instrumentation)

---

### 4. Trace Waterfall Visualization Requirements

**Source**: [Tracing Introduction](https://docs.honeyhive.ai/tracing/introduction) | [OpenTelemetry Update](https://www.honeyhive.ai/post/product-update-opentelemetry-native-sdks)

#### Parent-Child Hierarchy

HoneyHive represents execution flow as a **hierarchical tree** using:

- `session_id`: Common ID across all events in a trace
- `event_id`: Unique ID for each event
- `parent_id`: References parent event (enables DAG structure)

Sessions have `childrenIds` arrays containing references to child events.

#### OpenTelemetry Standard

HoneyHive "fully embraces the OpenTelemetry standard for collecting traces and feedback." Their OTel tracer automatically logs calls and generates trace spans received by their OTEL-compatible collector.

**OTel Span Relationships**:
- Parent of a server span is often a remote client span
- Child of a client span is usually a server span
- Traces form a **directed acyclic graph (DAG)** where edges are parent/child relationships

**Source**: [OpenTelemetry Traces](https://opentelemetry.io/docs/concepts/signals/traces/)

#### Waterfall Display Requirements

To render the waterfall:

1. **Timing data**: `start_time` and `duration` for each event
2. **Hierarchy**: Correct `parent_id` references to build tree
3. **Event types**: Distinct rendering for model/tool/chain events
4. **Metrics**: Duration, latency overlay on bars

**Source**: [Monitoring Overview](https://docs.honeyhive.ai/monitoring/overview)

---

### 5. Playground Prompt/Completion Replay Requirements

**Source**: [Managing Prompts](https://docs.honeyhive.ai/prompts/overview) | [Studio Playground](https://www.honeyhive.ai/playground)

#### What Enables Replay?

The Playground allows users to "go back to a prompt you had already run, or open one from a trace that was logged externally" via "Open In Playground" button.

**Required Data for Replay**:

1. **Complete inputs** (full message array with system/user/assistant roles)
2. **Complete config** (provider, model, all hyperparameters)
3. **Original outputs** (for comparison with re-runs)

**Playground Features**:

- Experiment with new prompts, models, OpenAI functions
- Fork and save variants
- Use private or public data sources
- Built-in integrations with vector databases, SerpAPI

**Critical**: Without complete `inputs.messages` and `config.hyperparameters`, the Playground cannot accurately reproduce the original LLM call.

---

### 6. Token Cost Analysis Requirements

**Source**: [Monitoring Charts](https://docs.honeyhive.ai/monitoring/charts) | [Monitoring Overview](https://docs.honeyhive.ai/monitoring/overview)

#### Metrics Tracked

HoneyHive tracks **key metrics for individual LLM calls**:

- **Cost** (in USD or credits)
- **Duration** (latency in ms)
- **Tokens** (prompt_tokens, completion_tokens, total_tokens)
- **Errors** (error messages, rate limits)
- **Custom KPIs** (via evaluators)

#### Automatic Capture

When instrumenting supported libraries like OpenAI, HoneyHive **automatically captures** inputs, outputs, latency, token usage, and any errors.

#### Monitoring Dashboard

Once SDK is integrated and logging traces, users can:

- Analyze cost, latency, and performance metrics in Monitoring dashboard
- View charts segmented by event type (model, tool, chain)
- Track real-time token usage and costs

**Required Fields**:

```json
"metrics": {
  "duration": 1234,              // milliseconds
  "prompt_tokens": 15,
  "completion_tokens": 8,
  "total_tokens": 23,
  "cost": 0.00023               // USD
}
```

**Source**: [Introduction](https://docs.honeyhive.ai/tracing/introduction)

---

### 7. Tool Call Debugging Requirements

**Source**: [Manual Instrumentation](https://docs.honeyhive.ai/sdk-reference/manual-instrumentation) | [ZenML Blog](https://www.zenml.io/blog/langsmith-alternatives)

#### Debugging Capabilities

HoneyHive is "invaluable for debugging, especially for complex, multi-step agents" because it allows users to:

1. **Visualize the entire flow** (waterfall of all events)
2. **See inputs and outputs of each step** (tool calls, LLM calls)
3. **Identify where things went wrong or took too long** (error messages, duration)
4. **Replay complete chat and agent sessions** to inspect every tool invocation, LLM exchange, and state transition
5. **Visualize execution timelines and dependency graphs** to understand how each step interacts

#### Segmentation by Event Type

"Segmenting execution by different event types enables quicker debugging, dataset curation, and granular evaluations."

**Required for Rich Tool Debugging**:

- Complete `inputs` and `outputs` for every tool call
- `error` field populated when tool calls fail
- `metrics.duration` to identify slow operations
- Correct `parent_id` to show which LLM call triggered which tool
- Tags/metadata for filtering (e.g., `{"type": "vector_db"}`)

---

### 8. OpenTelemetry GenAI Semantic Conventions

**Source**: [OpenTelemetry GenAI Spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/) | [GenAI Metrics](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-metrics/) | [AI Agent Observability](https://opentelemetry.io/blog/2025/ai-agent-observability/)

#### Key Semantic Conventions

HoneyHive follows OpenTelemetry GenAI semantic conventions (experimental):

**Attributes**:

- `gen_ai.provider.name`: Discriminator for provider-specific format (e.g., "openai", "anthropic")
- `gen_ai.request.model`: Model identifier (e.g., "gpt-4o")
- `gen_ai.operation.name`: Operation type (e.g., "chat", "embeddings")
- `gen_ai.response.model`: Actual model used (may differ from request)

**Span Naming**: `{gen_ai.operation.name} {gen_ai.request.model}` (e.g., "chat gpt-4o")

**Span Kind**: `CLIENT` (or `INTERNAL` if model runs in-process)

**Token Metrics**:

- `gen_ai.usage.input_tokens`: Prompt tokens
- `gen_ai.usage.output_tokens`: Completion tokens
- Use billable tokens if both used and billable reported

**Input/Output Recording**:

GenAI instrumentations may capture user inputs and responses as **events** (opt-in). Events are independent from traces and store input/output details separately.

**Stability**:

- Use `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental` environment variable
- Conventions are experimental; instrumentations should not change versions by default

**Source**: [GenAI Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)

---

## Summary: What Makes Traces "Rich" vs "Sparse" in HoneyHive

### Sparse Traces (Minimal Observability)

❌ Missing `inputs` or `outputs` fields
❌ Incomplete `config` (no hyperparameters)
❌ Missing tool call instrumentation
❌ No `parent_id` relationships (flat structure)
❌ No timing data (`duration`, `start_time`)
❌ Generic error messages without context

**Result**: Cannot replay in Playground, cannot debug tool chains, waterfall is flat or broken.

---

### Rich Traces (Full Observability)

✅ **Complete inputs**: Full message arrays for LLM calls, all function arguments for tools
✅ **Complete outputs**: Full completions, function returns, API responses
✅ **Complete config**: Provider, model, all hyperparameters
✅ **Hierarchical structure**: Correct `session_id`, `event_id`, `parent_id` for DAG
✅ **Detailed metrics**: Duration, tokens (prompt/completion/total), cost
✅ **Tool instrumentation**: Every function call tracked with inputs/outputs
✅ **Error context**: Stack traces, error types, failed inputs
✅ **Metadata**: User properties, tags, product context
✅ **Multi-megabyte spans**: Handle large context windows with full prompt/completion text

**Result**: Full waterfall visualization, Playground replay, cost analysis, tool debugging, execution timeline analysis.

---

## Best Practices for Sending LLM Traces to HoneyHive

**Source**: [Manual Instrumentation](https://docs.honeyhive.ai/sdk-reference/manual-instrumentation) | [Troubleshooting](https://docs.honeyhive.ai/introduction/troubleshooting)

### 1. Use OpenTelemetry Standard

HoneyHive "fully embraces the OpenTelemetry standard." Use OTel SDK for automatic trace propagation and span management.

### 2. Instrument Both Automatic and Manual

- **Automatic**: Initialize HoneyHive SDK for supported libraries (OpenAI, etc.)
- **Manual**: Use `@trace` decorator or SDK methods for custom functions

### 3. Always Provide Complete Config

Include all hyperparameters in `config.hyperparameters`:

```json
{
  "temperature": 0.7,
  "max_tokens": 1000,
  "top_p": 1,
  "presence_penalty": 0,
  "frequency_penalty": 0
}
```

### 4. Capture Full Inputs/Outputs

Don't truncate prompts or completions. HoneyHive handles **multi-megabyte spans** for large context windows.

### 5. Set Correct Parent-Child Relationships

Ensure every event has correct `parent_id`. Sessions have no parent; model/tool/chain events reference parent IDs.

### 6. Include Timing Data

Provide `start_time` (timestamp) and `duration` (ms) for waterfall visualization.

### 7. Add Metadata and Tags

Use `metadata` and `tags` for filtering and analysis:

```json
{
  "metadata": {
    "environment": "production",
    "user_tier": "premium"
  },
  "tags": {
    "type": "vector_db_query"
  }
}
```

### 8. Batch Events When Possible

Use `/events/batch` endpoint with `is_single_session: true` to group events into a single session efficiently.

### 9. Handle Errors Gracefully

Populate `error` field with clear messages. Include failed inputs for debugging.

### 10. Use Session Context for Resumption

Provide `session_id` to resume existing sessions (e.g., for multi-turn conversations or parent traces).

---

## HoneyHive API Endpoints

**Source**: [Manual Instrumentation](https://docs.honeyhive.ai/sdk-reference/manual-instrumentation)

### POST /events

Logs a single event after each LLM or tool invocation.

**Request**:
```json
{
  "event_type": "model",
  "session_id": "uuid",
  "event_id": "uuid",
  "parent_id": "uuid",
  "inputs": {},
  "outputs": {},
  "config": {},
  "metrics": {},
  "metadata": {}
}
```

### POST /events/batch

Accepts an array of events and logs them in a single API call.

**Request**:
```json
{
  "is_single_session": true,
  "events": [
    { /* event 1 */ },
    { /* event 2 */ },
    { /* event 3 */ }
  ]
}
```

**Parameter**:
- `is_single_session`: Boolean - If true, all events grouped into single session

---

## References

### Core Documentation

- [HoneyHive Data Model Overview](https://docs.honeyhive.ai/datamodel) - Unified event-based structure
- [Schema Overview](https://docs.honeyhive.ai/schema-overview) - Event schema fields (inputs, outputs, config, metrics)
- [Manual Instrumentation](https://docs.honeyhive.ai/sdk-reference/manual-instrumentation) - API endpoints and SDK usage
- [Tracing Introduction](https://docs.honeyhive.ai/tracing/introduction) - Session/event hierarchy
- [Managing Prompts](https://docs.honeyhive.ai/prompts/overview) - Prompt versioning and management
- [Studio Playground](https://www.honeyhive.ai/playground) - Collaborative LLM playground
- [Monitoring Charts](https://docs.honeyhive.ai/monitoring/charts) - Cost, latency, token tracking
- [Monitoring Overview](https://docs.honeyhive.ai/monitoring/overview) - Real-time metrics dashboard

### Technical Specifications

- [honeyhive npm package](https://www.npmjs.com/package/honeyhive) - TypeScript SDK with examples
- [HoneyHive Python SDK](https://github.com/honeyhiveai/python-sdk) - Python instrumentation
- [OpenTelemetry Update](https://www.honeyhive.ai/post/product-update-opentelemetry-native-sdks) - OTel integration announcement

### OpenTelemetry Standards

- [OpenTelemetry GenAI Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) - Standard for LLM observability
- [GenAI Spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/) - Span naming and attributes
- [GenAI Metrics](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-metrics/) - Token usage metrics
- [GenAI Events](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-events/) - Input/output recording
- [GenAI Agent Spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/) - Agent/framework spans
- [AI Agent Observability](https://opentelemetry.io/blog/2025/ai-agent-observability/) - Evolving standards
- [OpenTelemetry Traces Overview](https://opentelemetry.io/docs/concepts/signals/traces/) - DAG structure

### Comparisons and Guides

- [Helicone vs HoneyHive](https://www.helicone.ai/blog/helicone-vs-honeyhive) - Observability platform comparison
- [LangSmith Alternatives](https://www.zenml.io/blog/langsmith-alternatives) - LLM observability tools
- [LanceDB + HoneyHive](https://www.honeyhive.ai/post/moving-ai-applications-to-prod-with-lancedb-and-honeyhive) - Production RAG tracing
- [AI Observability Platforms Compared](https://softcery.com/lab/top-8-observability-platforms-for-ai-agents-in-2025) - 2025 landscape
