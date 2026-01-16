# Tasks: EP02 Orchestration Core

> **Epic**: EP02
> **Generated**: 2026-01-16
> **Total Tasks**: 52
> **MVP Tasks**: 34

---

## Summary

| Phase | Tasks | Parallelizable | Priority |
|-------|-------|----------------|----------|
| 0: SDK Spike | 4 | 1 | P1 |
| 1: Setup | 5 | 3 | P1 |
| 2: Foundational | 8 | 4 | P1 |
| 3: US1+US2 Core Loop & Tools | 9 | 4 | P1 |
| 4: US3+US4 Context & Streaming | 8 | 4 | P1 |
| 5: US5 Checkpointing | 6 | 3 | P1 |
| 6: US6+US7 Session Management | 7 | 3 | P2 |
| 7: US8+US9 Advanced Features | 5 | 2 | P2/P3 |
| 8: Polish | 6 | 2 | - |
| **Total** | **58** | **26** | |

---

## Phase 0: SDK Spike (Research Validation)

**Goal**: Verify SDK patterns work as researched before committing to implementation

- [x] T001 Create SDK spike branch and minimal test project
- [x] T002 [P] Verify `query()` function with mock prompt and streaming output
- [x] T003 Verify `tool()` + `createSdkMcpServer()` pattern registers and invokes custom tool
- [x] T004 Verify hook system fires `PostToolUse`, `SessionEnd`, `PreCompact` as expected

**Checkpoint**: SDK patterns validated, proceed with implementation

---

## Phase 1: Setup

**Goal**: Initialize EP02 directory structure and dependencies

- [x] T005 [P] Add SDK dependencies to package.json: `@anthropic-ai/claude-agent-sdk@0.2.7`, `zod@^3.24.1`
- [x] T006 [P] Create `src/orchestration/` directory structure per plan.md
- [x] T007 [P] Create `src/orchestration/index.ts` with placeholder exports
- [x] T008 Create `tests/unit/orchestration/` directory structure
- [x] T009 Create `tests/integration/orchestration/` directory structure with recordings/

**Checkpoint**: Setup complete, directories and dependencies in place

---

## Phase 2: Foundational

**Goal**: Core types, errors, and configuration infrastructure

### Types

- [x] T010 [P] Create `src/orchestration/types.ts` with VerbosityLevel, StreamChunkType types
- [x] T011 [P] Create StreamChunk interface in `src/orchestration/types.ts`
- [x] T012 [P] Create OrchestratorConfig and AgentlintGlobalConfig interfaces in `src/orchestration/types.ts`
- [x] T013 [P] Create SessionState, Finding, Recommendation types in `src/orchestration/types.ts`

### Errors

- [x] T014 Create `src/errors/orchestration.ts` with OrchestrationError base class
- [x] T015 Add SessionResumeError, ToolRegistrationError, ApiKeyError to `src/errors/orchestration.ts`
- [x] T016 Export orchestration errors from `src/errors/index.ts`

### Configuration

- [x] T017 Create `src/orchestration/config.ts` with loadConfig(), getDefaultConfig() functions

**Checkpoint**: Foundation ready - types, errors, config loading in place

---

## Phase 3: US1+US2 - Core Loop & Tool Registration (P1)

**Goal**: Master loop execution and tool registration
**Requirements**: FR-001, FR-002, FR-003

### Tests (write first)

- [x] T018 [P] [US1] Unit test: Orchestrator.run() executes with mock tools in `tests/unit/orchestration/orchestrator.test.ts`
- [x] T019 [P] [US2] Unit test: ToolRegistry.register() accepts tool() definitions in `tests/unit/orchestration/tool-registry.test.ts`
- [x] T020 [P] [US2] Unit test: ToolRegistry.toMcpServer() returns valid McpSdkServerConfigWithInstance in `tests/unit/orchestration/tool-registry.test.ts`

### Implementation

- [x] T021 [US2] Create `src/orchestration/tool-registry.ts` with IToolRegistry interface implementation
- [x] T022 [US2] Implement ToolRegistry.register() and registerMany() methods
- [x] T023 [US2] Implement ToolRegistry.toMcpServer() using createSdkMcpServer()
- [x] T024 [US1] Create `src/orchestration/orchestrator.ts` with Orchestrator class skeleton
- [x] T025 [US1] Implement Orchestrator.run() wrapping SDK query() function
- [x] T026 [US1] Wire ToolRegistry into Orchestrator via mcpServers option

**Checkpoint**: US1+US2 complete - master loop runs, tools register and invoke

---

## Phase 4: US3+US4 - Context Management & Streaming (P1)

**Goal**: Context compression handling and real-time streaming output
**Requirements**: FR-004, FR-005, FR-006, FR-007

