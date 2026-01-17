---
status: accepted
date: 2026-01-14
decision-makers: [Project Lead]
consulted: []
informed: []
---

# ADR-0006: Session Log Processing Architecture

## Context and Problem Statement

Claude Code stores session logs as JSONL files at `~/.claude/projects/[encoded-dir]/*.jsonl`. These logs are essential for causal tracing (Constitution Principle III)—finding when and where issues originated. Users can accumulate 100s of MB of logs over months of usage. We need an architecture that enables fast, precise search across this data while supporting incremental updates as new sessions occur.

## Decision Drivers

- **Search Precision for Causal Tracing**: Primary requirement—finding exact moments when issues originated
- **Scale**: Must handle 100s of MB of logs (users report up to 379 MB)
- **Local-First**: Must work entirely on user's machine (Constitution Principle I)
- **Incremental Updates**: New session logs should be indexed automatically
- **Relevance Ranking**: Search results should be ranked by relevance, not just filtered
- **Line-Level Precision**: Causal traces need exact position markers (file:line)

## Considered Options

1. SQLite FTS5 (Full-Text Search)
2. DuckDB Direct Query
3. Hybrid: DuckDB + SQLite FTS5
4. In-Memory Indexing

## Decision Outcome

Chosen option: **"SQLite FTS5"** because it provides fast full-text search with BM25 relevance ranking, uses Bun's built-in `bun:sqlite` (no extra dependencies), and excels at the precise search queries needed for causal tracing. Watch-based incremental indexing keeps the index current as new sessions occur.

### Consequences

**Good:**
- BM25 ranking surfaces most relevant results for causal queries
- Bun's `bun:sqlite` includes FTS5 support (since v0.6.12)—no extra dependencies
- Search performance: 1s → 20ms after indexing
- Porter stemmer enables "error/errors/erroring" to match
- Phrase and proximity search for precise pattern matching
- Single database file in `.agentlint/sessions.db`

**Bad:**
- Requires initial indexing step (scan command)
- Index file adds storage (~10-20% of original log size)
- Schema changes require migration logic

**Neutral:**
- DuckDB can be added later for analytics if needed—JSONL files remain unchanged
- File watcher adds complexity but enables real-time updates

## Pros and Cons of Options

### Option 1: SQLite FTS5

Build a full-text search index using SQLite's FTS5 extension, leveraging Bun's built-in `bun:sqlite` module.

- Good: BM25 relevance ranking built-in—essential for causal tracing
- Good: No external dependencies—uses Bun's native SQLite
- Good: FTS5 reduces search time from ~1s to ~20ms
- Good: Supports phrase search ("permission denied"), prefix (error*), proximity (NEAR)
- Good: Porter stemmer handles word variations
- Good: Proven technology—FTS5 stable since 2015
- Good: Single file storage (`.agentlint/sessions.db`)
- Neutral: Requires indexing step before first search
- Bad: Index adds storage (~10-20% of log size)
- Bad: Schema evolution needs migration handling

### Option 2: DuckDB Direct Query

Query raw JSONL files directly using DuckDB's SQL engine without preprocessing.

- Good: No indexing step—query immediately
- Good: Excellent at aggregations (token usage trends, tool frequency)
- Good: Columnar engine optimized for analytical scans
- Good: Can query across multiple files with glob patterns
- Good: No migration needed if log format changes
- Neutral: Adds ~30MB dependency (duckdb package)
- Bad: No true full-text search with relevance ranking
- Bad: Every search is O(n)—no persistent index
- Bad: LIKE queries instead of BM25 ranking

### Option 3: Hybrid (DuckDB + SQLite FTS5)

Use DuckDB for exploration and analytics, SQLite FTS5 for search.

- Good: Best of both—analytics + ranked search
- Good: DuckDB handles ad-hoc exploration of new formats
- Good: FTS5 handles precise causal queries
- Neutral: More capability but more complexity
- Bad: Two systems to maintain and keep in sync
- Bad: Two dependencies
- Bad: Unclear which tool to use for which query

