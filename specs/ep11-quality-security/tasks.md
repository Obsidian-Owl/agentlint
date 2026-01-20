# Tasks: Quality & Security

> **Epic**: EP11
> **Generated**: 2026-01-20
> **Total Tasks**: 66
> **MVP Tasks**: 50

---

## Summary

| Phase | Tasks | Parallelizable | User Stories |
|-------|-------|----------------|--------------|
| Setup | 6 | 4 | - |
| Foundational | 8 | 4 | - |
| US1: Debug Mode | 10 | 4 | US-001 |
| US4: Secret Detection | 10 | 4 | US-004 |
| US2: E2E Testing | 8 | 4 | US-002 |
| US3: LLM Evaluation | 8 | 3 | US-003 |
| US5/US6: Session & Verbose | 7 | 3 | US-005, US-006 |
| US7: Outcome Tracking | 5 | 2 | US-007 |
| Polish | 4 | 2 | - |

---

## Phase 1: Setup

**Goal**: Initialize EP11 directory structure and dependencies

- [x] T001 [P] Create `src/debug/` directory structure per plan.md
- [x] T002 [P] Create `src/security/` directory structure per plan.md
- [x] T003 [P] Create `src/eval/` directory structure per plan.md
- [x] T004 [P] Create `tests/evals/golden/` directory structure per plan.md
- [x] T005 Add `@types/toml` dev dependency to package.json
- [x] T006 Add TruLens Python requirements to `tests/evals/requirements.txt`

**Checkpoint**: Setup complete
- [ ] All directories exist
- [ ] Dependencies installed

---

## Phase 2: Foundational

**Goal**: Core types and utilities shared across all user stories

### Types

- [x] T007 [P] Create type exports in `src/debug/types.ts` per contracts/debug.ts
- [x] T008 [P] Create type exports in `src/security/types.ts` per contracts/secrets.ts
- [x] T009 [P] Create type exports in `src/eval/types.ts` per contracts/eval.ts
- [x] T010 [P] Create type exports in `src/orchestration/checkpoint-types.ts` per contracts/checkpoint.ts

### Utilities

- [x] T011 Create namespace constants in `src/debug/namespaces.ts` per DEBUG_NAMESPACES
- [x] T012 Create entropy calculation in `src/security/entropy.ts` per calculateEntropy function
- [x] T013 Create redaction utilities in `src/debug/redaction.ts` per createRedactedPlaceholder
- [x] T014 Create score calculation in `src/eval/scoring.ts` per calculateOverallScore

**Checkpoint**: Foundation ready
- [ ] All types compile without errors
- [ ] Unit tests for entropy calculation pass
- [ ] Unit tests for redaction utilities pass

---

## Phase 3: User Story 1 - Debug Mode (P1)

**Goal**: Comprehensive debug mode with namespace-based filtering
**Requirements**: FR-001, FR-002, FR-003, FR-004, FR-005

### Tests (write first)

- [x] T015 [P] [US1] Unit test for DebugLogger in `tests/unit/debug/logger.test.ts`
- [x] T016 [P] [US1] Unit test for namespace filtering in `tests/unit/debug/namespaces.test.ts`
- [x] T017 [P] [US1] Unit test for redaction in `tests/unit/debug/redaction.test.ts`
- [x] T018 [P] [US1] Integration test for CLI flags in `tests/integration/debug-cli.test.ts`

### Implementation

- [x] T019 [US1] Implement DebugLogger class in `src/debug/logger.ts` (depends on T011, T013)
- [x] T020 [US1] Implement namespaced child logger in `src/debug/logger.ts`
- [x] T021 [US1] Implement file output in `src/debug/logger.ts` (depends on T019)
- [x] T022 [US1] Add CLI flags (--verbose, --debug, --quiet, --log-file) to `src/cli/program.ts` (depends on T019)
- [x] T023 [US1] Integrate DebugLogger with existing orchestration in `src/orchestration/orchestrator.ts`
- [x] T024 [US1] Create public exports in `src/debug/index.ts`

**Checkpoint**: US1 complete and independently testable
- [ ] `DEBUG=agentlint:*` shows all debug output
- [ ] `--verbose` shows tool invocations
- [ ] `--quiet` suppresses non-error output
- [ ] `--log-file` writes to file
- [ ] Secrets are redacted in all output paths

---

## Phase 4: User Story 4 - Secret Detection (P1)

