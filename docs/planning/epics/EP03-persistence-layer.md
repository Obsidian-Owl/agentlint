# EP03: Persistence Layer

> Implement local storage for baselines, learnings, session state, and configuration.

## Classification

| Attribute | Value |
|-----------|-------|
| **Type** | Foundation |
| **Priority** | P0-Critical |
| **Size** | M |
| **Estimated Duration** | 4 weeks |
| **Target Stories** | 7-9 stories |

## Business Outcome Hypothesis

**If** we implement a robust persistence layer with JSON files + SQLite indexing,
**Then** agentlint can store baselines, track learnings, and resume interrupted sessions,
**Measured by** 100% data recovery after interruption and <2s query times for 50 baselines.

## Scope Definition

### In Scope

- [ ] Define `.agentlint/` directory structure (project-local)
- [ ] Define `~/.agentlint/` directory structure (global)
- [ ] Implement baseline storage (JSON per ADR-0008)
- [ ] Implement SQLite metadata index for fast queries
- [ ] Create session state checkpointing (JSON per ADR-0010)
- [ ] Implement learnings storage (project + global scopes per ADR-0009)
- [ ] Add atomic write operations (transaction safety)
- [ ] Implement file permission management for sensitive data

### Out of Scope

- Session log indexing with FTS5 (EP06)
- Recommendation storage (EP10)
- Global learning transfer logic (EP12)
- CLI commands for storage operations (EP04)

### Minimum Viable Product (MVP)

The minimum deliverable that proves the hypothesis:

- Store and retrieve a baseline JSON file
- Query baselines by timestamp via SQLite
- Save and load session checkpoint

**MVP validates:** Storage mechanisms work correctly before building features on top

## Arc42 Traceability

| Source | References |
|--------|------------|
| **Building Blocks** | Persistence Layer (Baselines, Learnings, Session State) |
| **Runtime Scenarios** | 6.3 Baseline Comparison (load latest baseline) |
| **Quality Requirements** | QS-2 (checkpoint recovery), QS-6 (<2s query time) |
| **Crosscutting Concepts** | 8.2 Security (local storage, file permissions) |
| **ADRs** | ADR-0008 (Baseline Storage), ADR-0009 (Global Learnings), ADR-0010 (Checkpointing) |

## Requirements Traceability

| Source | References |
|--------|------------|
| **Personas** | All personas (reliable storage underpins all features) |
| **Use Cases** | UC-000 (Establish Baseline), UC-006 (Compare to Baseline) |
| **Requirements** | FR-5.1 (Baseline Management), FR-5.3 (Learning Persistence), NFR-4.4 (Transaction-safe) |

## Dependencies

### Blocked By (Cannot Start Without)

| Epic | Dependency Type | What's Needed |
|------|-----------------|---------------|
| EP01 | Hard | Bun:sqlite, project structure, file system utilities |

### Blocks (Other Epics Waiting On This)

| Epic | Dependency Type | What This Provides |
|------|-----------------|-------------------|
| EP06 | Hard | Storage foundations for session indexing |
| EP07 | Hard | Storage for causal analysis state |
| EP09 | Hard | Baseline storage and query infrastructure |
| EP10 | Hard | Foundation for recommendation storage |
| EP12 | Hard | Project + global storage locations |

### External Dependencies

| System/Team | Dependency | Status |
|-------------|------------|--------|
| Bun:sqlite | Built-in SQLite module | Available |
| File system | Local storage access | Available |

## Technical Considerations

### Key Decisions

- JSON for human-readable baseline storage (not binary formats)
- SQLite for metadata indexing only (not primary storage)
- Atomic writes using temp file + rename pattern
- Separate project-local and global storage scopes

### Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| SQLite file corruption on crash | Low | High | WAL mode, atomic operations |
| Permission issues on different OS | Low | Medium | Test on macOS, Linux; document Windows |
| Large baseline files slow to parse | Low | Low | Index metadata separately |

### Spikes Needed

- [ ] Benchmark SQLite query performance with 50+ baselines
- [ ] Test atomic write behavior across platforms

### Constitution Alignment

- **I. Local-First**: All storage in `.agentlint/` directories
- **VIII. Compounding Value**: Storage enables learning accumulation
- **II. Improvement-Oriented**: Baseline tracking is core capability

## Acceptance Criteria (High-Level)

### Functional

- [ ] `.agentlint/baselines/` stores timestamped JSON files
- [ ] `baselines.db` indexes baseline metadata for queries
- [ ] Session state serializes to JSON and deserializes correctly
- [ ] Learnings stored in both project and global scopes
- [ ] Atomic writes prevent partial file corruption
- [ ] File permissions restrict access appropriately

### Non-Functional

- [ ] Query 50 baselines < 2 seconds
- [ ] Storage operations atomic (no partial writes)
- [ ] Works on macOS, Linux (Windows stretch goal)

### Definition of Done

- [ ] All acceptance criteria pass
- [ ] Code reviewed and merged
- [ ] Tests written and passing (unit, integration)
- [ ] Documentation updated
- [ ] Deployed to staging environment
- [ ] Product owner sign-off

## Speckit Handoff Notes

> Guidance for `/speckit.specify` phase

### Primary Focus

- **Persona**: All (storage underpins everything)
- **Workflow**: Store → Index → Query → Retrieve
- **Outcome**: Reliable, fast local storage

### Constraints to Encode

From ADRs:
- ADR-0008: JSON + SQLite index pattern
- ADR-0009: Project + global scopes
- ADR-0010: JSON checkpointing with resumability

From Constitution:
- I. Local-First: All storage local

### Key Scenarios to Specify

1. Store baseline after analysis completes
2. Query baselines for comparison
3. Save session checkpoint mid-analysis
4. Recover session from checkpoint
5. Store project learning with later global promotion

### Tech Stack Notes (for `/speckit.plan`)

- Bun:sqlite for indexing
- JSON for primary storage
- jsondiffpatch for baseline comparison

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-01-15 | Arc42 Decomposer | Initial creation from Arc42 |
