# Design Checklist: Skills Effectiveness Analysis

> **Epic**: EP14
> **Created**: 2026-01-24

---

## Constitution Compliance

- [x] **I. Local-First**: All data stored locally in SQLite
- [x] **II. Improvement-Oriented**: Skills metrics tracked in baselines
- [x] **III. Causal-First**: Traces non-invocation to discovery issues
- [x] **IV. Mixed-Methods**: Quantitative (counts) + qualitative (agent analysis)
- [x] **V. Language-Agnostic**: Skills analysis independent of project language
- [x] **VI. Agent-Agnostic**: Uses cross-platform Skills standard
- [x] **VII. Intelligent Tooling**: Tools provide data; agent reasons
- [x] **VIII. Compounding Value**: Better descriptions improve future sessions
- [x] **IX. Agent-Aware**: Tool output structured for agent consumption

---

## Agentic Design Validation

### Tool/Agent Boundary (CRITICAL)

- [x] No tool returns judgments ("low", "bad", "missed")
- [x] No tool encodes thresholds (if X > 5 then Y)
- [x] No tool prescribes when to use other tools
- [x] No tool implements detection logic requiring judgment
- [x] Tool descriptions explain capabilities, not orchestration

### Data Design

- [x] Entities represent facts (invocations, sessions, skills)
- [x] No stored detection results or computed judgments
- [x] No `missed_opportunities` table
- [x] No `effectiveness_scores` column
- [x] Schema stores raw data; agent interprets

### Tool Contracts

- [x] `get_skill_inventory` returns inventory data only
- [x] `get_skill_invocations` returns invocation records only
- [x] `get_session_summaries` returns session context only
- [x] `index_skill_invocations` returns indexing stats only
- [x] All results include `_rawData` for structured access

### Context Window Economics

- [x] Results are filtered/paginated (limit parameters)
- [x] User prompts truncated to 200-500 chars
- [x] No full session log dumps
- [x] Formatted text + structured `_rawData` pattern

---

## Architecture Compliance

### ADR Alignment

- [x] Extends ADR-0006 session log processing patterns
- [x] Follows ADR-0017 skill parsing approach
- [x] Uses ADR-0005 tool definition pattern
- [x] Consistent with ADR-0007 config adapter pattern

### Code Patterns

- [x] Follows `src/tools/sessions/*-tool.ts` structure
- [x] Uses `tool()` from `@anthropic-ai/claude-agent-sdk`
- [x] Zod schemas for input validation
- [x] Error handling returns `isError: true`

### Testing Strategy

- [x] Unit tests verify tool data returns (not judgments)
- [x] Integration tests verify data flow
- [x] Evaluations test agent reasoning quality
- [x] No tests for detection logic (agent reasoning)

---

## Spec Alignment

### User Stories Coverage

- [x] US-001: View invocation summary → `get_skill_inventory` + `get_skill_invocations`
- [x] US-002: Identify missed opportunities → `get_session_summaries` + agent reasoning
- [x] US-003: Analyze description mismatch → agent semantic analysis
- [x] US-004: Suggest improvements → agent generates from analysis
- [x] US-005: Query invocation data → `get_skill_invocations` with filters
- [x] US-006: Integration in main flow → Tool registry + CLI flag
- [x] US-007: CLI skills command → `agentlint skills`

### Functional Requirements

- [x] FR-001: Detect Skill invocations via `tool_use.name === "Skill"`
- [x] FR-002: Extract skill command from `input.skill`
- [x] FR-003: Build per-skill invocation index
- [x] FR-004: Store in SQLite
- [x] FR-005: Enumerate skills from `.claude/skills/`
- [x] FR-006: Parse skill frontmatter
- [x] FR-007-010: Implement four data access tools

### Non-Functional Requirements

- [x] NFR-001: > 100 sessions/sec indexing
- [x] NFR-002: < 500ms query time
- [x] NFR-004: < 200MB memory during indexing
- [x] NFR-005: < 10% storage overhead
- [x] NFR-006: > 80% test coverage

---

## Anti-Pattern Avoidance

| Anti-Pattern | Status | Evidence |
|--------------|--------|----------|
| Tool makes judgment | ✓ Avoided | No "status" field, no "is_low" boolean |
| Hardcoded threshold | ✓ Avoided | No numeric comparisons in tool logic |
| Detection function | ✓ Avoided | No `detectMissedOpportunities()` |
| Orchestration logic | ✓ Avoided | No "when X then use tool Y" |
| Stored recommendations | ✓ Avoided | No recommendations in database |

---

## Readiness Assessment

| Criterion | Status |
|-----------|--------|
| Constitution compliance | ✓ Complete |
| Agentic design validation | ✓ Complete |
| Architecture alignment | ✓ Complete |
| Spec coverage | ✓ Complete |
| Anti-patterns avoided | ✓ Complete |

**Assessment**: Ready for task generation (`/dev.tasks`)
