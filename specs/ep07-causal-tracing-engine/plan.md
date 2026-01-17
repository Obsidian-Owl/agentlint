# Implementation Plan: Causal Tracing Engine

> **Epic**: EP07
> **Spec**: specs/ep07-causal-tracing-engine/spec.md
> **Created**: 2026-01-17
> **Status**: Design Complete
> **Author**: Claude

---

## Summary

**Primary Requirement**: Implement a causal tracing engine that traces detected issues to their origin (session prompts, configuration gaps, git commits) and generates evidence chains for preventive recommendations.

**Technical Approach**: Build a tool-first system where causal tracing tools query persisted chains from SQLite (via EP06 session database extension). The agent invokes tools to retrieve pre-computed chains rather than re-deriving causality each session. Pattern detection leverages the existing FTS5 index for cross-session correlation.

---

## Technical Context

> Fill in project-specific values. Mark unknowns as `[NEEDS CLARIFICATION]`.

| Aspect | Value |
|--------|-------|
| **Language/Version** | TypeScript 5.x (strict mode) |
| **Primary Dependencies** | Bun runtime, bun:sqlite, Zod, @anthropic-ai/claude-agent-sdk |
| **Storage** | SQLite (extend ~/.agentlint/sessions.db with causal chain tables) |
| **Testing Framework** | Bun test (vitest-compatible API) |
| **Target Platform** | CLI (Node.js 20+ / Bun) |
| **Project Type** | Tool layer for agentlint CLI |
| **Performance Goals** | < 5s single-issue trace, < 200MB memory, ≥100 sessions for patterns |
| **Constraints** | Local-first, no external services, extends EP06 database |
| **Scale/Scope** | Single developer, multi-project, cross-session analysis |

---

## Constitution Check

> Validate against project constitution at `.specify/memory/constitution.md`

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Local-First | ✓ | All chains stored in local SQLite; no external calls |
| II | Improvement-Oriented | ✓ | Pattern detection tracks recurring issues over time |
| III | Causal-First | ✓ | **Core principle** - this epic implements TRACE & UNDERSTAND |
| IV | Mixed-Methods | ✓ | Static tools + agent reasoning for gap analysis |
| V | Language-Agnostic | ✓ | Session/config analysis independent of project language |
| VI | Agent-Agnostic | ✓ | Uses ACT adapter types from EP08; core is adapter-independent |
| VII | Intelligent Tooling | ✓ | Tools provide data; agent reasons about causality |
| VIII | Compounding Value | ✓ | Chains persist; patterns accumulate across sessions |
| IX | Agent-Aware | ✓ | Tools structured for agent consumption (JSON schemas) |

**Gate Status**: [x] All principles pass

---

## Project Structure

### Documentation Structure

```
specs/ep07-causal-tracing-engine/
├── spec.md           # Feature specification ✓
├── plan.md           # This file
├── research.md       # Research findings (Phase 1)
├── data-model.md     # Entity definitions (Phase 2)
├── quickstart.md     # Usage guide (Phase 2)
├── contracts/        # API definitions (Phase 2)
│   └── types.ts      # Zod schemas for causal chain types
└── checklists/       # Validation checklists
    └── requirements.md ✓
```

### Source Code Structure (Proposed)

```
src/
├── tools/
│   └── causal/                   # NEW: Causal tracing tools
│       ├── index.ts              # Public exports
│       ├── types.ts              # CausalChain, EvidenceItem, etc.
│       ├── schemas.ts            # Zod validation schemas
│       ├── trace-issue-tool.ts   # trace_issue_origin SDK tool
│       ├── get-patterns-tool.ts  # get_issue_patterns SDK tool
│       ├── chain-builder.ts      # Evidence chain construction
│       ├── confidence.ts         # Confidence scoring logic
│       └── pattern-detector.ts   # Cross-session pattern detection
├── persistence/
│   └── causal/                   # NEW: Causal chain persistence
│       ├── index.ts              # Public exports
│       ├── schema.ts             # SQLite schema for chains
│       └── queries.ts            # CRUD operations for chains
└── ...
```

