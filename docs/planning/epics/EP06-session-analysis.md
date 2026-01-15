# EP06: Session Analysis Tools

> Implement tools for AI session log discovery, metrics extraction, and full-text search with FTS5.

## Classification

| Attribute | Value |
|-----------|-------|
| **Type** | Business |
| **Priority** | P1-High |
| **Size** | L |
| **Estimated Duration** | 6 weeks |
| **Target Stories** | 10-12 stories |

## Business Outcome Hypothesis

**If** we implement robust session log analysis with FTS5 search and metrics extraction,
**Then** developers can understand AI session patterns and the agent can trace issues to origins,
**Measured by** accurate metrics extraction and <2s search queries across session history.

## Scope Definition

### In Scope

- [ ] Implement session log discovery (Claude Code: `~/.claude/projects/`)
- [ ] Parse JSONL session format (messages, tool_calls, tool_results)
- [ ] Extract session metadata (timestamps, project, duration)
- [ ] Calculate token usage metrics (input, output, total, per-turn)
- [ ] Count iterations/turns per task
- [ ] Categorize tool usage distribution
- [ ] Detect tool errors and retry patterns
- [ ] Identify compression triggers
- [ ] Calculate efficiency ratios
- [ ] Implement SQLite FTS5 indexing with BM25 ranking
- [ ] Create `search_sessions` tool for semantic search
- [ ] Create `get_session_stats` tool for metrics queries
- [ ] Index sessions with position markers for agent reference

### Out of Scope

- Session quality assessment (agentic layer - EP07)
- Causal chain reasoning (EP07)
- Recommendation generation (EP10)
- Non-Claude Code session formats (EP08 provides adapters)

### Minimum Viable Product (MVP)

The minimum deliverable that proves the hypothesis:

- Discover and parse Claude Code session logs
- Extract basic metrics (token count, turn count)
- FTS5 search returns relevant sessions

**MVP validates:** Session parsing and search work before adding advanced analysis

## Arc42 Traceability

| Source | References |
|--------|------------|
| **Building Blocks** | Tool Layer (Search), Integration Layer (SQLite) |
| **Runtime Scenarios** | 6.1 Full Analysis (search_sessions), 6.2 Causal Tracing |
| **Quality Requirements** | QS-6 (<2s query time for 50 baselines) |
| **Crosscutting Concepts** | 8.4 Context Management (session summaries, not raw logs) |
| **ADRs** | ADR-0005 (Tool Definition), ADR-0006 (Session Log Processing) |

## Requirements Traceability

| Source | References |
|--------|------------|
| **Personas** | Persona 0 (Agent - indexed sessions), Persona 3 (Vibe Coder - iteration costs) |
| **Use Cases** | UC-003 (Analyse Sessions), FR-4 (AI Session Log Analysis) |
| **Requirements** | FR-4.1 (Session Discovery), FR-4.2 (Metrics Extraction), NFR-1.1 (Static Analysis) |

## Dependencies

### Blocked By (Cannot Start Without)

| Epic | Dependency Type | What's Needed |
|------|-----------------|---------------|
| EP01 | Hard | Bun:sqlite, project structure |
| EP02 | Hard | Tool registration mechanism |
| EP03 | Hard | SQLite database infrastructure, sessions.db |

### Blocks (Other Epics Waiting On This)

| Epic | Dependency Type | What This Provides |
|------|-----------------|-------------------|
| EP07 | Hard | Session search for evidence collection |
| EP10 | Soft | Session metrics for recommendations |
| EP11 | Soft | Session data for evaluation |

### External Dependencies

| System/Team | Dependency | Status |
|-------------|------------|--------|
| Bun:sqlite | FTS5 support | Available |
| Claude Code session logs | `~/.claude/projects/` | User-dependent |

## Technical Considerations

### Key Decisions

- FTS5 with BM25 ranking for relevance scoring (per ADR-0006)
- Create session summaries for agent, not raw log ingestion
- Position markers enable agent to reference specific locations
- Incremental indexing for unchanged logs

### Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Large session logs (500MB+) | Medium | High | Streaming parser, chunked processing |
| FTS5 performance degradation | Low | Medium | Index optimization, benchmark testing |
| Session log format changes | Medium | Medium | Adapter layer isolates format-specific logic |

### Spikes Needed

- [ ] Benchmark FTS5 with realistic session volumes
- [ ] Test streaming parser with large JSONL files
- [ ] Verify BM25 ranking quality

### Constitution Alignment

- **VII. Intelligent Tooling**: Tools provide what (metrics), agent reasons why
- **III. Causal-First**: Session indexing supports origin tracing
- **IV. Mixed-Methods**: Quantitative metrics + searchable content

## Acceptance Criteria (High-Level)

### Functional

- [ ] Discover Claude Code session logs in `~/.claude/projects/`
- [ ] Parse JSONL format correctly
- [ ] Extract: token usage, turn count, tool distribution, errors
- [ ] FTS5 index created for session content
- [ ] `search_sessions` returns ranked results with snippets
- [ ] `get_session_stats` returns aggregated metrics
- [ ] Position markers enable agent to cite specific locations
- [ ] Incremental indexing skips unchanged logs

### Non-Functional

- [ ] Handle session logs up to 500MB
- [ ] Search query < 2 seconds
- [ ] Indexing parallelizable across sessions

### Definition of Done

- [ ] All acceptance criteria pass
- [ ] Code reviewed and merged
- [ ] Tests written and passing (unit, integration)
- [ ] Documentation updated (tool reference)
- [ ] Deployed to staging environment
- [ ] Product owner sign-off

## Speckit Handoff Notes

> Guidance for `/speckit.specify` phase

### Primary Focus

- **Persona**: Persona 3 (Vibe Coder) - understand iteration costs
- **Workflow**: Index sessions → search → extract metrics → provide summaries
- **Outcome**: Fast, accurate session analysis

### Constraints to Encode

From ADRs:
- ADR-0006: SQLite FTS5 with BM25, position markers
- ADR-0005: Tool definitions with Zod schemas

From Constitution:
- VII. Intelligent Tooling: Tools gather, agent reasons
- III. Causal-First: Enable origin tracing

### Key Scenarios to Specify

1. Index 100 session logs
2. Search for "API key" across sessions
3. Get token efficiency metrics for last 30 days
4. Handle corrupted/incomplete session log

### Tech Stack Notes (for `/speckit.plan`)

- Bun:sqlite with FTS5
- Streaming JSON parser for large files
- Zod for output schemas

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-01-15 | Arc42 Decomposer | Initial creation from Arc42 |
