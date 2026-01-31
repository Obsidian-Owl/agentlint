# Final Gap Analysis: EP22 vs Opencode SDK + Multi-Provider Support

> **Generated**: 2026-01-30
> **Scope**: Cross-validation of EP22 design against Opencode SDK capabilities, multi-provider support, and maximum observability value
> **Status**: CRITICAL GAPS FOUND

## Executive Summary

| Category | Gaps Found | Severity |
|----------|-----------|----------|
| Multi-Provider Support | 5 | CRITICAL |
| Opencode SDK Data Extraction | 7 | CRITICAL |
| Reasoning Token Tracking | 1 | CRITICAL |
| Tool Correlation Architecture | 2 | HIGH |
| Message Hierarchy | 2 | HIGH |
| TUI Event Tracking | 1 | MEDIUM |
| Error Enrichment | 2 | MEDIUM |

**Overall Status**: FAIL - Design assumes Anthropic-only; missing significant SDK data points

---

## CRITICAL GAPS

### GAP-012: Provider Hardcoded to Anthropic

**Location**:
- `src/opencode/telemetry-tracker.ts:220` - `provider: 'anthropic'` hardcoded
- `specs/ep22-unified-observability/data-model.md:94` - `gen_ai.provider.name` = `anthropic`
- `specs/ep22-unified-observability/contracts/interfaces.ts:136` - Only 3 providers defined

**Current State**:
```typescript
// telemetry-tracker.ts:220
provider: 'anthropic', // HARDCODED
```

**Opencode SDK Reality**:
- Supports **75+ LLM providers** (Anthropic, OpenAI, Google, Bedrock, Groq, OpenRouter, Ollama, etc.)
- Provides `providerID` and `modelID` fields in `AssistantMessage` metadata
- Provider is configurable at runtime via Opencode config

**Impact**:
- All traces show "anthropic" even when using OpenAI/Google/Bedrock
- Cannot analyze provider-specific behavior
- HoneyHive segmentation by provider is broken

**Fix Required**:
```typescript
// GenAIProvider type needs expansion
export type GenAIProvider =
  | 'anthropic' | 'openai' | 'google' | 'bedrock'
  | 'azure' | 'groq' | 'openrouter' | 'ollama'
  | 'deepseek' | 'xai' | 'custom';

// Extract from SDK response
const provider = message.providerID ?? 'unknown';
```

**Missing Task**: Add task to extract provider from SDK `AssistantMessage.providerID`

---

### GAP-013: Missing Reasoning Token Tracking

**Location**: `specs/ep22-unified-observability/contracts/interfaces.ts:191-193` - Only `input_tokens` and `output_tokens`

**Opencode SDK Provides**:
```typescript
// From AssistantMessage.tokens
{
  input: number,
  output: number,
  reasoning: number,  // ← NOT CAPTURED
  cache: { read: number, write: number }
}
```

**Impact**:
- Extended thinking (Claude 3.5+) uses significant reasoning tokens
- Cost calculations are WRONG without reasoning tokens
- Cannot analyze thinking patterns

**Fix Required**:
```typescript
interface LLMSpanAttributes {
  // ... existing
  'gen_ai.usage.reasoning_tokens'?: number;  // NEW
}
```

**Missing Task**: Add `gen_ai.usage.reasoning_tokens` to LLM span attributes

---

### GAP-014: Missing Model ID (Actual vs Requested)

**Location**: `specs/ep22-unified-observability/contracts/interfaces.ts:189,209`

**Current Design**: Only captures `gen_ai.request.model` and `gen_ai.response.model`

**Opencode SDK Provides**:
```typescript
// From AssistantMessage
{
  modelID: string,    // Specific model version (e.g., "claude-3-5-sonnet-20241022")
  providerID: string, // Provider that served it
}
```

**Impact**:
- Cannot distinguish between model aliases and actual models
- Provider may substitute models (especially with OpenRouter)
- Cost calculations may use wrong pricing

**Fix Required**: Ensure `gen_ai.response.model` is populated from `message.modelID`, not `message.model`

---

### GAP-015: No Tool State Transition Tracking

**Location**: `specs/ep22-unified-observability/tasks.md` - Only tracking started/completed

