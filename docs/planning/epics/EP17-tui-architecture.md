# EP17: TUI Architecture & Agent-Led Exploration

## Business Outcome Hypothesis

**If** we implement a proper Ink-based TUI architecture with dialog overlays, focus management, and agent-led exploration,
**Then** users can interact with agentlint findings through guided discovery without requiring CLI expertise,
**Measured by** user task completion rate, navigation errors, and time-to-insight.

## Classification

* **Type**: Foundation
* **Priority**: P0-Critical (Core Differentiator)
* **Size**: XL
* **Duration**: 10 weeks
* **Dependencies**: EP02 (Orchestration Core), EP11 (Quality & Security)
* **Replaces**: ADR-0021 (Conversational Interaction Model - to be recreated)

## In Scope

* Ink-based rendering as primary output path (replacing TerminalRenderer)
* Dialog overlay system with focus management
* Multi-step exploration flows with state persistence
* Agent-led discovery UI (findings → drill-down → recommendations)
* Keyboard navigation with vim-style bindings
* Component communication via message passing
* canUseTool integration for permission dialogs

## Out of Scope

* Mouse support
* Theming/customization beyond built-in styles
* Multi-window layouts
* External terminal integrations (tmux, screen)

## Key Deliverables

### Phase 1: Core Architecture (Weeks 1-4)

1. **Central App State Model**
   - Single source of truth for all UI state
   - Visibility flags for each dialog/view
   - Focus stack for overlay management
   - State persistence for crash recovery

2. **Dialog Overlay System**
   - Modal dialog container with backdrop
   - Focus trapping within active dialog
   - ESC to dismiss, configurable actions
   - Multi-step wizard support

3. **Component Communication**
   - Message type definitions for inter-component events
   - Event bus for decoupled communication
   - Action creators for state mutations

4. **Keyboard Navigation**
   - Global key handler with focus-aware routing
   - vim-style navigation (j/k for up/down, h/l for left/right)
   - Number keys for quick selection (1-9)
   - Space/Enter for confirmation

### Phase 2: Agent-Led Exploration (Weeks 5-7)

1. **Findings Presenter**
   - Display analysis findings with severity indicators
   - Expandable detail sections
   - Action buttons for drill-down

2. **Exploration Flow Controller**
   - Agent presents findings → user selects interest
   - Agent provides deeper analysis → user can drill further
   - Breadcrumb trail for navigation context
   - Back navigation to previous views

3. **Recommendation Dialog**
   - Present actionable recommendations
   - Show evidence supporting each recommendation
   - Accept/dismiss/defer options
   - Track user decisions

4. **Permission Dialog Integration**
   - canUseTool hook integration
   - Remember decisions (session/permanent)
   - Bulk permission handling

### Phase 3: Migration & Integration (Weeks 8-9)

1. **TerminalRenderer Migration**
   - Replace ora spinner with Ink Spinner
   - Replace console.log with Ink Text components
   - Migrate question-presenter to Ink dialogs
   - Remove readline dependency

2. **Orchestrator Integration**
   - StreamChunk rendering in Ink
   - Progress indicators for long operations
   - Error display with recovery options

3. **CLI Command Integration**
   - `agentlint` (interactive mode) → full TUI
   - `agentlint analyse` → headless with TUI summary
   - `--no-tui` flag for CI/script usage

### Phase 4: Cleanup (Week 10)

1. **Dead Code Removal**
   - Remove TerminalRenderer after migration
   - Remove readline-based question presenter
   - Remove ora dependency

2. **Test Migration**
   - Ink component tests with ink-testing-library
   - Integration tests for exploration flows
   - Snapshot tests for UI consistency

3. **Documentation**
   - Recreate ADR-0021 as "TUI Architecture & Interaction Model"
   - Update Arc42 §5 with TUI component diagram
   - Component API documentation

## Technical Approach

### Inspired by OpenCode TUI Patterns

Based on OpenCode research, adopting these patterns:

