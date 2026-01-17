# Tasks: Causal Tracing Engine

> **Epic**: EP07
> **Generated**: 2026-01-17
> **Updated**: 2026-01-17
> **Total Tasks**: 60
> **MVP Tasks**: 34

---

## Summary

| Phase | Tasks | Parallelizable |
|-------|-------|----------------|
| Setup | 4 | 3 |
| Foundational | 8 | 4 |
| US1: Trace Issue to Session Origin (P1) | 13 | 6 |
| US2: Identify Configuration Gap (P1) | 9 | 4 |
| US3: Construct Evidence Chain (P1) | 6 | 3 |
| US4: Recognize Recurring Patterns (P2) | 10 | 5 |
| US5: Generate Counterfactual Analysis (P2) | 4 | 2 |
| US6: Assess Confidence Levels (P3) | 2 | 1 |
| Polish | 4 | 2 |

---

## Phase 1: Setup

**Goal**: Initialize causal tracing module structure

- [ ] T001 [P] Create directory structure: `src/tools/causal/` and `src/persistence/causal/`
- [ ] T002 [P] Create directory structure: `tests/unit/tools/causal/` and `tests/integration/causal/`
- [ ] T003 [P] Copy Zod schemas from `specs/ep07-causal-tracing-engine/contracts/types.ts` to `src/tools/causal/types.ts`
- [ ] T004 Create module index exports in `src/tools/causal/index.ts` and `src/persistence/causal/index.ts`

**Checkpoint**: Setup complete
- [ ] All directories created
- [ ] Types compile without errors

---

## Phase 2: Foundational

**Goal**: Core infrastructure for causal chains

### Schema

- [ ] T005 Create SQLite schema for causal chains in `src/persistence/causal/schema.ts`
- [ ] T006 Add schema migration to extend EP06 sessions.db with causal tables (version 2)

### Persistence Operations

- [ ] T007 [P] Implement `insertChain()` in `src/persistence/causal/queries.ts`
- [ ] T008 [P] Implement `getChainById()` in `src/persistence/causal/queries.ts`
- [ ] T009 [P] Implement `getChainsByProject()` in `src/persistence/causal/queries.ts`
- [ ] T010 [P] Implement `insertPattern()` and `getPatternsByProject()` in `src/persistence/causal/queries.ts`

### Tests

- [ ] T011 Unit tests for schema creation in `tests/unit/persistence/causal/schema.test.ts`
- [ ] T012 Unit tests for chain CRUD operations in `tests/unit/persistence/causal/queries.test.ts`

**Checkpoint**: Foundation ready
- [ ] All CRUD operations pass tests
- [ ] Schema migration applies cleanly

---

## Phase 3: User Story 1 - Trace Issue to Session Origin (P1)

**Goal**: Trace detected issues back to originating session prompts
**Requirements**: FR-CT-001, FR-CT-002, FR-CT-003, FR-CT-004, FR-CT-016

### Tests (write first)

- [ ] T013 [P] [US1] Unit test for session evidence collection in `tests/unit/tools/causal/evidence-collector.test.ts`
- [ ] T014 [P] [US1] Unit test for temporal sorting in `tests/unit/tools/causal/evidence-collector.test.ts`
- [ ] T015 [P] [US1] Integration test for `trace_issue_origin` tool in `tests/integration/causal/trace-issue.test.ts`

### Implementation

- [ ] T016 [US1] Create `EvidenceCollector` class in `src/tools/causal/evidence-collector.ts`
- [ ] T017 [US1] Implement `collectSessionEvidence()` method using EP06 `searchSessions()` (depends on T016)
- [ ] T018 [US1] Implement temporal extraction and position markers (depends on T017)
- [ ] T019 [US1] Create `trace_issue_origin` SDK tool definition in `src/tools/causal/trace-issue-tool.ts` (depends on T016)
- [ ] T020 [US1] Implement tool handler that queries FTS5 and builds TracedIssue (depends on T019)
- [ ] T021 [US1] Format tool output for agent consumption (depends on T020)
- [ ] T022 [US1] Register tool in `src/tools/causal/index.ts` exports (depends on T019)

### Git Correlation (P2 Enhancement)

- [ ] T053 [P] [US1] Unit test for git evidence collection in `tests/unit/tools/causal/git-evidence.test.ts`
- [ ] T054 [US1] Implement `GitEvidenceCollector` with git blame/pickaxe in `src/tools/causal/git-evidence.ts`
- [ ] T055 [US1] Integrate git evidence into EvidenceCollector (depends on T016, T054)