### Tests (write first)

- [x] T027 [P] [US4] Unit test: StreamProcessor converts SDK messages to StreamChunks in `tests/unit/orchestration/streaming.test.ts`
- [x] T028 [P] [US4] Unit test: filterByVerbosity() filters chunks correctly in `tests/unit/orchestration/streaming.test.ts`
- [x] T029 [P] [US3] Unit test: Large tool results trigger summarization in `tests/unit/orchestration/tool-registry.test.ts`

### Implementation

- [x] T030 [US4] Create `src/orchestration/streaming.ts` with IStreamProcessor interface
- [x] T031 [US4] Implement StreamProcessor.process() for SDK message type conversion
- [x] T032 [US4] Implement filterByVerbosity() helper function
- [x] T033 [US3] Add PreCompact hook handler for context compression events
- [x] T034 [US3] Implement handleToolResult() with size threshold and summarization stub (full impl EP03)

**Checkpoint**: US3+US4 complete - streaming works, context compression handled

---

## Phase 5: US5 - Checkpointing (P1)

**Goal**: Emit checkpoint events for crash recovery
**Requirements**: FR-008, FR-009

### Tests (write first)

- [x] T035 [P] [US5] Unit test: CheckpointHandler emits events on triggers in `tests/unit/orchestration/checkpoint.test.ts`
- [x] T036 [P] [US5] Unit test: Interval-based checkpoint fires after configured time in `tests/unit/orchestration/checkpoint.test.ts`
- [x] T037 [P] [US5] Unit test: CheckpointEvent contains full SessionState snapshot in `tests/unit/orchestration/checkpoint.test.ts`

### Implementation

- [x] T038 [US5] Create `src/orchestration/checkpoint.ts` with ICheckpointHandler interface
- [x] T039 [US5] Implement checkpoint triggers: PostToolUse hook, finding detection, phase change
- [x] T040 [US5] Implement interval-based checkpoint timer with configurable intervalMs

**Checkpoint**: US5 complete - checkpoints emit on all triggers

---

## Phase 6: US6+US7 - Session Management (P2)

**Goal**: Human-in-the-loop pauses and session resume
**Requirements**: FR-010, FR-011, FR-012

### Tests (write first)

- [x] T041 [P] [US7] Unit test: SessionState saves to JSON file in `tests/unit/orchestration/session-state.test.ts`
- [x] T042 [P] [US7] Unit test: loadState() restores SessionState from file in `tests/unit/orchestration/session-state.test.ts`
- [x] T043 [P] [US6] Unit test: Orchestrator.interrupt() pauses execution in `tests/unit/orchestration/orchestrator.test.ts`

### Implementation

- [x] T044 [US7] Create `src/orchestration/session-state.ts` with save/load functions
- [x] T045 [US7] Implement Orchestrator.resume() using SDK resume option
- [x] T046 [US7] Inject state summary into conversation on resume via SessionStart hook
- [x] T047 [US6] Implement Orchestrator.interrupt() for human-in-the-loop pauses

**Checkpoint**: US6+US7 complete - sessions save/resume, pauses work

---

## Phase 7: US8+US9 - Advanced Features (P2/P3)

**Goal**: Subagent delegation and cognitive workspace structure
**Requirements**: FR-013, FR-014, FR-015, FR-016

### Tests (write first)

- [x] T048 [P] [US8] Unit test: Subagent depth limit enforced in `tests/unit/orchestration/orchestrator.test.ts`
- [x] T049 [P] [US9] Unit test: CognitiveWorkspace builds hierarchical context in `tests/unit/orchestration/cognitive-workspace.test.ts`

### Implementation

- [x] T050 [US8] Add subagent depth tracking to Orchestrator (depth=1 limit per C8)
- [x] T051 [US9] Create `src/orchestration/cognitive-workspace.ts` with buildCognitiveWorkspace()
- [x] T052 [US9] Integrate cognitive workspace into systemPrompt.append

**Checkpoint**: US8+US9 complete - subagents limited, workspace structured

---

## Phase 8: Polish

**Goal**: Documentation, exports, integration readiness

- [x] T053 [P] Update `src/orchestration/index.ts` with all public exports
- [x] T054 [P] Add JSDoc comments to all public interfaces and classes
- [x] T055 Create integration test: Full orchestrator flow with mock tools in `tests/integration/orchestration/orchestrator-flow.test.ts`
- [x] T056 Validate against quickstart.md code examples - ensure patterns work
- [x] T057 Update CLAUDE.md with EP02 implementation notes
- [x] T058 Run test coverage, ensure > 80% on orchestration module

**Checkpoint**: EP02 complete, ready for EP03 integration

