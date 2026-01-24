# EP15: Session Intelligence

## Business Outcome Hypothesis

**If** we provide a subagent that can understand what happened in sessions and why,
**Then** users gain insight into workflow effectiveness, quality, and efficiency—contextualised against what the agent was trying to accomplish,
**Measured by** the agent's ability to explain session narratives, identify issues with root causes, and provide actionable recommendations.

## Classification

* **Type**: Business
* **Priority**: P1-High
* **Size**: L
* **Dependencies**: EP06 (Session Analysis), EP14 (Skills Effectiveness)
* **Consolidates**: EP16 (Symptom Patterns), EP18 (Subagent Delegation)
* **Extends**: ADR-0006 (Session Log Processing Architecture)

## The Core Insight

A session is not just data—it's a **story** with:
- **Intent** (what the user wanted)
- **Exploration** (what the agent learned)
- **Challenges** (errors, dead ends, confusion)
- **Decisions** (why the agent chose one approach over another)
- **Resolution** (did the task succeed?)

Tools can extract metrics. Only agent reasoning can understand meaning.

**10 million tokens means nothing** unless contextualised against:
- What was the agent trying to accomplish?
- How complex was the task?
- Did the agent succeed?
- Was the journey efficient for that complexity?

## What "Session Intelligence" Means

The agentlint agent should be able to answer:

| Question | Type |
|----------|------|
| What was the user trying to accomplish? | Intent |
| Did the agent understand and deliver? | Effectiveness |
| Was the journey smooth or chaotic? | Flow |
| Was the output high quality? | Quality |
| Were resources appropriate for the task? | Efficiency |
| Would the user be satisfied? | Satisfaction |

## In Scope

### Session Narrative Extraction
* Turn-by-turn timeline with key events
* Intent detection (first user prompt analysis)
* Outcome detection (success/failure signals)
* Compression boundary extraction with what was preserved/lost
* Session phase detection (exploration, implementation, debugging)

### Flow Analysis (from EP16)
* Tool call sequence extraction
* Pattern data for agent reasoning (repeated calls, error clusters)
* Re-read ratio data with context (WHY re-reads happened)
* Permission interaction data
* CLAUDE.md rule comparison data

### Orchestration Analysis (from EP18)
* Subagent (Task tool) invocation extraction
* Parent-child session relationships
* Context offloading measurement
* Delegation timing and effectiveness data

### MCP Usage Quality (from EP19 runtime signals)
* MCP tool invocation extraction (`mcp__*` prefix)
* Per-server usage data (call count, success/failure)
* Error message extraction with context
* Usage patterns for agent to reason about

### Quality Signals
* Test result extraction (pass/fail from tool results)
* Build/lint outcome extraction
* User correction frequency (same file edited multiple times)
* Session continuation vs. restart patterns

### Session Understanding Subagent
* Dedicated subagent for session analysis
* Takes extracted data, produces narrative understanding
* Can compare sessions ("this one went better because...")
* Generates actionable insights

## Out of Scope

* Real-time session monitoring
* Automatic remediation
* Cross-project session comparison (future epic)
* Hardcoded thresholds or scoring (agent reasons about meaning)
* MCP configuration validation (stays in EP19 as static analysis)

## Key Deliverables

### Phase 1: Session Narrative Core

1. **Session Timeline Extractor**
   - Extract turn-by-turn timeline from session logs
   - Mark key events: user prompts, tool clusters, errors, compaction
   - Detect session phases (exploration, implementation, debugging)
   - Provide timeline data for agent consumption

2. **Intent & Outcome Detector**
   - Extract first user prompt as intent marker
   - Detect agent's initial understanding (first response analysis)
   - Extract completion signals (success messages, task done indicators)
   - Identify abandonment or restart patterns

3. **Compression Event Processor**
   - Extract `compact_boundary` and `microcompact_boundary` events
   - Capture `preTokens` and `tokensSaved` data
   - Extract the summary message that replaced detailed history
   - Enable agent to reason about knowledge loss

4. **Session Narrative Tool**
   - `getSessionNarrativeTool` - Structured timeline with key events
   - Returns phases, key moments, compression points
   - Optimised for subagent context window

### Phase 2: Flow Analysis (absorbs EP16)

1. **Tool Call Sequence Indexer**
   - Extract tool calls with name, input hash, timestamp, sequence
   - Store patterns for agent querying
   - Agent determines what constitutes "circular" or "stuck"

2. **Error Cycle Detector**
   - Extract error events with surrounding context
   - Group by time proximity
   - Provide data for agent to identify retry loops