**Checkpoint**: US1 complete and independently testable
- [ ] Tool returns valid TracedIssue for test fixtures
- [ ] FTS5 queries return ranked session matches
- [ ] Position markers (file:line) included in evidence
- [ ] Git blame evidence collected when available (P2)

---

## Phase 4: User Story 2 - Identify Configuration Gap (P1)

**Goal**: Analyze what missing configuration guidance enabled an issue
**Requirements**: FR-CT-004a, FR-CT-005

### Tests (write first)

- [ ] T023 [P] [US2] Unit test for gap identification in `tests/unit/tools/causal/gap-analyzer.test.ts`
- [ ] T024 [P] [US2] Unit test for gap categorization in `tests/unit/tools/causal/gap-analyzer.test.ts`

### Implementation

- [ ] T025 [US2] Create `GapAnalyzer` class in `src/tools/causal/gap-analyzer.ts`
- [ ] T026 [US2] Implement `identifyGap()` method that analyzes configuration state (depends on T025)
- [ ] T027 [US2] Implement gap type classification (missing_config, missing_example, etc.) (depends on T026)
- [ ] T028 [US2] Integrate gap analysis into `trace_issue_origin` tool (depends on T020, T027)

### Config State Capture (P2 Enhancement)

- [ ] T056 [P] [US2] Unit test for config state snapshot in `tests/unit/tools/causal/config-snapshot.test.ts`
- [ ] T057 [US2] Implement `captureConfigState()` to snapshot config at issue time in `src/tools/causal/config-snapshot.ts`
- [ ] T058 [US2] Integrate config snapshot into gap analysis (depends on T025, T057)

**Checkpoint**: US2 complete and independently testable
- [ ] Gap analysis returns structured Gap object
- [ ] All 6 gap types can be classified
- [ ] Gap location correctly identifies CLAUDE.md, settings.json, etc.
- [ ] Config state captured at issue time (P2)

---

## Phase 5: User Story 3 - Construct Evidence Chain (P1)

**Goal**: Build structured causal chains from trigger to effect
**Requirements**: FR-CT-006, FR-CT-007, FR-CT-014

### Tests (write first)

- [ ] T029 [P] [US3] Unit test for chain construction in `tests/unit/tools/causal/chain-builder.test.ts`
- [ ] T030 [P] [US3] Unit test for depth limiting in `tests/unit/tools/causal/chain-builder.test.ts`

### Implementation

- [ ] T031 [US3] Create `ChainBuilder` class in `src/tools/causal/chain-builder.ts`
- [ ] T032 [US3] Implement `buildChain()` method with trigger → gap → mechanism → effect structure (depends on T031)
- [ ] T033 [US3] Implement depth limiting (max 5) with `depthLimitReached` flag (depends on T032)
- [ ] T034 [US3] Integrate chain building into `trace_issue_origin` tool (depends on T020, T032)

**Checkpoint**: US3 complete and independently testable
- [ ] Chains have complete structure (trigger, gap, mechanism, effect)
- [ ] Depth limiting works at 5 steps
- [ ] Chains persist to SQLite

---

## Phase 6: User Story 4 - Recognize Recurring Patterns (P2)

**Goal**: Identify recurring issue patterns across sessions
**Requirements**: FR-CT-010, FR-CT-011, FR-CT-012, FR-CT-013, FR-CT-015

### Tests (write first)

- [ ] T035 [P] [US4] Unit test for pattern detection in `tests/unit/tools/causal/pattern-detector.test.ts`
- [ ] T036 [P] [US4] Unit test for systemic classification in `tests/unit/tools/causal/pattern-detector.test.ts`
- [ ] T037 [P] [US4] Integration test for `get_issue_patterns` tool in `tests/integration/causal/get-patterns.test.ts`

### Implementation

- [ ] T038 [US4] Create `PatternDetector` class in `src/tools/causal/pattern-detector.ts`
- [ ] T039 [US4] Implement pattern clustering by root cause category (depends on T038)
- [ ] T040 [US4] Implement systemic classification (frequency ≥ 3) (depends on T039)
- [ ] T041 [US4] Create `get_issue_patterns` SDK tool in `src/tools/causal/get-patterns-tool.ts` (depends on T038)
- [ ] T042 [US4] Register pattern tool in exports (depends on T041)

### Frequency/Severity Tracking (P3 Enhancement)

