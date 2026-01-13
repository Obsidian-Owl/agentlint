# 4. Solution Strategy

This section describes the fundamental technology decisions and solution approaches that drive agentlint's architecture.

## 4.1 Technology Stack

### Core Technologies

| Layer | Technology | Rationale | ADR |
|-------|------------|-----------|-----|
| **Runtime** | Bun 1.x | <100ms startup, built-in SQLite, native TypeScript | [ADR-0001](../adr/0001-language-and-runtime-selection.md) |
| **Language** | TypeScript | Type safety, ecosystem, tooling | [ADR-0001](../adr/0001-language-and-runtime-selection.md) |
| **Storage** | SQLite + FTS5 | Local-first, zero config, full-text search | [ADR-0003](../adr/0003-local-storage-strategy.md) |
| **LLM SDK** | Vercel AI SDK | Multi-provider, OpenTelemetry, typed tools | [ADR-0006](../adr/0006-agent-orchestrated-analysis.md) |
| **CLI Framework** | Clerc | Bun-native, strongly-typed, completion support | [ADR-0024](../adr/0024-cli-design-and-help-system.md) |
| **Config Format** | TOML | Human-readable, typed, XDG-compliant | [ADR-0004](../adr/0004-configuration-file-locations.md) |
| **Logging** | Consola | TypeScript-first, CLI integration, zero deps | [ADR-0025](../adr/0025-logging-and-debugging-strategy.md) |

### Key Libraries

| Library | Purpose | License |
|---------|---------|---------|
| `ai` (Vercel) | LLM provider abstraction | Apache 2.0 |
| `@ai-sdk/anthropic` | Anthropic Claude integration | Apache 2.0 |
| `@ai-sdk/openai` | OpenAI GPT integration | Apache 2.0 |
| `clerc` | CLI parsing and completion | MIT |
| `@clack/prompts` | Interactive CLI prompts | MIT |
| `consola` | Structured logging | MIT |
| `zod` | Schema validation | MIT |

## 4.2 Architectural Approach

### Agent-Orchestrated Analysis

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AGENT-ORCHESTRATED ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Traditional Linter:                                                        │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐                    │
│  │ Parse   │ → │ Analyse │ → │ Report  │ → │ Output  │                    │
│  │ Fixed   │   │ Fixed   │   │ Fixed   │   │ Fixed   │                    │
│  └─────────┘   └─────────┘   └─────────┘   └─────────┘                    │
│                                                                             │
│  agentlint (Agent-Orchestrated):                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Analysis Agent (LLM)                           │   │
│  │                                                                     │   │
│  │  Agent decides:                                                     │   │
│  │  • What to analyze based on discoveries                            │   │
│  │  • When to use tools vs. direct reasoning                          │   │
│  │  • How deep to go in each domain                                   │   │
│  │  • What recommendations to generate                                │   │
│  │                                                                     │   │
│  │  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐      │   │
│  │  │Config │ │Session│ │ Git   │ │ Read  │ │Search │ │ Save  │      │   │
│  │  │Parser │ │Stats  │ │Query  │ │ File  │ │ FTS5  │ │Finding│      │   │
│  │  └───────┘ └───────┘ └───────┘ └───────┘ └───────┘ └───────┘      │   │
│  │                       Agent Tools                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Key Difference: Agent has FULL AUTONOMY to choose approach                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Decision**: Agent-orchestrated architecture with Vercel AI SDK ([ADR-0006](../adr/0006-agent-orchestrated-analysis.md))

**Rationale**:
- Enables sophisticated reasoning about WHY issues occur
- Adapts analysis based on what it discovers
- Supports causal tracing (not just symptom detection)
- Multi-provider support from day one

### Causal Analysis Model

