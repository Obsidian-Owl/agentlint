# Data Model: EP03 Persistence Layer

> **Epic**: EP03
> **Created**: 2026-01-16
> **Status**: Final

---

## Overview

The Persistence Layer manages three primary data domains:
1. **Baselines** - Analysis snapshots for temporal comparison
2. **Learnings** - Insights with project or global scope
3. **Sessions** - Checkpoint state for crash recovery

Each domain follows the "JSON file + SQLite index" pattern from ADR-0008.

---

## 1. Baselines

### 1.1 Baseline Entity

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | UUID v4 identifier |
| `version` | string | Yes | Schema version (e.g., "1.0.0") |
| `createdAt` | string | Yes | ISO-8601 timestamp |
| `projectPath` | string | Yes | Absolute path to project root |
| `actType` | string | Yes | ACT adapter type (e.g., "claude-code") |
| `configPath` | string | No | Path to analyzed configuration file |
| `gitCommit` | string | No | Git HEAD commit hash at baseline time |
| `metrics` | BaselineMetrics | Yes | Aggregated finding counts |
| `findings` | Finding[] | Yes | Full findings snapshot |
| `label` | string | No | User-assigned label (e.g., "before-refactor") |
| `notes` | string | No | User notes about this baseline |

### 1.2 BaselineMetrics

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `findingsCount` | number | Yes | Total findings |
| `criticalCount` | number | Yes | Severity breakdown |
| `highCount` | number | Yes | |
| `mediumCount` | number | Yes | |
| `lowCount` | number | Yes | |
| `infoCount` | number | Yes | |

### 1.3 Storage

**File Location**: `.agentlint/baselines/{timestamp}-{id}.json`
- Timestamp format: `YYYY-MM-DDTHH-MM-SS`
- Example: `2026-01-16T14-30-00-abc123.json`

**Symlink**: `.agentlint/baselines/latest.json` → most recent baseline

**SQLite Index**: `.agentlint/baselines.db`

```sql
CREATE TABLE IF NOT EXISTS baselines (
  id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  project_path TEXT NOT NULL,
  act_type TEXT NOT NULL,
  git_commit TEXT,
  findings_count INTEGER NOT NULL DEFAULT 0,
  critical_count INTEGER NOT NULL DEFAULT 0,
  high_count INTEGER NOT NULL DEFAULT 0,
  medium_count INTEGER NOT NULL DEFAULT 0,
  low_count INTEGER NOT NULL DEFAULT 0,
  info_count INTEGER NOT NULL DEFAULT 0,
  label TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_baselines_created_at ON baselines(created_at);
CREATE INDEX IF NOT EXISTS idx_baselines_label ON baselines(label);
CREATE INDEX IF NOT EXISTS idx_baselines_git_commit ON baselines(git_commit);
```

---

## 2. Learnings

### 2.1 Learning Entity (Markdown + YAML Frontmatter)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | UUID v4 identifier |
| `version` | string | Yes | Schema version |
| `createdAt` | string | Yes | ISO-8601 timestamp |
| `updatedAt` | string | Yes | ISO-8601 timestamp |
| `title` | string | Yes | Learning title |
| `content` | string | Yes | Markdown body content |
| `tags` | string[] | No | Classification tags |
| `category` | LearningCategory | Yes | patterns, anti-patterns, tools, workflows |
| `scope` | LearningScope | Yes | project, global |
| `origin` | LearningOrigin | No | Where this learning came from |

### 2.2 LearningOrigin

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `project` | string | No | Source project path |
| `sessionId` | string | No | Source session ID |
| `promotedAt` | string | No | When promoted to global |

### 2.3 LearningCategory

```typescript
type LearningCategory = 'patterns' | 'anti-patterns' | 'tools' | 'workflows';
```

### 2.4 LearningScope

```typescript
type LearningScope = 'project' | 'global';
```

### 2.5 Storage

**Project Learnings**: `.agentlint/learnings/{date}-{slug}-{id}.md`
**Global Learnings**: `~/.agentlint/learnings/{date}-{slug}-{id}.md`

Example filename: `2026-01-16-api-error-handling-abc123.md`

**SQLite Index**:
- Project: `.agentlint/learnings.db`
- Global: `~/.agentlint/learnings.db`

```sql
CREATE TABLE IF NOT EXISTS learnings (
  id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('patterns', 'anti-patterns', 'tools', 'workflows')),
  tags TEXT,  -- JSON array
  scope TEXT NOT NULL CHECK (scope IN ('project', 'global')),
  origin_project TEXT,
  origin_session_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_learnings_category ON learnings(category);
CREATE INDEX IF NOT EXISTS idx_learnings_scope ON learnings(scope);
CREATE INDEX IF NOT EXISTS idx_learnings_created_at ON learnings(created_at);
```

---

## 3. Sessions

### 3.1 SessionState Entity

