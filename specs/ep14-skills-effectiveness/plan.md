# Implementation Plan: Skills Effectiveness Analysis

> **Epic**: EP14
> **Spec**: specs/ep14-skills-effectiveness/spec.md
> **Created**: 2026-01-24
> **Status**: Design Complete
> **Author**: Claude Code

---

## Summary

**Primary Requirement**: Provide data access tools that enable the agentlint agent to analyze Skills effectiveness—whether Skills are being invoked, identify missed opportunities, and suggest description improvements for better auto-discovery.

**Technical Approach**: Build data extraction and indexing infrastructure that follows existing `src/tools/sessions/` patterns. Tools provide raw data (invocations, session summaries, skill inventory); the agent reasons about effectiveness, missed opportunities, and description improvements.

---

## Technical Context

| Aspect | Value |
|--------|-------|
| **Language/Version** | TypeScript 5.x |
| **Primary Dependencies** | @anthropic-ai/claude-agent-sdk, zod, bun:sqlite, fast-glob, yaml |
| **Storage** | SQLite (existing `.agentlint/sessions.db` per ADR-0006) |
| **Testing Framework** | Vitest (unit/integration), VCR + LLM-as-judge (evals) |
| **Target Platform** | CLI (Node.js 20+, Bun runtime) |
| **Project Type** | CLI Tool with Agent SDK integration |
| **Performance Goals** | < 500ms query time, > 100 sessions/sec indexing |
| **Constraints** | Local-first (Constitution I), no external services |
| **Scale/Scope** | Single developer, 100s of sessions |

---

## Constitution Check

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Local-First | ✓ | All data in local SQLite; no network calls except user-configured LLM |
| II | Improvement-Oriented | ✓ | Skills metrics tracked in baselines for trend analysis |
| III | Causal-First | ✓ | Agent traces non-invocation to discovery/description issues |
| IV | Mixed-Methods | ✓ | Quantitative (invocation counts) + qualitative (agent semantic analysis) |
| V | Language-Agnostic | ✓ | Skills analysis independent of project language |
| VI | Agent-Agnostic | ✓ | Skills is cross-platform standard; adapter pattern maintained |
| VII | Intelligent Tooling | ✓ | **CRITICAL**: Tools provide data; agent reasons about effectiveness |
| VIII | Compounding Value | ✓ | Better descriptions improve future sessions |
| IX | Agent-Aware | ✓ | Tool output structured for agent consumption |

**Gate Status**: [x] All principles pass

---

## Critical Design Principle: Agent-Driven Analysis

This is an **agentic application**. The fundamental design constraint per Constitution Principle VII:

| What Tools Do | What Agent Does |
|---------------|-----------------|
| Extract skill invocations from session logs | Decide if invocation rate is "low" or "high" |
| Provide session summaries (user prompt, files, skills used) | Identify missed opportunities |
| Return skill inventory with descriptions | Analyze description-phrasing mismatches |
| Store indexed data for efficient queries | Generate improvement suggestions |
| Filter/paginate results | Judge data sufficiency for trends |

**No detection logic in tools.** No thresholds. No "when X then Y" rules. The agent reasons.

---

## Data Access Tools Design

Per CLAUDE.md patterns and existing `src/tools/sessions/get-session-stats-tool.ts`:

### Tool 1: `get_skill_inventory`

**Purpose**: Enumerate skills from project with metadata

```typescript
// Returns data; agent interprets
interface SkillInventoryResult {
  skills: Array<{
    name: string;
    description: string;
    path: string;
    filePatterns: string[];  // Hints for agent, NOT programmatic rules
    contentSections: string[]; // Section headings for context
  }>;
  discoveryPath: string;
  skillCount: number;
}
```

**Parameters**: `{ projectPath?: string }`

**Agent uses for**: Understanding what skills exist and their stated purpose.

### Tool 2: `get_skill_invocations`

**Purpose**: Query indexed invocation data

```typescript
// Returns data; agent judges effectiveness
interface SkillInvocationsResult {
  invocations: Array<{
    skillName: string;
    sessionId: string;
    timestamp: string;
    userPromptSnippet: string;  // Truncated to ~200 chars
  }>;
  totalCount: number;
  uniqueSkills: number;
  sessionsQueried: number;
}
```

