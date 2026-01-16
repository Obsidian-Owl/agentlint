# Implementation Plan: Persistence Layer

> **Epic**: EP03
> **Spec**: specs/ep03-persistence-layer/spec.md
> **Created**: 2026-01-16
> **Status**: Design Complete
> **Author**: Claude

---

## Summary

**Primary Requirement**: Provide local storage for baselines, learnings, and session state using JSON files with SQLite metadata indexing, enabling agentlint to track improvement over time and recover from interrupted sessions.

**Technical Approach**: Implement a layered persistence architecture with atomic file operations for JSON storage and Bun:sqlite for queryable metadata indexes. Build on EP02's session state types while adding baseline and learning storage capabilities.

---

## Technical Context

| Aspect | Value |
|--------|-------|
| **Language/Version** | TypeScript 5.x |
| **Primary Dependencies** | Bun:sqlite, zod (validation) |
| **Storage** | JSON files + SQLite metadata indexes |
| **Testing Framework** | Bun test (Vitest-compatible) |
| **Target Platform** | CLI, Bun runtime |
| **Project Type** | Foundation Library (internal) |
| **Performance Goals** | < 2s query (50 baselines), < 100ms checkpoint |
| **Constraints** | Local-first (no external services), atomic writes |
| **Scale/Scope** | Single developer, single project |

---

## Constitution Check

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Local-First | ✅ | All storage in `.agentlint/` and `~/.agentlint/` directories. No network calls. |
| II | Improvement-Oriented | ✅ | Baselines enable before/after comparison. Session state enables continuity. |
| III | Causal-First | ✅ | Findings stored with origin metadata. Learnings track source project/session. |
| IV | Mixed-Methods | ✅ | Storage layer is method-agnostic. Supports quantitative metrics and qualitative learnings. |
| V | Language-Agnostic | ✅ | Storage format independent of analyzed project language. |
| VI | Agent-Agnostic | ✅ | Baseline schema includes `actType` field for any ACT adapter. |
| VII | Intelligent Tooling | ✅ | Provides data capabilities (save/load/query). Agent decides when to use. |
| VIII | Compounding Value | ✅ | Global learnings transfer across projects. Baselines accumulate history. |
| IX | Agent-Aware | ✅ | JSON structures optimized for agent consumption. Schema versioning for evolution. |

**Gate Status**: [✅] All principles pass

---

## Project Structure

### Documentation Structure

```
specs/ep03-persistence-layer/
├── spec.md           # Feature specification
├── plan.md           # This file
├── research.md       # Research findings (Phase 1)
├── data-model.md     # Entity definitions (Phase 2)
├── quickstart.md     # Usage guide (Phase 2)
├── contracts/        # API definitions (Phase 2)
│   └── interfaces.ts # TypeScript interfaces
└── checklists/       # Validation checklists
    ├── requirements.md
    └── design.md
```

### Source Code Structure (Proposed)

```
src/
├── persistence/              # EP03 - This epic
│   ├── index.ts              # Public exports
│   ├── types.ts              # Persistence-specific types
│   ├── baselines/
│   │   ├── storage.ts        # Baseline file operations
│   │   ├── index.ts          # SQLite index operations
│   │   └── queries.ts        # Query functions
│   ├── learnings/
│   │   ├── storage.ts        # Learning file operations
│   │   └── index.ts          # SQLite index operations
│   ├── sessions/
│   │   └── storage.ts        # Session state file operations
│   └── common/
│       ├── atomic-write.ts   # Temp file + rename pattern
│       ├── directories.ts    # Directory initialization
│       └── database.ts       # SQLite helpers (WAL mode)
├── orchestration/            # EP02 (existing)
│   ├── session-state.ts      # Will import from persistence
│   └── ...
└── ...
```

---

## Complexity Tracking

> No constitution violations required.

| Principle | Violation | Justification | Mitigation |
|-----------|-----------|---------------|------------|
| — | None | N/A | N/A |

---

## Key Design Decisions

| Decision | Choice | Rationale | ADR |
|----------|--------|-----------|-----|
| Storage format | JSON + SQLite index | Human-readable files, fast queries | ADR-0008 |
| Atomic writes | Temp file + rename | Crash safety without transactions | ADR-0008 |
| Learning format | Markdown + YAML frontmatter | Human-editable, structured metadata | ADR-0009 |
| Session state | JSON with SDK session ID | Correlate with SDK conversation | ADR-0010 |
| Schema evolution | Version field + best-effort | Simple, forward-compatible | Clarified in spec |
| DB scope | Separate per location | Clean isolation, query both | Clarified in spec |

---

## Integration Points

### With EP02 (Orchestration Core)

| Component | Integration |
|-----------|-------------|
| `SessionState` | EP03 provides `saveState()` / `loadState()` that EP02's `CheckpointHandler` calls |
| `Finding` | EP03 stores findings from session state |
| `ToolResultCache` | EP03 persists tool results for resume |

### With Future Epics

| Epic | Dependency |
|------|------------|
| EP06 | Adds FTS5 session log indexing on top of storage layer |
| EP09 | Uses baseline queries for trend analysis |
| EP10 | Adds recommendation storage schema |
| EP12 | Adds sqlite-vec for semantic learning search |

---

## References

- **Spec**: [specs/ep03-persistence-layer/spec.md](./spec.md)
- **Epic**: [EP03 - Persistence Layer](../../docs/planning/epics/EP03-persistence-layer.md)
- **Arc42**: [§5 Building Blocks - Persistence Layer](../../docs/architecture/arc42/05-building-blocks.md)
- **ADRs**:
  - [ADR-0008: Baseline Storage](../../docs/architecture/adr/0008-baseline-storage-format-and-strategy.md)
  - [ADR-0009: Global Learnings](../../docs/architecture/adr/0009-global-learnings-storage-and-transfer.md)
  - [ADR-0010: Session State](../../docs/architecture/adr/0010-session-state-and-checkpointing.md)

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-16 | Claude | Initial plan |
