# Feature Specification: Rich Telemetry Unification

> **Epic**: EP23
> **Created**: 2026-01-31
> **Status**: Draft
> **Author**: agentlint team
> **Depends On**: EP22 (Unified Observability)

---

## 1. Overview

Unify agentlint's two parallel observability systems (local observability module and HoneyHive telemetry) to enable rich, debuggable traces in HoneyHive. Currently, HoneyHive traces are "sparse" - showing only metadata (token counts, timing) without the prompt/completion content, tool arguments/results, or proper span hierarchy needed for debugging.

**The Problem**: EP22 implemented two separate trace systems that share trace IDs but not data richness. Users see session metadata in HoneyHive but can't debug what actually happened because:
1. No prompt/completion content is sent (privacy default)
2. Tool arguments/results not included in HoneyHive payloads
3. Flat event hierarchy instead of true parent-child spans
4. SSE stream events not instrumented

**The Solution**: Wire the existing content capture module (`src/observability/content-capture.ts`) to the HoneyHive telemetry path, and fill the remaining gaps identified in `specs/ep22-unified-observability/analysis-honeyhive-gaps.md`.

### 1.1 Business Context

Per Constitution Principle VII (Intelligent Tooling), agentlint should provide the agent with rich debugging data. HoneyHive's "killer feature" is prompt debugging and playground replay - features that are useless without prompt/completion content. This epic completes the EP22 vision of unified observability.

**Value Proposition**: With rich traces, users can:
- Replay any LLM call in HoneyHive's playground
- Debug tool failures with full input/output context
- Analyze prompt engineering effectiveness
- Track cost optimization from prompt caching
- Diagnose session failures with full context

### 1.2 Out of Scope

- Replacing the local NDJSON export system (kept for offline debugging)
- Native HoneyHive SDK integration (future consideration)
- OpenTelemetry Collector deployment (users provide their own)
- OTLP export to providers other than HoneyHive
- Real-time streaming dashboards

---

## 2. User Scenarios & Testing

### US-001 [P0]: Opt-In Content Capture for HoneyHive

**As a** developer debugging a failed agentlint session,
**I want** to see the actual prompts and completions in HoneyHive,
**So that** I can understand what went wrong and fix it.

**Acceptance Criteria:**
- [ ] Given `AGENTLINT_CAPTURE_CONTENT=true` is set, when an LLM call is made, then the prompt messages are included in the HoneyHive event `inputs` field
- [ ] Given `AGENTLINT_CAPTURE_CONTENT=true` is set, when an LLM response is received, then the completion content is included in the HoneyHive event `outputs` field
- [ ] Given content capture is disabled (default), when events are sent, then no prompt/completion content is included
- [ ] Given content is captured, then secrets are redacted using existing `redact()` function
- [ ] Given content exceeds `AGENTLINT_CAPTURE_MAX_LENGTH`, then it is truncated with `[truncated]` marker

**Test Scenarios:**
- Happy path: Enable content capture, run session, verify prompts visible in HoneyHive
- Privacy default: Disable content capture, verify no content in events
- Redaction: Include API key in prompt, verify redacted in HoneyHive
- Truncation: Send 10KB prompt, verify truncated to max length

---

### US-002 [P0]: Tool Call Replay in HoneyHive

**As a** developer investigating a tool failure,
**I want** to see the tool arguments and results in HoneyHive,
**So that** I can understand what the tool received and returned.

**Acceptance Criteria:**
- [ ] Given a tool is called, then its `arguments` are included in the HoneyHive event `inputs` field
- [ ] Given a tool succeeds, then its `result` is included in the HoneyHive event `outputs` field
- [ ] Given a tool fails, then the `error` message and `errorCategory` are included
- [ ] Given `gen_ai.tool.call.id` is available from SDK, then it's included for linking
- [ ] Given tool content exceeds 5000 chars, then it's truncated

**Test Scenarios:**
- Happy path: Call `read_file` tool, verify arguments/result in HoneyHive
- Error case: Tool throws error, verify error details captured
- Large result: Tool returns 10KB, verify truncated

---

### US-003 [P1]: Anthropic Cache Token Tracking

**As a** developer optimizing costs,
**I want** to see prompt caching metrics in HoneyHive,
**So that** I can verify caching is working and measure savings.

**Acceptance Criteria:**
- [ ] Given an LLM call uses prompt caching, then `cache_read_tokens` is included in HoneyHive metrics
- [ ] Given an LLM call creates cache entries, then `cache_creation_tokens` is included in HoneyHive metrics
- [ ] Given session totals are calculated, then cache token totals are included in session metrics

