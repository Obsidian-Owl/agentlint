# Data Model: Session Intelligence

> **Epic**: EP15
> **Created**: 2026-01-24

---

## Entities

### SessionTimeline

Primary entity representing the narrative structure of a session.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sessionId | string | Yes | UUID from session log |
| projectPath | string | Yes | Decoded project path |
| startTime | string | Yes | ISO-8601 timestamp |
| endTime | string | Yes | ISO-8601 timestamp |
| duration | number | Yes | Duration in milliseconds |
| turnCount | number | Yes | Total user + assistant exchanges |
| intent | Intent | Yes | Extracted user intent |
| outcome | SessionOutcome | Yes | Session completion signals |

### Intent

First user prompt as the session's stated goal.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| firstUserPrompt | string | Yes | Text of first user message |
| timestamp | string | Yes | When intent was stated |
| promptLength | number | Yes | Character count (context hint) |

### SessionOutcome

Signals about how the session concluded (data, not judgment).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| lastUserPrompt | string | No | Final user message (if any) |
| lastToolCall | ToolCallSummary | No | Final tool invocation |
| hasCommitActivity | boolean | Yes | Whether git commit occurred |
| turnCount | number | Yes | Total turns for context |
| signals | OutcomeSignals | Yes | Detection hints |

### OutcomeSignals

Hints for agent interpretation of session outcome.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| containsThanks | boolean | Yes | User expressed gratitude |
| containsDone | boolean | Yes | User indicated completion |
| endsWithError | boolean | Yes | Last message was error |
| hasUnresolvedError | boolean | Yes | Error without recovery |

---

### ToolCallRecord

Single tool invocation with input hash for pattern detection.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | number | Yes | Auto-increment primary key |
| sessionId | string | Yes | Parent session UUID |
| toolName | string | Yes | Tool name (e.g., "Read", "Edit") |
| inputHash | string | Yes | SHA-256 of normalized input JSON |
| timestamp | string | Yes | ISO-8601 invocation time |
| sequenceIndex | number | Yes | Position in session (0-based) |
| isError | boolean | Yes | Whether tool returned error |
| errorMessage | string | No | Error text if isError=true |
| filePath | string | No | Source JSONL for causal trace |
| lineNumber | number | No | Line number in source file |

**Indexes**:
- `session_id` - Primary query dimension
- `input_hash` - Pattern detection ("stuck" loops)
- `timestamp` - Date range filtering
- `(session_id, sequence_index)` - Ordered traversal

---

### FileAccess

File operation for read/write pattern analysis.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | number | Yes | Auto-increment primary key |
| sessionId | string | Yes | Parent session UUID |
| filePath | string | Yes | Accessed file path |
| operation | 'read' \| 'write' \| 'edit' | Yes | Operation type |
| timestamp | string | Yes | ISO-8601 access time |
| accessSequence | number | Yes | Order within session |

**Indexes**:
- `session_id` - Primary query dimension
- `file_path` - Per-file access counts
- `(session_id, file_path)` - Re-read pattern detection

---

### CompressionEvent

Context compression occurrence.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | number | Yes | Auto-increment primary key |
| sessionId | string | Yes | Parent session UUID |
| timestamp | string | Yes | ISO-8601 compression time |
| compressionType | 'compact' \| 'microcompact' | Yes | Type from log |
| preTokens | number | No | Token count before compression |
| tokensSaved | number | No | Tokens removed |
| summaryPreserved | string | No | Summary text if available |
| filePath | string | No | Source JSONL for causal trace |
| lineNumber | number | No | Line number in source file |

**Indexes**:
- `session_id` - Primary query dimension
- `timestamp` - Chronological ordering

---

### DelegationEvent

Task tool invocation (subagent spawning).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | number | Yes | Auto-increment primary key |
| sessionId | string | Yes | Parent session UUID |
| subagentType | string | Yes | Subagent name from input |
| taskPrompt | string | No | Prompt passed to subagent |
| timestamp | string | Yes | ISO-8601 invocation time |
| turnIndex | number | Yes | Turn position in session |
| success | boolean | Yes | Whether delegation completed |
| subagentSessionId | string | No | Spawned session ID if available |
| filePath | string | No | Source JSONL for causal trace |
| lineNumber | number | No | Line number in source file |

**Indexes**:
- `session_id` - Primary query dimension
- `subagent_type` - Delegation pattern analysis

---

### McpToolCall

MCP server tool invocation.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | number | Yes | Auto-increment primary key |
| sessionId | string | Yes | Parent session UUID |
| serverName | string | Yes | Parsed from `mcp__server__tool` |
| toolName | string | Yes | Tool name within server |
| timestamp | string | Yes | ISO-8601 invocation time |
| isError | boolean | Yes | Whether call failed |
| errorMessage | string | No | Error text if isError=true |
| filePath | string | No | Source JSONL for causal trace |
| lineNumber | number | No | Line number in source file |

