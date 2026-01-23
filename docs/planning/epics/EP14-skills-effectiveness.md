# EP14: Skills Effectiveness Analysis

## Business Outcome Hypothesis

**If** we implement skills effectiveness measurement from session logs,
**Then** users can understand whether their Skills are being invoked, identify missed opportunities, and improve skill descriptions for better auto-discovery,
**Measured by** skill invocation rate improvement, missed opportunity reduction, and description match rate.

## Classification

* **Type**: Business
* **Priority**: P0-Critical (Core Differentiator)
* **Size**: L
* **Duration**: 6 weeks
* **Dependencies**: EP06 (Session Analysis)
* **Extends**: ADR-0017 (Agent Skills Integration Strategy)

## In Scope

* Skill invocation detection from session logs (`tool_use.name === "Skill"`)
* Per-skill invocation tracking and indexing
* Skill inventory integration (enumerate from `.claude/skills/`)
* Missed opportunity detection (sessions touching files matching skill scope)
* Description mismatch analysis (user phrasing vs. skill description)
* Suggestion generation for improved skill descriptions

## Out of Scope

* Skill creation/editing (users do this manually)
* Cross-project skill comparison (future EP12 integration)
* Real-time skill invocation monitoring

## Key Deliverables

### Phase 1: Core Implementation (Weeks 1-3)

1. **Skill Invocation Detector**
   - Parse `tool_use.name === "Skill"` entries from session logs
   - Extract skill command from `input.skill` or `input.command`
   - Build per-skill invocation index with context (session, timestamp, user prompt)
   - Store in SQLite for efficient querying

2. **Skill Inventory Integration**
   - Enumerate skills from `.claude/skills/` directory
   - Parse skill frontmatter (name, description, triggers, file patterns)
   - Build skill-to-scope mapping (which files/patterns each skill covers)

3. **Missed Opportunity Detector**
   - Analyze session file operations (Read/Write/Edit tool calls)
   - Match file patterns to skill scope definitions
   - Identify sessions where skill *could* have been invoked but wasn't
   - Calculate missed opportunity rate per skill

4. **Description Mismatch Analyzer**
   - Extract user prompts from sessions where skill wasn't invoked
   - Compare prompt phrasing to skill descriptions using semantic similarity
   - Surface discovery mismatches with specific suggestions

5. **Skills Effectiveness Tools**
   - `analyzeSkillsEffectivenessTool` - Comprehensive effectiveness analysis
   - `getSkillInvocationsTool` - Query invocation data by skill/session/date
   - `suggestSkillDescriptionsTool` - Generate improved descriptions based on user phrasing

### Phase 2: Integration (Weeks 4-5)

1. **CLI Integration**
   - Add `agentlint skills` command for standalone skills analysis
   - Integrate skills findings into main `agentlint analyse` flow
   - Add `--skills` flag to focus analysis on skills effectiveness

2. **Orchestrator Integration**
   - Register new tools in tool registry
   - Update analysis prompts to leverage skills effectiveness data
   - Ensure tools work with agent reasoning flow

3. **Persistence Integration**
   - Store skills effectiveness metrics in baselines
   - Enable temporal comparison of skills effectiveness
   - Add skills data to recommendation context

4. **Testing**
   - Unit tests for invocation detection, missed opportunity calculation
   - Integration tests for CLI commands
   - VCR tests for agent-driven skills analysis
   - Test fixtures with sample session logs containing Skill tool calls

### Phase 3: Cleanup (Week 6)

1. **Dead Code Removal**
   - Remove any superseded skills-related code from EP05
   - Clean up temporary development scaffolding

2. **Test Cleanup**
   - Remove obsolete test fixtures
   - Consolidate duplicate test utilities

3. **Documentation**
   - Update Arc42 §5 (Building Blocks) with Skills Effectiveness component
   - Update ADR-0017 with effectiveness measurement extension
   - Update CLAUDE.md with new CLI commands

## Technical Approach

### Session Log Detection Pattern

```typescript
// Detect Skill invocations in session logs
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

## Success Criteria

- [ ] Can report per-skill invocation rates with 30/60/90 day trends
- [ ] Can identify sessions with missed skill opportunities
- [ ] Can suggest description improvements for low-invocation skills
- [ ] All tests pass, no dead code remains
- [ ] Integration with EP17 TUI for interactive exploration

## Constitution Alignment

| Principle | Alignment |
|-----------|-----------|
| II. Improvement-Oriented | Skills effectiveness tracking compounds value over time |
| III. Causal-First | Traces non-invocation to discovery/description issues |
| VIII. Compounding Value | Better descriptions improve future sessions |

## Related Documents

- [ADR-0017: Agent Skills Integration Strategy](../../architecture/adr/0017-agent-skills-integration-strategy.md)
- [ADR-0006: Session Log Processing Architecture](../../architecture/adr/0006-session-log-processing-architecture.md)
- [Strategic Review](../../review/agentlint-strategic-review-jan26.md)
