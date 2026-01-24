# Implementation Plan: Session Intelligence

> **Epic**: EP15
> **Spec**: specs/ep15-session-intelligence/spec.md
> **Created**: 2026-01-24
> **Status**: Design Complete
> **Author**: Claude (via /dev.plan)

---

## Summary

**Primary Requirement**: Enable agentlint to understand what happened in sessions and why—producing narrative understanding rather than raw metrics.

**Technical Approach**: Build data extraction tools that process session logs into structured event data (tool sequences, file accesses, compressions, delegations, MCP calls, quality signals), then provide a Session Analyst subagent that incrementally requests this data to construct session narratives and insights.

---

## Technical Context

| Aspect | Value |
|--------|-------|
| **Language/Version** | TypeScript 5.x (Bun runtime) |
| **Primary Dependencies** | Claude Agent SDK (@anthropic-ai/claude-agent-sdk), Zod, bun:sqlite |
| **Storage** | SQLite (extends existing sessions.db at ~/.agentlint/sessions.db) |
| **Testing Framework** | Bun test |
| **Target Platform** | CLI (agentlint analyse) |
| **Project Type** | CLI Tool with SDK subagent |
| **Performance Goals** | < 500ms query response (NFR-002), > 50 sessions/sec indexing (NFR-001), < 50K tokens per analysis (NFR-003) |
| **Constraints** | Local-first (Constitution I), No hardcoded thresholds (Constitution VII), Single subagent depth (C8) |
| **Scale/Scope** | Single developer analyzing their own session history |

---

## Constitution Check

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Local-First | ✓ | All analysis on user's machine, extends local sessions.db |
| II | Improvement-Oriented | ✓ | Session understanding enables learning from effective patterns |
| III | Causal-First | ✓ | Timeline events traced to source file:line via existing FTS5 infrastructure |
| IV | Mixed-Methods | ✓ | Quantitative (token counts, tool sequences) + qualitative (agent narrative reasoning) |
| V | Language-Agnostic | ✓ | Session analysis independent of analyzed project language |
| VI | Agent-Agnostic | ✓ | Claude Code adapter; MCP parsing via configurable prefix |
| VII | Intelligent Tooling | ✓ | Tools return data (sequences, counts, events); subagent provides judgment (phase detection, quality assessment) |
| VIII | Compounding Value | ✓ | Session narratives enable pattern learning across time |
| IX | Agent-Aware | ✓ | Subagent design with incremental data access, ~50K token budget |

**Gate Status**: [x] All principles pass

---

## Architecture Overview

### Subagent Pattern (Per Existing Codebase)

Following the established patterns from `temporal-subagent.ts` and `recommendation-advisor.ts`:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Main Orchestrator                            │
│  (agentlint analyse with --session flag or session subcommand)  │
└───────────────────────────┬─────────────────────────────────────┘
                            │ spawn_session_analyst tool
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Session Analyst Subagent                       │
│  - Has access to EP15 session intelligence tools                │
│  - NO Task tool (depth=1 constraint per C8)                     │
│  - Produces narrative + issues + recommendations                │
└───────────────────────────┬─────────────────────────────────────┘
                            │ tool calls
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Session Intelligence Tools                      │
│  - get_session_timeline (metadata + intent + outcome)           │
│  - get_tool_sequences (tool calls with hashes)                  │
│  - get_file_accesses (per-file operation counts)                │
│  - get_compression_events (pre-tokens, summaries)               │
│  - get_delegation_events (Task tool invocations)                │
│  - get_mcp_usage (per-server call/error counts)                 │
│  - get_quality_signals (test/build output patterns)             │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Session JSONL Files (existing)
         │
         ▼
┌─────────────────────┐
│  Session Indexer    │ ← Extends existing indexer
│  (EP06 foundation)  │
└─────────┬───────────┘
          │ Extract new data types
          ▼
