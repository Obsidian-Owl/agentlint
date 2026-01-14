---
status: accepted
date: 2026-01-14
decision-makers: [Project Lead]
consulted: []
informed: []
---

# ADR-0008: Baseline Storage Format and Strategy

## Context and Problem Statement

Baselines are central to agentlint's continuous improvement model (Constitution Principle II). Each baseline captures a snapshot of configuration quality, metrics, and recommendations at a point in time. We need a storage format that supports:

- Efficient comparison between baselines (delta calculation)
- Trend analysis across many baselines over time
- Human debugging and inspection
- User-configurable frequency (per-analysis, explicit snapshots, or milestones)

## Decision Drivers

- **Human Debuggability**: Developers should be able to inspect baselines without tooling
- **Comparison Efficiency**: Fast delta calculation for before/after analysis
- **Trend Queries**: Efficient queries across baselines over time
- **Schema Evolution**: Baseline format will evolve; migrations should be simple
- **Local-First**: All storage on user's machine (Constitution Principle I)
- **Consistency with Prior Decisions**: ADR-0006 established SQLite for session indexing

## Considered Options

1. JSON files + SQLite metadata index
2. SQLite with JSON columns
3. Pure SQLite (normalized relational schema)
4. Git-like content-addressed storage

## Decision Outcome

**Chosen option: "JSON files + SQLite metadata index"** because it provides the best balance of human debuggability, comparison efficiency, and consistency with the session indexing pattern (ADR-0006). Each baseline is stored as a human-readable JSON file, with SQLite providing fast metadata queries and trend analysis.

### Consequences

**Good:**
- Baselines are plain JSON files—open and inspect in any text editor
- jsondiffpatch provides efficient, well-tested delta calculation on JSON
- SQLite metadata index enables fast trend queries without reading all files
- Schema evolution is simple—just version the JSON format
- Consistent pattern with session indexing (ADR-0006)
- Git-friendly: JSON files can be committed if users want version control

**Bad:**
- Two storage mechanisms to maintain (JSON files + SQLite index)
- Must keep index in sync with files (handled by baseline tools)
- Slightly more storage than pure SQLite (metadata duplicated)

**Neutral:**
- Baselines are project-local; no export/import commands needed for MVP
- jsondiffpatch dependency adds ~50KB to bundle

## Pros and Cons of Options

### Option 1: JSON files + SQLite metadata index

Store each baseline as a separate `.json` file in `.agentlint/baselines/`. SQLite database (`.agentlint/baselines.db`) indexes metadata for queries.

- Good: Human-readable—inspect baselines in any editor
- Good: jsondiffpatch works directly on JSON for delta calculation
- Good: SQLite handles trend queries efficiently
- Good: Schema changes don't require database migrations
- Good: Follows same pattern as ADR-0006 (session logs)
- Good: Files can be committed to git if desired
- Neutral: Two systems to keep in sync
- Bad: Slight storage overhead (metadata in both places)

### Option 2: SQLite with JSON columns

Store baselines as JSON blobs in SQLite, using virtual columns + indexes for queryable fields.

- Good: Single storage system
- Good: SQLite's JSON functions (since 3.38.0) enable querying JSON fields
- Good: Virtual columns provide indexed access to JSON properties
- Good: Atomic transactions for all operations
- Neutral: Can export to JSON for debugging
- Bad: Not directly human-readable—requires tooling or export
- Bad: JSON virtual columns less intuitive than plain files

### Option 3: Pure SQLite (normalized)

Fully relational schema with separate tables for baselines, metrics, signals, warnings, etc.

- Good: Best query performance—full SQL power
- Good: Strong data integrity via foreign keys
- Good: Most efficient storage
- Neutral: Standard database patterns
- Bad: Binary format—cannot inspect without tooling
- Bad: Schema changes require migrations
- Bad: Complex joins for reconstructing baseline view

### Option 4: Git-like content-addressed storage

SHA-keyed blob storage with tree structures, similar to Git's object model.