**Test Scenarios:**
- Cache hit: Verify `cache_read_tokens > 0` in HoneyHive
- Cache miss with creation: Verify `cache_creation_tokens > 0`
- No caching: Verify cache metrics are 0 or undefined

---

### US-004 [P1]: LLM Request Hyperparameters

**As a** developer tuning model behavior,
**I want** to see all request parameters in HoneyHive,
**So that** I can correlate parameter choices with output quality.

**Acceptance Criteria:**
- [ ] Given `temperature` is set, then it appears in HoneyHive event `config` and `inputs`
- [ ] Given `max_tokens` is set, then it appears in HoneyHive event `config`
- [ ] Given `top_p` is set, then it appears in HoneyHive event `config`
- [ ] Given `stop_sequences` are set, then they appear in HoneyHive event `config`
- [ ] Given extended thinking is used, then `reasoning_tokens` appears in HoneyHive metrics

**Test Scenarios:**
- Full params: Set all hyperparameters, verify all visible in HoneyHive
- Default params: Omit params, verify only set values appear
- Extended thinking: Use Claude 3.5+ extended thinking, verify reasoning tokens tracked

---

### US-005 [P1]: True Parent-Child Span Hierarchy

**As a** developer analyzing session flow,
**I want** to see proper span nesting in HoneyHive's waterfall view,
**So that** I can understand the execution order and relationships.

**Acceptance Criteria:**
- [ ] Given a tool call happens within an LLM turn, then its `parent_id` points to the LLM event (not session)
- [ ] Given multiple LLM calls happen sequentially, then each has appropriate parent linking
- [ ] Given nested tool calls occur (tool calls tool), then hierarchy is preserved
- [ ] Given the HoneyHive waterfall renders, then it shows a proper tree (not flat list)

**Test Scenarios:**
- Basic hierarchy: Session → LLM → Tool, verify parent IDs correct
- Complex hierarchy: Session → LLM → Tool → LLM → Tool, verify nesting
- Waterfall view: Visual inspection in HoneyHive UI

---

### US-006 [P2]: Agent Identity Attributes

**As a** platform engineer managing multiple agents,
**I want** to filter HoneyHive traces by agent identity,
**So that** I can analyze agentlint sessions separately from other tools.

**Acceptance Criteria:**
- [ ] Given a session starts, then `gen_ai.agent.id = "agentlint-cli"` is in session attributes
- [ ] Given a session starts, then `gen_ai.agent.name = "agentlint"` is in session attributes
- [ ] Given HoneyHive filters by agent, then agentlint sessions are filterable

**Test Scenarios:**
- Identity present: Verify attributes in HoneyHive session
- Filter works: Filter HoneyHive by agent name

---

### US-007 [P2]: Session-End Metrics

**As a** developer reviewing session performance,
**I want** to see aggregate metrics when a session ends,
**So that** I can quickly assess session quality.

**Acceptance Criteria:**
- [ ] Given a session ends, then `tool_call_count` is included in session metrics
- [ ] Given a session ends with findings, then `finding_count` is included
- [ ] Given recommendations are generated, then `recommendation_count` is included
- [ ] Given context window was compressed, then `compression_count` is included
- [ ] Given the session used retries, then `retry_count` is included

**Test Scenarios:**
- Successful session: Verify all counts present
- Empty session: Verify counts are 0

---

### US-008 [P2]: Error Event Enrichment

**As a** developer debugging failures,
**I want** detailed error information in HoneyHive,
**So that** I can quickly identify and fix issues.

**Acceptance Criteria:**
- [ ] Given an error occurs, then `error.type` categorizes it (auth, rate_limit, timeout, etc.)
- [ ] Given an error occurs, then sanitized `error.stack` is included
- [ ] Given an error is retryable, then `error.isRetryable` is included
- [ ] Given an HTTP error, then `error.statusCode` is included

**Test Scenarios:**
- Auth error: Verify type=auth, appropriate message
- Rate limit: Verify type=rate_limit, retryable=true
- Stack trace: Verify stack present, secrets redacted

---

### US-009 [P3]: SSE Stream Instrumentation

**As a** developer debugging streaming issues,
**I want** stream lifecycle events in traces,
**So that** I can diagnose "events not reaching TUI" problems.

**Acceptance Criteria:**
- [ ] Given streaming starts, then a stream span is created
- [ ] Given first token is received, then `first_token` event is recorded on span
- [ ] Given streaming completes, then `stream_complete` event with total chunks is recorded
- [ ] Given streaming errors, then error is captured with partial chunk count

