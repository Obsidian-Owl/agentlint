<!--
Sync Impact Report:
- Version change: 1.1.0 → 1.2.0 (MINOR - collaborative model clarification)
- Modified principles:
  - III. Causal-First: Changed PREVENT → RECOMMEND in causal model
    Added "The agent recommends; the developer decides"
    Replaced "Recommendation Hierarchy" with "Recommendation Types" table
    Clarified preventive = "enables prevention" not automatic prevention
  - IV. Mixed-Methods (Agent-Orchestrated): No changes this version
- Added sections:
  - "Collaborative Model" subsection in Stakeholder Experience Framework
    Defines 5-step interaction: Analyse → Discuss → Recommend → Decide → Implement
- Decision Framework: Added test #8 "Does it preserve user agency?"
- Templates requiring updates: N/A (no existing templates in .specify/templates/)
- Follow-up TODOs: None
-->

# agentlint Constitution

## Core Principles

### I. Local-First

All analysis MUST run on the user's machine. No data leaves without explicit user consent.

- Users provide their own LLM API credentials
- No telemetry, analytics, or data collection without opt-in
- All storage (baselines, learnings, session data) remains local
- Network calls are limited to user-configured LLM APIs

**Rationale**: Privacy and data sovereignty are non-negotiable. Developers trust agentlint with access to their code, configurations, and AI session logs.

**Testable**: No network calls exist except to user-configured LLM endpoints.

### II. Improvement-Oriented

Every feature MUST support the continuous improvement cycle. Baseline tracking and historical comparison are core capabilities, not afterthoughts.

- Features that compound value over time are prioritised over one-shot utilities
- The system maintains baselines for comparison across time
- Recommendations track implementation and effectiveness

**Continuous Improvement Model**:
```
BASELINE → CHANGE → OBSERVE → UNDERSTAND → REFINE → (repeat)
```

**Rationale**: One-time diagnostics provide limited value. Systematic improvement over time transforms developer workflows.

**Testable**: Every command either establishes a baseline, compares to a baseline, or generates artifacts that feed future comparisons.

### III. Causal-First

The system MUST trace issues to their origin and recommend changes that enable prevention—not merely detect problems.

- Issue detection alone is insufficient
- Every detected issue SHOULD link to a session, prompt, or config gap
- Recommendations SHOULD be preventive (enable prevention of recurrence) not just symptomatic (address immediate problem)

**Causal Analysis Model**:
```
DETECT → TRACE → UNDERSTAND → RECOMMEND
```

The agent recommends; the developer decides. agentlint never makes changes without user consent.

**Recommendation Types**:
| Type | Focus | Example |
|------|-------|---------|
| Symptomatic | Address immediate issue | "Remove the API key from line 42" |
| Preventive | Enable prevention of recurrence | "Add credential guidance to CLAUDE.md" |
| Systemic | Address root patterns | "Add pre-commit hook for secret scanning" |

Preventive and systemic recommendations have higher value because they enable compounding improvement—but the developer chooses what to implement.

**Rationale**: Understanding root causes enables prevention. Recommendations empower developers to make informed decisions about their workflows.

**Testable**: Recommendations include traced origin information. The agent presents options; it does not implement without user approval.

### IV. Mixed-Methods (Agent-Orchestrated)

The system provides quantitative and qualitative analysis capabilities. The agent reasons about which methods to apply based on task context—guidance informs but does not constrain.

- Quantitative signals provide objective, comparable measurements
- Qualitative analysis reveals WHY patterns exist
- The agent selects methods via semantic matching, not rigid pipelines
- Method descriptions signal intent; the agent decides applicability
- When a method doesn't fit the task, the agent adapts or skips it

**Structured Flexibility Pattern**:
- **Structure** comes from: method descriptions, analysis guidance, signal taxonomies
- **Flexibility** comes from: agent reasoning about relevance, context-aware selection, adaptive execution

**Signal Types**: Leading (predict), Lagging (reflect), Qualitative (semantic), Causal (traced origins)

**Anti-pattern**: Forced sequential pipelines where every analysis must run every method regardless of relevance.

**Rationale**: Pure metrics miss context. Pure qualitative assessment lacks comparability. But mandating both always creates rigidity. The agent reasons about what the task requires.

**Testable**: Analysis guidance uses descriptions (not flowcharts). The agent can skip methods when reasoning determines they're not applicable to the current task.

### V. Language-Agnostic

The system MUST effectively analyse projects regardless of programming language.

- Core analysis works for any programming language
- Language-specific features degrade gracefully for unsupported languages
- No language is privileged in the core architecture

**Rationale**: Developers work across languages. A tool that only works for one language limits adoption and value.

