---
status: accepted
date: 2026-01-13
decision-makers: [CTO, Architecture Lead]
consulted: [Development Team]
informed: [All Contributors]
---

# ADR-0006: Agent-Orchestrated Analysis Architecture

## Context and Problem Statement

agentlint is an **agentic application**. An LLM-powered agent orchestrates the entire analysis process, using static analysis capabilities as tools. This ADR defines how the analysis agent is implemented, what tools it has access to, and how it synthesizes findings into actionable recommendations.

The agent must be provider-agnostic (supporting multiple LLM providers), have full tool use capabilities (reading files, querying git, parsing configs), and embody the AX principles that agentlint recommends to users.

## Decision Drivers

- **Agent IS the orchestrator**: The agent decides what to analyze and when, based on what it learns
- **Agent flexibility**: The agent chooses freely between tool use and direct reasoning—no approach is privileged
- **Multi-provider requirement**: Must support Anthropic, OpenAI, and potentially local models
- **Full tool use**: Agent needs tools for reading files, exploring codebase, querying git
- **Deep reasoning capability**: Agent must be able to reason about WHY things happened, not just extract WHAT
- **Agent-Aware principle**: Apply AX/UX/DX framework to our own agent design
- **LLM Required**: agentlint requires an LLM to function (agent cannot reason without it)
- **Open source**: Prefer permissively licensed dependencies

## Considered Options

1. Agent-Orchestrated with Vercel AI SDK
2. Mastra Framework (Batteries-Included)
3. Claude Agent SDK Only
4. Direct SDK + Custom Provider Abstraction

## Decision Outcome