3. **Re-read Pattern Extractor**
   - Track file access per session (Read tool calls)
   - Calculate per-file access counts
   - Include timestamps for agent to reason about WHY re-reads

4. **Permission Interaction Extractor**
   - Extract permission approval/denial events
   - Track patterns per tool/permission type
   - Agent reasons about friction

5. **Flow Analysis Tools**
   - `getToolCallSequenceTool` - Query tool call sequences
   - `getErrorClustersTool` - Query error events with context
   - `getFileAccessPatternsTool` - Query file access data
   - `getPermissionInteractionsTool` - Query permission events

### Phase 3: Orchestration Analysis (absorbs EP18)

1. **Delegation Event Extractor**
   - Parse `tool_use.name === "Task"` entries
   - Extract subagent type, prompt, timing
   - Link to subagent session files where available

2. **Context Offload Measurement**
   - Extract token usage from main session before/after delegation
   - Capture delegation timing (early vs. late in session)
   - Provide data for agent to assess delegation effectiveness

3. **Orchestration Tools**
   - `getDelegationEventsTool` - Query delegation events
   - `getSubagentInventoryTool` - List available subagent types

### Phase 4: Quality Signals

1. **Test Result Extractor**
   - Parse Bash tool results for test pass/fail patterns
   - Extract test counts (passed, failed, skipped)
   - Track test stability across session

2. **Build Outcome Extractor**
   - Parse build/lint/typecheck results from tool outputs
   - Extract success/failure with error messages
   - Track build stability

3. **User Correction Detector**
   - Track edit frequency per file
   - Identify files with many revisions (potential issues)
   - Agent reasons about correction patterns

4. **Quality Signal Tools**
   - `getTestResultsTool` - Query test outcomes per session
   - `getBuildOutcomesTool` - Query build/lint outcomes
   - `getUserCorrectionsTool` - Query correction patterns

### Phase 5: MCP Usage Quality (from EP19)

1. **MCP Invocation Extractor**
   - Parse `tool_use.name.startsWith("mcp__")` entries
   - Extract server name from tool name prefix
   - Track success/failure via `is_error` flag
   - Capture error messages

2. **MCP Usage Tools**
   - `getMcpUsageStatsTool` - Query per-server usage data
   - `getMcpErrorsTool` - Query MCP error events with context

### Phase 6: Session Understanding Subagent

1. **Session Analyst Subagent Definition**
   - Dedicated subagent for session analysis
   - Receives extracted session data
   - Produces narrative understanding

2. **Subagent Capabilities**
   - Explain what happened in a session
   - Identify flow issues with root causes
   - Assess session quality (flow, effectiveness, efficiency)
   - Compare sessions when requested
   - Generate actionable recommendations

3. **Subagent Prompting**
   - Structured input format for session data
   - Clear output format for findings
   - Guidelines for balanced quantitative/qualitative assessment

## Technical Approach

### Session Timeline Structure

```typescript
interface SessionTimeline {
  sessionId: string;
  startTime: string;
  endTime: string;
  totalTurns: number;

  intent: {
    firstUserPrompt: string;
    agentUnderstanding: string;  // First agent response
  };

  phases: SessionPhase[];

  keyEvents: TimelineEvent[];

  compressions: CompressionEvent[];

  outcome: {
    completed: boolean;
    successSignals: string[];
    failureSignals: string[];
  };

  metrics: {
    totalInputTokens: number;
    totalOutputTokens: number;
    cacheHitRate: number;
    toolCallCount: number;
    errorCount: number;
    delegationCount: number;
  };
}

interface SessionPhase {
  type: 'exploration' | 'implementation' | 'debugging' | 'review' | 'unknown';
  startTurn: number;
  endTurn: number;
  summary: string;  // Brief description for agent context
}

interface TimelineEvent {
  turn: number;
  timestamp: string;
  type: 'user_prompt' | 'tool_cluster' | 'error' | 'delegation' | 'compression' | 'milestone';
  summary: string;
}

interface CompressionEvent {
  timestamp: string;
  type: 'compact' | 'microcompact';
  preTokens: number;
  tokensSaved?: number;
  summaryPreserved: string;  // What the summary said
}
```

### Database Schema Extensions

