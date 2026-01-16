# Tasks: EP03 Persistence Layer

> **Epic**: EP03
> **Generated**: 2026-01-16
> **Total Tasks**: 53
> **MVP Tasks**: 35

---

## Summary

| Phase | Tasks | Parallelizable | User Stories |
|-------|-------|----------------|--------------|
| Setup | 5 | 4 | — |
| Foundational | 8 | 3 | — |
| US1+US2: Baselines | 10 | 4 | US-001, US-002 |
| US3+US4: Sessions | 8 | 3 | US-003, US-004 |
| US5+US6: Learnings | 10 | 4 | US-005, US-006 |
| US7: Atomic Writes | 4 | 2 | US-007 |
| US8+US9: Init & Permissions | 4 | 2 | US-008, US-009 |
| Polish | 4 | 1 | — |

---

## Phase 1: Setup

**Goal**: Initialize persistence module structure

- [x] T001 [P] Create directory structure `src/persistence/` per plan.md
- [x] T002 [P] Create `src/persistence/index.ts` with public exports skeleton
- [x] T003 [P] Create `src/persistence/types.ts` with persistence-specific types from contracts/interfaces.ts
- [x] T004 [P] Create `src/errors/persistence.ts` with persistence error classes
- [x] T005 Add persistence exports to `src/errors/index.ts`

**Checkpoint**: Setup complete
- [x] Directory structure exists
- [x] Types compile without errors

---

## Phase 2: Foundational

**Goal**: Core infrastructure before user story implementation

- [x] T006 Create `src/persistence/common/directories.ts` with `ensureDir()` and path helpers
- [x] T007 Create `src/persistence/common/database.ts` with SQLite helpers and WAL mode init
- [x] T008 Create `src/persistence/common/atomic-write.ts` with temp file + rename pattern
- [x] T009 [P] Write unit tests for `ensureDir()` in `tests/unit/persistence/directories.test.ts`
- [x] T010 [P] Write unit tests for `atomicWrite()` in `tests/unit/persistence/atomic-write.test.ts`
- [x] T011 [P] Write unit tests for database helpers in `tests/unit/persistence/database.test.ts`
- [x] T012 Create `src/persistence/common/index.ts` exporting common utilities
- [x] T013 Add zod schemas for validation in `src/persistence/schemas.ts`

**Checkpoint**: Foundation ready
- [x] All foundational unit tests pass (56 tests)
- [x] Common utilities importable from `src/persistence/common`

---

## Phase 3: User Story 1+2 - Baseline Storage (P1)

**Goal**: Save and query analysis baselines
**Requirements**: FR-001, FR-002, FR-003, FR-004, FR-005, FR-019

### Tests (write first)

- [x] T014 [P] [US1] Write unit tests for baseline save in `tests/unit/persistence/baselines/storage.test.ts`
- [x] T015 [P] [US1] Write unit tests for baseline index in `tests/unit/persistence/baselines/index.test.ts`
- [x] T016 [P] [US2] Write unit tests for baseline queries in `tests/unit/persistence/baselines/queries.test.ts`
- [x] T017 [US1] Write integration test for full baseline save+query flow in `tests/integration/persistence/baselines.test.ts`

### Implementation

- [x] T018 [US1] Create `src/persistence/baselines/storage.ts` with `saveBaseline()`, `loadBaseline()` (depends on T006, T008)
- [x] T019 [US1] Create `src/persistence/baselines/indexer.ts` with SQLite schema and `indexBaseline()` (depends on T007)
- [x] T020 [US2] Create `src/persistence/baselines/queries.ts` with query functions (depends on T019)
- [x] T021 [US1] Implement `latest.json` management in storage.ts
- [x] T022 [US1] Add schema version validation in storage.ts per FR-019
- [x] T023 [US1] Create `src/persistence/baselines/index.ts` barrel export

**Checkpoint**: US1+US2 complete
- [x] All baseline tests pass (unit + integration)
- [x] Can save baseline, query by ID/label/date, get latest

---

## Phase 4: User Story 3+4 - Session Checkpointing (P1)

**Goal**: Save and restore session state for crash recovery
**Requirements**: FR-006, FR-007, FR-008, FR-009, FR-010

### Tests (write first)

- [x] T024 [P] [US3] Write unit tests for session save in `tests/unit/persistence/sessions/storage.test.ts`
- [x] T025 [P] [US4] Write unit tests for session load/resume in `tests/unit/persistence/sessions/resume.test.ts`
- [x] T026 [US3] Write integration test for checkpoint + crash recovery in `tests/integration/persistence/sessions.test.ts`

### Implementation

- [x] T027 [US3] Create `src/persistence/sessions/storage.ts` with enhanced `saveState()` using atomic writes (depends on T008)
- [x] T028 [US4] Add `loadState()` with version validation in storage.ts
- [x] T029 [US4] Implement `findIncomplete()` for crash recovery in storage.ts
- [x] T030 [US4] Implement `cleanup()` for old session retention in storage.ts
- [x] T031 [US3] Create `src/persistence/sessions/index.ts` barrel export

**Checkpoint**: US3+US4 complete
- [x] All session tests pass
- [x] Can checkpoint session, kill process, recover state

---

## Phase 5: User Story 5+6 - Learning Storage (P2)

**Goal**: Save and query project/global learnings
**Requirements**: FR-011, FR-012, FR-013, FR-020

### Tests (write first)