- [ ] T059 [P] [US4] Unit test for frequency/severity tracking in `tests/unit/tools/causal/pattern-tracking.test.ts`
- [ ] T060 [US4] Implement frequency and severity tracking over time in `src/tools/causal/pattern-tracking.ts` (depends on T038)

**Checkpoint**: US4 complete and independently testable
- [ ] Patterns aggregate chains by category
- [ ] Systemic flag set correctly
- [ ] Tool returns IssuePattern array
- [ ] Frequency and severity tracked over time (P3)

---

## Phase 7: User Story 5 - Generate Counterfactual Analysis (P2)

**Goal**: Produce "if X, then Y wouldn't have occurred" analysis
**Requirements**: FR-CT-009

### Tests (write first)

- [ ] T043 [P] [US5] Unit test for counterfactual generation in `tests/unit/tools/causal/counterfactual.test.ts`

### Implementation

- [ ] T044 [US5] Implement `generateCounterfactual()` in `src/tools/causal/counterfactual.ts`
- [ ] T045 [US5] Integrate counterfactual into chain building (depends on T032, T044)
- [ ] T046 [US5] Add counterfactual to tool output (depends on T020, T045)

**Checkpoint**: US5 complete and independently testable
- [ ] Counterfactual follows "If [X], then [Y] would not have occurred" format
- [ ] Counterfactual references specific gap

---

## Phase 8: User Story 6 - Assess Confidence Levels (P3)

**Goal**: Explicit 6-factor confidence scoring
**Requirements**: FR-CT-008

### Tests (write first)

- [ ] T047 [P] [US6] Unit test for confidence scoring in `tests/unit/tools/causal/confidence.test.ts`

### Implementation

- [ ] T048 [US6] Implement `computeConfidence()` with 6-factor checklist in `src/tools/causal/confidence.ts` (uses existing helper from types.ts)

**Checkpoint**: US6 complete
- [ ] All 6 factors evaluated (specificity, temporal, mechanistic, evidenceQuality, reproducibility, alternatives)
- [ ] Levels correctly mapped (high ≥5, medium 3-4, low <3)

---

## Phase 9: Polish

**Goal**: Documentation, error handling, performance validation

- [ ] T049 [P] Add comprehensive error handling for FTS index not initialized
- [ ] T050 [P] Add error handling for stale index (warn, return partial)
- [ ] T051 Integration test validating quickstart.md scenarios in `tests/integration/causal/quickstart.test.ts`
- [ ] T052 Performance test: single trace < 5s, pattern detection < 30s in `tests/performance/causal.test.ts`

**Checkpoint**: Polish complete
- [ ] All quickstart scenarios work
- [ ] Performance targets met
- [ ] Error handling graceful

---

## MVP Scope

Minimum viable implementation (P1 stories only):

- **Phase 1: Setup** (T001-T004): 4 tasks
- **Phase 2: Foundational** (T005-T012): 8 tasks
- **Phase 3: US1 - Trace Issue** (T013-T022): 10 tasks
- **Phase 4: US2 - Identify Gap** (T023-T028): 6 tasks
- **Phase 5: US3 - Construct Chain** (T029-T034): 6 tasks

**Total MVP**: 34 tasks

**Full Feature** (all stories): 60 tasks

---

## Execution Notes

- Tasks marked `[P]` can run in parallel within their phase
- Complete each phase before starting the next
- Each user story should be testable after its checkpoint
- Run `bun test` after each checkpoint
- US1-US3 form the MVP - US4-US6 are enhancements
- EP06 FTS5 index must be available for testing (run `agentlint sessions --index` on test fixtures)

---

## Dependencies

| Task | Depends On | Reason |
|------|------------|--------|
| T004 | T001-T003 | Module exports need files to export |
| T006 | T005 | Migration applies schema |
| T017 | T016 | Method needs class |
| T020 | T019 | Handler needs tool definition |
| T028 | T020, T027 | Integration requires both components |
| T034 | T020, T032 | Integration requires both components |
| T055 | T016, T054 | Git evidence integrates into EvidenceCollector |
| T058 | T025, T057 | Config snapshot integrates into GapAnalyzer |
| T060 | T038 | Tracking depends on PatternDetector |

---

## Test Fixtures Required

Create test fixtures in `tests/fixtures/causal/`:
- `sample-session.jsonl` - Session with traceable issue
- `sessions.db` - Pre-indexed database with test sessions
- `expected-chain.json` - Expected output for validation
