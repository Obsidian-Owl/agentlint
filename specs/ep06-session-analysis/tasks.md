# Tasks: Session Analysis Tools

> **Epic**: EP06
> **Generated**: 2026-01-17
> **Total Tasks**: 52
> **MVP Tasks**: 38

---

## Summary

| Phase | Tasks | Parallelizable |
|-------|-------|----------------|
| Setup | 5 | 4 |
| Foundational | 8 | 3 |
| US1: Discover Session Logs | 6 | 3 |
| US2: Parse Session Content | 7 | 3 |
| US3: Extract Session Metrics | 6 | 3 |
| US4: Index Sessions for Search | 7 | 3 |
| US5: Search Sessions | 8 | 3 |
| US6: Get Session Statistics | 5 | 2 |
| Polish | 5 | 2 |

---

## Phase 1: Setup

**Goal**: Initialize project structure for session analysis tools

- [x] T001 [P] Create directory structure `src/tools/sessions/` per plan.md
- [x] T002 [P] Create directory structure `src/errors/` if not exists
- [x] T003 [P] Create test directory structure `tests/unit/tools/sessions/`
- [x] T004 [P] Create test fixtures directory `tests/fixtures/sessions/`
- [x] T005 Copy and adapt types from `specs/ep06-session-analysis/contracts/interfaces.ts` to `src/tools/sessions/types.ts`

**Checkpoint**: Setup complete
- [x] Directory structure matches plan.md
- [x] Base type definitions in place

---

## Phase 2: Foundational

**Goal**: Core infrastructure before user stories

- [x] T006 Create session error types in `src/errors/sessions.ts` following `src/errors/persistence.ts` pattern
- [x] T007 [P] Create Zod validation schemas for SessionEntry in `src/tools/sessions/schemas.ts`
- [x] T008 [P] Create Zod validation schemas for SearchSessionsInput in `src/tools/sessions/schemas.ts`
- [x] T009 [P] Create Zod validation schemas for GetSessionStatsInput in `src/tools/sessions/schemas.ts`
- [x] T010 Create FTS5 database initialization in `src/persistence/sessions/fts.ts` per ADR-0006 schema
- [x] T011 Create database schema migration helper in `src/persistence/sessions/fts.ts`
- [x] T012 Create path encoding/decoding utilities in `src/tools/sessions/utils.ts` (FR-001)
- [x] T013 Create public exports barrel file `src/tools/sessions/index.ts`

**Checkpoint**: Foundation ready
- [x] All base types compile
- [x] FTS5 database can be initialized
- [x] Path encoding works correctly

---

## Phase 3: User Story 1 - Discover Session Logs (P1)

**Goal**: Discover Claude Code session logs at `~/.claude/projects/`
**Requirements**: FR-001

### Tests (write first)

- [x] T014 [P] [US1] Unit test for path decoding in `tests/unit/tools/sessions/utils.test.ts`
- [x] T015 [P] [US1] Unit test for session discovery in `tests/unit/tools/sessions/discovery.test.ts`
- [x] T016 [P] [US1] Create test fixture: mock `~/.claude/projects/` structure in `tests/fixtures/sessions/projects/`

### Implementation

- [x] T017 [US1] Implement `discoverSessions()` function in `src/tools/sessions/discovery.ts`
- [x] T018 [US1] Handle edge cases: missing directory, empty directory, permission denied (depends on T017)
- [x] T019 [US1] Handle symlinks and corrupted directory structures (depends on T017)

**Checkpoint**: US1 complete and independently testable
- [x] All US1 tests pass
- [x] Discovery works on real `~/.claude/projects/` directory

---

## Phase 4: User Story 2 - Parse Session Content (P1)

**Goal**: Parse JSONL session logs into structured SessionEntry objects
**Requirements**: FR-002, FR-003, FR-018

### Tests (write first)

- [x] T020 [P] [US2] Create test fixture: sample JSONL files in `tests/fixtures/sessions/`
- [x] T021 [P] [US2] Unit test for JSONL parsing in `tests/unit/tools/sessions/parser.test.ts`
- [x] T022 [P] [US2] Unit test for malformed JSONL handling in `tests/unit/tools/sessions/parser.test.ts`

