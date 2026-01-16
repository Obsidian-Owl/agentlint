# Feature Specification: Persistence Layer

> **Epic**: EP03
> **Created**: 2026-01-16
> **Status**: Draft
> **Author**: Claude

---

## 1. Overview

The Persistence Layer provides local storage for baselines, learnings, and session state using a JSON files + SQLite metadata index pattern. This foundation enables agentlint to track improvement over time, accumulate cross-project learnings, and recover from interrupted sessions.

### 1.1 Business Context

This is a P0 Foundation epic that implements the storage mechanisms required by Constitution Principles I (Local-First), II (Improvement-Oriented), and VIII (Compounding Value). It establishes the data layer that EP06 (Session Analysis), EP07 (Causal Tracing), EP09 (Temporal Analysis), EP10 (Recommendation Engine), and EP12 (Global Learnings) will build upon.

**Hypothesis**: If we implement robust persistence with JSON files + SQLite indexing, then agentlint can store baselines, track learnings, and resume interrupted sessions, measured by 100% data recovery after interruption and <2s query times for 50 baselines.

### 1.2 Out of Scope

- Session log indexing with FTS5 (EP06)
- Recommendation storage schema (EP10)
- Global learning transfer/promotion logic (EP12)
- CLI commands for storage operations (EP04)
- Vector embeddings for semantic search (EP12)

---

## 2. User Scenarios & Testing

> User stories are prioritized: P1 (must-have), P2 (should-have), P3 (nice-to-have)

### US-001 [P1]: Store Analysis Baseline

**As a** developer using agentlint,
**I want** to save analysis results as a baseline,
**So that** I can compare future analyses against this snapshot.

**Acceptance Criteria:**
- [ ] Given analysis results, when `saveBaseline()` is called, then a JSON file is created in `.agentlint/baselines/`
- [ ] Given a baseline is saved, when the SQLite index is queried, then the baseline metadata is queryable
- [ ] Given a baseline with a label, when querying by label, then the correct baseline is returned
- [ ] Given multiple baselines, when querying latest, then the most recent baseline is returned

**Test Scenarios:**
- Happy path: Save baseline with all fields populated, verify file and index entry created
- Edge case: Save baseline with minimal fields (no optional metadata)
- Error case: Attempt to save when `.agentlint/` directory doesn't exist (should auto-create)

---

### US-002 [P1]: Query Baselines for Comparison

**As a** developer,
**I want** to query historical baselines efficiently,
**So that** I can compare current state to past snapshots.

**Acceptance Criteria:**
- [ ] Given 50 baselines stored, when querying by date range, then results return in <2 seconds
- [ ] Given baselines with different labels, when filtering by label, then only matching baselines return
- [ ] Given a baseline ID, when fetching by ID, then the full JSON content is returned
- [ ] Given no baselines exist, when querying latest, then null/empty result is returned gracefully

**Test Scenarios:**
- Happy path: Query latest baseline, query by date range, query by label
- Performance: Query 50+ baselines completes under 2 seconds
- Error case: Query with invalid ID returns appropriate error

---

### US-003 [P1]: Save Session State Checkpoint

**As a** developer running a long analysis,
**I want** session state to be checkpointed automatically,
**So that** I can resume if the process is interrupted.

**Acceptance Criteria:**
- [ ] Given an active session, when a checkpoint trigger fires, then state is saved to JSON
- [ ] Given a checkpoint is saved, when the process crashes, then state file persists on disk
- [ ] Given checkpoint triggers, when multiple triggers fire rapidly, then debouncing prevents excessive writes
- [ ] Given a session, when phase changes, then a checkpoint is automatically created

**Test Scenarios:**
- Happy path: Checkpoint saves on phase change, on finding, on interval
- Debounce: Rapid triggers (10 in 1 second) result in only 1-2 actual writes
- Crash recovery: Kill process, verify state file exists and is valid JSON

---

### US-004 [P1]: Load and Resume Session

**As a** developer whose analysis was interrupted,
**I want** to resume from the last checkpoint,
**So that** I don't lose work already completed.

