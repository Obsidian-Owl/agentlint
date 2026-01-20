# Tasks: Recommendation Advisor

> **Epic**: EP10
> **Generated**: 2026-01-20
> **Total Tasks**: 56
> **MVP Tasks**: 38

---

## Summary

| Phase | Tasks | Parallelizable |
|-------|-------|----------------|
| Setup | 4 | 3 |
| Foundational | 8 | 4 |
| US1: Synthesize Recommendations | 8 | 4 |
| US2: Create and Store Case | 6 | 3 |
| US3: Add Events | 5 | 3 |
| US4: Query with Compressed Context | 7 | 4 |
| US5: Refine Recommendation (P2) | 5 | 3 |
| US6: Complete Recommendation (P2) | 5 | 3 |
| US7: Clarifying Questions (P2) | 4 | 2 |
| Polish | 4 | 2 |

---

## Phase 1: Setup

**Goal**: Initialize project structure and configuration

- [x] T001 [P] Create directory structure `src/recommendations/` with subdirectories: `subagent/`, `tools/`, `storage/`, `__tests__/`
- [x] T002 [P] Create `src/recommendations/index.ts` with module exports placeholder
- [x] T003 [P] Create `.agentlint/recommendations/` directory (runtime storage location)
- [x] T004 Add `recommendations` path constants to `src/persistence/common/directories.ts`

**Checkpoint**: Setup complete
- [ ] All directories exist
- [ ] Module entry point created

---

## Phase 2: Foundational

**Goal**: Core types, schemas, and storage infrastructure

### Types (from contracts)

- [x] T005 [P] Create `src/recommendations/types.ts` with all type exports from `specs/ep10-recommendation-advisor/contracts/types.ts`
- [x] T006 [P] Create `src/recommendations/schemas.ts` with Zod schemas (TracedOriginSchema, RecommendationEventSchema, RecommendationSchema, input schemas)

### Storage Infrastructure

- [x] T007 Write unit tests for storage module in `src/recommendations/__tests__/storage.test.ts` (CRUD operations, atomic writes)
- [x] T008 Create `src/recommendations/storage/index.ts` with storage exports
- [x] T009 Implement `src/recommendations/storage/storage.ts` with functions: `saveRecommendation()`, `loadRecommendation()`, `listRecommendationIds()`, `deleteRecommendation()` (depends on T007)

### Compression Utilities

- [x] T010 Write unit tests for compression in `src/recommendations/__tests__/compression.test.ts` (token estimation, summary generation)
- [x] T011 Create `src/recommendations/storage/compression.ts` with functions: `estimateTokens()`, `compressRecommendation()`, `formatEventsVerbatim()`, `loadRecommendationsForContext()` (depends on T010)
- [x] T012 Update `src/recommendations/storage/index.ts` to export compression utilities

**Checkpoint**: Foundation ready
- [ ] All types compile without errors
- [ ] Storage tests pass (CRUD operations)
- [ ] Compression tests pass (token estimation, summary generation)

---

## Phase 3: User Story 1 - Synthesize Recommendations (P1)

**Goal**: Implement subagent that reasons about findings to synthesize recommendations
**Requirements**: FR-001, FR-002

### Tests

- [ ] T013 [P] [US1] Write unit tests for subagent definition in `src/recommendations/__tests__/subagent.test.ts` (prompt structure, tool list)
- [ ] T014 [P] [US1] Write integration tests for spawn_recommendation_advisor tool in `src/recommendations/__tests__/spawn-advisor.test.ts`

### Subagent Implementation

- [ ] T015 [US1] Create `src/recommendations/subagent/types.ts` with RecommendationSubagentInstructions, RecommendationAdvisorContext types
- [ ] T016 [US1] Create `src/recommendations/subagent/recommendation-advisor.ts` with 4-layer context-engineered system prompt (Role → Domain → Task → Output) (depends on T015)
- [ ] T017 [US1] Implement `toAgentDefinition()` factory function following EP08/EP09 pattern in `src/recommendations/subagent/recommendation-advisor.ts` (depends on T016)
- [ ] T018 [US1] Create `src/recommendations/subagent/index.ts` with public exports

### Spawn Tool

- [ ] T019 [US1] Create `src/recommendations/tools/spawn-advisor.ts` implementing `spawn_recommendation_advisor` tool with context building (depends on T017)
- [ ] T020 [US1] Create `src/recommendations/tools/index.ts` with tool exports

