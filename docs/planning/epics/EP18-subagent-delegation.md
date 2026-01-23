# EP18: Subagent Delegation Tracker

## Business Outcome Hypothesis

**If** we implement subagent delegation tracking from session logs,
**Then** users can understand their orchestration patterns and quantify context savings from delegation,
**Measured by** delegation frequency, context reduction percentage, and delegation pattern diversity.

## Classification

* **Type**: Business
* **Priority**: P2-Medium
* **Size**: M
* **Duration**: 4 weeks
* **Dependencies**: EP06 (Session Analysis), EP15 (Context Efficiency)
* **Extends**: ADR-0006 (Session Log Processing Architecture)

## In Scope

* Task tool invocation detection from session logs
* Subagent type classification (Explore, Plan, custom agents)
* Context isolation measurement (main vs. subagent token usage)
* Delegation pattern analysis (when/why delegation occurs)
* Context savings calculation (WITH delegation vs. WITHOUT)

## Out of Scope

* Subagent creation/editing
* Real-time delegation monitoring
* Cross-project delegation comparison
* Subagent performance benchmarking

## Key Deliverables

### Phase 1: Core Implementation (Weeks 1-2)

1. **Task Invocation Detector**
   - Parse `tool_use.name === "Task"` entries from session logs
   - Extract subagent type from `input.subagent_type`
   - Extract task description from `input.prompt`
   - Track parent-child relationship (main session → subagent)

2. **Subagent Classification**
   - Built-in types: Explore, Plan, Bash, general-purpose
   - Custom agents from `.claude/agents/` directory
   - Agent capability mapping (read-only, write, full)

3. **Context Isolation Analyzer**
   - Measure token usage in main session vs. subagent sessions
   - Calculate context isolation ratio
   - Identify delegation timing (early vs. late in session)

4. **Delegation Pattern Detector**
   - Classify delegation triggers (task complexity, file count, exploration)
   - Identify under-delegation (complex tasks without delegation)
   - Track delegation success rate (subagent completion)

5. **Delegation Tracking Tools**
   - `analyzeDelegationPatternsTool` - Comprehensive delegation analysis
   - `getDelegationStatsTool` - Query delegation metrics by session/date
   - `calculateContextSavingsTool` - Quantify context reduction from delegation

### Phase 2: Integration (Weeks 3)

1. **CLI Integration**
   - Add delegation metrics to `agentlint analyse` output
   - Add `--delegation` flag for focused delegation analysis
   - Show context savings summary

2. **Context Efficiency Integration**
   - Cross-reference delegation with compression events from EP15
   - Show correlation: delegation → reduced compression
   - Efficiency delta: WITH delegation vs. WITHOUT

3. **Testing**
   - Unit tests for Task tool detection, classification
   - Integration tests for context savings calculation
   - Test fixtures with multi-level delegation sessions

### Phase 3: Cleanup (Week 4)

1. **Dead Code Removal**
   - Remove any redundant delegation tracking from prior epics
   - Clean up temporary analysis scaffolding

2. **Documentation**
   - Update Arc42 with Delegation Tracker component
   - Update ADR-0006 with delegation tracking extension
   - Add delegation optimization guide

## Technical Approach

### Task Tool Detection

```typescript
interface DelegationEvent {
  sessionId: string;
  subagentType: string;
  taskPrompt: string;
  timestamp: string;
  parentTurnIndex: number;
  completedSuccessfully: boolean;
}

function detectDelegations(entries: SessionEntry[]): DelegationEvent[] {
  const delegations: DelegationEvent[] = [];

  for (const entry of entries) {
    for (const block of entry.message?.content || []) {
      if (block.type === 'tool_use' && block.name === 'Task') {
        delegations.push({
          sessionId: entry.sessionId,
          subagentType: block.input?.subagent_type || 'unknown',
          taskPrompt: block.input?.prompt || '',
          timestamp: entry.timestamp,
          parentTurnIndex: entry.turnIndex,
          completedSuccessfully: !entry.isError,
        });
      }
    }
  }

  return delegations;
}
```

### Database Schema

```sql
CREATE TABLE delegation_events (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  subagent_type TEXT NOT NULL,
  task_prompt TEXT,
  timestamp TEXT NOT NULL,
  parent_turn_index INTEGER NOT NULL,
  completed_successfully BOOLEAN NOT NULL DEFAULT 1,
  context_tokens_saved INTEGER,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX idx_delegation_events_session ON delegation_events(session_id);
CREATE INDEX idx_delegation_events_type ON delegation_events(subagent_type);
```

### Context Savings Calculation

```typescript
interface ContextSavings {
  totalMainTokens: number;
  totalSubagentTokens: number;
  estimatedWithoutDelegation: number;
  actualSavings: number;
  savingsPercentage: number;
}

function calculateContextSavings(
  mainSession: SessionMetrics,
  delegations: DelegationEvent[]
): ContextSavings {
  const totalSubagentTokens = delegations.reduce(
    (sum, d) => sum + (d.contextTokensSaved || 0),
    0
  );

  // Estimate: without delegation, subagent work would be in main context
  const estimatedWithoutDelegation =
    mainSession.totalTokens + totalSubagentTokens;

  return {
    totalMainTokens: mainSession.totalTokens,
    totalSubagentTokens,
    estimatedWithoutDelegation,
    actualSavings: totalSubagentTokens,
    savingsPercentage:
      (totalSubagentTokens / estimatedWithoutDelegation) * 100,
  };
}
```

## Success Criteria

- [ ] Can detect Task tool invocations with subagent type classification
- [ ] Can calculate context savings from delegation
- [ ] Can identify under-delegation opportunities
- [ ] Clean integration with EP15 context efficiency metrics
- [ ] Integration with EP17 TUI for delegation exploration

## Constitution Alignment

| Principle | Alignment |
|-----------|-----------|
| II. Improvement-Oriented | Delegation tracking enables orchestration optimization |
| IV. Mixed-Methods | Quantitative savings + qualitative pattern analysis |
| VIII. Compounding Value | Better delegation compounds context efficiency |

## Related Documents

- [ADR-0006: Session Log Processing Architecture](../../architecture/adr/0006-session-log-processing-architecture.md)
- [EP15: Context Efficiency Engine](./EP15-context-efficiency.md)
- [Strategic Review](../../review/agentlint-strategic-review-jan26.md)