**Acceptance Criteria:**
- [ ] Given a session state file exists, when `loadState()` is called, then full state is restored
- [ ] Given restored state, when analysis resumes, then completed phases are not re-run
- [ ] Given cached tool results in state, when same tool is called, then cached result is returned
- [ ] Given no session file exists, when loading, then null is returned (not an error)

**Test Scenarios:**
- Happy path: Save state, load state, verify equality
- Resume: Load state mid-analysis, continue from correct phase
- Cache hit: Tool result in cache, verify no re-execution

---

### US-005 [P2]: Store Project-Local Learning

**As a** developer,
**I want** to save insights discovered during analysis,
**So that** they inform future analyses in this project.

**Acceptance Criteria:**
- [ ] Given a learning, when `saveLearning()` is called with scope='project', then it's saved in `.agentlint/learnings/`
- [ ] Given a learning is saved, when listing learnings, then it appears in results
- [ ] Given learning metadata, when indexed in SQLite, then it's queryable by tags/category

**Test Scenarios:**
- Happy path: Save learning with tags and category, verify file and index
- Edge case: Save learning with minimal metadata
- Query: Filter learnings by tag

---

### US-006 [P2]: Store Global Learning

**As a** developer,
**I want** to promote a learning to global scope,
**So that** it applies across all my projects.

**Acceptance Criteria:**
- [ ] Given a learning, when saved with scope='global', then it's stored in `~/.agentlint/learnings/`
- [ ] Given a global learning, when any project queries learnings, then global learnings are included
- [ ] Given global storage, when directory doesn't exist, then it's created automatically

**Test Scenarios:**
- Happy path: Save global learning, verify in home directory
- Cross-project: Query from different project, global learning appears
- First use: Global directory doesn't exist, created on first save

---

### US-007 [P2]: Atomic Write Operations

**As a** developer,
**I want** file writes to be atomic,
**So that** crashes during writes don't corrupt data.

**Acceptance Criteria:**
- [ ] Given a file write, when using atomic write, then temp file is created first then renamed
- [ ] Given a crash during write, when recovering, then either old or new file exists (not partial)
- [ ] Given SQLite operations, when transaction fails, then database is not corrupted

**Test Scenarios:**
- Happy path: Atomic write creates file successfully
- Crash simulation: Interrupt write mid-stream, verify no partial file
- SQLite: Begin transaction, simulate failure, verify rollback

---

### US-008 [P3]: Directory Structure Initialization

**As a** first-time user,
**I want** agentlint to initialize its storage directories,
**So that** I don't need to manually create them.

**Acceptance Criteria:**
- [ ] Given no `.agentlint/` directory, when first storage operation runs, then directory is created
- [ ] Given no `~/.agentlint/` directory, when global storage is accessed, then directory is created
- [ ] Given directories exist, when init runs, then existing data is preserved

**Test Scenarios:**
- Fresh install: No directories exist, first save creates everything
- Existing install: Directories exist, init is idempotent

---

### US-009 [P3]: File Permission Management

**As a** security-conscious developer,
**I want** sensitive files to have appropriate permissions,
**So that** other users on shared systems can't access my data.

**Acceptance Criteria:**
- [ ] Given files in `.agentlint/`, when created, then permissions are set to user-only (0600/0700)
- [ ] Given files in `~/.agentlint/`, when created, then permissions are user-only
- [ ] Given SQLite databases, when created, then they have restricted permissions

