# Tasks: {{FEATURE_NAME}}

> **Epic**: {{EPIC_ID}}
> **Spec**: {{SPEC_PATH}}
> **Plan**: {{PLAN_PATH}}
> **Generated**: {{DATE}}
> **Status**: Draft

---

## Summary

| Phase | Tasks | Parallelizable | Story |
|-------|-------|----------------|-------|
| Setup | 0 | 0 | - |
| Foundational | 0 | 0 | - |
| [Story 1] | 0 | 0 | US1 |
| Polish | 0 | 0 | - |

**Total Tasks**: 0
**MVP Tasks**: 0 (Setup + Foundational + P1 stories)

---

## Task Format Reference

```
- [ ] T### [P?] [US?] Description with absolute file path
```

- `T###` = Sequential task ID (T001, T002...)
- `[P]` = Parallelizable (different files, no dependencies)
- `[US#]` = User story reference (only in story phases)
- Always include absolute file path in description

---

## Phase 1: Setup

**Goal**: Initialize project structure and configuration

**Dependencies**: None (can start immediately)

<!-- Tasks go here -->

**Checkpoint**: Setup complete
- [ ] Directory structure created
- [ ] Configuration files in place

---

## Phase 2: Foundational

**Goal**: Core infrastructure required by all user stories

**Dependencies**: Phase 1 complete

<!-- Tasks go here -->

**Checkpoint**: Foundation ready
- [ ] Base types defined
- [ ] Error handling in place
- [ ] Core utilities available

---

## Phase 3: User Story 1 - [Title] (P1)

**Goal**: [What this story delivers to the user]

**Requirements Covered**: FR-001, FR-002

**Dependencies**: Phase 2 complete

### Tests (write first, ensure they fail)

<!-- Test tasks go here -->

### Implementation

<!-- Implementation tasks go here -->

**Checkpoint**: US1 complete and independently testable
- [ ] All acceptance criteria met
- [ ] Tests pass
- [ ] Can demo independently

---

## Phase 4: User Story 2 - [Title] (P1)

**Goal**: [What this story delivers]

**Requirements Covered**: FR-003, FR-004

**Dependencies**: Phase 2 complete (parallel with US1 if independent)

### Tests

<!-- Test tasks go here -->

### Implementation

<!-- Implementation tasks go here -->

**Checkpoint**: US2 complete and independently testable

---

## Phase N: Polish

**Goal**: Documentation, optimization, and cross-cutting concerns

**Dependencies**: All user story phases complete

<!-- Polish tasks go here -->

**Checkpoint**: Feature complete
- [ ] Documentation updated
- [ ] All tests pass
- [ ] Performance targets met
- [ ] Ready for review

---

## MVP Scope

Minimum viable implementation includes:

| Phase | Task Range | Count |
|-------|------------|-------|
| Setup | T001-T00X | X |
| Foundational | T00X-T0XX | X |
| US1 (P1) | T0XX-T0XX | X |

**Total MVP Tasks**: XX

**What MVP delivers**: [Brief description of what users can do with MVP]

---

## Execution Notes

### Parallel Execution
- Tasks marked `[P]` can run concurrently within their phase
- Never run tasks from different phases in parallel
- If unsure about parallelization, run sequentially

### Checkpoints
- Validate checkpoint criteria before moving to next phase
- Run test suite after each checkpoint
- Each user story should be independently deployable after its checkpoint

### Dependencies
- Explicit dependencies noted in task descriptions: `(depends on T###)`
- Implicit dependencies: tests before implementation, models before services

### Linear Integration
- Run `/dev.taskstolinear` to create Linear issues from this file
- Linear issues will have `epic:{{EPIC_ID}}` label
- Dependencies become `blockedBy` relationships in Linear

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| {{DATE}} | {{AUTHOR}} | Initial generation |