```sql
-- Session timeline data (extends sessions table)
ALTER TABLE sessions ADD COLUMN first_user_prompt TEXT;
ALTER TABLE sessions ADD COLUMN agent_understanding TEXT;
ALTER TABLE sessions ADD COLUMN completed_successfully BOOLEAN;
ALTER TABLE sessions ADD COLUMN phase_summary TEXT;  -- JSON array of phases

-- Tool call sequences for flow analysis
CREATE TABLE tool_call_sequences (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  sequence_index INTEGER NOT NULL,
  is_error BOOLEAN DEFAULT 0,
  error_message TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX idx_tool_calls_session ON tool_call_sequences(session_id);
CREATE INDEX idx_tool_calls_hash ON tool_call_sequences(input_hash);

-- File access tracking
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

-- Compression events
CREATE TABLE compression_events (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  compression_type TEXT NOT NULL CHECK (compression_type IN ('compact', 'microcompact')),
  pre_tokens INTEGER NOT NULL,
  tokens_saved INTEGER,
  summary_text TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX idx_compression_session ON compression_events(session_id);

-- Delegation events
CREATE TABLE delegation_events (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  subagent_type TEXT NOT NULL,
  task_prompt TEXT,
  timestamp TEXT NOT NULL,
  turn_index INTEGER NOT NULL,
  completed_successfully BOOLEAN DEFAULT 1,
  subagent_session_id TEXT,  -- If we can link to subagent log
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX idx_delegation_session ON delegation_events(session_id);
CREATE INDEX idx_delegation_type ON delegation_events(subagent_type);

-- MCP tool calls
CREATE TABLE mcp_tool_calls (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  server_name TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  is_error BOOLEAN DEFAULT 0,
  error_message TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX idx_mcp_calls_session ON mcp_tool_calls(session_id);
CREATE INDEX idx_mcp_calls_server ON mcp_tool_calls(server_name);

-- Quality signals
CREATE TABLE quality_signals (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('test_result', 'build_outcome', 'lint_outcome')),
  timestamp TEXT NOT NULL,
  passed BOOLEAN,
  details TEXT,  -- JSON with counts, messages
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX idx_quality_session ON quality_signals(session_id);
```

### Session Analyst Subagent

```typescript
// Subagent definition for session analysis
const sessionAnalystSubagent = {
  type: 'session-analyst',
  description: `Analyze session data to understand what happened and why.

Given session timeline, tool patterns, and quality signals, provide:
1. Narrative summary of what happened
2. Assessment of session quality (flow, effectiveness, efficiency)
3. Identified issues with root causes
4. Actionable recommendations

Balance quantitative metrics with qualitative understanding.
Contextualise resource usage against task complexity.
Focus on insights that help users improve their workflows.`,

  tools: [
    'getSessionNarrativeTool',
    'getToolCallSequenceTool',
    'getFileAccessPatternsTool',
    'getDelegationEventsTool',
    'getMcpUsageStatsTool',
    'getTestResultsTool',
  ],

  maxTurns: 5,  // Limited scope per analysis
};
```

## Success Criteria

### Data Extraction
- [ ] Session timeline extraction captures intent, phases, key events, outcome
- [ ] Tool call sequences indexed with hashes for pattern detection
- [ ] Compression events extracted with pre-tokens and summaries
- [ ] Delegation events linked to subagent types and timing
- [ ] MCP usage data extracted with success/failure tracking
- [ ] Quality signals captured from tool results

### Agent Understanding
- [ ] Subagent can explain what happened in a session (narrative)
- [ ] Subagent can identify flow issues (circular calls, error loops)
- [ ] Subagent can assess quality (tests passed, build succeeded)
- [ ] Subagent can contextualise efficiency (tokens vs. task complexity)
- [ ] Subagent can compare sessions when asked

### Integration
- [ ] CLI integrates session intelligence into `agentlint analyse`
- [ ] Subagent can be invoked for focused session analysis
- [ ] Results are actionable (user can do something with insights)

### Constitution Compliance
- [ ] Tools provide data; agent provides judgment (Principle VII)
- [ ] No hardcoded thresholds—agent reasons about meaning
- [ ] Subagent respects context window limits (AX)

## Constitution Alignment

| Principle | Alignment |
|-----------|-----------|
| II. Improvement-Oriented | Session intelligence enables continuous workflow optimisation |
| III. Causal-First | Agent traces issues to root causes using session data |
| IV. Mixed-Methods | Quantitative metrics + qualitative narrative understanding |
| VII. Intelligent Tooling | Tools provide data; subagent reasons about meaning |
| VIII. Compounding Value | Session insights compound over time with baselines |
| IX. Agent-Aware | Subagent design respects context window economics |

## Related Documents

- [ADR-0006: Session Log Processing Architecture](../../architecture/adr/0006-session-log-processing-architecture.md)
- [EP14: Skills Effectiveness Analysis](./EP14-skills-effectiveness.md)
- [EP19: MCP Config Validation](./EP19-mcp-config-validation.md) (static analysis only)
- [Strategic Review](../../review/agentlint-strategic-review-jan26.md)
- [Constitution](../../../.specify/memory/constitution.md)
