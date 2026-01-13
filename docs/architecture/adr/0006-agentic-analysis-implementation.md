---
status: accepted
date: 2026-01-12
decision-makers: [CTO, Architecture Lead]
consulted: [Development Team]
informed: [All Contributors]
---

# ADR-0006: Agentic Analysis Implementation

## Context and Problem Statement

agentlint requires LLM-powered analysis capabilities to provide semantic understanding of configurations, session logs, and code patterns. This analysis must be provider-agnostic (supporting multiple LLM providers), support full tool use (reading files, querying git, parsing configs), and align with the Static-First and Progressive Value constitutional principles. The architecture should enable future observability features for opt-in telemetry collection.

## Decision Drivers

- **Multi-provider requirement**: Must support Anthropic, OpenAI, and potentially local models
- **Static-First principle**: Maximize deterministic analysis; runs concurrently with LLM per ADR-0019
- **Progressive Value principle**: Tool must work without LLM configuration
- **Full tool use**: Agent needs to read files, explore codebase, query git during analysis
- **Agent-Aware principle**: Apply AX/UX/DX framework to our own agent design
- **Open source**: Prefer permissively licensed dependencies
- **Observability-ready**: Architecture should support future opt-in telemetry

## Considered Options

1. Hybrid Static Core + Vercel AI SDK Agentic
2. Mastra Framework (Batteries-Included)
3. Claude Agent SDK Only
4. Direct SDK + Custom Provider Abstraction

## Decision Outcome

