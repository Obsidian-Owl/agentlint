---
status: accepted
date: 2026-01-13
decision-makers: [CTO, Architecture Lead]
consulted: [Development Team]
informed: [All Contributors]
---

# ADR-0016: Concurrency Model

## Context and Problem Statement

agentlint performs long-running analysis operations that may be interrupted (user cancel, system crash, power loss). Additionally, multiple CLI invocations may occur simultaneously (user runs in multiple terminals, CI/CD pipelines, git hooks). This ADR defines how agentlint handles:

1. **Database Concurrency**: Multiple processes accessing SQLite simultaneously
2. **Checkpointing**: Saving analysis state to resume after interruption
3. **Durability**: Guarantees about data integrity after crashes
4. **CLI Concurrency**: Multiple agentlint processes running on same project

The user specifically requested understanding of Temporal-style durability patterns. After research, we found that while Temporal's "durable execution" (event sourcing with full replay) is powerful, it's overengineered for a CLI tool. SQLite-based checkpointing provides crash-resume capability with far less complexity.

## Decision Drivers

- **Crash Recovery**: Users shouldn't lose significant work on interruption
- **Data Integrity**: SQLite database must never be corrupted
- **Compounding Value**: Analysis should produce partial results even if interrupted
- **Simplicity**: Avoid overengineering; CLI tool, not distributed system
- **Local-First**: No external services (Temporal requires server infrastructure)
- **Bun Runtime**: Leverage Bun's built-in SQLite (ADR-0001, ADR-0003)

## Considered Options

### Database Concurrency
1. SQLite WAL Mode (Write-Ahead Logging)
2. File Locking Only (EXCLUSIVE mode)
3. Separate Write Queue (single writer thread)

### Checkpointing Approach
1. SQLite Checkpoints (state tables)
2. Temporal-Style Durable Execution (event sourcing)
3. File-Based Checkpoints (JSON files)

### Durability Guarantees
1. Crash-Resume (resume from last checkpoint)
2. Full Replay (event log enables any-point resume)
3. Best-Effort (restart from beginning)

### CLI Concurrency
1. Lock + Queue (acquire lock, wait if busy)
2. Fail Fast (error if already running)
3. Merge Results (concurrent runs, merge outputs)

## Decision Outcome

### Database Concurrency: SQLite WAL Mode

