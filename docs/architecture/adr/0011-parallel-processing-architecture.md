---
status: accepted
date: 2026-01-13
decision-makers: [CTO, Architecture Lead]
consulted: [Development Team]
informed: [All Contributors]
---

# ADR-0011: Agent Tool Concurrency and Subagent Pattern

## Context and Problem Statement

agentlint's analysis agent must complete analysis within acceptable time bounds (target: 30 seconds per North Star) while processing:
- Large codebases (thousands of files)
- 100MB+ session logs (Claude Code JSONL)
- Multiple analysis domains (config, sessions, docs, code patterns)

The agent can achieve this through two mechanisms:
1. **Concurrent tool invocation**: Invoke multiple tools in parallel
2. **Subagent delegation**: Delegate domain analysis to specialized subagents

This ADR defines how the agent leverages these mechanisms while maintaining deterministic, reproducible outputs.

## Decision Drivers

- **Performance target**: 30-second analysis for typical projects
- **Agent orchestration**: The agent decides what to run (see ADR-0006)
- **Agent flexibility**: Agent chooses between tools and direct reasoning as needed
- **Reproducibility**: Same input must produce same output
- **Memory constraints**: Developer machines vary; must be memory-conscious
- **Cost control**: Subagent delegation increases token usage; needs justification

## Considered Options

1. Single Agent with Concurrent Tool Invocation
2. Single Agent with Subagent Delegation for Domains
3. Sequential Tool Invocation (Simplest)
4. Full Subagent Parallelism (Maximum Delegation)

## Decision Outcome

Chosen option: **"Single Agent with Subagent Delegation for Domains"** because it:
1. Enables the orchestrating agent to delegate complex domain analysis
2. Provides context isolation between analysis domains
3. Applies Claude Code's proven orchestrator-worker architecture
4. Allows the agent to decide when parallelism is appropriate

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         agentlint Analysis Agent                            │
│                                                                             │
│  The agent orchestrates analysis. It can:                                   │
│  • Invoke multiple tools concurrently                                       │
│  • Delegate domain analysis to subagents                                    │
│  • Synthesize all findings into recommendations                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  AGENT DECISION: What to analyze?                                           │
│            │                                                                │
│            ├── Simple queries → Direct tool invocation                      │
│            │   (e.g., "Read CLAUDE.md" → ConfigParserTool)                  │
│            │                                                                │
│            └── Complex analysis → Subagent delegation                       │
│                (e.g., "Analyze all sessions" → SessionAnalyserSubagent)     │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CONCURRENT TOOL INVOCATION                                                 │
│  ─────────────────────────────────────────                                  │
│  Agent can invoke multiple tools in parallel:                               │
│                                                                             │
│  Agent thinks: "I need config, session stats, and git history"              │
│    → ConfigParserTool.parse("CLAUDE.md")     ─┐                             │
│    → SessionStatsTool.analyze()              ─┼─ Concurrent                 │
│    → GitQueryTool.history(".")               ─┘                             │
│                                                                             │
│  Tools complete quickly (~100ms each)                                       │
│  Agent waits for all, then reasons about combined results                   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SUBAGENT DELEGATION                                                        │
│  ───────────────────────────────                                            │
│  For complex domain analysis, agent delegates to subagents:                 │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ORCHESTRATING AGENT                                                 │    │
│  │                                                                     │    │
│  │ "This project has many sessions. I'll delegate session analysis"   │    │
│  │                                                                     │    │
│  │         ┌────────────────┬────────────────┬────────────────┐       │    │
│  │         │                │                │                │       │    │
│  │         ▼                ▼                ▼                ▼       │    │
│  │   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    │    │
│  │   │  CONFIG  │    │ SESSION  │    │   DOCS   │    │   CODE   │    │    │
│  │   │ SUBAGENT │    │ SUBAGENT │    │ SUBAGENT │    │ SUBAGENT │    │    │
│  │   │          │    │          │    │          │    │          │    │    │
│  │   │ Analyzes │    │ Analyzes │    │ Analyzes │    │ Analyzes │    │    │
│  │   │ AI       │    │ session  │    │ README,  │    │ AST      │    │    │
│  │   │ configs  │    │ logs     │    │ docs/    │    │ patterns │    │    │
│  │   └────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘    │    │
│  │        │               │               │               │          │    │
│  │        └───────────────┴───────────────┴───────────────┘          │    │
│  │                                │                                   │    │
│  │                                ▼                                   │    │
│  │                    ┌─────────────────────┐                        │    │
│  │                    │   ORCHESTRATOR      │                        │    │
│  │                    │   SYNTHESIS         │                        │    │
│  │                    │                     │                        │    │
│  │                    │ Merges subagent     │                        │    │
│  │                    │ findings, generates │                        │    │
│  │                    │ recommendations     │                        │    │
│  │                    └─────────────────────┘                        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### When to Use Subagents

The orchestrating agent decides when subagent delegation is appropriate:

