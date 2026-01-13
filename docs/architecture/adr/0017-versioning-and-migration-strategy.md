---
status: accepted
date: 2026-01-13
decision-makers: [CTO, Architecture Lead]
consulted: [Development Team]
informed: [All Contributors]
---

# ADR-0017: Versioning and Migration Strategy

## Context and Problem Statement

agentlint stores historical data (baselines, session analyses, issues, recommendations) in SQLite. As the tool evolves, the database schema, configuration format, and baseline structure will change. This ADR defines how agentlint handles versioning across all data layers and how migrations are executed safely with automatic backup and rollback capability.

ADR-0003 mentions "simple version table + migration scripts" but doesn't elaborate. This ADR formalizes the complete versioning and migration strategy for schema, configuration, and baselines.

## Decision Drivers

- **Improvement-Oriented**: Historical data is core to value proposition; loss is catastrophic
- **Compounding Value**: Migrations should be seamless; users shouldn't need to run manual commands
- **Local-First**: All migration operations run locally with no external dependencies
- **Deterministic migrations**: No LLM needed for migrations; predictable process
- **User Experience**: "Automatic + Safe" - backup, migrate, rollback on failure

## Considered Options

### Schema Migration
1. user_version + DIY (sequential SQL scripts with PRAGMA user_version)
2. Drizzle ORM + Drizzle Kit (type-safe migrations with auto-generation)
3. Declarative Schema Diff (compare desired vs actual on startup)

### Backup Strategy
1. File Copy (simple copy before migration)
2. SQLite Backup API (online backup)
3. Export to JSON (human-readable export)

### Config Versioning
1. Embedded Version Field (version in config.toml header)
2. Separate Version File (.agentlint/version)
3. No Config Versioning (assume backward compatibility)

### Baseline Versioning
1. Timestamp + Git Hash (ISO timestamp with metadata)
2. Auto-increment ID (simple integer)
3. User-provided Names (semantic naming)

## Decision Outcome

### Schema Migration: user_version + DIY

