# Data Model: EP17 TUI Architecture

> **Epic**: EP17
> **Created**: 2026-01-24
> **Status**: Complete

---

## Entities

### AppState

Central state model for the TUI application. Single source of truth managed by `appReducer`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| analysisPhase | `AnalysisPhase` | Yes | Current phase of agent analysis |
| viewStack | `DialogType[]` | Yes | Stack of active dialog overlays (empty = main view) |
| focusTarget | `FocusTarget` | Yes | Current focus for key routing |
| explorationPath | `ExplorationStep[]` | Yes | Breadcrumb trail of drill-down navigation |
| currentContext | `ConversationalContext` | Yes | Agent's understanding of current topic |
| inputBuffer | `string` | Yes | Buffered user input during streaming |
| streamBuffer | `StreamChunk[]` | Yes | Current agent output being displayed |
| findings | `Finding[]` | Yes | Discovered issues from analysis |
| recommendations | `Recommendation[]` | Yes | Actionable suggestions |
| isStreaming | `boolean` | Yes | Whether agent is currently outputting |
| isPaused | `boolean` | Yes | Whether agent output is at a pause point |
| permissionCache | `Map<string, PermissionDecision>` | Yes | Session-only permission cache |
| lastCheckpoint | `CheckpointData \| null` | No | Last checkpoint for recovery |

**Validation Rules:**
- `viewStack` can be empty (main view) or have 1+ dialogs
- `explorationPath` can be empty (root level)
- `inputBuffer` can be empty
- When `isStreaming` is true, input should buffer (not process immediately)

**State Transitions:**
```
analysisPhase:
  idle → scanning (user runs agentlint)
  scanning → presenting (analysis complete)
  presenting → exploring (user asks follow-up)
  exploring → exploring (deeper drill-down)
  exploring → presenting (user goes back)
  * → idle (exit)
```

---

### AppMessage

Typed action for state transitions via `appReducer`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| type | `AppMessageType` | Yes | Action type (discriminator) |
| payload | `varies` | Depends | Action-specific data |

**Message Types:**

| Type | Payload | Effect |
|------|---------|--------|
| `SET_PHASE` | `{ phase: AnalysisPhase }` | Update analysisPhase |
| `PUSH_DIALOG` | `{ dialog: DialogType, context?: any }` | Push dialog to viewStack |
| `POP_DIALOG` | `{}` | Pop top dialog from viewStack |
| `ADD_STREAM_CHUNK` | `{ chunk: StreamChunk }` | Append to streamBuffer |
| `CLEAR_STREAM` | `{}` | Clear streamBuffer |
| `SET_STREAMING` | `{ isStreaming: boolean }` | Update streaming state |
| `SET_PAUSED` | `{ isPaused: boolean }` | Update pause state |
| `UPDATE_INPUT_BUFFER` | `{ input: string }` | Update inputBuffer |
| `CLEAR_INPUT_BUFFER` | `{}` | Clear inputBuffer |
| `ADD_EXPLORATION_STEP` | `{ step: ExplorationStep }` | Push to explorationPath |
| `POP_EXPLORATION` | `{}` | Pop from explorationPath (back) |
| `ADD_FINDING` | `{ finding: Finding }` | Append to findings |
| `ADD_RECOMMENDATION` | `{ recommendation: Recommendation }` | Append to recommendations |
| `SET_CONTEXT` | `{ context: ConversationalContext }` | Update currentContext |
| `CACHE_PERMISSION` | `{ key: string, decision: PermissionDecision }` | Add to permissionCache |
| `SET_FOCUS` | `{ target: FocusTarget }` | Update focusTarget |
| `SET_CHECKPOINT` | `{ checkpoint: CheckpointData }` | Update lastCheckpoint |

---

### ExplorationStep