**Chosen**: WAL (Write-Ahead Logging) mode because:
- Allows concurrent reads during writes (readers don't block writers)
- 10-30% faster writes than rollback journal
- Automatic checkpointing (WAL → main database)
- Perfect for single-machine CLI tool
- Already mentioned in ADR-0003; this ADR formalizes the concurrency implications

```sql
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;  -- Wait up to 5s for locks
PRAGMA synchronous = NORMAL; -- Balance durability/performance
```

**WAL Concurrency Model**:
```
┌─────────────────────────────────────────────────────────────────┐
│                    SQLite WAL Mode                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  agentlint.db           agentlint.db-wal      agentlint.db-shm │
│  (main database)        (write-ahead log)     (shared memory)  │
│       │                       │                     │          │
│       │    ┌──────────────────┼─────────────────────┤          │
│       │    │                  │                     │          │
│       ▼    ▼                  ▼                     ▼          │
│  ┌─────────────┐         ┌─────────────┐      ┌─────────────┐  │
│  │   READER    │         │   WRITER    │      │   READER    │  │
│  │  (process)  │         │  (process)  │      │  (process)  │  │
│  │             │         │             │      │             │  │
│  │ Reads from  │         │ Appends to  │      │ Reads from  │  │
│  │ main db +   │◄───────►│ WAL only    │◄────►│ main db +   │  │
│  │ WAL         │         │             │      │ WAL         │  │
│  └─────────────┘         └─────────────┘      └─────────────┘  │
│                                │                                │
│                                ▼                                │
│                    ┌─────────────────────┐                     │
│                    │ CHECKPOINT (auto)   │                     │
│                    │ Transfers WAL → db  │                     │
│                    │ Happens at 1000     │                     │
│                    │ pages or on close   │                     │
│                    └─────────────────────┘                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Checkpointing Approach: SQLite Checkpoints

**Chosen**: SQLite-based checkpoints because:
- Simple: just INSERT/UPDATE rows in checkpoint table
- Transactional: checkpoint writes are atomic
- No external files to synchronize
- Battle-tested SQLite durability
- Can resume from last checkpoint after crash

**NOT using Temporal-style durable execution**:
- Requires event sourcing (log every operation)
- Designed for distributed systems, not CLI tools
- Adds significant complexity (event store, replay engine)
- Temporal requires server infrastructure (not Local-First)

**Checkpoint Schema**:

```sql
-- Analysis checkpoints for crash recovery
CREATE TABLE analysis_checkpoints (
  id INTEGER PRIMARY KEY,
  project_path TEXT NOT NULL,
  analysis_id TEXT NOT NULL UNIQUE,  -- UUID for this analysis run
  started_at TEXT NOT NULL,           -- ISO 8601
  last_checkpoint_at TEXT NOT NULL,   -- ISO 8601
  phase TEXT NOT NULL,                -- 'static', 'indexing', 'agentic', 'synthesis'
  progress_pct INTEGER DEFAULT 0,     -- 0-100
  state JSON NOT NULL,                -- Phase-specific checkpoint state
  status TEXT DEFAULT 'in_progress',  -- 'in_progress', 'completed', 'failed', 'interrupted'

  CONSTRAINT valid_phase CHECK(phase IN ('static', 'indexing', 'agentic', 'synthesis')),
  CONSTRAINT valid_status CHECK(status IN ('in_progress', 'completed', 'failed', 'interrupted'))
);

CREATE INDEX idx_checkpoints_project ON analysis_checkpoints(project_path);
CREATE INDEX idx_checkpoints_status ON analysis_checkpoints(status);

-- Partial results (saved incrementally)
CREATE TABLE partial_results (
  id INTEGER PRIMARY KEY,
  analysis_id TEXT NOT NULL REFERENCES analysis_checkpoints(analysis_id),
  domain TEXT NOT NULL,               -- 'config', 'session', 'docs', 'code'
  result_type TEXT NOT NULL,          -- 'finding', 'metric', 'recommendation'
  data JSON NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_partial_analysis ON partial_results(analysis_id);
```

**Checkpoint State by Phase**:

```typescript
interface CheckpointState {
  static: {
    filesProcessed: string[];       // Completed files
    filesRemaining: string[];       // Yet to process
    partialASTCache: Record<string, unknown>; // Cached parse results
  };

  indexing: {
    sessionsIndexed: string[];      // Completed session IDs
    sessionsRemaining: string[];    // Yet to index
    ftsProgress: number;            // FTS5 indexing progress
  };

  agentic: {
    subagentsCompleted: string[];   // Completed subagent domains
    subagentsPending: string[];     // Pending domains
    orchestratorState: unknown;     // Orchestrator context snapshot
  };

  synthesis: {
    findingsMerged: boolean;
    recommendationsGenerated: boolean;
    reportGenerated: boolean;
  };
}
```

### Durability Guarantees: Crash-Resume

**Chosen**: Crash-Resume because:
- Pragmatic for CLI tool (not enterprise workflow engine)
- Loses minimal work (last checkpoint to crash point)
- No storage overhead of full event log
- Users can see partial progress on resume

**Resume Flow**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    CRASH-RESUME FLOW                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. User runs: agentlint analyze                               │
│                    │                                            │
│                    ▼                                            │
│  2. Check for interrupted analysis:                            │
│     SELECT * FROM analysis_checkpoints                         │
│     WHERE project_path = ? AND status = 'interrupted'          │
│                    │                                            │
│          ┌────────┴────────┐                                   │
│          │                 │                                    │
│     Found?              No interrupted                         │
│          │                 │                                    │
│          ▼                 ▼                                    │
│  3a. Prompt user:    3b. Start fresh                          │
│      "Resume from         analysis                             │
│       phase X (75%)?                                           │
│       [Y/n]"                                                   │
│          │                                                      │
│          ▼                                                      │
│  4. Load checkpoint state:                                     │
│     - Skip completed work                                      │
│     - Restore partial results                                  │
│     - Resume from saved position                               │
│                    │                                            │
│                    ▼                                            │
│  5. Continue analysis with checkpoints:                        │
│     - Save checkpoint every N files (static)                   │
│     - Save checkpoint after each session (indexing)            │
│     - Save checkpoint after each subagent (agentic)            │
│                    │                                            │
│                    ▼                                            │
│  6. On completion:                                             │
│     UPDATE analysis_checkpoints SET status = 'completed'       │
│                                                                 │
│  On Ctrl+C / crash:                                            │
│     - SQLite WAL ensures atomic commits                        │
│     - Last checkpoint is safe                                  │
│     - status remains 'in_progress' → detected on next run      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### CLI Concurrency: Lock + Queue

**Chosen**: Lock + Queue because:
- Prevents database corruption from concurrent writes
- User-friendly: shows "waiting for lock" rather than error
- Supports intentional parallel invocations (waits, doesn't fail)
- Timeout prevents infinite waits

**Lock Implementation**:

```typescript
interface ProjectLock {
  projectPath: string;
  lockFile: string;      // ~/.local/share/agentlint/locks/<hash>.lock
  pid: number;
  acquiredAt: Date;
  timeout: number;       // Default: 300s (5 minutes)
}

async function acquireProjectLock(projectPath: string): Promise<ProjectLock> {
  const lockFile = getLockFilePath(projectPath);
  const maxWait = 30_000; // 30s max wait
  const pollInterval = 500; // Check every 500ms

  let waited = 0;

  while (waited < maxWait) {
    try {
      // Atomic lock acquisition using exclusive file creation
      const fd = Bun.openSync(lockFile, 'wx');
      const lock: ProjectLock = {
        projectPath,
        lockFile,
        pid: process.pid,
        acquiredAt: new Date(),
        timeout: 300_000,
      };

      // Write lock info for debugging
      Bun.write(fd, JSON.stringify(lock));
      fd.close();

      // Register cleanup on exit
      process.on('exit', () => releaseLock(lock));
      process.on('SIGINT', () => releaseLock(lock));
      process.on('SIGTERM', () => releaseLock(lock));

      return lock;
    } catch (e) {
      if (e.code === 'EEXIST') {
        // Lock exists, check if stale
        const existingLock = await checkLockStale(lockFile);
        if (existingLock.stale) {
          // Remove stale lock and retry
          await Bun.unlink(lockFile);
          continue;
        }

        // Show user-friendly message
        console.log(`Waiting for lock (held by PID ${existingLock.pid})...`);
        await Bun.sleep(pollInterval);
        waited += pollInterval;
      } else {
        throw e;
      }
    }
  }

  throw new Error(`Timeout waiting for project lock after ${maxWait}ms`);
}

async function checkLockStale(lockFile: string): Promise<{ stale: boolean; pid?: number }> {
  try {
    const content = await Bun.file(lockFile).text();
    const lock = JSON.parse(content) as ProjectLock;

    // Check if process is still running
    try {
      process.kill(lock.pid, 0); // Signal 0 = check existence

      // Check if lock has timed out
      const elapsed = Date.now() - new Date(lock.acquiredAt).getTime();
      if (elapsed > lock.timeout) {
        return { stale: true, pid: lock.pid };
      }

      return { stale: false, pid: lock.pid };
    } catch {
      // Process doesn't exist, lock is stale
      return { stale: true, pid: lock.pid };
    }
  } catch {
    // Can't read lock file, assume stale
    return { stale: true };
  }
}

function releaseLock(lock: ProjectLock): void {
  try {
    Bun.unlinkSync(lock.lockFile);
  } catch {
    // Ignore errors on cleanup
  }
}
```

**Lock File Location**:
```
~/.local/share/agentlint/locks/
├── <sha256(project_path_1)>.lock
├── <sha256(project_path_2)>.lock
└── ...
```

### Consequences

**Good:**
- WAL mode enables concurrent reads during analysis (other tools can query)
- Crash-resume prevents losing significant work
- Lock + Queue is user-friendly (waits rather than fails)
- No external infrastructure required (Temporal would need server)
- Simple implementation using SQLite's built-in durability
- Partial results preserved incrementally

**Bad:**
- WAL requires two additional files (.wal, .shm)
- Lock files can become stale if process killed with SIGKILL
- No full replay capability (can't resume from arbitrary point)
- Checkpointing adds ~5% overhead to analysis time

**Neutral:**
- Lock timeout (5 min) is configurable but has reasonable default
- Resume prompt requires user interaction (could auto-resume in future)

## Comparison: Temporal vs SQLite Checkpointing

The user asked about Temporal's durability model. Here's why we chose SQLite checkpoints instead:

| Aspect | Temporal Durable Execution | SQLite Checkpoints |
|--------|---------------------------|-------------------|
| **Philosophy** | Event sourcing: log every operation, replay on failure | Snapshot: save state at key points |
| **Infrastructure** | Requires Temporal Server (separate process/service) | Zero infrastructure (SQLite is embedded) |
| **Resume Granularity** | Can resume from any operation | Resumes from last checkpoint |
| **Storage** | Full event log (unbounded growth) | Fixed checkpoint rows |
| **Complexity** | High (event schema, replay logic) | Low (CRUD on checkpoint table) |
| **Local-First** | No (needs server) | Yes (embedded SQLite) |
| **Use Case** | Long-running workflows (hours/days), distributed systems | CLI tools, local analysis |

**Temporal's "Durable Execution" Pattern**:
```
┌─────────────────────────────────────────────────────────────────┐
│ Temporal: Full event log enables deterministic replay          │
├─────────────────────────────────────────────────────────────────┤
│ Event Log: [start] → [file1] → [file2] → [crash]              │
│                                              │                 │
│ On recovery: Replay [start] → [file1] → [file2] → continue    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ agentlint: Checkpoint snapshots enable resume                  │
├─────────────────────────────────────────────────────────────────┤
│ Checkpoints: [start] → [CP: files 1-100] → [crash]            │
│                              │                                 │
│ On recovery: Load CP → continue from file 101                  │
└─────────────────────────────────────────────────────────────────┘
```

**When to use Temporal**: Multi-service orchestration, workflows spanning hours/days, need for exactly-once semantics across distributed systems.

**When to use SQLite Checkpoints**: Single-machine CLI tools, local-first design, simplicity is prioritized.

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | All state in local SQLite, no external services |
| II. Improvement-Oriented | Yes | Crash-resume preserves analysis progress |
| III. Causal-First | N/A | Concurrency doesn't affect causal tracing |
| IV. Mixed-Methods | N/A | Concurrency is orthogonal to analysis methods |
| V. Language-Agnostic | N/A | Concurrency is language-independent |
| VI. Tool-Agnostic | N/A | Concurrency is tool-independent |
| VII. Intelligent Tooling | Yes | Checkpointing supports all analysis phases |
| VIII. Compounding Value | Yes | Partial results available even on interruption |
| IX. Agent-Aware | N/A | Concurrency model applies to all analysis |

## More Information

### Related Documents
- [ADR-0001: Language and Runtime Selection](./0001-language-and-runtime-selection.md) - Bun with built-in SQLite
- [ADR-0003: Local Storage Strategy](./0003-local-storage-strategy.md) - SQLite schema, WAL mode mention
- [ADR-0011: Parallel Processing Architecture](./0011-parallel-processing-architecture.md) - Subagent pattern, worker pools
- [ADR-0014: Error Handling and Recovery](./0014-error-handling-and-recovery.md) - Error classification, retries
- Design Questions: [Section 4.4 - Concurrency Model](../../design-questions.md#44-concurrency-model)

### Research Sources
- [Temporal Durable Execution](https://temporal.io/how-it-works) - Event sourcing for workflows
- [SQLite WAL Mode](https://sqlite.org/wal.html) - Write-ahead logging documentation
- [LangGraph Checkpointing](https://langchain-ai.github.io/langgraph/concepts/persistence/) - Agent state persistence
- [Microsoft Agent Framework Patterns](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns) - Durability patterns
- [Bun SQLite Documentation](https://bun.sh/docs/api/sqlite) - Transaction and concurrency handling

### Implementation Notes

#### 1. Checkpoint Frequency

Balance between durability and performance:

| Phase | Checkpoint Trigger | Rationale |
|-------|-------------------|-----------|
| Static | Every 50 files | Files are fast; frequent checkpoints add minimal overhead |
| Indexing | After each session | Sessions can be large; checkpoint after each |
| Agentic | After each subagent | LLM calls are slow; checkpoint after each completes |
| Synthesis | After each major step | Three steps: merge, recommendations, report |

#### 2. SIGINT Handling

```typescript
process.on('SIGINT', async () => {
  console.log('\nInterrupted. Saving checkpoint...');

  await db.run(`
    UPDATE analysis_checkpoints
    SET status = 'interrupted',
        last_checkpoint_at = datetime('now')
    WHERE analysis_id = ?
  `, [currentAnalysisId]);

  console.log('Checkpoint saved. Run agentlint analyze to resume.');
  process.exit(130); // Standard SIGINT exit code
});
```

#### 3. WAL Checkpoint on Graceful Exit

```typescript
async function closeDatabase(db: Database): Promise<void> {
  // Force WAL checkpoint before closing
  await db.run('PRAGMA wal_checkpoint(TRUNCATE)');
  db.close();
}
```

### Follow-Up Decisions

This ADR surfaces the need for:

1. **Auto-Resume Policy**: Should `agentlint analyze` auto-resume interrupted analyses, or always prompt?
2. **Checkpoint Retention**: How long to keep completed checkpoint records? (Cleanup policy)
3. **Partial Result Display**: How to show partial results when analysis is interrupted?