Chosen option: **"Hybrid Static Core + Vercel AI SDK Agentic"** because it best aligns with the Static-First and Progressive Value principles while providing mature, provider-agnostic infrastructure. The Vercel AI SDK (Apache 2.0) has the highest adoption (2.8M downloads/week), native OpenTelemetry telemetry support, and excellent TypeScript ergonomics.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Analysis Pipeline                         │
│                                                             │
│  Deep Research Pattern: Static + Agentic run CONCURRENTLY  │
│  (See ADR-0011, ADR-0019 for execution model details)      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  │
│  │ STATIC TRACK            │  │ AGENTIC TRACK           │  │
│  │ (Always runs, no LLM)   │  │ (Optional, needs LLM)   │  │
│  │                         │  │                         │  │
│  │ • Config parsing        │  │ ┌─────────────────────┐ │  │
│  │ • Session log stats     │  │ │ Vercel AI SDK       │ │  │
│  │ • Git history queries   │  │ │ • Provider abstrac. │ │  │
│  │ • Code pattern detect.  │  │ │ • Tool definitions  │ │  │
│  │ • Context preparation   │  │ │ • Agent loop        │ │  │
│  │                         │  │ │ • OTel telemetry    │ │  │
│  └───────────┬─────────────┘  │ └─────────────────────┘ │  │
│              │                └───────────┬─────────────┘  │
│              │   CONCURRENT               │                │
│              │   (Promise.allSettled)     │                │
│              └─────────────┬──────────────┘                │
│                            ▼                               │
├─────────────────────────────────────────────────────────────┤
│  RESULT SYNTHESIS (After both tracks complete)             │
│  • Merge static + agentic findings                         │
│  • Causal link construction                                │
│  • Graceful degradation if one track fails                 │
│  • Report generation (AX/UX separation)                    │
└─────────────────────────────────────────────────────────────┘
```

**Execution Model**: Static and agentic analysis run **concurrently** per the deep research pattern (ADR-0019). Static-First means "prefer deterministic analysis" not "static must complete before agentic starts". This maximizes throughput while ensuring static results are always available (even if LLM fails).

### Agent Tool Capabilities

The agentic analyser has **read + selective write** capabilities:

**Read Operations (Full Access)**:
- Read any file in target repository
- Parse configuration files (CLAUDE.md, .cursorrules, etc.)
- Query git history, branches, blame
- Read session logs from AI tools
- Access agentlint's own baseline data

**Write Operations (Limited)**:
- Write analysis reports to agentlint output directory
- Update agentlint baselines and history
- **No writes to user's source code or configs**

### Provider Support

Initial MVP supports:
- **Anthropic** (Claude models) - Primary
- **OpenAI** (GPT models) - Secondary

Future expansion via Vercel AI SDK adapters:
- Google (Gemini)
- Local models (Ollama, LM Studio)
- Other OpenAI-compatible APIs

### Consequences

**Good:**
- Static analysis works without any LLM (Progressive Value)
- Provider-agnostic from day one (no vendor lock-in)
- Native OpenTelemetry support enables future observability
- Apache 2.0 license is permissive
- Highest ecosystem adoption reduces risk
- Agent-Aware design (compressed context for LLM, rich output for users)

**Bad:**
- Must build our own agent loop (not as batteries-included as Mastra)
- Vercel AI SDK is low-level, requires more assembly
- Two code paths (static + agentic) to maintain

**Neutral:**
- Learning curve for Vercel AI SDK patterns
- Need to implement tool definitions with Zod schemas

## Pros and Cons of Options

### Option 1: Hybrid Static Core + Vercel AI SDK Agentic

Static analysers always run (no LLM dependency); Vercel AI SDK adds semantic analysis when LLM configured. Both tracks run concurrently per deep research pattern.

- Good: Strongest alignment with Static-First principle
- Good: Provider-agnostic via adapters (swap Claude for GPT without code changes)
- Good: Native OpenTelemetry telemetry support
- Good: Apache 2.0 license, 2.8M downloads/week (most mature)
- Good: Works without LLM (Progressive Value)
- Neutral: Must build agent loop ourselves
- Bad: More assembly required than batteries-included options

### Option 2: Mastra Framework

TypeScript-native framework with built-in agents, RAG, memory, and 40+ providers.

- Good: Batteries-included (less assembly)
- Good: 40+ providers built-in
- Good: Includes RAG and memory out of box
- Good: TypeScript-native (not Python port)
- Neutral: MIT license
- Bad: More opinionated, less control over agent loop
- Bad: Lower adoption than Vercel AI SDK (fewer community resources)
- Bad: May include features we don't need (bloat)

### Option 3: Claude Agent SDK Only

Use Anthropic's Claude Agent SDK exclusively for maximum feature parity with Claude Code.

- Good: Same tools/loop as Claude Code
- Good: Built-in compaction, hooks, sandboxing
- Good: Fastest to implement
- Bad: Anthropic-only (violates multi-provider requirement)
- Bad: Vendor lock-in
- Bad: Less alignment with Tool-Agnostic principle

### Option 4: Direct SDK + Custom Abstraction

Start with Anthropic SDK, build thin provider abstraction layer ourselves.

- Good: Maximum control
- Good: Minimal dependencies
- Good: Can tailor exactly to our needs
- Bad: Most development effort
- Bad: Must maintain abstraction layer ourselves
- Bad: No community support for abstraction patterns

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | All analysis runs locally, user provides LLM credentials |
| II. Improvement-Oriented | Yes | Baselines and history tracked for continuous improvement |
| III. Causal-First | Yes | Agent tools support origin tracing (git, sessions) |
| IV. Mixed-Methods | Yes | Static (quantitative) + agentic (qualitative) analysis |
| V. Language-Agnostic | Yes | Analysis works regardless of target language |
| VI. Tool-Agnostic | Yes | Vercel AI SDK enables multi-provider support |
| VII. Static-First | Yes | Static analysis preferred and always runs; concurrent with agentic (not sequential) |
| VIII. Progressive Value | Yes | Full static analysis without LLM configuration |
| IX. Agent-Aware | Yes | Compressed context for agent, rich output for users |

## More Information

### Related Documents
- [ADR-0001: Language and Runtime Selection](./0001-language-and-runtime-selection.md) - TypeScript + Bun foundation
- [ADR-0005: Credential Storage Strategy](./0005-credential-storage-strategy.md) - How LLM credentials are accessed
- [ADR-0011: Parallel Processing Architecture](./0011-parallel-processing-architecture.md) - Concurrent execution model
- [ADR-0019: Language Ecosystem Support](./0019-language-ecosystem-support.md) - Deep research pattern (concurrent static+agentic)
- Architecture Vision: [Section 7 - agentlint Agent Design](../../agentlint-architecture-vision.md#7-agentlint-agent-design)
- Design Questions: [Section 2.1 - Agentic Analysis Implementation](../../design-questions.md#21-agentic-analysis-implementation)

### Research Sources
- [Vercel AI SDK Documentation](https://ai-sdk.dev/docs/introduction) - Official documentation
- [Vercel AI SDK GitHub](https://github.com/vercel/ai) - Apache 2.0 license, source code
- [AI SDK Telemetry](https://ai-sdk.dev/docs/ai-sdk-core/telemetry) - OpenTelemetry integration
- [Building Agents with Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) - Agent patterns
- [Claude Agent SDK Best Practices](https://skywork.ai/blog/claude-agent-sdk-best-practices-ai-agents-2025/) - Tool design principles
- [Mastra Framework](https://mastra.ai/) - Alternative TypeScript agent framework
- [VoltAgent Framework](https://voltagent.dev/) - Alternative modular framework
- [AI Agent Observability](https://opentelemetry.io/blog/2025/ai-agent-observability/) - OpenTelemetry standards
- [Best AI Observability Platforms 2025](https://www.braintrust.dev/articles/best-ai-observability-platforms-2025) - Platform comparison

### Implementation Notes

#### 1. Static Analysers (No LLM)

```typescript
// Static analysis runs first, always
interface StaticAnalyser {
  name: string;
  domain: AnalysisDomain;
  analyse(context: AnalysisContext): Promise<StaticFindings>;
}