---

## MVP Scope

Minimum viable implementation (P1 only):

| Phase | Tasks | Description |
|-------|-------|-------------|
| 0: SDK Spike | T001-T004 | Validate SDK patterns |
| 1: Setup | T005-T009 | Directory structure, dependencies |
| 2: Foundational | T010-T017 | Types, errors, config |
| 3: US1+US2 | T018-T026 | Master loop, tool registration |
| 4: US3+US4 | T027-T034 | Context, streaming |
| 5: US5 | T035-T040 | Checkpointing |

**MVP Total**: 40 tasks (T001-T040)
**Full Feature**: 58 tasks

---

## Dependency Graph

```
Phase 0 (SDK Spike)
    ↓
Phase 1 (Setup)
    ↓
Phase 2 (Foundational)
    ↓
Phase 3 (US1+US2) ──→ Phase 4 (US3+US4) ──→ Phase 5 (US5)
                                               ↓
                                          Phase 6 (US6+US7)
                                               ↓
                                          Phase 7 (US8+US9)
                                               ↓
                                          Phase 8 (Polish)
```

---

## Execution Notes

### Parallelization

- Tasks marked `[P]` can run in parallel **within their phase**
- Complete each phase checkpoint before starting next phase
- Never parallelize tasks with explicit dependencies

### Testing Strategy (per ADR-0011)

- Unit tests: Mocked SDK, no API calls
- Integration tests: VCR recordings in `tests/integration/orchestration/recordings/`
- Run `bun run record` to refresh recordings when SDK patterns change

### File Paths Reference

| Module | Path |
|--------|------|
| Types | `src/orchestration/types.ts` |
| Orchestrator | `src/orchestration/orchestrator.ts` |
| Tool Registry | `src/orchestration/tool-registry.ts` |
| Checkpoint | `src/orchestration/checkpoint.ts` |
| Streaming | `src/orchestration/streaming.ts` |
| Session State | `src/orchestration/session-state.ts` |
| Cognitive Workspace | `src/orchestration/cognitive-workspace.ts` |
| Config | `src/orchestration/config.ts` |
| Errors | `src/errors/orchestration.ts` |

### Key SDK Imports

```typescript
import {
  query,
  tool,
  createSdkMcpServer,
  type SDKMessage,
  type HookCallback,
  type McpSdkServerConfigWithInstance,
} from '@anthropic-ai/claude-agent-sdk';
```

---

## Traceability

### User Stories → Tasks

| User Story | Tasks |
|------------|-------|
| US-001 | T018, T024, T025, T026 |
| US-002 | T019, T020, T021, T022, T023 |
| US-003 | T029, T033, T034 |
| US-004 | T027, T028, T030, T031, T032 |
| US-005 | T035, T036, T037, T038, T039, T040 |
| US-006 | T043, T047 |
| US-007 | T041, T042, T044, T045, T046 |
| US-008 | T048, T050 |
| US-009 | T049, T051, T052 |

### Requirements → Tasks

| Requirement | Tasks |
|-------------|-------|
| FR-001 | T024, T025 |
| FR-002 | T021, T022, T026 |
| FR-003 | T019, T020, T023 |
| FR-004 | T033 |
| FR-005 | T033 (via hook) |
| FR-006 | T029, T034 |
| FR-007 | T027, T030, T031, T032 |
| FR-008 | T035, T038, T039 |
| FR-009 | T037 |
| FR-010 | T043, T047 |
| FR-011 | T044, T045 |
| FR-012 | T046 |
| FR-013 | T048, T050 |
| FR-014 | T050 |
| FR-015 | T049, T051, T052 |
| FR-016 | T052 |

---

## Deferred Work

The following items were identified during EP02 implementation but deferred to future epics:

### VCR Integration Tests (Deferred to EP04)

**Issue**: The integration tests in `tests/integration/orchestration/` use mocked tools and don't make actual Claude API calls. The original plan specified VCR-style recordings for deterministic API testing.

**Current State**:
- `tests/integration/orchestration/recordings/` directory exists but is empty
- Integration tests verify component integration (ToolRegistry + CheckpointHandler + StreamProcessor, etc.)
- No actual `query()` calls are tested against recorded API responses

**Required Work** (to be added to EP04):
1. Implement VCR recording infrastructure for Claude API responses
2. Create `bun run record` script to capture API responses
3. Add true end-to-end integration tests that replay recordings
4. Remove or refactor mock-based "integration" tests to clarify their role as component tests

**Tracking**: Linear issue created for EP04 backlog

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-16 | Claude | Initial task generation |
| 2026-01-16 | Claude | Phase 8 complete; added Deferred Work section for VCR tests |
