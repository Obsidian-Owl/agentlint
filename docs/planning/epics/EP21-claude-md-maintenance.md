# EP21: CLAUDE.md Maintenance & Automation Learning

## Business Outcome Hypothesis

**If** we provide tools for session learning extraction, CLAUDE.md maintenance, and automation recommendations,
**Then** the agent can identify what works well in sessions, suggest CLAUDE.md improvements grounded in evidence, and recommend automations (skills, hooks, MCP) based on actual usage patterns,
**Measured by** CLAUDE.md quality improvement over time, learning adoption rate, and automation recommendation implementation rate.

## Classification

* **Type**: Integration
* **Priority**: P1-High
* **Size**: L
* **Duration**: 6 weeks
* **Dependencies**: EP05 (Config Analysis), EP06 (Session Analysis), EP10 (Recommendations), EP14 (Skills Effectiveness), EP16 (Symptom Patterns)
* **Extends**: ADR-0007 (Configuration Parser Design), ADR-0017 (Agent Skills Integration)

## Strategic Context

This epic addresses functionality similar to Anthropic's official Claude Code plugins:
- **claude-md-management** - CLAUDE.md quality auditing and session learning capture
- **claude-code-setup** - Automation recommendations (skills, hooks, MCP)

agentlint's advantage: We have **historical session data**, **temporal baselines**, and **causal tracing** that these plugins lack. This epic leverages that data to provide evidence-based recommendations rather than just current-state analysis.

## In Scope

* **Session Learning Extraction** - Aggregate insights from session history (not just current session)
* **CLAUDE.md Quality Trends** - Track quality improvement over time via baselines
* **Evidence-Grounded Improvements** - Suggest CLAUDE.md updates traced to specific session issues
* **Automation Recommendations** - Recommend skills, hooks, MCP servers based on usage patterns
* **Effectiveness Measurement** - Track whether recommended changes actually improve outcomes

## Out of Scope

* Automatic CLAUDE.md modification (user approves changes)
* Skill/hook creation (users do this manually based on recommendations)
* Real-time monitoring (batch analysis only)
* Plugin distribution format (future consideration)

## Key Deliverables

### Phase 1: Session Learning Extraction (Weeks 1-2)

1. **Learning Aggregator**
   - Extract patterns from session history (commands, gotchas, conventions)
   - Prioritize by frequency and impact (recurring issues rank higher)
   - Deduplicate across sessions
   - Store learnings with source session references

2. **Session Insight Tools**
   - `get_session_learnings` - Extract learnings from date range
   - `get_recurring_patterns` - Identify patterns appearing across sessions
   - `get_workflow_gotchas` - Commands/patterns that caused issues

**Agent Reasoning (NOT tools):**
- Whether a learning is worth documenting
- How to phrase learnings concisely
- Priority of learnings for CLAUDE.md

### Phase 2: CLAUDE.md Maintenance (Weeks 3-4)

1. **Quality Baseline Integration**
   - Extend EP09 baselines with CLAUDE.md quality metrics
   - Track quality changes over time
   - Correlate quality improvements with session outcomes

2. **Evidence-Based Improvement Suggester**
   - Link CLAUDE.md gaps to session issues (via EP07 causal chains)
   - Prioritize suggestions by impact (issues prevented)
   - Show diff-style proposed changes

3. **Maintenance Tools**
   - `get_claude_md_quality` - Current quality with trend data
   - `get_improvement_suggestions` - Evidence-grounded recommendations
   - `get_claude_md_coverage` - What's documented vs what's used

**Agent Reasoning (NOT tools):**
- Whether suggestions are worth implementing
- How to word additions concisely
- Balance between completeness and brevity

### Phase 3: Automation Recommendations (Weeks 5-6)

1. **Usage Pattern Analyzer**
   - Identify repetitive workflows from sessions
   - Detect permission friction patterns
   - Find hook opportunities (formatting, linting, validation)
   - Identify MCP integration gaps

2. **Recommendation Tools**
   - `get_skill_recommendations` - Suggest skills based on workflow patterns
   - `get_hook_recommendations` - Suggest hooks based on repetitive actions
   - `get_mcp_recommendations` - Suggest MCP servers based on tool usage

3. **Effectiveness Tracker**
   - Track recommendation implementation
   - Measure outcome changes after implementation
   - Feed back to improve future recommendations