**Test Scenarios:**
- Happy path: Create file, verify permissions are 0600
- Directory: Create directory, verify permissions are 0700

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | User Story |
|----|-------------|----------|------------|
| FR-001 | Save baseline as JSON to `.agentlint/baselines/{timestamp}-{id}.json` | P1 | US-001 |
| FR-002 | Index baseline metadata in `baselines.db` SQLite database | P1 | US-001 |
| FR-003 | Query baselines by ID, label, date range from SQLite index | P1 | US-002 |
| FR-004 | Load full baseline JSON content by ID | P1 | US-002 |
| FR-005 | Maintain `latest.json` symlink pointing to most recent baseline | P2 | US-001 |
| FR-006 | Save session state as JSON to `.agentlint/sessions/{sessionId}-state.json` | P1 | US-003 |
| FR-007 | Trigger checkpoint on events: phase_change, finding, recommendation | P1 | US-003 |
| FR-008 | Trigger checkpoint on interval (default 60s) with debouncing (min 10s) | P1 | US-003 |
| FR-009 | Load session state from JSON file | P1 | US-004 |
| FR-010 | Cache tool results in session state for resume efficiency | P2 | US-004 |
| FR-011 | Save learning to project scope (`.agentlint/learnings/`) | P2 | US-005 |
| FR-012 | Save learning to global scope (`~/.agentlint/learnings/`) | P2 | US-006 |
| FR-013 | Index learning metadata in SQLite for querying | P2 | US-005, US-006 |
| FR-014 | Use atomic write pattern (temp file + rename) for all file operations | P1 | US-007 |
| FR-015 | Use SQLite WAL mode for crash safety | P1 | US-007 |
| FR-016 | Auto-create `.agentlint/` directory structure on first use | P2 | US-008 |
| FR-017 | Auto-create `~/.agentlint/` directory structure on first global access | P2 | US-008 |
| FR-018 | Set file permissions to 0600 (files) and 0700 (directories) | P3 | US-009 |
| FR-019 | Include schema version in all JSON files, validate on load with best-effort parsing | P2 | US-001, US-002 |
| FR-020 | Query both project and global learnings.db when listing learnings, merge results | P2 | US-005, US-006 |

### 3.2 Non-Functional Requirements

| ID | Requirement | Metric | Target |
|----|-------------|--------|--------|
| NFR-001 | Query Performance | Baseline query (50 records) | < 2 seconds |
| NFR-002 | Write Performance | Baseline save | < 500ms |
| NFR-003 | Checkpoint Overhead | Time to save checkpoint | < 100ms |
| NFR-004 | Storage Efficiency | Baseline JSON size | < 100KB typical |
| NFR-005 | Crash Recovery | Data integrity after kill -9 | 100% (no corruption) |
| NFR-006 | Platform Support | Operating systems | macOS, Linux (Windows P3) |
| NFR-007 | Test Coverage | Code coverage | > 80% |

---

## 4. Key Entities

> Define the core domain entities this feature introduces or modifies

| Entity | Description | Key Attributes |
|--------|-------------|----------------|
| Baseline | Snapshot of analysis state at a point in time | id, version, createdAt, projectPath, actType, configAnalysis, metrics, recommendations |
| SessionState | Checkpoint of in-progress analysis session | id, projectPath, phase, findings, toolResultCache, checkpoint metadata |
| Learning | Insight captured for future reference | id, title, content, tags, category, validation status, origin |
| BaselinesDB | SQLite index for baseline queries | file_path, created_at, metrics columns, label |
| LearningsDB | SQLite index for learning queries | file_path, category, tags, validation_status |

### 4.1 Entity Relationships

```
Project --1:N--> Baseline (one project has many baselines)
Project --1:N--> SessionState (one project has many sessions)
Project --1:N--> Learning (project-scoped learnings)
User --1:N--> Learning (global-scoped learnings)
SessionState --1:N--> Finding
SessionState --1:N--> ToolResultCache
```

### 4.2 Directory Structure

```
.agentlint/                           # Project-local storage
├── baselines/
│   ├── 2026-01-14T10-30-00-abc123.json
│   ├── 2026-01-15T14-20-00-def456.json
│   └── latest.json → 2026-01-15T14-20-00-def456.json
├── baselines.db                      # SQLite metadata index
├── sessions/
│   ├── {sessionId}-state.json
│   └── ...
├── learnings/
│   ├── 2026-01-14-api-patterns-abc123.md
│   └── ...
└── learnings.db                      # SQLite metadata index

~/.agentlint/                         # Global storage
├── learnings/
│   ├── 2026-01-15-error-handling-def456.md
│   └── ...
├── learnings.db
└── config.json                       # Global configuration (future)
```

---

## 5. Success Criteria

> How do we know this feature is successful? Define measurable outcomes.

