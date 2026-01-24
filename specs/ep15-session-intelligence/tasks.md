# Tasks: Session Intelligence

> **Epic**: EP15
> **Generated**: 2026-01-24
> **Total Tasks**: 78
> **MVP Tasks**: 58 (P1 only)

---

## Summary

| Phase | Tasks | Parallelizable | User Stories |
|-------|-------|----------------|--------------|
| 1: Setup | 6 | 4 | - |
| 2: Foundation (Types & Schema) | 10 | 5 | - |
| 3: US-001 Session Narrative | 12 | 6 | US-001 (P1) |
| 4: US-002 Session Flow | 10 | 5 | US-002 (P1) |
| 5: US-003 Delegation Analysis | 8 | 4 | US-003 (P1) |
| 6: US-004 Quality Signals | 8 | 4 | US-004 (P1) |
| 7: US-005 MCP Usage | 8 | 4 | US-005 (P1) |
| 8: US-006 Session Analyst Subagent | 10 | 3 | US-006 (P1) |
| 9: CLI Integration | 6 | 2 | All P1 |
| 10: US-007 Timeline Visualization (P2) | 5 | 2 | US-007 (P2) |
| 11: US-008 Permission Tracking (P2) | 5 | 2 | US-008 (P2) |

---

## Phase 1: Setup

**Goal**: Initialize EP15 directory structure and configuration

- [x] T001 [P] Create `src/sessions/` directory structure per plan.md
- [ ] T002 [P] Create `src/sessions/index.ts` with placeholder exports
- [ ] T003 [P] Create `tests/unit/sessions/` directory structure
- [ ] T004 [P] Create `tests/integration/sessions/` directory structure
- [ ] T005 Add EP15 to `src/tools/index.ts` tool registration (placeholder)
- [ ] T006 Update `src/persistence/schemas.ts` to export EP15 schema version constant

**Checkpoint**: Setup complete
- [ ] Directory structure exists
- [ ] Placeholder files compile without errors

---

## Phase 2: Foundation (Types & Schema)

**Goal**: Define core types and database schema before extraction implementation

**Requirements**: FR-023 (SQLite persistence)

### Types (write first)

- [ ] T007 [P] Create `src/sessions/types.ts` with core type definitions from contracts/interfaces.ts
- [ ] T008 [P] Create `src/sessions/schemas.ts` with Zod validation schemas
- [ ] T009 Write unit test for Zod schema validation in `tests/unit/sessions/schemas.test.ts`

### Database Schema

- [ ] T010 [P] Create `src/sessions/storage/schema.ts` with 6 new table definitions (tool_call_sequences, file_accesses, compression_events, delegation_events, mcp_tool_calls, quality_signals)
- [ ] T011 [P] Add schema version migration logic (version 2 → 3)
- [ ] T012 Write unit test for schema initialization in `tests/unit/sessions/storage/schema.test.ts`
- [ ] T013 Create `src/sessions/storage/queries.ts` with SQL query helper functions
- [ ] T014 Write unit test for query helpers in `tests/unit/sessions/storage/queries.test.ts`

### Storage Index

- [ ] T015 Create `src/sessions/storage/index.ts` exporting schema and queries
- [ ] T016 Write integration test for database initialization in `tests/integration/sessions/storage.test.ts`

**Checkpoint**: Foundation ready
- [ ] All types defined and exported
- [ ] Database schema creates successfully
- [ ] Query helpers work with in-memory SQLite

---

## Phase 3: US-001 Session Narrative Understanding (P1)

**Goal**: Extract session timeline, intent, and outcome signals
**Requirements**: FR-001, FR-002, FR-003, FR-004

### Tests First

- [ ] T017 [P] [US-001] Write unit test for intent extraction in `tests/unit/sessions/extraction/timeline.test.ts`
- [ ] T018 [P] [US-001] Write unit test for outcome signal extraction in `tests/unit/sessions/extraction/timeline.test.ts`
- [ ] T019 [P] [US-001] Write unit test for compression event extraction in `tests/unit/sessions/extraction/compressions.test.ts`

### Extraction Implementation

