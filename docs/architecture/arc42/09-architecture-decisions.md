# 9. Architecture Decisions

This section provides an index of all Architecture Decision Records (ADRs) and summarizes their key decisions.

## 9.1 ADR Index

agentlint maintains 28 ADRs covering all major architectural decisions. All ADRs are located in `docs/architecture/adr/`.

### Foundation (ADR-0001 to ADR-0005)

| ADR | Title | Decision | Status |
|-----|-------|----------|--------|
| [0001](../adr/0001-language-and-runtime-selection.md) | Language and Runtime Selection | TypeScript + Bun | Accepted |
| [0002](../adr/0002-distribution-and-packaging-strategy.md) | Distribution and Packaging Strategy | npm Package + Homebrew | Accepted |
| [0003](../adr/0003-local-storage-strategy.md) | Local Storage Strategy | SQLite + FTS5 | Accepted |
| [0004](../adr/0004-configuration-file-locations.md) | Configuration File Locations | TOML + XDG Compliance | Accepted |
| [0005](../adr/0005-credential-storage-strategy.md) | Credential Storage Strategy | Env Vars + Keychain | Accepted |

### Agent Architecture (ADR-0006 to ADR-0011)

| ADR | Title | Decision | Status |
|-----|-------|----------|--------|
| [0006](../adr/0006-agent-orchestrated-analysis.md) | Agent-Orchestrated Analysis | Vercel AI SDK + Agent-Orchestrated | Accepted |
| [0007](../adr/0007-causal-analysis-architecture.md) | Causal Analysis Architecture | DETECT → TRACE → UNDERSTAND → PREVENT | Accepted |
| [0008](../adr/0008-session-quality-analysis.md) | Session Quality Analysis | Layered Approach (Static + Agentic) | Accepted |
| [0009](../adr/0009-observability-strategy.md) | Observability Strategy | OpenTelemetry Dual-Exporter | Accepted |
| [0010](../adr/0010-recommendation-prioritisation-strategy.md) | Recommendation Prioritisation | Quick Wins + Optimal Impact Views | Accepted |
| [0011](../adr/0011-parallel-processing-architecture.md) | Parallel Processing Architecture | Subagent Delegation Pattern | Accepted |

### Analysis Features (ADR-0012 to ADR-0015)

| ADR | Title | Decision | Status |
|-----|-------|----------|--------|
| [0012](../adr/0012-incremental-analysis-strategy.md) | Incremental Analysis Strategy | Hybrid Change Detection | Accepted |
| [0013](../adr/0013-testing-strategy.md) | Testing Strategy | Bun Test + EvalKit (4-Layer) | Accepted |
| [0014](../adr/0014-error-handling-and-recovery.md) | Error Handling and Recovery | Partial Completion + Exponential Backoff | Accepted |
| [0015](../adr/0015-reproducibility-and-determinism.md) | Reproducibility and Determinism | Documented Non-Determinism | Accepted |

### Infrastructure (ADR-0016 to ADR-0021)

| ADR | Title | Decision | Status |
|-----|-------|----------|--------|
| [0016](../adr/0016-concurrency-model.md) | Concurrency Model | SQLite WAL + Checkpointing | Accepted |
| [0017](../adr/0017-versioning-and-migration-strategy.md) | Versioning and Migration Strategy | SemVer + Automatic Migrations | Accepted |
| [0018](../adr/0018-ai-tool-adapter-architecture.md) | AI Tool Adapter Architecture | Strategy + Factory Pattern | Accepted |
| [0019](../adr/0019-language-ecosystem-support.md) | Language Ecosystem Support | Tiered Analyzers (Regex → Tree-Sitter) | Accepted |
| [0020](../adr/0020-output-formats-and-execution-ux.md) | Output Formats and Execution UX | JSON/SARIF/JUnit + Conversational | Accepted |
| [0021](../adr/0021-caching-strategy.md) | Caching Strategy | Multi-Layer (Memory → Disk → Prompt) | Accepted |

### Integration (ADR-0022 to ADR-0025)

| ADR | Title | Decision | Status |
|-----|-------|----------|--------|
| [0022](../adr/0022-cicd-integration-patterns.md) | CI/CD Integration Patterns | Observability-First (Non-Blocking) | Accepted |
| [0023](../adr/0023-git-hooks-integration.md) | Git Hooks Integration | Smart Throttling + Background | Accepted |
| [0024](../adr/0024-cli-design-and-help-system.md) | CLI Design and Help System | Clerc + Subcommand Pattern | Accepted |
| [0025](../adr/0025-logging-and-debugging-strategy.md) | Logging and Debugging Strategy | Consola + Tiered Levels | Accepted |

### Advanced Features (ADR-0026 to ADR-0028)

| ADR | Title | Decision | Status |
|-----|-------|----------|--------|
| [0026](../adr/0026-hindsight-capture-and-knowledge-surfacing-strategy.md) | Hindsight Capture | Active Capture + Export | Accepted |
| [0027](../adr/0027-agent-working-memory-architecture.md) | Agent Working Memory Architecture | Hierarchical + Scratchpad | Accepted |
| [0028](../adr/0028-agent-modularity-and-extension-pattern.md) | Agent Modularity and Extension | Compiled-In Components | Accepted |

## 9.2 Key Decision Summary

### Technology Choices

