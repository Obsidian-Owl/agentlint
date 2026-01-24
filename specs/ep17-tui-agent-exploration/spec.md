# Feature Specification: TUI Architecture & Agent-Led Exploration

> **Epic**: EP17
> **Created**: 2026-01-24
> **Status**: Ready for Implementation
> **Author**: Claude Opus 4.5

---

## 1. Overview

EP17 replaces agentlint's current TerminalRenderer + readline-based UI with an Ink-based TUI that enables **agent-led exploration**. Rather than requiring CLI expertise to navigate sessions and findings, the agent scans the user's ACT environment, presents contextual observations, and guides users through discovery in a conversational manner.

The key insight from the strategic review: if users knew where to find sessions, what questions to ask, and how to interpret the data, they wouldn't need agentlint. The agent must lead.

### 1.1 Business Context

This is the UX pivot from the Strategic Review (Jan 2026). Current agentlint has:
- Ink components that exist but aren't wired as primary output
- TerminalRenderer using ora spinners and console.log
- readline-based question presenter that feels rigid
- CLI commands that assume user expertise

Post-EP17:
- Agent runs initial analysis automatically on `agentlint` invocation
- Agent presents findings conversationally, not as structured reports
- User explores by responding naturally; agent guides drill-down
- Dialog overlays for structured choices when needed (permissions, recommendations)

**Strategic Priority**: P0-Critical (Core Differentiator)

### 1.2 Out of Scope

- Mouse support (keyboard-first design)
- Custom theming beyond built-in styles
- Multi-window layouts
- External terminal integrations (tmux, screen)
- Full session log parsing (EP15 handles that; EP17 consumes its outputs)
- Skills effectiveness analysis implementation (EP14 already complete)

---

## 2. User Scenarios & Testing

> User stories are prioritized: P1 (must-have), P2 (should-have), P3 (nice-to-have)

### US-001 [P1]: Agent-Led Initial Discovery

**As a** developer who just installed agentlint,
**I want** the agent to automatically analyze my ACT environment and tell me what it found,
**So that** I don't need to learn CLI commands or understand agentlint's data model.

**Acceptance Criteria:**
- [ ] Given user runs `agentlint` with no args, when analysis completes, then agent presents conversational summary of findings
- [ ] Given agent finds actionable observations, when presenting them, then observations are prioritized by impact with clear "why it matters"
- [ ] Given user responds with a number or keyword, when input is received, then agent drills into that topic naturally

**Test Scenarios:**
- Happy path: User runs agentlint, sees "I found 4 Skills defined but only 1 is being invoked regularly. Would you like to explore why?"
- No data: User runs agentlint with no sessions, sees "I don't see any Claude Code sessions yet. Run some sessions and come back for insights."
- Error case: Session logs corrupted, agent explains what happened and offers recovery options

---

### US-002 [P1]: Conversational Drill-Down

**As a** developer exploring findings,
**I want** to ask follow-up questions in natural language,
**So that** I can understand root causes without learning query syntax.

**Acceptance Criteria:**
- [ ] Given agent presented finding about low Skill invocation, when user types "why", then agent explains possible causes
- [ ] Given user is in drill-down context, when user types "show me sessions", then agent shows relevant session list
- [ ] Given deep drill-down, when user types "back" or presses ESC, then agent returns to previous context

**Test Scenarios:**
- Happy path: User types "tell me more", agent expands on current finding with evidence
- Cross-topic: User asks about different topic mid-flow, agent pivots gracefully while offering to return
- Error case: Agent doesn't understand input, asks clarifying question

---

### US-003 [P1]: Recommendation Flow

**As a** developer reviewing recommendations,
**I want** to see actionable suggestions with clear next steps,
**So that** I can decide what to implement without researching solutions.

**Acceptance Criteria:**
- [ ] Given agent identifies improvement opportunity, when presenting recommendation, then it includes concrete next step
- [ ] Given recommendation dialog, when user accepts, then agent offers to show how or save for later
- [ ] Given user defers, when deferring, then recommendation tracked for follow-up

**Test Scenarios:**
- Happy path: Agent suggests "Your testing Skill description doesn't match how you phrase test requests. Would you like me to suggest rewording?"
- Partial accept: User says "maybe later", agent acknowledges and continues
- Error case: User accepts but action requires permission, permission dialog appears

