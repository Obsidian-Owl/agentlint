---
status: accepted
date: 2026-01-12
decision-makers: [CTO, Architecture Lead]
consulted: [Development Team]
informed: [All Contributors]
---

# ADR-0003: Local Storage Strategy

## Context and Problem Statement

agentlint needs persistent local storage for baselines, session metrics, issues, recommendations, and causal links. The storage must support efficient trend comparison, full-text search, and causal linking while following the Local-First and Improvement-Oriented constitutional principles. With Bun selected as the runtime (ADR-0001), its built-in SQLite is a compelling option.

## Decision Drivers

- **Improvement-Oriented**: Must support efficient trend comparison (baseline vs current)
- **Causal-First**: Must enable linking issues to origin sessions and prompts
- **Query patterns**: Trend comparison, full-text search, causal linking
- **Local-First**: All data stays on user's machine
- **Human-readability**: Not important (per scope clarification)
- **Bun built-in**: SQLite is available with no external dependency
- **Performance**: Session logs can be 100MB+; need efficient summarization and querying

## Considered Options

1. SQLite Only (using Bun's built-in `bun:sqlite`)
2. Hybrid (SQLite + JSON exports)
3. Flat Files Only (JSON/YAML)

## Decision Outcome

Chosen option: **"SQLite Only"** because Bun's built-in SQLite provides the most efficient path for trend comparison, causal linking, and full-text search with zero external dependencies. The 3-6x performance advantage over alternatives, combined with FTS5 full-text search and WAL mode for concurrency, makes it ideal for agentlint's query patterns.

### Consequences

**Good:**
- Single file database, easy backup and portability
- Zero external dependencies (Bun built-in)
- 3-6x faster than better-sqlite3
- FTS5 enables sub-millisecond full-text search
- SQL provides powerful trend comparison and causal joins
- WAL mode enables concurrent reads
- File format stable until 2050+

**Bad:**
- Not human-readable (mitigated: CLI provides all views)
- Schema migrations needed for upgrades
- Learning curve for SQL-based data model

**Neutral:**
- Requires defining schema upfront
- Need migration strategy for schema evolution

## Pros and Cons of Options

### Option 1: SQLite Only

Single SQLite database using Bun's built-in `bun:sqlite` module with FTS5 for full-text search.

- Good: Zero external dependencies (Bun built-in)
- Good: 3-6x faster than better-sqlite3
- Good: FTS5 for full-text search with sub-ms queries
- Good: Single file, easy backup
- Good: Powerful SQL for trend queries and causal joins
- Good: WAL mode for concurrent access
- Good: File format guaranteed stable until 2050+
- Neutral: Schema migrations needed for upgrades
- Bad: Not human-readable

### Option 2: Hybrid (SQLite + JSON)

SQLite for structured queries, with on-demand JSON exports for portability.

- Good: Best of both: fast queries + human-readable exports
- Good: Export capability for sharing/backup
- Neutral: Two data formats to maintain
- Bad: Sync complexity between formats
- Bad: More code to maintain
- Bad: Potential for data divergence

### Option 3: Flat Files Only

All data stored as JSON files in structured directories.

- Good: Human-readable
- Good: No schema migrations
- Good: Simple initial implementation
- Bad: Poor query performance at scale (O(n) scans)
- Bad: No built-in full-text search
- Bad: Difficult causal linking across files
- Bad: Violates Improvement-Oriented (trend comparison expensive)

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | All data in local SQLite file |
| II. Improvement-Oriented | Yes | SQL enables efficient trend comparison |
| III. Causal-First | Yes | Foreign keys and joins enable causal linking |
| IV. Mixed-Methods | Yes | Can store both quantitative metrics and qualitative text |
| V. Language-Agnostic | N/A | Storage doesn't affect language support |
| VI. Tool-Agnostic | Yes | Schema supports multiple AI tool adapters |
| VII. Static-First | Yes | No LLM needed for queries |
| VIII. Progressive Value | Yes | Works without LLM configuration |
| IX. Agent-Aware | N/A | Storage doesn't affect agent architecture |

## More Information

### Related Documents
- [ADR-0001: Language and Runtime Selection](./0001-language-and-runtime-selection.md) - Establishes Bun with built-in SQLite
- Design Questions: [Section 1.3 - Local Storage Strategy](../../design-questions.md#13-local-storage-strategy)
- Design Questions: [Section 1.4 - Configuration File Locations](../../design-questions.md#14-configuration-file-locations)

### Research Sources
- [Bun SQLite Documentation](https://bun.com/docs/runtime/sqlite) - Built-in SQLite performance
- [SQLite FTS5 Extension](https://sqlite.org/fts5.html) - Full-text search capabilities
- [Analyzing Claude Code Logs with DuckDB](https://liambx.com/blog/claude-code-log-analysis-with-duckdb) - Session log structure
- [SQLite Best Practices](https://medium.com/@firmanbrilian/best-practices-for-managing-schema-indexes-and-storage-in-sqlite-for-data-engineering-c74f71056518) - Schema design
- [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html) - Storage locations
- [Developer Productivity Metrics](https://getdx.com/blog/developer-productivity/) - Baseline comparison patterns

### Storage Locations (XDG-compliant)

```
~/.local/share/agentlint/     # $XDG_DATA_HOME/agentlint
├── agentlint.db              # Main SQLite database
└── agentlint.db-wal          # WAL file (if WAL mode enabled)

~/.config/agentlint/          # $XDG_CONFIG_HOME/agentlint
└── config.toml               # User configuration

~/.cache/agentlint/           # $XDG_CACHE_HOME/agentlint
└── session-index/            # Cached session log indices
```

### Proposed Schema

```sql
-- Enable WAL mode for better concurrency
PRAGMA journal_mode = WAL;

-- Baselines: Point-in-time snapshots
CREATE TABLE baselines (
  id INTEGER PRIMARY KEY,
  project_path TEXT NOT NULL,
  created_at TEXT NOT NULL,  -- ISO 8601
  config_hash TEXT,          -- SHA256 of CLAUDE.md at snapshot
  config_content TEXT,       -- Full config content for causal analysis
  metrics JSON NOT NULL      -- Flexible for evolving metrics
);

CREATE INDEX idx_baselines_project ON baselines(project_path);
CREATE INDEX idx_baselines_created ON baselines(created_at);

-- Session analyses (metrics extracted from logs, not full logs)
CREATE TABLE session_analyses (
  id INTEGER PRIMARY KEY,
  baseline_id INTEGER REFERENCES baselines(id),
  session_id TEXT NOT NULL,  -- Claude Code session ID
  analyzed_at TEXT NOT NULL,
  token_input INTEGER,
  token_output INTEGER,
  turn_count INTEGER,
  tool_usage JSON,           -- {"Bash": 5, "Read": 12, ...}
  effectiveness_score REAL,
  git_branch TEXT,
  duration_seconds INTEGER
);

CREATE INDEX idx_sessions_baseline ON session_analyses(baseline_id);
CREATE INDEX idx_sessions_date ON session_analyses(analyzed_at);

-- Issues with causal links
CREATE TABLE issues (
  id INTEGER PRIMARY KEY,
  session_analysis_id INTEGER REFERENCES session_analyses(id),
  issue_type TEXT NOT NULL,  -- e.g., "config_gap", "pattern_violation"
  description TEXT NOT NULL,
  origin_session_id TEXT,    -- Link to origin session
  origin_prompt_excerpt TEXT, -- Relevant prompt text
  severity TEXT CHECK(severity IN ('info', 'warning', 'error'))
);

CREATE INDEX idx_issues_type ON issues(issue_type);
CREATE INDEX idx_issues_session ON issues(session_analysis_id);

-- Recommendations with adoption tracking
CREATE TABLE recommendations (
  id INTEGER PRIMARY KEY,
  issue_id INTEGER REFERENCES issues(id),
  recommendation TEXT NOT NULL,
  category TEXT,             -- e.g., "context", "instructions", "structure"
  adopted INTEGER DEFAULT 0,
  adopted_at TEXT,
  effectiveness_delta REAL   -- Change in score after adoption
);

CREATE INDEX idx_recommendations_issue ON recommendations(issue_id);
CREATE INDEX idx_recommendations_adopted ON recommendations(adopted);

-- FTS5 virtual table for full-text search
CREATE VIRTUAL TABLE search_index USING fts5(
  content,                   -- Searchable text
  source_type,              -- 'issue', 'recommendation', 'config'
  source_id,                -- ID in source table
  tokenize='porter unicode61'
);
```

### Implementation Notes

1. **WAL Mode**: Enable at database creation for concurrent reads
2. **FTS5 Triggers**: Set up triggers to keep search_index synced with source tables
3. **Migrations**: Use simple version table + migration scripts
4. **Backup**: Single file copy is sufficient (pause WAL checkpoint first)
5. **Performance**:
   - Use prepared statements for repeated queries
   - Enable `synchronous=NORMAL` for better write performance
   - Vacuum periodically for large databases
