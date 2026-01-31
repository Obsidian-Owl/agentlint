# Tasks: Rich Telemetry Unification

> **Epic**: EP23
> **Generated**: 2026-01-31
> **Total Tasks**: 47
> **MVP Tasks**: 29 (Setup + P0 + P1)

---

## Summary

| Phase | Tasks | Parallelizable |
|-------|-------|----------------|
| Setup | 3 | 2 |
| P0: Content Capture | 15 | 5 |
| P1: Metrics & Hierarchy | 11 | 4 |
| P2: Polish | 10 | 3 |
| P3: Optional | 5 | 2 |
| Integration Tests | 3 | 2 |

---

## Phase 1: Setup

**Goal**: Prepare codebase for content capture changes

- [ ] T001 [P] Read existing content-capture.ts to understand current implementation in `src/observability/content-capture.ts`
- [ ] T002 [P] Read existing telemetry-tracker.ts to understand current tool/LLM tracking in `src/opencode/telemetry-tracker.ts`
- [ ] T003 Verify content capture functions are exported from observability module in `src/observability/index.ts`

**Checkpoint**: Setup complete - understand existing code and module structure

---

## Phase 2: P0 Content Capture (US-001, US-002)

**Goal**: Enable rich LLM and tool content in HoneyHive
**Requirements**: FR-001, FR-002, FR-003

### Tests (write first)

- [ ] T004 [P] [US1] Unit test: content capture enabled includes prompt in LLM event in `src/telemetry/__tests__/content-capture.test.ts`
- [ ] T005 [P] [US1] Unit test: content capture disabled excludes prompt from LLM event
- [ ] T006 [P] [US1] Unit test: secrets are redacted from captured content
- [ ] T007 [P] [US1] Unit test: content exceeding max length is truncated with marker
- [ ] T008 [P] [US2] Unit test: tool arguments included in tool.call event inputs

### Type Extensions

- [ ] T009 [US1] Add `promptContent`, `completionContent`, `systemInstructions` to TrackLLMOptions in `src/telemetry/types.ts`
- [ ] T010 [US2] Add `toolInputJson`, `toolOutputJson` to TrackToolOptions in `src/telemetry/types.ts`

### TelemetryTracker Wiring

- [ ] T011 [US1] Wire LLM content capture in onLLMUsage() - capture prompt/completion when enabled in `src/opencode/telemetry-tracker.ts` (depends on T009)
- [ ] T012 [US2] Wire tool content to trackToolEx() - include captured content from pending.capturedContent in `src/opencode/telemetry-tracker.ts` (depends on T010)

### Alpha Client Updates

- [ ] T013 [US1] Include LLM content fields in event data when provided in `src/telemetry/alpha-client.ts` (depends on T009)
- [ ] T014 [US2] Verify tool content fields flow to event data in `src/telemetry/alpha-client.ts` (depends on T010)

### Vercel Proxy Updates

- [ ] T015 [US1] Map `promptContent` → `inputs.messages` for llm.usage events in `apps/telemetry-api/app/api/events/route.ts`
- [ ] T016 [US1] Map `completionContent` → `outputs.content` for llm.usage events in `apps/telemetry-api/app/api/events/route.ts`
- [ ] T017 [US2] Map `toolInputJson` → `inputs.arguments` for tool.call events in `apps/telemetry-api/app/api/events/route.ts`
- [ ] T018 [US2] Map `toolOutputJson` → `outputs.result` for tool.call events in `apps/telemetry-api/app/api/events/route.ts`

**Checkpoint**: US-001 and US-002 complete - content visible in HoneyHive when enabled
- [ ] Verify prompts visible in HoneyHive with AGENTLINT_CAPTURE_CONTENT=true
- [ ] Verify tool args/results visible in HoneyHive events

---

## Phase 3: P1 Metrics & Hierarchy (US-003, US-004, US-005)

**Goal**: Complete metrics mapping and fix span hierarchy
**Requirements**: FR-004, FR-005, FR-006, FR-007

### Tests (write first)

