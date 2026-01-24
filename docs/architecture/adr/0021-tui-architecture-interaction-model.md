---
status: accepted
date: 2026-01-24
decision-makers: [Project Lead]
consulted: []
informed: []
---

# ADR-0021: TUI Architecture & Interaction Model

## Context and Problem Statement

agentlint had Ink components (`src/cli/components/`) but used `TerminalRenderer` with ora spinners and `console.log` as the primary output path. The question presenter used Node.js readline directly. This created several problems:

1. **Bypassed Components**: Ink components existed but weren't wired as the primary rendering path
2. **No Dialog System**: Could not present overlays, multi-step wizards, or complex interactions
3. **No Focus Management**: No way to trap focus in dialogs or manage keyboard routing
4. **Rigid Output**: TerminalRenderer could only show linear output, not interactive layouts
5. **Poor canUseTool Integration**: Permission prompts used basic readline, not integrated with TUI

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

### Implementation Status

As of EP17 (2026-01-24), the architecture has been fully implemented:

- **TerminalRenderer**: Deleted, replaced by HeadlessRenderer + InkRenderer
- **ora dependency**: Removed from package.json
- **cli/components/App.tsx**: Deleted, replaced by tui/components/App.tsx
- **State management**: useReducer with 17 message types in AppState
- **Renderers**: ITuiRenderer interface with InkRenderer (interactive) and HeadlessRenderer (batch)
- **Permission handling**: TuiPermissionHandler with session/permanent persistence
- **TTY detection**: Automatic mode selection via determineRenderMode()

### Architecture Overview

```
src/tui/
├── index.ts                    # Public exports
├── types.ts                    # AppState, AppMessage, ITuiRenderer, etc.
├── state/
│   ├── app-reducer.ts          # Central reducer (17 message types)
│   └── app-context.tsx         # React context provider with useReducer
├── components/
│   ├── App.tsx                 # Root app with AppProvider wrapper
│   ├── AgentOutput.tsx         # Streaming agent text with markdown
│   ├── InputField.tsx          # User input capture with buffer
│   ├── DialogOverlay.tsx       # Modal dialog system with focus trapping
│   ├── PermissionDialog.tsx    # Session/permanent permission choice
│   ├── RecommendationDialog.tsx# Accept/dismiss/defer actions
│   ├── Breadcrumbs.tsx         # Navigation context display
│   ├── Progress.tsx            # Progress bar (moved from cli)
│   ├── FindingsList.tsx        # Finding list with keyboard navigation
│   ├── Summary.tsx             # Analysis summary (moved from cli)
│   ├── CausalTree.tsx          # Causal chain visualization
│   └── CompareView.tsx         # Baseline comparison
├── hooks/
│   ├── useKeyHandler.ts        # Vim j/k, 1-9, ESC handling
│   ├── useFocusManager.ts      # Dialog focus trapping
│   └── useStreamBuffer.ts      # Input buffering during streaming
├── renderers/
│   ├── types.ts                # ITuiRenderer re-export
│   ├── ink-renderer.ts         # Interactive mode with Ink
│   ├── headless-renderer.ts    # Batch mode for CI/automation
│   └── tui-stream-renderer.ts  # IStreamRenderer adapter
├── permissions/
│   └── tui-permission-handler.ts # canUseTool integration
└── utils/
    └── tty.ts                  # TTY detection utilities
```

### Key Patterns

#### 1. Central State Model

Single source of truth for all UI state:

```typescript
interface AppState {
  // View management
  activeDialog: DialogType | null;
  explorationPath: ExplorationStep[];

  // Focus management
  focusTarget: FocusTarget;
  keyBlocking: boolean;

  // Analysis state
  phase: AnalysisPhase;
  findings: Finding[];
  selectedFindingIndex: number;

  // Stream state
  isStreaming: boolean;
  streamBuffer: string;
  inputBuffer: string;

  // Permission handling
  pendingPermission: { tool: string; description: string; pattern?: string } | null;
}
```

#### 2. Message-Based State Updates

All state changes through typed messages (17 types):