| Scenario | Direct Tool | Subagent | Rationale |
|----------|-------------|----------|-----------|
| Parse single config file | Yes | No | Quick, deterministic |
| Analyze 50 session logs | No | Yes | Context isolation, parallelism |
| Check git history | Yes | No | Simple query |
| Deep code pattern analysis | Maybe | Maybe | Depends on codebase size |
| Cross-domain correlation | No | Yes | Each domain needs focus |

### Subagent Pattern Details

Inspired by [Claude Code's architecture](https://code.claude.com/docs/en/sub-agents), agentlint adopts the orchestrator-worker pattern:

| Aspect | Claude Code | agentlint |
|--------|-------------|-----------|
| Orchestrator | Claude Opus 4 | User-configured model |
| Workers | Claude Sonnet 4 subagents | Specialized analysis subagents |
| Max Parallel | 10 subagents | 5 subagents (MVP) |
| Context Isolation | Each has own 200K window | Each has compressed domain context |
| Nesting | Subagents cannot spawn subagents | Same constraint |
| Batch Mode | Wait for all to complete | Same pattern |

**Subagent Types**:

| Subagent | Domain | Input | Output |
|----------|--------|-------|--------|
| ConfigAnalyser | AI Config | CLAUDE.md, .cursorrules | Config quality findings |
| SessionAnalyser | Sessions | Session log excerpts | Causal traces, patterns |
| DocsAnalyser | Documentation | README, docs/ | Docs quality findings |
| CodePatternAnalyser | Code | AST summaries | Pattern violations |

### Concurrency Configuration

```typescript
interface ConcurrencyConfig {
  // Tool invocation
  tools: {
    maxConcurrent: number;     // Default: 5 (how many tools can run simultaneously)
  };

  // Subagent delegation
  subagents: {
    maxParallel: number;       // Default: 4 (MVP), max: 10
    llmConcurrency: number;    // Default: 3 (respects rate limits)
    requestsPerMinute: number; // Default: 50 (Anthropic tier 1)
  };

  // Global
  deterministic: boolean;      // Default: true (sort results)
}
```

**Rate Limiting Strategy**:
- Token bucket with sliding window
- Exponential backoff on 429 errors
- Queue excess requests rather than fail
- Orchestrating agent monitors budget

### Determinism Implementation

Concurrent execution produces results in non-deterministic order. To guarantee reproducibility:

```typescript
interface DeterminismStrategy {
  // 1. Collect all results without assuming order
  collectResults(sources: ResultSource[]): Promise<Result[]>;

  // 2. Normalize results
  normalizeTimestamps(results: Result[], analysisStartTime: Date): Result[];

  // 3. Sort deterministically
  sortResults(results: Result[]): Result[] {
    return results.sort((a, b) => {
      // Primary: domain
      if (a.domain !== b.domain) return a.domain.localeCompare(b.domain);
      // Secondary: file path
      if (a.filePath !== b.filePath) return a.filePath.localeCompare(b.filePath);
      // Tertiary: line number
      if (a.line !== b.line) return a.line - b.line;
      // Quaternary: finding type
      return a.type.localeCompare(b.type);
    });
  }

  // 4. Deduplicate equivalent findings
  deduplicate(results: Result[]): Result[];
}
```

### Consequences

**Good:**
- 30-second target achievable through concurrent tool invocation
- Subagent pattern proven effective (Claude Code's 90.2% improvement)
- Context isolation prevents "pollution" between analysis domains
- Deterministic output supports reproducible baselines
- Agent decides when parallelism is appropriate (not hardcoded)

**Bad:**
- Subagent delegation increases token costs (3-4x per Claude benchmarks), though enables significantly faster comprehensive analysis
- More complex than purely sequential analysis
- Batch completion waiting may leave some subagents idle

**Neutral:**
- Subagent count configurable for cost/speed tradeoff
- Determinism adds ~5% overhead for sorting/normalization

## Pros and Cons of Options

### Option 1: Single Agent with Concurrent Tool Invocation

Agent invokes multiple tools concurrently but handles all reasoning itself.

- Good: Simpler than subagents, lower token cost
- Good: Agent maintains full context
- Neutral: Some parallelism benefit from concurrent tools
- Bad: May hit context limits on large projects
- Bad: No domain isolation

### Option 2: Single Agent with Subagent Delegation (Chosen)

Agent delegates complex domain analysis to specialized subagents.

- Good: Context isolation per domain
- Good: Proven pattern from Claude Code
- Good: Agent decides when to delegate
- Neutral: Higher token cost for subagents
- Bad: More complex orchestration

### Option 3: Sequential Tool Invocation

Agent invokes tools one at a time, reasons after each.

- Good: Simplest implementation
- Good: Agent can adapt based on each result
- Good: Naturally deterministic
- Bad: Slowest performance
- Bad: May not hit 30-second target

### Option 4: Full Subagent Parallelism

Always delegate everything to subagents.

- Good: Maximum parallelism
- Good: Complete domain isolation
- Bad: Highest token cost
- Bad: Orchestrator overhead even for simple queries
- Bad: Agent loses ability to make direct queries

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | All analysis runs locally |
| II. Improvement-Oriented | Yes | Faster analysis enables more frequent baselining |
| III. Causal-First | Yes | Subagent isolation doesn't impede tracing |
| IV. Mixed-Methods | Yes | Tools (quantitative) + agent reasoning (qualitative/semantic) |
| V. Language-Agnostic | Yes | Works regardless of target language |
| VI. Tool-Agnostic | Yes | Adapter pattern unaffected |
| VII. Intelligent Tooling | Yes | Tools serve agent needs; subagents handle complex domain analysis |
| VIII. Compounding Value | Yes | Value compounds through baseline tracking |
| IX. Agent-Aware | Yes | Subagent pattern applies AX principles |

## More Information

### Related Documents
- [ADR-0006: Agent-Orchestrated Analysis](./0006-agent-orchestrated-analysis.md) - Agent architecture
- [ADR-0007: Causal Analysis Architecture](./0007-causal-analysis-architecture.md) - Session analysis pipeline
- [ADR-0008: Session Quality Analysis](./0008-session-quality-analysis.md) - Analysis dimensions
- Architecture Vision: [Section 7 - agentlint Agent Design](../../agentlint-architecture-vision.md#7-agentlint-agent-design)

### Research Sources
- [Claude Code Subagents Documentation](https://code.claude.com/docs/en/sub-agents) - Official subagent architecture
- [Multi-Agent Parallel Coding with Claude Code Subagents](https://medium.com/@codecentrevibe/claude-code-multi-agent-parallel-coding-83271c4675fa) - Practical patterns
- [Building Agents with Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) - Official SDK patterns
- [LLM Rate Limits Best Practices](https://www.requesty.ai/blog/rate-limits-for-llm-providers-openai-anthropic-and-deepseek) - Rate limiting

### Implementation Notes

#### 1. Concurrent Tool Invocation

```typescript
import { generateText, tool } from 'ai';

// Agent can request multiple tool calls in parallel
// Vercel AI SDK handles concurrent execution
const result = await generateText({
  model,
  system: agentSystemPrompt,
  prompt: analysisPrompt,
  tools: {
    parseConfig: configParserTool,
    getSessionStats: sessionStatsTool,
    queryGit: gitQueryTool,
    // ... other tools
  },
  maxSteps: 20,
  // The agent decides which tools to call and whether to call them concurrently
});

// Agent's tool calls might look like:
// Step 1: [parseConfig("CLAUDE.md"), getSessionStats(), queryGit(".")] - concurrent
// Step 2: Agent reasons about combined results
// Step 3: [searchSessions("error")] - based on reasoning
```

#### 2. Subagent Delegation

```typescript
// The orchestrating agent decides to delegate
async function delegateToSubagents(
  orchestratorContext: OrchestratorContext,
  domains: AnalysisDomain[]
): Promise<SubagentResults> {
  // Create subagent tasks
  const subagentTasks = domains.map(domain => ({
    domain,
    context: compressContextForDomain(orchestratorContext, domain),
    tools: DOMAIN_TOOLS[domain],
  }));

  // Run subagents in parallel (respecting concurrency limits)
  const results = await Promise.all(
    subagentTasks.map(task => runSubagent(task))
  );

  return {
    domains: results,
    synthesisNeeded: true,
  };
}

async function runSubagent(task: SubagentTask): Promise<SubagentResult> {
  const result = await generateText({
    model: getSubagentModel(),
    system: SUBAGENT_PROMPTS[task.domain],
    prompt: task.context,
    tools: task.tools,
    maxSteps: 10, // Subagents are focused
  });

  return {
    domain: task.domain,
    findings: parseSubagentOutput(result),
  };
}
```

#### 3. Determinism Normalization

```typescript
function normalizeResults(
  results: AnalysisResult[],
  analysisStartTime: Date
): AnalysisResult[] {
  return results
    // Normalize timestamps
    .map(r => ({ ...r, timestamp: analysisStartTime }))
    // Sort deterministically
    .sort((a, b) => {
      const domainCmp = a.domain.localeCompare(b.domain);
      if (domainCmp !== 0) return domainCmp;
      const pathCmp = (a.filePath ?? '').localeCompare(b.filePath ?? '');
      if (pathCmp !== 0) return pathCmp;
      return (a.line ?? 0) - (b.line ?? 0);
    })
    // Deduplicate
    .filter((r, i, arr) => i === 0 || computeHash(r) !== computeHash(arr[i-1]));
}
```

### Performance Expectations

| Project Size | Sequential Tools | Concurrent Tools | With Subagents |
|--------------|------------------|------------------|----------------|
| Small (100 files) | ~15s | ~8s | ~10s (overhead) |
| Medium (1000 files) | ~45s | ~20s | ~25s |
| Large (5000 files) | ~120s | ~45s | ~30s |

*Note: Subagents add value for large projects where domain isolation and parallel LLM reasoning improve quality and speed.*

### Follow-Up Decisions

1. **Subagent Tool Sharing**: Should subagents share read-only tools? (memory efficiency vs isolation)
2. **Adaptive Delegation**: Should the agent learn when subagent delegation improves results?
3. **Budget Allocation**: How should token budget be split between orchestrator and subagents?