agentlint uses an evidence-first causal analysis model: DETECT → TRACE → UNDERSTAND → CAPTURE → PREVENT. This is a crosscutting pattern detailed in [Section 8.2 - Causal Analysis Model](./08-crosscutting-concepts.md#82-causal-analysis-model).

**Decision**: Causal-first analysis with hindsight capture ([ADR-0007](../adr/0007-causal-analysis-architecture.md), [ADR-0026](../adr/0026-hindsight-capture-and-knowledge-surfacing-strategy.md))

**Rationale**:
- Issues traced to root causes, not symptoms
- Learning compounds across sessions
- Recommendations are preventive, not reactive

### Compounding Value Delivery

Progressive value means value compounds over time through baselines and trend analysis.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    COST CONTROL VIA MODEL SELECTION                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Claude Haiku (Fast/Cheap)                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • Full analysis capabilities                                        │   │
│  │ • Fastest response times                                            │   │
│  │ • Best for CI pipelines and frequent checks                         │   │
│  │                                                                     │   │
│  │ Cost: ~$0.02/run    Time: <30s                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Claude Sonnet (Balanced)                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • Full analysis capabilities                                        │   │
│  │ • Balanced quality and speed                                        │   │
│  │ • Best for daily use and local development                          │   │
│  │                                                                     │   │
│  │ Cost: ~$0.10/run    Time: <1min                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Claude Opus (Premium)                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • Full analysis capabilities                                        │   │
│  │ • Highest quality reasoning                                         │   │
│  │ • Best for deep analysis of complex projects                        │   │
│  │                                                                     │   │
│  │ Cost: ~$0.50/run    Time: <2min                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Decision**: Cost control via model selection ([ADR-0022](../adr/0022-cicd-integration-patterns.md))

**Rationale**:
- Users choose model (haiku/sonnet/opus) for cost/quality tradeoff
- Interactive setup prompts for credentials on first use
- CI uses faster/cheaper models (claude-haiku) for cost efficiency

## 4.3 Key Design Decisions

### Local-First Architecture

| Decision | Approach | Benefit |
|----------|----------|---------|
| Data storage | SQLite on user's machine | Privacy, local-first principle |
| LLM credentials | User-provided API keys | No vendor dependency |
| Processing | All analysis runs locally | No cloud service required |
| Telemetry | Opt-in only, minimal | User trust |

### Observability-First Integration

| Decision | Approach | Benefit |
|----------|----------|---------|
| CI/CD | Non-blocking by default | Doesn't break builds |
| Git hooks | Background execution | Doesn't slow git operations |
| Exit codes | 0 for analysis complete | Informs, doesn't gate |
| PR comments | Informational, not blocking | Surfaces insights without friction |

### Compiled-In Components

| Decision | Approach | Benefit |
|----------|----------|---------|
| AI tool adapters | Compiled into binary | Security, quality control |
| Language analyzers | Compiled into binary | Type safety, testing |
| No plugins | Core team maintains all | Consistent quality |

## 4.4 Quality Achievement Strategies

| Quality Goal | Strategy | ADR |
|--------------|----------|-----|
| **Performance (<30s)** | Bun runtime, parallel subagents, multi-layer caching | [ADR-0001](../adr/0001-language-and-runtime-selection.md), [ADR-0011](../adr/0011-parallel-processing-architecture.md), [ADR-0021](../adr/0021-caching-strategy.md) |
| **Privacy** | Local-first storage, user-owned credentials | [ADR-0003](../adr/0003-local-storage-strategy.md), [ADR-0005](../adr/0005-credential-storage-strategy.md) |
| **Actionability** | Causal analysis, config snippets in recommendations | [ADR-0007](../adr/0007-causal-analysis-architecture.md), [ADR-0010](../adr/0010-recommendation-prioritisation-strategy.md) |
| **Reproducibility** | Documented non-determinism, seeded randomness, checkpoints | [ADR-0015](../adr/0015-reproducibility-and-determinism.md) |
| **DX (<5min setup)** | Init wizard, sensible defaults, comprehensive help | [ADR-0024](../adr/0024-cli-design-and-help-system.md) |

## 4.5 Organizational Structure

### Component Organization

```
src/
├── cli/                    # CLI layer (Clerc-based)
│   ├── commands/           # Command implementations
│   └── render/             # Output formatters
├── agent/                  # Agent orchestration
│   ├── orchestrator.ts     # Main analysis agent
│   ├── subagents/          # Domain-specific subagents
│   ├── tools/              # Agent tool definitions
│   └── memory/             # Working memory management
├── adapters/               # AI tool adapters
│   ├── claude-code/        # Claude Code adapter
│   ├── cursor/             # Cursor adapter
│   └── aider/              # Aider adapter
├── analyzers/              # Language analyzers
│   ├── typescript/         # TypeScript analyzer
│   ├── python/             # Python analyzer
│   └── go/                 # Go analyzer
├── storage/                # SQLite storage layer
│   ├── schema.sql          # Database schema
│   └── repositories/       # Data access
├── causal/                 # Causal analysis engine
│   ├── detector.ts         # Issue detection
│   ├── tracer.ts           # Origin tracing
│   └── hindsight.ts        # Learning capture
└── config/                 # Configuration management
    ├── loader.ts           # Config file loading
    └── schema.ts           # Config validation
```

## Related ADRs

All ADRs influence solution strategy. Key references:
- [ADR-0001](../adr/0001-language-and-runtime-selection.md) - Runtime foundation
- [ADR-0006](../adr/0006-agent-orchestrated-analysis.md) - Agent architecture
- [ADR-0007](../adr/0007-causal-analysis-architecture.md) - Causal model
- [ADR-0011](../adr/0011-parallel-processing-architecture.md) - Parallel processing
- [ADR-0021](../adr/0021-caching-strategy.md) - Caching strategy