**Indexes**:
- `session_id` - Primary query dimension
- `server_name` - Per-server usage analysis

---

### QualitySignal

Test, build, or lint outcome indicator.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | number | Yes | Auto-increment primary key |
| sessionId | string | Yes | Parent session UUID |
| signalType | 'test' \| 'build' \| 'lint' | Yes | Signal category |
| timestamp | string | Yes | ISO-8601 detection time |
| passed | boolean \| null | No | null if indeterminate |
| rawOutput | string | No | First N chars for agent |
| filePath | string | No | Source JSONL for causal trace |
| lineNumber | number | No | Line number in source file |

**Indexes**:
- `session_id` - Primary query dimension
- `signal_type` - Category filtering

---

## Entity Relationships

```
Session (existing) --1:1--> SessionTimeline
Session --1:N--> ToolCallRecord
Session --1:N--> FileAccess
Session --1:N--> CompressionEvent
Session --1:N--> DelegationEvent
Session --1:N--> McpToolCall
Session --1:N--> QualitySignal

DelegationEvent --0:1--> Session (subagent session, if linked)
```

---

## Validation Rules

### ToolCallRecord
- `sessionId` must reference existing session
- `inputHash` must be 64-character hex (SHA-256)
- `sequenceIndex` must be >= 0
- `errorMessage` required if `isError` = true

### FileAccess
- `operation` must be one of: 'read', 'write', 'edit'
- `accessSequence` must be >= 0

### CompressionEvent
- `compressionType` must be one of: 'compact', 'microcompact'
- `preTokens` must be >= 0 if present
- `tokensSaved` must be >= 0 if present

### DelegationEvent
- `subagentType` must be non-empty string
- `turnIndex` must be >= 0

### McpToolCall
- `serverName` and `toolName` must be non-empty strings
- Both parsed from `mcp__servername__toolname` pattern

### QualitySignal
- `signalType` must be one of: 'test', 'build', 'lint'
- `passed` = null indicates indeterminate outcome
- `rawOutput` truncated to 1000 chars max

---

## State Transitions

Entities are append-only records extracted from session logs. No state machine; data is immutable once indexed.

**Session Re-indexing**:
When a session is re-indexed (force flag or file change):
1. Delete all EP15 records for that session_id
2. Re-extract all entities from session log
3. Insert new records

This ensures consistency without partial state.

---

## Query Patterns

### Get Session Timeline

```sql
SELECT
  s.session_id,
  s.project_path,
  s.first_timestamp,
  s.last_timestamp,
  s.entry_count as turn_count,
  s.input_tokens,
  s.output_tokens,
  s.compression_count
FROM sessions s
WHERE s.session_id = ?
```

### Get Tool Sequences (Paginated)

```sql
SELECT
  tool_name,
  input_hash,
  timestamp,
  sequence_index,
  is_error,
  error_message
FROM tool_call_sequences
WHERE session_id = ?
ORDER BY sequence_index
LIMIT ? OFFSET ?
```

### Detect "Stuck" Patterns

```sql
SELECT
  tool_name,
  input_hash,
  COUNT(*) as repeat_count,
  MIN(sequence_index) as first_occurrence,
  MAX(sequence_index) as last_occurrence
FROM tool_call_sequences
WHERE session_id = ?
GROUP BY tool_name, input_hash
HAVING COUNT(*) > 1
ORDER BY repeat_count DESC
```

### Get File Access Counts

```sql
SELECT
  file_path,
  operation,
  COUNT(*) as access_count
FROM file_accesses
WHERE session_id = ?
GROUP BY file_path, operation
ORDER BY access_count DESC
```

### Get Compression Events

```sql
SELECT *
FROM compression_events
WHERE session_id = ?
ORDER BY timestamp
```

### Get MCP Usage by Server

```sql
SELECT
  server_name,
  COUNT(*) as call_count,
  SUM(CASE WHEN is_error THEN 1 ELSE 0 END) as error_count,
  ROUND(100.0 * SUM(CASE WHEN is_error THEN 1 ELSE 0 END) / COUNT(*), 2) as error_rate
FROM mcp_tool_calls
WHERE session_id = ?
GROUP BY server_name
```

### Get Quality Signals

```sql
SELECT
  signal_type,
  timestamp,
  passed,
  raw_output
FROM quality_signals
WHERE session_id = ?
ORDER BY timestamp
```

### Get Delegation Events

```sql
SELECT
  subagent_type,
  task_prompt,
  timestamp,
  turn_index,
  success,
  subagent_session_id
FROM delegation_events
WHERE session_id = ?
ORDER BY turn_index
```