1. **Central State Model** (like OpenCode's `appModel`)
```typescript
interface AppState {
  // View visibility
  showFindingsDialog: boolean;
  showPermissionDialog: boolean;
  showRecommendationDialog: boolean;

  // Focus management
  focusStack: FocusTarget[];
  activeDialog: DialogType | null;

  // Exploration state
  currentFindings: Finding[];
  selectedFindingIndex: number;
  explorationPath: ExplorationStep[];

  // Session state
  analysisPhase: AnalysisPhase;
  streamBuffer: StreamChunk[];
}
```

2. **Message-Based Communication**
```typescript
type AppMessage =
  | { type: 'SHOW_DIALOG'; dialog: DialogType }
  | { type: 'HIDE_DIALOG' }
  | { type: 'SELECT_FINDING'; index: number }
  | { type: 'DRILL_DOWN'; findingId: string }
  | { type: 'NAVIGATE_BACK' }
  | { type: 'PERMISSION_RESPONSE'; allowed: boolean; remember: boolean };

function appReducer(state: AppState, message: AppMessage): AppState {
  switch (message.type) {
    case 'SHOW_DIALOG':
      return {
        ...state,
        activeDialog: message.dialog,
        focusStack: [...state.focusStack, message.dialog],
      };
    // ... other cases
  }
}
```

3. **Dialog Overlay Pattern**
```typescript
const DialogOverlay: FC<{ visible: boolean; children: ReactNode }> = ({
  visible,
  children,
}) => {
  if (!visible) return null;

  return (
    <Box flexDirection="column" borderStyle="round" padding={1}>
      {children}
    </Box>
  );
};
```

4. **Focus-Aware Key Handling**
```typescript
useInput((input, key) => {
  // Block input when dialog is active
  if (state.activeDialog && !isDialogKey(input, key)) {
    return;
  }

  if (key.escape && state.activeDialog) {
    dispatch({ type: 'HIDE_DIALOG' });
    return;
  }

  // Route to appropriate handler
  if (state.activeDialog) {
    handleDialogInput(state.activeDialog, input, key);
  } else {
    handleMainInput(input, key);
  }
});
```

### Component Hierarchy

```
<App>
  <MainView>
    <Header />
    <FindingsList />
    <StatusBar />
  </MainView>

  <DialogOverlay visible={showFindingsDialog}>
    <FindingsDetailDialog />
  </DialogOverlay>

  <DialogOverlay visible={showPermissionDialog}>
    <PermissionDialog />
  </DialogOverlay>

  <DialogOverlay visible={showRecommendationDialog}>
    <RecommendationDialog />
  </DialogOverlay>
</App>
```

## Success Criteria

- [ ] All output renders through Ink (no console.log in production paths)
- [ ] Dialog system supports multi-step exploration flows
- [ ] Keyboard navigation works without mouse
- [ ] Agent can lead users through findings discovery
- [ ] canUseTool permissions integrate with TUI dialogs
- [ ] TerminalRenderer and readline removed from codebase
- [ ] Clean integration with EP14-EP16 analysis components
- [ ] Session timeline visualization using EP15 TimelineVizEvent structures

## EP15 Integration Notes

EP15 Session Intelligence provides `TimelineVizEvent` structures specifically designed for TUI rendering:
- `src/sessions/extraction/timeline-viz.ts` - Consistent event structure for rendering
- Key moment flagging (errors, compressions, phase transitions)
- Tool categorization (navigation, mutation, execution, coordination, external)
- Utility functions: `filterKeyMoments()`, `groupEventsByType()`, `getEventCounts()`

The Exploration Flow Controller (Phase 2) should consume these structures for session drill-down views.

## Constitution Alignment

| Principle | Alignment |
|-----------|-----------|
| III. Causal-First | TUI enables drill-down from symptom to cause |
| V. Agent-Aware | UI serves agent's cognitive needs for presenting findings |
| VI. User-Agency | Guided discovery, not automated actions |
| IX. Intelligent Tooling | Rich interaction model for agent reasoning |

## Related Documents

- [ADR-0021: TUI Architecture & Interaction Model](../../architecture/adr/0021-tui-architecture-interaction-model.md) (to be recreated)
- [ADR-0004: Agent Architecture Decision](../../architecture/adr/0004-agent-architecture.md)
- [Strategic Review](../../review/agentlint-strategic-review-jan26.md)
- [OpenCode TUI Research Notes](../../review/opencode-tui-research.md)
