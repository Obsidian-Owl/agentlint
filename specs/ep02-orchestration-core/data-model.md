# Data Model: EP02 Orchestration Core

> **Created**: 2026-01-16
> **Status**: Complete

---

## Entities

### Orchestrator

The main orchestration class that wraps the SDK's `query()` function.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| config | `OrchestratorConfig` | Yes | Configuration for the orchestrator |
| toolRegistry | `ToolRegistry` | Yes | Registry of available tools |
| sessionState | `SessionState \| null` | No | Current session state (null if not started) |
| isActive | `boolean` | Yes | Whether orchestrator is currently running |

**Methods**:
- `run(task: string): AsyncGenerator<StreamChunk>` - Execute analysis task
- `resume(sessionId: string): AsyncGenerator<StreamChunk>` - Resume from checkpoint
- `interrupt(): Promise<void>` - Interrupt current execution

---

### OrchestratorConfig

Configuration loaded from global config file.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| model | `string` | No | `'claude-sonnet-4-20250514'` | Claude model to use |
| checkpointIntervalMs | `number` | No | `60000` | Checkpoint interval in milliseconds |
| verbosity | `VerbosityLevel` | No | `'normal'` | Output verbosity level |
| cwd | `string` | No | `process.cwd()` | Working directory |
| systemPromptAppend | `string` | No | `''` | Additional system prompt content |

---

### ToolRegistry

Registry of MCP tools available to the agent.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| tools | `Map<string, SdkMcpToolDefinition>` | Yes | Registered tool definitions |
| mcpServer | `McpSdkServerConfigWithInstance` | Yes | MCP server instance |

**Methods**:
- `register(tool: SdkMcpToolDefinition): void` - Register a tool
- `registerMany(tools: SdkMcpToolDefinition[]): void` - Register multiple tools
- `get(name: string): SdkMcpToolDefinition | undefined` - Get tool by name
- `list(): string[]` - List all tool names
- `toMcpServer(): McpSdkServerConfigWithInstance` - Get MCP server for SDK

---

### SessionState

Agentlint-specific session state (separate from SDK session).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | `string` | Yes | Session UUID (matches SDK session_id) |
| phase | `string` | Yes | Current analysis phase |
| startedAt | `string` | Yes | ISO-8601 start timestamp |
| lastCheckpointAt | `string \| null` | No | ISO-8601 last checkpoint timestamp |
| findings | `Finding[]` | Yes | Accumulated findings |
| toolResultCache | `Map<string, ToolResult>` | Yes | Cache of tool results |
| checkpointSequence | `number` | Yes | Monotonic checkpoint sequence number |
| taskGoal | `string` | Yes | Original task goal for context preservation |
| projectContext | `ProjectContext` | Yes | Project metadata |

**Serialization**: JSON to `~/.agentlint/sessions/{session-id}.json`

---

### Finding

A single analysis finding.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | `string` | Yes | Finding UUID |
| type | `FindingType` | Yes | Category of finding |
| severity | `Severity` | Yes | Impact severity |
| title | `string` | Yes | Short description |
| description | `string` | Yes | Detailed explanation |
| location | `Location \| null` | No | Source location if applicable |
| origin | `Origin \| null` | No | Traced origin (session, config, git) |
| recommendations | `Recommendation[]` | Yes | Suggested fixes |
| metadata | `Record<string, unknown>` | No | Additional data |
| detectedAt | `string` | Yes | ISO-8601 detection timestamp |
| detectedInPhase | `string` | Yes | Phase when detected |

---

### CheckpointEvent

Event emitted when checkpoint triggers.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| trigger | `CheckpointTrigger` | Yes | What triggered the checkpoint |
| sequence | `number` | Yes | Monotonic sequence number |
| sessionId | `string` | Yes | Session ID |
| state | `SessionState` | Yes | Full session state snapshot |
| timestamp | `string` | Yes | ISO-8601 timestamp |
| metadata | `CheckpointMetadata` | No | Additional context |

---

### StreamChunk

Unit of streaming output.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| type | `StreamChunkType` | Yes | Type of chunk |
| level | `VerbosityLevel` | Yes | Minimum verbosity to display |
| content | `string` | Yes | Chunk content |
| timestamp | `string` | Yes | ISO-8601 timestamp |
| metadata | `Record<string, unknown>` | No | Additional context |

---

### CognitiveWorkspace