- [ ] T020 [US-001] Create `src/sessions/extraction/timeline.ts` with intent extraction (FR-002)
- [ ] T021 [US-001] Add outcome signal extraction to timeline.ts (FR-004)
- [ ] T022 [US-001] Create `src/sessions/extraction/compressions.ts` with compression event extraction (FR-003)
- [ ] T023 [US-001] Create `src/sessions/extraction/index.ts` exporting all extraction functions

### Tool Implementation

- [ ] T024 [P] [US-001] Write unit test for get_session_timeline tool in `tests/unit/sessions/tools/get-session-timeline.test.ts`
- [ ] T025 [US-001] Create `src/sessions/tools/get-session-timeline-tool.ts` (FR-001)
- [ ] T026 [US-001] Write rich tool description explaining when to use and what it returns
- [ ] T027 [US-001] Register get_session_timeline tool in `src/sessions/tools/index.ts`
- [ ] T028 [US-001] Write integration test in `tests/integration/sessions/tools/get-session-timeline.test.ts`

**Checkpoint**: US-001 complete
- [ ] Timeline extraction works for real session logs
- [ ] Intent correctly identified as first user prompt
- [ ] Outcome signals include all required hints
- [ ] Compression events extracted with pre-tokens

---

## Phase 4: US-002 Session Flow Analysis (P1)

**Goal**: Extract tool call sequences and file access patterns
**Requirements**: FR-005, FR-006, FR-007

### Tests First

- [ ] T029 [P] [US-002] Write unit test for tool sequence extraction in `tests/unit/sessions/extraction/tool-sequences.test.ts`
- [ ] T030 [P] [US-002] Write unit test for input hash calculation in `tests/unit/sessions/extraction/tool-sequences.test.ts`
- [ ] T031 [P] [US-002] Write unit test for file access extraction in `tests/unit/sessions/extraction/file-accesses.test.ts`

### Extraction Implementation

- [ ] T032 [US-002] Create `src/sessions/extraction/tool-sequences.ts` with sequence extraction (FR-005)
- [ ] T033 [US-002] Add input hash calculation using SHA-256 (FR-005)
- [ ] T034 [US-002] Add error extraction with context (FR-006)
- [ ] T035 [US-002] Create `src/sessions/extraction/file-accesses.ts` with file operation tracking (FR-007)

### Tool Implementation

- [ ] T036 [P] [US-002] Create `src/sessions/tools/get-tool-sequences-tool.ts`
- [ ] T037 [US-002] Create `src/sessions/tools/get-file-accesses-tool.ts`
- [ ] T038 [US-002] Write integration test for pagination in `tests/integration/sessions/tools/get-tool-sequences.test.ts`

**Checkpoint**: US-002 complete
- [ ] Tool sequences include name, hash, timestamp, index
- [ ] Repeated calls with same hash are visible
- [ ] File access counts aggregated per file
- [ ] Pagination works for 100+ tool calls

---

## Phase 5: US-003 Delegation Analysis (P1)

**Goal**: Extract Task tool calls as delegation events
**Requirements**: FR-008, FR-009, FR-010

### Tests First

- [ ] T039 [P] [US-003] Write unit test for delegation detection in `tests/unit/sessions/extraction/delegations.test.ts`
- [ ] T040 [P] [US-003] Write unit test for subagent type parsing in `tests/unit/sessions/extraction/delegations.test.ts`

### Extraction Implementation

- [ ] T041 [US-003] Create `src/sessions/extraction/delegations.ts` with Task tool detection (FR-008)
- [ ] T042 [US-003] Add subagent type, prompt, timing extraction (FR-009)
- [ ] T043 [US-003] Add subagent session ID linking where available (FR-010, P2)

### Tool Implementation

- [ ] T044 [P] [US-003] Create `src/sessions/tools/get-delegation-events-tool.ts`
- [ ] T045 [US-003] Write integration test in `tests/integration/sessions/tools/get-delegation-events.test.ts`
- [ ] T046 [US-003] Handle nested delegation edge case (subagent spawns subagent)

**Checkpoint**: US-003 complete
- [ ] Task tool calls extracted as delegations
- [ ] Subagent type and prompt captured
- [ ] Success/failure tracked
- [ ] Session links available where possible

---

## Phase 6: US-004 Quality Signal Extraction (P1)

**Goal**: Extract test results and build outcomes
**Requirements**: FR-011, FR-012, FR-013

