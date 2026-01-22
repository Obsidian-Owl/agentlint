# Section 9: Architecture Decisions

> Summary of major decisions documented as Architecture Decision Records (ADRs).

**Last Updated**: January 2026
**Related Sections**: [Solution Strategy](04-solution-strategy.md), [Constraints](02-constraints.md)

---

## ADR Summary

All decisions are documented in [docs/architecture/adr/](../adr/).

| ADR | Title | Key Decision |
|-----|-------|--------------|
| [0001](../adr/0001-runtime-platform-and-language.md) | Runtime Platform | TypeScript + Bun |
| [0002](../adr/0002-agentic-framework-strategy.md) | Agentic Framework | Claude Agent SDK (Anthropic-only MVP) |
| [0003](../adr/0003-cli-framework-and-command-structure.md) | CLI Framework | Ink + Commander.js |
| [0004](../adr/0004-output-format-and-rendering.md) | Output Rendering | Ink UI + Custom Causal Tree |
| [0005](../adr/0005-tool-definition-and-invocation-pattern.md) | Tool Definition | SDK `tool()` + Zod |
| [0006](../adr/0006-session-log-processing-architecture.md) | Session Processing | SQLite FTS5 + BM25 |
| [0007](../adr/0007-configuration-parser-design.md) | Config Parser | Custom + Zod validation |
| [0008](../adr/0008-baseline-storage-format-and-strategy.md) | Baseline Storage | JSON + SQLite index |
| [0009](../adr/0009-global-learnings-storage-and-transfer.md) | Global Learnings | Project + global scopes |
| [0010](../adr/0010-session-state-and-checkpointing.md) | Checkpointing | JSON with resumability |
| [0011](../adr/0011-testing-strategy-for-agentic-components.md) | Testing Strategy | Multi-layer approach |
| [0012](../adr/0012-evaluation-framework-for-analysis-quality.md) | Evaluation Framework | LLM-as-judge |
| [0013](../adr/0013-secret-detection-strategy.md) | Secret Detection | Pattern-based, never store |
| [0014](../adr/0014-credential-management-strategy.md) | Credentials | Environment variables |
| [0015](../adr/0015-git-integration-strategy.md) | Git Integration | CLI-based queries |
| [0016](../adr/0016-mcp-integration-strategy.md) | MCP Integration | Format compatible, protocol optional |
| [0017](../adr/0017-agent-skills-integration-strategy.md) | Agent Skills | Detect and analyze SKILL.md |
| [0018](../adr/0018-distribution-and-installation-strategy.md) | Distribution | Bun compile primary |
| [0019](../adr/0019-tool-agent-boundary-temporal.md) | Tool/Agent Boundary | Tools provide data, agent provides judgment |
| [0020](../adr/0020-sentiment-scale-normalization.md) | Sentiment Scale | Likert scale (-2 to +2) as canonical |

---

## Key Decision Themes

### Foundation (ADR 0001-0002)
- Claude Code's stack as reference architecture
- Anthropic-only MVP for development velocity

### Interface (ADR 0003-0004)
- React-based terminal UI (Ink)
- Streaming output for long operations

### Agent Infrastructure (ADR 0005-0006, 0019)
- Type-safe tools with rich descriptions
- SQLite for session log search
- Clear tool/agent boundary: tools provide data, agent provides judgment

### Persistence (ADR 0007-0010)
- Human-readable JSON for baselines
- Checkpointing for resumability

### Quality (ADR 0011-0013)
- Multi-layer testing including LLM evaluation
- Security through detection, not storage

### Integration (ADR 0014-0018)
- Environment-based credentials
- Standards compatibility (MCP, Agent Skills)

---

## Constitution Alignment

Every ADR includes a Constitution Compliance section mapping to the 9 principles. See [Constitution v1.2.1](../../../.specify/memory/constitution.md).