| Decision Area | Choice | Rationale |
|---------------|--------|-----------|
| **Runtime** | Bun | <100ms startup, built-in SQLite, native TypeScript |
| **Language** | TypeScript | Type safety, ecosystem maturity |
| **Storage** | SQLite + FTS5 | Local-first, zero config, full-text search |
| **LLM SDK** | Vercel AI SDK | Multi-provider, OpenTelemetry, typed tools |
| **CLI Framework** | Clerc | Bun-native, strongly-typed |
| **Config Format** | TOML | Human-readable, typed values |
| **Logging** | Consola | TypeScript-first, CLI integration |

### Architectural Patterns

| Pattern | Application | ADR |
|---------|-------------|-----|
| **Agent-Orchestrated** | LLM agent coordinates all analysis | [0006](../adr/0006-agent-orchestrated-analysis.md) |
| **Subagent Delegation** | Parallel domain analysis | [0011](../adr/0011-parallel-processing-architecture.md) |
| **Strategy Pattern** | AI tool adapters, language analyzers | [0018](../adr/0018-ai-tool-adapter-architecture.md), [0019](../adr/0019-language-ecosystem-support.md) |
| **Causal Model** | Issue tracing and prevention | [0007](../adr/0007-causal-analysis-architecture.md) |
| **Observability-First** | Non-blocking CI/hooks | [0022](../adr/0022-cicd-integration-patterns.md), [0023](../adr/0023-git-hooks-integration.md) |
| **Compounding Value** | Baselines compound over time | Multiple |
| **Content-Addressed Cache** | Hash-based cache keys | [0021](../adr/0021-caching-strategy.md) |

### Design Principles Applied

| Principle | How Applied | ADRs |
|-----------|-------------|------|
| **Local-First** | SQLite storage, user-owned credentials | [0003](../adr/0003-local-storage-strategy.md), [0005](../adr/0005-credential-storage-strategy.md) |
| **Improvement-Oriented** | Non-blocking, tracking over time | [0022](../adr/0022-cicd-integration-patterns.md), [0012](../adr/0012-incremental-analysis-strategy.md) |
| **Causal-First** | DETECT → TRACE → UNDERSTAND → PREVENT | [0007](../adr/0007-causal-analysis-architecture.md), [0026](../adr/0026-hindsight-capture-and-knowledge-surfacing-strategy.md) |
| **Tool-Agnostic** | AI tool adapters, multi-provider LLM | [0018](../adr/0018-ai-tool-adapter-architecture.md), [0006](../adr/0006-agent-orchestrated-analysis.md) |
| **Agent-Aware** | AX/UX separation, working memory | [0027](../adr/0027-agent-working-memory-architecture.md), [0020](../adr/0020-output-formats-and-execution-ux.md) |

## 9.3 Decision Dependencies

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ADR DEPENDENCY GRAPH (Simplified)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                           ADR-0001 (Bun + TypeScript)                       │
│                                     │                                        │
│           ┌─────────────────────────┼─────────────────────────┐             │
│           │                         │                         │             │
│           ▼                         ▼                         ▼             │
│      ADR-0003                  ADR-0006                  ADR-0024           │
│      (SQLite)                  (Agent)                   (CLI)             │
│           │                         │                         │             │
│           │                         ▼                         │             │
│           │                    ADR-0011                       │             │
│           │                   (Subagents)                     │             │
│           │                         │                         │             │
│           └──────────┬──────────────┴──────────────┬──────────┘             │
│                      │                             │                        │
│                      ▼                             ▼                        │
│                 ADR-0007                      ADR-0027                      │
│                (Causal)                      (Memory)                       │
│                      │                             │                        │
│                      ▼                             │                        │
│                 ADR-0026 ◀─────────────────────────┘                        │
│                (Hindsight)                                                  │
│                                                                             │
│  Note: Arrows indicate "depends on" or "extends" relationships             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 9.4 ADR Template

All ADRs follow the MADR 4.0 template structure:

```markdown
---
status: [proposed | accepted | deprecated | superseded]
date: YYYY-MM-DD
decision-makers: [list]
consulted: [list]
informed: [list]
---

# ADR-NNNN: Title

## Context and Problem Statement
[Describe the context and problem]

## Decision Drivers
[List the key factors]

## Considered Options
[List options considered]

## Decision Outcome
[Chosen option and rationale]

### Consequences
[Good, bad, neutral consequences]

## Pros and Cons of Options
[Detailed analysis of each option]

## Constitution Compliance
[How decision aligns with 9 principles]

## More Information
[Related documents, research, implementation notes]
```

## 9.5 Constitution Reference

All ADRs must comply with the 9 constitutional principles:

| # | Principle | Description |
|---|-----------|-------------|
| I | Local-First | All data stays on user's machine |
| II | Improvement-Oriented | Track improvement over time |
| III | Causal-First | Trace issues to origins |
| IV | Mixed-Methods | Static + LLM reasoning |
| V | Language-Agnostic | Work with any programming language |
| VI | Tool-Agnostic | Support multiple AI assistants |
| VII | Intelligent Tooling | Static analysis and agent reasoning as equal partners |
| VIII | Compounding Value | Baselines compound value over time |
| IX | Agent-Aware | Optimize for both humans and agents |

## Related Documents

- [Constitution](../../../.specify/memory/constitution.md) - Foundational principles
- [Vision Document](../../agentlint-architecture-vision.md) - High-level architecture
- [North Star](../../north-star.md) - Mission and success indicators