### Tests First

- [ ] T047 [P] [US-004] Write unit test for test output detection in `tests/unit/sessions/extraction/quality-signals.test.ts`
- [ ] T048 [P] [US-004] Write unit test for build output detection in `tests/unit/sessions/extraction/quality-signals.test.ts`

### Extraction Implementation

- [ ] T049 [US-004] Create `src/sessions/extraction/quality-signals.ts` with pattern detection
- [ ] T050 [US-004] Add test output identification (Bash results containing test patterns) (FR-011)
- [ ] T051 [US-004] Add build/lint output identification (FR-012)
- [ ] T052 [US-004] Include raw output for agent interpretation (per C2 clarification)

### Tool Implementation

- [ ] T053 [P] [US-004] Create `src/sessions/tools/get-quality-signals-tool.ts`
- [ ] T054 [US-004] Write integration test in `tests/integration/sessions/tools/get-quality-signals.test.ts`

**Checkpoint**: US-004 complete
- [ ] Test results extracted from Bash outputs
- [ ] Build outcomes captured
- [ ] Raw output included for agent interpretation
- [ ] passed=null for indeterminate cases

---

## Phase 7: US-005 MCP Usage Quality (P1)

**Goal**: Extract MCP tool calls with server name parsing
**Requirements**: FR-014, FR-015, FR-016

### Tests First

- [ ] T055 [P] [US-005] Write unit test for MCP prefix parsing in `tests/unit/sessions/extraction/mcp-calls.test.ts`
- [ ] T056 [P] [US-005] Write unit test for error rate calculation in `tests/unit/sessions/extraction/mcp-calls.test.ts`

### Extraction Implementation

- [ ] T057 [US-005] Create `src/sessions/extraction/mcp-calls.ts` with mcp__ prefix parsing (FR-014)
- [ ] T058 [US-005] Add per-server success/error tracking (FR-015)
- [ ] T059 [US-005] Include error messages for agent analysis (FR-016)

### Tool Implementation

- [ ] T060 [P] [US-005] Create `src/sessions/tools/get-mcp-usage-tool.ts`
- [ ] T061 [US-005] Write integration test in `tests/integration/sessions/tools/get-mcp-usage.test.ts`
- [ ] T062 [US-005] Handle unparseable server name edge case (use "unknown")

**Checkpoint**: US-005 complete
- [ ] MCP tool calls extracted with server name
- [ ] Per-server call and error counts
- [ ] Error messages included
- [ ] Error rate calculated as data (agent judges significance)

---

## Phase 8: US-006 Session Analyst Subagent (P1)

**Goal**: Create the reasoning subagent for session understanding
**Requirements**: FR-017, FR-018, FR-019, FR-020

### Subagent Types

- [ ] T063 [P] [US-006] Create `src/sessions/subagent/types.ts` with SESSION_ANALYST_TOOLS constant (NO Task tool)
- [ ] T064 [US-006] Create SessionAnalystInstructions interface matching ACTInstructions pattern

### Subagent Implementation

- [ ] T065 [US-006] Create `src/sessions/subagent/session-analyst.ts` with 4-layer prompt (~7KB)
- [ ] T066 [US-006] Define prompt sections: ROLE IDENTITY, DOMAIN KNOWLEDGE, YOUR TASK, TOOLS AVAILABLE
- [ ] T067 [US-006] Create buildSessionAnalystAgent() function returning AgentDefinition (FR-017)
- [ ] T068 [US-006] Create `src/sessions/subagent/index.ts` exporting builder functions

### Spawn Tool

- [ ] T069 [P] [US-006] Create `src/sessions/tools/spawn-session-analyst.ts` following spawn-analyst.ts pattern
- [ ] T070 [US-006] Implement buildAnalysisContext() for session context preparation
- [ ] T071 [US-006] Implement buildQueryPrompt() for subagent prompt construction
- [ ] T072 [US-006] Write integration test in `tests/integration/sessions/tools/spawn-session-analyst.test.ts`

**Checkpoint**: US-006 complete
- [ ] Subagent definition has NO Task tool (depth=1 constraint)
- [ ] spawn_session_analyst returns AgentDefinition + context + prompt
- [ ] All EP15 tools available to subagent
- [ ] Prompt enables narrative generation (FR-018, FR-019)