### Implementation

- [x] T023 [US2] Implement streaming JSONL parser in `src/tools/sessions/parser.ts`
- [x] T024 [US2] Implement `parseSessionEntry()` with position tracking in `src/tools/sessions/parser.ts` (depends on T023)
- [x] T025 [US2] Handle malformed lines, binary data, large content gracefully (depends on T024)
- [x] T026 [US2] Implement compression event detection (type='summary') in `src/tools/sessions/parser.ts` (depends on T024)

**Checkpoint**: US2 complete and independently testable
- [x] All US2 tests pass
- [x] Parser handles real session logs correctly

---

## Phase 5: User Story 3 - Extract Session Metrics (P1)

**Goal**: Calculate token usage, turn counts, and tool distribution
**Requirements**: FR-004, FR-005, FR-006, FR-009

### Tests (write first)

- [x] T027 [P] [US3] Unit test for token metrics extraction in `tests/unit/tools/sessions/metrics.test.ts`
- [x] T028 [P] [US3] Unit test for tool distribution categorization in `tests/unit/tools/sessions/metrics.test.ts`
- [x] T029 [P] [US3] Unit test for compression event counting in `tests/unit/tools/sessions/metrics.test.ts`

### Implementation

- [x] T030 [US3] Implement `extractMetrics()` function in `src/tools/sessions/metrics.ts`
- [x] T031 [US3] Implement tool categorization (read/write/bash/search/other) in `src/tools/sessions/metrics.ts` (depends on T030)
- [x] T032 [US3] Aggregate metrics from message.usage fields in `src/tools/sessions/metrics.ts` (depends on T030)

**Checkpoint**: US3 complete and independently testable
- [x] All US3 tests pass
- [x] Metrics match expected values for test fixtures

---

## Phase 6: User Story 4 - Index Sessions for Search (P1)

**Goal**: Build FTS5 index from session logs with incremental updates
**Requirements**: FR-011, FR-016, FR-018

### Tests (write first)

- [x] T033 [P] [US4] Unit test for FTS5 indexing in `tests/unit/tools/sessions/indexer.test.ts`
- [x] T034 [P] [US4] Unit test for incremental indexing in `tests/unit/tools/sessions/indexer.test.ts`
- [ ] T035 [P] [US4] Performance test for large corpus indexing in `tests/performance/sessions-indexer.test.ts`

### Implementation

- [x] T036 [US4] Implement `indexSessions()` function in `src/tools/sessions/indexer.ts`
- [x] T037 [US4] Implement incremental indexing with mtime check in `src/tools/sessions/indexer.ts` (depends on T036)
- [x] T038 [US4] Populate sessions and session_tools tables during indexing (depends on T036)
- [x] T039 [US4] Handle memory-efficient streaming for large files (depends on T036)

**Checkpoint**: US4 complete and independently testable
- [x] All US4 tests pass
- [ ] Indexing 100MB completes in < 15 seconds
- [ ] Memory stays under 100MB during indexing

---

## Phase 7: User Story 5 - Search Sessions (P1)

**Goal**: Full-text search with BM25 ranking and date filtering
**Requirements**: FR-012, FR-014, FR-015, FR-020, FR-021

### Tests (write first)

- [x] T040 [P] [US5] Unit test for basic search in `tests/unit/tools/sessions/search.test.ts`
- [x] T041 [P] [US5] Unit test for phrase/prefix/field search in `tests/unit/tools/sessions/search.test.ts`
- [x] T042 [P] [US5] Unit test for date range filtering in `tests/unit/tools/sessions/search.test.ts`

### Implementation

- [x] T043 [US5] Implement `searchSessions()` function in `src/tools/sessions/search.ts`
- [x] T044 [US5] Implement BM25 ranking and snippet generation in `src/tools/sessions/search.ts` (depends on T043)
- [x] T045 [US5] Implement date range filtering (--since, --until) in `src/tools/sessions/search.ts` (depends on T043)
- [ ] T046 [US5] Create `search_sessions` SDK tool in `src/tools/sessions/search-sessions-tool.ts` (depends on T043)
- [ ] T047 [US5] Register tool with orchestration layer in `src/tools/sessions/index.ts` (depends on T046)