---

### US-004 [P2]: Permission Dialog Integration

**As a** developer using agentlint,
**I want** permission prompts to appear as dialogs within the TUI,
**So that** I can make decisions without breaking the conversational flow.

**Acceptance Criteria:**
- [ ] Given agent needs permission to run a tool, when canUseTool fires, then dialog overlay appears
- [ ] Given permission dialog, when user allows/denies, then flow resumes immediately
- [ ] Given user chooses "remember", when same permission needed later, then dialog doesn't reappear

**Test Scenarios:**
- Happy path: Agent wants to read session logs, dialog asks "Allow reading ~/.claude/projects?", user says yes
- Bulk: Multiple similar permissions, "Allow all similar" option available
- Denied: User denies, agent explains limitation and offers alternative

---

### US-005 [P2]: Quick Selection Keyboard Navigation

**As a** developer navigating the TUI,
**I want** to use keyboard shortcuts (vim-style, number keys),
**So that** I can work quickly without mouse or arrow-key fatigue.

**Acceptance Criteria:**
- [ ] Given list of options, when user presses 1-9, then corresponding option selected
- [ ] Given list longer than 9, when user presses j/k, then selection moves up/down
- [ ] Given any view, when user presses ESC, then returns to previous or dismisses dialog

**Test Scenarios:**
- Happy path: Agent shows 3 options, user presses "2", option 2 selected
- Long list: Agent shows 15 sessions, user uses j/k to scroll, Enter to select
- Error case: User presses invalid key, ignored (no error message, just no action)

---

### US-006 [P2]: Headless/CI Mode

**As a** CI/CD pipeline operator,
**I want** agentlint to work in non-interactive mode,
**So that** I can run it in automated environments.

**Acceptance Criteria:**
- [ ] Given `--non-interactive` or no TTY, when running, then JSON output to stdout
- [ ] Given headless mode, when findings exist, then exit code reflects severity
- [ ] Given headless mode, when would need user input, then use sensible defaults or fail gracefully

**Test Scenarios:**
- Happy path: Run `agentlint --non-interactive`, get JSON result
- CI detection: TTY=false automatically triggers non-interactive
- Error case: Analysis fails, exit code non-zero with error in JSON

---

### US-007 [P3]: Session Timeline Exploration

**As a** developer investigating a specific session,
**I want** to see a visual timeline of what happened,
**So that** I can understand the flow of agent actions.

**Acceptance Criteria:**
- [ ] Given user drills into specific session, when timeline displays, then key moments are highlighted
- [ ] Given timeline view, when user selects event, then details expand inline
- [ ] Given EP15 TimelineVizEvent data, when rendering, then categorization colors applied

**Test Scenarios:**
- Happy path: User selects session, sees "10:42 - Read config file" ... "10:43 - Tool error (retry)" ... "10:44 - Success"
- Large session: Session has 200 events, timeline summarizes with expand option
- Error case: Session data incomplete, agent notes what's missing

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | User Story |
|----|-------------|----------|------------|
| FR-001 | Ink renders all primary output (no console.log in production paths) | P1 | US-001 |
| FR-002 | Agent runs automatic environment scan on bare `agentlint` invocation | P1 | US-001 |
| FR-003 | Agent presents findings conversationally with contextual suggestions | P1 | US-001 |
| FR-004 | Dialog overlay system with focus trapping for structured choices | P1 | US-004 |
| FR-005 | Natural language input handling for drill-down (not just numbered options) | P1 | US-002 |
| FR-006 | Breadcrumb/context stack for navigation history | P1 | US-002 |
| FR-007 | ESC/back navigation to previous context | P1 | US-002, US-005 |
| FR-008 | Recommendation dialog with accept/dismiss/defer actions | P1 | US-003 |
| FR-009 | canUseTool integration with permission dialog overlays | P2 | US-004 |
| FR-010 | Keyboard navigation: vim-style j/k, number keys 1-9, Enter/Space | P2 | US-005 |
| FR-011 | Non-interactive/headless mode with JSON output | P2 | US-006 |
| FR-012 | TTY detection for automatic mode selection | P2 | US-006 |
| FR-013 | Session timeline visualization using EP15 TimelineVizEvent | P3 | US-007 |
| FR-014 | Delete TerminalRenderer, readline, ora, and old Ink components after migration | P1 | - |