- [ ] T019 [P] [US3] Unit test: cache_read_tokens mapped to HoneyHive metrics in `src/telemetry/__tests__/cache-tokens.test.ts`
- [ ] T020 [P] [US4] Unit test: reasoning_tokens included in LLM metrics
- [ ] T021 [P] [US5] Unit test: tool events have LLM turn as parent_id, not session

### Cache Token Mapping (US-003)

- [ ] T022 [US3] Verify cache tokens flow from TelemetryTracker to event data in `src/opencode/telemetry-tracker.ts`
- [ ] T023 [US3] Map `cacheReadTokens` → `metrics.cache_read_tokens` in Vercel proxy in `apps/telemetry-api/app/api/events/route.ts`
- [ ] T024 [US3] Map `cacheCreationTokens` → `metrics.cache_creation_tokens` in Vercel proxy

### Hyperparameters & Reasoning Tokens (US-004)

- [ ] T025 [US4] Add `reasoningTokens` to TrackLLMOptions if not present in `src/telemetry/types.ts`
- [ ] T026 [US4] Map `reasoningTokens` → `metrics.reasoning_tokens` in Vercel proxy in `apps/telemetry-api/app/api/events/route.ts`
- [ ] T027 [US4] Verify all hyperparameters (temperature, top_p, max_tokens) map to HoneyHive config object

### Parent Hierarchy (US-005)

- [ ] T028 [US5] Track current LLM event ID in TelemetryTracker for turn context in `src/opencode/telemetry-tracker.ts`
- [ ] T029 [US5] Use LLM event ID as parentEventId for tool events within that turn in `src/opencode/telemetry-tracker.ts` (depends on T028)

**Checkpoint**: US-003, US-004, US-005 complete - metrics and hierarchy correct
- [ ] Verify cache tokens appear in HoneyHive metrics
- [ ] Verify reasoning tokens appear for extended thinking calls
- [ ] Verify waterfall view shows proper hierarchy (Session → LLM → Tools)

---

## Phase 4: P2 Polish (US-006, US-007, US-008)

**Goal**: Agent identity, session metrics, error enrichment
**Requirements**: FR-008, FR-009, FR-010, FR-012

### Tests (write first)

- [ ] T030 [P] [US6] Unit test: session.start includes agent identity attributes
- [ ] T031 [P] [US7] Unit test: session.end includes compression_count and retry_count in `src/telemetry/__tests__/session-metrics.test.ts`
- [ ] T032 [P] [US8] Unit test: error events include category and sanitized stack

### Agent Identity (US-006)

- [ ] T033 [US6] Add `gen_ai.agent.id: "agentlint-cli"` to session.start event in `src/telemetry/alpha-client.ts`
- [ ] T034 [US6] Add `gen_ai.agent.name: "agentlint"` to session.start event
- [ ] T035 [US6] Map agent identity to HoneyHive session config in `apps/telemetry-api/app/api/events/route.ts`

### Session-End Metrics (US-007)

- [ ] T036 [US7] Include compression_count in session.end metrics from TelemetryTracker in `src/telemetry/alpha-client.ts`

### Error Enrichment (US-008)

- [ ] T037 [US8] Add errorStack (sanitized via redact()) to TrackToolOptions in `src/telemetry/types.ts`
- [ ] T038 [US8] Map error enrichment fields to HoneyHive metadata in `apps/telemetry-api/app/api/events/route.ts`

### Trace ID Visibility (FR-012)

- [ ] T039 Add trace_id to HoneyHive event metadata for correlation in `apps/telemetry-api/app/api/events/route.ts`

**Checkpoint**: US-006, US-007, US-008 complete - polish features in place
- [ ] Verify agent identity filterable in HoneyHive
- [ ] Verify session-end metrics include all counts
- [ ] Verify error events show category and stack

---

## Phase 5: P3 Optional - Stream Instrumentation (US-009)

**Goal**: SSE stream lifecycle events in traces
**Requirements**: FR-011

### Tests (write first)

- [ ] T040 [P] [US9] Unit test: stream span created on stream start in `src/opencode/__tests__/streaming.test.ts`
- [ ] T041 [P] [US9] Unit test: first_token event recorded with timestamp