**Goal**: Pattern-based secret detection with LLM validation
**Requirements**: FR-013, FR-014, FR-015

### Tests (write first)

- [x] T025 [P] [US4] Unit test for pattern matching in `tests/unit/security/detector.test.ts`
- [x] T026 [P] [US4] Unit test for entropy scoring in `tests/unit/security/entropy.test.ts`
- [x] T027 [P] [US4] Unit test for classification in `tests/unit/security/classifier.test.ts`
- [x] T028 [P] [US4] Integration test with VCR for LLM validation in `tests/integration/secrets-vcr.test.ts`

### Implementation

- [x] T029 [US4] Bundle Gitleaks TOML patterns in `src/security/patterns/gitleaks.toml`
- [x] T030 [US4] Implement TOML parser in `src/security/patterns/parser.ts`
- [x] T031 [US4] Implement SecretDetector class in `src/security/detector.ts` (depends on T030)
- [x] T032 [US4] Implement SecretClassifier (LLM tool) in `src/security/classifier.ts` (depends on T031)
- [x] T033 [US4] Add `--no-secrets` CLI flag to `src/cli/program.ts`
- [x] T034 [US4] Create public exports in `src/security/index.ts`

**Checkpoint**: US4 complete and independently testable
- [ ] AWS key pattern detected in test file
- [ ] Secret values NEVER appear in output
- [ ] LLM classifier reduces false positives
- [ ] `--no-secrets` disables detection

---

## Phase 5: User Story 2 - E2E Testing Framework (P1)

**Goal**: End-to-end tests with VCR recordings
**Requirements**: FR-006, FR-007, FR-008

### Tests (write first)

- [x] T035 [P] [US2] Create E2E test structure in `tests/e2e/`
- [x] T036 [P] [US2] Create test fixtures with known issues in `tests/e2e/fixtures/`
- [x] T037 [P] [US2] Unit test for VCR strict mode in `tests/unit/vcr-strict.test.ts`
- [x] T038 [P] [US2] Create dogfood test placeholder in `tests/e2e/dogfood.test.ts`

### Implementation

- [x] T039 [US2] Implement VCR strict mode wrapper in `tests/lib/vcr.ts` (depends on T037)
- [x] T040 [US2] Implement dogfood test analyzing agentlint's own CLAUDE.md in `tests/e2e/dogfood.test.ts`
- [x] T041 [US2] Add `bun run record` script to package.json for cassette recording
- [x] T042 [US2] Add CI configuration for VCR strict mode in `.github/workflows/`

**Checkpoint**: US2 complete and independently testable
- [ ] E2E tests pass with VCR playback
- [ ] CI fails on missing cassettes with clear error
- [ ] `bun run record` captures new cassettes
- [ ] Dogfood test runs successfully

---

## Phase 6: User Story 3 - LLM-as-Judge Evaluation (P1)

**Goal**: Automated quality evaluation with TruLens
**Requirements**: FR-009, FR-010, FR-011, FR-012

### Tests (write first)

- [x] T043 [P] [US3] Unit test for code-based grader in `tests/unit/eval/code-based.test.ts`
- [ ] T044 [P] [US3] Unit test for score calculation in `tests/unit/eval/scoring.test.ts`
- [ ] T045 [P] [US3] Integration test for evaluation runner in `tests/integration/eval-runner.test.ts`

### Implementation

- [ ] T046 [US3] Create golden dataset manifest in `tests/evals/golden/manifest.json`
- [ ] T047 [US3] Create initial golden scenarios (3-5 examples) in `tests/evals/golden/`
- [ ] T048 [US3] Implement CodeBasedGrader in `src/eval/graders/code-based.ts`
- [ ] T049 [US3] Implement TruLens subprocess integration in `tests/evals/trulens-runner.py`
- [ ] T050 [US3] Implement EvaluationRunner in `src/eval/runner.ts` (depends on T048, T049)

**Checkpoint**: US3 complete and independently testable
- [ ] Code-based checks validate output format
- [ ] TruLens subprocess executes and returns scores
- [ ] 70% threshold enforced for release gate
- [ ] Golden scenarios evaluated successfully

---

## Phase 7: User Story 5 & 6 - Session Recording & Verbose Mode (P2)

**Goal**: Session checkpoints for replay and crash recovery, plus verbose token tracking
**Requirements**: FR-016, FR-017, FR-018

### Tests (write first)

