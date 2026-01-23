# EP18: Subagent Delegation Data

## Business Outcome Hypothesis

**If** we provide tools for subagent delegation data from session logs,
**Then** the agent can analyze orchestration patterns and reason about context savings from delegation,
**Measured by** delegation data accuracy, context metrics availability, and agent insight quality.

## Classification

* **Type**: Business
* **Priority**: P2-Medium
* **Size**: M
* **Duration**: 4 weeks
* **Dependencies**: EP06 (Session Analysis), EP15 (Context Efficiency)
* **Extends**: ADR-0006 (Session Log Processing Architecture)

## In Scope

* Task tool invocation extraction from session logs
* Subagent type extraction (Explore, Plan, custom agents)
* Context token measurement (main vs. subagent sessions)
* Delegation event indexing with context
* Data access tools for agent-driven delegation analysis

## Out of Scope

* Subagent creation/editing
* Real-time delegation monitoring
* Cross-project delegation comparison
* Programmatic pattern classification (agent reasons about patterns)

## Key Deliverables

### Phase 1: Core Implementation (Weeks 1-2)

1. **Task Invocation Extractor**
   - Parse `tool_use.name === "Task"` entries from session logs
   - Extract subagent type from `input.subagent_type`
   - Extract task description from `input.prompt`
   - Track parent-child relationship (main session → subagent)

2. **Subagent Inventory Integration**
   - Built-in types: Explore, Plan, Bash, general-purpose
   - Custom agents from `.claude/agents/` directory
   - Provide agent metadata for agent reasoning

3. **Context Token Extractor**
   - Extract token usage from main session and subagent sessions
   - Provide token counts per delegation event
   - Include delegation timing data (position in session)

4. **Delegation Data Tools**
   - `getDelegationEventsTool` - Query delegation events by session/date
   - `getSubagentInventoryTool` - List available subagent types with metadata
   - `getDelegationContextTool` - Token usage data for delegation analysis

**Agent Reasoning (NOT tools):**
- Whether delegation frequency is appropriate
- Which tasks should have been delegated (missed opportunities)
- Whether context savings are meaningful
- What delegation patterns indicate about workflow efficiency
- What recommendations to make based on delegation data

### Phase 2: Integration (Weeks 3)

1. **CLI Integration**
   - Add delegation data to `agentlint analyse` output
   - Add `--delegation` flag for focused delegation analysis
   - Agent presents insights with recommendations

2. **Context Efficiency Integration**
   - Cross-reference delegation data with compression events from EP15
   - Provide data for agent to reason about delegation-compression correlation
   - Agent connects delegation patterns to efficiency outcomes

3. **Testing**
   - Unit tests for Task tool extraction, subagent parsing
   - Integration tests for delegation data queries
   - Evaluations for agent reasoning quality (VCR + LLM-as-judge)

### Phase 3: Cleanup (Week 4)

1. **Dead Code Removal**
   - Remove any redundant delegation extraction from prior epics
   - Clean up temporary data extraction scaffolding

2. **Documentation**
   - Update Arc42 with Delegation Data component
   - Update ADR-0006 with delegation data extension
   - Add delegation data interpretation guide

## Technical Approach

### Task Tool Extraction

```typescript
interface DelegationEvent {
  sessionId: string;
  subagentType: string;
  taskPrompt: string;
  timestamp: string;
  parentTurnIndex: number;
  completedSuccessfully: boolean;
  subagentTokens: number;
}

// Deterministic extraction—tool extracts data, agent reasons about patterns
function extractDelegations(entries: SessionEntry[]): DelegationEvent[] {
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
          subagentTokens: 0, // Populated from subagent session
        });
      }
    }
  }

  return delegations;
}
```

### Database Schema

```sql
-- Raw delegation data for agent analysis
CREATE TABLE delegation_events (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  subagent_type TEXT NOT NULL,
  task_prompt TEXT,
  timestamp TEXT NOT NULL,
  parent_turn_index INTEGER NOT NULL,
  completed_successfully BOOLEAN NOT NULL DEFAULT 1,
  subagent_tokens INTEGER,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX idx_delegation_events_session ON delegation_events(session_id);
CREATE INDEX idx_delegation_events_type ON delegation_events(subagent_type);
```

**Note**: No `delegation_patterns` table with classifications—agent reasons about this from raw data.

## Success Criteria

- [ ] Tools provide delegation events, subagent inventory, and token data
- [ ] Agent can reason about delegation patterns using provided data
- [ ] Agent can correlate delegation with context efficiency
- [ ] Clean integration with EP15 context efficiency data
- [ ] Tools return data; agent provides judgment (Constitution Principle VII)

## Constitution Alignment

| Principle | Alignment |
|-----------|-----------|
| II. Improvement-Oriented | Delegation data enables orchestration optimization |
| IV. Mixed-Methods | Quantitative data + agent qualitative analysis |
| VII. Intelligent Tooling | Tools provide data; agent reasons about patterns |
| VIII. Compounding Value | Delegation insights compound over time |

## Related Documents

- [ADR-0006: Session Log Processing Architecture](../../architecture/adr/0006-session-log-processing-architecture.md)
- [EP15: Context Efficiency Data](./EP15-context-efficiency.md)
- [Strategic Review](../../review/agentlint-strategic-review-jan26.md)
