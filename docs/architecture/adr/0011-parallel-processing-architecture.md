---
status: accepted
date: 2026-01-12
decision-makers: [CTO, Architecture Lead]
consulted: [Development Team]
informed: [All Contributors]
---

# ADR-0011: Parallel Processing Architecture

## Context and Problem Statement

agentlint must analyze projects within acceptable time bounds (target: 30 seconds per North Star) while processing:
- Large codebases (thousands of files)
- 100MB+ session logs (Claude Code JSONL)
- Multiple analysis domains (config, sessions, docs, code patterns)
- Optional LLM-powered semantic analysis

Sequential processing is too slow for large projects. This ADR defines how agentlint leverages parallelism while maintaining deterministic, reproducible outputs.

A key insight from studying Claude Code's architecture: the **subagent pattern** (orchestrator coordinates isolated workers) has proven highly effective for complex analysis tasks, achieving 90.2% improvement over single-agent systems on research tasks.

## Decision Drivers

- **Performance target**: 30-second analysis for typical projects
- **Static-First principle**: Maximize static analysis; runs concurrently with LLM per ADR-0019
- **Agent-Aware principle**: Apply proven agentic patterns (subagents) to our own design
- **Reproducibility**: Same input must produce same output (deterministic)
- **Memory constraints**: Developer machines vary; must be memory-conscious
- **Bun runtime**: ADR-0001 selected Bun; leverage its concurrency primitives
- **Cost control**: Parallel LLM calls increase token usage; need rate limiting

## Considered Options

1. Layered Parallelism with Subagent Pattern
2. Single-Agent with Concurrent Tools
3. Static-Only Parallelism (Sequential Agentic)
4. Fully Sequential Processing

## Decision Outcome

Chosen option: **"Layered Parallelism with Subagent Pattern"** because it:
1. Maximizes throughput for the 30-second target
2. Applies Claude Code's proven orchestrator-worker architecture
3. Enables deterministic output through post-execution normalization
4. Separates concerns cleanly (static parallelism vs. agentic parallelism)

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PARALLEL PROCESSING ARCHITECTURE                          │
│                                                                             │
│  Deep Research Pattern: Static + Agentic run CONCURRENTLY (not sequential) │
│  See ADR-0019 for research on OpenAI/Gemini/Claude deep research patterns  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────────────────┐    ┌────────────────────────────────┐  │
│  │ TRACK A: STATIC ANALYSIS       │    │ TRACK B: AGENTIC ANALYSIS      │  │
│  │ (CPU-bound, Worker Pools)      │    │ (LLM-bound, Subagent Pattern)  │  │
│  │                                │    │                                │  │
│  │ ┌──────────┐ ┌──────────┐     │    │     ┌─────────────────────┐    │  │
│  │ │ File     │ │ AST      │     │    │     │ ORCHESTRATOR AGENT  │    │  │
│  │ │ Scanner  │ │ Parser   │     │    │     │ • Plans subagent    │    │  │
│  │ │ Pool     │ │ Pool     │     │    │     │   tasks             │    │  │
│  │ └──────────┘ └──────────┘     │    │     │ • Delegates work    │    │  │
│  │ ┌──────────┐ ┌──────────┐     │    │     └─────────┬───────────┘    │  │
│  │ │ Session  │ │ Language │     │    │               │                │  │
│  │ │ Parser   │ │ Metrics  │     │    │    ┌──────────┼──────────┐     │  │
│  │ │ Pool     │ │ Pool     │     │    │    ▼          ▼          ▼     │  │
│  │ └──────────┘ └──────────┘     │    │ ┌──────┐ ┌──────┐ ┌──────┐    │  │
│  │         │                     │    │ │CONFIG│ │SESSION│ │DOCS  │    │  │
│  │         ▼                     │    │ │SUB   │ │SUB    │ │SUB   │    │  │
│  │ ┌─────────────────────┐       │    │ │AGENT │ │AGENT  │ │AGENT │    │  │
│  │ │ STATIC AGGREGATOR   │       │    │ └──────┘ └──────┘ └──────┘    │  │
│  │ │ • Collect results   │       │    │    │          │          │     │  │
│  │ │ • Sort deterministic│       │    │    └──────────┼──────────┘     │  │
│  │ │ • Build metrics     │       │    │               ▼                │  │
│  │ └─────────────────────┘       │    │     ┌─────────────────────┐    │  │
│  │         │                     │    │     │ AGENTIC SYNTHESIS   │    │  │
│  │         │                     │    │     │ • Merge subagent    │    │  │
│  │         │                     │    │     │   results           │    │  │
│  │         │                     │    │     └─────────────────────┘    │  │
│  └─────────┼─────────────────────┘    └────────────────┼───────────────┘  │
│            │                                           │                   │
│            │      CONCURRENT EXECUTION                 │                   │
│            │      (Promise.allSettled)                 │                   │
│            │                                           │                   │
│            └─────────────────┬─────────────────────────┘                   │
│                              ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ FINAL SYNTHESIS (Runs after both tracks complete)                   │   │
│  │                                                                      │   │
│  │ • Merge static metrics + agentic findings                           │   │
│  │ • Cross-reference for causal links                                  │   │
│  │ • Graceful degradation: if one track fails, use other's results    │   │
│  │ • Deterministic normalization (sort, dedupe, timestamp normalize)   │   │
│  │                                                                      │   │
│  │ Result: Same input → Same output (regardless of execution order)    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Insight from Deep Research Patterns** (ADR-0019):

