# Research Findings: EP17 TUI Architecture

> **Epic**: EP17
> **Created**: 2026-01-24
> **Status**: Complete

---

## Decision Log

### 1. UI Framework: Ink vs Bubble Tea vs Custom

**Decision**: Continue with Ink (already a dependency)

**Rationale**:
- Ink 5.x already in package.json and @inkjs/ui 2.x available
- React mental model aligns with existing component structure
- ink-testing-library already in devDependencies
- Team familiarity with React patterns

**Alternatives Considered**:
- **Bubble Tea (Go)**: Would require rewrite; opencode uses this but we're TypeScript
- **blessed/blessed-contrib**: Older, less maintained, imperative API
- **Custom readline**: Current approach, being replaced due to rigidity

**References**:
- [Ink GitHub](https://github.com/vadimdemedes/ink)
- [7 TUI Libraries comparison](https://blog.logrocket.com/7-tui-libraries-interactive-terminal-apps/)

---

### 2. State Management Pattern

**Decision**: useReducer + React Context

**Rationale**:
- Standard React pattern, well-documented
- Ink supports all React hooks including useReducer
- Single source of truth for complex state (dialogs, exploration, streaming)
- Testable: can unit test reducer in isolation
- No additional dependencies (no Zustand, no Redux)

**State Structure**:
```typescript
interface AppState {
  analysisPhase: 'idle' | 'scanning' | 'presenting' | 'exploring';
  viewStack: DialogType[];
  explorationPath: ExplorationStep[];
  inputBuffer: string;
  streamBuffer: StreamChunk[];
  findings: Finding[];
  recommendations: Recommendation[];
  isStreaming: boolean;
  permissionCache: Map<string, PermissionDecision>;
}
```

**Alternatives Considered**:
- **Zustand**: Adds dependency, overkill for single-session state
- **useState per component**: Leads to prop drilling, harder to test
- **MobX**: Observable pattern doesn't fit React 18 concurrent mode well

**References**:
- [State Management in Ink](https://app.studyraid.com/en/read/11921/379922/state-management-in-ink-components)
- [React State Management 2025](https://www.developerway.com/posts/react-state-management-2025)

---

### 3. Natural Language Input Handling

**Decision**: All input sent to LLM for interpretation

**Rationale**:
- Aligns with Constitution Principle VII (Intelligent Tooling)
- Agent can understand context ("option 1" vs "1" vs "the first one")
- No hardcoded navigation patterns in UI code
- Graceful handling of unexpected input (agent asks for clarification)

**Implementation**:
1. TUI captures raw input string
2. Input added to agent prompt with current ConversationalContext
3. Agent interprets and responds
4. Only true system commands (Ctrl+C, ESC for dialog) handled by TUI

**Latency Consideration**:
- Each input requires LLM call (~1-2s)
- Acceptable tradeoff for flexibility and natural feel
- Show subtle "thinking" indicator during interpretation

**Alternatives Considered**:
- **Hybrid (shortcuts + LLM)**: More complex, inconsistent behavior
- **Pattern matching only**: Rigid, doesn't understand context

**References**:
- Constitution Principle VII
- Spec clarification C4

---

### 4. Dialog Overlay Implementation

**Decision**: Stack-based overlays with focus trapping

**Rationale**:
- Dialogs can stack (rare but possible: permission during recommendation)
- Focus trapping prevents key events from reaching background
- ESC always dismisses top dialog

**Implementation Pattern** (from opencode research):
```tsx
function DialogOverlay({ children, onDismiss }) {
  useKeyHandler({
    escape: onDismiss,
    // Block other keys from propagating
  });

  return (
    <Box borderStyle="round" padding={1}>
      {children}
    </Box>
  );
}
```

**Stack Management**:
```typescript
// In reducer
case 'PUSH_DIALOG':
  return { ...state, viewStack: [...state.viewStack, action.dialog] };
case 'POP_DIALOG':
  return { ...state, viewStack: state.viewStack.slice(0, -1) };
```

**References**:
- opencode Dialog System documentation (adapted for Ink)

---

### 5. Streaming Content Buffer

**Decision**: Buffer input until agent pause point

**Rationale**:
- User sees their input immediately (echoed in input field)
- Processing waits for natural break (finding, question, tool completion)
- Doesn't interrupt agent mid-sentence
- Feels responsive while maintaining conversational flow

**Pause Points**:
- StreamChunk type 'finding' or 'user_question'
- After tool_result chunk
- After configurable silence (e.g., 500ms without new text)

**Implementation**:
```typescript
interface StreamState {
  inputBuffer: string;
  isPaused: boolean;
  lastChunkTime: number;
}

// In AgentOutput component
useEffect(() => {
  if (isPaused && inputBuffer.length > 0) {
    // Send buffered input to agent
    dispatch({ type: 'SEND_INPUT', input: inputBuffer });
  }
}, [isPaused, inputBuffer]);
```

**References**:
- Spec clarification C5
- opencode streaming integration (adapted for Ink)

---

### 6. Permission Persistence

**Decision**: JSON file at ~/.agentlint/permissions.json

**Rationale**:
- Human-readable for debugging
- Simple file I/O, no SQLite needed for this
- Follows existing config pattern (~/.agentlint/config.json)
- Local-first (no cloud sync)

**Schema**:
```typescript
interface PermissionStore {
  version: '1.0.0';
  permissions: {
    [key: string]: {
      allowed: boolean;
      scope: 'session' | 'permanent';
      grantedAt: string; // ISO-8601
      tool: string;
      pattern?: string; // e.g., "/Users/*/Projects/*"
    };
  };
}
```

**Session Permissions**:
- Stored in memory only
- Cleared on process exit
- Faster lookup (no file I/O)

**References**:
- Spec clarification C3

---

### 7. Headless/CI Mode

**Decision**: Separate HeadlessRenderer returning JSON

**Rationale**:
- Clean separation of concerns
- JSON schema aligns with existing AnalyseResult
- Exit codes reflect finding severity
- TTY detection for automatic mode selection

**Implementation**:
```typescript
class HeadlessRenderer implements IStreamRenderer {
  private findings: Finding[] = [];

  renderChunk(chunk: StreamChunk): void {
    if (chunk.type === 'finding') {
      this.findings.push(chunk.metadata.finding);
    }
  }

  renderComplete(result: AnalyseResult): void {
    console.log(JSON.stringify(result, null, 2));
    process.exit(this.getExitCode());
  }
}
```

**Exit Codes**:
- 0: No findings or info-only
- 1: Low/medium findings
- 2: High/critical findings
- 3: Analysis failed

**References**:
- Spec US-006

---

### 8. Testing Strategy

**Decision**: ink-testing-library for components, unit tests for reducer

**Rationale**:
- ink-testing-library already in devDependencies
- Simulates renders and captures output
- Reducer tests can be pure unit tests (no React rendering)
- Aligns with existing test patterns

**Test Categories**:
1. **Reducer tests**: State transitions, action handling
2. **Component tests**: Rendering, key handling, focus
3. **Integration tests**: Full flow with mock orchestrator

**Example**:
```typescript
import { render } from 'ink-testing-library';
import { App } from '../App';

test('displays findings when analysis complete', () => {
  const { lastFrame } = render(
    <App initialState={{ ...mockState, findings: [mockFinding] }} />
  );
  expect(lastFrame()).toContain(mockFinding.title);
});
```

**References**:
- [ink-testing-library](https://github.com/vadimdemedes/ink-testing-library)

---

## Resolved Unknowns

| Unknown | Resolution | Source |
|---------|------------|--------|
| Input interpretation method | LLM interprets all | Spec C4 |
| Input timing during streaming | Buffer until pause | Spec C5 |
| Permission persistence | Both session + permanent | Spec C3 |
| Cross-session memory | No (each session fresh) | Spec C1 |
| Agent leading style | Top finding + overview | Spec C2 |
| Headless JSON schema | Align with AnalyseResult | Deferred (will inherit) |

---

---

## Existing Component Analysis

Analyzed the current `src/cli/components/` to determine reusability for EP17.

### Components to KEEP (Reusable)

| Component | File | Why Reusable | Notes |
|-----------|------|--------------|-------|
| **Progress** | `Progress.tsx` | Spinner with phase display | Use for analysis progress; already uses `@inkjs/ui Spinner` |
| **FindingsList** | `FindingsList.tsx` | Renders findings with severity | Core display component; add interactivity (selection) |
| **Summary** | `Summary.tsx` | Shows analysis results | Use for final summary display |
| **CausalTree** | `CausalTree.tsx` | Visualizes causal chain | Critical for drill-down exploration |
| **CompareView** | `CompareView.tsx` | Baseline comparison | Use for historical context display |
| **useColors** | `utils/colors.ts` | Color hook for Ink | Already implements NO_COLOR support |

### Components to REPLACE

| Component | File | Why Replace | Replacement |
|-----------|------|-------------|-------------|
| **App** | `App.tsx` | Limited state model, no dialogs | New `tui/components/App.tsx` with useReducer |
| **question-presenter** | `question-presenter.ts` | readline-based, not Ink | `PermissionDialog.tsx`, LLM-interpreted input |

### Components to ADD (New)

| Component | Purpose | Priority |
|-----------|---------|----------|
| **AppContext** | Central state provider | P1 |
| **AgentOutput** | Streaming markdown with pause detection | P1 |
| **InputField** | User input with buffer | P1 |
| **DialogOverlay** | Modal container with focus trap | P1 |
| **PermissionDialog** | Session/permanent permission UI | P1 |
| **RecommendationDialog** | Accept/dismiss/defer flow | P1 |
| **Breadcrumbs** | Navigation context display | P1 |
| **SessionTimeline** | EP15 TimelineVizEvent display | P3 |

### Files to REMOVE (Deprecated)

| File | Why Remove |
|------|------------|
| `renderers/terminal-renderer.ts` | Replaced by InkRenderer |
| `components/question-presenter.ts` | Replaced by LLM input + dialogs |
| Dependencies: `ora`, `readline` | No longer needed |

### Pattern Observations

**Good Patterns to Preserve:**
1. `useColors()` hook - already NO_COLOR compliant
2. Props interfaces with explicit types
3. `*Props` naming convention
4. Functional components with explicit return types
5. Severity color mapping

**Patterns to Change:**
1. No state management pattern - add useReducer
2. No keyboard handling - add useKeyHandler hook
3. No dialog system - add DialogOverlay
4. No focus management - add useFocusManager

### Reference Architecture (opencode)

From deepwiki research on opencode-ai/opencode (Bubble Tea, not Ink):
- **Learned**: Message-passing pattern with switch-based reducer
- **Learned**: Dialog overlays with boolean visibility flags
- **Learned**: Key bindings with scope awareness
- **Not applicable**: Go-specific patterns, charmbracelet styling

**Adapted for Ink/React:**
- Use `useReducer` instead of Bubble Tea's `Update` method
- Use React Context instead of passing model through tree
- Use `useInput` from Ink for key handling

---

## Open Items

None - all unknowns resolved. Ready for Phase 2 (Design).
