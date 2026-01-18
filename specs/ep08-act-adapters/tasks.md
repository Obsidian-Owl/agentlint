# Tasks: ACT Subagents

> **Epic**: EP08
> **Generated**: 2026-01-18
> **Total Tasks**: 32
> **MVP Tasks**: 27

---

## Summary

| Phase | Tasks | Parallelizable |
|-------|-------|----------------|
| Setup | 4 | 3 |
| Foundational | 6 | 2 |
| US1: Auto Detection | 6 | 3 |
| US2: Claude Code Analyzer | 6 | 3 |
| US3: Generalized Fallback | 5 | 2 |
| US4: Registration | 5 | 2 |

---

## Phase 1: Setup

**Goal**: Initialize `src/act/` module structure

- [x] T001 [P] Create directory structure: `src/act/`, `src/act/instructions/`, `src/act/__tests__/`
- [x] T002 [P] Create `src/act/index.ts` with placeholder exports for `buildACTSubagents()`
- [x] T003 [P] Create `src/act/types.ts` stub with TODO markers
- [x] T004 Verify directory structure matches plan.md (manual inspection)

**Checkpoint**: Setup complete
- [ ] Directory structure exists
- [ ] Module exports available (empty stubs)

---

## Phase 2: Foundational

**Goal**: Core types and registry infrastructure before user stories

**Requirements**: FR-001, FR-004

### Types (from contracts/interfaces.ts)

- [ ] T005 Extend `ACTType` in EP05 `src/tools/types.ts` to add `aider`, `copilot-cli` values, then re-export from `src/act/types.ts`
- [ ] T006 [P] Implement `AgentDefinition` interface matching SDK shape in `src/act/types.ts`
- [ ] T007 [P] Implement `ACTInstructions` interface and `ACTInstructionsSchema` Zod validator in `src/act/types.ts`
- [ ] T008 Implement `ACTAnalysisFindings`, `ACTConfigIssue`, `ACTSessionIssue`, `ACTRecommendation` output types in `src/act/types.ts`

### Registry

- [ ] T009 Implement `IACTSubagentRegistry` interface in `src/act/registry.ts`
- [ ] T010 Implement `ACTSubagentRegistry` class with `register()`, `get()`, `list()`, `getForACTType()`, `toAgentsOption()` methods in `src/act/registry.ts`

**Checkpoint**: Foundation ready
- [ ] All types compile without errors
- [ ] Registry can be instantiated
- [ ] `toAgentsOption()` returns valid SDK format

---

## Phase 3: User Story 1 - Automatic ACT Detection and Subagent Invocation (P1)

**Goal**: Orchestrator integration with subagent system
**Requirements**: FR-004, FR-005

### Tests (write first)

- [ ] T011 [P] [US1] Unit test: `ACTSubagentRegistry.toAgentsOption()` returns Record<string, AgentDefinition> in `src/act/__tests__/registry.test.ts`
- [ ] T012 [P] [US1] Unit test: `buildACTSubagents()` returns all registered subagents in `src/act/__tests__/index.test.ts`
- [ ] T013 [P] [US1] Unit test: Registry correctly maps ACT types to subagents via `getForACTType()` in `src/act/__tests__/registry.test.ts`

### Implementation

- [ ] T014 [US1] Implement `buildACTSubagents()` function in `src/act/index.ts` that instantiates registry and returns `toAgentsOption()` result
- [ ] T015 [US1] Create `src/act/instructions/index.ts` to aggregate all instruction definitions (empty array initially)
- [ ] T016 [US1] Export `DEFAULT_ACT_TOOLS` and `GENERALIZED_ACT_TOOLS` constants in `src/act/types.ts`

**Checkpoint**: US1 complete
- [ ] All US1 tests pass
- [ ] `buildACTSubagents()` callable and returns empty agents object

---

## Phase 4: User Story 2 - Claude Code Analysis Specialist (P1)

**Goal**: Implement Claude Code analyzer subagent with context-engineered prompt
**Requirements**: FR-002, FR-006

### Tests (write first)

- [ ] T017 [P] [US2] Unit test: `claudeCodeInstructions` validates against `ACTInstructionsSchema` in `src/act/__tests__/instructions.test.ts`
- [ ] T018 [P] [US2] Unit test: Claude Code instructions include all 5 default tools (discover_configs, parse_config, analyze_hierarchy, search_sessions, get_session_stats) in `src/act/__tests__/instructions.test.ts`
- [ ] T019 [P] [US2] Unit test: Claude Code instructions have `actTypes: ['claude-code']` and `priority: 100` in `src/act/__tests__/instructions.test.ts`