┌─────────────────────────────────────────────────────────────────┐
│  sessions.db (extended)                                          │
│  ├─ sessions (existing)                                         │
│  ├─ session_entries (FTS5, existing)                            │
│  ├─ session_tools (existing)                                    │
│  ├─ skill_invocations (EP14)                                    │
│  ├─ tool_call_sequences (NEW - EP15)                            │
│  ├─ file_accesses (NEW - EP15)                                  │
│  ├─ compression_events (NEW - EP15)                             │
│  ├─ delegation_events (NEW - EP15)                              │
│  ├─ mcp_tool_calls (NEW - EP15)                                 │
│  └─ quality_signals (NEW - EP15)                                │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────┐
│  Query Tools        │ ← New EP15 tools
│  (SDK tool pattern) │
└─────────┬───────────┘
          │ Filtered, paginated results
          ▼
┌─────────────────────┐
│  Session Analyst    │ ← New EP15 subagent
│  Subagent           │
└─────────┬───────────┘
          │ Narrative understanding
          ▼
     User Output
```

### Incremental Analysis Pattern (Per C1 Clarification)

The subagent doesn't request all data upfront. Instead:

1. **Phase 1: Metadata** - Request session overview (timestamps, turn count, intent)
2. **Phase 2: Flow Understanding** - Request tool sequences in chunks
3. **Phase 3: Issue Detection** - Request error clusters, compression events
4. **Phase 4: Quality Assessment** - Request quality signals, MCP usage
5. **Phase 5: Synthesis** - Combine into narrative

This keeps each request under context budget while building complete understanding.

---

## Project Structure

### Documentation Structure

```
specs/ep15-session-intelligence/
├── spec.md           # Feature specification (complete)
├── plan.md           # This file
├── research.md       # Research findings
├── data-model.md     # Entity definitions
├── quickstart.md     # Usage guide
├── contracts/        # TypeScript interfaces
│   └── interfaces.ts
└── checklists/
    ├── requirements.md  # Complete
    └── design.md        # To be created
```

### Source Code Structure (Proposed)

```
src/
├── sessions/                    # EP15 Session Intelligence
│   ├── index.ts                 # Public exports
│   ├── types.ts                 # Type definitions
│   ├── schemas.ts               # Zod validation schemas
│   ├── extraction/              # Data extraction from session logs
│   │   ├── index.ts
│   │   ├── timeline.ts          # Timeline/intent extraction
│   │   ├── tool-sequences.ts    # Tool call sequence extraction
│   │   ├── file-accesses.ts     # File operation tracking
│   │   ├── compressions.ts      # Compression event extraction
│   │   ├── delegations.ts       # Task tool invocation extraction
│   │   ├── mcp-calls.ts         # MCP tool call extraction
│   │   └── quality-signals.ts   # Test/build output detection
│   ├── storage/                 # Database schema + queries
│   │   ├── index.ts
│   │   ├── schema.ts            # New table definitions
│   │   └── queries.ts           # SQL query helpers
│   ├── tools/                   # SDK tool definitions
│   │   ├── index.ts
│   │   ├── get-session-timeline-tool.ts
│   │   ├── get-tool-sequences-tool.ts
│   │   ├── get-file-accesses-tool.ts
│   │   ├── get-compression-events-tool.ts
│   │   ├── get-delegation-events-tool.ts
│   │   ├── get-mcp-usage-tool.ts
│   │   ├── get-quality-signals-tool.ts
│   │   ├── index-session-intelligence-tool.ts
│   │   └── spawn-session-analyst.ts
│   └── subagent/               # Session Analyst subagent
│       ├── index.ts
│       ├── session-analyst.ts   # AgentDefinition + prompt
│       └── types.ts
├── tools/
│   └── index.ts                 # Add EP15 tool registration
└── orchestration/
    └── orchestrator.ts          # Add EP15 subagent to buildACTSubagents()