```typescript
type AppMessage =
  | { type: 'SET_PHASE'; phase: AnalysisPhase }
  | { type: 'APPEND_STREAM'; content: string }
  | { type: 'CLEAR_STREAM' }
  | { type: 'SET_STREAMING'; isStreaming: boolean }
  | { type: 'OPEN_DIALOG'; dialog: DialogType }
  | { type: 'CLOSE_DIALOG' }
  | { type: 'ADD_FINDING'; finding: Finding }
  | { type: 'CLEAR_FINDINGS' }
  | { type: 'SELECT_FINDING'; index: number }
  | { type: 'PUSH_EXPLORATION'; step: ExplorationStep }
  | { type: 'POP_EXPLORATION' }
  | { type: 'CLEAR_EXPLORATION' }
  | { type: 'SET_FOCUS'; target: FocusTarget }
  | { type: 'SET_KEY_BLOCKING'; blocking: boolean }
  | { type: 'SET_INPUT_BUFFER'; value: string }
  | { type: 'APPEND_INPUT_BUFFER'; char: string }
  | { type: 'SET_PENDING_PERMISSION'; request: PermissionRequest | null };
```

#### 3. Dialog Overlay System

Dialogs render as overlays with focus trapping:

```typescript
export function DialogOverlay({
  visible,
  title,
  onClose,
  children,
  trapFocus = true,
}: DialogOverlayProps): React.ReactElement | null {
  // Focus trapping when visible
  useFocusManager({
    active: visible && trapFocus,
    onEscape: onClose,
  });

  if (!visible) return null;

  return (
    <Box flexDirection="column" borderStyle="round" padding={1}>
      {title && <Text bold>{title}</Text>}
      {children}
    </Box>
  );
}
```

#### 4. Renderer Interface

Both interactive and headless modes implement ITuiRenderer:

```typescript
interface ITuiRenderer {
  start(props: AppProps): void;
  stop(): void;
  renderChunk(chunk: StreamChunk): void;
  renderComplete(result: AnalyseResult): void;
  requestPermission(request: PermissionRequest): Promise<PermissionDecision>;
}
```

### CLI Modes

| Mode | Trigger | Behavior |
|------|---------|----------|
| Interactive | `agentlint` (TTY detected) | Full TUI with dialogs and exploration |
| Batch | `--non-interactive` | Headless output, auto-approve permissions |
| CI | No TTY detected | Auto-batch mode |
| JSON | `--json` | Structured JSON output |

Mode selection via `determineRenderMode()`:

```typescript
export function determineRenderMode(options: {
  nonInteractive?: boolean;
  json?: boolean;
  forceInteractive?: boolean;
}): 'ink' | 'headless' {
  if (options.nonInteractive || options.json) return 'headless';
  if (options.forceInteractive) return 'ink';
  return isInteractive() ? 'ink' : 'headless';
}
```

### Consequences

**Good:**
- Full interactive capability through Ink
- Dialog system enables multi-step exploration
- Agent can lead users through findings discovery
- Keyboard-first design works in all terminals
- State model makes testing straightforward
- canUseTool integrates cleanly with permission dialogs
- HeadlessRenderer supports CI/automation seamlessly

**Bad:**
- Larger codebase than minimal enhancement
- Learning curve for Ink component patterns

**Neutral:**
- TerminalRenderer deprecated and removed
- ora dependency removed
- Legacy cli/components/App.tsx replaced

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | All UI runs locally |
| II. Improvement-Oriented | Yes | Exploration enables deeper investigation |
| III. Causal-First | Yes | Drill-down traces symptoms to causes |
| V. User Agency | Yes | User navigates, accepts/dismisses |
| VII. Intelligent Tooling | Yes | Rich UI for agent reasoning |
| IX. Agent-Aware | Yes | UI serves agent presentation needs |

## Testing

The TUI uses ink-testing-library for component testing:

```typescript
import { render } from 'ink-testing-library';

test('renders permission dialog', () => {
  const { lastFrame } = render(
    <PermissionDialog
      tool="Bash"
      description="Run npm install"
      onDecision={jest.fn()}
    />
  );
  expect(lastFrame()).toContain('Bash');
});
```

Tests cover:
- State reducer transitions (unit tests)
- Component rendering (ink-testing-library)
- Renderer implementations (HeadlessRenderer, InkRenderer)
- Permission handler integration

## Supersedes

This ADR supersedes the earlier draft ADR-0021 (Conversational Interaction Model) which focused narrowly on canUseTool callbacks. This revision expands scope to the full TUI architecture required for agent-led exploration.

## More Information

### Implementation Epic
- EP17: TUI Architecture & Agent-Led Exploration

### Related ADRs
- [ADR-0004: Agent Architecture](./0004-agent-architecture.md) - Agent orchestration design
- [ADR-0010: Session State and Checkpointing](./0010-session-state-and-checkpointing.md) - State persistence