### 3.2 Non-Functional Requirements

| ID | Requirement | Metric | Target |
|----|-------------|--------|--------|
| NFR-001 | Initial analysis display | Time to first meaningful output | < 3 seconds |
| NFR-002 | Input responsiveness | Key-to-display latency | < 50ms |
| NFR-003 | Memory efficiency | Peak memory during TUI operation | < 100MB additional |
| NFR-004 | Compatibility | Terminal support | Standard terminals (xterm, iTerm, Windows Terminal) |
| NFR-005 | Test coverage | Component test coverage | > 80% of TUI components |
| NFR-006 | Graceful degradation | Narrow terminals | Usable at 80 columns minimum |

---

## 4. Key Entities

> Domain entities this feature introduces or modifies

| Entity | Description | Key Attributes |
|--------|-------------|----------------|
| AppState | Central state model for all TUI state | viewStack, focusTarget, findings, explorationPath, streamBuffer |
| AppMessage | Typed message for state transitions | type, payload (varies by type) |
| DialogType | Enumeration of overlay dialogs | 'permission', 'recommendation', 'session-list', 'session-timeline' |
| ExplorationStep | Single step in drill-down history | topic, context, timestamp, parentId |
| ConversationalContext | Agent's current understanding of user intent | currentTopic, drillDownDepth, mentionedEntities |

### 4.1 Entity Relationships

```
AppState --1:N--> ExplorationStep (explorationPath)
AppState --1:1--> ConversationalContext
AppState --0:N--> DialogType (viewStack)
AppMessage --> AppState (via appReducer)
```

### 4.2 State Model

```typescript
interface AppState {
  // View management
  viewStack: DialogType[];           // Dialog stack (empty = main view)
  focusTarget: FocusTarget;          // Current focus (for key routing)

  // Exploration state
  explorationPath: ExplorationStep[]; // Breadcrumb trail
  currentContext: ConversationalContext;

  // Agent output
  findings: Finding[];               // Discovered issues/observations
  recommendations: Recommendation[]; // Actionable suggestions
  streamBuffer: StreamChunk[];       // Buffered agent output

  // Analysis state
  analysisPhase: 'scanning' | 'presenting' | 'exploring' | 'idle';
  isStreaming: boolean;  // Agent currently outputting
  isPaused: boolean;     // Agent at pause point, accepting input

  // Session state (for recovery)
  lastCheckpoint: CheckpointData | null;
}
```

---

## 5. Success Criteria

> How do we know this feature is successful?

- [ ] **Functional**: All P1 user stories pass acceptance criteria
- [ ] **Migration**: TerminalRenderer and readline removed from codebase
- [ ] **Conversational**: User testing shows 80%+ can complete discovery without documentation
- [ ] **Performance**: NFR-001 and NFR-002 met (< 3s to output, < 50ms latency)
- [ ] **Quality**: > 80% test coverage on TUI components using ink-testing-library
- [ ] **Integration**: Seamlessly consumes EP14 (Skills) and EP15 (Session Intelligence) data

---

## 6. Edge Cases & Error Handling

| Scenario | Expected Behavior | Priority |
|----------|-------------------|----------|
| No Claude Code sessions found | Agent explains what it looked for, suggests running sessions first | P1 |
| Session logs corrupted/unreadable | Agent reports which logs failed, continues with what it can read | P1 |
| User input not understood | Agent asks clarifying question, doesn't error | P1 |
| Very narrow terminal (<80 cols) | Graceful degradation, text wraps appropriately | P2 |
| User interrupts analysis (Ctrl+C) | Clean shutdown, state checkpointed for resume | P1 |
| API key missing/invalid | Clear error before analysis starts, not mid-flow | P1 |
| Agent reasoning timeout | Show partial results with note about what wasn't analyzed | P2 |
| Permission denied for critical path | Explain limitation, suggest alternatives | P1 |

---

## 7. Dependencies & Assumptions

### 7.1 Dependencies

