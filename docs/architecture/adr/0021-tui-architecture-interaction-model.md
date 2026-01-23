---
status: proposed
date: 2026-01-23
decision-makers: [Project Lead]
consulted: []
informed: []
---

# ADR-0021: TUI Architecture & Interaction Model

## Context and Problem Statement

agentlint has Ink components (`src/cli/components/`) but uses `TerminalRenderer` with ora spinners and `console.log` as the primary output path. The question presenter uses Node.js readline directly. This creates several problems:

1. **Bypassed Components**: Ink components exist but aren't wired as the primary rendering path
2. **No Dialog System**: Cannot present overlays, multi-step wizards, or complex interactions
3. **No Focus Management**: No way to trap focus in dialogs or manage keyboard routing
4. **Rigid Output**: TerminalRenderer can only show linear output, not interactive layouts
5. **Poor canUseTool Integration**: Permission prompts use basic readline, not integrated with TUI

Research into OpenCode's TUI architecture (Bubble Tea-based) revealed patterns that solve these problems: central state model, dialog overlays with focus trapping, message-based component communication, and agent-led exploration flows.

## Decision Drivers

- **Agent-Led Discovery**: Agent presents findings, user explores interactively
- **User Agency**: Users should navigate, drill down, accept/dismiss at their pace (Constitution Principle V)
- **Component Reuse**: Leverage existing Ink components, don't reinvent
- **CI Compatibility**: Must support headless/batch mode for automation
- **Progressive Disclosure**: Simple choices first, complexity revealed on demand
- **Keyboard-First**: Full functionality without mouse

## Considered Options

1. **Minimal Enhancement** - Keep TerminalRenderer, add canUseTool callbacks only
2. **Full Ink Migration** - Replace TerminalRenderer with Ink as primary renderer
3. **OpenCode-Inspired Architecture** - Central state, dialog overlays, focus management

## Decision Outcome

Chosen option: **"OpenCode-Inspired Architecture"** - Implement a full TUI architecture based on patterns from OpenCode, using Ink as the rendering framework.

### Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│                          App.tsx                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    AppState (central)                     │  │
│  │  - viewStack: DialogType[]                                │  │
│  │  - focusTarget: FocusTarget                               │  │
│  │  - findings: Finding[]                                    │  │
│  │  - explorationPath: ExplorationStep[]                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│  ┌───────────────────────────┼──────────────────────────────┐  │
│  │                    MainView                               │  │
│  │  ┌─────────────┬─────────────────┬──────────────────┐    │  │
│  │  │   Header    │  FindingsList   │    StatusBar     │    │  │
│  │  └─────────────┴─────────────────┴──────────────────┘    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Dialog Overlays                          │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌───────────────────┐   │  │
│  │  │  Findings   │ │  Permission │ │   Recommendation  │   │  │
│  │  │   Detail    │ │   Dialog    │ │      Dialog       │   │  │
│  │  └─────────────┘ └─────────────┘ └───────────────────┘   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Global Key Handler                       │  │
│  │  - Routes keys based on focusTarget                       │  │
│  │  - ESC closes active dialog                               │  │
│  │  - j/k navigation, Enter/Space selection                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

### Key Patterns

#### 1. Central State Model

Single source of truth for all UI state:

```typescript
interface AppState {
  // View management
  viewStack: DialogType[];
  activeView: DialogType | 'main';

  // Focus management
  focusStack: FocusTarget[];
  keyBlocking: boolean;

  // Analysis state
  findings: Finding[];
  selectedFindingIndex: number;
  explorationPath: ExplorationStep[];

  // Stream state
  isAnalyzing: boolean;
  streamBuffer: StreamChunk[];
  progress: AnalysisProgress;
}
```

#### 2. Message-Based State Updates

All state changes through typed messages:

```typescript
type AppMessage =
  | { type: 'PUSH_DIALOG'; dialog: DialogType }
  | { type: 'POP_DIALOG' }
  | { type: 'SELECT_FINDING'; index: number }
  | { type: 'DRILL_DOWN'; findingId: string }
  | { type: 'STREAM_CHUNK'; chunk: StreamChunk }
  | { type: 'PERMISSION_RESPONSE'; allowed: boolean; remember: boolean };
```

#### 3. Dialog Overlay System

Dialogs render as overlays with focus trapping:

```typescript
const DialogOverlay: FC<{ visible: boolean; onClose: () => void }> = ({
  visible,
  onClose,
  children,
}) => {
  useInput((input, key) => {
    if (key.escape) onClose();
  }, { isActive: visible });

  if (!visible) return null;

  return (
    <Box flexDirection="column" borderStyle="round" padding={1}>
      {children}
    </Box>
  );
};
```

#### 4. Focus-Aware Key Routing

Keys route to active focus target:

```typescript
useInput((input, key) => {
  const target = state.focusStack[state.focusStack.length - 1];

  // Block main view keys when dialog is active
  if (target !== 'main' && !isDialogKey(input)) {
    return;
  }

  dispatch(routeKeyToHandler(target, input, key));
});
```

### Consequences

**Good:**
- Full interactive capability through Ink
- Dialog system enables multi-step exploration
- Agent can lead users through findings discovery
- Keyboard-first design works in all terminals
- State model makes testing straightforward
- canUseTool integrates cleanly with permission dialogs

**Bad:**
- Larger codebase than minimal enhancement
- Learning curve for Ink component patterns
- Migration effort to replace TerminalRenderer

**Neutral:**
- Requires deprecation of TerminalRenderer
- readline-based question presenter replaced by Ink dialogs

## Technical Implementation

### Phase 1: Core Architecture

1. Create `AppState` type and reducer
2. Implement `DialogOverlay` component
3. Add focus management with `useInput` hooks
4. Create base dialog components (confirmation, selection, text input)

### Phase 2: Migration

1. Replace TerminalRenderer spinner with Ink `<Spinner>`
2. Replace console.log output with Ink `<Text>` components
3. Migrate question-presenter to Ink dialog
4. Wire canUseTool to permission dialog

### Phase 3: Agent-Led Exploration

1. Implement FindingsDetailDialog with drill-down
2. Add RecommendationDialog with accept/dismiss
3. Create exploration flow controller
4. Add breadcrumb navigation

### CLI Modes

| Mode | Trigger | Behavior |
|------|---------|----------|
| Interactive | `agentlint` | Full TUI with dialogs and exploration |
| Batch | `--non-interactive` | Headless output, JSON results |
| CI | Detected TTY=false | Auto-batch mode |

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | All UI runs locally |
| II. Improvement-Oriented | Yes | Exploration enables deeper investigation |
| III. Causal-First | Yes | Drill-down traces symptoms to causes |
| V. User Agency | Yes | User navigates, accepts/dismisses |
| VII. Intelligent Tooling | Yes | Rich UI for agent reasoning |
| IX. Agent-Aware | Yes | UI serves agent presentation needs |

## Supersedes

This ADR supersedes the earlier draft ADR-0021 (Conversational Interaction Model) which focused narrowly on canUseTool callbacks. This revision expands scope to the full TUI architecture required for agent-led exploration.

## More Information

### Research Sources
- OpenCode TUI Architecture (Bubble Tea patterns)
- Ink documentation and examples
- ink-testing-library for component testing

### Related ADRs
- [ADR-0004: Agent Architecture](./0004-agent-architecture.md) - Agent orchestration design
- [ADR-0010: Session State and Checkpointing](./0010-session-state-and-checkpointing.md) - State persistence