Chosen option: **"Agent-Orchestrated with Vercel AI SDK"** because it provides the provider-agnostic infrastructure needed for the orchestrating agent while giving us full control over tool definitions and the agent loop. The Vercel AI SDK (Apache 2.0) has the highest adoption (2.8M downloads/week), native OpenTelemetry support, and excellent TypeScript ergonomics.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        agentlint CLI                         │
│  Parses commands, renders output, manages configuration     │
├─────────────────────────────────────────────────────────────┤
│                    Analysis Agent (LLM)                      │
│                                                             │
│  The agent IS the orchestrator. It:                         │
│  • Receives analysis task from CLI                          │
│  • Reasons about what to analyze                            │
│  • Invokes tools to gather data                             │
│  • Synthesizes findings into insights                       │
│  • Generates recommendations                                │
│                                                             │
│  Implemented via Vercel AI SDK (provider-agnostic)          │
├─────────────────────────────────────────────────────────────┤
│                        Agent Tools                           │
│                                                             │
│  Tools serving the agent's cognitive needs:                 │
│                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ ConfigParser│ │SessionStats │ │  GitQuery   │           │
│  │    Tool     │ │    Tool     │ │    Tool     │           │
│  │             │ │             │ │             │           │
│  │ Parse AI    │ │ Extract     │ │ Query git   │           │
│  │ config files│ │ session     │ │ history,    │           │
│  │ (CLAUDE.md, │ │ metrics     │ │ blame, diff │           │
│  │ .cursorrules│ │ from logs   │ │             │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
│                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │  ReadFile   │ │  Baseline   │ │    FTS5     │           │
│  │    Tool     │ │  Query Tool │ │  Search     │           │
│  │             │ │             │ │    Tool     │           │
│  │ Read any    │ │ Query       │ │ Full-text   │           │
│  │ file in     │ │ historical  │ │ search      │           │
│  │ target repo │ │ baselines   │ │ session logs│           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
│                                                             │
│  ┌─────────────┐ ┌─────────────┐                           │
│  │  Language   │ │  SaveFinding│                           │
│  │ Analyzer    │ │    Tool     │                           │
│  │    Tool     │ │             │                           │
│  │ Get type    │ │ Persist     │                           │
│  │ coverage,   │ │ findings,   │                           │
│  │ function    │ │ create      │                           │
│  │ metrics     │ │ baseline    │                           │
│  └─────────────┘ └─────────────┘                           │
├─────────────────────────────────────────────────────────────┤
│                    Support Services                          │
│                                                             │
│  SQLite Storage │ AI Tool Adapters │ Observability          │
│  (findings,     │ (Claude Code     │ (OpenTelemetry         │
│  baselines,     │ session parser,  │ for agent              │
│  history)       │ future tools)    │ telemetry)             │
└─────────────────────────────────────────────────────────────┘
```

### Agent Flexibility: Tools and Reasoning

The agent has **full autonomy** to choose its approach based on what the task requires. No approach is privileged.

**Tools serve the agent's cognitive needs** by helping it understand:
- What is configured (AI config files, CLAUDE.md, etc.)
- How content is structured (docs, code, folders)
- What happened in sessions (metrics, errors, patterns)
- How things evolved (git history, baseline trends)

**Agent reasoning provides deep understanding** that tools cannot:
- **WHY** things happened (not just WHAT)
- **Quality judgments** (was this a good agentic flow? error ≠ bad)
- **Causal analysis** (what led to this outcome?)
- **Semantic understanding** (intent, context, implications)

**Example: Session Analysis**
- Tools CAN: Parse logs, extract metadata, identify errors, tag positions
- Tools CANNOT: Understand why errors occurred, evaluate flow quality, reason about whether better Skills would have helped
- The agent uses BOTH to produce complete understanding

The agent freely chooses when to use tools (for structured data extraction) and when to read/reason directly (for semantic understanding).

### Agent Tool Definitions

Tools exist to serve the agent's cognitive needs. The agent decides when to use them.

| Tool | Purpose | What It Helps The Agent Understand |
|------|---------|-----------------------------------|
| `ConfigParserTool` | Parse AI config files | What's configured, structure, potential issues |
| `SessionStatsTool` | Extract session metrics | What happened in sessions (tokens, events, patterns) |
| `GitQueryTool` | Query git history | How things evolved, who changed what, when |
| `ReadFileTool` | Read any file | Content of files the agent wants to analyze directly |
| `BaselineQueryTool` | Query historical data | How current state compares to past |
| `FTS5SearchTool` | Full-text search | Find specific patterns across session logs |
| `LanguageAnalyzerTool` | Get code metrics | Type coverage, function sizes, language-specific info |
| `SaveFindingTool` | Persist findings | Store analysis results for future comparison |

**Write Constraints**: The agent can only write to agentlint's own data directory. No writes to user's source code or configs.

**Note**: The agent can also read and reason about files directly without tools when semantic understanding is needed (e.g., understanding WHY an error occurred in a session log).

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
- Agent-orchestrated architecture enables sophisticated reasoning
- Provider-agnostic from day one (no vendor lock-in)
- Full agent flexibility—can use tools OR reason directly based on task
- Native OpenTelemetry support enables observability
- Apache 2.0 license is permissive
- Agent can adapt analysis based on what it discovers
- Deep semantic analysis enables understanding WHY, not just WHAT

**Bad:**
- LLM is required (no fallback mode without it)
- Must build our own agent loop (not batteries-included)
- Token costs for every analysis run

*Note: Agent reasoning enables semantic understanding and causal analysis that tools alone cannot provide. Latency is inherent to deep analysis—the tradeoff is depth of insight vs. speed.*

**Neutral:**
- Learning curve for Vercel AI SDK patterns
- Need to implement tool definitions with Zod schemas

## Pros and Cons of Options

### Option 1: Agent-Orchestrated with Vercel AI SDK

Single analysis agent orchestrates everything with full flexibility. Vercel AI SDK provides provider abstraction.

- Good: Agent can reason about what to analyze based on discoveries
- Good: Provider-agnostic via adapters (swap Claude for GPT without code changes)
- Good: Native OpenTelemetry telemetry support
- Good: Apache 2.0 license, 2.8M downloads/week (most mature)
- Good: Full agent flexibility—tools AND direct reasoning both available
- Neutral: Must build agent loop ourselves
- Bad: LLM required for any analysis

### Option 2: Mastra Framework

TypeScript-native framework with built-in agents, RAG, memory, and 40+ providers.

- Good: Batteries-included (less assembly)
- Good: 40+ providers built-in
- Good: Includes RAG and memory out of box
- Neutral: MIT license
- Bad: More opinionated, less control over agent loop
- Bad: Lower adoption than Vercel AI SDK
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
- Bad: Most development effort
- Bad: Must maintain abstraction layer ourselves
- Bad: No community support for abstraction patterns

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | All analysis runs locally, user provides LLM credentials |
| II. Improvement-Oriented | Yes | Agent persists findings for continuous improvement |
| III. Causal-First | Yes | Agent reasons about origins using tools AND direct reasoning |
| IV. Mixed-Methods | Yes | Tools (quantitative) + agent reasoning (qualitative/semantic) |
| V. Language-Agnostic | Yes | Agent works regardless of target language |
| VI. Tool-Agnostic | Yes | Vercel AI SDK enables multi-provider support |
| VII. Intelligent Tooling | Yes | Tools serve agent needs; agent chooses approach freely |
| VIII. Compounding Value | Yes | Value compounds through baseline tracking |
| IX. Agent-Aware | Yes | Agent design embodies AX principles |

## More Information

### Related Documents
- [ADR-0001: Language and Runtime Selection](./0001-language-and-runtime-selection.md) - TypeScript + Bun foundation
- [ADR-0005: Credential Storage Strategy](./0005-credential-storage-strategy.md) - How LLM credentials are accessed
- [ADR-0011: Parallel Processing Architecture](./0011-parallel-processing-architecture.md) - Agent may invoke tools concurrently
- [ADR-0014: Error Handling and Recovery](./0014-error-handling-and-recovery.md) - LLM error handling
- [Constitution](../../../.specify/memory/constitution.md) - Architectural foundation

### Research Sources
- [Vercel AI SDK Documentation](https://ai-sdk.dev/docs/introduction) - Official documentation
- [Vercel AI SDK GitHub](https://github.com/vercel/ai) - Apache 2.0 license, source code
- [AI SDK Telemetry](https://ai-sdk.dev/docs/ai-sdk-core/telemetry) - OpenTelemetry integration
- [Building Agents with Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) - Agent patterns

### Implementation Notes

#### 1. Agent Loop with Vercel AI SDK

```typescript
import { generateText, tool } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

// Provider selection based on config
const model = config.provider === 'openai'
  ? openai('gpt-4-turbo')
  : anthropic('claude-sonnet-4-20250514');

// Agent orchestrates analysis
const result = await generateText({
  model,
  system: `You are agentlint's analysis agent. Your task is to analyze this
repository for AI coding effectiveness.

You have full flexibility to use tools and direct reasoning as needed:
- Use tools when you need structured data (config parsing, metrics, git history)
- Read and reason about files directly when you need semantic understanding
- Focus on understanding WHY things happened, not just WHAT

Your goal is deep understanding that leads to actionable recommendations.`,
  prompt: analysisPrompt,
  tools: {
    parseConfig: configParserTool,
    getSessionStats: sessionStatsTool,
    queryGit: gitQueryTool,
    readFile: readFileTool,
    queryBaseline: baselineQueryTool,
    searchSessions: fts5SearchTool,
    analyzeLanguage: languageAnalyzerTool,
    saveFinding: saveFindingTool,
  },
  maxSteps: 20, // Allow agent sufficient iterations
  experimental_telemetry: {
    isEnabled: config.telemetry?.enabled ?? false,
    functionId: 'agentlint.analysis-agent',
  },
});
```

#### 2. Tool Definition Example

```typescript
const configParserTool = tool({
  description: 'Parse an AI coding assistant config file (CLAUDE.md, .cursorrules, etc.)',
  parameters: z.object({
    path: z.string().describe('Path to config file'),
  }),
  execute: async ({ path }) => {
    // Structured extraction - gives agent factual foundation
    const content = await readFile(path);
    const parsed = parseConfigFile(content, path);
    return {
      path,
      format: parsed.format,
      lineCount: parsed.lineCount,
      sections: parsed.sections,
      issues: parsed.issues,  // Missing sections, invalid syntax, etc.
    };
  },
});
```

#### 3. Agent Context (AX/UX Separation)

```typescript
// What the agent receives (task-focused, compressed)
interface AgentTask {
  goal: string;  // "Analyze this repository for AI coding effectiveness"
  projectPath: string;
  previousBaseline?: BaselineSummary;  // Compressed, not full history
}

// What the user receives (rich, detailed)
interface UserReport {
  summary: string;
  score: EffectivenessScore;
  findings: DetailedFinding[];
  recommendations: Recommendation[];
  trends?: TrendVisualization[];
}
```

### Agent Behavior Example

```
1. Agent receives: "Analyze /path/to/repo for AI coding effectiveness"

2. Agent thinks: "I should first detect what AI tools are configured"
   → Invokes: ConfigParserTool.detect()
   → Receives: {found: ["CLAUDE.md"], tools: ["claude-code"]}

3. Agent thinks: "Let me parse the CLAUDE.md to understand the config"
   → Invokes: ConfigParserTool.parse("CLAUDE.md")
   → Receives: {lineCount: 500, sections: [...], issues: ["missing workflow"]}

4. Agent thinks: "500 lines is long. Let me check session compression"
   → Invokes: SessionStatsTool.analyze()
   → Receives: {avgTokens: 50K, compressionEvents: 5, ...}

5. Agent thinks: "High token usage + compression events. Config length may be a factor.
   Let me check when CLAUDE.md was last modified."
   → Invokes: GitQueryTool.history("CLAUDE.md")
   → Receives: {lastModified: "2 months ago", commits: [...]}

6. Agent synthesizes: Long config + high tokens + compression + stale updates
   → Generates recommendation: "Consider splitting CLAUDE.md into modular files"
   → Invokes: SaveFindingTool with causal trace

7. Agent returns: Complete analysis report to CLI
```
