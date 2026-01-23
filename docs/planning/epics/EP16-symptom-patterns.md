# EP16: Symptom Pattern Detector

## Business Outcome Hypothesis

**If** we implement symptom pattern detection for circular calls, instruction drift, and permission friction,
**Then** users can identify workflow issues and receive actionable recommendations to resolve them,
**Measured by** pattern detection accuracy, false positive rate, and recommendation implementation rate.

## Classification

* **Type**: Business
* **Priority**: P1-High
* **Size**: M
* **Duration**: 5 weeks
* **Dependencies**: EP06 (Session Analysis), EP07 (Causal Tracing)
* **Extends**: ADR-0006 (Session Log Processing Architecture)

## In Scope

* Circular tool call detection (same tool + input 3+ times)
* Instruction drift detection (behavior contradicting CLAUDE.md rules)
* High compression session flagging (>3 compression events)
* Permission friction analysis (high-frequency approvals)
* Pattern-to-recommendation generation

## Out of Scope

* Real-time pattern alerting
* Automatic pattern remediation
* Cross-project pattern comparison

## Key Deliverables

### Phase 1: Core Implementation (Weeks 1-2)

1. **Circular Call Detector**
   - Identify same tool + input combination appearing 3+ times in sequence
   - Distinguish retry patterns (with backoff) from stuck loops
   - Classify severity: warning (3x), high (5x), critical (10x)
   - Extract context around circular calls for diagnosis

2. **Instruction Drift Detector**
   - Parse CLAUDE.md rules into testable constraints
   - Analyze session behavior against constraints
   - Detect contradictions with evidence (rule + violating action)
   - Track drift frequency and patterns

3. **Compression Hotspot Detector**
   - Flag sessions with >3 compression events as "high compression"
   - Correlate with session characteristics (length, tool usage, file count)
   - Identify predictive indicators for compression risk

4. **Permission Friction Analyzer**
   - Track permission approval patterns across sessions
   - Identify high-frequency approvals (candidates for auto-allow)
   - Generate suggested permission configuration
   - Calculate friction score (approvals per session)

5. **Symptom Pattern Tools**
   - `detectSymptomPatternsTool` - Comprehensive pattern scan
   - `getCircularCallsTool` - Query circular call incidents
   - `analyzePermissionFrictionTool` - Permission pattern analysis
   - `detectInstructionDriftTool` - Rule violation detection

### Phase 2: Integration (Weeks 3-4)

1. **CLI Integration**
   - Add pattern findings to `agentlint analyse` output
   - Add `--patterns` flag for focused pattern analysis
   - Show pattern severity with actionable recommendations

2. **Causal Tracing Integration**
   - Link symptom patterns to causal chains from EP07
   - Enable "why did this pattern occur?" analysis
   - Connect patterns to configuration gaps

3. **Recommendation Integration**
   - Generate recommendations from detected patterns
   - Permission friction → suggested permission config
   - Circular calls → debugging guidance
   - Instruction drift → rule enforcement suggestions

4. **Testing**
   - Unit tests for each pattern detector
   - Integration tests with synthetic problem sessions
   - VCR tests for agent-driven pattern analysis

### Phase 3: Cleanup (Week 5)

1. **Dead Code Removal**
   - Remove superseded pattern detection from EP07 if any overlap
   - Clean up experimental detection algorithms not promoted

2. **Pattern Consolidation**
   - Standardize pattern severity levels
   - Unify pattern output format

3. **Documentation**
   - Update Arc42 with Symptom Pattern Detection component
   - Update ADR-0006 with pattern detection extension
   - Add pattern interpretation guide with examples

## Technical Approach

### Circular Call Detection

```typescript
interface CircularCallPattern {
  sessionId: string;
  toolName: string;
  inputHash: string;
  occurrences: number;
  firstOccurrence: string;
  lastOccurrence: string;
  severity: 'warning' | 'high' | 'critical';
}

function detectCircularCalls(entries: SessionEntry[]): CircularCallPattern[] {
  const callCounts = new Map<string, { count: number; timestamps: string[] }>();

  for (const entry of entries) {
    for (const block of entry.message?.content || []) {
      if (block.type === 'tool_use') {
        const key = `${block.name}:${hashInput(block.input)}`;
        const existing = callCounts.get(key) || { count: 0, timestamps: [] };
        existing.count++;
        existing.timestamps.push(entry.timestamp);
        callCounts.set(key, existing);
      }
    }
  }

  return Array.from(callCounts.entries())
    .filter(([_, data]) => data.count >= 3)
    .map(([key, data]) => ({
      sessionId: entries[0].sessionId,
      toolName: key.split(':')[0],
      inputHash: key.split(':')[1],
      occurrences: data.count,
      firstOccurrence: data.timestamps[0],
      lastOccurrence: data.timestamps[data.timestamps.length - 1],
      severity: data.count >= 10 ? 'critical' : data.count >= 5 ? 'high' : 'warning',
    }));
}
```

### Database Schema

```sql
CREATE TABLE symptom_patterns (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  pattern_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  evidence TEXT,
  detected_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX idx_symptom_patterns_type ON symptom_patterns(pattern_type);
```

## Success Criteria

- [ ] Can detect circular tool calls with context
- [ ] Can identify instruction drift with evidence
- [ ] Can suggest permission optimizations
- [ ] Clean integration with causal tracing
- [ ] Integration with EP17 TUI for pattern exploration

## Constitution Alignment

| Principle | Alignment |
|-----------|-----------|
| III. Causal-First | Traces symptoms to root causes |
| IV. Mixed-Methods | Quantitative patterns + qualitative diagnosis |
| VII. Intelligent Tooling | Rich pattern data for agent reasoning |

## Related Documents

- [ADR-0006: Session Log Processing Architecture](../../architecture/adr/0006-session-log-processing-architecture.md)
- [EP07: Causal Tracing Engine](./EP07-causal-tracing.md)
- [Strategic Review](../../review/agentlint-strategic-review-jan26.md)