Research into OpenAI, Gemini, and Claude's deep research implementations reveals that **static and LLM analysis should run concurrently**, not sequentially:
- Results stream as they complete (static Layer 1 arrives first, being fastest)
- Failures in one track don't block the other (graceful degradation)
- Final synthesis merges insights from both tracks

This differs from a naive "static-first" interpretation where static must complete before agentic begins.

### Subagent Pattern Details

Inspired by [Claude Code's architecture](https://code.claude.com/docs/en/sub-agents), agentlint adopts the orchestrator-worker pattern:

| Aspect | Claude Code | agentlint |
|--------|-------------|-----------|
| Orchestrator | Claude Opus 4 | User-configured model |
| Workers | Claude Sonnet 4 subagents | Specialized analysis subagents |
| Max Parallel | 10 subagents | 5 subagents (MVP) |
| Context Isolation | Each has own 200K window | Each has own compressed context |
| Nesting | Subagents cannot spawn subagents | Same constraint |
| Batch Mode | Wait for all to complete | Same pattern |

**Subagent Types**:

| Subagent | Domain | Input | Output |
|----------|--------|-------|--------|
| ConfigAnalyser | AI Config | CLAUDE.md, .cursorrules | Config quality findings |
| SessionAnalyser | Sessions | Session log excerpts | Causal traces, patterns |
| DocsAnalyser | Documentation | README, docs/ | Docs quality findings |
| CodePatternAnalyser | Code | AST summaries | Pattern violations |
| CrossReferenceAnalyser | Cross-cutting | All subagent outputs | Unified recommendations |

### Concurrency Limits and Rate Limiting

```typescript
interface ConcurrencyConfig {
  // Static analysis (CPU-bound)
  static: {
    maxWorkers: number;       // Default: CPU cores - 1
    memoryLimitMB: number;    // Default: 512MB per worker
  };

  // Agentic analysis (LLM-bound)
  agentic: {
    maxSubagents: number;     // Default: 5 (MVP), max: 10
    llmConcurrency: number;   // Default: 3 (respects rate limits)
    requestsPerMinute: number; // Default: 50 (Anthropic tier 1)
  };

  // Global
  deterministic: boolean;     // Default: true (sort results)
}
```

**Rate Limiting Strategy** (per [best practices](https://www.requesty.ai/blog/rate-limits-for-llm-providers-openai-anthropic-and-deepseek)):
- Token bucket with sliding window
- Exponential backoff on 429 errors
- Pre-check estimated tokens before dispatch
- Queue excess requests rather than fail

### Memory Budget

Per [Bun's worker documentation](https://bun.com/docs/runtime/workers), workers share I/O resources but have isolated heaps:

```typescript
interface MemoryBudget {
  // Static analysis budget
  perWorkerMB: 512;           // Max heap per worker
  maxTotalWorkersMB: 2048;    // Cap total worker memory

  // Subagent context budget
  perSubagentTokens: 50_000;  // Compressed context per subagent
  orchestratorTokens: 100_000; // Orchestrator context budget
}
```

### Determinism Implementation

Parallel execution produces results in non-deterministic order. To guarantee reproducibility:

```typescript
interface DeterminismStrategy {
  // 1. Collect all results without assuming order
  collectResults(workers: Worker[]): Promise<Result[]>;

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
  deduplicate(results: Result[]): Result[] {
    const seen = new Set<string>();
    return results.filter(r => {
      const hash = computeContentHash(r);
      if (seen.has(hash)) return false;
      seen.add(hash);
      return true;
    });
  }
}
```

### Consequences

**Good:**
- 30-second target achievable for large projects
- Subagent pattern proven effective (Claude Code's 90.2% improvement)
- Context isolation prevents "pollution" between analysis domains
- Deterministic output supports reproducible baselines
- Rate limiting prevents API quota exhaustion
- Memory budgets prevent OOM on constrained machines

**Bad:**
- 3-4x more tokens for agentic analysis (per Claude Code benchmarks)
- More complex than sequential (orchestrator + subagents)
- Worker threads in Bun are still experimental
- Batch completion waiting may leave some workers idle

**Neutral:**
- Subagent count configurable for cost/speed tradeoff
- Determinism adds ~5% overhead for sorting/normalization

## Pros and Cons of Options

### Option 1: Layered Parallelism with Subagent Pattern

Full parallelism at both static and agentic layers, using orchestrator-worker architecture.

- Good: Maximum throughput, proven pattern from Claude Code
- Good: Context isolation prevents cross-domain interference
- Good: Deterministic with post-execution normalization
- Good: Aligns with Agent-Aware principle
- Neutral: 3-4x token cost for agentic layer
- Bad: Most complex implementation
- Bad: Bun workers experimental

### Option 2: Single-Agent with Concurrent Tools

One LLM agent with concurrent tool execution (parallel file reads, etc.).

- Good: Simpler than subagents
- Good: Lower token cost
- Neutral: Some parallelism benefit
- Bad: Context pollution across domains
- Bad: No isolation between analysis types
- Bad: Doesn't leverage proven subagent patterns

### Option 3: Static-Only Parallelism

Parallelize static analysis; LLM calls remain sequential.

- Good: Simpler LLM integration
- Good: Predictable LLM costs
- Good: Static layer gains parallelism
- Bad: Agentic analysis bottleneck
- Bad: May not hit 30-second target for large projects
- Bad: Underutilizes LLM API capacity

### Option 4: Fully Sequential Processing

All operations run sequentially.

- Good: Simplest implementation
- Good: Naturally deterministic
- Good: Lowest memory usage
- Bad: Unacceptable performance for large projects
- Bad: Wastes parallel I/O capacity
- Bad: Far exceeds 30-second target

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | All parallelism runs locally |
| II. Improvement-Oriented | Yes | Faster analysis enables more frequent baselining |
| III. Causal-First | Yes | Subagent isolation doesn't impede tracing |
| IV. Mixed-Methods | Yes | Parallel static (quantitative) + subagents (qualitative) |
| V. Language-Agnostic | Yes | Worker pools work regardless of target language |
| VI. Tool-Agnostic | Yes | Adapter pattern unaffected by parallelism |
| VII. Static-First | Yes | Static analysis preferred; runs concurrently with agentic (not sequentially before) per ADR-0019 deep research pattern |
| VIII. Progressive Value | Yes | Static parallelism works without LLM config |
| IX. Agent-Aware | Yes | Subagent pattern applies AX principles to our own agent |

## More Information

### Related Documents
- [ADR-0001: Language and Runtime Selection](./0001-language-and-runtime-selection.md) - Bun runtime with worker support
- [ADR-0006: Agentic Analysis Implementation](./0006-agentic-analysis-implementation.md) - Vercel AI SDK for LLM integration
- [ADR-0007: Causal Analysis Architecture](./0007-causal-analysis-architecture.md) - Session analysis pipeline
- [ADR-0008: Session Quality Analysis](./0008-session-quality-analysis.md) - Analysis dimensions for subagents
- [ADR-0019: Language Ecosystem Support](./0019-language-ecosystem-support.md) - Deep research pattern for concurrent static+agentic execution
- Architecture Vision: [Section 7 - agentlint Agent Design](../../agentlint-architecture-vision.md#7-agentlint-agent-design)
- Design Questions: [Section 2.6 - Parallel Processing Architecture](../../design-questions.md#26-parallel-processing-architecture)

### Research Sources
- [Claude Code Subagents Documentation](https://code.claude.com/docs/en/sub-agents) - Official subagent architecture
- [Multi-Agent Parallel Coding with Claude Code Subagents](https://medium.com/@codecentrevibe/claude-code-multi-agent-parallel-coding-83271c4675fa) - Practical patterns
- [Claude Subagent Deep Dive](https://cuong.io/blog/2025/06/24-claude-code-subagent-deep-dive) - Architecture analysis
- [Building Agents with Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) - Official SDK patterns
- [Bun Workers API](https://bun.com/docs/runtime/workers) - Worker thread documentation
- [LLM Concurrent Requests Best Practices](https://www.requesty.ai/blog/rate-limits-for-llm-providers-openai-anthropic-and-deepseek) - Rate limiting
- [Concurrent vs Parallel LLM Execution](https://medium.com/@neeldevenshah/concurrent-vs-parallel-execution-in-llm-api-calls-from-an-ai-engineers-perspective-5842e50974d4) - Execution patterns
- [AI Agent Orchestration Patterns - Microsoft](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns) - Enterprise patterns
- [Google ADK Multi-Agent Patterns](https://developers.googleblog.com/developers-guide-to-multi-agent-patterns-in-adk/) - ParallelAgent patterns
- [Deterministic Parallelism Survey](https://dl.acm.org/doi/10.1145/3564529) - Academic foundations

### Implementation Notes

#### 1. Static Analysis Worker Pool

```typescript
import { Worker } from 'bun';

interface WorkerPool {
  workers: Worker[];
  taskQueue: Task[];
  maxWorkers: number;
}

async function createStaticWorkerPool(config: ConcurrencyConfig): Promise<WorkerPool> {
  const maxWorkers = Math.min(
    config.static.maxWorkers,
    navigator.hardwareConcurrency - 1
  );

  const workers = Array.from({ length: maxWorkers }, () =>
    new Worker(new URL('./static-worker.ts', import.meta.url))
  );

  return { workers, taskQueue: [], maxWorkers };
}

// Worker task distribution
async function distributeStaticTasks(
  pool: WorkerPool,
  tasks: StaticTask[]
): Promise<StaticResult[]> {
  const results: StaticResult[] = [];
  const pending = new Map<Worker, Promise<StaticResult>>();

  for (const task of tasks) {
    // Find idle worker or wait for one
    const worker = await getIdleWorker(pool, pending);

    const promise = new Promise<StaticResult>((resolve) => {
      worker.onmessage = (event) => {
        pending.delete(worker);
        resolve(event.data);
      };
      worker.postMessage(task);
    });

    pending.set(worker, promise);
  }

  // Wait for all pending
  results.push(...await Promise.all(pending.values()));
  return results;
}
```

#### 2. Subagent Orchestration

```typescript
import { generateText } from 'ai';

interface Subagent {
  id: string;
  domain: AnalysisDomain;
  context: CompressedContext;
  status: 'idle' | 'running' | 'complete';
}

async function runSubagentAnalysis(
  orchestratorContext: OrchestratorContext,
  staticFindings: StaticFindings,
  config: ConcurrencyConfig
): Promise<AgenticFindings> {
  // 1. Orchestrator plans subagent tasks
  const subagentTasks = await planSubagentTasks(orchestratorContext, staticFindings);

  // 2. Create subagent batch (respect max concurrency)
  const batches = chunkArray(subagentTasks, config.agentic.maxSubagents);

  const allResults: SubagentResult[] = [];

  for (const batch of batches) {
    // 3. Run batch in parallel
    const batchResults = await Promise.all(
      batch.map(task => runSubagent(task, config))
    );

    allResults.push(...batchResults);
  }

  // 4. Synthesize (orchestrator merges subagent outputs)
  return synthesizeResults(orchestratorContext, allResults);
}

async function runSubagent(
  task: SubagentTask,
  config: ConcurrencyConfig
): Promise<SubagentResult> {
  const model = getModel(config);

  // Each subagent has isolated context
  const result = await generateText({
    model,
    system: SUBAGENT_PROMPTS[task.domain],
    prompt: task.compressedInput,
    tools: SUBAGENT_TOOLS[task.domain],
    maxSteps: 5, // Subagents are focused, limited steps
    experimental_telemetry: {
      isEnabled: config.telemetry?.enabled ?? false,
      functionId: `agentlint.subagent.${task.domain}`,
    },
  });

  return {
    domain: task.domain,
    findings: parseSubagentOutput(result),
    tokensUsed: result.usage,
  };
}
```

#### 3. Rate Limiter

```typescript
interface RateLimiter {
  requestsPerMinute: number;
  tokensPerMinute: number;
  currentRequests: number;
  currentTokens: number;
  lastReset: number;
}

class TokenBucketLimiter implements RateLimiter {
  private bucket: number;
  private lastRefill: number;

  async waitForCapacity(estimatedTokens: number): Promise<void> {
    while (this.bucket < estimatedTokens) {
      const waitTime = this.calculateRefillWait(estimatedTokens);
      await sleep(waitTime);
      this.refill();
    }
    this.bucket -= estimatedTokens;
  }

  async handleRateLimit(error: Error): Promise<void> {
    if (error.message.includes('429')) {
      // Exponential backoff with jitter
      const baseWait = 1000;
      const maxWait = 60000;
      const attempt = this.getRetryAttempt();
      const wait = Math.min(baseWait * Math.pow(2, attempt) + Math.random() * 1000, maxWait);
      await sleep(wait);
    }
  }
}
```

#### 4. Determinism Normalization

```typescript
interface DeterministicNormalizer {
  normalize(results: AnalysisResult[]): AnalysisResult[];
}

function normalizeResults(
  results: AnalysisResult[],
  analysisStartTime: Date
): AnalysisResult[] {
  return results
    // 1. Normalize timestamps
    .map(r => ({
      ...r,
      timestamp: analysisStartTime,
      detectedAt: analysisStartTime,
    }))
    // 2. Sort deterministically
    .sort((a, b) => {
      const domainCmp = a.domain.localeCompare(b.domain);
      if (domainCmp !== 0) return domainCmp;

      const pathCmp = (a.filePath ?? '').localeCompare(b.filePath ?? '');
      if (pathCmp !== 0) return pathCmp;

      const lineCmp = (a.line ?? 0) - (b.line ?? 0);
      if (lineCmp !== 0) return lineCmp;

      return a.type.localeCompare(b.type);
    })
    // 3. Deduplicate
    .filter((r, i, arr) => {
      if (i === 0) return true;
      const prev = arr[i - 1];
      return computeContentHash(r) !== computeContentHash(prev);
    });
}
```

### Performance Expectations

| Project Size | Sequential | Parallel Static | Full Parallel |
|--------------|------------|-----------------|---------------|
| Small (100 files) | ~15s | ~5s | ~5s |
| Medium (1000 files) | ~90s | ~20s | ~25s |
| Large (5000 files) | ~300s | ~60s | ~30s |

*Note: LLM latency dominates for agentic analysis; parallel static provides most speedup for large projects.*

### Follow-Up Decisions

This ADR surfaces the need for:

1. **Worker Error Handling**: How should worker crashes be handled? (restart, abort, degrade)
2. **Subagent Tool Sharing**: Should subagents share read-only tools? (memory efficiency vs isolation)
3. **Adaptive Parallelism**: Should concurrency adjust based on detected system resources?
