# agentlint Arc42 Architecture Documentation

> Local-first CLI tool for continuous improvement of AI-assisted development workflows.

**Version**: 1.0.0 | **Status**: Design Phase | **Last Updated**: January 2026

---

## Quick Navigation

| # | Section | Summary |
|---|---------|---------|
| 1 | [Introduction & Goals](01-introduction-goals.md) | Business goals, quality priorities, stakeholders |
| 2 | [Constraints](02-constraints.md) | Technical and organizational boundaries |
| 3 | [Context & Scope](03-context-scope.md) | System boundaries and external interfaces |
| 4 | [Solution Strategy](04-solution-strategy.md) | Core technology decisions and patterns |
| 5 | [Building Blocks](05-building-blocks.md) | 6-layer architecture decomposition |
| 6 | [Runtime View](06-runtime-view.md) | Key scenarios: analysis, tracing, comparison |
| 7 | [Deployment View](07-deployment-view.md) | Installation, dev setup, CI/CD |
| 8 | [Crosscutting Concepts](08-crosscutting-concepts.md) | Security, error handling, context management |
| 9 | [Architecture Decisions](09-architecture-decisions.md) | 18 ADRs covering all major choices |
| 10 | [Quality Requirements](10-quality-requirements.md) | Quality tree and scenarios |
| 11 | [Risks & Technical Debt](11-risks-technical-debt.md) | SDK dependencies, architecture gaps |
| 12 | [Glossary](12-glossary.md) | Domain and technical terminology |

---

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────┐
│                      agentlint                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ CLI Layer (Ink + Commander)                           │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ Orchestration Layer (Claude Agent SDK - Master Loop)  │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ Tool Layer (Zod schemas, analysis tools)              │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ Adapter Layer (Claude Code, Generalized, Future ACTs) │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ Persistence Layer (Baselines, Learnings, State)       │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ Integration Layer (Filesystem, Git, Anthropic API)    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Key Architectural Principles

1. **Local-First**: All analysis on user's machine; no data transmission
2. **Two-Layer Analysis**: Static tools for speed + agent reasoning for depth
3. **Causal Tracing**: Trace issues to origin, not just detect symptoms
4. **Claude Code Pattern**: Single-threaded master loop, proven at scale

## Related Documentation

- [Constitution v1.2.1](../../../.specify/memory/constitution.md) - 9 governing principles
- [Conceptual Architecture](../conceptual-architecture.md) - Detailed design rationale
- [ADRs](../adr/) - All 18 architecture decision records
- [Requirements](../../requirements/) - Functional and non-functional specs
