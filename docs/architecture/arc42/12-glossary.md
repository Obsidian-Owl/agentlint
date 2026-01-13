# 12. Glossary

This section defines important domain and technical terms used throughout agentlint's architecture documentation.

## 12.1 Domain Terms

### AI Coding Assistants

| Term | Definition |
|------|------------|
| **AI Coding Assistant** | Software that uses LLMs to assist developers with coding tasks. Examples: Claude Code, Cursor, Aider, GitHub Copilot. |
| **Claude Code** | Anthropic's AI coding assistant that uses Claude models. Configuration via CLAUDE.md files. |
| **Cursor** | AI-powered code editor with built-in assistant. Configuration via .cursorrules files. |
| **Aider** | Open-source AI pair programming tool. Configuration via .aider.conf.yml. |
| **Cline** | AI assistant for VS Code. Configuration via .clinerules. |

### Analysis Concepts

| Term | Definition |
|------|------------|
| **AI Session** | A single interaction period between a developer and an AI coding assistant, recorded in session logs. |
| **Session Log** | JSONL file recording AI assistant interactions, including prompts, responses, tool calls, and metadata. |
| **Analysis Domain** | A specific area of analysis: ai_config, session, structure, tooling, devsecops, docs, code_patterns, or cross_cutting. |
| **Baseline** | A recorded analysis result used as a comparison point for tracking improvement over time. |
| **Config Gap** | Missing or insufficient guidance in AI configuration files that allowed an issue to occur; identified during causal tracing. |
| **Failure Mode** | A categorized AI agent malfunction pattern: hallucination, context loss, scope creep, overconfidence, model mismatch, or config ignorance. |
| **Hindsight Note** | A captured learning from traced issues with pattern structure (title, triggers, solution), effectiveness tracking, and status lifecycle. |

### Effectiveness Metrics

| Term | Definition |
|------|------------|
| **Token Efficiency** | Ratio of useful output to total tokens consumed in an AI session. |
| **Iteration Count** | Number of back-and-forth exchanges needed to complete a task. |
| **First-Time Resolution Rate** | Percentage of tasks completed without requiring corrections. |
| **Context Overflow** | When an AI session exceeds context limits, causing information loss. |
| **Effectiveness Score** | Numeric measure (-1 to 1) of a hindsight note's impact on reducing pattern recurrence, token cost, and iteration count. |
| **Hallucination** | When an AI assistant generates incorrect or fabricated information. |

## 12.2 Architecture Terms

### Core Patterns

| Term | Definition |
|------|------------|
| **Agent-Orchestrated** | Architecture where an LLM agent coordinates all analysis, deciding what tools to use and when. |
| **Subagent** | A specialized agent spawned by the orchestrator to handle a specific analysis domain in parallel. |
| **Causal Analysis** | Tracing issues to their root causes using evidence-first methodology with multi-pass verification (ADR-0007). |
| **Causal Claim** | Output of LLM synthesis: traced origin, causal explanation, and preventive recommendation with confidence level. |
| **Causal Trace** | A chain of evidence linking an issue to its origin (session, prompt, config gap). |
| **Compounding Value** | Design principle where value compounds over time through baselines and trend analysis. |
| **Evidence Bundle** | Structured collection of correlated evidence (commit hash, candidate sessions, config state, temporal data) for causal synthesis. |
| **Evidence-First** | Analysis approach where static evidence extraction grounds LLM reasoning, avoiding unreliable post-hoc rationalization. |
| **Pattern Extraction** | First layer of hindsight capture: identifying recurring issue patterns from accumulated causal traces. |

### Data Flow

| Term | Definition |
|------|------------|
| **Adaptive Compression** | Threshold-triggered (80% token budget) working memory compression preserving goals, decisions, errors, and TODOs. |
| **AX (Agent Experience)** | Optimizations for LLM agent consumption: compressed context, metrics, structured data. |
| **UX (User Experience)** | Optimizations for human consumption: rich output, visualizations, explanations. |
| **Working Memory** | Hierarchical context structure used by agents during analysis (session → task → scratchpad); compresses at 80% token threshold. |
| **Context Compression** | Process of summarizing working memory when token budget threshold is reached. |
| **Content-Addressed Cache** | Cache keyed by content hash, enabling cache hits across different runs with same inputs. |
| **Scratchpad** | Volatile working space for current tool invocation context and intermediate reasoning; cleared after each analysis step. |

### Integration

| Term | Definition |
|------|------------|
| **Observability-First** | Design philosophy where integrations inform and track rather than block and gate. |
| **Smart Throttling** | Intelligent scheduling that prevents notification fatigue by batching and rate-limiting triggers. |
| **Frequency Mode** | User configuration for analysis frequency: Calm (weekly), Regular (per 5 sessions), Active (every session). |

## 12.3 Technical Terms

### Runtime & Storage

| Term | Definition |
|------|------------|
| **Bun** | JavaScript/TypeScript runtime used by agentlint. Provides <100ms startup and built-in SQLite. |
| **SQLite** | Embedded SQL database used for local storage. agentlint uses WAL mode for concurrent access. |
| **WAL (Write-Ahead Logging)** | SQLite mode enabling concurrent reads during writes, improving performance and crash safety. |
| **FTS5** | SQLite extension for full-text search, used for semantic search across session logs and hindsight. |
| **Streaming Parser** | Line-by-line JSONL processor for session logs; enables analysis of 100MB+ files without loading into memory. |
| **XDG Base Directory** | Linux/macOS specification for standard config/data/cache paths (~/.config, ~/.local/share, ~/.cache). |