// Examples: ConfigParser, SessionStatsExtractor, GitHistoryAnalyser
```

#### 2. Vercel AI SDK Integration

```typescript
import { generateText, tool } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

// Provider selection based on config
const model = config.provider === 'openai'
  ? openai('gpt-4-turbo')
  : anthropic('claude-sonnet-4-20250514');

// Tool definitions with Zod schemas
const readFileTool = tool({
  description: 'Read a file from the target repository',
  parameters: z.object({
    path: z.string().describe('Relative path to file'),
  }),
  execute: async ({ path }) => {
    // Implementation with security checks
  },
});

// Agentic analysis with telemetry
const result = await generateText({
  model,
  system: agentSystemPrompt,
  prompt: analysisPrompt,
  tools: { readFile: readFileTool, queryGit: queryGitTool, ... },
  maxSteps: 10, // Limit agent loop iterations
  experimental_telemetry: {
    isEnabled: config.telemetry?.enabled ?? false,
    functionId: 'agentlint.agentic-analysis',
  },
});
```

#### 3. Context Preparation (Agent-Aware)

```typescript
// Compress large inputs before sending to LLM
interface ContextPreparation {
  // Static extraction (metrics, counts, structure)
  extractMetrics(sessionLog: SessionLog): SessionMetrics;

  // Hierarchical summarization
  compressContext(input: LargeInput): CompressedContext;

  // Sample selection for deep analysis
  selectSamples(findings: StaticFindings): CodeSamples;
}
```

#### 4. AX/UX Separation

```typescript
// What the agent receives (compressed)
interface AgentContext {
  taskGoal: string;
  projectSummary: ProjectSummary;  // Compressed
  staticFindings: CompressedFindings;
  codeSamples: CodeSample[];  // Selected, not full files
}

// What the user receives (rich)
interface UserReport {
  summary: string;
  detailedFindings: DetailedFinding[];
  tracedOrigins: CausalTrace[];
  recommendations: Recommendation[];
  visualizations?: TrendChart[];
}
```

### Follow-up Design Questions

This ADR surfaces the need for additional decisions:

1. **Observability Strategy** (new Section 4.x): How should opt-in telemetry be implemented? What data is collected? Where is it sent?

2. **LLM Provider Abstraction** (Section 2.2): Detailed provider configuration and switching patterns.

3. **Session Log Analysis Strategy** (Section 2.3): How to handle 100MB+ logs within context limits.
