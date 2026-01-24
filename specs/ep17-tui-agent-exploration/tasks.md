# Tasks: TUI Architecture & Agent-Led Exploration

> **Epic**: EP17
> **Generated**: 2026-01-24
> **Total Tasks**: 51
> **MVP Tasks**: 43 (Phases 1-4)

---

## Summary

| Phase | Tasks | Parallelizable | Goal |
|-------|-------|----------------|------|
| 1: Setup | 5 | 3 | Module structure and dependencies |
| 2: Core Architecture | 14 | 6 | Foundation that enables conversational interaction |
| 3: Agent-Led Exploration | 12 | 5 | Conversational discovery flow |
| 4: Integration & Migration | 12 | 4 | Wire to existing systems, replace TerminalRenderer |
| 5: Cleanup & Polish | 8 | 3 | Remove legacy, test coverage, documentation |

---

## Phase 1: Setup

**Goal**: Module structure and dependencies

- [x] T001 [P] Create `src/tui/` directory structure per plan.md
- [x] T002 [P] Create `src/tui/index.ts` with public exports
- [x] T003 [P] Verify ink 5.x and @inkjs/ui 2.x are in dependencies
- [x] T004 Add ink-testing-library to devDependencies
- [x] T005 Create `src/tui/permissions/` directory for permission persistence

**Checkpoint**: Setup complete
- [x] Directory structure exists
- [x] Dependencies installed

---

## Phase 2: Core Architecture

**Goal**: Foundation that enables conversational interaction

**Requirements**: FR-001, FR-004, FR-007, FR-010

### Types & State (write first)

- [x] T006 Create type definitions in `src/tui/types.ts` matching contracts/interfaces.ts
- [x] T007 [P] Create `AnalysisPhase`, `DialogType`, `FocusTarget` enums in types.ts
- [x] T008 [P] Create `ExplorationStep`, `AgentOption`, `ConversationalContext` interfaces in types.ts
- [x] T009 [P] Create `PermissionDecision`, `PermissionRecord`, `PermissionStore` interfaces in types.ts
- [x] T010 Create `AppState` interface with all fields per data-model.md
- [x] T011 Create `AppMessage` discriminated union type for reducer actions
- [x] T012 Create `createInitialState()` factory function

### Reducer & Context

- [x] T013 Write unit tests for appReducer in `tests/unit/tui/app-reducer.test.ts`
- [x] T014 Implement appReducer in `src/tui/state/app-reducer.ts` with all state transitions
- [x] T015 Create AppContext provider in `src/tui/state/app-context.tsx` with useReducer
- [x] T016 Write unit tests for AppContext in `tests/unit/tui/app-context.test.tsx`

### Core Hooks

- [x] T017 [P] Implement useKeyHandler hook in `src/tui/hooks/useKeyHandler.ts` (vim j/k, 1-9, ESC)
- [x] T018 [P] Implement useFocusManager hook in `src/tui/hooks/useFocusManager.ts` for dialog focus trapping
- [x] T019 [P] Implement useStreamBuffer hook in `src/tui/hooks/useStreamBuffer.ts` for input buffering

**Checkpoint**: Core Architecture complete
- [x] All type definitions compile
- [x] Reducer handles all 16 message types
- [x] AppContext provides state and dispatch
- [x] Hooks tested in isolation

---

## Phase 3: Agent-Led Exploration

**Goal**: Conversational discovery flow

**Requirements**: FR-003, FR-005, FR-006, FR-008

### Tests First

- [x] T020 [P] Write component tests for DialogOverlay in `tests/unit/tui/components/DialogOverlay.test.tsx`
- [x] T021 [P] Write component tests for AgentOutput in `tests/unit/tui/components/AgentOutput.test.tsx`
- [x] T022 [P] Write component tests for InputField in `tests/unit/tui/components/InputField.test.tsx`
- [x] T023 [P] Write component tests for Breadcrumbs in `tests/unit/tui/components/Breadcrumbs.test.tsx`

### Components

- [x] T024 Implement DialogOverlay component in `src/tui/components/DialogOverlay.tsx` with focus trapping
- [x] T025 Implement AgentOutput component in `src/tui/components/AgentOutput.tsx` with markdown streaming
- [x] T026 Implement InputField component in `src/tui/components/InputField.tsx` with buffer
- [x] T027 Implement Breadcrumbs component in `src/tui/components/Breadcrumbs.tsx`

### Dialogs

- [x] T028 Write component tests for PermissionDialog in `tests/unit/tui/components/PermissionDialog.test.tsx`
- [x] T029 Implement PermissionDialog in `src/tui/components/PermissionDialog.tsx` with session/permanent choice
- [x] T030 Write component tests for RecommendationDialog in `tests/unit/tui/components/RecommendationDialog.test.tsx`
- [x] T031 Implement RecommendationDialog in `src/tui/components/RecommendationDialog.tsx` with accept/dismiss/defer

**Checkpoint**: Agent-Led Exploration complete
- [x] All component tests pass
- [x] DialogOverlay traps focus correctly
- [x] InputField buffers input during streaming
- [x] Permission and Recommendation dialogs render correctly

