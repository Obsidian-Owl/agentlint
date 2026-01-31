# Analysis: HoneyHive Schema & OTel GenAI Convention Gaps

> **Generated**: 2026-01-30
> **Scope**: Validate EP22 data model against HoneyHive and OTel GenAI best practices
> **Status**: CRITICAL GAPS FOUND

## Summary

| Category | Our Design | HoneyHive Expects | OTel GenAI Has | Gap Status |
|----------|-----------|-------------------|----------------|------------|
| Core trace context | ✅ Complete | ✅ | ✅ | OK |
| Session/Agent attributes | ⚠️ Partial | ✅ | ✅ | **GAPS** |
| LLM request attributes | ⚠️ Partial | ✅ | ✅ | **GAPS** |
| LLM response attributes | ⚠️ Partial | ✅ | ✅ | **GAPS** |
| Tool call attributes | ⚠️ Partial | ✅ | ✅ | **GAPS** |
| Anthropic-specific (caching) | ❌ Missing | ✅ | ✅ | **CRITICAL** |
| User properties/metadata | ❌ Missing | ✅ | ✅ | **CRITICAL** |
| Evaluation/feedback | ❌ Missing | ✅ | ✅ | **CRITICAL** |
| Error tracking | ⚠️ Partial | ✅ | ✅ | **GAPS** |
| Input/Output content (opt-in) | ❌ Missing | ✅ | ✅ | **CRITICAL** |

**Overall Status**: FAIL - Missing 15+ attributes that HoneyHive can use for observability

---

## Critical Gaps (Must Fix)

### GAP-001: Missing Anthropic Cache Token Tracking

**HoneyHive expects** (and OTel v1.38+ defines):
```typescript
'gen_ai.usage.cache_creation.input_tokens': number  // Tokens written to cache
'gen_ai.usage.cache_read.input_tokens': number      // Tokens served from cache
```

**Our current design**: Only has `gen_ai.usage.input_tokens` and `gen_ai.usage.output_tokens`

**Why critical**:
- Anthropic prompt caching can save 90% of costs
- Without tracking, users can't optimize for cache hits
- HoneyHive displays cache metrics in their dashboard

**Fix**: Add to `LLMSpanAttributes`:
```typescript
'gen_ai.usage.cache_creation.input_tokens'?: number;
'gen_ai.usage.cache_read.input_tokens'?: number;
```

---

### GAP-002: Missing User Properties / Metadata

**HoneyHive expects**:
```typescript
user_properties: {
  user_id?: string;        // For user-level analysis
  user_tier?: string;      // "free", "pro", "enterprise"
  environment?: string;    // "dev", "staging", "prod"
  // Any custom dimensions
}
metadata: {
  // Any additional context for debugging
}
```

**Our current design**: No user property tracking

**Why critical**:
- Can't segment traces by user/environment in HoneyHive
- Can't filter by user tier or project
- Loses valuable debugging context

**Fix**: Add to session span attributes:
```typescript
'agentlint.user.id'?: string;           // Anonymous user ID (hash)
'agentlint.deployment.environment'?: string;  // Already in service resource
'agentlint.project.type'?: string;      // From config detection
'agentlint.project.name'?: string;      // Directory name
```

---

### GAP-003: Missing LLM Request Hyperparameters

**OTel GenAI defines (and HoneyHive uses)**:
```typescript
'gen_ai.request.temperature'?: number;
'gen_ai.request.top_k'?: number;
'gen_ai.request.top_p'?: number;
'gen_ai.request.max_tokens'?: number;
'gen_ai.request.frequency_penalty'?: number;
'gen_ai.request.presence_penalty'?: number;
'gen_ai.request.stop_sequences'?: string[];
'gen_ai.request.seed'?: number;
```

**Our current design**: None of these

**Why critical**:
- Can't analyze if temperature affects quality
- Can't debug "why did the model stop generating?"
- HoneyHive dashboards show these in model config panel

