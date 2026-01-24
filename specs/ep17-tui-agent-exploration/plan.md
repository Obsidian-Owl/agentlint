# Implementation Plan: TUI Architecture & Agent-Led Exploration

> **Epic**: EP17
> **Spec**: specs/ep17-tui-agent-exploration/spec.md
> **Created**: 2026-01-24
> **Status**: Design Complete
> **Author**: Claude Opus 4.5

---

## Summary

**Primary Requirement**: Replace TerminalRenderer + readline UI with an Ink-based TUI that enables agent-led exploration where the agent scans the user's ACT environment, presents findings conversationally, and guides users through discovery.

**Technical Approach**: Build a React/Ink component tree with centralized useReducer state management, dialog overlay system for permissions/recommendations, and LLM-interpreted natural language input. The agent becomes the primary navigator - user input is sent to the LLM for interpretation rather than pattern-matched in UI code.

---

## Technical Context

> Fill in project-specific values. Mark unknowns as `[NEEDS CLARIFICATION]`.

| Aspect | Value |
|--------|-------|
| **Language/Version** | TypeScript 5.x |
| **Primary Dependencies** | Ink 5.x, @inkjs/ui 2.x, React 18, ink-testing-library |
| **Storage** | File system (permissions.json), in-memory (AppState) |
| **Testing Framework** | Bun test + ink-testing-library |
| **Target Platform** | CLI (Bun/Node.js) |
| **Project Type** | CLI Tool with TUI |
| **Performance Goals** | < 3s to first output, < 50ms input latency |
| **Constraints** | Keyboard-only (no mouse), 80-column minimum, TTY detection for headless |
| **Scale/Scope** | Single user, local-first |

---

## Constitution Check

> Validate against project constitution at `.specify/memory/constitution.md`

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Local-First | Pass | All UI runs locally; only LLM API calls are external |
| II | Improvement-Oriented | Pass | TUI surfaces historical context from baselines |
| III | Causal-First | Pass | Drill-down navigation enables symptom-to-cause exploration |
| IV | Mixed-Methods | Pass | Agent decides what to present; UI doesn't constrain analysis |
| V | Language-Agnostic | Pass | UI layer has no language dependencies |
| VI | Agent-Agnostic | Pass | UI consumes generic Finding/Recommendation types |
| VII | Intelligent Tooling | Pass | LLM interprets all input; no hardcoded navigation logic in UI |
| VIII | Compounding Value | Pass | Permission memory, session checkpoints enable return value |
| IX | Agent-Aware | Pass | UI designed to serve agent's conversational presentation needs |

**Gate Status**: [x] All principles pass

---

## Project Structure

### Documentation Structure

```
specs/ep17-tui-agent-exploration/
├── spec.md           # Feature specification
├── plan.md           # This file
├── research.md       # Research findings (Phase 1)
├── data-model.md     # Entity definitions (Phase 2)
├── quickstart.md     # Usage guide (Phase 2)
├── contracts/        # API definitions (Phase 2)
│   └── interfaces.ts # TypeScript interfaces
└── checklists/       # Validation checklists
    ├── requirements.md
    └── design.md
```

### Source Code Structure (Proposed)

