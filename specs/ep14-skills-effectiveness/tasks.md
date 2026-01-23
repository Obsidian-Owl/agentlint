# Tasks: Skills Effectiveness Analysis

> **Epic**: EP14
> **Generated**: 2026-01-24
> **Total Tasks**: 52
> **MVP Tasks**: 35

---

## Summary

| Phase | Tasks | Parallelizable |
|-------|-------|----------------|
| Setup | 6 | 4 |
| Foundational | 10 | 6 |
| US1: View Invocation Summary (P1) | 8 | 4 |
| US2: Identify Missed Opportunities (P1) | 6 | 3 |
| US5: Query Invocation Data (P2) | 8 | 4 |
| US6: Main Analysis Integration (P2) | 8 | 4 |
| US7: CLI Skills Command (P3) | 4 | 2 |
| Polish | 2 | 0 |

**Note**: US3 (Description Mismatch) and US4 (Suggest Improvements) are **agent reasoning tasks**, not tool implementation. The agent performs these using data from US1/US2 tools.

---

## Phase 1: Setup

**Goal**: Initialize src/skills module structure

- [ ] T001 [P] Create src/skills/ directory structure per plan.md
- [ ] T002 [P] Create src/skills/index.ts module entry point
- [ ] T003 [P] Create src/skills/types.ts with TypeScript interfaces from contracts/interfaces.ts
- [ ] T004 [P] Create src/skills/schemas.ts with Zod validation schemas
- [ ] T005 Create tests/unit/skills/ directory structure
- [ ] T006 Create tests/integration/skills/ directory structure

**Checkpoint**: Setup complete
- [ ] Directory structure exists
- [ ] Module exports compile without errors

---

## Phase 2: Foundational

**Goal**: Core infrastructure—types, schemas, database extension

### Types & Schemas

- [ ] T007 [P] Implement SkillInventoryItem interface in src/skills/types.ts
- [ ] T008 [P] Implement SkillInvocationRecord interface in src/skills/types.ts
- [ ] T009 [P] Implement SessionSummary interface in src/skills/types.ts
- [ ] T010 [P] Create Zod schema for GetSkillInventoryInput in src/skills/schemas.ts
- [ ] T011 [P] Create Zod schema for GetSkillInvocationsInput in src/skills/schemas.ts
- [ ] T012 [P] Create Zod schema for GetSessionSummariesInput in src/skills/schemas.ts

### Database Schema

- [ ] T013 Create src/skills/storage/ directory
- [ ] T014 Implement skill_invocations table schema in src/skills/storage/schema.ts (depends on T013)
- [ ] T015 Add schema initialization function in src/skills/storage/schema.ts (depends on T014)
- [ ] T016 Create src/skills/storage/index.ts with exports (depends on T014, T015)

**Checkpoint**: Foundation ready
- [ ] All types compile
- [ ] Zod schemas validate correctly
- [ ] Database schema can be applied to sessions.db

---

## Phase 3: US1 - View Skills Invocation Summary (P1)

**Goal**: Enable agent to see skill invocation counts
**Requirements**: FR-001, FR-002, FR-003, FR-005, FR-006, FR-007

### Tool: get_skill_inventory

- [ ] T017 [P] [US1] Unit test: get_skill_inventory returns skills from .claude/skills/ in tests/unit/skills/get-skill-inventory.test.ts
- [ ] T018 [P] [US1] Unit test: handles empty skills directory gracefully
- [ ] T019 [US1] Create src/skills/discovery.ts wrapping existing src/tools/config/skills.ts (depends on T007)
- [ ] T020 [US1] Create src/skills/tools/get-skill-inventory-tool.ts with rich description (depends on T019)

### Tool: index_skill_invocations

- [ ] T021 [P] [US1] Unit test: detects Skill tool_use entries in session logs in tests/unit/skills/detection.test.ts
- [ ] T022 [US1] Implement isSkillInvocation() and extractSkillCommand() in src/skills/detection.ts
- [ ] T023 [US1] Implement extractUserPromptContext() in src/skills/detection.ts (depends on T022)
- [ ] T024 [US1] Create src/skills/tools/index-skill-invocations-tool.ts (depends on T022, T023, T015)

**Checkpoint**: US1 tools complete
- [ ] get_skill_inventory returns skill list with descriptions
- [ ] index_skill_invocations indexes Skill tool calls from sessions
- [ ] Unit tests pass
- [ ] No judgment logic in tools (data only)

---

## Phase 4: US2 - Identify Missed Skill Opportunities (P1)

**Goal**: Enable agent to reason about sessions where skills weren't used
**Requirements**: FR-009, FR-011, FR-012

### Tool: get_session_summaries

- [ ] T025 [P] [US2] Unit test: get_session_summaries returns first user prompt in tests/unit/skills/get-session-summaries.test.ts
- [ ] T026 [P] [US2] Unit test: get_session_summaries returns files operated
- [ ] T027 [US2] Create session summary query in src/skills/storage/queries.ts (depends on T016)
- [ ] T028 [US2] Implement files-operated extraction (Read/Write/Edit tools) in src/skills/storage/queries.ts (depends on T027)
- [ ] T029 [US2] Create src/skills/tools/get-session-summaries-tool.ts with rich description (depends on T027, T028)
- [ ] T030 [US2] Integration test: session summaries include skills invoked in tests/integration/skills/session-summaries.test.ts

**Checkpoint**: US2 tools complete
- [ ] get_session_summaries returns sessionId, firstUserPrompt, filesOperated, skillsInvoked
- [ ] Agent has context to reason about missed opportunities
- [ ] File patterns in inventory serve as hints (not rules)
- [ ] No detection logic in tools