> Note: This type is already defined in EP02 (`src/orchestration/types.ts`). EP03 provides the storage implementation.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Session UUID (matches SDK session_id) |
| `phase` | string | Yes | Current analysis phase |
| `startedAt` | string | Yes | ISO-8601 timestamp |
| `lastCheckpointAt` | string | No | ISO-8601 timestamp |
| `findings` | Finding[] | Yes | Accumulated findings |
| `toolResultCache` | Record<string, ToolResult> | Yes | Cached tool results |
| `checkpointSequence` | number | Yes | Monotonic checkpoint counter |
| `taskGoal` | string | Yes | Original task goal |
| `projectContext` | ProjectContext | Yes | Project metadata |

### 3.2 SessionStateFile

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | string | Yes | File format version |
| `sessionState` | SessionState | Yes | The session state |

### 3.3 Storage

**File Location**: `.agentlint/sessions/{sessionId}-state.json`

> Note: EP02 currently stores sessions in `~/.agentlint/sessions/`. EP03 can maintain both locations for backward compatibility.

---

## 4. Entity Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                      Project (.agentlint/)                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌──────────────┐         ┌──────────────┐                │
│   │   Baseline   │ 1:N     │   Finding    │                │
│   │              │─────────│              │                │
│   │ - id         │         │ - id         │                │
│   │ - metrics    │         │ - type       │                │
│   │ - findings[] │         │ - severity   │                │
│   │ - label      │         │ - origin     │                │
│   └──────────────┘         └──────────────┘                │
│          │                        │                         │
│          │ derived from           │ aggregated into         │
│          ▼                        │                         │
│   ┌──────────────┐                │                         │
│   │SessionState  │◄───────────────┘                         │
│   │              │                                          │
│   │ - phase      │         ┌──────────────┐                │
│   │ - findings[] │         │  ToolResult  │                │
│   │ - cache      │ 1:N     │              │                │
│   │              │─────────│ - toolName   │                │
│   └──────────────┘         │ - output     │                │
│                            └──────────────┘                │
│                                                             │
│   ┌──────────────┐                                         │
│   │  Learning    │ (project scope)                         │
│   │              │                                          │
│   │ - title      │                                          │
│   │ - category   │                                          │
│   │ - tags       │                                          │
│   └──────────────┘                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   Global (~/.agentlint/)                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌──────────────┐                                         │
│   │  Learning    │ (global scope)                          │
│   │              │                                          │
│   │ - origin     │ ◄─── promoted from project learning      │
│   │ - promotedAt │                                          │
│   └──────────────┘                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. State Transitions

### 5.1 Baseline Lifecycle

```
[Created] → [Labeled] → [Archived]
              ↑
              │ user assigns label
              │
```

### 5.2 Learning Lifecycle

```
[Draft] → [Project] → [Global]
              │           ↑
              │           │ promoted
              └───────────┘
```

### 5.3 Session Lifecycle

```
[Active] → [Checkpointed] → [Completed]
    │           │               │
    │           └───→ [Crashed] │
    │                     │     │
    │                     ▼     │
    │               [Recovered] │
    │                     │     │
    └─────────────────────┴─────┘
```

---

## 6. Validation Rules

### Baselines

| Rule | Description | Error |
|------|-------------|-------|
| Valid UUID | `id` must be UUID v4 format | `INVALID_BASELINE_ID` |
| Version present | `version` must match known versions | `UNKNOWN_BASELINE_VERSION` |
| Non-empty path | `projectPath` must be absolute path | `INVALID_PROJECT_PATH` |
| Metrics consistency | Sum of severity counts = findingsCount | Warning only |

### Learnings

| Rule | Description | Error |
|------|-------------|-------|
| Valid UUID | `id` must be UUID v4 format | `INVALID_LEARNING_ID` |
| Valid category | `category` must be in allowed list | `INVALID_CATEGORY` |
| Valid scope | `scope` must be 'project' or 'global' | `INVALID_SCOPE` |
| Title required | `title` must be non-empty | `MISSING_TITLE` |

### Sessions

| Rule | Description | Error |
|------|-------------|-------|
| Version match | `version` must match current or be migratable | `SESSION_VERSION_MISMATCH` |
| Valid phase | `phase` must be recognized phase name | Warning only |

---

## 7. Indexing Strategy

### Baselines Index

| Query Pattern | Index Used |
|---------------|------------|
| Get by ID | PRIMARY KEY |
| Get latest | `idx_baselines_created_at` (ORDER BY DESC LIMIT 1) |
| Get by label | `idx_baselines_label` |
| Get by date range | `idx_baselines_created_at` |
| Get by git commit | `idx_baselines_git_commit` |

### Learnings Index

| Query Pattern | Index Used |
|---------------|------------|
| Get by ID | PRIMARY KEY |
| Filter by category | `idx_learnings_category` |
| Filter by scope | `idx_learnings_scope` |
| Get recent | `idx_learnings_created_at` |

---

## 8. Migration Strategy

### Schema Versioning

- All JSON files include `version` field
- On load: check version, apply best-effort parsing
- Log warnings for unknown fields (don't fail)
- No automatic migration in MVP

### Future Migration Pattern

```typescript
interface MigrationHandler {
  fromVersion: string;
  toVersion: string;
  migrate: (data: unknown) => unknown;
}

const migrations: MigrationHandler[] = [
  // Add migrations here when schema changes
];
```