---

## Phase 9: CLI Integration

**Goal**: Expose session intelligence via agentlint CLI
**Requirements**: All P1 user stories integrated

### Tool Registration

- [ ] T073 Register all EP15 tools in `src/tools/index.ts`
- [ ] T074 Add Session Analyst subagent to orchestrator's buildACTSubagents() or agents option

### CLI Commands

- [ ] T075 Add `--session <id>` flag to `agentlint analyse` command in `src/cli/commands/analyse.ts`
- [ ] T076 Implement session analysis flow (spawn subagent, stream output)

### Integration Tests

- [ ] T077 [P] Write CLI integration test in `tests/integration/cli/session-analyse.test.ts`
- [ ] T078 Write end-to-end test with real session log (VCR pattern)

**Checkpoint**: CLI integration complete
- [ ] `agentlint analyse --session <id>` works
- [ ] Session Analyst produces narrative output
- [ ] All P1 acceptance criteria pass

---

## Phase 10: US-007 Timeline Visualization Data (P2)

**Goal**: Structure timeline data for future TUI (EP17)
**Requirements**: FR-021

- [ ] T079 [P] [US-007] Write unit test for timeline structure in `tests/unit/sessions/extraction/timeline-viz.test.ts`
- [ ] T080 [US-007] Add timeline event structure suitable for rendering
- [ ] T081 [US-007] Add key moment flagging (errors, compressions, milestones)
- [ ] T082 [US-007] Ensure consistent event structure across all event types
- [ ] T083 [US-007] Write integration test for timeline visualization data

**Checkpoint**: US-007 complete
- [ ] Timeline data structured for rendering
- [ ] Key moments flagged
- [ ] Consistent event structure

---

## Phase 11: US-008 Permission Tracking (P2)

**Goal**: Extract permission approval/denial patterns
**Requirements**: FR-022

- [ ] T084 [P] [US-008] Write unit test for permission detection in `tests/unit/sessions/extraction/permissions.test.ts`
- [ ] T085 [US-008] Create `src/sessions/extraction/permissions.ts` with permission event extraction
- [ ] T086 [US-008] Track per-tool/command approval patterns
- [ ] T087 [US-008] Create permission data query tool (optional)
- [ ] T088 [US-008] Write integration test for permission tracking

**Checkpoint**: US-008 complete
- [ ] Permission events extracted
- [ ] Patterns per tool available
- [ ] Agent can reason about friction candidates

---

## MVP Scope

Minimum viable implementation (P1 only):

| Phase | Range | Count |
|-------|-------|-------|
| 1: Setup | T001-T006 | 6 |
| 2: Foundation | T007-T016 | 10 |
| 3: US-001 | T017-T028 | 12 |
| 4: US-002 | T029-T038 | 10 |
| 5: US-003 | T039-T046 | 8 |
| 6: US-004 | T047-T054 | 8 |
| 7: US-005 | T055-T062 | 8 |
| 8: US-006 | T063-T072 | 10 |
| 9: CLI Integration | T073-T078 | 6 |

**MVP Total**: 78 tasks (58 MVP + 10 P2)

---

## Execution Notes

### Parallelization
- Tasks marked `[P]` can run in parallel within their phase
- Complete each phase before starting the next
- Test tasks within a phase should run before implementation

### Testing Strategy
- **Unit tests**: In-memory SQLite, mock session data
- **Integration tests**: Real SQLite, fixture session logs
- **No evals yet**: Subagent reasoning tested via integration tests

### Tool/Agent Boundary (Critical)
Per Constitution Principle VII:
- Tools return DATA (counts, sequences, timestamps, patterns)
- Tools do NOT return JUDGMENTS (phase labels, quality scores, recommendations)
- Agent (Session Analyst) provides interpretation

### Key Files to Reference
- `src/temporal/subagent/temporal-subagent.ts` - Subagent prompt pattern
- `src/temporal/tools/spawn-analyst.ts` - Spawn tool pattern
- `src/skills/storage/schema.ts` - Schema extension pattern
- `src/skills/storage/queries.ts` - Query helper pattern

### Checkpoints
- Each phase checkpoint verifies deliverables
- Run `bun run test` after each checkpoint
- Integration tests require `bun run test:integration`
