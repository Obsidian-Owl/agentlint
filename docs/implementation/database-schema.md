# Database Schema Extensions

Implementation details for SQLite schema extensions. See [ADR-0003](../architecture/adr/0003-local-storage-strategy.md) for core schema and [ADR-0012](../architecture/adr/0012-incremental-analysis-strategy.md) for decision rationale.

## Recommendation Lifecycle Schema

Extends the base `recommendations` table from ADR-0003:

```sql
-- Recommendation lifecycle tracking
ALTER TABLE recommendations ADD COLUMN status TEXT DEFAULT 'proposed';
ALTER TABLE recommendations ADD COLUMN proposed_at TEXT;
ALTER TABLE recommendations ADD COLUMN adopted_at TEXT;
ALTER TABLE recommendations ADD COLUMN adoption_evidence TEXT;
ALTER TABLE recommendations ADD COLUMN user_confirmed INTEGER DEFAULT 0;
ALTER TABLE recommendations ADD COLUMN measured_at TEXT;
ALTER TABLE recommendations ADD COLUMN metrics_before JSON;
ALTER TABLE recommendations ADD COLUMN metrics_after JSON;
ALTER TABLE recommendations ADD COLUMN effectiveness_delta REAL;
ALTER TABLE recommendations ADD COLUMN closed_at TEXT;
ALTER TABLE recommendations ADD COLUMN outcome TEXT;

-- Analysis runs tracking
CREATE TABLE analysis_runs (
  id INTEGER PRIMARY KEY,
  run_at TEXT NOT NULL,
  baseline_id INTEGER REFERENCES baselines(id),
  trigger_type TEXT NOT NULL,  -- 'manual', 'git_hook', 'session', 'staleness'
  change_manifest JSON,
  duration_ms INTEGER,
  issues_found INTEGER,
  recommendations_generated INTEGER
);

-- Staleness tracking
CREATE TABLE staleness_state (
  id INTEGER PRIMARY KEY,
  last_analysis_at TEXT,
  last_baseline_commit TEXT,
  sessions_since_baseline INTEGER DEFAULT 0,
  last_staleness_check TEXT,
  last_staleness_suggestion TEXT
);
```

## Indexes

```sql
-- Recommendation lifecycle queries
CREATE INDEX idx_recommendations_status ON recommendations(status);
CREATE INDEX idx_recommendations_proposed_at ON recommendations(proposed_at);

-- Analysis run queries
CREATE INDEX idx_analysis_runs_trigger ON analysis_runs(trigger_type);
CREATE INDEX idx_analysis_runs_baseline ON analysis_runs(baseline_id);
```

## Migration Notes

These schema extensions should be applied via the migration system defined in ADR-0017. The `analysis_runs` and `staleness_state` tables are new and can be created directly. The `recommendations` table alterations assume the base table exists from ADR-0003.