**Checkpoint**: US5 complete and independently testable
- [x] All US5 tests pass
- [x] Search returns ranked results with snippets
- [ ] Tool integrates with SDK

---

## Phase 8: User Story 6 - Get Session Statistics (P2)

**Goal**: Aggregate statistics across sessions with filtering
**Requirements**: FR-013, FR-010

### Tests (write first)

- [ ] T048 [P] [US6] Unit test for stats aggregation in `tests/unit/tools/sessions/stats.test.ts`
- [ ] T049 [P] [US6] Unit test for project/date filtering in `tests/unit/tools/sessions/stats.test.ts`

### Implementation

- [ ] T050 [US6] Implement `getSessionStats()` function in `src/tools/sessions/stats.ts`
- [ ] T051 [US6] Create `get_session_stats` SDK tool in `src/tools/sessions/get-session-stats-tool.ts` (depends on T050)
- [ ] T052 [US6] Register tool with orchestration layer in `src/tools/sessions/index.ts` (depends on T051)

**Checkpoint**: US6 complete and independently testable
- [ ] All US6 tests pass
- [ ] Stats tool integrates with SDK

---

## Phase 9: Polish

**Goal**: Integration, documentation, and final validation

- [ ] T053 Integration test: full workflow (discover → parse → index → search) in `tests/integration/sessions/workflow.test.ts`
- [ ] T054 [P] Validate against quickstart.md examples in `tests/integration/sessions/quickstart.test.ts`
- [ ] T055 [P] Performance validation: search < 2s on 500MB corpus in `tests/performance/sessions-search.test.ts`
- [ ] T056 Update `src/tools/index.ts` to export session tools
- [ ] T057 Run full test suite and verify > 80% coverage

**Checkpoint**: EP06 complete
- [ ] All tests pass
- [ ] Coverage > 80%
- [ ] Performance NFRs met
- [ ] Tools accessible via SDK

---

## MVP Scope

Minimum viable implementation (P1 user stories only):

| Phase | Tasks | IDs |
|-------|-------|-----|
| Setup | 5 | T001-T005 |
| Foundational | 8 | T006-T013 |
| US1: Discover (P1) | 6 | T014-T019 |
| US2: Parse (P1) | 7 | T020-T026 |
| US3: Metrics (P1) | 6 | T027-T032 |
| US4: Index (P1) | 7 | T033-T039 |
| US5: Search (P1) | 8 | T040-T047 |

**Total MVP**: 47 tasks (excludes US6 P2 + Polish)

---

## Execution Notes

### Parallelization

- Tasks marked `[P]` can run in parallel within their phase
- Complete each phase before starting the next
- Tests should be written before implementation tasks

### Dependencies

- Phase 2 (Foundational) depends on Phase 1 (Setup)
- Each US phase depends on previous phases
- Within US phases: tests → implementation

### Testing Strategy

- Unit tests use fixtures from `tests/fixtures/sessions/`
- Integration tests use real `~/.claude/projects/` if available
- Performance tests should run separately with large test data

### Key Files

| File | Purpose |
|------|---------|
| `src/tools/sessions/types.ts` | Type definitions |
| `src/tools/sessions/discovery.ts` | Session log discovery |
| `src/tools/sessions/parser.ts` | JSONL parsing |
| `src/tools/sessions/metrics.ts` | Metrics extraction |
| `src/tools/sessions/indexer.ts` | FTS5 indexing |
| `src/tools/sessions/search.ts` | Search implementation |
| `src/tools/sessions/search-sessions-tool.ts` | SDK tool |
| `src/persistence/sessions/fts.ts` | FTS5 database |

### NFR Validation

| NFR | Test | Target |
|-----|------|--------|
| NFR-001 | T055 | Search < 2s on 500MB |
| NFR-002 | T035 | Index 500MB < 60s |
| NFR-003 | T035 | Memory < 100MB |
| NFR-007 | T025 | Parse > 99% valid entries |

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-17 | Claude | Initial task generation |
