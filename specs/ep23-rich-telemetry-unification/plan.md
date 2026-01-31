# Implementation Plan: Rich Telemetry Unification

> **Epic**: EP23
> **Spec**: specs/ep23-rich-telemetry-unification/spec.md
> **Created**: 2026-01-31
> **Status**: Design Complete
> **Author**: agentlint team

---

## Summary

**Primary Requirement**: Unify agentlint's two parallel observability systems (local observability and HoneyHive telemetry) to enable rich, debuggable traces in HoneyHive with prompt/completion content, tool arguments/results, proper span hierarchy, and cache token tracking.

**Technical Approach**: Wire the existing `content-capture.ts` module (used for local NDJSON traces) to the HoneyHive telemetry path via `TelemetryTracker`, then update the Vercel proxy to map new content fields to HoneyHive's expected schema. All content capture remains opt-in via `AGENTLINT_CAPTURE_CONTENT=true`.

---

## Technical Context

| Aspect | Value |
|--------|-------|
| **Language/Version** | TypeScript 5.x (Bun runtime) |
| **Primary Dependencies** | Opencode SDK, Zod, HoneyHive API |
| **Storage** | None (telemetry is fire-and-forget to HoneyHive) |
| **Testing Framework** | Bun test |
| **Target Platform** | CLI (agentlint) + Vercel Edge Function (proxy) |
| **Project Type** | CLI Tool with backend telemetry service |
| **Performance Goals** | <5ms overhead per telemetry event |
| **Constraints** | Content capture opt-in (privacy), secrets redacted |
| **Scale/Scope** | Single developer (alpha telemetry users) |

---

## Constitution Check

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Local-First | ✅ | Content capture disabled by default. Only enabled via explicit opt-in (`AGENTLINT_CAPTURE_CONTENT=true`). Users consent by enabling. |
| II | Improvement-Oriented | ✅ | Rich traces enable analysis of session patterns over time. Cache token tracking enables cost optimization. |
| III | Causal-First | ✅ | Full tool arguments/results enable tracing issues to their origin. Parent-child hierarchy shows execution flow. |
| IV | Mixed-Methods | ✅ | Telemetry provides quantitative data (tokens, timing). Content provides qualitative context for agent reasoning. |
| V | Language-Agnostic | ✅ | Telemetry captures tool/LLM interactions regardless of project language. |
| VI | Agent-Agnostic | ✅ | Telemetry layer is independent of specific agent implementation. |
| VII | Intelligent Tooling | ✅ | This feature provides data infrastructure for debugging, not agent orchestration. Tools provide data; agent reasons. |
| VIII | Compounding Value | ✅ | Rich traces enable historical comparison and pattern detection across sessions. |
| IX | Agent-Aware | ✅ | Structured telemetry serves agent debugging needs with hierarchical context. |

**Gate Status**: [✅] All principles pass

---

## Project Structure

### Documentation Structure

```
specs/ep23-rich-telemetry-unification/
├── spec.md           # Feature specification
├── plan.md           # This file
├── research.md       # Research findings (complete)
├── data-model.md     # Entity definitions
├── quickstart.md     # Usage guide
├── contracts/        # API definitions
│   └── interfaces.ts # Extended telemetry interfaces
└── checklists/       # Validation checklists
    └── requirements.md
```

### Source Code Structure (Changes)

```
src/
├── telemetry/
│   ├── alpha-client.ts    # MODIFY: Add content capture integration
│   ├── types.ts           # MODIFY: Extend TrackLLMOptions, TrackToolOptions
│   └── events.ts          # MODIFY: Add content fields to event data
├── opencode/
│   ├── telemetry-tracker.ts  # MODIFY: Capture content from SDK events
│   └── streaming.ts          # MODIFY: Add stream span instrumentation (P3)
└── observability/
    └── content-capture.ts    # EXISTING: Reuse for telemetry path

apps/telemetry-api/
└── app/api/events/
    └── route.ts           # MODIFY: Map content to HoneyHive schema
```

---

## Complexity Tracking

> No constitutional violations - all features align with principles.

| Principle | Violation | Justification | Mitigation |
|-----------|-----------|---------------|------------|
| (none) | - | - | - |

---

## Key Design Decisions

| Decision | Choice | Rationale | ADR |
|----------|--------|-----------|-----|
| Content capture opt-in | Env var + config | Constitution Principle I requires explicit consent | N/A |
| Reuse content-capture.ts | Wire to telemetry | DRY - module already handles truncation & redaction | N/A |
| Same PR for CLI + proxy | Single deployment | Vercel auto-deploys; avoids version mismatch | N/A |
| OTel GenAI attributes | Follow standard | Industry standard, HoneyHive compatibility | ADR-0025 (proposed) |
| Parent hierarchy via turn context | TelemetryTracker | Already tracks turn context; minimal new code | N/A |