| Dependency | Type | Status | Impact if Missing |
|------------|------|--------|-------------------|
| EP02 Orchestration Core | Internal | Complete | Cannot integrate agent streaming |
| EP11 Quality & Security | Internal | Complete | No debug logging, secret redaction |
| EP14 Skills Effectiveness | Internal | Complete | Cannot show Skills insights |
| EP15 Session Intelligence | Internal | Planned | Degraded session analysis (no TimelineVizEvent) |
| Ink 5.x | External | Available | Must use Ink for TUI rendering |
| @inkjs/ui 2.x | External | Available | Provides base components (Spinner, Select) |
| ink-testing-library | External | Available | Required for component tests |

### 7.2 Assumptions

- Users have Bun 1.x or Node.js 20+ (validated by CLAUDE.md constraints)
- Terminal supports basic ANSI escape sequences (true for all modern terminals)
- EP15 will deliver TimelineVizEvent structure before EP17 Phase 2 needs it
- Claude Agent SDK streaming API remains stable

---

## 8. Open Questions

> Questions that need resolution before implementation

- [x] **Q1**: Should the agent remember context across invocations (e.g., "last time you were looking at...")? — **Resolved: No cross-session memory**. Each session starts fresh. Baselines provide historical context, but exploration path resets.

- [x] **Q2**: How aggressive should the agent be in leading? Should it present one main finding and wait, or give an overview of everything? — **Resolved: Lead with top finding + overview**. Present the most impactful finding first with clear "why it matters", then offer overview of other areas.

- [x] **Q3**: Should permission "remember" be per-session or persistent across sessions? — **Resolved: Both options available**. Default is session-only. Offer "Always allow" for permanent persistence.

- [ ] **Q4**: For headless mode, what JSON schema should findings/recommendations follow? — **Deferred to implementation**. Will align with existing AnalyseResult schema from EP02.

---

## 9. References

- [EP17 Epic Documentation](../../docs/planning/epics/EP17-tui-architecture.md)
- [ADR-0021: TUI Architecture & Interaction Model](../../docs/architecture/adr/0021-tui-architecture-interaction-model.md)
- [Strategic Review (Jan 2026)](../../docs/review/agentlint-strategic-review-jan26.md)
- [Constitution](../../.specify/memory/constitution.md)
- [EP14 Skills Effectiveness](../../docs/planning/epics/EP14-skills-effectiveness.md)
- [EP15 Session Intelligence](../../docs/planning/epics/EP15-session-intelligence.md)

---

## Clarifications

> This section is populated by /dev.clarify

### C1: Cross-Session Memory (Q1)

**Decision**: No cross-session memory for exploration context.

**Rationale**: Each invocation of `agentlint` starts a fresh exploration. The agent doesn't say "last time you were looking at...". However, baselines and historical data from EP09 provide temporal context for findings (e.g., "this issue has persisted for 2 weeks").

**Impact on Implementation**:
- ExplorationStep and ConversationalContext are ephemeral (in-memory only)
- No need for exploration state persistence in SQLite
- Simpler mental model for users

### C2: Agent Leading Style (Q2)

**Decision**: Lead with top finding + brief overview.

**Rationale**: Balance between overwhelming users with data and being too sparse. The agent presents:
1. Most impactful finding with clear "why it matters"
2. Brief mention of other areas available for exploration
3. Invitation to drill down or explore elsewhere

**Example Output**:
```
I analyzed 47 sessions from the last 30 days.

The biggest opportunity I see: your "testing" Skill was defined
3 weeks ago but has only been invoked 2 times, even though 12
sessions touched test files. The description might not match
how you phrase test requests.

I also noticed:
- High context compression (3.2 events/session on average)
- 1 MCP server configured but never used

Would you like to explore the Skill invocation issue, or see
more about compression patterns? (1/2/other)
```

**Impact on Implementation**:
- Agent prompt needs clear guidance on prioritization
- UI must support both numbered quick-select and natural language input

### C3: Permission Persistence (Q3)

**Decision**: Both session-only and persistent options.

**Rationale**: Session-only by default respects user caution. "Always allow" option available for power users who want less friction.

**Permission Dialog Flow**:
```
┌─────────────────────────────────────────────┐
│ Permission Request                          │
│                                             │
│ agentlint wants to read session logs from   │
│ ~/.claude/projects/                         │
│                                             │
│ [1] Allow (this session)                    │
│ [2] Always allow (remember)                 │
│ [3] Deny                                    │
│                                             │
│ Press 1, 2, or 3                            │
└─────────────────────────────────────────────┘
```