```
src/
├── tui/                        # NEW: TUI layer (replaces cli/renderers/)
│   ├── index.ts                # Public exports
│   ├── types.ts                # AppState, AppMessage, etc.
│   ├── state/                  # State management
│   │   ├── app-reducer.ts      # Central reducer
│   │   ├── app-context.tsx     # React context provider
│   │   └── actions.ts          # Action creators
│   ├── components/             # Ink components
│   │   ├── App.tsx             # Root app (NEW - replaces cli/components/App.tsx)
│   │   ├── AgentOutput.tsx     # Streaming agent text with markdown (NEW)
│   │   ├── InputField.tsx      # User input capture with buffer (NEW)
│   │   ├── DialogOverlay.tsx   # Modal dialog system (NEW)
│   │   ├── PermissionDialog.tsx # Session/permanent permissions (NEW)
│   │   ├── RecommendationDialog.tsx # Accept/dismiss/defer (NEW)
│   │   ├── Breadcrumbs.tsx     # Navigation context display (NEW)
│   │   ├── SessionTimeline.tsx # EP15 integration (P3) (NEW)
│   │   ├── Progress.tsx        # MOVE from cli/components/ (reuse)
│   │   ├── FindingsList.tsx    # MOVE from cli/components/ (reuse + enhance)
│   │   ├── Summary.tsx         # MOVE from cli/components/ (reuse)
│   │   ├── CausalTree.tsx      # MOVE from cli/components/ (reuse)
│   │   └── CompareView.tsx     # MOVE from cli/components/ (reuse)
│   ├── hooks/                  # Custom hooks
│   │   ├── useKeyHandler.ts    # Global key handling
│   │   ├── useStreamBuffer.ts  # Input buffering during streaming
│   │   └── useFocusManager.ts  # Dialog focus trapping
│   ├── renderers/              # Output adapters
│   │   ├── ink-renderer.ts     # TUI mode (default)
│   │   └── headless-renderer.ts # JSON output for CI
│   └── permissions/            # Permission persistence
│       ├── store.ts            # ~/.agentlint/permissions.json
│       └── types.ts
├── cli/
│   ├── components/             # DELETE after migration (except colors.ts)
│   ├── renderers/              # DELETE: Replaced by tui/renderers
│   ├── utils/colors.ts         # KEEP: useColors() hook reused by tui/
│   └── ...                     # KEEP: program.ts, commands/, utils/
└── orchestration/              # No changes - EP17 consumes StreamChunk
```

### Existing Component Disposition

| Component | Current Location | Action | Notes |
|-----------|-----------------|--------|-------|
| Progress | cli/components/ | Move to tui/ | Reuse as-is |
| FindingsList | cli/components/ | Move + enhance | Add keyboard selection |
| Summary | cli/components/ | Move to tui/ | Reuse as-is |
| CausalTree | cli/components/ | Move to tui/ | Reuse for drill-down |
| CompareView | cli/components/ | Move to tui/ | Reuse as-is |
| App | cli/components/ | Delete & Replace | New useReducer-based design in tui/ |
| question-presenter | cli/components/ | Delete | LLM input + dialogs replaces this |
| terminal-renderer | cli/renderers/ | Delete | ink-renderer replaces this |
| json-renderer | cli/renderers/ | Delete | headless-renderer replaces this |
| stream-renderer | cli/renderers/ | Delete | Interface moves to tui/ |
| useColors | cli/utils/ | Keep | Import from cli/utils/ (no move) |

---

## Complexity Tracking

> Only add rows if constitution principles require justified violations

| Principle | Violation | Justification | Mitigation |
|-----------|-----------|---------------|------------|
| None | - | - | - |

---

## Key Design Decisions