**Test Scenarios:**
- Normal stream: Verify span with first_token and stream_complete events
- Stream timeout: Verify error captured with partial progress
- Stream interrupt: Verify span ends with interrupted status

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | User Story |
|----|-------------|----------|------------|
| FR-001 | Wire content-capture.ts to telemetry path for LLM messages | P0 | US-001 |
| FR-002 | Include tool arguments in HoneyHive `inputs` field | P0 | US-002 |
| FR-003 | Include tool results in HoneyHive `outputs` field | P0 | US-002 |
| FR-004 | Add `cache_read_tokens` and `cache_creation_tokens` to HoneyHive metrics | P1 | US-003 |
| FR-005 | Add all hyperparameters (temperature, top_p, max_tokens, etc.) to HoneyHive config | P1 | US-004 |
| FR-006 | Add `reasoning_tokens` to HoneyHive metrics for extended thinking | P1 | US-004 |
| FR-007 | Implement true parent-child hierarchy using TelemetryTracker turn context | P1 | US-005 |
| FR-008 | Add agent identity attributes to session span | P2 | US-006 |
| FR-009 | Add session-end aggregate metrics | P2 | US-007 |
| FR-010 | Enrich error events with type, stack, category | P2 | US-008 |
| FR-011 | Instrument StreamAdapter with span lifecycle events | P3 | US-009 |
| FR-012 | Surface `trace_id` in HoneyHive metadata for local/remote correlation | P2 | All |

### 3.2 Non-Functional Requirements

| ID | Requirement | Metric | Target |
|----|-------------|--------|--------|
| NFR-001 | Content capture opt-in by default | Privacy | Default=false per Constitution |
| NFR-002 | Secret redaction | Security | All secrets redacted before send |
| NFR-003 | Content truncation | Memory | Max 5000 chars per field |
| NFR-004 | No latency impact | Performance | <5ms overhead per event |
| NFR-005 | Graceful degradation | Reliability | Telemetry failure doesn't crash CLI |
| NFR-006 | Test coverage | Quality | >80% for new code |

---

## 4. Key Entities

### 4.1 Modified Entities

| Entity | File | Changes |
|--------|------|---------|
| `TrackLLMOptions` | `src/telemetry/types.ts` | Add `promptContent`, `completionContent` |
| `TrackToolOptions` | `src/telemetry/types.ts` | Ensure `toolInput`, `toolOutput` wired to HoneyHive |
| `TelemetryEvent` | `src/telemetry/events.ts` | Add trace context visibility |
| `buildHoneyHiveMetrics` | `apps/telemetry-api/route.ts` | Add cache tokens, reasoning tokens |
| `buildHoneyHiveConfig` | `apps/telemetry-api/route.ts` | Add all hyperparameters |
| `StreamAdapter` | `src/opencode/streaming.ts` | Add span instrumentation |

### 4.2 New Entities

| Entity | Description | Key Attributes |
|--------|-------------|----------------|
| `ContentCaptureConfig` | Unified config for content capture | `enabled`, `maxLength`, `redactSecrets` |
| `StreamSpan` | Span for SSE stream lifecycle | `chunkCount`, `firstTokenAt`, `status` |

### 4.3 Data Flow

```
OpencodeOrchestrator
    │
    ├──► TelemetryTracker.onLLMUsage()
    │        │
    │        ├── if contentCapture.enabled:
    │        │      capture prompt/completion via content-capture.ts
    │        │
    │        └──► AlphaTelemetryClient.trackLLMEx()
    │                 │
    │                 └──► TelemetryEvent with content
    │                          │
    │                          └──► Vercel Proxy
    │                                   │
    │                                   └──► HoneyHive /events
    │                                            │
    │                                            └── Full inputs/outputs visible!
    │
    └──► StreamAdapter.adaptStream()
             │
             └──► StreamSpan with first_token, stream_complete events
```

---

## 5. Success Criteria

- [ ] **Functional**: HoneyHive traces show prompt/completion content when `AGENTLINT_CAPTURE_CONTENT=true`
- [ ] **Functional**: Tool arguments and results visible in HoneyHive events
- [ ] **Functional**: Cache tokens visible in HoneyHive metrics
- [ ] **Functional**: Waterfall view shows proper parent-child hierarchy
- [ ] **Quality**: Test coverage >80% for new/modified code
- [ ] **Quality**: All existing tests pass
- [ ] **Performance**: No measurable latency impact (<5ms per event)
- [ ] **Privacy**: Content capture disabled by default
- [ ] **Security**: No secrets leak to HoneyHive (redaction verified)

---

## 6. Edge Cases & Error Handling