---

## Complexity Tracking

> Only add rows if constitution principles require justified violations

| Principle | Violation | Justification | Mitigation |
|-----------|-----------|---------------|------------|
| - | None | - | - |

---

## Key Design Decisions

| Decision | Choice | Rationale | ADR |
|----------|--------|-----------|-----|
| Chain storage | Extend EP06 SQLite database | Reuse existing infrastructure; chains relate to sessions | ADR-0006 (extended) |
| Tool-first API | SDK `tool()` definitions | Agent efficiency per clarification; pre-computed chains | ADR-0005 |
| Pattern detection | FTS5 index only | Per clarification Q3; fast, consistent with EP06 | - |
| Chain depth limit | Max 5 steps | Per clarification Q2; sufficient for 95% cases | - |
| Confidence scoring | 6-factor checklist | Per spec US-006; explicit validation | - |

---

## Architecture Overview

### Two-Layer Design (per ADR-0016)

```
┌─────────────────────────────────────────────────────────────┐
│                    Orchestrator (EP02)                      │
│                   Agent reasoning layer                     │
└───────────────────────────┬─────────────────────────────────┘
                            │ invokes
┌───────────────────────────▼─────────────────────────────────┐
│                    Causal Tracing Tools                     │
│  trace_issue_origin    get_issue_patterns    get_chain     │
└───────────────────────────┬─────────────────────────────────┘
                            │ queries
┌───────────────────────────▼─────────────────────────────────┐
│                 Persistence Layer (SQLite)                  │
│  causal_chains  │  evidence_items  │  issue_patterns       │
│  (extends ~/.agentlint/sessions.db)                        │
└─────────────────────────────────────────────────────────────┘
                            │ searches
┌───────────────────────────▼─────────────────────────────────┐
│               EP06 Session Index (FTS5)                     │
│  session_entries  │  sessions  │  session_tools            │
└─────────────────────────────────────────────────────────────┘
```

### Tool Flow

1. **Agent detects issue** (via EP05 config analysis or EP06 session metrics)
2. **Agent invokes `trace_issue_origin`** with issue details
3. **Tool searches** FTS5 index for related session prompts
4. **Tool queries** git (if available) for commit correlation
5. **Tool constructs** evidence chain with confidence score
6. **Tool persists** chain to SQLite for pattern detection
7. **Tool returns** structured chain JSON to agent
8. **Agent reasons** about counterfactual and recommendations

---

## Integration Points

### EP06 Session Analysis (Hard Dependency)

- **Uses**: `session_entries` FTS5 table for session search
- **Uses**: `sessions` table for session metadata
- **Extends**: Same SQLite database with new tables

### EP03 Persistence Layer (Hard Dependency)

- **Coordination**: Schema additions for `causal_chains`, `evidence_items`, `issue_patterns`
- **Pattern**: Follow `persistence/sessions/fts.ts` for schema management

### EP05 Config Analysis (Soft Dependency)

- **Input**: Structured issue output with IDs for tracing
- **Fallback**: Can trace without config gaps; marks as partial

### EP02 Orchestration Core (Hard Dependency)

- **Registers**: Tools via `ToolRegistry.register()`
- **Uses**: `Finding`, `Origin`, `Recommendation` types

---

## References

- **Spec**: [specs/ep07-causal-tracing-engine/spec.md](./spec.md)
- **Epic**: [EP07 Causal Tracing Engine](../../docs/planning/epics/EP07-causal-tracing.md)
- **Arc42**: [Section 6.2: Causal Tracing Scenario](../../docs/architecture/arc42/06-runtime-scenarios.md)
- **ADRs**:
  - [ADR-0005: Tool Definitions](../../docs/architecture/adr/ADR-0005-tool-definitions.md)
  - [ADR-0006: Session Storage Schema](../../docs/architecture/adr/ADR-0006-session-storage-schema.md)

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-17 | Claude | Initial plan |