**Agent Reasoning (NOT tools):**
- Whether recommendations are appropriate for project
- Priority and sequencing of recommendations
- Trade-offs between automation types

## Technical Approach

### Learning Extraction Pattern

```typescript
// Tool returns raw patterns, agent interprets significance
interface SessionLearning {
  pattern: string;           // Command, convention, or gotcha
  frequency: number;         // How often it appeared
  sessionIds: string[];      // Source sessions for tracing
  context: string;           // Surrounding context
  category: 'command' | 'convention' | 'gotcha' | 'workflow';
}

// Agent decides if learning should be documented
function getLearningsResult(): GetLearningsResult {
  return {
    learnings: [...],        // Raw patterns with frequency
    totalSessions: 47,       // Sessions analyzed
    dateRange: {...},        // Time period covered
    // Agent decides which are worth adding to CLAUDE.md
  };
}
```

### CLAUDE.md Quality Schema

```typescript
interface ClaudeMdQuality {
  overall: number;           // 0-100 score
  dimensions: {
    commands: number;        // Build/test/deploy documented?
    architecture: number;    // Structure explained?
    conventions: number;     // Code style documented?
    gotchas: number;         // Non-obvious patterns captured?
    currency: number;        // Recently updated?
  };
  gapCount: number;          // Issues traced to missing docs
  trend: 'improving' | 'stable' | 'declining';
}
```

### Automation Recommendation Schema

```typescript
interface AutomationRecommendation {
  type: 'skill' | 'hook' | 'mcp';
  name: string;              // Suggested automation name
  rationale: string;         // Why this would help
  evidence: {
    sessionCount: number;    // Sessions showing need
    pattern: string;         // What was detected
    examples: string[];      // Specific instances
  };
  setupHint: string;         // How to implement
}
```

## Success Criteria

- [ ] Tools provide session learnings with frequency and source tracing
- [ ] Tools provide CLAUDE.md quality metrics with temporal trends
- [ ] Tools provide evidence-grounded improvement suggestions
- [ ] Tools provide automation recommendations based on usage patterns
- [ ] Agent can reason about which learnings/suggestions to implement
- [ ] Effectiveness tracked over time (Constitution II)
- [ ] Tools return data; agent provides judgment (Constitution VII)

## Constitution Alignment

| Principle | Alignment |
|-----------|-----------|
| II. Improvement-Oriented | CLAUDE.md quality tracked over time, recommendations compound value |
| III. Causal-First | Suggestions traced to specific session issues |
| VII. Intelligent Tooling | Tools provide data (patterns, metrics); agent judges what to document |
| VIII. Compounding Value | Better docs improve future sessions; learnings transfer across projects |

## Differentiation from Official Plugins

| Capability | Official Plugins | agentlint EP21 |
|------------|------------------|----------------|
| Time horizon | Current session | Historical (30+ days) |
| Evidence basis | Current codebase | Session logs + baselines |
| Quality tracking | Point-in-time score | Trend over time |
| Suggestion grounding | Checklist-based | Traced to session issues |
| Effectiveness measurement | None | Outcome tracking |

## CLI Integration

```bash
# Session learnings
agentlint learn                    # Extract learnings from recent sessions
agentlint learn --since 7d         # Last 7 days
agentlint learn --apply            # Apply learnings to CLAUDE.md (with approval)

# CLAUDE.md maintenance
agentlint audit                    # Audit CLAUDE.md quality
agentlint audit --trend            # Show quality trend over time
agentlint suggest                  # Get improvement suggestions

# Automation recommendations
agentlint recommend                # Get automation recommendations
agentlint recommend --type skill   # Skills only
agentlint recommend --type hook    # Hooks only
```

## Related Documents

- [ADR-0007: Configuration Parser Design](../../architecture/adr/0007-configuration-parser-design.md)
- [ADR-0017: Agent Skills Integration Strategy](../../architecture/adr/0017-agent-skills-integration-strategy.md)
- [EP05: Config Analysis Tools](EP05-config-analysis.md)
- [EP10: Recommendation Engine](EP10-recommendation-engine.md)
- [EP14: Skills Effectiveness Analysis](EP14-skills-effectiveness.md)
- [Strategic Review](../../review/agentlint-strategic-review-jan26.md)

## Research References

- [claude-md-management plugin](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/claude-md-management)
- [claude-code-setup plugin](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/claude-code-setup)