**Fix**: Add to `LLMSpanAttributes`

---

### GAP-004: Missing Tool Call Arguments & Results (Opt-In)

**OTel GenAI defines**:
```typescript
'gen_ai.tool.call.id'?: string;
'gen_ai.tool.call.arguments'?: object;  // JSON (opt-in)
'gen_ai.tool.call.result'?: object;     // JSON (opt-in)
'gen_ai.tool.type'?: string;            // "function", "extension", "datastore"
'gen_ai.tool.description'?: string;
```

**Our current design**: Only `gen_ai.tool.name` and `gen_ai.tool.success`

**Why critical**:
- Can't replay tool calls in HoneyHive
- Can't debug "what did the tool actually receive?"
- Loses 90% of debugging value

**Fix**: Add opt-in content capture:
```typescript
'gen_ai.tool.call.id'?: string;
'gen_ai.tool.call.arguments'?: string;  // JSON stringified, opt-in
'gen_ai.tool.call.result'?: string;     // JSON stringified, opt-in, truncated
'gen_ai.tool.type'?: 'function';
```

---

### GAP-005: Missing Evaluation Event

**OTel GenAI defines** `gen_ai.evaluation.result` event:
```typescript
{
  name: 'gen_ai.evaluation.result',
  attributes: {
    'gen_ai.evaluation.name': string;     // "relevance", "accuracy", etc.
    'gen_ai.evaluation.score.value'?: number;
    'gen_ai.evaluation.score.label'?: string;  // "pass", "fail", "relevant"
    'gen_ai.evaluation.explanation'?: string;
    'gen_ai.response.id'?: string;        // Links to which completion
  }
}
```

**Our current design**: No evaluation events

**Why critical**:
- agentlint HAS an evaluation framework (EP11)
- We should emit evaluation events for LLM-as-judge results
- HoneyHive can aggregate quality scores

**Fix**: Add task to emit `gen_ai.evaluation.result` events from evaluation framework

---

### GAP-006: Missing Input/Output Messages (Opt-In)

**OTel GenAI defines** `gen_ai.client.inference.operation.details` event:
```typescript
{
  name: 'gen_ai.client.inference.operation.details',
  attributes: {
    'gen_ai.input.messages': object;      // Chat history (opt-in)
    'gen_ai.output.messages': object;     // Model response (opt-in)
    'gen_ai.system_instructions': object; // System prompt (opt-in)
    'gen_ai.tool.definitions': object;    // Available tools (opt-in)
  }
}
```

**Our current design**: No message content capture

**Why critical**:
- HoneyHive's killer feature is prompt debugging
- Without prompts, traces are "black boxes"
- Can't use HoneyHive's prompt management features

**Fix**: Add opt-in content capture with AGENTLINT_CAPTURE_CONTENT=1

---

### GAP-007: Missing Agent-Specific Attributes

**OTel GenAI defines** (v1.39+):
```typescript
'gen_ai.agent.id'?: string;         // Unique agent identifier
'gen_ai.agent.name'?: string;       // Human-readable name
'gen_ai.agent.description'?: string; // Agent description
```

**Our current design**: None

**Why critical**:
- agentlint IS an agent
- Should identify ourselves in traces
- Helps HoneyHive categorize traces

**Fix**: Add to session span:
```typescript
'gen_ai.agent.id': 'agentlint-cli',
'gen_ai.agent.name': 'agentlint',
'gen_ai.agent.description': 'AI-assisted development workflow analyzer',
```

---

### GAP-008: Missing Error Event Details

**HoneyHive expects**:
```typescript
error: string;  // Full error message with context
// Plus standard OTel error attributes:
'error.type': string;
'error.message': string;
'error.stack': string;  // (sanitized)
```

**Our current design**: Only `SpanStatus.message`

**Why critical**:
- Error debugging is #1 use case for observability
- Need full stack traces (sanitized)
- Need error categorization

**Fix**: Add error event with full details on span error

---

## Moderate Gaps (Should Fix)