- [x] T032 [P] [US5] Write unit tests for project learning save in `tests/unit/persistence/learnings/storage.test.ts`
- [x] T033 [P] [US6] Write unit tests for global learning save in `tests/unit/persistence/learnings/global.test.ts`
- [x] T034 [P] [US5] Write unit tests for learning index in `tests/unit/persistence/learnings/indexer.test.ts`
- [x] T035 [US5] Write integration test for learning save+query in `tests/integration/persistence/learnings.test.ts`

### Implementation

- [x] T036 [US5] Create `src/persistence/learnings/storage.ts` with markdown + YAML frontmatter handling
- [x] T037 [US5] Create `src/persistence/learnings/indexer.ts` with SQLite schema for learnings.db
- [x] T038 [US6] Add global scope support (`~/.agentlint/learnings/`) in storage.ts
- [x] T039 [US5] Implement `listAllLearnings()` that queries both project and global DBs per FR-020
- [x] T040 [US5] Create `src/persistence/learnings/index.ts` barrel export
- [x] T041 [US5] Add YAML frontmatter parsing/serialization utilities

**Checkpoint**: US5+US6 complete
- [x] All learning tests pass (86 tests)
- [x] Can save project learning, save global learning, query both

---

## Phase 6: User Story 7 - Atomic Writes (P2)

**Goal**: Ensure crash-safe file operations
**Requirements**: FR-014, FR-015

### Tests (write first)

- [x] T042 [P] [US7] Write crash simulation tests in `tests/unit/persistence/atomic-write-crash.test.ts`
- [x] T043 [US7] Write SQLite transaction tests in `tests/unit/persistence/database-transactions.test.ts`

### Implementation

- [x] T044 [US7] Enhance `atomicWrite()` with error handling for disk full, permissions
- [x] T045 [US7] Add SQLite transaction wrapper with rollback in database.ts

**Checkpoint**: US7 complete
- [x] Atomic write tests pass (including simulated failures) - 18 tests
- [x] SQLite transactions rollback correctly - 19 tests

---

## Phase 7: User Story 8+9 - Init & Permissions (P3)

**Goal**: Auto-initialize directories with proper permissions
**Requirements**: FR-016, FR-017, FR-018

### Tests (write first)

- [x] T046 [P] [US8] Write directory init tests in `tests/unit/persistence/directories-init.test.ts`
- [x] T047 [US9] Write permission tests in `tests/unit/persistence/permissions.test.ts` (platform-dependent)

### Implementation

- [x] T048 [US8] Add auto-create to all storage operations in baselines/, sessions/, learnings/
- [x] T049 [US9] Add permission setting (0600/0700) to `ensureDir()` and `atomicWrite()`

**Checkpoint**: US8+US9 complete
- [x] Directory init tests pass (17 tests)
- [x] Permission tests pass (on macOS/Linux) (15 tests)

---

## Phase 8: Polish

**Goal**: Final validation and documentation

- [x] T050 Run full test suite, ensure > 80% coverage
- [x] T051 [P] Performance test: query 50 baselines < 2s in `tests/performance/baselines.test.ts`
- [x] T052 Update `src/persistence/index.ts` with complete public API exports
- [x] T053 Architecture review against Arc42 and ADRs (0008, 0009, 0010)

**Checkpoint**: EP03 complete
- [x] All tests pass (611 tests)
- [x] Coverage > 80% (88.95%)
- [x] Performance targets met (50 baselines queried in ~2ms, target was <2s)
- [x] Public API exported correctly
- [x] Architecture review passed - fully compliant with ADRs and Constitution

---

## MVP Scope

Minimum viable implementation (P1 user stories only):

| Phase | Tasks | Range |
|-------|-------|-------|
| Setup | 5 | T001-T005 |
| Foundational | 8 | T006-T013 |
| US1+US2: Baselines | 10 | T014-T023 |
| US3+US4: Sessions | 8 | T024-T031 |
| Polish (subset) | 4 | T050, T051, T052 |

**MVP Total**: 35 tasks

**Full Feature**: 53 tasks (adds P2: Learnings, Atomic Writes; P3: Init & Permissions; arch review)

---

## Execution Notes

### Parallelization
- Tasks marked `[P]` can run in parallel within their phase
- Complete each phase before starting the next
- Tests should be written before their corresponding implementation

### Dependency Graph
```
Phase 1 (Setup)
    │
    ▼
Phase 2 (Foundational)
    │
    ├──────────────────┬─────────────────┐
    ▼                  ▼                 ▼
Phase 3            Phase 4           Phase 5
(Baselines)        (Sessions)        (Learnings)
    │                  │                 │
    └──────────────────┴─────────────────┘
                       │
                       ▼
                  Phase 6-7
            (Atomic, Init, Perms)
                       │
                       ▼
                  Phase 8 (Polish)
```

### File Locations

| Component | Path |
|-----------|------|
| Types | `src/persistence/types.ts` |
| Errors | `src/errors/persistence.ts` |
| Common | `src/persistence/common/` |
| Baselines | `src/persistence/baselines/` |
| Sessions | `src/persistence/sessions/` |
| Learnings | `src/persistence/learnings/` |
| Unit Tests | `tests/unit/persistence/` |
| Integration Tests | `tests/integration/persistence/` |
| Performance Tests | `tests/performance/` |

### Testing Strategy
1. Unit tests per module (mocked dependencies)
2. Integration tests per user story (real filesystem, temp directories)
3. Performance tests for NFR validation

### Checkpoint Verification
After each checkpoint:
```bash
bun test                    # All tests pass
bun run typecheck           # No type errors
bun test --coverage         # Coverage report
```
