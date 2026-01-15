# Section 12: Glossary

> Domain and technical terminology used throughout agentlint documentation.

**Last Updated**: January 2026
**Related Sections**: All sections reference these terms

---

## Domain Terms

| Term | Definition |
|------|------------|
| **ACT** | Agentic Coding Tool—AI-powered coding assistants (Claude Code, Cursor, Copilot CLI) |
| **Baseline** | Timestamped snapshot of analysis state for comparison and trend tracking |
| **Causal Analysis** | Tracing issues to their origin session/config to enable prevention |
| **Global Learning** | Insight that transfers across projects (`~/.agentlint/learnings/`) |
| **Leading Signal** | Metric predicting future outcomes (e.g., config coverage) |
| **Lagging Signal** | Metric reflecting past outcomes (e.g., token efficiency) |
| **Recommendation** | Actionable change with traced evidence chain |
| **Session** | Single interaction with an AI coding tool (stored as JSONL log) |

---

## Technical Terms

| Term | Definition |
|------|------------|
| **Adapter** | Component abstracting ACT-specific details behind a standard interface |
| **Agent Cognitive Workspace** | Hierarchically organized context structure for agent reasoning |
| **Agent Skills** | Open standard for portable procedural knowledge (SKILL.md format) |
| **AX** | Agent Experience—how well architecture serves agent's cognitive needs |
| **Master Loop** | Single-threaded `while(tool_use)` pattern for agent execution |
| **MCP** | Model Context Protocol—standard for AI-tool integration |
| **Poka-yoke** | Design principle preventing common misuse through clear documentation |
| **Subagent** | Delegated agent instance with scoped context and focused tools |

---

## Acronyms

| Acronym | Full Form |
|---------|-----------|
| ADR | Architecture Decision Record |
| CLI | Command-Line Interface |
| DX | Developer Experience |
| FTS5 | Full-Text Search version 5 (SQLite) |
| SDK | Software Development Kit |
| SSE | Server-Sent Events |
| UX | User Experience |

---

## Constitution Principles Reference

| # | Principle | One-Line Summary |
|---|-----------|------------------|
| I | Local-First | All analysis on user's machine |
| II | Improvement-Oriented | Baseline tracking is core |
| III | Causal-First | Trace issues to origin |
| IV | Mixed-Methods | Quantitative + qualitative |
| V | Language-Agnostic | Any programming language |
| VI | Agent-Agnostic | Any AI coding tool |
| VII | Intelligent Tooling | Agent chooses freely |
| VIII | Compounding Value | Learnings accumulate |
| IX | Agent-Aware | Agent IS the system |

See [Constitution v1.2.1](../../../.specify/memory/constitution.md) for full definitions.