### Option 4: In-Memory Indexing

Parse and index logs in memory at startup.

- Good: Simplest implementation
- Good: No persistent storage beyond logs themselves
- Good: Fast for small datasets (<50 MB)
- Neutral: Must rebuild index on every startup
- Bad: Memory usage scales with log size
- Bad: Startup time degrades with large histories
- Bad: 379 MB of logs would require significant RAM
- Bad: No ranking—just filtering

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | SQLite database stored locally in `.agentlint/` |
| II. Improvement-Oriented | Yes | Enables historical analysis across sessions |
| III. Causal-First | Yes | BM25 ranking + line positions enable precise origin tracing |
| IV. Mixed-Methods | Yes | Supports both quantitative (counts, metrics) and qualitative (content) queries |
| V. Language-Agnostic | Yes | Log format independent of analyzed project language |
| VI. Agent-Agnostic | Yes | Architecture supports other agents via adapter (DD-006) |
| VII. Intelligent Tooling | Yes | Agent can search freely; FTS5 handles relevance |
| VIII. Compounding Value | Yes | Historical index enables trend analysis over time |
| IX. Agent-Aware | Yes | Relevance ranking helps agent find most useful results |

## More Information

### Related Documents
- Architecture Vision: [Section 4 - High-Level Architecture](../../vision/agentlint-architecture-vision.md#4-high-level-architecture)
- Design Decisions: [DD-005](../design-decisions.md#dd-005-session-log-processing-architecture)
- Prior Decisions: [ADR-0001 - Runtime Platform](./0001-runtime-platform-and-language.md), [ADR-0005 - Tool Definition](./0005-tool-definition-and-invocation-pattern.md)

### Research Sources
- [Don't let Claude Code delete your session logs - Simon Willison](https://simonwillison.net/2025/Oct/22/claude-code-logs/)
- [Analyzing Claude Code Interaction Logs with DuckDB](https://liambx.com/blog/claude-code-log-analysis-with-duckdb)
- [SQLite FTS5 Extension](https://sqlite.org/fts5.html)
- [SQLite Full-text Search Tutorial](https://www.sqlitetutorial.net/sqlite-full-text-search/)
- [Bun v0.6.12 - FTS5 Support](https://bun.sh/blog/bun-v0.6.12)
- [DuckDB vs SQLite Benchmark](https://www.lukas-barth.net/blog/sqlite-duckdb-benchmark/)
- [DuckDB vs SQLite Comparison](https://motherduck.com/learn-more/duckdb-vs-sqlite-databases/)

### Implementation Notes

#### 1. Database Schema

```sql
-- Main session entries table (FTS5 virtual table)
CREATE VIRTUAL TABLE session_entries USING fts5(
  session_id,        -- UUID of the session
  project_path,      -- Decoded project path (for filtering)
  timestamp,         -- ISO-8601 timestamp
  role,              -- 'user' | 'assistant'
  content,           -- Text content (flattened from message.content)
  tool_name,         -- Tool name if tool_use/tool_result
  tool_input,        -- Serialized tool input JSON
  tool_result,       -- Serialized tool result
  file_path,         -- Source JSONL file path
  line_number,       -- Line number in source file (for causal tracing)
  tokenize = 'porter unicode61'  -- Porter stemmer + Unicode support
);

-- Metadata table for tracking indexed files
CREATE TABLE indexed_files (
  file_path TEXT PRIMARY KEY,
  project_path TEXT NOT NULL,  -- Decoded project path
  last_modified INTEGER,       -- mtime for incremental updates
  entry_count INTEGER,
  indexed_at TEXT
);

-- Session summary table for quick lookups
CREATE TABLE sessions (
  session_id TEXT PRIMARY KEY,
  project_path TEXT,        -- Decoded project path
  first_timestamp TEXT,
  last_timestamp TEXT,
  entry_count INTEGER,
  input_tokens INTEGER,     -- Total input tokens
  output_tokens INTEGER,    -- Total output tokens
  cache_tokens INTEGER,     -- Cache read + creation tokens
  compression_count INTEGER,-- Context compression events
  model TEXT,               -- Claude model used (e.g., "claude-opus-4-5-20251101")
  cli_version TEXT          -- Claude Code CLI version (e.g., "1.0.62")
);

-- Tool usage tracking per session
CREATE TABLE session_tools (
  session_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  category TEXT NOT NULL,   -- 'read' | 'write' | 'bash' | 'search' | 'other'
  call_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  PRIMARY KEY (session_id, tool_name),
  FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

-- Schema version tracking for migrations
CREATE TABLE schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

-- Indexes for common query patterns
CREATE INDEX idx_sessions_project ON sessions(project_path);
CREATE INDEX idx_sessions_timestamp ON sessions(first_timestamp);
CREATE INDEX idx_indexed_files_project ON indexed_files(project_path);
```

#### 1.1 Input Validation Constants

Tool inputs are validated with Zod schemas to prevent abuse and ensure reasonable limits:

| Constant | Value | Purpose |
|----------|-------|---------|
| `MAX_QUERY_LENGTH` | 1000 | Maximum FTS5 query string length |
| `MAX_TIMESTAMP_LENGTH` | 30 | Maximum ISO-8601 timestamp length |
| `MAX_PROJECT_PATH_LENGTH` | 500 | Maximum project path filter length |
| `MAX_SESSION_ID_LENGTH` | 50 | Maximum session UUID length |
| `MAX_MODEL_LENGTH` | 100 | Maximum model name filter length |

Timestamps are validated as ISO-8601 format with helpful error messages suggesting correct format.

#### 2. Indexing Process

```typescript
import { Database } from "bun:sqlite";
import { watch } from "fs";

const CLAUDE_LOGS_DIR = path.join(os.homedir(), ".claude", "projects");

async function indexSessionLogs(db: Database, projectPath?: string) {
  const logFiles = await glob(`${CLAUDE_LOGS_DIR}/**/*.jsonl`);

  for (const filePath of logFiles) {
    const stats = await fs.stat(filePath);
    const existing = db.query(
      "SELECT last_modified FROM indexed_files WHERE file_path = ?"
    ).get(filePath);

    // Skip if already indexed and unchanged
    if (existing && existing.last_modified >= stats.mtimeMs) continue;

    // Index new/modified file
    await indexFile(db, filePath);
  }
}

async function indexFile(db: Database, filePath: string) {
  const content = await Bun.file(filePath).text();
  const lines = content.split("\n").filter(Boolean);

  db.transaction(() => {
    // Clear existing entries for this file
    db.run("DELETE FROM session_entries WHERE file_path = ?", [filePath]);

    for (let i = 0; i < lines.length; i++) {
      const entry = JSON.parse(lines[i]);
      const lineNumber = i + 1;

      // Flatten message content for searchability
      const textContent = extractTextContent(entry.message);
      const toolInfo = extractToolInfo(entry.message);

      db.run(`
        INSERT INTO session_entries
        (session_id, timestamp, role, content, tool_name, tool_input, tool_result, file_path, line_number)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        entry.sessionId,
        entry.timestamp,
        entry.message?.role,
        textContent,
        toolInfo?.name,
        toolInfo?.input ? JSON.stringify(toolInfo.input) : null,
        entry.toolUseResult ? JSON.stringify(entry.toolUseResult) : null,
        filePath,
        lineNumber
      ]);
    }

    // Update indexed_files metadata
    db.run(`
      INSERT OR REPLACE INTO indexed_files (file_path, last_modified, entry_count, indexed_at)
      VALUES (?, ?, ?, ?)
    `, [filePath, Date.now(), lines.length, new Date().toISOString()]);
  })();
}
```

#### 3. Search Queries

```typescript
// Basic full-text search with BM25 ranking
function searchSessions(db: Database, query: string, options: SearchOptions = {}) {
  const { sessionId, limit = 50, offset = 0 } = options;

  let sql = `
    SELECT
      session_id,
      timestamp,
      role,
      snippet(session_entries, 3, '<mark>', '</mark>', '...', 32) as content_snippet,
      tool_name,
      file_path,
      line_number,
      bm25(session_entries) as relevance
    FROM session_entries
    WHERE session_entries MATCH ?
  `;

  const params: unknown[] = [query];

  if (sessionId) {
    sql += ` AND session_id = ?`;
    params.push(sessionId);
  }

  sql += ` ORDER BY relevance LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  return db.query(sql).all(...params);
}

// Search for tool usage
function searchToolUsage(db: Database, toolName: string) {
  return db.query(`
    SELECT * FROM session_entries
    WHERE tool_name = ?
    ORDER BY timestamp DESC
  `).all(toolName);
}

// Find errors across sessions
function findErrors(db: Database) {
  return db.query(`
    SELECT
      session_id,
      timestamp,
      snippet(session_entries, 3, '', '', '...', 64) as context,
      file_path,
      line_number
    FROM session_entries
    WHERE session_entries MATCH 'error OR exception OR failed OR "permission denied"'
    ORDER BY bm25(session_entries)
    LIMIT 100
  `).all();
}
```

#### 4. File Watcher for Incremental Updates

```typescript
import { watch } from "fs";

function watchForNewSessions(db: Database) {
  const watcher = watch(CLAUDE_LOGS_DIR, { recursive: true }, async (event, filename) => {
    if (!filename?.endsWith(".jsonl")) return;

    const filePath = path.join(CLAUDE_LOGS_DIR, filename);

    if (event === "rename") {
      // File created or deleted
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      if (exists) {
        await indexFile(db, filePath);
      } else {
        // File deleted - remove from index
        db.run("DELETE FROM session_entries WHERE file_path = ?", [filePath]);
        db.run("DELETE FROM indexed_files WHERE file_path = ?", [filePath]);
      }
    } else if (event === "change") {
      // File modified - re-index
      await indexFile(db, filePath);
    }
  });

  return watcher;
}
```

#### 5. Query Syntax Examples

FTS5 supports rich query syntax:

| Query | Meaning |
|-------|---------|
| `error` | Entries containing "error" (or stemmed variants) |
| `"permission denied"` | Exact phrase match |
| `error*` | Prefix match (error, errors, erroring) |
| `tool_name:Bash` | Field-specific search |
| `error NEAR/5 api` | "error" within 5 words of "api" |
| `error OR exception` | Boolean OR |
| `error NOT warning` | Exclude results with "warning" |

#### 6. Storage Location

```
.agentlint/
├── sessions.db          # SQLite database with FTS5 index
├── sessions.db-wal      # Write-ahead log (if using WAL mode)
└── sessions.db-shm      # Shared memory file (if using WAL mode)
```

#### 7. Future: Adding DuckDB for Analytics

If analytics features are needed later, DuckDB can query the raw JSONL files without affecting the FTS5 architecture:

```typescript
// Future analytics with DuckDB (doesn't require migration)
import { Database as DuckDB } from "duckdb";

async function getTokenUsageTrends(duckdb: DuckDB) {
  return duckdb.all(`
    SELECT
      date_trunc('day', timestamp::timestamp) as day,
      SUM(json_extract_path_text(message, 'usage', 'input_tokens')::int) as input_tokens,
      SUM(json_extract_path_text(message, 'usage', 'output_tokens')::int) as output_tokens
    FROM read_json_auto('~/.claude/projects/**/*.jsonl')
    GROUP BY day
    ORDER BY day
  `);
}
```

This preserves the option without committing to it now.
