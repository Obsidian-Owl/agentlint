# Research Findings: EP03 Persistence Layer

> Research conducted: 2026-01-16

## Decision Log

### 1. Bun:sqlite WAL Mode Support

**Decision**: Use WAL (Write-Ahead Logging) mode for all SQLite databases

**Rationale**:
- Bun's SQLite implementation fully supports WAL mode
- WAL provides better crash safety (writes complete atomically)
- Enables concurrent reads during writes
- Consistent with ADR-0008 requirements

**Implementation**:
```typescript
import { Database } from "bun:sqlite";
const db = new Database("baselines.db");
db.exec("PRAGMA journal_mode = WAL;");
```

**References**: Bun SQLite docs, ADR-0008

---

### 2. Session State Integration with EP02

**Decision**: EP03 provides storage layer; EP02's `session-state.ts` already has basic file operations

**Rationale**:
- EP02 implemented `saveState()` / `loadState()` for session state JSON
- EP03 should provide enhanced capabilities (SQLite index, queries, atomic writes)
- Avoid breaking EP02's existing interface

**Integration Approach**:
1. EP03 creates `src/persistence/sessions/storage.ts` with enhanced operations
2. EP02's `session-state.ts` can delegate to EP03 or be refactored
3. Maintain backward compatibility with existing session file format

**Existing EP02 Types to Reuse**:
- `SessionState` - Already defined in `src/orchestration/types.ts`
- `Finding`, `Origin`, `Recommendation` - Already defined
- `SessionStateFile` - Already has version field

---

### 3. Baseline Type Design

**Decision**: Define `Baseline` as extension of analysis snapshot, not a new entity

**Rationale**:
- Baselines capture analysis output at a point in time
- Should include metrics derivable from `SessionState` findings
- Git commit tracking per ADR-0008

**Schema**:
```typescript
interface Baseline {
  id: string;                      // UUID
  version: string;                 // Schema version (e.g., "1.0.0")
  createdAt: string;               // ISO-8601
  projectPath: string;             // Absolute path
  actType: string;                 // From ProjectContext.agentType
  configPath: string | null;       // Path to analyzed config
  gitCommit: string | null;        // HEAD at baseline time

  // Aggregated metrics (queryable via SQLite)
  metrics: {
    findingsCount: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    infoCount: number;
  };

  // Full findings snapshot
  findings: Finding[];

  // User annotations
  label: string | null;
  notes: string | null;
}
```

**References**: ADR-0008, EP02 `Finding` type

---

### 4. Learning File Format

**Decision**: Use Markdown with YAML frontmatter for learnings (human-editable)

**Rationale**:
- ADR-0009 specifies Markdown + YAML frontmatter
- Human-readable and editable
- YAML provides structured metadata
- Note: sqlite-vec for semantic search deferred to EP12

**Schema**:
```yaml
---
id: "abc123-def456"
version: "1.0"
created_at: "2026-01-16T10:30:00Z"
updated_at: "2026-01-16T10:30:00Z"
origin:
  project: "/path/to/project"
  session_id: "session-uuid"
tags:
  - error-handling
  - api
category: "patterns"
scope: "project"  # or "global"
---

# Learning Title

## Summary
Brief description...

## Context
How this was discovered...

## Example
Code example if applicable...
```

**References**: ADR-0009

---

### 5. Atomic Write Implementation

**Decision**: Use temp file + rename pattern via `Bun.write()`

**Rationale**:
- `Bun.write()` is fast and handles buffer/string efficiently
- POSIX `rename()` is atomic on same filesystem
- Pattern: write to `.tmp` file, then `rename()` to final path

**Implementation**:
```typescript
import { rename } from 'node:fs/promises';
import { join, dirname } from 'node:path';

async function atomicWrite(path: string, content: string): Promise<void> {
  const tmpPath = `${path}.tmp.${Date.now()}`;
  await Bun.write(tmpPath, content);
  await rename(tmpPath, path);
}
```

**Edge Cases**:
- If rename fails, temp file may remain (cleanup on next write)
- Cross-filesystem rename fails (not expected for `.agentlint/`)

**References**: ADR-0008, ADR-0010

---

### 6. Directory Initialization Strategy

**Decision**: Lazy initialization on first write operation

**Rationale**:
- Don't create directories until needed
- Each module initializes its own subdirectory
- Permission setting on directory creation

**Implementation**:
```typescript
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

async function ensureDir(dir: string, mode: number = 0o700): Promise<void> {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true, mode });
  }
}
```

---

### 7. SQLite Index Schema Design

**Decision**: Separate SQLite databases for baselines and learnings

**Rationale**:
- Baselines are project-local only → `.agentlint/baselines.db`
- Learnings have two scopes:
  - Project: `.agentlint/learnings.db`
  - Global: `~/.agentlint/learnings.db`
- Per clarification session: query both learnings DBs when listing

**Baselines DB Schema**:
```sql
CREATE TABLE IF NOT EXISTS baselines (
  id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  project_path TEXT NOT NULL,
  act_type TEXT NOT NULL,
  git_commit TEXT,

  -- Indexed metrics
  findings_count INTEGER NOT NULL DEFAULT 0,
  critical_count INTEGER NOT NULL DEFAULT 0,
  high_count INTEGER NOT NULL DEFAULT 0,
  medium_count INTEGER NOT NULL DEFAULT 0,
  low_count INTEGER NOT NULL DEFAULT 0,
  info_count INTEGER NOT NULL DEFAULT 0,

  -- User annotations
  label TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_baselines_created_at ON baselines(created_at);
CREATE INDEX IF NOT EXISTS idx_baselines_label ON baselines(label);
```

**Learnings DB Schema**:
```sql
CREATE TABLE IF NOT EXISTS learnings (
  id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
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

### 8. Performance Considerations

**Decision**: Index metrics in SQLite, not full content

**Rationale**:
- JSON files store full content (human-readable)
- SQLite stores metadata + metrics (fast queries)
- Avoid duplicating large content in SQLite
- Query SQLite for filtering, load JSON for full content

**Performance Targets**:
| Operation | Target | Approach |
|-----------|--------|----------|
| Query 50 baselines | < 2s | SQLite indexed query |
| Save baseline | < 500ms | Atomic write + index insert |
| Save checkpoint | < 100ms | Single JSON write |
| Load session state | < 50ms | Single JSON read |

---

## Unresolved Items

**None** - All technical unknowns resolved.

---

## Next Steps

1. Proceed to Phase 2: Data Model Design
2. Create TypeScript interfaces in `contracts/interfaces.ts`
3. Create `data-model.md` with full entity definitions
4. Create `quickstart.md` usage guide