| Scenario | Expected Behavior | Priority |
|----------|-------------------|----------|
| Content capture disabled | Events have empty inputs/outputs content | P0 |
| Prompt contains API key | Key is redacted before send | P0 |
| Tool returns 10KB result | Truncated to 5000 chars with marker | P1 |
| Telemetry network failure | Log warning, continue CLI execution | P1 |
| Stream interrupted mid-way | Span ends with partial chunk count + error | P2 |
| HoneyHive rate limited | Back off, retry, eventually drop events | P2 |
| Trace ID mismatch | Local and HoneyHive use same trace ID | P1 |
| Session ends before flush | Final flush happens in dispose() | P1 |

---

## 7. Dependencies & Assumptions

### 7.1 Dependencies

| Dependency | Type | Status | Impact if Missing |
|------------|------|--------|-------------------|
| EP22 Observability Module | Internal | Complete | Must exist for trace context |
| HoneyHive API | External | Available | No remote traces |
| Vercel Edge Function | Internal | Deployed (auto-deploy) | No proxy to HoneyHive |
| content-capture.ts | Internal | Exists | Must be wired to telemetry |
| redaction.ts | Internal | Exists | Must be used for secrets |

### 7.2 Assumptions

- HoneyHive's `/events` endpoint accepts our extended payload fields
- Content capture overhead is negligible (<5ms)
- Users who enable content capture accept the privacy implications
- Existing telemetry buffer/flush mechanism handles increased payload size

---

## 8. Open Questions

- [x] **Q1**: Should content capture be config-file settable or env-var only? — **RESOLVED**: Both. Env var `AGENTLINT_CAPTURE_CONTENT=true` OR config file `telemetry.captureContent: true`. Env var overrides config.

- [x] **Q2**: What's the max content length before truncation? — **RESOLVED**: 5000 chars (matches existing `AGENTLINT_CAPTURE_MAX_LENGTH` default)

- [x] **Q3**: Should we capture system prompts separately from user messages? — **RESOLVED**: Yes, use OTel convention `gen_ai.system_instructions` for system prompt, `gen_ai.input.messages` for chat history.

- [x] **Q4**: Do we need to update the Vercel proxy deployment process? — **RESOLVED**: No. Vercel auto-deploys from main branch when PRs merge. Just include proxy changes in the same PR as CLI changes.

---

## 9. References

- [EP22 Spec](../ep22-unified-observability/spec.md) - Original unified observability design
- [EP22 HoneyHive Gaps Analysis](../ep22-unified-observability/analysis-honeyhive-gaps.md) - Identified gaps
- [Constitution](../../.specify/memory/constitution.md) - Principle I (Local-First), VII (Intelligent Tooling)
- [ADR-0024](../../docs/architecture/adr/0024-opencode-sdk-migration.md) - Opencode SDK context
- [HoneyHive Data Model](https://docs.honeyhive.ai/datamodel) - Expected schema
- [OTel GenAI Conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) - Standard attributes

---

## 10. Implementation Notes

### 10.1 Files to Modify

| File | Changes |
|------|---------|
| `src/telemetry/alpha-client.ts` | Add content capture integration |
| `src/telemetry/types.ts` | Extend options interfaces |
| `src/telemetry/events.ts` | Add content fields to event data |
| `src/opencode/telemetry-tracker.ts` | Capture content from SDK events |
| `src/opencode/streaming.ts` | Add stream span instrumentation |
| `apps/telemetry-api/app/api/events/route.ts` | Add content to HoneyHive payloads |

### 10.2 Configuration Addition

```typescript
// In ~/.agentlint/config.json
{
  "telemetry": {
    "enabled": true,
    "mode": "alpha",
    "captureContent": true,  // NEW: opt-in content capture
    "maxContentLength": 5000  // NEW: truncation limit
  }
}
```

### 10.3 Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `AGENTLINT_CAPTURE_CONTENT` | Enable prompt/completion capture | `false` |
| `AGENTLINT_CAPTURE_MAX_LENGTH` | Max content length | `5000` |

---

## Clarifications

> This section is populated by /dev.clarify

### Session 2026-01-31

**Q4: Do we need to update the Vercel proxy deployment process?**
A: No. Vercel auto-deploys from the main branch when PRs merge. The Vercel project (`apps/telemetry-api`) is already connected to the repository with automatic deployment configured. Just include proxy changes (to `apps/telemetry-api/app/api/events/route.ts`) in the same PR as CLI changes - they'll deploy together.

Updated: Section 7.1 Dependencies - Vercel Edge Function status confirmed as "Deployed (auto-deploy enabled)"