**Parameters**: `{ skillName?: string, sessionId?: string, since?: string, until?: string, limit?: number }`

**Agent uses for**: Counting invocations, understanding usage patterns, identifying which skills are used.

### Tool 3: `get_session_summaries`

**Purpose**: Session context for agent reasoning about missed opportunities

```typescript
// Returns data; agent reasons about missed opportunities
interface SessionSummariesResult {
  sessions: Array<{
    sessionId: string;
    timestamp: string;
    firstUserPrompt: string;      // What user asked for
    filesOperated: string[];       // Files touched in session
    skillsInvoked: string[];       // Skills actually used
    turnCount: number;
  }>;
  totalSessions: number;
}
```

**Parameters**: `{ since?: string, until?: string, projectPath?: string, limit?: number }`

**Agent uses for**: Reasoning about whether a skill SHOULD have been used based on user intent and files touched.

### Tool 4: `index_skill_invocations`

**Purpose**: Build/update invocation database from session logs

```typescript
interface IndexResult {
  sessionsIndexed: number;
  invocationsFound: number;
  newSinceLastIndex: number;
  indexedAt: string;
}
```

**Parameters**: `{ projectPath?: string, force?: boolean }`

**Agent uses for**: Ensuring data is current before analysis.

---

## Database Schema Extension

Extends existing `sessions.db` per ADR-0006:

```sql
-- Skill invocations indexed from session logs
CREATE TABLE skill_invocations (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  skill_name TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  user_prompt_snippet TEXT,
  file_path TEXT,           -- Source JSONL for causal tracing
  line_number INTEGER,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX idx_skill_invocations_skill ON skill_invocations(skill_name);
CREATE INDEX idx_skill_invocations_session ON skill_invocations(session_id);
CREATE INDEX idx_skill_invocations_timestamp ON skill_invocations(timestamp);
```

**Note**: NO `missed_opportunities` table. NO `effectiveness_scores` table. Agent reasons about these.

---

## Module Structure

```
src/skills/
├── index.ts                    # Module entry, exports
├── types.ts                    # TypeScript interfaces
├── schemas.ts                  # Zod validation schemas
├── discovery.ts                # Skill inventory from .claude/skills/
├── detection.ts                # Invocation extraction from logs
├── storage/
│   ├── index.ts                # Storage module entry
│   ├── schema.ts               # SQLite schema (extends sessions.db)
│   └── queries.ts              # SQL query helpers
└── tools/
    ├── index.ts                # Tool exports for registry
    ├── get-skill-inventory-tool.ts
    ├── get-skill-invocations-tool.ts
    ├── get-session-summaries-tool.ts
    └── index-skill-invocations-tool.ts
```

**Pattern**: Follows existing `src/tools/sessions/` structure exactly.

---

## Tool Implementation Pattern

Following `src/tools/sessions/get-session-stats-tool.ts`:

```typescript
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

export const getSkillInventoryTool = tool(
  'get_skill_inventory',
  `Enumerate skills from .claude/skills/ directory with their descriptions and metadata.

Returns for each skill:
- name: Skill identifier
- description: What the skill does (for agent analysis)
- filePatterns: Hint patterns (agent interprets, not programmatic rules)
- path: Location of SKILL.md

Use this to understand what skills exist in a project before analyzing invocations.`,
  {
    projectPath: z.string().optional().describe('Project path (defaults to cwd)'),
  },
  async (args) => {
    // Implementation returns data; no judgments
    const result = await getSkillInventory(args.projectPath);

    return {
      content: [{ type: 'text', text: formatInventory(result) }],
      _rawData: result,  // Machine-readable for agent
    };
  }
);
```

**Key patterns:**
- Rich description explains what, when, and returns
- `_rawData` provides structured data alongside formatted text
- No detection logic—returns facts
- Zod schemas for input validation

---

## Integration Points

### 1. Tool Registry (EP02)

Register tools in `src/orchestration/tool-registry.ts`:

```typescript
import {
  getSkillInventoryTool,
  getSkillInvocationsTool,
  getSessionSummariesTool,
  indexSkillInvocationsTool
} from '../skills/tools';

// In registry initialization
registry.register(getSkillInventoryTool);
registry.register(getSkillInvocationsTool);
registry.register(getSessionSummariesTool);
registry.register(indexSkillInvocationsTool);
```