Chosen because:
- Zero external dependencies (uses Bun's built-in SQLite)
- Battle-tested pattern used by many CLI tools
- Full control over migration logic
- Deterministic (no ORM magic)

### Backup Strategy: File Copy

Chosen because:
- Fast and reliable for SQLite files
- Easy to restore (copy back)
- Simple implementation
- Works with WAL mode (checkpoint before copy)

### Config Versioning: Embedded Version Field

Chosen because:
- Self-describing config files
- Auto-upgrade on load
- Can warn on downgrade attempts
- Single source of truth

### Baseline Versioning: Timestamp + Git Hash

Chosen because:
- Human-readable and sortable
- Git integration provides context
- Metadata enables reproducibility verification
- Aligns with ADR-0015 (Reproducibility)

### Consequences

**Good:**
- Zero migration dependencies; uses only Bun built-in SQLite
- Automatic migration with pre-flight backup prevents data loss
- Seamless UX: users don't need to run manual migrate commands
- Version-skipping supported: can migrate from v1 → v5 without intermediate steps
- Config and schema versions tracked independently for flexibility
- Baseline metadata enables accurate historical comparison

**Bad:**
- DIY migration requires writing SQL manually (no auto-generation)
- File copy backup doubles disk usage temporarily during migration
- Must maintain compatibility window (how many old versions to support)

**Neutral:**
- Migration scripts stored in codebase alongside schema definition
- Backup files auto-pruned after successful migration
- Config downgrade requires manual intervention (safety feature)

## Detailed Design

### 1. Schema Versioning with PRAGMA user_version

SQLite provides `user_version` pragma for schema versioning:

```sql
-- Check current version
PRAGMA user_version;  -- Returns 0 for new database

-- Set version after migration
PRAGMA user_version = 3;
```

**Migration Directory Structure**:
```
src/db/
├── schema.sql              # Current schema (reference)
├── migrations/
│   ├── 0001_initial.sql    # Create initial tables
│   ├── 0002_add_fts5.sql   # Add FTS5 virtual table
│   ├── 0003_add_checkpoints.sql  # ADR-0016 checkpoint tables
│   └── ...
└── migrate.ts              # Migration runner
```

**Migration File Format**:
```sql
-- Migration 0002: Add FTS5 full-text search
-- Requires: user_version >= 1

BEGIN TRANSACTION;

CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
  content,
  source_type,
  source_id,
  tokenize='porter unicode61'
);

-- Update triggers for FTS sync
CREATE TRIGGER IF NOT EXISTS issues_ai AFTER INSERT ON issues BEGIN
  INSERT INTO search_index(content, source_type, source_id)
  VALUES (NEW.description, 'issue', NEW.id);
END;

PRAGMA user_version = 2;

COMMIT;
```

**Migration Runner**:

```typescript
interface Migration {
  version: number;
  name: string;
  sql: string;
}

async function runMigrations(db: Database): Promise<MigrationResult> {
  const currentVersion = db.query('PRAGMA user_version').get() as { user_version: number };

  // Load migrations from files
  const migrations = await loadMigrations('./src/db/migrations');

  // Filter to pending migrations
  const pending = migrations.filter(m => m.version > currentVersion.user_version);

  if (pending.length === 0) {
    return { status: 'up-to-date', version: currentVersion.user_version };
  }

  // Backup before migration
  const backupPath = await createBackup(db);

  try {
    for (const migration of pending.sort((a, b) => a.version - b.version)) {
      console.log(`Applying migration ${migration.version}: ${migration.name}`);
      db.run(migration.sql);
    }

    // Verify final version
    const newVersion = db.query('PRAGMA user_version').get() as { user_version: number };

    // Cleanup backup on success
    await pruneOldBackups();

    return {
      status: 'migrated',
      fromVersion: currentVersion.user_version,
      toVersion: newVersion.user_version,
      migrationsApplied: pending.length,
    };
  } catch (error) {
    // Restore from backup on failure
    console.error('Migration failed, restoring from backup...');
    await restoreFromBackup(db, backupPath);
    throw new MigrationError(error.message, backupPath);
  }
}
```

### 2. Backup Strategy

**Pre-Migration Backup**:

```typescript
async function createBackup(db: Database): Promise<string> {
  const dbPath = db.filename;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(XDG_CACHE_HOME, 'agentlint', 'backups');
  const backupPath = path.join(backupDir, `agentlint-${timestamp}.db`);

  await fs.mkdir(backupDir, { recursive: true });

  // Checkpoint WAL to ensure complete backup
  db.run('PRAGMA wal_checkpoint(TRUNCATE)');

  // Copy database file
  await fs.copyFile(dbPath, backupPath);

  // Also copy WAL if exists (shouldn't after checkpoint, but safety)
  const walPath = `${dbPath}-wal`;
  if (await fs.exists(walPath)) {
    await fs.copyFile(walPath, `${backupPath}-wal`);
  }

  console.log(`Backup created: ${backupPath}`);
  return backupPath;
}

async function restoreFromBackup(db: Database, backupPath: string): Promise<void> {
  const dbPath = db.filename;

  // Close database
  db.close();

  // Restore from backup
  await fs.copyFile(backupPath, dbPath);

  // Restore WAL if exists
  const walBackup = `${backupPath}-wal`;
  if (await fs.exists(walBackup)) {
    await fs.copyFile(walBackup, `${dbPath}-wal`);
  }

  console.log(`Database restored from: ${backupPath}`);
}
```

**Backup Retention**:
```typescript
async function pruneOldBackups(keepCount = 3): Promise<void> {
  const backupDir = path.join(XDG_CACHE_HOME, 'agentlint', 'backups');
  const backups = await fs.readdir(backupDir);

  // Sort by timestamp (embedded in filename)
  const sorted = backups
    .filter(f => f.startsWith('agentlint-') && f.endsWith('.db'))
    .sort()
    .reverse();

  // Keep most recent N backups
  for (const backup of sorted.slice(keepCount)) {
    await fs.unlink(path.join(backupDir, backup));
    // Also remove WAL if exists
    const walPath = path.join(backupDir, `${backup}-wal`);
    if (await fs.exists(walPath)) {
      await fs.unlink(walPath);
    }
  }
}
```

**Backup Locations**:
```
~/.cache/agentlint/backups/
├── agentlint-2026-01-13T10-30-00-000Z.db
├── agentlint-2026-01-12T15-45-00-000Z.db
└── agentlint-2026-01-11T09-00-00-000Z.db
```

### 3. Configuration Versioning

**Config File Format** (config.toml):

```toml
# agentlint configuration
version = 1  # Config format version

[analysis]
frequency = "regular"  # calm | regular | active

[telemetry]
enabled = false

[llm]
provider = "anthropic"
model = "claude-sonnet-4-20250514"
```

**Config Migration**:

```typescript
interface ConfigMigration {
  fromVersion: number;
  toVersion: number;
  migrate: (config: unknown) => unknown;
}

const CONFIG_MIGRATIONS: ConfigMigration[] = [
  {
    fromVersion: 1,
    toVersion: 2,
    migrate: (config: ConfigV1): ConfigV2 => ({
      ...config,
      version: 2,
      // v2 adds temperature settings
      llm: {
        ...config.llm,
        temperatures: {
          extraction: 0.1,
          reasoning: 0.3,
          synthesis: 0.4,
        },
      },
    }),
  },
];

function loadConfig(configPath: string): Config {
  const raw = TOML.parse(await fs.readFile(configPath, 'utf-8'));
  const version = raw.version ?? 1;

  let config = raw;
  for (const migration of CONFIG_MIGRATIONS) {
    if (version >= migration.fromVersion && version < migration.toVersion) {
      config = migration.migrate(config);
    }
  }

  // Write upgraded config if version changed
  if (config.version > version) {
    await fs.writeFile(configPath, TOML.stringify(config));
    console.log(`Config upgraded from v${version} to v${config.version}`);
  }

  return config as Config;
}
```

**Downgrade Prevention**:

```typescript
function checkConfigVersion(config: unknown, currentVersion: number): void {
  const fileVersion = (config as { version?: number }).version ?? 1;

  if (fileVersion > currentVersion) {
    throw new ConfigError(
      `Config file version ${fileVersion} is newer than agentlint supports (${currentVersion}). ` +
      `Please upgrade agentlint or use an older config file.`
    );
  }
}
```

### 4. Baseline Versioning

**Baseline Identification**:

```typescript
interface BaselineMetadata {
  // Primary identifier
  timestamp: string;           // ISO 8601: "2026-01-13T10:30:00.000Z"

  // Git context (if available)
  gitCommit?: string;          // SHA: "a1b2c3d4..."
  gitBranch?: string;          // "main", "feature/xyz"
  gitDirty?: boolean;          // Uncommitted changes?

  // agentlint context
  agentlintVersion: string;    // "1.2.3"
  schemaVersion: number;       // From PRAGMA user_version

  // LLM context (for reproducibility per ADR-0015)
  llmModel?: string;           // "claude-sonnet-4-20250514"
  temperatures?: {
    extraction: number;
    reasoning: number;
    synthesis: number;
  };

  // Analysis scope
  domains: string[];           // ["config", "session", "docs"]
  projectPath: string;         // "/Users/dev/myproject"

  // User-provided
  notes?: string;              // Optional user annotation
}
```

**Baseline Table Schema**:

```sql
CREATE TABLE baselines (
  id INTEGER PRIMARY KEY,

  -- Primary identifier
  created_at TEXT NOT NULL,              -- ISO 8601 timestamp

  -- Git context
  git_commit TEXT,                       -- SHA if available
  git_branch TEXT,
  git_dirty INTEGER DEFAULT 0,           -- Boolean

  -- agentlint context
  agentlint_version TEXT NOT NULL,
  schema_version INTEGER NOT NULL,

  -- LLM context (JSON for flexibility)
  llm_metadata JSON,

  -- Scope
  project_path TEXT NOT NULL,
  domains JSON NOT NULL,                 -- ["config", "session", ...]

  -- Content
  config_hash TEXT,                      -- SHA256 of CLAUDE.md
  config_content TEXT,                   -- Full config for causal analysis
  metrics JSON NOT NULL,                 -- Analysis metrics

  -- User annotation
  notes TEXT,

  -- Indexes for common queries
  UNIQUE(project_path, created_at)
);

CREATE INDEX idx_baselines_project ON baselines(project_path);
CREATE INDEX idx_baselines_created ON baselines(created_at);
CREATE INDEX idx_baselines_git ON baselines(git_commit);
```

**Baseline Display Format**:

```
agentlint history

┌──────────────────────────────────────────────────────────────────────────────┐
│ Baseline History for /Users/dev/myproject                                    │
├────────────────────────┬───────────┬──────────┬─────────────────────────────┤
│ Timestamp              │ Git       │ Version  │ Summary                     │
├────────────────────────┼───────────┼──────────┼─────────────────────────────┤
│ 2026-01-13T10:30:00Z   │ a1b2c3d   │ v1.2.3   │ 12 issues, 8 recommendations│
│ 2026-01-12T15:00:00Z   │ f4e5d6c   │ v1.2.2   │ 15 issues, 10 recommendations│
│ 2026-01-11T09:00:00Z   │ 9a8b7c6*  │ v1.2.1   │ 18 issues, 12 recommendations│
└────────────────────────┴───────────┴──────────┴─────────────────────────────┘

* = dirty (uncommitted changes)
```

### 5. Version Compatibility Matrix

**Compatibility Rules**:

| Scenario | Behavior |
|----------|----------|
| Schema older than tool | Auto-migrate with backup |
| Schema newer than tool | Error: "Upgrade agentlint" |
| Config older than tool | Auto-upgrade config file |
| Config newer than tool | Error: "Upgrade agentlint" |
| Baseline from older version | Queryable with metadata note |
| Baseline from newer version | Read-only, warn about features |

**Startup Check Flow**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AGENTLINT STARTUP VERSION CHECK                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Load config.toml                                                        │
│     ├─ Check config version                                                 │
│     │   ├─ Older? Auto-upgrade, write back                                 │
│     │   ├─ Same? Continue                                                  │
│     │   └─ Newer? Error: "Upgrade agentlint to use this config"            │
│     │                                                                       │
│  2. Open database                                                           │
│     ├─ Check PRAGMA user_version                                           │
│     │   ├─ Older? Backup → Run migrations → Continue                       │
│     │   ├─ Same? Continue                                                  │
│     │   └─ Newer? Error: "Database requires newer agentlint"               │
│     │                                                                       │
│  3. Ready for analysis                                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6. Manual Recovery Commands

For edge cases where automatic recovery fails:

```bash
# List available backups
agentlint db backups

# Restore specific backup
agentlint db restore 2026-01-13T10-30-00-000Z

# Export database to JSON (emergency recovery)
agentlint db export --output backup.json

# Import from JSON export
agentlint db import backup.json

# Force schema version (dangerous, for debugging)
agentlint db set-version 5 --force
```

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | All migration/backup operations run locally |
| II. Improvement-Oriented | Yes | Historical data preserved through migrations |
| III. Causal-First | Yes | Baseline metadata enables origin tracing |
| IV. Mixed-Methods | N/A | Versioning is orthogonal to analysis methods |
| V. Language-Agnostic | N/A | Versioning is language-independent |
| VI. Tool-Agnostic | Yes | Schema supports multiple AI tool adapters |
| VII. Intelligent Tooling | Yes | Migration is tool-based; no agent involvement needed |
| VIII. Compounding Value | Yes | Migrations preserve baseline history for compound value |
| IX. Agent-Aware | N/A | Versioning doesn't affect agent cognition |

## More Information

### Related Documents
- [ADR-0003: Local Storage Strategy](./0003-local-storage-strategy.md) - SQLite schema foundation
- [ADR-0015: Reproducibility and Determinism](./0015-reproducibility-and-determinism.md) - Baseline metadata requirements
- [ADR-0016: Concurrency Model](./0016-concurrency-model.md) - WAL mode, checkpoint handling
- Design Questions: [Section 3.2 - Schema Migration Strategy](../../design-questions.md#32-schema-migration-strategy)
- Design Questions: [Section 3.3 - Baseline Versioning](../../design-questions.md#33-baseline-versioning)

### Research Sources
- [SQLite PRAGMA user_version](https://sqlite.org/pragma.html) - Built-in schema versioning
- [SQLite DB Migrations with PRAGMA user_version](https://levlaz.org/sqlite-db-migrations-with-pragma-user_version/) - Migration pattern
- [Declarative Schema Migration for SQLite](https://david.rothlis.net/declarative-schema-migration-for-sqlite/) - Alternative approach
- [Database Rollback Strategies in DevOps](https://www.harness.io/harness-devops-academy/database-rollback-strategies-in-devops) - Rollback patterns
- [Drizzle ORM with Bun SQLite](https://orm.drizzle.team/docs/get-started/bun-sqlite-new) - Alternative considered
- [bun-migrate](https://github.com/redraskal/bun-migrate) - Bun-specific migration tool
- [Semantic Versioning 2.0.0](https://semver.org/) - Tool versioning standard
- [Fix Forward vs Rollback](https://www.liquibase.com/blog/database-rollbacks-the-devops-approach-to-rolling-back-and-fixing-forward) - Migration philosophy

### Implementation Notes

#### Migration Naming Convention

```
NNNN_brief_description.sql

Examples:
0001_initial_schema.sql
0002_add_fts5_search.sql
0003_add_checkpoint_tables.sql
0004_add_observability_spans.sql
```

#### Testing Migrations

```typescript
// Test each migration applies cleanly
describe('migrations', () => {
  for (const migration of migrations) {
    it(`applies migration ${migration.version}: ${migration.name}`, async () => {
      const db = new Database(':memory:');

      // Apply all prior migrations
      for (const prior of migrations.filter(m => m.version < migration.version)) {
        db.run(prior.sql);
      }

      // Apply this migration
      expect(() => db.run(migration.sql)).not.toThrow();

      // Verify version updated
      const version = db.query('PRAGMA user_version').get();
      expect(version.user_version).toBe(migration.version);
    });
  }
});
```

#### Follow-Up Decisions

This ADR surfaces the need for:

1. **Compatibility Window**: How many schema versions back should be supported? (Suggestion: 3 major versions)
2. **Migration Notifications**: Should users be notified when migration occurs? (Suggestion: quiet success, verbose on failure)
3. **Baseline Pruning**: Should old baselines be auto-pruned? (Suggestion: configurable retention policy)