### Implementation

- [ ] T042 [US9] Create stream span on stream start in StreamAdapter in `src/opencode/streaming.ts`
- [ ] T043 [US9] Record first_token span event when first chunk received in `src/opencode/streaming.ts` (depends on T042)
- [ ] T044 [US9] Record stream_complete event with chunk count in `src/opencode/streaming.ts` (depends on T042)

**Checkpoint**: US-009 complete - stream lifecycle visible in traces
- [ ] Verify stream spans appear in local traces
- [ ] Verify first_token latency visible

---

## Phase 6: Integration Tests

**Goal**: End-to-end verification of telemetry flow
**Requirements**: All user stories

- [ ] T045 [P] Integration test: end-to-end telemetry flow with content capture enabled in `src/telemetry/__tests__/integration/content-capture.integration.test.ts`
- [ ] T046 [P] Integration test: privacy default - verify no content sent when capture disabled in `src/telemetry/__tests__/integration/privacy-default.integration.test.ts`
- [ ] T047 Integration test: Vercel proxy mapping - send test events, verify HoneyHive schema compliance in `apps/telemetry-api/__tests__/honeyhive-mapping.integration.test.ts`

**Checkpoint**: Integration tests pass
- [ ] Content capture e2e flow verified
- [ ] Privacy default enforced
- [ ] HoneyHive schema compliance confirmed

---

## MVP Scope

Minimum viable implementation for rich telemetry:

| Phase | Tasks | Description |
|-------|-------|-------------|
| Setup | T001-T003 (3) | Understand existing code |
| P0: Content | T004-T018 (15) | LLM + tool content in HoneyHive |
| P1: Metrics | T019-T029 (11) | Cache tokens, hierarchy |

**Total MVP**: 29 tasks (Setup + P0 + P1)

**Full Feature**: 47 tasks (includes P2 + P3 + Integration Tests)

---

## Execution Notes

### Parallelization

- Tasks marked `[P]` can run in parallel within their phase
- Complete each phase checkpoint before starting the next phase
- Test tasks should run before implementation tasks in each phase

### File Modification Summary

| File | Phase | Tasks |
|------|-------|-------|
| `src/telemetry/types.ts` | P0, P1, P2 | T009, T010, T025, T037 |
| `src/opencode/telemetry-tracker.ts` | P0, P1 | T011, T012, T022, T028, T029 |
| `src/telemetry/alpha-client.ts` | P0, P2 | T013, T014, T033, T034, T036 |
| `apps/telemetry-api/app/api/events/route.ts` | P0, P1, P2 | T015-T018, T023-T024, T026-T027, T035, T038, T039 |
| `src/opencode/streaming.ts` | P3 | T042, T043, T044 |
| `src/telemetry/__tests__/` | P0, P1, P2, Int | T004-T008, T019-T021, T030-T032, T045-T046 |
| `apps/telemetry-api/__tests__/` | Int | T047 |

### Testing Commands

```bash
# Run unit tests
bun run test

# Verify content capture manually
AGENTLINT_CAPTURE_CONTENT=true agentlint analyse /path/to/project
```

### Verification

After each checkpoint, verify in HoneyHive:
1. Navigate to agentlint project
2. Find session by name
3. Check event details for expected fields

---

## Dependencies Graph

```
T001,T002,T003 (Setup)
       │
       ▼
T004-T008 (P0 Tests)
       │
       ▼
T009,T010 (Types)
       │
       ├──► T011,T012 (TelemetryTracker)
       │          │
       │          ▼
       │    T013,T014 (Alpha Client)
       │          │
       │          ▼
       └──► T015-T018 (Vercel Proxy) ──► Checkpoint P0
                                              │
                                              ▼
                                        T019-T021 (P1 Tests)
                                              │
                                              ▼
                                        T022-T029 (P1 Tasks) ──► Checkpoint P1
                                                                      │
                                                                      ▼
                                                                T030-T039 (P2)
                                                                      │
                                                                      ▼
                                                                T040-T044 (P3)
                                                                      │
                                                                      ▼
                                                                T045-T047 (Integration)
```