---

## Phase 5: US5 - Query Skills Invocation Data (P2)

**Goal**: Enable filtered queries of invocation data
**Requirements**: FR-004, FR-008

### Tool: get_skill_invocations

- [ ] T031 [P] [US5] Unit test: filters by skill name in tests/unit/skills/get-skill-invocations.test.ts
- [ ] T032 [P] [US5] Unit test: filters by date range (since/until)
- [ ] T033 [P] [US5] Unit test: filters by session ID
- [ ] T034 [US5] Implement invocation queries in src/skills/storage/queries.ts (depends on T016)
- [ ] T035 [US5] Implement date range filtering with ISO-8601 validation (depends on T034)
- [ ] T036 [US5] Create src/skills/tools/get-skill-invocations-tool.ts with rich description (depends on T034, T035)
- [ ] T037 [US5] Integration test: query returns correct data after indexing in tests/integration/skills/invocations.test.ts
- [ ] T038 [US5] Add pagination (limit/offset) to get_skill_invocations (depends on T036)

**Checkpoint**: US5 complete
- [ ] All query filters work (skill, session, date range)
- [ ] Results paginated for context window efficiency
- [ ] Integration tests pass

---

## Phase 6: US6 - Skills Effectiveness in Main Analysis Flow (P2)

**Goal**: Integrate skills tools with main agentlint analyse command
**Requirements**: FR-013, FR-014, FR-016

### Tool Registration

- [ ] T039 [P] [US6] Create src/skills/tools/index.ts exporting all four tools
- [ ] T040 [US6] Register skills tools in src/orchestration/tool-registry.ts (depends on T039)

### CLI Integration

- [ ] T041 [P] [US6] Add --skills flag to analyse command in src/cli/commands/analyse.ts
- [ ] T042 [US6] Implement skills-focused analysis mode when --skills flag present (depends on T040, T041)

### Baseline Integration

- [ ] T043 [P] [US6] Add skills invocation metrics to baseline schema in src/persistence/baselines/
- [ ] T044 [US6] Store skills metrics during baseline capture (depends on T043)

### Integration Tests

- [ ] T045 [US6] Integration test: tools registered and callable in tests/integration/skills/registration.test.ts
- [ ] T046 [US6] Integration test: --skills flag runs skills analysis in tests/integration/cli/skills-flag.test.ts

**Checkpoint**: US6 complete
- [ ] Skills tools available to orchestrator
- [ ] --skills flag works
- [ ] Skills metrics in baselines

---

## Phase 7: US7 - CLI Skills Command (P3)

**Goal**: Standalone agentlint skills command
**Requirements**: FR-015

- [ ] T047 [P] [US7] Create src/cli/commands/skills.ts command structure
- [ ] T048 [US7] Implement agentlint skills summary output (depends on T047)
- [ ] T049 [P] [US7] Add --detail flag for single-skill analysis
- [ ] T050 [US7] Integration test: agentlint skills command works in tests/integration/cli/skills-command.test.ts

**Checkpoint**: US7 complete
- [ ] agentlint skills command runs
- [ ] --detail flag shows single skill

---

## Phase 8: Polish

**Goal**: Final verification and documentation

- [ ] T051 Verify all tools return data only (no judgments, no thresholds, no detection logic)
- [ ] T052 Update Arc42 §5 with Skills Effectiveness Data component

**Checkpoint**: EP14 complete
- [ ] All tests pass
- [ ] Constitution Principle VII verified
- [ ] Documentation updated

---

## MVP Scope

Minimum viable implementation (P1 stories only):

- **Phase 1: Setup** (T001-T006) - 6 tasks
- **Phase 2: Foundational** (T007-T016) - 10 tasks
- **Phase 3: US1** (T017-T024) - 8 tasks
- **Phase 4: US2** (T025-T030) - 6 tasks
- **Phase 5: US5** (T031-T038) - 8 tasks (included as critical for US1/US2 data access)

**Total MVP**: 38 tasks (includes US5 as it provides query capabilities needed for US1/US2)

**Deferred to P2/P3**:
- US6: Main analysis integration (8 tasks)
- US7: CLI skills command (4 tasks)
- Polish (2 tasks)

---

## Agent Reasoning Tasks (NOT Implementation)

Per Constitution Principle VII, these are **agent tasks**, not code tasks:

| Agent Reasoning | Tools Provide |
|-----------------|---------------|
| "This invocation rate is low" | Raw invocation counts |
| "Skill should have been used here" | Session summary + skill inventory |
| "Description doesn't match user phrasing" | User prompts + skill descriptions |
| "Suggest this description improvement" | Patterns from session data |
| "Data insufficient for trends" | Historical invocation data |

**No tasks created for:**
- Missed opportunity detection logic
- Effectiveness scoring
- Description mismatch detection
- Recommendation generation

These happen when the agent reasons over tool outputs.

---

## Execution Notes

- Tasks marked `[P]` can run in parallel within their phase
- Complete each phase before starting the next
- Each user story should be testable after its checkpoint
- Run `bun run test` after each checkpoint
- **CRITICAL**: Verify no judgment logic creeps into tools—tools return data only

---

## Agentic Design Verification

After each tool implementation, verify:

| Check | Expectation |
|-------|-------------|
| No hardcoded thresholds | No `if (count < X)` logic |
| No status enums | No `'underutilized' \| 'healthy'` |
| No recommendations array | Agent generates recommendations |
| Rich tool description | Explains what, when, returns |
| _rawData pattern | Structured data alongside formatted text |