**Checkpoint**: US1 complete and independently testable
- [ ] Subagent prompt follows 4-layer structure
- [ ] spawn_recommendation_advisor tool builds context correctly
- [ ] All US1 tests pass

---

## Phase 4: User Story 2 - Create and Store Case (P1)

**Goal**: Create recommendation cases with traced origins and atomic persistence
**Requirements**: FR-003, FR-004

### Tests

- [ ] T021 [P] [US2] Write unit tests for create_recommendation tool in `src/recommendations/__tests__/create-recommendation.test.ts`
- [ ] T022 [P] [US2] Write unit tests for get_recommendation tool in `src/recommendations/__tests__/get-recommendation.test.ts`

### Implementation

- [ ] T023 [US2] Implement `src/recommendations/tools/create-recommendation.ts` with validation, UUID generation, initial 'created' event (depends on T021, T009)
- [ ] T024 [US2] Implement `src/recommendations/tools/get-recommendation.ts` returning full recommendation with all events (depends on T022, T009)
- [ ] T025 [US2] Add create_recommendation and get_recommendation to tool exports in `src/recommendations/tools/index.ts`
- [ ] T026 [US2] Verify atomic write behavior with concurrent access test in `src/recommendations/__tests__/storage.test.ts`

**Checkpoint**: US2 complete and independently testable
- [ ] create_recommendation creates case with UUID, traced origin, initial event
- [ ] get_recommendation returns full case with all events
- [ ] Atomic writes verified
- [ ] All US2 tests pass

---

## Phase 5: User Story 3 - Add Events (P1)

**Goal**: Append events to recommendation cases with validation
**Requirements**: FR-007

### Tests

- [ ] T027 [P] [US3] Write unit tests for add_recommendation_event tool in `src/recommendations/__tests__/add-event.test.ts` (happy path, 200 char limit, nonexistent rec)

### Implementation

- [ ] T028 [US3] Implement `src/recommendations/tools/add-event.ts` with event validation (200 char limit), event type constraints (depends on T027, T009)
- [ ] T029 [US3] Add add_recommendation_event to tool exports in `src/recommendations/tools/index.ts`
- [ ] T030 [P] [US3] Add optional context fields handling (baselineId, sessionId, commitHash) to add-event.ts
- [ ] T031 [US3] Add edge case tests for event types 'created' and 'completed' being system-generated only

**Checkpoint**: US3 complete and independently testable
- [ ] Events append to recommendation
- [ ] 200 char limit enforced
- [ ] Optional context fields captured
- [ ] All US3 tests pass

---

## Phase 6: User Story 4 - Query with Compressed Context (P1)

**Goal**: Query recommendations with filters and compressed summaries within token budget
**Requirements**: FR-005, FR-006

### Tests

- [ ] T032 [P] [US4] Write unit tests for list_recommendations tool in `src/recommendations/__tests__/list-recommendations.test.ts` (filters, limit)
- [ ] T033 [P] [US4] Write unit tests for get_recommendation_summary tool in `src/recommendations/__tests__/get-summary.test.ts`
- [ ] T034 [P] [US4] Write integration test for 8K token budget loading strategy in `src/recommendations/__tests__/compression.test.ts`

### Implementation

- [ ] T035 [US4] Implement `src/recommendations/tools/list-recommendations.ts` with status/type/priority filters, limit parameter (depends on T032)
- [ ] T036 [US4] Implement `src/recommendations/tools/get-recommendation-summary.ts` returning compressed view (depends on T033, T011)
- [ ] T037 [US4] Add list_recommendations and get_recommendation_summary to tool exports
- [ ] T038 [US4] Verify newest-first ordering and budget exhaustion behavior in context loading

**Checkpoint**: US4 complete and independently testable
- [ ] list_recommendations filters correctly
- [ ] get_recommendation_summary returns compressed view < 500 chars
- [ ] Context loading fits within 8K token budget
- [ ] All US4 tests pass

---

## Phase 7: User Story 5 - Refine Recommendation (P2)

**Goal**: Update recommendation fields with audit trail
**Requirements**: FR-009

### Tests

- [ ] T039 [P] [US5] Write unit tests for refine_recommendation tool in `src/recommendations/__tests__/refine-recommendation.test.ts`