**Testable**: Core analysis completes successfully on projects in any language. Missing language-specific features produce warnings, not errors.

### VI. Agent-Agnostic

The system MUST support analysis of any AI coding agent through an adapter pattern.

- Initial focus on Claude Code does not preclude other agents
- Adapters encapsulate agent-specific logic (config formats, log structures)
- Core analysis remains independent of specific agent implementations

**Primary**: Claude Code | **Secondary**: GitHub Copilot CLI, OpenAI Codex | **Future**: Cursor, Aider, Windsurf

**Rationale**: The AI coding agent ecosystem is evolving rapidly. Coupling to one agent limits long-term value.

**Testable**: Adding a new agent adapter requires no changes to core analysis logic.

### VII. Intelligent Tooling

Tools exist to serve the agent's cognitive needs. The agent MUST choose freely between tool use and direct reasoning—no approach is privileged.

- Static tools provide fast, deterministic data gathering
- Agent reasoning provides deep understanding that tools cannot
- The agent decides which approach based on what the task requires

**Tools provide**: What is configured, how content is structured, what happened in sessions, how things evolved

**Agent reasoning provides**: WHY things happened, quality judgments, causal analysis, semantic understanding

**Rationale**: Tools and reasoning are complementary. Privileging one approach limits the quality of analysis.

**Testable**: Agent prompts do not mandate tool use for tasks solvable through reasoning, and vice versa.

### VIII. Compounding Value

Value MUST compound over time through baselines, trend analysis, and cross-project learnings.

- Each analysis builds on previous findings
- Recommendations become increasingly contextual over time
- Global learnings transfer across projects (`~/.agentlint/learnings/`)
- Returning users experience faster time-to-insight

**Rationale**: A tool that provides the same value on run 100 as run 1 fails to leverage accumulated understanding.

**Testable**: Analysis on day 30 produces more contextual recommendations than analysis on day 1 for the same project.

### IX. Agent-Aware

The agentlint agent IS the core of the system—not an enhancement. Design MUST serve the agent's cognitive needs.

- The agent orchestrates all analysis
- Context is structured as hierarchical working memory
- We "eat our own dog food"—our agent embodies the AX principles we recommend

**Rationale**: If the agentlint agent struggles to reason about projects, users receive poor analysis. Optimising for agent cognition directly improves output quality.

**Testable**: Analysis prompts follow AX principles. Agent context is structured hierarchically with task goals preserved.

## Stakeholder Experience Framework

agentlint optimises three interconnected experiences:

**Agent Experience (AX)**: Is context distilled for stable reasoning? Is working memory hierarchical? Do feedback loops support self-correction?

**User Experience (UX)**: Can developers trace issues to origin? Are recommendations actionable? Is improvement visible over time? Is the developer consulted before changes?

**Developer Experience (DX)**: Are results reproducible? Is the tool modular and extensible? Can findings be shared?

What the agent needs differs from what humans need. agentlint analyses both perspectives and surfaces tensions between them.

### Collaborative Model

agentlint is a **recommendation system**, not an automation system. The interaction model:

1. **Analyse**: Agent gathers context and identifies issues
2. **Discuss**: Agent presents findings and asks clarifying questions
3. **Recommend**: Agent proposes options with traced rationale
4. **Decide**: Developer chooses which recommendations to implement
5. **Implement**: Changes made collaboratively with developer approval

The agent may ask questions to clarify intent, validate assumptions, or present options. The developer remains in control of all decisions and changes.

## Decision Framework

When evaluating features, apply these tests:

1. Does it support continuous improvement? (Value compounds over time)
2. Does it trace to root cause? (Understanding enables prevention)
3. Does it embrace mixed methods? (Quantitative + qualitative)
4. Does it improve understanding? (Insight over raw numbers)
5. Does it serve the agent's needs? (Tools support; agent provides understanding)
6. Does it maintain local-first? (No data leaves without consent)
7. Is it language/agent-agnostic? (Broad applicability)
8. Does it preserve user agency? (Recommend, don't automate; developer decides)

A feature that fails any test requires explicit justification and principle override approval.

## Governance

This constitution supersedes all other practices. All architectural decisions MUST reference applicable principles.

**Amendment Procedure**: Proposals require written rationale, review against existing principles, maintainer approval, and version update.

**Versioning**: MAJOR (principle removal/redefinition) | MINOR (new principle/expansion) | PATCH (clarifications/wording)

**Compliance**: ADRs MUST demonstrate principle alignment. Code reviews SHOULD verify principle compliance for significant changes.

**Principle Overrides**: Require written justification, maintainer approval, documented scope/duration, and return-to-compliance plan.

**Version**: 1.2.0 | **Ratified**: 2026-01-14 | **Last Amended**: 2026-01-14