Hierarchical context structure for agent reasoning.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| taskGoal | `string` | Yes | Current task objective |
| projectContext | `ProjectContext` | Yes | Project metadata |
| progress | `ProgressSummary` | Yes | Analysis progress |
| findings | `FindingSummary[]` | Yes | Compressed findings list |
| baselineAwareness | `BaselineAwareness \| null` | No | Previous analysis context |
| globalLearnings | `string[]` | No | Relevant global learnings |

---

### ProjectContext

Metadata about the project being analyzed.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | `string` | Yes | Project name |
| path | `string` | Yes | Project root path |
| hasClaudeMd | `boolean` | Yes | Whether CLAUDE.md exists |
| primaryLanguage | `string \| null` | No | Detected primary language |
| agentType | `string` | No | Detected ACT (default: 'claude-code') |

---

## Enums and Type Aliases

### VerbosityLevel

```typescript
type VerbosityLevel = 'quiet' | 'normal' | 'verbose' | 'debug';
```

### StreamChunkType

```typescript
type StreamChunkType =
  | 'text'           // Agent reasoning text
  | 'tool_start'     // Tool invocation starting
  | 'tool_result'    // Tool result received
  | 'finding'        // New finding detected
  | 'phase_change'   // Phase transition
  | 'checkpoint'     // Checkpoint saved
  | 'error'          // Error occurred
  | 'status';        // Status update
```

### CheckpointTrigger

```typescript
type CheckpointTrigger =
  | 'tool_complete'  // After tool execution
  | 'finding'        // New finding detected
  | 'phase_change'   // Phase transition
  | 'interval'       // Time-based interval
  | 'user_request'   // Manual trigger
  | 'pre_compact'    // Before context compression
  | 'session_end';   // Session termination
```

### FindingType

```typescript
type FindingType =
  | 'config_gap'         // Missing or incomplete configuration
  | 'config_antipattern' // Configuration anti-pattern
  | 'session_pattern'    // Pattern detected in sessions
  | 'session_error'      // Error pattern in sessions
  | 'quality_issue'      // General quality concern
  | 'improvement';       // Improvement opportunity
```

### Severity

```typescript
type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
```

---

## Entity Relationships

```
Orchestrator --1:1--> OrchestratorConfig
Orchestrator --1:1--> ToolRegistry
Orchestrator --1:1--> SessionState (when active)

SessionState --1:N--> Finding
SessionState --1:N--> ToolResult (cache)
SessionState --1:1--> ProjectContext

Orchestrator --1:N--> StreamChunk (emits)
Orchestrator --1:N--> CheckpointEvent (emits)

Finding --1:N--> Recommendation
Finding --0:1--> Origin
Finding --0:1--> Location

CognitiveWorkspace --1:1--> ProjectContext
CognitiveWorkspace --1:N--> FindingSummary
CognitiveWorkspace --0:1--> BaselineAwareness
```

---

## State Transitions

### Orchestrator Lifecycle

```
[Idle] --run(task)--> [Running] --complete--> [Idle]
                         |
                         +--interrupt()--> [Idle]
                         |
                         +--error--> [Error] --reset()--> [Idle]
```

### Session Phase Transitions (suggested, not enforced)

```
[init] --> [discovery] --> [analysis] --> [synthesis] --> [complete]
   |           |              |              |
   +-----------+--------------+--------------+-- (agent may skip or add phases)
```

---

## Validation Rules

### SessionState
- `id` must be valid UUID v4
- `phase` must be non-empty string
- `checkpointSequence` must be >= 0 and monotonically increasing
- `findings` array may be empty but must exist

### Finding
- `id` must be valid UUID v4
- `recommendations` must have at least one entry for actionable findings
- `severity` must be valid enum value

### OrchestratorConfig
- `checkpointIntervalMs` must be >= 1000 (1 second minimum)
- `model` must be valid Anthropic model identifier

---

## Persistence

### Session State File

**Location**: `~/.agentlint/sessions/{session-id}.json`

**Format**:
```json
{
  "version": "1.0.0",
  "sessionState": {
    "id": "uuid",
    "phase": "analysis",
    "startedAt": "2026-01-16T10:00:00Z",
    "lastCheckpointAt": "2026-01-16T10:05:00Z",
    "findings": [...],
    "toolResultCache": {...},
    "checkpointSequence": 5,
    "taskGoal": "Analyze config quality",
    "projectContext": {...}
  }
}
```

### Global Config File

**Location**: `~/.agentlint/config.json`

**Format**:
```json
{
  "model": "claude-sonnet-4-20250514",
  "checkpoint": {
    "intervalMs": 60000
  },
  "verbosity": "normal"
}
```