### Implementation

- [ ] T040 [US5] Implement `src/recommendations/tools/refine-recommendation.ts` with field updates (action, target, priority) and 'refinement' event creation (depends on T039)
- [ ] T041 [US5] Add refinement event content format: "Action: [old] → [new]" or "Priority: [old] → [new]"
- [ ] T042 [P] [US5] Add validation to prevent refining completed recommendations
- [ ] T043 [US5] Add refine_recommendation to tool exports

**Checkpoint**: US5 complete and independently testable
- [ ] Fields update with audit trail
- [ ] Cannot refine completed recommendations
- [ ] All US5 tests pass

---

## Phase 8: User Story 6 - Complete Recommendation (P2)

**Goal**: Soft-close recommendations with completion reason
**Requirements**: FR-008, FR-010

### Tests

- [ ] T044 [P] [US6] Write unit tests for update_recommendation_status tool in `src/recommendations/__tests__/update-status.test.ts`
- [ ] T045 [P] [US6] Write unit tests for complete_recommendation tool in `src/recommendations/__tests__/complete-recommendation.test.ts`

### Implementation

- [ ] T046 [US6] Implement `src/recommendations/tools/update-status.ts` with state transition validation (depends on T044)
- [ ] T047 [US6] Implement `src/recommendations/tools/complete-recommendation.ts` with completedAt timestamp, completionReason, supersededBy link (depends on T045)
- [ ] T048 [US6] Add update_recommendation_status and complete_recommendation to tool exports

**Checkpoint**: US6 complete and independently testable
- [ ] Status transitions validated
- [ ] Completion reason and supersededBy link captured
- [ ] Completed recommendations excluded from 'open' filter
- [ ] All US6 tests pass

---

## Phase 9: User Story 7 - Clarifying Questions (P2)

**Goal**: Enable subagent to return structured questions for orchestrator to present
**Requirements**: FR-011

### Tests

- [ ] T049 [P] [US7] Write unit tests for ClarifyingQuestion output format in `src/recommendations/__tests__/questions.test.ts`

### Implementation

- [ ] T050 [US7] Add ClarifyingQuestion handling to subagent output parsing in `src/recommendations/subagent/recommendation-advisor.ts` (depends on T049)
- [ ] T051 [P] [US7] Add assumptions tracking to AdvisorOutput when questions not asked
- [ ] T052 [US7] Update subagent prompt with question-asking guidance (when to ask, format)

**Checkpoint**: US7 complete and independently testable
- [ ] Subagent can return questions with options
- [ ] Assumptions tracked when questions skipped
- [ ] All US7 tests pass

---

## Phase 10: Polish

**Goal**: Final integration, documentation, and quality validation

- [ ] T053 [P] Update `src/recommendations/index.ts` with all public exports
- [ ] T054 Register all tools with ToolRegistry in orchestrator
- [ ] T055 [P] Run full test suite, ensure > 80% coverage
- [ ] T056 Validate implementation against `specs/ep10-recommendation-advisor/quickstart.md` scenarios

**Checkpoint**: Feature complete
- [ ] All tests pass (> 80% coverage)
- [ ] All tools registered
- [ ] Quickstart scenarios work

---

## MVP Scope

Minimum viable implementation (P1 stories only):

- **Phase 1: Setup** - T001-T004 (4 tasks)
- **Phase 2: Foundational** - T005-T012 (8 tasks)
- **Phase 3: US1 Synthesize** - T013-T020 (8 tasks)
- **Phase 4: US2 Create/Store** - T021-T026 (6 tasks)
- **Phase 5: US3 Add Events** - T027-T031 (5 tasks)
- **Phase 6: US4 Query/Compress** - T032-T038 (7 tasks)

**Total MVP**: 38 tasks (through US4)
**Full Feature**: 56 tasks

---

## Execution Notes

- Tasks marked `[P]` can run in parallel within their phase
- Complete each phase before starting the next
- Each user story should be deployable after its checkpoint
- Run tests after each checkpoint
- US8 (P3 Automatic Event Compaction) deferred - not in task list; implement if time permits

---

## Deferred Tasks (P3)

The following P3 requirements are not included in the task list:

- **FR-012**: `summarize_recommendation_history` tool for manual compaction
- **FR-013**: Automatic compaction when events exceed threshold

These can be added in a follow-up if needed.