- [ ] T051 [P] [US5] Unit test for session recorder in `tests/unit/checkpoint/session-recorder.test.ts`
- [ ] T052 [P] [US5] Integration test for replay in `tests/integration/session-replay.test.ts`
- [ ] T053 [P] [US6] Unit test for token usage tracking in `tests/unit/debug/token-tracking.test.ts`

### Implementation

- [ ] T054 [US5] Extend checkpoint handler for session recording in `src/orchestration/checkpoint.ts`
- [ ] T055 [US5] Implement session replay with `--replay <id>` in `src/cli/program.ts` (depends on T054)
- [ ] T056 [US5] Implement retention policy cleanup in `src/orchestration/checkpoint.ts`
- [ ] T057 [US6] Implement token usage and latency tracking in `src/debug/metrics.ts` (depends on T019)

**Checkpoint**: US5 & US6 complete
- [ ] Checkpoints created every 60 seconds
- [ ] `--replay <id>` resumes from checkpoint
- [ ] Crash recovery prompts on restart
- [ ] Token usage visible in verbose mode

---

## Phase 8: User Story 7 - Outcome Tracking (P3)

**Goal**: Track recommendation implementation and effectiveness
**Requirements**: FR-019, FR-020

### Tests (write first)

- [ ] T058 [P] [US7] Unit test for outcome storage in `tests/unit/outcome/storage.test.ts`
- [ ] T059 [P] [US7] Integration test for feedback flow in `tests/integration/feedback.test.ts`

### Implementation

- [ ] T060 [US7] Create outcome SQLite schema in `src/persistence/outcomes-schema.ts`
- [ ] T061 [US7] Implement OutcomeStorage in `src/persistence/outcome-storage.ts` (depends on T060)
- [ ] T062 [US7] Implement FeedbackCollector in `src/eval/feedback.ts` (depends on T061)

**Checkpoint**: US7 complete
- [ ] Outcome records created for recommendations
- [ ] Feedback prompts shown when enabled
- [ ] Metrics aggregation works correctly

---

## Phase 9: Polish

**Goal**: Documentation, validation, and cleanup

- [ ] T063 [P] Update CLAUDE.md with EP11 features and debug instructions
- [ ] T064 [P] Validate all contracts against implementation
- [ ] T065 Run full E2E dogfood test and fix any issues
- [ ] T066 Verify NFR targets met (secret < 1s/file, debug overhead < 5%)

**Checkpoint**: EP11 complete
- [ ] All tests pass
- [ ] Dogfood score > 95%
- [ ] NFR targets met
- [ ] Documentation updated

---

## MVP Scope

Minimum viable implementation (P1 stories only):

- Phase 1: Setup (T001-T006) - 6 tasks
- Phase 2: Foundational (T007-T014) - 8 tasks
- Phase 3: US1 Debug Mode (T015-T024) - 10 tasks
- Phase 4: US4 Secret Detection (T025-T034) - 10 tasks
- Phase 5: US2 E2E Testing (T035-T042) - 8 tasks
- Phase 6: US3 LLM Evaluation (T043-T050) - 8 tasks

**Total MVP**: 50 tasks

**Full Feature**: 66 tasks (MVP + 16 P2/P3 tasks)

---

## Execution Notes

- Tasks marked `[P]` can run in parallel within their phase
- Complete each phase before starting the next
- Each user story should be testable after its checkpoint
- Run tests after each checkpoint
- Secret detection (US4) and Debug (US1) can be developed in parallel after foundational phase
- TruLens integration (US3) requires Python 3.11+ environment

---

## Dependency Graph (simplified)

```
Setup (T001-T006)
       │
       ▼
Foundational (T007-T014)
       │
       ├─────────┬─────────┐
       ▼         ▼         ▼
   US1 Debug  US4 Secret  US2 E2E
   (T015-T024) (T025-T034) (T035-T042)
       │         │         │
       └────┬────┴────┬────┘
            ▼         │
        US3 Eval  ◄───┘
        (T043-T050)
            │
            ▼
    US5/US6 Session & Verbose
        (T051-T057)
            │
            ▼
    US7 Outcome Tracking
        (T058-T062)
            │
            ▼
        Polish
        (T063-T066)
```

> **Note**: Task phases (1-9) are organized by user story for implementation clarity.
> Plan phases (A-F) map to task phases as: A→3, B→4, C→5, D→6, E→7, F→8.
