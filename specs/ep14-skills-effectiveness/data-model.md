# Data Model: Skills Effectiveness Analysis

> **Epic**: EP14
> **Created**: 2026-01-24

---

## Entities

### SkillInvocation

A single invocation of a Skill extracted from session logs.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | INTEGER | Yes | Auto-increment primary key |
| session_id | TEXT | Yes | Foreign key to sessions table |
| skill_name | TEXT | Yes | Name of the invoked skill (from `input.skill`) |
| timestamp | TEXT | Yes | ISO-8601 timestamp of invocation |
| user_prompt_snippet | TEXT | No | First 200 chars of triggering user prompt |
| file_path | TEXT | No | Source JSONL file path (for causal tracing) |
| line_number | INTEGER | No | Line number in source file |

**Constraints**:
- `session_id` must reference existing session in `sessions` table
- `timestamp` must be valid ISO-8601 format

**Indexes**:
- `skill_name` - for filtering by skill
- `session_id` - for joining with session data
- `timestamp` - for date range queries

---

### SkillInventoryItem

A Skill defined in `.claude/skills/` directory. Not stored in database—queried at runtime from filesystem using existing `discoverSkills()`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Skill identifier (from frontmatter) |
| description | string | Yes | What the skill does (max 200 chars) |
| path | string | Yes | Path to SKILL.md file |
| filePatterns | string[] | No | Hint patterns for agent (NOT matching rules) |
| contentSections | string[] | No | Section headings in SKILL.md |
| userInvocable | boolean | Yes | Whether user can invoke directly |
| disableModelInvocation | boolean | Yes | Whether model auto-invocation disabled |

**Source**: Parsed from `SKILL.md` frontmatter using `src/tools/config/skills.ts`.

---

### SessionSummary

Summarized session data for agent reasoning about missed opportunities. Computed from existing session data—not a new table.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sessionId | string | Yes | Session UUID |
| timestamp | string | Yes | Session start timestamp |
| firstUserPrompt | string | Yes | First user message (truncated to 500 chars) |
| filesOperated | string[] | Yes | Files touched via Read/Write/Edit tools |
| skillsInvoked | string[] | Yes | Skills used in this session |
| turnCount | number | Yes | Total conversation turns |

**Computed from**: Joining `sessions`, `session_entries`, and `skill_invocations` tables.

---

## Entity Relationships

```
sessions (existing)
    │
    ├──1:N──> skill_invocations (NEW)
    │           "A session can have many skill invocations"
    │
    └──1:N──> session_entries (existing)
                "For extracting files operated"

SkillInventoryItem (filesystem)
    │
    └──1:N──> skill_invocations (database)
              "A defined skill may be invoked many times"
              "Joined on skill_name at query time"
```

---

## Database Schema

### New Table: skill_invocations

```sql
-- Skill invocations indexed from session logs
CREATE TABLE IF NOT EXISTS skill_invocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  skill_name TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  user_prompt_snippet TEXT,
  file_path TEXT,
  line_number INTEGER,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_skill_invocations_skill
  ON skill_invocations(skill_name);

CREATE INDEX IF NOT EXISTS idx_skill_invocations_session
  ON skill_invocations(session_id);

CREATE INDEX IF NOT EXISTS idx_skill_invocations_timestamp
  ON skill_invocations(timestamp);

-- Compound index for skill + date range queries
CREATE INDEX IF NOT EXISTS idx_skill_invocations_skill_time
  ON skill_invocations(skill_name, timestamp);
```

### Schema Migration

```typescript
// src/skills/storage/schema.ts
export const SKILL_INVOCATIONS_SCHEMA = `
  CREATE TABLE IF NOT EXISTS skill_invocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    skill_name TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    user_prompt_snippet TEXT,
    file_path TEXT,
    line_number INTEGER,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_skill_invocations_skill
    ON skill_invocations(skill_name);
  CREATE INDEX IF NOT EXISTS idx_skill_invocations_session
    ON skill_invocations(session_id);
  CREATE INDEX IF NOT EXISTS idx_skill_invocations_timestamp
    ON skill_invocations(timestamp);
  CREATE INDEX IF NOT EXISTS idx_skill_invocations_skill_time
    ON skill_invocations(skill_name, timestamp);
`;

export function initSkillInvocationsSchema(db: Database): void {
  db.exec(SKILL_INVOCATIONS_SCHEMA);
}
```

---

## Query Patterns

### Get Skill Invocations

```sql
-- By skill name with date filter
SELECT
  skill_name,
  session_id,
  timestamp,
  user_prompt_snippet
FROM skill_invocations
WHERE skill_name = ?
  AND timestamp >= ?
  AND timestamp <= ?
ORDER BY timestamp DESC
LIMIT ?;
```

### Get Session Summary (for agent reasoning)

```sql
-- Aggregate session data for missed opportunity analysis
SELECT
  s.session_id,
  s.first_timestamp as timestamp,
  (SELECT content
   FROM session_entries
   WHERE session_id = s.session_id
     AND role = 'user'
   ORDER BY timestamp ASC
   LIMIT 1) as first_user_prompt,
  s.entry_count as turn_count
FROM sessions s
WHERE s.first_timestamp >= ?
  AND s.first_timestamp <= ?
ORDER BY s.first_timestamp DESC
LIMIT ?;
```

### Get Files Operated (separate query)

```sql
-- Files touched in session via Read/Write/Edit
SELECT DISTINCT
  json_extract(tool_input, '$.file_path') as file_path,
  json_extract(tool_input, '$.path') as alt_path
FROM session_entries
WHERE session_id = ?
  AND tool_name IN ('Read', 'Write', 'Edit')
  AND (tool_input LIKE '%file_path%' OR tool_input LIKE '%path%');
```

### Get Invocation Counts

```sql
-- Per-skill summary (agent interprets counts)
SELECT
  skill_name,
  COUNT(*) as invocation_count,
  COUNT(DISTINCT session_id) as session_count,
  MIN(timestamp) as first_invocation,
  MAX(timestamp) as last_invocation
FROM skill_invocations
WHERE timestamp >= ?
GROUP BY skill_name
ORDER BY invocation_count DESC;
```

---

## Validation Rules

### SkillInvocation

| Field | Validation |
|-------|------------|
| session_id | Must exist in sessions table |
| skill_name | Non-empty string |
| timestamp | Valid ISO-8601 format |
| user_prompt_snippet | Max 200 characters (truncate on insert) |

### SkillInventoryItem

Validated by existing `src/tools/config/skills.ts`:
- Name: max 64 characters, lowercase + hyphens
- Description: max 200 characters (truncated)
- Path: must exist and be readable

---

## What Is NOT Stored

Per Constitution Principle VII, these are agent reasoning outputs—NOT database entities:

| Concept | Why Not Stored |
|---------|----------------|
| Missed opportunities | Agent determines from session + inventory context |
| Effectiveness scores | Agent judges using invocation data |
| Description mismatches | Agent performs semantic analysis |
| Improvement suggestions | Agent generates from mismatch analysis |
| Trend interpretations | Agent reasons about historical data |

The database stores **facts** (invocations happened). The agent provides **judgments** (whether this is good/bad).