- [ ] **Functional**: All 9 user stories pass acceptance criteria
- [ ] **Quality**: Test coverage > 80%, no data corruption bugs
- [ ] **Performance**: Baseline query (50 records) < 2s, checkpoint save < 100ms
- [ ] **Reliability**: Session can be killed and resumed with 100% state recovery
- [ ] **Constitution**: Local-First verified (no external data transmission)

---

## 6. Edge Cases & Error Handling

| Scenario | Expected Behavior | Priority |
|----------|-------------------|----------|
| Disk full during write | Atomic write fails cleanly, original file preserved | P1 |
| Concurrent writes to same file | Use file locking or unique filenames | P1 |
| Corrupted JSON file on load | Return error with file path, don't crash | P1 |
| SQLite database locked | Retry with exponential backoff, timeout after 5s | P1 |
| Missing `.agentlint/` directory | Auto-create on first write | P2 |
| Invalid baseline version | Log warning, attempt best-effort parse | P2 |
| Permission denied on write | Return clear error message with path | P2 |
| Very large baseline (>1MB) | Log warning, proceed with save | P3 |
| Clock skew affects timestamps | Use monotonic IDs alongside timestamps | P3 |

---

## 7. Dependencies & Assumptions

### 7.1 Dependencies

| Dependency | Type | Status | Impact if Missing |
|------------|------|--------|-------------------|
| EP01 Project Foundation | Internal | Complete | Cannot start - need Bun:sqlite, project structure |
| Bun:sqlite | External | Available | Core functionality blocked |
| File system access | External | Available | Cannot store anything |

### 7.2 Assumptions

- Bun's SQLite implementation supports WAL mode
- File system supports atomic rename operations
- User has write permissions to project directory and home directory
- JSON files remain under ~100KB for typical baselines
- Sessions rarely exceed 1000 tool result cache entries

---

## 8. Open Questions

> Questions that need resolution before implementation

- [x] **Q1**: Should baseline files be .json or .json5 (allowing comments)? — **JSON (standard, per ADR-0008)**
- [x] **Q2**: What's the retention policy for old session checkpoints? — **30 days default, configurable**
- [x] **Q3**: Should we support baseline export/import in MVP? — **No, out of scope for MVP**
- [x] **Q4**: How do we handle baseline schema migrations when format changes? — **Version field + best-effort parsing. Store schema version in JSON, check on load, log warnings for unknown fields. No automatic migration.**
- [x] **Q5**: Should learnings.db be shared between project and global scope? — **Separate databases. Project uses `.agentlint/learnings.db`, global uses `~/.agentlint/learnings.db`. Query both when listing learnings.**

---

## 9. References

- [Epic: EP03 - Persistence Layer](../../docs/planning/epics/EP03-persistence-layer.md)
- [ADR-0008: Baseline Storage Format and Strategy](../../docs/architecture/adr/0008-baseline-storage-format-and-strategy.md)
- [ADR-0009: Global Learnings Storage and Transfer](../../docs/architecture/adr/0009-global-learnings-storage-and-transfer.md)
- [ADR-0010: Session State and Checkpointing](../../docs/architecture/adr/0010-session-state-and-checkpointing.md)
- [Arc42 Building Blocks - Persistence Layer](../../docs/architecture/arc42/05-building-blocks.md)
- [Constitution Principles](../../.specify/memory/constitution.md)

---

## Clarifications

> This section is populated by /dev.clarify

### Session 2026-01-16

**Q: How should baseline schema migrations be handled when the format changes between versions?**
A: Version field + best-effort parsing. Store schema version in JSON (`version: "1.0.0"`), check on load, log warnings for unknown fields. No automatic migration - keeps implementation simple while maintaining forward compatibility.

Updated: Added FR-019 in Section 3.1, updated Edge Case "Invalid baseline version"

**Q: Should learnings.db be shared between project and global scope, or separate databases?**
A: Separate databases. Project uses `.agentlint/learnings.db`, global uses `~/.agentlint/learnings.db`. When listing learnings, query both databases and merge results. This provides clean isolation and prevents cross-contamination.

Updated: Clarified FR-013 scope, confirmed directory structure in Section 4.2
