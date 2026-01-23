# EP14: Skills Effectiveness Analysis

## Business Outcome Hypothesis

**If** we provide tools for skills data access from session logs,
**Then** the agent can analyze whether Skills are being invoked, reason about missed opportunities, and suggest description improvements for better auto-discovery,
**Measured by** skill invocation rate improvement, missed opportunity reduction, and description match rate.

## Classification

* **Type**: Business
* **Priority**: P0-Critical (Core Differentiator)
* **Size**: L
* **Duration**: 6 weeks
* **Dependencies**: EP06 (Session Analysis)
* **Extends**: ADR-0017 (Agent Skills Integration Strategy)

## In Scope

* Skill invocation extraction from session logs (`tool_use.name === "Skill"`)
* Per-skill invocation indexing with context
* Skill inventory integration (enumerate from `.claude/skills/`)
* Session summaries for agent analysis (files operated, user prompts)
* Data access tools for agent-driven effectiveness analysis

## Out of Scope

* Skill creation/editing (users do this manually)
* Cross-project skill comparison (future EP12 integration)
* Real-time skill invocation monitoring
* Programmatic detection logic (agent reasons about effectiveness)

## Key Deliverables

### Phase 1: Core Implementation (Weeks 1-3)

1. **Skill Invocation Indexer**
   - Parse `tool_use.name === "Skill"` entries from session logs
   - Extract skill command from `input.skill` or `input.command`
   - Build per-skill invocation index with context (session, timestamp, user prompt)
   - Store in SQLite for efficient querying

2. **Skill Inventory Integration**
   - Enumerate skills from `.claude/skills/` directory
   - Parse skill frontmatter (name, description, file patterns as hints)
   - Provide skill metadata for agent reasoning

3. **Session Summary Provider**
   - Summarize sessions with: first user prompt, files operated, skills invoked
   - Provide context for agent to reason about missed opportunities
   - Include file patterns as hints (not programmatic rules)

4. **Skills Data Access Tools**
   - `getSkillInventoryTool` - List skills with metadata
   - `getSkillInvocationsTool` - Query invocation data by skill/session/date
   - `getSessionSummariesTool` - Session context for agent analysis
   - `indexSkillInvocationsTool` - Build/update invocation database

**Agent Reasoning (NOT tools):**
- Whether invocation rates are "low" or "high"
- Whether a skill should have been used (missed opportunity)
- Why description-phrasing mismatches occur
- What description improvements to suggest

### Phase 2: Integration (Weeks 4-5)

1. **CLI Integration**
   - Add `agentlint skills` command for standalone skills analysis
   - Integrate skills findings into main `agentlint analyse` flow
   - Add `--skills` flag to focus analysis on skills effectiveness

2. **Orchestrator Integration**
   - Register data access tools in tool registry
   - Agent uses tools to gather data, then reasons about effectiveness
   - Ensure tools return data, not judgments

3. **Persistence Integration**
   - Store skills invocation counts in baselines
   - Enable temporal comparison of invocation data
   - Agent reasons about trends using historical data

4. **Testing**
   - Unit tests for invocation indexing, data queries
   - Integration tests for CLI commands
   - Evaluations for agent reasoning quality (VCR + LLM-as-judge)
   - Test fixtures with sample session logs containing Skill tool calls

### Phase 3: Cleanup (Week 6)

1. **Dead Code Removal**
   - Remove any superseded skills-related code from EP05
   - Clean up temporary development scaffolding

2. **Test Cleanup**
   - Remove obsolete test fixtures
   - Consolidate duplicate test utilities

3. **Documentation**
   - Update Arc42 §5 (Building Blocks) with Skills Data component
   - Update ADR-0017 with data access extension
   - Update CLAUDE.md with new CLI commands

## Technical Approach

### Session Log Detection Pattern

```typescript
// Deterministic extraction—tool finds invocations, agent interprets
function isSkillInvocation(block: ContentBlock): boolean {
  return block.type === 'tool_use' && block.name === 'Skill';
}

function extractSkillCommand(block: ContentBlock): string | null {
  if (!isSkillInvocation(block)) return null;
  return block.input?.skill || block.input?.command || null;
}
```

### Database Schema

```sql
CREATE TABLE skill_invocations (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  skill_name TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  context_tokens INTEGER,
  user_prompt_snippet TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX idx_skill_invocations_skill ON skill_invocations(skill_name);
CREATE INDEX idx_skill_invocations_session ON skill_invocations(session_id);
```

**Note**: No `missed_opportunities` table—agent reasons about this from session data.

## Success Criteria

- [ ] Tools provide skill inventory, invocation data, and session summaries
- [ ] Agent can reason about effectiveness using provided data
- [ ] Agent can analyze description mismatches and suggest improvements
- [ ] All tests pass, no dead code remains
- [ ] Tools return data; agent provides judgment (Constitution Principle VII)

## Constitution Alignment

| Principle | Alignment |
|-----------|-----------|
| II. Improvement-Oriented | Skills effectiveness tracking compounds value over time |
| III. Causal-First | Agent traces non-invocation to discovery/description issues |
| VII. Intelligent Tooling | Tools provide data; agent reasons about effectiveness |
| VIII. Compounding Value | Better descriptions improve future sessions |

## Related Documents

- [ADR-0017: Agent Skills Integration Strategy](../../architecture/adr/0017-agent-skills-integration-strategy.md)
- [ADR-0006: Session Log Processing Architecture](../../architecture/adr/0006-session-log-processing-architecture.md)
- [Strategic Review](../../review/agentlint-strategic-review-jan26.md)