---

## Phase 4: Integration & Migration

**Goal**: Wire to existing systems, replace TerminalRenderer

**Requirements**: FR-001, FR-002, FR-009, FR-011, FR-012

### Root App Component

- [x] T032 Write component tests for new App in `tests/unit/tui/components/App.test.tsx`
- [x] T033 Implement new App component in `src/tui/components/App.tsx` (replaces cli/components/App.tsx)
- [x] T034 Wire App to use AppContext provider

### Renderers

- [x] T035 Create ITuiRenderer interface in `src/tui/renderers/types.ts`
- [x] T036 [P] Write tests for InkRenderer in `tests/unit/tui/renderers/ink-renderer.test.ts`
- [x] T037 Implement InkRenderer in `src/tui/renderers/ink-renderer.ts` implementing ITuiRenderer
- [x] T038 [P] Write tests for HeadlessRenderer in `tests/unit/tui/renderers/headless-renderer.test.ts`
- [x] T039 Implement HeadlessRenderer in `src/tui/renderers/headless-renderer.ts` for --non-interactive mode

### Integration

- [x] T040 Wire orchestrator StreamChunk to AgentOutput via InkRenderer
- [x] T041 Integrate canUseTool with PermissionDialog overlays
- [x] T042 [P] Add TTY detection utility in `src/tui/utils/tty.ts`
- [x] T043 Update CLI entrypoint in `src/cli/program.ts` to use TUI by default

**Checkpoint**: Integration & Migration complete
- [x] `agentlint` runs with TUI mode
- [x] `agentlint --non-interactive` outputs JSON
- [x] TTY detection works for automatic mode selection
- [x] canUseTool triggers permission dialog

---

## Phase 5: Cleanup & Polish

**Goal**: Remove legacy, test coverage, documentation

**Requirements**: FR-014, NFR-005

### Move Reusable Components

- [x] T044 [P] Move Progress component from `src/cli/components/` to `src/tui/components/`
- [x] T045 [P] Move FindingsList component and enhance with keyboard selection
- [x] T046 [P] Move Summary, CausalTree, CompareView components to `src/tui/components/`

### Delete Legacy

- [x] T047 Delete `src/cli/renderers/terminal-renderer.ts`
- [ ] T048 Delete `src/cli/components/question-presenter.ts` (BLOCKED: still used by can-use-tool.ts for AskUserQuestion)
- [x] T049 Delete `src/cli/components/App.tsx` (old version replaced by tui/components/App.tsx)
- [x] T050 Remove ora dependency from package.json

### Documentation

- [x] T051 Update ADR-0021 with final TUI architecture

**Checkpoint**: Cleanup & Polish complete
- [x] No references to TerminalRenderer or ora
- [ ] question-presenter still needed for AskUserQuestion (can be migrated in future epic)
- [x] All reusable components migrated to src/tui/
- [x] >80% test coverage on TUI components
- [x] ADR-0021 documents final architecture

---

## MVP Scope

Minimum viable implementation (agent-led TUI working end-to-end):

- **Phase 1: Setup**: T001-T005 (5 tasks)
- **Phase 2: Core Architecture**: T006-T019 (14 tasks)
- **Phase 3: Agent-Led Exploration**: T020-T031 (12 tasks)
- **Phase 4: Integration & Migration**: T032-T043 (12 tasks, critical path)

**Total MVP**: 43 tasks

Phase 5 (Cleanup) can be deferred if needed, but is recommended for code quality.

---

## Execution Notes

### Parallelization

- Tasks marked `[P]` can run in parallel within their phase
- Complete each phase before starting the next
- Phase checkpoints validate phase completion

### Dependencies

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
                                    ↓
                              US-001, US-002, US-003 complete
```

### Test-First Approach

- Write tests before implementation (T013 before T014, T020-T023 before T024-T027)
- Use ink-testing-library for component tests
- Reducer tests use pure function testing (no mocking needed)

### User Story Coverage

| User Story | Primary Tasks |
|------------|---------------|
| US-001 Agent-Led Discovery | T025 (AgentOutput), T033 (App), T040 (StreamChunk wire) |
| US-002 Conversational Drill-Down | T026 (InputField), T027 (Breadcrumbs), T014 (reducer) |
| US-003 Recommendation Flow | T030-T031 (RecommendationDialog) |
| US-004 Permission Dialog | T028-T029 (PermissionDialog), T041 (canUseTool) |
| US-005 Keyboard Navigation | T017 (useKeyHandler), T045 (FindingsList enhancement) |
| US-006 Headless Mode | T038-T039 (HeadlessRenderer), T042-T043 (TTY detection) |

### File Disposition Reference

| Action | Files |
|--------|-------|
| **CREATE** | All `src/tui/**` files |
| **MOVE** | Progress, FindingsList, Summary, CausalTree, CompareView from cli/components/ |
| **DELETE** | terminal-renderer.ts, question-presenter.ts, cli/App.tsx |
| **KEEP** | cli/utils/colors.ts (useColors hook), cli/commands/*, cli/program.ts |

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-24 | Claude Opus 4.5 | Initial task generation |
