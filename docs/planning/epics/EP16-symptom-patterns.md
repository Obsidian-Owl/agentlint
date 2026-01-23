# EP16: Session Pattern Data

## Business Outcome Hypothesis

**If** we provide tools for session pattern data extraction,
**Then** the agent can identify workflow issues like circular calls, instruction drift, and permission friction, and provide actionable recommendations,
**Measured by** pattern identification accuracy, recommendation relevance, and user issue resolution rate.

## Classification

* **Type**: Business
* **Priority**: P1-High
* **Size**: M
* **Duration**: 5 weeks
* **Dependencies**: EP06 (Session Analysis), EP07 (Causal Tracing)
* **Extends**: ADR-0006 (Session Log Processing Architecture)

## In Scope

* Tool call sequence extraction from session logs
* Compression event extraction with context
* Permission interaction extraction (approvals, denials)
* CLAUDE.md rule parsing for agent comparison
* Data access tools for agent-driven pattern analysis

## Out of Scope

* Real-time pattern alerting
* Automatic pattern remediation
* Cross-project pattern comparison
* Programmatic detection with hardcoded thresholds (agent reasons about patterns)

## Key Deliverables

### Phase 1: Core Implementation (Weeks 1-2)

1. **Tool Call Sequence Indexer**
   - Extract tool call sequences from session logs
   - Include tool name, input hash, timestamp, sequence position
   - Store for agent querying (agent determines what constitutes "circular")

2. **CLAUDE.md Rule Parser**
   - Parse CLAUDE.md rules into structured format
   - Provide rule text and context for agent comparison
   - Agent reasons about whether behavior contradicts rules

3. **Compression Event Data**
   - Extract compression events with session context
   - Include position in session, surrounding tool calls
   - Agent reasons about whether compression is problematic

4. **Permission Interaction Extractor**
   - Extract permission approval/denial events from logs
   - Track patterns per tool/permission type
   - Agent reasons about friction and optimization opportunities

5. **Session Pattern Data Tools**
   - `getToolCallSequenceTool` - Query tool call sequences by session
   - `getClaudeMdRulesTool` - Get parsed CLAUDE.md rules
   - `getPermissionInteractionsTool` - Query permission events
   - `getCompressionContextTool` - Compression events with surrounding context

**Agent Reasoning (NOT tools):**
- Whether repeated tool calls constitute a "circular" pattern
- What severity level is appropriate for patterns
- Whether behavior contradicts CLAUDE.md rules (instruction drift)
- Which permission patterns indicate friction worth addressing
- What recommendations to make based on patterns

### Phase 2: Integration (Weeks 3-4)

1. **CLI Integration**
   - Add pattern data to `agentlint analyse` output
   - Add `--patterns` flag for focused pattern analysis
   - Agent presents findings with recommendations

2. **Causal Tracing Integration**
   - Provide data for agent to link patterns to causal chains from EP07
   - Enable "why did this pattern occur?" analysis
   - Agent connects patterns to configuration gaps

3. **Recommendation Integration**
   - Agent generates recommendations from pattern analysis
   - Permission friction → suggested permission config
   - Circular calls → debugging guidance
   - Instruction drift → rule enforcement suggestions

4. **Testing**
   - Unit tests for data extraction functions
   - Integration tests with synthetic session data
   - Evaluations for agent reasoning quality (VCR + LLM-as-judge)

### Phase 3: Cleanup (Week 5)

1. **Dead Code Removal**
   - Remove superseded pattern extraction from EP07 if any overlap
   - Clean up experimental extraction code not promoted

2. **Data Format Consolidation**
   - Standardize pattern data formats
   - Unify output structures

3. **Documentation**
   - Update Arc42 with Session Pattern Data component
   - Update ADR-0006 with pattern data extension
   - Add pattern data interpretation guide with examples

## Technical Approach

### Tool Call Sequence Extraction

```typescript
interface ToolCallRecord {
  sessionId: string;
  toolName: string;
  inputHash: string;  // Hash of input for comparison
  timestamp: string;
  sequenceIndex: number;
  input: Record<string, unknown>;  // Full input for agent context
}

// Deterministic extraction—tool extracts data, agent reasons about patterns
function extractToolCallSequence(entries: SessionEntry[]): ToolCallRecord[] {
  const calls: ToolCallRecord[] = [];
  let index = 0;

  for (const entry of entries) {
    for (const block of entry.message?.content || []) {
      if (block.type === 'tool_use') {
        calls.push({
          sessionId: entry.sessionId,
          toolName: block.name,
          inputHash: hashInput(block.input),
          timestamp: entry.timestamp,
          sequenceIndex: index++,
          input: block.input,
        });
      }
    }
  }

  return calls;
}
```

### Database Schema

```sql
-- Raw tool call data for agent analysis
CREATE TABLE tool_call_sequences (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  sequence_index INTEGER NOT NULL,
  input_json TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX idx_tool_calls_session ON tool_call_sequences(session_id);
CREATE INDEX idx_tool_calls_hash ON tool_call_sequences(input_hash);
```

**Note**: No `symptom_patterns` table with severity classifications—agent reasons about this from raw data.

## Success Criteria

- [ ] Tools provide tool call sequences, CLAUDE.md rules, and permission data
- [ ] Agent can reason about patterns using provided data
- [ ] Agent can identify issues and generate recommendations
- [ ] Clean integration with causal tracing
- [ ] Tools return data; agent provides judgment (Constitution Principle VII)

## Constitution Alignment

| Principle | Alignment |
|-----------|-----------|
| III. Causal-First | Agent traces patterns to root causes using data |
| IV. Mixed-Methods | Quantitative data + agent qualitative analysis |
| VII. Intelligent Tooling | Tools provide data; agent reasons about patterns |

## Related Documents

- [ADR-0006: Session Log Processing Architecture](../../architecture/adr/0006-session-log-processing-architecture.md)
- [EP07: Causal Tracing Engine](./EP07-causal-tracing.md)
- [Strategic Review](../../review/agentlint-strategic-review-jan26.md)