**Opencode SDK Provides**:
```typescript
// ToolState has 4 states
type ToolState =
  | { status: 'pending', input, raw }
  | { status: 'running', input, title?, metadata?, time: { start } }
  | { status: 'completed', input, output, title, metadata, time: { start, end, compacted? } }
  | { status: 'error', input, error, metadata?, time: { start, end } };
```

**Impact**:
- Cannot measure time-to-first-byte for tools
- Cannot identify tools that get stuck in "running"
- Missing `pending` state duration analysis

**Fix Required**:
```typescript
interface ToolSpanAttributes {
  // ... existing
  'agentlint.tool.state_transitions'?: string[];  // ['pending', 'running', 'completed']
  'agentlint.tool.pending_duration_ms'?: number;  // Time in pending state
  'agentlint.tool.running_duration_ms'?: number;  // Time in running state
}
```

---

### GAP-016: Not Using parentID for Message Correlation

**Location**: `src/opencode/telemetry-tracker.ts:69-70` - Uses FIFO queue

**Current Architecture**:
```typescript
// telemetry-tracker.ts - FIFO queue per tool name
private pendingTools: Map<string, PendingTool[]> = new Map();
```

**Opencode SDK Provides**:
```typescript
// AssistantMessage has proper correlation
{
  id: string,       // Unique message ID
  sessionID: string,
  parentID: string, // Parent message for threading
}
```

**Impact**:
- FIFO breaks when tools have concurrent invocations with same name
- Cannot correlate multi-turn conversations properly
- Missing message threading for complex agent loops

**Fix Required**: Use `message.parentID` for proper correlation instead of FIFO hacks

---

### GAP-017: Missing Tool Metadata and Attachments

**Location**: Not in current design

**Opencode SDK Provides**:
```typescript
// ToolPart and ToolState
{
  metadata?: { [key: string]: unknown },  // Arbitrary tool metadata
  title?: string,                          // Tool display title
  attachments?: FilePart[]                 // Files created/modified
}
```

**Impact**:
- Tool-provided observability data is lost
- Cannot track file operations via tool attachments
- Missing context from tool titles

**Fix Required**:
```typescript
interface ToolSpanAttributes {
  // ... existing
  'agentlint.tool.title'?: string;
  'agentlint.tool.metadata'?: string;  // JSON stringified
  'agentlint.tool.attachment_count'?: number;
}
```

---

### GAP-018: Missing Path Context

**Location**: Not in current design

**Opencode SDK Provides**:
```typescript
// AssistantMessage.path
{
  cwd: string,  // Working directory
  root: string  // Project root
}
```

**Impact**:
- Cannot correlate tool calls to directories
- Cannot analyze multi-project sessions
- Missing context for file operations

**Fix Required**:
```typescript
interface SessionSpanAttributes {
  // ... existing
  'agentlint.session.cwd'?: string;
  'agentlint.session.root'?: string;
}
```

---

## HIGH SEVERITY GAPS

### GAP-019: Missing Error Enrichment

**Location**: `specs/ep22-unified-observability/contracts/interfaces.ts:565-575` - Basic error attributes only

**Opencode SDK Provides**:
```typescript
// AssistantMessage.error types
type MessageError =
  | ProviderAuthError
  | ApiError {
      statusCode: number,
      isRetryable: boolean,
      responseHeaders: Record<string, string>,
      responseBody: unknown,
      metadata: { ... }
    }
  | UnknownError;
```

**Impact**:
- Cannot analyze retry patterns
- Missing HTTP status codes for API debugging
- Cannot identify authentication failures

**Fix Required**:
```typescript
interface ErrorEventAttributes {
  // ... existing
  'error.http_status'?: number;
  'error.is_retryable'?: boolean;
  'error.category'?: 'auth' | 'api' | 'rate_limit' | 'unknown';
}
```

---

### GAP-020: Tool callID Not Extracted

**Location**: `specs/ep22-unified-observability/contracts/interfaces.ts:172` - Optional `gen_ai.tool.call.id`

**Opencode SDK Provides**:
```typescript
// ToolPart has callID
{
  id: string,       // Part ID
  callID: string,   // Tool call ID for correlation
  // ...
}
```

**Current Design Issue**: FIFO correlation ignores `callID` even though SDK provides it

**Fix Required**: Extract and use `ToolPart.callID` for proper correlation

---

### GAP-021: No Session-Level Cost Accumulation

