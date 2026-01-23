# EP15: Context Efficiency Engine

## Business Outcome Hypothesis

**If** we implement context efficiency analysis with file re-read tracking and compression correlation,
**Then** users can understand what's causing context pressure and how Skills/delegation reduce it,
**Measured by** compression rate reduction, re-read ratio improvement, and efficiency delta accuracy.

## Classification

* **Type**: Business
* **Priority**: P1-High
* **Size**: M
* **Duration**: 5 weeks
* **Dependencies**: EP06 (Session Analysis), EP14 (Skills Effectiveness)
* **Extends**: ADR-0006 (Session Log Processing Architecture)

## In Scope

* File operation tracking from session logs (Read/Write/Edit paths)
* Re-read ratio calculation (total reads / unique files)
* Compression correlation with skill usage
* Compression correlation with subagent delegation
* Efficiency delta calculation (WITH feature vs. WITHOUT)
* Token efficiency trends over time

## Out of Scope

* Real-time context monitoring
* Automatic context optimization
* Cross-session file access patterns

## Key Deliverables

### Phase 1: Core Implementation (Weeks 1-2)

1. **File Operation Tracker**
   - Extract file paths from Read/Write/Edit tool calls in session logs
   - Track file access patterns per session (which files, how many times)
   - Calculate re-read ratio: total reads / unique files read
   - Identify re-read hotspots (files read 3+ times)

2. **Compression Correlation Analyzer**
   - Correlate compression events with skill usage in same session
   - Correlate compression events with subagent delegation
   - Calculate efficiency deltas:
     - Sessions WITH skills vs. WITHOUT: compression rate delta
     - Sessions WITH delegation vs. WITHOUT: compression rate delta

3. **Token Efficiency Metrics**
   - Effective token usage (total - cache hits)
   - Context pressure score (how close to compression threshold)
   - Token efficiency trends over time

4. **Context Efficiency Tools**
   - `analyzeContextEfficiencyTool` - Comprehensive efficiency analysis
   - `getFileAccessPatternsTool` - Query file access data
   - `calculateEfficiencyDeltaTool` - Compare feature impact on efficiency

### Phase 2: Integration (Weeks 3-4)

1. **CLI Integration**
   - Add context efficiency metrics to `agentlint analyse` output
   - Add `--context` flag for focused context efficiency analysis
   - Show correlation insights in summary

2. **Baseline Integration**
   - Store efficiency metrics in baselines for trend analysis
   - Enable delta comparison between baseline periods
   - Add efficiency data to temporal trends

3. **Skills Integration**
   - Cross-reference efficiency with skills usage from EP14
   - Show "efficiency impact" for each skill

4. **Testing**
   - Unit tests for re-read calculation, correlation analysis
   - Integration tests for CLI output
   - Test fixtures with varied compression patterns

### Phase 3: Cleanup (Week 5)

1. **Dead Code Removal**
   - Remove any redundant metrics code from EP06
   - Clean up temporary correlation calculation scaffolding

2. **Consolidation**
   - Merge overlapping metric types if any
   - Standardize efficiency metric naming

3. **Documentation**
   - Update Arc42 with Context Efficiency component
   - Update ADR-0006 with efficiency metrics extension
   - Add efficiency interpretation guide

## Technical Approach

### File Access Tracking

```typescript
interface FileAccess {
  sessionId: string;
  filePath: string;
  operation: 'read' | 'write' | 'edit';
  timestamp: string;
  accessSequence: number;
}

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

- [ ] Can report file re-read ratios with hotspot identification
- [ ] Can correlate compression with feature usage
- [ ] Can quantify context savings from skills/delegation
- [ ] Clean codebase with no redundant metrics code
- [ ] Integration with EP17 TUI for drill-down analysis

## Constitution Alignment

| Principle | Alignment |
|-----------|-----------|
| II. Improvement-Oriented | Efficiency tracking enables continuous optimization |
| IV. Mixed-Methods | Quantitative efficiency + qualitative correlation |
| VIII. Compounding Value | Efficiency improvements compound over time |

## Related Documents

- [ADR-0006: Session Log Processing Architecture](../../architecture/adr/0006-session-log-processing-architecture.md)
- [EP14: Skills Effectiveness Analysis](./EP14-skills-effectiveness.md)
- [Strategic Review](../../review/agentlint-strategic-review-jan26.md)