Single step in the drill-down navigation history.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | `string` | Yes | Unique identifier (UUID) |
| topic | `string` | Yes | Topic being explored (e.g., "Skill invocation") |
| context | `string` | Yes | Brief context for breadcrumb display |
| timestamp | `string` | Yes | ISO-8601 when step was taken |
| parentId | `string \| null` | No | Parent step ID for tree structure |

**Relationships:**
- `ExplorationStep` --1:1--> parent `ExplorationStep` (via parentId)

---

### AgentOption

Option presented by the agent for user selection (enables numeric shortcuts like "1", "2").

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| label | `string` | Yes | Display label |
| description | `string` | No | Brief description |
| value | `string` | Yes | Value to send if selected |

---

### ConversationalContext

Agent's current understanding of user intent for prompt construction.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| currentTopic | `string \| null` | No | Topic currently being discussed |
| drillDownDepth | `number` | Yes | How deep in exploration (0 = root) |
| mentionedEntities | `string[]` | Yes | Skills, sessions, configs mentioned |
| lastAgentQuestion | `string \| null` | No | Last question agent asked user |
| lastUserResponse | `string \| null` | No | Last thing user said |
| pendingOptions | `AgentOption[]` | Yes | Options agent presented (for "1", "2" interpretation) |

---

### PermissionDecision

Cached decision for a permission request.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| allowed | `boolean` | Yes | Whether permission was granted |
| scope | `'session' \| 'permanent'` | Yes | How long decision lasts |
| grantedAt | `string` | Yes | ISO-8601 when decision was made |
| tool | `string` | Yes | Tool name that was permitted/denied |
| pattern | `string \| null` | No | Path pattern if applicable |

---

### PermissionStore (Persistent)

File format for `~/.agentlint/permissions.json`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| version | `'1.0.0'` | Yes | Schema version |
| permissions | `Record<string, PermissionRecord>` | Yes | Keyed by permission identifier |

**PermissionRecord:**
```typescript
interface PermissionRecord {
  allowed: boolean;
  scope: 'permanent';  // Only permanent ones stored
  grantedAt: string;
  tool: string;
  pattern?: string;
}
```

---

## Enums

### AnalysisPhase

```typescript
type AnalysisPhase = 'idle' | 'scanning' | 'presenting' | 'exploring';
```

### DialogType

```typescript
type DialogType =
  | 'permission'      // Permission request dialog
  | 'recommendation'  // Recommendation with actions
  | 'session-list'    // Session picker
  | 'session-timeline'; // Timeline view (P3)
```

### FocusTarget

```typescript
type FocusTarget =
  | 'main'           // Main view (agent output + input)
  | 'dialog'         // Active dialog
  | 'input';         // Input field specifically
```

---

## Entity Relationships

```
AppState --1:N--> ExplorationStep (explorationPath)
AppState --1:1--> ConversationalContext (currentContext)
AppState --0:N--> DialogType (viewStack)
AppState --0:N--> PermissionDecision (permissionCache)
AppState --1:N--> Finding (findings) [from orchestration/types]
AppState --1:N--> Recommendation (recommendations) [from orchestration/types]
AppState --0:N--> StreamChunk (streamBuffer) [from orchestration/types]

ExplorationStep --0:1--> ExplorationStep (parent via parentId)

PermissionStore --1:N--> PermissionRecord (permissions)
```

---

## Notes

### Separation from Orchestration Types

EP17 TUI entities are distinct from EP02 Orchestration types:

| EP17 TUI (this doc) | EP02 Orchestration | Relationship |
|---------------------|-------------------|--------------|
| AppState | SessionState | AppState contains session info but adds UI state |
| StreamChunk[] | StreamChunk | TUI buffers chunks for display |
| Finding[] | Finding | Same type, TUI stores for interaction |
| ConversationalContext | CognitiveWorkspace | Similar purpose but TUI-focused |

### No Detection/Judgment Types

Per Constitution Principle VII, this data model does NOT include:
- "missed opportunity" detection results
- "underutilized skill" judgments
- Threshold-based classifications

The agent generates these through reasoning; they're not persisted in the data model.