```

---

## Key Design Decisions

| Decision | Choice | Rationale | ADR |
|----------|--------|-----------|-----|
| Subagent architecture | Explicit spawn tool pattern | Matches temporal-analyzer, recommendation-advisor patterns | ADR-0005 |
| Data storage | Extend sessions.db | Consistent with ADR-0006, enables joins with existing data | ADR-0006 |
| Phase detection | Agent-reasoned (C3) | Constitution VII - tools provide data, agent provides judgment | N/A |
| Test output parsing | Agent interprets raw (C2) | Constitution VII - no framework-specific parsers | N/A |
| Incremental analysis | Phase-by-phase (C1) | AX context window economics, ~50K token budget | N/A |
| MCP server detection | Parse `mcp__` prefix | Deterministic, matches Claude Code convention | N/A |
| Tool call hashing | SHA-256 of input JSON | Enables "stuck" pattern detection without full content | N/A |
| Depth constraint | No Task tool in subagent | Constitution C8 - single subagent depth | N/A |

---

## Implementation Phases

### Phase 1: Schema & Extraction Foundation

**Goal**: Extend database schema and create extraction functions

1. Database schema extension (6 new tables)
2. Tool sequence extraction function
3. File access extraction function
4. Compression event extraction function
5. Indexer integration (extend existing EP06 indexer)

**Deliverables**: Schema migration, extraction functions, updated indexer

### Phase 2: Query Tools

**Goal**: Create SDK tools for querying extracted data

1. `get_session_timeline` tool
2. `get_tool_sequences` tool
3. `get_file_accesses` tool
4. `get_compression_events` tool
5. Tool registration in orchestration

**Deliverables**: 4 working tools with tests

### Phase 3: Advanced Extraction

**Goal**: Add delegation, MCP, and quality signal extraction

1. Delegation event extraction (Task tool calls)
2. MCP tool call extraction (mcp__ prefix parsing)
3. Quality signal extraction (test/build pattern detection)
4. `get_delegation_events` tool
5. `get_mcp_usage` tool
6. `get_quality_signals` tool

**Deliverables**: 3 more tools, complete extraction pipeline

### Phase 4: Session Analyst Subagent

**Goal**: Create the reasoning subagent

1. Session Analyst prompt (~7KB, 4-layer structure)
2. AgentDefinition with tool list (NO Task tool)
3. `spawn_session_analyst` tool
4. Builder functions (buildSessionAnalystAgent)
5. Subagent registration in orchestrator

**Deliverables**: Working subagent that produces session narratives

### Phase 5: CLI Integration

**Goal**: Expose via agentlint CLI

1. Add `--session` flag to `agentlint analyse`
2. Add session-specific subcommand (optional)
3. Integration tests
4. Documentation

**Deliverables**: User-accessible session intelligence

### Phase 6: P2 Features

**Goal**: Timeline visualization data + permission tracking

1. Phase marker extraction (FR-021)
2. Permission interaction extraction (FR-022)
3. Timeline data structure for EP17 TUI

**Deliverables**: P2 requirements complete

---

## Complexity Tracking

| Principle | Violation | Justification | Mitigation |
|-----------|-----------|---------------|------------|
| None | N/A | N/A | N/A |

---

## References

- **Spec**: [specs/ep15-session-intelligence/spec.md](./spec.md)
- **Epic**: [Linear Project: EP15](https://linear.app/obsidianowl/project/ep15-session-intelligence-91799dbb3244)
- **Arc42**: [§5 Building Blocks](../../docs/architecture/arc42/05-building-blocks.md)
- **ADRs**:
  - [ADR-0005: Tool Definition Pattern](../../docs/architecture/adr/0005-tool-definition-and-invocation-pattern.md)
  - [ADR-0006: Session Log Processing](../../docs/architecture/adr/0006-session-log-processing-architecture.md)
- **Existing Patterns**:
  - Temporal Analyzer: `src/temporal/subagent/temporal-subagent.ts`
  - Recommendation Advisor: `src/recommendations/subagent/recommendation-advisor.ts`
  - Spawn Tool: `src/temporal/tools/spawn-analyst.ts`

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-24 | Claude (via /dev.plan) | Initial plan |
