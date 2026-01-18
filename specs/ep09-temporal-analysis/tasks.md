# Tasks: EP09 Temporal Analysis

**Input**: Design documents from `/specs/ep09-temporal-analysis/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Following ADR-0011 testing strategy:
- **Unit tests**: Co-located in `src/**/__tests__/` (every commit, mocked)
- **VCR integration tests**: In `tests/integration/` with recordings (PRs)
- **TruLens evals**: In `tests/evals/` for behavioral quality (releases)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, dependencies, and directory structure

- [ ] T001 Add jsondiffpatch dependency via `bun add jsondiffpatch`
- [ ] T002 [P] Create temporal module directory structure: `src/temporal/{delta,trends,qualitative,tools}/`
- [ ] T003 [P] Create persistence reviews directory: `src/persistence/reviews/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core types and shared infrastructure that MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Create temporal types in `src/temporal/types.ts` - copy from contracts/temporal-types.ts, adapt imports
- [ ] T005 [P] Create temporal error types in `src/temporal/errors.ts` - TemporalError, InsufficientDataError, BaselineNotFoundError
- [ ] T006 [P] Create threshold configuration in `src/temporal/config.ts` - ThresholdConfig loading from ~/.agentlint/config.json
- [ ] T007 Extend BaselineMetrics in `src/persistence/types.ts` with ExtendedBaselineMetrics fields (avgTokensPerSession, warningCount, etc.)
- [ ] T008 Create SQLite schema migration for reviews in `src/persistence/reviews/schema.sql` - qualitative_reviews and recommendation_tracking tables
- [ ] T009 Implement review storage in `src/persistence/reviews/storage.ts` - saveReview, loadReview, deleteReview with atomic writes
- [ ] T010 Implement review indexer in `src/persistence/reviews/indexer.ts` - SQLite CRUD matching baselines/indexer.ts pattern
- [ ] T011 Create temporal module exports in `src/temporal/index.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Establish Baseline Snapshot (Priority: P1) 🎯 MVP

**Goal**: Capture point-in-time workflow state as baseline with full metrics

**Independent Test**: `agentlint baseline --label "Test"` creates baseline with timestamp and metrics

### Implementation for US-001

- [ ] T012 [US1] Implement store_baseline tool in `src/temporal/tools/store-baseline.ts` using StoreBaselineInputSchema from contracts
- [ ] T013 [US1] Add git commit extraction utility in `src/temporal/utils/git.ts` - getCurrentCommit() using simple-git or shell
- [ ] T014 [US1] Register store_baseline in tool registry `src/tools/index.ts`
- [ ] T015 [US1] Add unit tests for store_baseline in `src/temporal/tools/__tests__/store-baseline.test.ts`

**Checkpoint**: User Story 1 complete - baselines can be captured with labels and git refs

---

## Phase 4: User Story 2 - Compare Current State to Baseline (Priority: P1) 🎯 MVP

**Goal**: Calculate structured delta between baselines with trend indicators

**Independent Test**: `agentlint compare` shows ↑↓→ indicators with percentages

### Implementation for US-002

- [ ] T016 [P] [US2] Implement jsondiffpatch wrapper in `src/temporal/delta/calculator.ts` - calculateDelta(from, to)
- [ ] T017 [P] [US2] Implement delta summarizer in `src/temporal/delta/summarizer.ts` - createDeltaSummary(delta, thresholds)
- [ ] T018 [US2] Implement trend indicator calculation in `src/temporal/delta/trends.ts` - getTrendIndicator(from, to, threshold)
- [ ] T019 [US2] Implement query_baseline tool in `src/temporal/tools/query-baseline.ts` using QueryBaselineInputSchema
- [ ] T020 [US2] Implement list_baselines tool in `src/temporal/tools/list-baselines.ts` using ListBaselinesInputSchema
- [ ] T021 [US2] Implement calculate_delta tool in `src/temporal/tools/calculate-delta.ts` using CalculateDeltaInputSchema
- [ ] T022 [US2] Register query_baseline, list_baselines, calculate_delta in tool registry
- [ ] T023 [US2] Add unit tests for delta calculation in `src/temporal/delta/__tests__/calculator.test.ts`

**Checkpoint**: User Stories 1 AND 2 complete - baselines can be stored and compared

---

## Phase 4.5: VCR Integration Tests - Delta & Baseline (ADR-0011)

**Purpose**: Record API interactions for deterministic CI testing

- [ ] T023a [P] Create VCR recording infrastructure in `tests/lib/vcr.ts` - playback/record modes per ADR-0011
- [ ] T023b [P] Create VCR test utilities in `tests/lib/fixtures.ts` - sample baselines, expected outputs
- [ ] T023c Record baseline storage flow in `tests/integration/recordings/baseline-storage.json`
- [ ] T023d Record delta calculation scenarios in `tests/integration/recordings/delta-calculation.json`
- [ ] T023e Create VCR integration test in `tests/integration/temporal/delta-flow.test.ts`

**Note**: Run `bun run record` to capture recordings, then commit recordings with tests.

---

## Phase 5: User Story 3 - Query Trends Across Baselines (Priority: P1) 🎯 MVP

**Goal**: Analyze trends across 3+ baselines with direction and slope

**Independent Test**: `agentlint trends` shows improving/degrading/stable patterns

### Implementation for US-003

- [ ] T024 [P] [US3] Implement metric aggregator in `src/temporal/trends/aggregator.ts` - aggregateMetrics(baselines[])
- [ ] T025 [P] [US3] Implement linear regression utility in `src/temporal/trends/regression.ts` - calculateSlope(points[])
- [ ] T026 [US3] Implement MetricTrend calculation in `src/temporal/trends/metric-trend.ts` - getMetricTrend(values, thresholds)
- [ ] T027 [US3] Implement TrendAnalysis builder in `src/temporal/trends/analysis.ts` - buildTrendAnalysis(baselines[], options)
- [ ] T028 [US3] Implement query_trends tool in `src/temporal/tools/query-trends.ts` using QueryTrendsInputSchema
- [ ] T029 [US3] Register query_trends in tool registry
- [ ] T030 [US3] Add unit tests for trend analysis in `src/temporal/trends/__tests__/analysis.test.ts`

**Checkpoint**: User Stories 1, 2, AND 3 complete - full quantitative temporal analysis working

---

## Phase 6: User Story 4 - Conduct Qualitative Review Session (Priority: P1) 🎯 MVP

**Goal**: Agent-guided structured qualitative review with 6 dimensions and Likert scoring

**Independent Test**: `agentlint review` prompts through dimensions, stores review with sentiment

### Implementation for US-004

- [ ] T031 [P] [US4] Define review dimensions in `src/temporal/qualitative/dimensions.ts` - 6 dimensions with promptText
- [ ] T032 [P] [US4] Implement sentiment calculation in `src/temporal/qualitative/sentiment.ts` - calculateOverallSentiment(dimensions[])
- [ ] T033 [US4] Implement review session handler in `src/temporal/qualitative/review.ts` - ReviewSession class with state machine
- [ ] T034 [US4] Implement conduct_review tool in `src/temporal/tools/conduct-review.ts` using ConductReviewInputSchema
- [ ] T035 [US4] Implement get_review_history tool in `src/temporal/tools/get-review-history.ts` using GetReviewHistoryInputSchema
- [ ] T036 [US4] Register conduct_review, get_review_history in tool registry
- [ ] T037 [US4] Add unit tests for qualitative review in `src/temporal/qualitative/__tests__/review.test.ts`

**Checkpoint**: All P1 User Stories (1-4) complete - MVP delivered with quantitative AND qualitative analysis

---

## Phase 6.5: VCR Integration Tests - Trends & Qualitative (ADR-0011)

**Purpose**: Record agent-guided qualitative review interactions for deterministic testing

- [x] T037a Record trend analysis flow in `tests/integration/recordings/trend-analysis.json`
- [x] T037b Record qualitative review session in `tests/integration/recordings/qualitative-review.json`
- [x] T037c Create VCR integration test for trends in `tests/integration/temporal/trends-flow.test.ts`
- [x] T037d Create VCR integration test for reviews in `tests/integration/temporal/review-flow.test.ts`

**Note**: Qualitative review involves agent prompts - VCR ensures deterministic replay.

---

## Phase 6.6: Architectural Correction (ADR-0019)

**Purpose**: Correct tool/agent boundary drift per Constitution Principles IV (Mixed-Methods) and VII (Intelligent Tooling)

**Checkpoint**: Tools return data + evidence; agent provides judgment

### Tool/Agent Boundary Refactoring

- [x] T037e Create ADR-0019: Tool/Agent Boundary for Temporal Analysis in `docs/architecture/adr/0019-tool-agent-boundary-temporal.md`
- [x] T037f Update types.ts: Remove `isImprovement` from `MetricChange`, replace `overallTrend` with `changeCounts`, add `rSquared`/`volatility` to `MetricTrend`
- [x] T037g Refactor config.ts: Remove `isImprovement()` function (judgment)
- [x] T037h Refactor dimensions.ts: Remove `positiveIndicators`/`negativeIndicators` arrays
- [x] T037i Refactor sentiment.ts: Remove `getSentimentLabel()`, `getSentimentEmoji()`, `analyzeSentimentIndicators()`
- [x] T037j Refactor regression.ts: Remove `classifyTrend()` function
- [x] T037k Refactor metric-trend.ts: Return `slope`, `rSquared`, `volatility` instead of `direction`
- [x] T037l Refactor summarizer.ts: Remove `determineOverallTrend()`, return `changeCounts`
- [x] T037m Refactor detector.ts: `detectImplementation()` → `extractMatchEvidence()` (returns evidence, not judgment)
- [x] T037n Update all tests for new return shapes in `__tests__/` and `tests/integration/temporal/`

**Reference**: ADR-0019 documents the decision and rationale.

---

## Phase 7: User Story 5 - Track Recommendation Implementation (Priority: P2)

**Goal**: Detect and track recommendation implementations with effectiveness scoring

**Independent Test**: After implementing recommendation, system detects change and prompts for confirmation

### Implementation for US-005

- [x] T038 [P] [US5] Create recommendation tracking types in `src/temporal/tracking/types.ts` - RecommendationTracking, RecommendationStatus
- [x] T039 [P] [US5] Implement tracking storage in `src/temporal/tracking/storage.ts` - saveTracking, loadTracking, updateStatus
- [x] T040 [US5] Implement evidence extraction in `src/temporal/tracking/detector.ts` - extractMatchEvidence() returns evidence array per ADR-0019
- [x] T041 [US5] Implement baseline pair provider in `src/temporal/tracking/effectiveness.ts` - getEffectivenessData(preBaseline, postBaseline) returns data for agent judgment
- [ ] T042 [US5] Create track_recommendation tool in `src/temporal/tools/track-recommendation.ts`
- [ ] T043 [US5] Register track_recommendation in tool registry

**Checkpoint**: User Story 5 complete - recommendation tracking with auto-detect + confirm

---

## Phase 8: User Story 6 - Correlate Changes with Git History (Priority: P2)

**Goal**: Link metric changes to git commits for causal understanding

**Independent Test**: Delta shows "likely caused by commit abc123: Updated CLAUDE.md"

### Implementation for US-006

- [ ] T044 [P] [US6] Implement git history fetcher in `src/temporal/correlation/git-history.ts` - getCommitsBetween() returns commit metadata per ADR-0019
- [ ] T045 [P] [US6] Implement commit metadata extractor in `src/temporal/correlation/categorizer.ts` - getCommitMetadata(commit) returns data for agent categorization
- [ ] T046 [US6] Implement inflection point detector in `src/temporal/trends/inflection.ts` - returns slope change points per ADR-0019
- [ ] T047 [US6] Implement correlation builder in `src/temporal/correlation/correlator.ts` - correlateWithCommits(delta, commits)
- [ ] T048 [US6] Add includeGitCommits option to calculate_delta tool
- [ ] T049 [US6] Add correlatedCommits to query_trends tool

**Checkpoint**: User Story 6 complete - changes linked to git history

---

## Phase 9: User Story 7 - Analyze Qualitative Trends (Priority: P2)

**Goal**: Sentiment trends across reviews with alignment/divergence detection

**Independent Test**: Qualitative trends show improving friction perception aligned with iteration reduction

### Implementation for US-007

- [ ] T050 [P] [US7] Implement qualitative aggregator in `src/temporal/qualitative/aggregator.ts` - aggregateReviews(reviews[])
- [ ] T051 [P] [US7] Implement sentiment trend calculation in `src/temporal/qualitative/trend.ts` - returns slope and values per ADR-0019
- [ ] T052 [US7] Implement divergence calculator in `src/temporal/qualitative/alignment.ts` - returns divergence metrics per ADR-0019
- [ ] T053 [US7] Implement theme extractor in `src/temporal/qualitative/themes.ts` - extractThemes(reviews[])
- [x] T054 [US7] Track review trigger in review metadata (triggerReason field queryable in get_review_history)
- [x] T055 [US7] Add triggered review tests (tests for trigger conditions, configuration, and tracking)

**Checkpoint**: User Story 7 complete - qualitative trends with mixed-methods validation

---

## Phase 10: User Story 8 - Generate Periodic Review Reminders (Priority: P3)

**Goal**: Configurable review reminders surfaced at appropriate intervals

**Independent Test**: After 30 days without review, agent prompts for qualitative review

### Implementation for US-008

- [x] T056 [P] [US8] Define TemporalSubagent interface in `src/temporal/subagent/types.ts` following EP08 pattern
- [x] T057 [P] [US8] Implement temporal subagent in `src/temporal/subagent/temporal-subagent.ts` with depth limit per C8
- [x] T058 [US8] Create spawn_temporal_analyst tool in `src/temporal/tools/spawn-analyst.ts` with configurable focus
- [x] T059 [US8] Register spawn_temporal_analyst in temporal module (completed as part of T058)
- [x] T060 [US8] Add subagent tests (completed as part of T056/T057, 50 tests with 100% coverage)

**Checkpoint**: User Story 8 complete - review reminders and temporal subagent working

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

### Configuration & Optimization

- [x] T061 [P] Add configurable significance thresholds (ThresholdConfig in types.ts, config in ~/.agentlint/config.json)
- [x] T062 [P] Optimize SQLite queries for large baseline sets (indexes, lazy-load, <2s on 50 baselines)

### TruLens Behavioral Evals (ADR-0011/0012)

- [x] T068 [P] Create TruLens eval config in `tests/evals/trulens.config.py` - actionability, causal accuracy rubrics
- [x] T069 [P] Create golden dataset scenarios in `tests/evals/golden/temporal/` - trend analysis, qualitative review
- [x] T070 Create trend analysis quality eval in `tests/evals/behavioral/trend-quality.test.ts` - validates trend detection accuracy
- [x] T071 Create qualitative review eval in `tests/evals/behavioral/review-quality.test.ts` - validates prompt quality, sentiment extraction
- [x] T072 Create mixed-methods alignment eval in `tests/evals/behavioral/alignment-quality.test.ts` - validates quant/qual divergence detection

### Final Validation

- [x] T073 Configure test coverage reporting and verify > 80% threshold per spec success criteria (scripts/check-coverage.ts, 95.11% core coverage)
- [x] T074 Add E2E test for full temporal workflow in `tests/e2e/temporal/workflow-live.test.ts`
- [ ] T075 Validate quickstart.md examples work end-to-end
- [ ] T076 Add temporal tools to CLI help output

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phases 3-10)**: All depend on Foundational phase completion
  - P1 stories (US1-US4) can proceed in sequence or parallel
  - P2 stories (US5-US7) can start after P1 complete
  - P3 story (US8) can start after P2 complete
- **Polish (Phase 11)**: Depends on all desired user stories being complete

### User Story Dependencies

| Story | Priority | Dependencies | Can Parallelize After |
|-------|----------|--------------|----------------------|
| US-001 (Baseline) | P1 | Foundation only | Foundation |
| US-002 (Delta) | P1 | US-001 (needs baselines to compare) | US-001 |
| US-003 (Trends) | P1 | US-002 (builds on delta) | US-002 |
| US-004 (Qualitative) | P1 | Foundation only | Foundation |
| US-005 (Tracking) | P2 | US-002, US-004 | US-004 |
| US-006 (Git Correlation) | P2 | US-002, US-003 | US-003 |
| US-007 (Qual Trends) | P2 | US-003, US-004 | US-004 |
| US-008 (Reminders) | P3 | US-004 | US-007 |

### Within Each User Story

- Types/schemas before implementations
- Core logic before tools
- Tools before registry integration
- Implementation before tests

### Parallel Opportunities

```
Foundation complete:
├── US-001 (Baseline) ─────────────────────────────┐
│                                                  │
└── US-004 (Qualitative) ─────────────────────────┼─────┐
                                                   │     │
