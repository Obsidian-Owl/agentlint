# Implementation Plan: Session Analysis Tools

> **Epic**: EP06
> **Spec**: specs/ep06-session-analysis/spec.md
> **Created**: 2026-01-17
> **Status**: Design Complete
> **Author**: Claude

---

## Summary

**Primary Requirement**: Implement `search_sessions` and `get_session_stats` tools that enable the agent to discover Claude Code session logs, extract metrics, and perform full-text search with BM25 relevance ranking for causal tracing.

**Technical Approach**: Build an FTS5-indexed SQLite database from Claude Code JSONL session logs at `~/.claude/projects/`. The tools provide search with relevance ranking, metrics extraction using actual token counts from logs, and position markers (file:line) for causal reference. Streaming JSONL parsing keeps memory under 100MB for large corpora.

---

## Technical Context

| Aspect | Value |
|--------|-------|
| **Language/Version** | TypeScript 5.x (Bun runtime) |
| **Primary Dependencies** | `bun:sqlite` (FTS5), `@anthropic-ai/claude-agent-sdk`, `zod` |
| **Storage** | SQLite FTS5 at `.agentlint/sessions.db` per ADR-0006 |
| **Testing Framework** | Bun test (vitest-compatible API) |
| **Target Platform** | CLI Tool (local-first) |
| **Project Type** | Agent Tools (MCP integration) |
| **Performance Goals** | < 2s search on 500MB corpus, < 60s indexing for 500MB, < 100MB memory |
| **Constraints** | Local-first (no network), Claude Code session log format only (v1) |
| **Scale/Scope** | Single developer, 100s of MB session logs |

---

## Constitution Check

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Local-First | ✅ | All processing on user's machine; SQLite stored locally in `.agentlint/`; session logs read from `~/.claude/projects/` |
| II | Improvement-Oriented | ✅ | Enables historical session analysis; baseline tracking via metrics over time |
| III | Causal-First | ✅ | Position markers (file:line) enable tracing issues to exact session moments; BM25 ranking surfaces most relevant results |
| IV | Mixed-Methods | ✅ | Quantitative (token counts, turn metrics) + qualitative (content search, error patterns) |
| V | Language-Agnostic | ✅ | Session logs are language-independent; analyzes AI interactions not source code |
| VI | Agent-Agnostic | ✅ | Claude Code adapter pattern (EP08 provides interface for other agents) |
| VII | Intelligent Tooling | ✅ | Tools provide data; agent reasons about findings; search returns ranked results not prescriptions |
| VIII | Compounding Value | ✅ | Historical index enables trend analysis; metrics improve with usage history |
| IX | Agent-Aware | ✅ | Search results include snippets and relevance scores for agent consumption; summaries not raw logs |

**Gate Status**: [x] All principles pass

---

## Project Structure

### Documentation Structure

```
specs/ep06-session-analysis/
├── spec.md           # Feature specification (complete)
├── plan.md           # This file
├── research.md       # Research findings (Phase 1)
├── data-model.md     # Entity definitions (Phase 2)
├── quickstart.md     # Usage guide (Phase 2)
├── contracts/        # API definitions (Phase 2)
│   └── interfaces.ts # TypeScript interfaces
└── checklists/
    ├── requirements.md  # Requirements checklist (complete)
    └── design.md        # Design checklist (Phase 2)
```

### Source Code Structure (Proposed)

```
src/
├── tools/
│   └── sessions/           # EP06: Session Analysis Tools
│       ├── index.ts        # Public exports
│       ├── types.ts        # Type definitions
│       ├── discovery.ts    # Session log discovery (FR-001)
│       ├── parser.ts       # JSONL parsing with streaming (FR-002, FR-018)
│       ├── metrics.ts      # Metrics extraction (FR-003-010)
│       ├── indexer.ts      # FTS5 indexing (FR-011, FR-016)
│       ├── search.ts       # Search implementation (FR-012, FR-014, FR-020)
│       ├── stats.ts        # Statistics aggregation (FR-013)
│       ├── watcher.ts      # File watcher (FR-017, P3)
│       ├── search-sessions-tool.ts  # SDK tool definition
│       └── get-session-stats-tool.ts # SDK tool definition
├── persistence/
│   └── sessions/           # Existing from EP03
│       └── fts.ts          # FTS5 database operations (new)
└── errors/
    └── sessions.ts         # Session-specific errors (new)
```

---

## Complexity Tracking

> No constitution violations identified

| Principle | Violation | Justification | Mitigation |
|-----------|-----------|---------------|------------|
| - | None | - | - |

---

## Key Design Decisions

| Decision | Choice | Rationale | ADR |
|----------|--------|-----------|-----|
| Full-text search engine | SQLite FTS5 | BM25 ranking, no dependencies (bun:sqlite), proven technology | ADR-0006 |
| Session log location | `~/.claude/projects/` | Claude Code standard location | ADR-0006 |
| Index storage | `.agentlint/sessions.db` | Consistent with persistence layer | ADR-0006 |
| Path encoding | Dash replacement | Direct observation: `/` → `-` in directory names | Spec §10.1 |
| Token counts | Use actual values | Available in `message.usage` (no estimation needed) | Spec §10.3 |
| Date filtering | Include in v1 | User-confirmed; added FR-021 | Spec §10.4 |
| Tool pattern | SDK `tool()` | Consistent with EP05 config tools | ADR-0005 |
| Streaming parser | Line-by-line | Memory efficiency for 500MB+ logs | NFR-003, NFR-004 |

---

## References

- **Spec**: [specs/ep06-session-analysis/spec.md](./spec.md)
- **Epic**: [EP06 Session Analysis Tools](../../docs/planning/epics/EP06-session-analysis.md)
- **Arc42**: [§5 Building Blocks - Tool Layer](../../docs/architecture/arc42/05-building-blocks.md)
- **ADRs**:
  - [ADR-0006 Session Log Processing Architecture](../../docs/architecture/adr/0006-session-log-processing-architecture.md)
  - [ADR-0005 Tool Definition and Invocation Pattern](../../docs/architecture/adr/0005-tool-definition-and-invocation-pattern.md)

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-17 | Claude | Initial plan |