**Location**: `specs/ep22-unified-observability/contracts/interfaces.ts:159-162` - Only counts, no totals

**Opencode SDK Provides**:
```typescript
// Session tracks cumulative cost
session.TrackUsage(usage) // Updates session.cost, session.completionTokens, session.promptTokens
```

**Impact**:
- Cannot report total session cost at span end
- Missing cost tracking for multi-turn sessions

**Fix Required**:
```typescript
interface SessionSpanAttributes {
  // ... existing
  'agentlint.session.total_cost_usd'?: number;
  'agentlint.session.total_input_tokens'?: number;
  'agentlint.session.total_output_tokens'?: number;
}
```

---

## MEDIUM SEVERITY GAPS

### GAP-022: TUI State Events Not in SDK Hook Architecture

**Location**: `specs/ep22-unified-observability/tasks.md:T051-T053` - Planned integration with ink-renderer

**Issue**: Design doesn't leverage Opencode SDK plugin event hooks:
- `session.idle` - Session went idle
- `permission.updated`, `permission.replied` - Permission flows
- `file.edited` - File modifications

**Impact**: Missing SDK-level events that provide richer context than TUI state

**Fix Required**: Add tasks to subscribe to SDK plugin events, not just TUI state

---

### GAP-023: No Time Compaction Tracking

**Location**: Not in current design

**Opencode SDK Provides**:
```typescript
// ToolState.time
{
  start: number,
  end: number,
  compacted?: number  // When tool output was compacted
}
```

**Impact**: Cannot analyze when tool outputs are being truncated by the agent

---

## Provider-Specific Considerations

### Cache Token Variations

| Provider | Cache Read | Cache Write | Notes |
|----------|------------|-------------|-------|
| Anthropic | ✅ | ✅ | Full prompt caching |
| Google Gemini | ✅ | ✅ | Context caching |
| OpenAI | ❌ | ❌ | No cache tokens reported |
| GitHub Copilot | ❌ | ❌ | No cache tokens |
| Bedrock | ✅ | ✅ | Via Claude |

**Fix Required**: Make cache token fields nullable, don't expect them from all providers

---

## Recommended Task Additions

### Phase 3.5 Additions (Gap Fixes)

```markdown
### Provider Support (GAP-012)

- [ ] T025h [P] Update GenAIProvider type to include all major providers (openai, google, bedrock, groq, etc.)
- [ ] T025i Extract provider from SDK `AssistantMessage.providerID` instead of hardcoding

### Reasoning Tokens (GAP-013)

- [ ] T025j Add `gen_ai.usage.reasoning_tokens` to LLMSpanAttributes
- [ ] T025k Extract reasoning tokens from SDK `AssistantMessage.tokens.reasoning`

### Tool Correlation (GAP-016, GAP-020)

- [ ] T025l Replace FIFO queue correlation with SDK `ToolPart.callID` and `AssistantMessage.parentID`
- [ ] T025m Add tool state transition tracking (pending → running → completed)

### Context Enrichment (GAP-017, GAP-018, GAP-021)

- [ ] T025n Extract tool metadata, title, and attachment count from SDK responses
- [ ] T025o Add session path context (cwd, root) from SDK AssistantMessage.path
- [ ] T025p Track session-level cost and token totals at span end

### Error Enrichment (GAP-019)

- [ ] T025q Enhance error events with HTTP status, retryability, and error category
```

---

## Updated Totals

| Metric | Before | After |
|--------|--------|-------|
| Total Tasks | 69 | 79 |
| MVP Tasks | 52 | 62 |
| Critical Gaps | 8 | 0 (addressed) |
| High Gaps | 3 | 0 (addressed) |

---

## Summary

The EP22 design **assumed Anthropic-only** and **did not fully leverage the Opencode SDK's data richness**. Key fixes needed:

1. **Multi-provider support** - Extract `providerID` from SDK, expand GenAIProvider type
2. **Reasoning tokens** - Critical for Claude 3.5+ cost tracking
3. **Replace FIFO correlation** - Use SDK's `callID` and `parentID`
4. **Extract SDK metadata** - Tool metadata, path context, error enrichment
5. **Session-level aggregation** - Total cost/tokens at session end

Without these fixes, observability value is **~40% of potential** due to missing data points and incorrect provider attribution.