### GAP-009: Missing Response ID

**OTel GenAI defines**:
```typescript
'gen_ai.response.id'?: string;  // Unique completion identifier
'gen_ai.response.model'?: string;  // Actual model that responded
```

**Our design**: Only `gen_ai.request.model`, no response ID

**Why useful**: Links evaluations to specific completions

---

### GAP-010: Missing Tokens Per Second Metric

**HoneyHive tracks**:
```typescript
'tokens_per_second': number;  // Output tokens / latency
```

**Our design**: Has latency and tokens separately

**Why useful**: Quick performance indicator

---

### GAP-011: Missing Choice Count

**OTel GenAI defines**:
```typescript
'gen_ai.request.choice.count'?: number;  // n parameter
```

**Our design**: Missing

**Why useful**: For debugging multi-choice completions

---

## What We're Missing from Existing Telemetry

Our existing `TelemetryEvent` already captures some things we're NOT carrying forward:

| Existing Event | Data | EP22 Status |
|---------------|------|-------------|
| `session.start` | `command`, `hasConfig`, `projectType`, `directory` | ❌ Not in session span |
| `session.end` | `toolCallCount`, `findingCount`, `recommendationCount` | ❌ Not in session span |
| `finding.detected` | `findingType`, `severity` | ❌ No span/event |
| `recommendation.generated` | `recommendationType`, `findingId` | ❌ No span/event |
| `checkpoint.saved` | `checkpointType`, `sequence` | ✅ In checkpoint span |
| `config.loaded` | `configType`, `hasCustomSettings` | ❌ No span/event |
| `prompt.used` | `promptId`, `promptVersion`, `promptKey` | ❌ No span/event |

**Critical**: We're LOSING telemetry value by not including agentlint-specific events!

---

## Recommended Schema Updates

### Updated LLMSpanAttributes

```typescript
interface LLMSpanAttributes {
  // EXISTING (keep)
  'gen_ai.operation.name': 'chat';
  'gen_ai.request.model': string;
  'gen_ai.usage.input_tokens'?: number;
  'gen_ai.usage.output_tokens'?: number;
  'gen_ai.response.finish_reasons'?: FinishReason[];

  // ADD: Anthropic cache tokens
  'gen_ai.usage.cache_creation.input_tokens'?: number;
  'gen_ai.usage.cache_read.input_tokens'?: number;

  // ADD: Request hyperparameters
  'gen_ai.request.temperature'?: number;
  'gen_ai.request.max_tokens'?: number;
  'gen_ai.request.top_p'?: number;
  'gen_ai.request.stop_sequences'?: string[];

  // ADD: Response details
  'gen_ai.response.id'?: string;
  'gen_ai.response.model'?: string;

  // KEEP: agentlint-specific
  'agentlint.llm.latency_ms'?: number;
  'agentlint.llm.cost_usd'?: number;
}
```

### Updated ToolSpanAttributes

```typescript
interface ToolSpanAttributes {
  // EXISTING (keep)
  'gen_ai.operation.name': 'execute_tool';
  'gen_ai.tool.name': string;
  'gen_ai.tool.success': boolean;

  // ADD: Standard OTel
  'gen_ai.tool.call.id'?: string;
  'gen_ai.tool.type'?: 'function';

  // ADD: Opt-in content (truncated)
  'gen_ai.tool.call.arguments'?: string;  // JSON, max 5000 chars
  'gen_ai.tool.call.result'?: string;     // JSON, max 5000 chars

  // KEEP
  'agentlint.tool.duration_ms'?: number;
}
```

### Updated SessionSpanAttributes