After US-001:                                      │     │
├── US-002 (Delta) ────────────────────────────────┤     │
                                                   │     │
After US-002:                                      │     │
├── US-003 (Trends) ───────────────────────────────┤     │
                                                   │     │
After US-003 + US-004:                             │     │
├── US-006 (Git Correlation) ──────────────────────┤     │
├── US-007 (Qual Trends) ──────────────────────────┘     │
├── US-005 (Tracking) ───────────────────────────────────┘

After US-007:
└── US-008 (Reminders)
```

---

## MVP Scope Calculation

### MVP (P1 + VCR Tests): 46 tasks

| Phase | Tasks | Description |
|-------|-------|-------------|
| Phase 1: Setup | 3 | Dependencies and directory structure |
| Phase 2: Foundation | 8 | Types, config, storage, indexing |
| Phase 3: US-001 | 4 | Baseline capture |
| Phase 4: US-002 | 8 | Delta calculation and comparison |
| Phase 4.5: VCR (Delta) | 5 | VCR infrastructure + recordings |
| Phase 5: US-003 | 7 | Trend analysis |
| Phase 6: US-004 | 7 | Qualitative reviews |
| Phase 6.5: VCR (Trends/Qual) | 4 | VCR recordings for trends + reviews |
| **Total MVP** | **46** | |

### Full Implementation: 76 tasks

| Scope | Tasks | Cumulative |
|-------|-------|------------|
| MVP (P1 + VCR) | 46 | 46 |
| P2 (US5-7) | 18 | 64 |
| P3 (US8) | 5 | 69 |
| Polish + Evals | 16 | 85 |

**Note**: Task count increased to properly address ADR-0011 test strategy (VCR integration, TruLens evals).

---

## Implementation Strategy

### MVP First (Recommended)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phases 3-4: US-001 + US-002 (baseline + delta)
4. Complete Phase 4.5: VCR infrastructure + delta recordings
5. **STOP and VALIDATE**: Test baseline capture and comparison with VCR
6. Complete Phases 5-6: US-003 + US-004 (trends + qualitative)
7. Complete Phase 6.5: VCR recordings for trends + reviews
8. **MVP COMPLETE**: Full mixed-methods temporal analysis with deterministic CI

### Incremental Delivery

1. Setup + Foundation → Framework ready
2. Add US-001 → Baselines can be captured
3. Add US-002 + VCR → Baselines can be compared (with CI coverage)
4. Add US-003 → Trends visible across time
5. Add US-004 + VCR → Qualitative reviews integrated (MVP!)
6. Add US-005/6/7 → Tracking, correlation, qual trends
7. Add US-008 → Reminders
8. Polish → Subagent, performance, TruLens evals, E2E tests

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All tools follow ADR-0005 pattern with Zod schemas
- Use contracts/temporal-tools.ts as source of truth for tool schemas

### Test Strategy (ADR-0011)

| Test Type | Location | When Run | Purpose |
|-----------|----------|----------|---------|
| Unit | `src/**/__tests__/*.test.ts` | Every commit | Component logic, mocked |
| VCR Integration | `tests/integration/temporal/` | Every PR | Recorded API responses |
| E2E | `tests/e2e/temporal-*.test.ts` | Release tags | Live full workflow |
| TruLens Evals | `tests/evals/behavioral/` | Release tags | Behavioral quality |

**VCR Workflow** (per ADR-0011 §4.3):
1. Run `bun run record` to capture new recordings
2. Review recordings for sanity (no secrets)
3. Commit code + recordings together
4. CI fails if recordings are missing or stale

**TruLens Evals** (per ADR-0012):
- Evaluate trend detection accuracy against golden dataset
- Evaluate qualitative prompt quality (non-leading)
- Evaluate mixed-methods alignment detection