### 2. Session Indexing (ADR-0006)

Extend existing `src/tools/sessions/indexer.ts` to:
- Detect Skill tool invocations during session indexing
- Store in `skill_invocations` table
- Use same incremental update pattern (check mtime)

### 3. CLI Commands

Add to existing `agentlint` CLI:

```bash
agentlint analyse --skills    # Focus on skills analysis
agentlint skills              # Standalone skills command (P3)
```

### 4. Baseline Storage

Skills invocation counts stored in baselines for temporal comparison.

---

## Testing Strategy

### Unit Tests (Tool Capabilities)

```typescript
describe('getSkillInvocationsTool', () => {
  it('returns invocation data for given skill name', async () => {
    // Setup: indexed sessions with skill invocations
    const result = await getSkillInvocationsTool.execute({ skillName: 'code-review' });

    // Verify: returns data (counts, sessions, timestamps)
    expect(result._rawData.invocations).toBeArray();
    expect(result._rawData.totalCount).toBeNumber();
    // NO assertions about "effectiveness" - that's agent judgment
  });

  it('handles empty results gracefully', async () => {
    const result = await getSkillInvocationsTool.execute({ skillName: 'nonexistent' });
    expect(result._rawData.invocations).toEqual([]);
    expect(result._rawData.totalCount).toBe(0);
  });
});
```

### Integration Tests (Data Flow)

```typescript
describe('Skills data integration', () => {
  it('indexes skill invocations from session logs', async () => {
    // Setup: JSONL with Skill tool_use entries
    await indexSkillInvocations({ projectPath: testDir });

    // Verify: data appears in queries
    const result = await getSkillInvocations({});
    expect(result.invocations.length).toBeGreaterThan(0);
  });
});
```

### Agent Evaluations (VCR + LLM-as-judge)

Test that agent CAN reason correctly given tool outputs:

```typescript
describe('Agent skills analysis', () => {
  it('agent identifies missed opportunity from session summary', async () => {
    // VCR: recorded session with tool returns
    const response = await evaluateAgentReasoning({
      context: 'Session worked on API code but api-design skill not invoked',
      expectedInsight: 'identifies potential missed skill opportunity',
    });

    // LLM-as-judge: verify reasoning quality
    expect(response.relevance).toBeGreaterThan(0.7);
  });
});
```

---

## What This Plan Does NOT Include

Per Constitution Principle VII, these are explicitly **NOT** in tools:

| Anti-pattern | Why Excluded |
|--------------|--------------|
| `detectMissedOpportunities()` | Agent reasoning |
| `calculateEffectivenessScore()` | Agent judgment |
| `if (invocationRate < 0.3)` | Hardcoded threshold |
| `status: 'underutilized'` | Tool making judgment |
| `recommendations: string[]` in tool output | Agent generates recommendations |

The agent will perform these reasoning tasks using the data tools provide.

---

## Key Design Decisions

| Decision | Choice | Rationale | ADR |
|----------|--------|-----------|-----|
| Extend sessions.db vs separate DB | Extend sessions.db | Consistent with ADR-0006; simpler schema management | ADR-0006 |
| Skill detection pattern | `tool_use.name === "Skill"` | Per strategic review; deterministic extraction | N/A |
| Session summary content | First user prompt + files operated | Minimal data for agent to reason about intent | N/A |
| File patterns as hints | Agent interprets, not programmatic rules | Constitution VII; agent decides relevance | N/A |

---

## References

- **Spec**: [specs/ep14-skills-effectiveness/spec.md](./spec.md)
- **Epic**: [docs/planning/epics/EP14-skills-effectiveness.md](../../docs/planning/epics/EP14-skills-effectiveness.md)
- **Arc42**: Section 5 (Building Blocks), Section 8 (Cross-cutting Concepts)
- **ADRs**: [ADR-0006](../../docs/architecture/adr/0006-session-log-processing-architecture.md), [ADR-0017](../../docs/architecture/adr/0017-agent-skills-integration-strategy.md)
- **Constitution**: [.specify/memory/constitution.md](../../.specify/memory/constitution.md)

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-24 | Claude Code | Initial plan with agentic design emphasis |