---

## Implementation Phases

### Phase 1: P0 Content Capture (US-001, US-002)

**Goal**: Enable rich LLM and tool content in HoneyHive

1. **Extend telemetry types** (`src/telemetry/types.ts`)
   - Add `promptContent`, `completionContent` to `TrackLLMOptions`
   - Add `toolInputJson`, `toolOutputJson` to `TrackToolOptions`

2. **Wire content capture** (`src/opencode/telemetry-tracker.ts`)
   - Import `isContentCaptureEnabled`, `truncateContent`, `sanitizeContent`
   - In `onLLMUsage()`: capture prompt/completion when enabled
   - In `onToolComplete()`: capture arguments/result when enabled

3. **Update alpha client** (`src/telemetry/alpha-client.ts`)
   - Include content fields in event data when provided

4. **Update Vercel proxy** (`apps/telemetry-api/app/api/events/route.ts`)
   - Map `promptContent` → `inputs.messages`
   - Map `completionContent` → `outputs.content`
   - Map `toolInputJson` → `inputs.arguments`
   - Map `toolOutputJson` → `outputs.result`

### Phase 2: P1 Metrics & Hierarchy (US-003, US-004, US-005)

**Goal**: Complete metrics and fix span hierarchy

1. **Cache tokens** (FR-004)
   - Already in SDK events; verify mapping to HoneyHive metrics
   - Add `cache_read_tokens`, `cache_creation_tokens` to proxy

2. **Hyperparameters** (FR-005)
   - Already partially captured; add `top_p`, `stop_sequences`
   - Map to HoneyHive `config` object

3. **Reasoning tokens** (FR-006)
   - Add `reasoning_tokens` to LLM event metrics

4. **Parent hierarchy** (FR-007)
   - Track current LLM event ID in TelemetryTracker
   - Use as `parentEventId` for tool events within that turn

### Phase 3: P2 Polish (US-006, US-007, US-008)

**Goal**: Agent identity, session metrics, error enrichment

1. **Agent identity** (FR-008)
   - Add `gen_ai.agent.id`, `gen_ai.agent.name` to session.start

2. **Session-end metrics** (FR-009)
   - Include `tool_call_count`, `finding_count`, etc. in session.end

3. **Error enrichment** (FR-010)
   - Add `error.type`, `error.stack` (sanitized), `error.isRetryable`

4. **Trace ID visibility** (FR-012)
   - Surface `trace_id` in HoneyHive metadata for correlation

### Phase 4: P3 Optional (US-009)

**Goal**: Stream instrumentation (if time permits)

1. **StreamAdapter spans** (FR-011)
   - Create span on stream start
   - Record `first_token` event
   - Record `stream_complete` with chunk count

---

## Testing Strategy

### Unit Tests

| Test | File | Coverage |
|------|------|----------|
| Content capture enabled/disabled | `src/telemetry/__tests__/content-capture.test.ts` | FR-001 |
| Secret redaction in content | `src/telemetry/__tests__/redaction.test.ts` | NFR-002 |
| Content truncation | `src/telemetry/__tests__/truncation.test.ts` | NFR-003 |
| LLM event with content | `src/opencode/__tests__/telemetry-tracker.test.ts` | US-001 |
| Tool event with content | `src/opencode/__tests__/telemetry-tracker.test.ts` | US-002 |
| Parent hierarchy | `src/opencode/__tests__/telemetry-tracker.test.ts` | US-005 |

### Integration Tests

| Test | Description |
|------|-------------|
| End-to-end telemetry flow | Run session with content capture, verify HoneyHive receives |
| Privacy default | Run session without opt-in, verify no content sent |
| Vercel proxy mapping | Send test events, verify HoneyHive schema compliance |

---

## References

- **Spec**: [specs/ep23-rich-telemetry-unification/spec.md](./spec.md)
- **Research**: [specs/ep23-rich-telemetry-unification/research.md](./research.md)
- **EP22 Spec**: [specs/ep22-unified-observability/spec.md](../ep22-unified-observability/spec.md)
- **EP22 Gaps**: [specs/ep22-unified-observability/analysis-honeyhive-gaps.md](../ep22-unified-observability/analysis-honeyhive-gaps.md)
- **Constitution**: [.specify/memory/constitution.md](../../.specify/memory/constitution.md)
- **HoneyHive Docs**: https://docs.honeyhive.ai/datamodel
- **OTel GenAI**: https://opentelemetry.io/docs/specs/semconv/gen-ai/

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-31 | agentlint team | Initial plan |
