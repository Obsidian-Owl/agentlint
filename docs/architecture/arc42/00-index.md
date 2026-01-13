# agentlint Architecture Documentation (Arc42)

**Version:** 1.0.0
**Last Updated:** 2026-01-13
**Status:** Initial Architecture

---

## About This Documentation

This architecture documentation follows the [Arc42 template](https://arc42.org/overview), providing a comprehensive view of agentlint's technical design. Arc42 offers a structured approach to document software architectures through 12 well-defined sections.

## Document Structure

| # | Section | Description | Status |
|---|---------|-------------|--------|
| 1 | [Introduction and Goals](./01-introduction-and-goals.md) | Requirements, stakeholders, and quality goals | Complete |
| 2 | [Constraints](./02-constraints.md) | Technical, organizational, and convention constraints | Complete |
| 3 | [Context and Scope](./03-context-and-scope.md) | Business and technical context, external interfaces | Complete |
| 4 | [Solution Strategy](./04-solution-strategy.md) | Fundamental technology decisions and solution approach | Complete |
| 5 | [Building Block View](./05-building-block-view.md) | Static decomposition of the system | Complete |
| 6 | [Runtime View](./06-runtime-view.md) | Behavior, interactions, and scenarios | Complete |
| 7 | [Deployment View](./07-deployment-view.md) | Infrastructure and deployment topology | Complete |
| 8 | [Crosscutting Concepts](./08-crosscutting-concepts.md) | Recurring patterns and cross-layer concerns | Complete |
| 9 | [Architecture Decisions](./09-architecture-decisions.md) | Important decisions and their rationale (ADR index) | Complete |
| 10 | [Quality Requirements](./10-quality-requirements.md) | Quality tree and scenarios | Complete |
| 11 | [Risks and Technical Debt](./11-risks-and-technical-debt.md) | Known risks and technical debt items | Complete |
| 12 | [Glossary](./12-glossary.md) | Important domain and technical terms | Complete |

## Key Architecture Principles

agentlint's architecture is guided by nine foundational principles from the [Constitution](../../../.specify/memory/constitution.md):

1. **Local-First** - All data stays on user's machine; user owns their data
2. **Improvement-Oriented** - Track improvement over time, not gatekeeping
3. **Causal-First** - Trace issues to their origins, not just symptoms
4. **Mixed-Methods** - Combine static analysis with LLM reasoning
5. **Language-Agnostic** - Work with any programming language
6. **Tool-Agnostic** - Support multiple AI coding assistants
7. **Intelligent Tooling** - Static analysis and agent reasoning work as partners
8. **Compounding Value** - Baselines compound value over time
9. **Agent-Aware** - Optimize experience for both humans and AI agents

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            agentlint CLI                                     │
│  Parses commands, renders output, manages configuration                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                         Analysis Agent (LLM)                                 │
│                                                                             │
│  Agent-orchestrated analysis:                                               │
│  • Receives analysis task from CLI                                          │
│  • Reasons about what to analyze                                            │
│  • Invokes tools to gather data                                             │
│  • Synthesizes findings into insights                                       │
│  • Generates recommendations                                                │
│                                                                             │
│  Implemented via Vercel AI SDK (provider-agnostic)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                          Agent Tools                                         │
│                                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ ConfigParser│ │SessionStats │ │  GitQuery   │ │  ReadFile   │           │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │  Baseline   │ │    FTS5     │ │  Language   │ │ SaveFinding │           │
│  │   Query     │ │   Search    │ │  Analyzer   │ │             │           │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘           │
├─────────────────────────────────────────────────────────────────────────────┤
│                        Support Services                                      │
│                                                                             │
│  SQLite Storage  │  AI Tool Adapters  │  Observability                      │
│  (FTS5, WAL)     │  (Claude, Cursor)  │  (OpenTelemetry)                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Related Documentation

- [Vision Document](../../agentlint-architecture-vision.md) - High-level architecture vision
- [North Star](../../north-star.md) - Mission, principles, and success indicators
- [ADR Directory](../adr/) - All 28 Architecture Decision Records
- [Constitution](../../../.specify/memory/constitution.md) - Foundational principles

## How to Use This Documentation

- **New team members**: Start with Section 1 (Introduction) and Section 4 (Solution Strategy)
- **Developers**: Focus on Sections 5-7 (Building Blocks, Runtime, Deployment)
- **Architects**: Review Section 9 (Architecture Decisions) for context
- **Operations**: See Section 7 (Deployment) and Section 11 (Risks)

---

*This documentation was synthesized from 28 ADRs, the architecture vision, and north star documents.*