**Impact on Implementation**:
- Permission storage needed in `~/.agentlint/permissions.json`
- canUseTool integration must check persistent permissions first
- UI must clearly distinguish session vs permanent choices

### C4: Natural Language Input Handling (FR-005)

**Decision**: LLM interprets all user input.

**Rationale**: Every user input goes to the agent as a prompt. The agent decides what it means and how to respond. This aligns with Constitution Principle VII (Intelligent Tooling) - the agent reasons about user intent rather than hardcoding patterns in TUI code.

**How It Works**:
1. User types anything (number, keyword, or free text)
2. TUI captures input and sends to agent with current context
3. Agent interprets and responds appropriately
4. Only true system commands (Ctrl+C, ESC for dialog dismiss) are handled by TUI

**Example Interpretations**:
- "1" → Agent understands as "option 1" from the list it just presented
- "why" → Agent expands on the current finding
- "tell me about compression" → Agent pivots to compression topic
- "back" → Agent returns to previous exploration level

**Impact on Implementation**:
- No pattern-matching logic in TUI code for navigation
- Agent prompt must include current exploration context
- ConversationalContext entity tracks what agent presented for reference
- Latency consideration: each input requires LLM call (~1-2s)

### C5: Input Timing During Streaming (UX)

**Decision**: Buffer input until agent pauses.

**Rationale**: Collect user input while agent is streaming, but wait for a natural pause point before processing. This feels responsive (user sees their input echoed) but doesn't interrupt mid-thought.

**Pause Points**:
- End of a StreamChunk batch
- After presenting a finding or recommendation
- When agent asks a question
- After completing a tool call

**User Experience**:
```
Agent: I analyzed 47 sessions from the last 30 days...
       [user types "skip" - input buffered, shown in input field]
       ...The biggest opportunity I see: your testing Skill...
       [pause point reached]
Agent: You typed "skip" - moving on to the next topic.
```

**Impact on Implementation**:
- Input buffer in AppState
- StreamProcessor emits pause point markers
- Input processing triggered on pause, not on keypress

---

## Implementation Notes

### Phase 1: Core Architecture (Weeks 1-4)

Focus: Foundation that enables conversational interaction

1. **Central AppState Model** - Single source of truth replacing scattered state
2. **appReducer with AppMessage types** - Predictable state transitions
3. **DialogOverlay component** - Modal system with focus trapping
4. **Global key handler** - Focus-aware routing, vim-style navigation
5. **Replace TerminalRenderer** - Ink becomes primary output path

### Phase 2: Agent-Led Exploration (Weeks 5-7)

Focus: Conversational discovery flow

1. **ConversationalContext tracking** - Agent knows what user is exploring
2. **Natural language input handling** - Beyond numbered options
3. **ExplorationFlow controller** - Manages drill-down/back navigation
4. **Recommendation dialog** - Accept/dismiss/defer with tracking

### Phase 3: Integration & Migration (Weeks 8-9)

Focus: Wire to existing systems, clean up

1. **Orchestrator integration** - StreamChunk rendering in Ink
2. **canUseTool permission dialogs** - Native TUI experience
3. **EP15 TimelineVizEvent rendering** - Session visualization
4. **CLI command integration** - `agentlint` → full TUI, `--non-interactive` → headless

### Phase 4: Cleanup (Week 10)

Focus: Delete legacy, document

1. **Delete old CLI components** - TerminalRenderer, question-presenter, ora, readline
2. **Delete old Ink App.tsx** - Replaced by new tui/components/App.tsx
3. **Move reusable components** - Progress, FindingsList, Summary, CausalTree, CompareView → tui/
4. **Test migration to ink-testing-library** - Component test coverage
5. **Update ADR-0021** - Document final architecture
6. **Update Arc42 §5** - Component diagrams

### Constitution Alignment

| Principle | How EP17 Supports It |
|-----------|----------------------|
| III. Causal-First | TUI enables drill-down from symptom to cause |
| V. User Agency | Recommendations suggest, user decides; navigation gives control |
| VII. Intelligent Tooling | Rich interaction model for agent reasoning presentation |
| IX. Agent-Aware | UI serves agent's need to present findings conversationally |
