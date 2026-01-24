# Research Findings: Session Intelligence

> **Epic**: EP15
> **Created**: 2026-01-24

---

## Decision Log

### 1. Subagent Architecture Pattern

**Decision**: Use explicit spawn tool pattern (like `spawn_temporal_analyst`)

**Rationale**:
- Matches established codebase patterns (`src/temporal/tools/spawn-analyst.ts`, `src/recommendations/tools/spawn-advisor.ts`)
- Spawn tool builds context and returns AgentDefinition + prompt
- Orchestrator invokes subagent via SDK `agents` option
- Maintains separation: tool prepares context, SDK handles invocation

**Alternatives Considered**:
- Direct subagent registration via `buildACTSubagents()` → Less explicit, harder to pass dynamic context
- Tool that executes subagent directly → Violates tool/agent boundary (tool shouldn't call `query()`)

**References**:
- `src/temporal/tools/spawn-analyst.ts:297-413` (spawn tool pattern)
- `src/temporal/subagent/temporal-subagent.ts:244-267` (builder functions)
- ADR-0005: Tool Definition and Invocation Pattern

---

### 2. System Prompt Structure

**Decision**: Use 4-layer prompt structure: ROLE IDENTITY → DOMAIN KNOWLEDGE → YOUR TASK → TOOLS AVAILABLE

**Rationale**:
- Established pattern across all existing subagents
- Temporal Analyzer: ~6KB prompt
- Recommendation Advisor: ~8KB prompt
- Well under NFR-002 50KB limit
- Clear cognitive structure for agent reasoning

**Alternatives Considered**:
- Shorter prompt with runtime context injection → Loses domain expertise
- Longer prompt with more examples → Context bloat, diminishing returns

**References**:
- `src/temporal/subagent/temporal-subagent.ts:34-200` (TEMPORAL_ANALYZER_PROMPT)
- `src/recommendations/subagent/recommendation-advisor.ts:33-226` (RECOMMENDATION_ADVISOR_PROMPT)

---

### 3. Tool Access Control

**Decision**: Session Analyst gets all EP15 tools + basic query tools, but NO Task tool

**Rationale**:
- Constitution C8: Single subagent depth limit
- ACTInstructionsSchema enforces: `tools.refine((t) => !t.includes('Task'))`
- Subagent can query data but cannot spawn further subagents
- Pattern matches temporal-analyzer and recommendation-advisor

**Alternatives Considered**:
- Allow Task tool with depth tracking → Complicates architecture, risk of infinite nesting
- Minimal tool set → Limits subagent capability, requires more orchestrator intervention

**References**:
- `src/act/types.ts:74-79` (Task tool constraint in schema)
- `src/temporal/subagent/types.ts:47-56` (TEMPORAL_SUBAGENT_TOOLS excludes Task)

---

### 4. Database Schema Extension Strategy

**Decision**: Add new tables to existing `sessions.db`, use schema versioning

**Rationale**:
- ADR-0006 established single database file pattern
- Existing `schema_version` table supports migrations
- New tables can JOIN with existing `sessions`, `session_entries`
- EP14 skills module followed same pattern successfully

**Schema Design**:

```sql
-- Tool call sequences for flow analysis
CREATE TABLE tool_call_sequences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  input_hash TEXT NOT NULL,        -- SHA-256 of input JSON
  timestamp TEXT NOT NULL,
  sequence_index INTEGER NOT NULL, -- Position in session
  is_error INTEGER DEFAULT 0,
  error_message TEXT,
  file_path TEXT,                  -- Source JSONL for causal trace
  line_number INTEGER,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

-- File access tracking
CREATE TABLE file_accesses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  operation TEXT NOT NULL,         -- 'read' | 'write' | 'edit'
  timestamp TEXT NOT NULL,
  access_sequence INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

-- Compression events
CREATE TABLE compression_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  compression_type TEXT NOT NULL,  -- 'compact' | 'microcompact'
  pre_tokens INTEGER,
  tokens_saved INTEGER,
  summary_preserved TEXT,
  file_path TEXT,
  line_number INTEGER,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

-- Delegation events (Task tool invocations)
CREATE TABLE delegation_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  subagent_type TEXT NOT NULL,
  task_prompt TEXT,
  timestamp TEXT NOT NULL,
  turn_index INTEGER NOT NULL,
  success INTEGER DEFAULT 1,
  subagent_session_id TEXT,        -- Link to spawned session if available
  file_path TEXT,
  line_number INTEGER,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

-- MCP tool calls
CREATE TABLE mcp_tool_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  server_name TEXT NOT NULL,       -- Parsed from mcp__servername__toolname
  tool_name TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  is_error INTEGER DEFAULT 0,
  error_message TEXT,
  file_path TEXT,
  line_number INTEGER,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

-- Quality signals (test/build outcomes)
CREATE TABLE quality_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  signal_type TEXT NOT NULL,       -- 'test' | 'build' | 'lint'
  timestamp TEXT NOT NULL,
  passed INTEGER,                  -- null if indeterminate
  raw_output TEXT,                 -- For agent interpretation
  file_path TEXT,
  line_number INTEGER,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

-- Indexes for common queries
CREATE INDEX idx_tool_sequences_session ON tool_call_sequences(session_id);
CREATE INDEX idx_tool_sequences_hash ON tool_call_sequences(input_hash);
CREATE INDEX idx_tool_sequences_timestamp ON tool_call_sequences(timestamp);
CREATE INDEX idx_file_accesses_session ON file_accesses(session_id);
CREATE INDEX idx_file_accesses_path ON file_accesses(file_path);
CREATE INDEX idx_compression_events_session ON compression_events(session_id);
CREATE INDEX idx_delegation_events_session ON delegation_events(session_id);
CREATE INDEX idx_mcp_tool_calls_session ON mcp_tool_calls(session_id);
CREATE INDEX idx_mcp_tool_calls_server ON mcp_tool_calls(server_name);
CREATE INDEX idx_quality_signals_session ON quality_signals(session_id);
CREATE INDEX idx_quality_signals_type ON quality_signals(signal_type);
```

**Alternatives Considered**:
- Separate `session-intelligence.db` file → Complicates queries, loses JOIN capability
- In-memory only → No persistence, recompute on every query
- Store in FTS5 → Not appropriate for structured data queries

**References**:
- ADR-0006: Session Log Processing Architecture
- `src/persistence/sessions/fts.ts` (existing schema)
- `src/skills/storage/schema.ts` (EP14 extension pattern)

---

### 5. MCP Tool Detection Pattern

**Decision**: Parse tool names with `mcp__` prefix to extract server name

**Rationale**:
- Claude Code convention: `mcp__servername__toolname`
- Deterministic extraction (no heuristics)
- Example: `mcp__linear__list_issues` → server: `linear`, tool: `list_issues`

**Implementation**:

```typescript
function parseMcpToolName(toolName: string): { serverName: string; toolName: string } | null {
  const MCP_PREFIX = 'mcp__';
  if (!toolName.startsWith(MCP_PREFIX)) return null;

  const withoutPrefix = toolName.slice(MCP_PREFIX.length);
  const separatorIndex = withoutPrefix.indexOf('__');

  if (separatorIndex === -1) return null;

  return {
    serverName: withoutPrefix.slice(0, separatorIndex),
    toolName: withoutPrefix.slice(separatorIndex + 2),
  };
}
```

**Alternatives Considered**:
- Maintain list of known MCP servers → Incomplete, requires maintenance
- Regex matching → Less clear than explicit prefix check

**References**:
- Spec assumption: "MCP tool names follow `mcp__servername__toolname` convention"
- Claude Code MCP documentation

---

### 6. Tool Call Hashing for Pattern Detection

**Decision**: SHA-256 hash of JSON-stringified tool input

**Rationale**:
- Enables "stuck" pattern detection (same tool + same input = repeated attempt)
- Compact storage (64-char hex vs. full input)
- Deterministic (same input → same hash)
- Agent reasons about hash repetition patterns

**Implementation**:

```typescript
import { createHash } from 'crypto';

function hashToolInput(input: unknown): string {
  const normalized = JSON.stringify(input, Object.keys(input as object).sort());
  return createHash('sha256').update(normalized).digest('hex');
}
```

**Alternatives Considered**:
- Store full input → Storage bloat, context window overhead
- No hashing → Lose pattern detection capability
- MD5 → SHA-256 is standard, negligible performance difference

**References**:
- Spec FR-005: "Tool extracts tool call sequences with name, input hash, timestamp, index"

---

### 7. Quality Signal Detection

**Decision**: Tool provides raw output with pattern hints; agent interprets meaning

**Rationale**:
- Clarification C2: Agent interprets raw test output
- Constitution VII: Tools provide data, agent judges
- Works with any test framework
- No parser maintenance burden

**Implementation Pattern**:

```typescript
interface QualitySignal {
  sessionId: string;
  signalType: 'test' | 'build' | 'lint';
  timestamp: string;
  passed: boolean | null;  // null if indeterminate
  rawOutput: string;       // First N chars of output for agent
  hints: {
    looksLikeTest: boolean;
    containsPass: boolean;
    containsFail: boolean;
    containsError: boolean;
  };
}
```

**Detection Patterns** (hints, not rules):
- Test: Contains "test", "PASS", "FAIL", "assertion", framework names
- Build: Contains "build", "compile", "error:", warning patterns
- Lint: Contains "lint", "ESLint", "warning", formatting issues

**Alternatives Considered**:
- Framework-specific parsers (bun, jest, pytest) → Maintenance burden, incomplete coverage
- No detection → Lose useful signal, agent must scan all Bash results
- Hardcoded pass/fail → Violates Constitution VII

**References**:
- Spec Clarification C2: "Agent interprets raw output"
- Constitution VII: Intelligent Tooling

---

### 8. Incremental Analysis Implementation

**Decision**: Subagent requests data in phases via separate tool calls

**Rationale**:
- Clarification C1: Incremental, not upfront
- 19MB session = ~4-5M tokens raw; can't fit in context
- Subagent uses ~50K tokens per analysis (NFR-003)
- Tool queries return filtered, paginated results

**Phase Pattern**:

1. `get_session_timeline(sessionId)` → Returns metadata, intent (first prompt), outcome signals
2. `get_tool_sequences(sessionId, {limit: 100, offset: 0})` → Paginated tool calls
3. `get_compression_events(sessionId)` → All compressions (typically few)
4. `get_quality_signals(sessionId)` → Test/build outcomes
5. Agent synthesizes narrative from collected data

**Tool Response Sizes** (estimated):
- Session timeline: ~500 tokens (metadata + intent)
- Tool sequences (100 calls): ~3K tokens
- Compression events: ~500 tokens
- Quality signals: ~1K tokens
- Total per phase: ~5K tokens → 5 phases = ~25K tokens (well under 50K)

**Alternatives Considered**:
- Single mega-query → Context overflow, bad AX
- Fixed phase boundaries → Too rigid, sessions vary
- Agent-driven pagination only → May miss important data

**References**:
- Spec Clarification C1: "Incremental analysis"
- NFR-003: "< 50K tokens input"

---

### 9. Intent Extraction

**Decision**: First user prompt in session = intent marker

**Rationale**:
- FR-002: "Tool identifies first user prompt as intent marker"
- Sessions typically start with user stating their goal
- Simple, deterministic extraction
- Agent can interpret/summarize the intent

**Implementation**:

```typescript
function extractIntent(entries: SessionEntry[]): { prompt: string; timestamp: string } | null {
  const firstUserEntry = entries.find(e =>
    e.type === 'user' &&
    e.message?.content?.some(b => b.type === 'text')
  );

  if (!firstUserEntry) return null;

  const textBlock = firstUserEntry.message.content.find(b => b.type === 'text');
  return {
    prompt: textBlock.text,
    timestamp: firstUserEntry.timestamp,
  };
}
```

**Alternatives Considered**:
- Semantic analysis of all prompts → Expensive, overkill
- Agent extracts intent → Redundant, first prompt is obvious
- Skip intent → Lose key narrative element

**References**:
- Spec FR-002: Intent identification
- Spec US-001: "first user prompt is identified as intent"

---

### 10. Outcome Signal Detection

**Decision**: Heuristic hints for outcome, agent determines actual status

**Rationale**:
- Sessions end in various ways (completion, abandonment, interruption)
- Tool provides signals, agent interprets
- Constitution VII: No hardcoded judgment

**Outcome Signals** (data, not judgment):
- Last user prompt (may indicate satisfaction/frustration)
- Final tool call success/failure
- Presence of commit-related activity
- Session duration vs. turns (context for completeness)
- Explicit signals: "thanks", "done", error patterns

**Implementation**:

```typescript
interface SessionOutcome {
  lastUserPrompt: string | null;
  lastToolCall: { name: string; success: boolean } | null;
  hasCommitActivity: boolean;
  sessionDuration: number;  // ms
  turnCount: number;
  signals: {
    containsThanks: boolean;
    containsDone: boolean;
    endsWithError: boolean;
    hasUnresolvedError: boolean;
  };
}
// Agent judges: completed successfully, abandoned, interrupted, etc.
```

**Alternatives Considered**:
- Binary completed/abandoned → Too simplistic
- No outcome tracking → Lose narrative closure
- Agent scans full session → Expensive, redundant with tool

**References**:
- Spec FR-004: "Tool detects session outcome signals"

---

## Technical Validations

### Existing Code Reuse

| Component | Existing Implementation | Reuse Strategy |
|-----------|------------------------|----------------|
| Session parsing | `src/tools/sessions/parser.ts` | Extend `parseSessionFile()` |
| Session indexing | `src/tools/sessions/indexer.ts` | Add new extraction passes |
| Database helpers | `src/persistence/sessions/fts.ts` | Add new tables, queries |
| Tool patterns | `src/skills/tools/*.ts` | Copy SDK tool structure |
| Subagent patterns | `src/temporal/subagent/*.ts` | Copy prompt + builder pattern |
| Spawn tool pattern | `src/temporal/tools/spawn-analyst.ts` | Copy tool structure |
| Type patterns | `src/skills/types.ts` | Follow Constitution VII notes |

### Performance Validation

Based on existing benchmarks and requirements:

| Metric | Target | Evidence/Plan |
|--------|--------|---------------|
| Indexing speed | > 50 sessions/sec (NFR-001) | Existing indexer achieves 150+; new passes add ~20% overhead |
| Query time | < 500ms (NFR-002) | SQLite indexes on session_id, timestamp; pagination limits |
| Memory usage | < 500MB (NFR-004) | Stream processing pattern from existing parser |
| Subagent context | < 50K tokens (NFR-003) | Incremental requests, paginated results |

---

## Unresolved Items

None. All open questions from spec have been resolved:
- C1: Analysis approach → Incremental (phase-by-phase)
- C2: Test output → Agent interprets raw output
- C3: Phase detection → Agent-reasoned

---

## SDK Integration Notes

### Claude Agent SDK Subagent Pattern

From research on SDK documentation and existing codebase:

1. **AgentDefinition Structure**:
```typescript
interface AgentDefinition {
  description: string;  // When to invoke (Claude reads this)
  prompt: string;       // System prompt
  tools?: string[];     // Allowed tools (omit = inherit, [] = deny all)
  model?: 'sonnet' | 'opus' | 'haiku' | 'inherit';
}
```

2. **Spawn Tool Pattern**:
- Tool builds context and returns AgentDefinition + queryPrompt
- Tool does NOT execute subagent directly
- Orchestrator sees tool result and invokes subagent via SDK `agents` option

3. **Depth Constraint Enforcement**:
- Subagent tools array MUST NOT include 'Task'
- Validated at construction time by ACTInstructionsSchema
- Prevents recursive subagent spawning

4. **Tool Registration**:
- Tools defined with `tool()` from SDK
- Registered via ToolRegistry
- Available to subagent via `tools` array in AgentDefinition

### Session Analyst Tool List

Based on requirements and existing patterns:

```typescript
const SESSION_ANALYST_TOOLS = [
  // EP15 Session Intelligence tools
  'get_session_timeline',
  'get_tool_sequences',
  'get_file_accesses',
  'get_compression_events',
  'get_delegation_events',
  'get_mcp_usage',
  'get_quality_signals',

  // Existing useful tools
  'search_sessions',        // FTS5 search if needed
  'get_session_stats',      // Aggregate metrics
  'get_skill_invocations',  // EP14 skill data

  // NO 'Task' - depth=1 constraint
] as const;
```
