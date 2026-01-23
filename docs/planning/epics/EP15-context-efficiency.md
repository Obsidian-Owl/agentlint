# EP15: Context Efficiency Data

## Business Outcome Hypothesis

**If** we provide tools for context efficiency data from session logs,
**Then** the agent can analyze what's causing context pressure and reason about how Skills/delegation reduce it,
**Measured by** compression rate reduction, re-read ratio improvement, and efficiency delta accuracy.

## Classification

* **Type**: Business
* **Priority**: P1-High
* **Size**: M
* **Duration**: 5 weeks
* **Dependencies**: EP06 (Session Analysis), EP14 (Skills Effectiveness)
* **Extends**: ADR-0006 (Session Log Processing Architecture)

## In Scope

* File operation extraction from session logs (Read/Write/Edit paths)
* Re-read ratio calculation (total reads / unique files)
* Compression event extraction with session context
* Token usage data per session
* Data access tools for agent-driven efficiency analysis

## Out of Scope

* Real-time context monitoring
* Automatic context optimization
* Cross-session file access patterns
* Programmatic "hotspot detection" (agent reasons about patterns)

## Key Deliverables

### Phase 1: Core Implementation (Weeks 1-2)

1. **File Operation Indexer**
   - Extract file paths from Read/Write/Edit tool calls in session logs
   - Track file access patterns per session (which files, how many times)
   - Store access data for agent querying

2. **Compression Event Extractor**
   - Extract compression events from session logs
   - Correlate with session characteristics (timestamp, position in session)
   - Provide context for agent to reason about causes

3. **Token Usage Data**
   - Extract token counts per session
   - Track effective token usage (total - cache hits where available)
   - Provide historical data for trend analysis

4. **Context Efficiency Data Tools**
   - `getFileAccessPatternsTool` - Query file access data by session/date
   - `getCompressionEventsTool` - Query compression events with context
   - `getTokenUsageTool` - Query token usage metrics
   - `getSessionEfficiencyDataTool` - Combined efficiency data for a session

**Agent Reasoning (NOT tools):**
- Whether re-read ratios indicate a problem
- Which files are "hotspots" worth addressing
- Whether skills/delegation correlate with better efficiency
- What efficiency deltas are meaningful

### Phase 2: Integration (Weeks 3-4)

1. **CLI Integration**
   - Add context efficiency metrics to `agentlint analyse` output
   - Add `--context` flag for focused efficiency analysis
   - Agent presents correlation insights

2. **Baseline Integration**
   - Store efficiency metrics in baselines for trend analysis
   - Enable delta comparison between baseline periods
   - Agent reasons about trends over time

3. **Skills Integration**
   - Cross-reference efficiency data with skills usage from EP14
   - Provide data for agent to reason about skill impact on efficiency

4. **Testing**
   - Unit tests for file access extraction, compression parsing
   - Integration tests for CLI output
   - Test fixtures with varied compression patterns

### Phase 3: Cleanup (Week 5)

1. **Dead Code Removal**
   - Remove any redundant metrics code from EP06
   - Clean up temporary data extraction scaffolding

2. **Consolidation**
   - Merge overlapping metric types if any
   - Standardize efficiency data formats

3. **Documentation**
   - Update Arc42 with Context Efficiency Data component
   - Update ADR-0006 with efficiency data extension
   - Add efficiency data interpretation guide

## Technical Approach

### File Access Extraction

```typescript
interface FileAccess {
  sessionId: string;
  filePath: string;
  operation: 'read' | 'write' | 'edit';
  timestamp: string;
  accessSequence: number;
}

// Deterministic extraction—tool extracts data, agent interprets
function extractFileAccesses(entries: SessionEntry[]): FileAccess[] {
  const accesses: FileAccess[] = [];
  let sequence = 0;

  for (const entry of entries) {
    for (const block of entry.message?.content || []) {
      if (block.type === 'tool_use' && isFileOperation(block.name)) {
        accesses.push({
          sessionId: entry.sessionId,
          filePath: block.input?.file_path || block.input?.path,
          operation: classifyOperation(block.name),
          timestamp: entry.timestamp,
          accessSequence: sequence++,
        });
      }
    }
  }

  return accesses;
}
```

### Database Schema

```sql
CREATE TABLE file_accesses (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('read', 'write', 'edit')),
  timestamp TEXT NOT NULL,
  access_sequence INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX idx_file_accesses_session ON file_accesses(session_id);
CREATE INDEX idx_file_accesses_path ON file_accesses(file_path);
```

## Success Criteria

- [ ] Tools provide file access data, compression events, and token usage
- [ ] Agent can reason about efficiency patterns using provided data
- [ ] Agent can correlate efficiency with feature usage
- [ ] Clean codebase with no redundant metrics code
- [ ] Tools return data; agent provides judgment (Constitution Principle VII)

## Constitution Alignment

| Principle | Alignment |
|-----------|-----------|
| II. Improvement-Oriented | Efficiency data enables continuous optimization |
| IV. Mixed-Methods | Quantitative data + agent qualitative analysis |
| VII. Intelligent Tooling | Tools provide data; agent reasons about efficiency |
| VIII. Compounding Value | Efficiency insights compound over time |

## Related Documents

- [ADR-0006: Session Log Processing Architecture](../../architecture/adr/0006-session-log-processing-architecture.md)
- [EP14: Skills Effectiveness Analysis](./EP14-skills-effectiveness.md)
- [Strategic Review](../../review/agentlint-strategic-review-jan26.md)