### Implementation

- [ ] T020 [US2] Create `src/act/instructions/claude-code.ts` implementing `ACTInstructions` with full prompt from `contracts/claude-code-instructions.md`
- [ ] T021 [US2] Register `claudeCodeInstructions` in `src/act/instructions/index.ts` export array
- [ ] T022 [US2] Verify prompt size < 50KB (NFR-002) - add comment with byte count

**Checkpoint**: US2 complete
- [ ] All US2 tests pass
- [ ] Claude Code analyzer registered in subagent system
- [ ] Prompt follows context engineering structure (Role → Domain → Task → Output)

---

## Phase 5: User Story 3 - Generalized Analysis Fallback (P1)

**Goal**: Implement fallback analyzer for unknown ACTs
**Requirements**: FR-003

### Tests (write first)

- [ ] T023 [P] [US3] Unit test: `generalizedInstructions` validates against `ACTInstructionsSchema` in `src/act/__tests__/instructions.test.ts`
- [ ] T024 [P] [US3] Unit test: Generalized instructions have `actTypes: ['agents-md', 'unknown']` and `priority: 10` in `src/act/__tests__/instructions.test.ts`

### Implementation

- [ ] T025 [US3] Create `src/act/instructions/generalized.ts` implementing `ACTInstructions` with prompt from `contracts/generalized-instructions.md`
- [ ] T026 [US3] Register `generalizedInstructions` in `src/act/instructions/index.ts` (AFTER claude-code for priority ordering)
- [ ] T027 [US3] Verify generalized uses only `GENERALIZED_ACT_TOOLS` subset (discover_configs, parse_config)

**Checkpoint**: US3 complete
- [ ] All US3 tests pass
- [ ] Generalized analyzer registered as fallback
- [ ] Lower priority ensures it's only used when no specific analyzer matches

---

## Phase 6: User Story 4 - Subagent Registration in Orchestrator (P2)

**Goal**: Integrate ACT subagents into EP02 Orchestrator
**Requirements**: FR-005

### Tests (write first)

- [ ] T028 [P] [US4] Integration test: Orchestrator query options include `agents` from `buildACTSubagents()` in `src/orchestration/__tests__/orchestrator.test.ts`
- [ ] T029 [P] [US4] Integration test: Orchestrator `allowedTools` includes 'Task' to enable subagent invocation in `src/orchestration/__tests__/orchestrator.test.ts`

### Implementation

- [ ] T030 [US4] Import `buildACTSubagents` in `src/orchestration/orchestrator.ts`
- [ ] T031 [US4] Add `agents: buildACTSubagents()` to SDK query options in `Orchestrator.run()` method
- [ ] T032 [US4] Ensure 'Task' tool is in allowedTools array (enables subagent invocation per SDK)

**Checkpoint**: US4 complete
- [ ] All US4 tests pass
- [ ] Orchestrator passes subagents to SDK
- [ ] Claude can invoke ACT subagents via Task tool

---

## MVP Scope

Minimum viable implementation (P1 user stories):

- Phase 1: Setup (T001-T004)
- Phase 2: Foundational (T005-T010)
- Phase 3: US1 - Auto Detection (T011-T016)
- Phase 4: US2 - Claude Code Analyzer (T017-T022)
- Phase 5: US3 - Generalized Fallback (T023-T027)

**Total MVP**: 27 tasks

**Full Feature**: 32 tasks (includes US4 orchestrator integration)

---

## Deferred (P3)

User Story 5 (User-Extensible ACT Instructions) is deferred per spec:
- FR-007: Load from `~/.agentlint/act-instructions/`
- Tasks will be generated in a future iteration

---

## Execution Notes

- Tasks marked `[P]` can run in parallel within their phase
- Complete each phase before starting the next
- Each user story should be independently testable after its checkpoint
- Run `bun test` after each checkpoint
- Prompt content comes from `contracts/*.md` files - copy verbatim as template literals
- Registry integration point is in `Orchestrator.run()` at line ~203 (query options)
- NFR-001 (< 100ms loading) testable via registry instantiation timing
- NFR-002 (< 50KB prompts) verify with `prompt.length` check in tests