| Decision | Choice | Rationale | ADR |
|----------|--------|-----------|-----|
| State management | useReducer + Context | Standard React pattern, testable, matches Ink best practices ([Ink docs](https://github.com/vadimdemedes/ink)) | ADR-0021 |
| Input interpretation | LLM for all input | Constitution Principle VII - agent reasons, not UI code | ADR-0021 |
| Dialog system | Overlay with focus trap | Prevents accidental navigation during structured choices | N/A |
| Permission storage | JSON file | Simple, human-readable, local-first | N/A |
| Streaming buffer | Buffer until pause point | Responsive feel without interrupting agent mid-thought | Spec C5 |
| Legacy cleanup | Phase 4 removal | Complete migration before cleanup prevents breaking changes | N/A |

---

## Architecture Overview

### Component Hierarchy

```
<App>                          # Root, provides AppContext
├── <AgentOutput>              # Streams agent text (markdown rendered)
├── <InputField>               # Captures user input
├── <Breadcrumbs>              # Shows navigation context
└── <DialogOverlay>            # Conditionally renders modals
    ├── <PermissionDialog>     # When permission requested
    └── <RecommendationDialog> # When recommendation presented
```

### Data Flow

```
User Input → InputBuffer → (on pause) → Agent Prompt
                                           ↓
StreamChunk ← Agent SDK ← LLM Response
    ↓
appReducer → AppState update → React re-render
    ↓
Ink renders to terminal
```

### State Machine

```
┌──────────────────────────────────────────────────────────────┐
│                           AppState                           │
├──────────────────────────────────────────────────────────────┤
│ analysisPhase: 'idle' | 'scanning' | 'presenting' | 'exploring' │
│ viewStack: DialogType[]     (modal stack)                    │
│ explorationPath: ExplorationStep[]  (navigation breadcrumbs) │
│ inputBuffer: string         (buffered during streaming)      │
│ streamBuffer: StreamChunk[] (current agent output)           │
│ findings: Finding[]         (discovered issues)              │
│ recommendations: Recommendation[]                            │
│ isStreaming: boolean        (agent currently outputting)     │
└──────────────────────────────────────────────────────────────┘

State Transitions:
  idle → scanning (on agentlint invocation)
  scanning → presenting (analysis complete, showing findings)
  presenting → exploring (user asks follow-up)
  exploring → exploring (deeper drill-down)
  exploring → presenting (user says "back")
  * → idle (user exits or session ends)
```

---

## Implementation Phases

### Phase 1: Core Architecture (Tasks 1-8)

**Goal**: Foundation that enables conversational interaction

1. Create `src/tui/` module structure
2. Define AppState, AppMessage types in `types.ts`
3. Implement appReducer with state transitions
4. Create AppContext provider with useReducer
5. Build DialogOverlay component with focus trapping
6. Implement useKeyHandler hook (vim j/k, 1-9, ESC)
7. Create basic AgentOutput component (markdown streaming)
8. Create basic InputField component with buffer

**Deliverable**: Components render and state flows, but not wired to orchestrator

### Phase 2: Agent-Led Exploration (Tasks 9-14)

**Goal**: Conversational discovery flow

9. Implement ExplorationStep tracking in state
10. Create Breadcrumbs component
11. Build ConversationalContext entity for agent prompt
12. Wire InputField to send user input to orchestrator
13. Implement PermissionDialog with session/permanent choice
14. Implement RecommendationDialog with accept/dismiss/defer

**Deliverable**: Full exploration flow works with mock data

### Phase 3: Integration & Migration (Tasks 15-20)

**Goal**: Wire to existing systems, replace TerminalRenderer

15. Create InkRenderer implementing IStreamRenderer
16. Wire orchestrator StreamChunk to AgentOutput
17. Integrate canUseTool with PermissionDialog
18. Create HeadlessRenderer for --non-interactive mode
19. Update CLI entrypoint to use TUI by default
20. Add TTY detection for automatic mode selection

**Deliverable**: `agentlint` uses TUI, `--non-interactive` uses JSON

### Phase 4: Cleanup & Polish (Tasks 21-25)

**Goal**: Remove legacy, test coverage, documentation

21. Remove TerminalRenderer class
22. Remove ora dependency from package.json
23. Remove readline-based question-presenter
24. Migrate component tests to ink-testing-library
25. Update ADR-0021 with final architecture

**Deliverable**: Clean codebase, >80% TUI test coverage

---

## References

- **Spec**: [specs/ep17-tui-agent-exploration/spec.md](./spec.md)
- **Epic**: EP17 in Linear
- **Arc42**: §5 Building Blocks (CLI layer)
- **ADRs**: [ADR-0021: TUI Architecture](../../docs/architecture/adr/0021-tui-architecture-interaction-model.md)
- **External**: [Ink GitHub](https://github.com/vadimdemedes/ink), [@inkjs/ui](https://github.com/vadimdemedes/ink-ui)

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-24 | Claude Opus 4.5 | Initial plan |
