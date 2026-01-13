# 1. Introduction and Goals

## 1.1 Requirements Overview

### Mission Statement

agentlint enables continuous improvement of AI-assisted development workflows through automated analysis and actionable recommendations.

### Core Problem

AI coding assistants (Claude Code, Cursor, Aider) are increasingly central to software development, but teams lack visibility into:
- Whether their AI assistant configurations are effective
- Why AI sessions succeed or fail
- How to improve their AI-assisted workflows over time

### Essential Features

| Feature | Description | Priority |
|---------|-------------|----------|
| **AI Tool Detection** | Automatically detect configured AI coding assistants | Must Have |
| **Configuration Analysis** | Parse and evaluate AI config files (CLAUDE.md, .cursorrules) | Must Have |
| **Session Analysis** | Analyze AI session logs for effectiveness patterns | Must Have |
| **Causal Tracing** | Trace issues to their origins (config gaps, bad prompts) | Must Have |
| **Recommendations** | Generate actionable improvement recommendations | Must Have |
| **Baseline Tracking** | Compare current state against historical baselines | Must Have |
| **Progressive Analysis** | Baselines enable compound improvement over time | Should Have |
| **Multi-Provider** | Support Anthropic, OpenAI, and future LLM providers | Should Have |
| **CI/CD Integration** | Observability-first CI integration (non-blocking) | Should Have |
| **Hindsight Capture** | Extract learnings for cross-session improvement | Could Have |

### Non-Goals (MVP)

- IDE plugins (CLI-only for MVP)
- Real-time monitoring during AI sessions
- Team/organization dashboards
- Cross-project learning (project-scoped only)
- Plugin/extension system (compiled-in components only)

## 1.2 Quality Goals

The top 5 quality goals driving architecture decisions:

| Priority | Quality Goal | Scenario |
|----------|--------------|----------|
| 1 | **Performance** | Analysis completes in <30 seconds for typical project |
| 2 | **Privacy (Local-First)** | All data remains on user's machine; no cloud telemetry |
| 3 | **Actionability** | Every finding includes a concrete next step |
| 4 | **Reproducibility** | Same inputs produce consistent analysis (accounting for LLM variance) |
| 5 | **Developer Experience** | <5 minute time-to-first-insight after installation |

### Quality Scenarios

**Q1: Performance**
- Scenario: Developer runs `agentlint analyse` on a TypeScript project with 500 files
- Response: Analysis completes in under 30 seconds
- Measurement: P95 latency across diverse project sizes

**Q2: Privacy**
- Scenario: User runs analysis on proprietary codebase
- Response: Zero data leaves local machine unless user explicitly configures LLM provider
- Measurement: Network traffic audit shows no outbound connections except configured LLM API

**Q3: Actionability**
- Scenario: agentlint identifies a configuration gap
- Response: Recommendation includes specific config snippet to add
- Measurement: User can implement recommendation without external research

**Q4: Reproducibility**
- Scenario: Team member runs same analysis on same commit
- Response: Static findings are identical; LLM findings are semantically consistent
- Measurement: Reproducibility score ≥95% for static, ≥80% for agentic analysis

**Q5: Developer Experience**
- Scenario: New user installs agentlint
- Response: `agentlint init && agentlint analyse` produces useful insights
- Measurement: Time from `npm install` to first actionable recommendation <5 minutes

## 1.3 Stakeholders

### Primary Personas

| Persona | Description | Key Needs |
|---------|-------------|-----------|
| **The Optimizer** | Developer who wants maximum AI effectiveness | Detailed metrics, improvement tracking, recommendations |
| **Multi-Tool User** | Uses multiple AI assistants across projects | Unified view, config comparison, tool-agnostic insights |
| **Vibe Coder** | Heavy AI user, less structured approach | Cost awareness, iteration reduction, session effectiveness |
| **Context Engineer** | Carefully crafts AI config and context | Config validation, best practices, pattern detection |

### Future Personas (Post-MVP)

| Persona | Description | Planned Support |
|---------|-------------|-----------------|
| **Team Lead** | Needs team-wide AI effectiveness visibility | Team dashboards, aggregate metrics |
| **Enterprise Architect** | Governs AI tooling across organization | Policy enforcement, compliance reporting |

### Stakeholder Concerns Matrix

| Stakeholder | Primary Concern | How Addressed |
|-------------|-----------------|---------------|
| Developers | Time to value, accuracy | Fast CLI, init wizard, rich recommendations |
| Privacy-conscious users | Data sovereignty | Local-first architecture, no cloud dependency |
| Cost-conscious users | LLM API costs | Progressive analysis, cost estimates, static fallback |
| CI/CD integrators | Pipeline integration | Exit codes, SARIF output, non-blocking mode |
| Open source contributors | Code quality | Testing strategy, clear interfaces, documentation |

## Related ADRs

- [ADR-0001: Language and Runtime Selection](../adr/0001-language-and-runtime-selection.md) - TypeScript + Bun for performance
- [ADR-0006: Agentic Analysis Implementation](../adr/0006-agent-orchestrated-analysis.md) - Agent-orchestrated architecture
- [ADR-0024: CLI Design and Help System](../adr/0024-cli-design-and-help-system.md) - Developer experience