- Good: Natural deduplication of unchanged content
- Good: Built-in diffing via tree comparison
- Good: Version history is first-class concept
- Neutral: Can dump to JSON for inspection
- Bad: Higher implementation complexity
- Bad: Less intuitive for simple queries
- Bad: Overkill for baseline counts we expect

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | All storage in `.agentlint/` directory |
| II. Improvement-Oriented | Yes | Baselines enable before/after comparison |
| III. Causal-First | Yes | Baseline snapshots capture state for causal analysis |
| IV. Mixed-Methods | Yes | Stores both quantitative metrics and qualitative signals |
| V. Language-Agnostic | Yes | JSON format independent of project language |
| VI. Agent-Agnostic | Yes | Baseline schema supports any ACT adapter |
| VII. Intelligent Tooling | Yes | Agent can query baselines via search tool |
| VIII. Compounding Value | Yes | Historical baselines enable trend analysis |
| IX. Agent-Aware | Yes | JSON structure optimized for agent consumption |

## More Information

### Related Documents

- Design Decisions: [DD-007](../design-decisions.md#dd-007-baseline-storage-format-and-strategy)
- Prior Decisions: [ADR-0006 - Session Log Processing](./0006-session-log-processing-architecture.md), [ADR-0007 - Config Parser](./0007-configuration-parser-design.md)

### Research Sources

- [When JSON Sucks - SQLite Enlightenment](https://pl-rants.net/posts/when-not-json/)
- [SQLite JSON Virtual Columns + Indexing](https://www.dbpro.app/blog/sqlite-json-virtual-columns-indexing)
- [jsondiffpatch - Diff & patch JavaScript objects](https://github.com/benjamine/jsondiffpatch)
- [JSON-delta documentation](https://json-delta.readthedocs.io/)
- [SQLite Temporal Tables](https://www.sqliteforum.com/p/sqlite-and-temporal-tables)
- [Google Cloud - Schema design for time series](https://cloud.google.com/bigtable/docs/schema-design-time-series)

### Implementation Notes

#### 1. Storage Layout

```
.agentlint/
├── baselines/
│   ├── 2026-01-14T10-30-00-abc123.json   # Individual baseline files
│   ├── 2026-01-15T14-20-00-def456.json
│   └── latest.json → 2026-01-15T14-20-00-def456.json  # Symlink to latest
├── baselines.db                           # SQLite metadata index
└── sessions.db                            # Session log index (ADR-0006)
```

#### 2. Baseline JSON Schema

```typescript
interface Baseline {
  // Identity
  id: string;                    // UUID
  version: string;               // Schema version (e.g., "1.0.0")
  createdAt: string;             // ISO-8601 timestamp

  // Context
  projectPath: string;           // Absolute path to project root
  actType: ACTType;              // 'claude-code' | 'cursor' | etc.
  configPath: string;            // Path to analyzed config file
  gitCommit?: string;            // Git HEAD at baseline time (if available)

  // Analysis snapshot
  configAnalysis: NormalizedConfig;  // From config parser (ADR-0007)

  // Aggregated metrics
  metrics: {
    configTokens: number;
    configLines: number;
    warningCount: number;
    sectionCount: number;
    coverageScore: number;       // 0-100 based on essential sections
  };

  // Recommendations at this point
  recommendations: Recommendation[];

  // Session analysis (if sessions were analyzed)
  sessionSummary?: {
    sessionCount: number;
    errorCount: number;
    toolUsageDistribution: Record<string, number>;
    dateRange: { start: string; end: string };
  };

  // User annotations
  label?: string;                // User-provided label
  notes?: string;                // User-provided notes
}
```

#### 3. SQLite Metadata Index Schema

```sql
-- Baseline metadata for fast queries
CREATE TABLE baselines (
  id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  project_path TEXT NOT NULL,
  act_type TEXT NOT NULL,
  config_path TEXT NOT NULL,
  git_commit TEXT,

  -- Indexed metrics for trend queries
  config_tokens INTEGER,
  config_lines INTEGER,
  warning_count INTEGER,
  section_count INTEGER,
  coverage_score REAL,

  -- User annotations
  label TEXT,
  notes TEXT
);

-- Index for temporal queries
CREATE INDEX idx_baselines_created_at ON baselines(created_at);
CREATE INDEX idx_baselines_project ON baselines(project_path);

-- Track baseline comparisons
CREATE TABLE comparisons (
  id TEXT PRIMARY KEY,
  baseline_a_id TEXT NOT NULL REFERENCES baselines(id),
  baseline_b_id TEXT NOT NULL REFERENCES baselines(id),
  created_at TEXT NOT NULL,
  delta_json TEXT NOT NULL       -- jsondiffpatch output stored for caching
);
```

#### 4. Delta Calculation

```typescript
import { diff, patch } from 'jsondiffpatch';

// Configure jsondiffpatch for baseline comparison
const baselineDiffer = create({
  objectHash: (obj: unknown) => {
    // Hash recommendations by their ID for array matching
    if (typeof obj === 'object' && obj !== null && 'id' in obj) {
      return (obj as { id: string }).id;
    }
    return JSON.stringify(obj);
  },
  arrays: {
    detectMove: true,
    includeValueOnMove: false,
  },
});

function compareBaselines(older: Baseline, newer: Baseline): BaselineDelta {
  const delta = baselineDiffer.diff(older, newer);

  return {
    fromId: older.id,
    toId: newer.id,
    fromDate: older.createdAt,
    toDate: newer.createdAt,
    delta,
    summary: summarizeDelta(delta),
  };
}

interface DeltaSummary {
  metricsChanged: {
    field: string;
    from: number;
    to: number;
    percentChange: number;
  }[];
  warningsAdded: Warning[];
  warningsResolved: Warning[];
  recommendationsAdded: Recommendation[];
  recommendationsResolved: Recommendation[];
}
```

#### 5. Trend Queries

```typescript
// Get metrics trend over time
function getMetricsTrend(db: Database, projectPath: string, days: number = 30) {
  return db.query(`
    SELECT
      date(created_at) as date,
      AVG(config_tokens) as avg_tokens,
      AVG(warning_count) as avg_warnings,
      AVG(coverage_score) as avg_coverage
    FROM baselines
    WHERE project_path = ?
      AND created_at >= datetime('now', '-' || ? || ' days')
    GROUP BY date(created_at)
    ORDER BY date
  `).all(projectPath, days);
}

// Get warning count trend
function getWarningTrend(db: Database, projectPath: string) {
  return db.query(`
    SELECT
      created_at,
      warning_count,
      LAG(warning_count) OVER (ORDER BY created_at) as prev_warning_count
    FROM baselines
    WHERE project_path = ?
    ORDER BY created_at
  `).all(projectPath);
}
```

#### 6. Tool Integration

```typescript
// Baseline tools for agent (from ADR-0005)
export const storeBaselineTool = tool(
  "store_baseline",
  "Save current analysis state as a baseline for future comparison",
  {
    label: z.string().optional().describe("User-friendly label for this baseline"),
    notes: z.string().optional().describe("Optional notes about this baseline"),
  },
  async (args, context) => {
    const baseline = await createBaseline(context.currentAnalysis, args);
    await saveBaseline(baseline);
    return { id: baseline.id, createdAt: baseline.createdAt };
  }
);

export const queryBaselineTool = tool(
  "query_baseline",
  "Retrieve a specific baseline or the most recent baseline",
  {
    id: z.string().optional().describe("Baseline ID (omit for latest)"),
    label: z.string().optional().describe("Find baseline by label"),
  },
  async (args) => {
    const baseline = args.id
      ? await getBaselineById(args.id)
      : args.label
        ? await getBaselineByLabel(args.label)
        : await getLatestBaseline();
    return baseline;
  }
);

export const listBaselinesTool = tool(
  "list_baselines",
  "List available baselines with their metadata",
  {
    limit: z.number().optional().default(10).describe("Maximum baselines to return"),
    since: z.string().optional().describe("Only baselines after this date (ISO-8601)"),
  },
  async (args) => {
    return await listBaselines(args);
  }
);
```

#### 7. Baseline Lifecycle

```
User runs: agentlint analyse

  1. Load previous baseline (if exists)
  2. Run analysis (config parser, session search, etc.)
  3. Compare to previous baseline
  4. Present delta to user
  5. Optionally save new baseline:
     - Auto: if configured for per-analysis frequency
     - Prompt: ask user if they want to save
     - Explicit: user runs `agentlint baseline` separately
```

#### 8. Frequency Modes

```typescript
type BaselineFrequency =
  | 'per-analysis'     // Auto-save after every analysis
  | 'explicit'         // Only when user runs `agentlint baseline`
  | 'on-change';       // Auto-save only if metrics changed significantly

// Configured in .agentlint/config.json or CLI flag
interface AgentlintConfig {
  baselineFrequency: BaselineFrequency;
  baselineChangeThreshold?: number;  // For 'on-change' mode (e.g., 5% change)
}
```