```typescript
interface SessionSpanAttributes {
  // EXISTING (keep)
  'gen_ai.operation.name': 'invoke_agent';
  'gen_ai.conversation.id': string;
  'gen_ai.provider.name': GenAIProvider;

  // ADD: Agent identity
  'gen_ai.agent.id': 'agentlint-cli';
  'gen_ai.agent.name': 'agentlint';

  // ADD: User/project context
  'agentlint.project.name'?: string;
  'agentlint.project.type'?: string;

  // ADD: Session metrics (at span end)
  'agentlint.session.tool_call_count'?: number;
  'agentlint.session.finding_count'?: number;
  'agentlint.session.recommendation_count'?: number;

  // KEEP
  'agentlint.session.target'?: string;
  'agentlint.session.command'?: string;
}
```

### New Events to Add

```typescript
// Finding detected event
interface FindingDetectedEvent {
  name: 'agentlint.finding.detected';
  attributes: {
    'agentlint.finding.type': string;
    'agentlint.finding.severity': 'info' | 'warning' | 'error' | 'critical';
    'agentlint.finding.id'?: string;
  }
}

// Recommendation generated event
interface RecommendationGeneratedEvent {
  name: 'agentlint.recommendation.generated';
  attributes: {
    'agentlint.recommendation.type': string;
    'agentlint.recommendation.finding_id'?: string;
  }
}

// Evaluation result event (from EP11)
interface EvaluationResultEvent {
  name: 'gen_ai.evaluation.result';
  attributes: {
    'gen_ai.evaluation.name': string;
    'gen_ai.evaluation.score.value'?: number;
    'gen_ai.evaluation.score.label'?: string;
    'gen_ai.evaluation.explanation'?: string;
    'gen_ai.response.id'?: string;
  }
}
```

---

## Tasks to Add

Based on this analysis, add these tasks to tasks.md:

### Phase 3 (Foundational) Additions

```markdown
- [ ] T0XX Update LLMSpanAttributes with cache tokens, hyperparameters, response details
- [ ] T0XX Update ToolSpanAttributes with call ID, arguments (opt-in), result (opt-in)
- [ ] T0XX Update SessionSpanAttributes with agent identity, session metrics
- [ ] T0XX Add opt-in content capture config (AGENTLINT_CAPTURE_CONTENT)
```

### Phase 4 (US-002) Additions

```markdown
- [ ] T0XX Emit finding.detected span events from orchestrator
- [ ] T0XX Emit recommendation.generated span events from orchestrator
- [ ] T0XX Add session-end attributes (tool_call_count, finding_count)
```

### Phase 8 (US-005) Additions

```markdown
- [ ] T0XX Emit gen_ai.evaluation.result events from eval framework
- [ ] T0XX Add opt-in input/output message capture event
```

---

## Configuration Additions

Add to ObservabilityConfig:

```typescript
interface ObservabilityConfig {
  // ... existing

  /** Content capture settings (opt-in for privacy) */
  contentCapture: {
    /** Capture LLM input/output messages */
    enabled: boolean;  // Default: false

    /** Capture tool arguments/results */
    toolContent: boolean;  // Default: true (truncated)

    /** Max content length before truncation */
    maxContentLength: number;  // Default: 5000
  };
}
```

---

## Summary

| Gap | Severity | Fix Complexity | Value |
|-----|----------|----------------|-------|
| GAP-001: Cache tokens | Critical | Low | High - cost optimization |
| GAP-002: User properties | Critical | Low | High - segmentation |
| GAP-003: LLM hyperparams | Critical | Low | High - debugging |
| GAP-004: Tool content | Critical | Medium | Very High - replay |
| GAP-005: Evaluation events | Critical | Medium | High - quality tracking |
| GAP-006: Message content | Critical | Medium | Very High - prompt debug |
| GAP-007: Agent identity | Critical | Low | Medium - categorization |
| GAP-008: Error details | Critical | Low | High - debugging |
| GAP-009: Response ID | Moderate | Low | Medium - linking |
| GAP-010: Tokens/sec | Moderate | Low | Low - metrics |
| GAP-011: Choice count | Moderate | Low | Low - edge case |

**Recommendation**: Update data-model.md, contracts/interfaces.ts, and tasks.md to address all Critical gaps before implementation.