### LLM Integration

| Term | Definition |
|------|------------|
| **Vercel AI SDK** | TypeScript library for LLM integration, providing provider-agnostic APIs and tool definitions. |
| **Provider** | LLM service (Anthropic, OpenAI) that agentlint calls via the Vercel AI SDK. |
| **Tool (Agent Tool)** | Function callable by the agent, defined with Zod schema for input validation. |
| **Prompt Cache** | Provider-level caching of prompt prefixes, reducing cost for repeated system prompts. |
| **Token Budget** | Maximum tokens allocated for an analysis session, triggering compression when exceeded. |

### CLI & Integration

| Term | Definition |
|------|------------|
| **Clerc** | TypeScript CLI framework used by agentlint, providing command parsing and shell completion. |
| **TOML** | Configuration file format (Tom's Obvious Minimal Language) used for agentlint config. |
| **SARIF** | Static Analysis Results Interchange Format, a JSON schema for tool output (IDE integration). |
| **Exit Code** | Numeric status returned by CLI commands. 0=success, 1-4=specific error types. |

### Testing & Quality

| Term | Definition |
|------|------------|
| **Golden Test** | Test that compares output against a known-good "golden" file to detect regressions. |
| **EvalKit** | Framework for evaluating LLM output quality using semantic comparison. |
| **Ablation Test** | Testing by systematically disabling components to measure their contribution. |
| **Reproducibility Score** | Measure of consistency between repeated analysis runs (100% for static, ~80% for agentic). |

## 12.4 Constitution Terms

### Principles

| Term | Definition |
|------|------------|
| **Local-First** | Principle that all data stays on the user's machine; no cloud dependency required. |
| **Improvement-Oriented** | Principle that agentlint tracks improvement over time rather than gatekeeping. |
| **Causal-First** | Principle that issues should be traced to their origins, not just detected. |
| **Mixed-Methods** | Principle combining static analysis (quantitative) with LLM reasoning (qualitative). |
| **Language-Agnostic** | Principle that agentlint works with any programming language. |
| **Tool-Agnostic** | Principle that agentlint supports multiple AI coding assistants via adapters. |
| **Intelligent Tooling** | Principle that static analysis tools and LLM reasoning are equal partners, not hierarchical. |
| **Compounding Value** | Principle that value compounds over time through baselines and trend analysis. |
| **Agent-Aware** | Principle that agentlint optimizes experience for both humans and AI agents. |

## 12.5 Acronyms

| Acronym | Expansion |
|---------|-----------|
| **ADR** | Architecture Decision Record |
| **API** | Application Programming Interface |
| **AST** | Abstract Syntax Tree |
| **AX** | Agent Experience |
| **CI/CD** | Continuous Integration / Continuous Deployment |
| **CLI** | Command Line Interface |
| **DX** | Developer Experience |
| **FTS** | Full-Text Search |
| **JSON** | JavaScript Object Notation |
| **JSONL** | JSON Lines (newline-delimited JSON) |
| **LLM** | Large Language Model |
| **MCP** | Model Context Protocol |
| **MVP** | Minimum Viable Product |
| **OTLP** | OpenTelemetry Protocol |
| **PR** | Pull Request |
| **SARIF** | Static Analysis Results Interchange Format |
| **SDK** | Software Development Kit |
| **SQL** | Structured Query Language |
| **TOML** | Tom's Obvious Minimal Language |
| **UX** | User Experience |
| **WAL** | Write-Ahead Logging |
| **XDG** | X Desktop Group (freedesktop.org) |
| **YAGNI** | You Aren't Gonna Need It |

## 12.6 Personas

| Persona | Description |
|---------|-------------|
| **The Optimizer** | Developer who wants maximum AI effectiveness through detailed metrics and recommendations. |
| **Multi-Tool User** | Developer using multiple AI assistants who needs unified analysis across tools. |
| **Vibe Coder** | Heavy AI user with less structured approach, focused on cost awareness and efficiency. |
| **Context Engineer** | Developer who carefully crafts AI configuration, seeking validation and best practices. |
| **Team Lead** | (Future) Manager needing team-wide AI effectiveness visibility. |
| **Enterprise Architect** | (Future) Governance role overseeing AI tooling across organization. |

## 12.7 File Types

| File/Pattern | Purpose | Location |
|--------------|---------|----------|
| `CLAUDE.md` | Claude Code configuration | Project root |
| `.cursorrules` | Cursor configuration | Project root |
| `.aider.conf.yml` | Aider configuration | Project root |
| `.clinerules` | Cline configuration | Project root |
| `config.toml` | agentlint configuration | `.agentlint/` or `~/.config/agentlint/` |
| `*.jsonl` | Session logs | `~/.claude/projects/` or tool-specific |
| `data.db` | Findings/baselines database | `~/.local/share/agentlint/` |
| `cache.db` | LLM response cache | `~/.cache/agentlint/` |

## Related Documentation

- [Constitution](../../../.specify/memory/constitution.md) - Foundational principles definitions
- [Vision Document](../../agentlint-architecture-vision.md) - Domain context
- [ADR Index](./09-architecture-decisions.md) - Technical decisions
