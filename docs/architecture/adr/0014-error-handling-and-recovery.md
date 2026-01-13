---
status: accepted
date: 2026-01-13
decision-makers: [CTO, Architecture Lead]
consulted: [Development Team]
informed: [All Contributors]
---

# ADR-0014: Error Handling and Recovery

## Context and Problem Statement

agentlint combines static analysis with LLM-powered agentic analysis across multiple domains (config, session, docs, cross-reference). This creates several failure modes: partial analysis failures, LLM API unavailability, network issues, corrupt data, and file access errors. Claude Code's checkpoint-based recovery and the Vercel AI SDK's error taxonomy (ADR-0006) provide patterns to learn from. This ADR establishes how agentlint handles failures gracefully while maintaining the Progressive Value principle.

The key challenges are:
1. Agentic analysis is inherently unreliable (network, rate limits, model errors)
2. Subagent failures (ADR-0011) shouldn't bring down entire analysis
3. Users expect clear, actionable error messages
4. Static-only mode should always work (Progressive Value)
5. Scripting/CI integration requires predictable exit codes

## Decision Drivers

- **Progressive Value principle**: Static analysis must work without LLM
- **User experience**: Clear errors with suggested fixes (CLI best practices)
- **Reliability**: Compound reliability problem—3 agents at 95% = 86% overall
- **Claude Code patterns**: Checkpoint recovery, graceful degradation
- **Vercel AI SDK**: Typed errors (ToolExecutionError, NoSuchToolError)
- **Scripting integration**: Exit codes for CI/CD pipelines
- **Cost awareness**: Failed LLM calls still consume tokens

## Considered Options

1. Continue with Degraded + Exponential Backoff (Graceful Degradation)
2. Fail Fast with Clear Errors (Abort on Failure)
3. Interactive Recovery Mode (User-Prompted)
4. Checkpoint and Resume (Claude Code Style)

## Decision Outcome

Chosen option: **"Continue with Degraded + Exponential Backoff"** because it aligns with Progressive Value (static always works), follows Claude Code's graceful degradation patterns, and provides the best user experience for both interactive and CI/CD use cases.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ERROR HANDLING ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LAYER 1: ERROR CLASSIFICATION (Inspired by Vercel AI SDK)                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                             │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐ │
│  │ RECOVERABLE         │  │ TRANSIENT           │  │ FATAL               │ │
│  │                     │  │                     │  │                     │ │
│  │ • LLM API error     │  │ • Rate limit (429)  │  │ • Invalid config    │ │
│  │ • Tool exec failed  │  │ • Network timeout   │  │ • No permissions    │ │
│  │ • Session parse err │  │ • Service unavail   │  │ • Corrupt database  │ │
│  │                     │  │   (503)             │  │                     │ │
│  │ Strategy: Degrade   │  │ Strategy: Retry     │  │ Strategy: Abort     │ │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘ │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LAYER 2: RETRY STRATEGY (Exponential Backoff + Jitter)                    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                             │
│  For TRANSIENT errors:                                                     │
│                                                                             │
│  Attempt 1: Immediate                                                      │
│  Attempt 2: 1s + jitter (0-500ms)                                          │
│  Attempt 3: 2s + jitter                                                    │
│  Attempt 4: 4s + jitter                                                    │
│  Attempt 5: 8s + jitter (max backoff)                                      │
│                                                                             │
│  Honor Retry-After headers from LLM providers                              │
│  Max total retry time: 30s                                                 │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LAYER 3: DEGRADATION STRATEGY                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ FULL MODE             │ DEGRADED MODE          │ STATIC-ONLY MODE  │   │
│  │ (All systems work)    │ (Partial LLM failure)  │ (No LLM available)│   │
│  ├───────────────────────┼────────────────────────┼───────────────────┤   │
│  │ ✓ Static analysis     │ ✓ Static analysis      │ ✓ Static analysis │   │
│  │ ✓ Config quality      │ ⚠ Partial (some fail)  │ ✗ Not available   │   │
│  │ ✓ Session quality     │ ⚠ Partial              │ ✗ Not available   │   │
│  │ ✓ Recommendations     │ ⚠ Partial              │ ✗ Not available   │   │
│  │ ✓ Causal traces       │ ⚠ Partial              │ ✗ Not available   │   │
│  └───────────────────────┴────────────────────────┴───────────────────┘   │
│                                                                             │
│  User is ALWAYS informed of degradation with clear messaging               │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LAYER 4: ERROR UX (Structured Output + Suggestions)                       │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                             │
│  Terminal Output:                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ⚠ Warning: LLM API rate limited, retrying (2/5)...                 │   │
│  │ ✗ Error: Session analyser failed after retries                     │   │
│  │   → Continuing with static-only session metrics                    │   │
│  │   → Run with --verbose for detailed error trace                    │   │
│  │                                                                     │   │
│  │ Analysis completed with partial results:                            │   │
│  │   ✓ Static analysis: 12 issues found                               │   │
│  │   ✓ Config analysis: 3 recommendations                             │   │
│  │   ⚠ Session analysis: DEGRADED (API unavailable)                   │   │
│  │   ⚠ Causal traces: SKIPPED (depends on session analysis)           │   │
│  │                                                                     │   │
│  │ Suggestion: Check your API key or try again later                  │   │
│  │ Exit code: 2 (partial success)                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Error Classification

Based on research into Claude Code patterns and Vercel AI SDK error types:

| Error Type | Examples | Strategy | Retry? |
|------------|----------|----------|--------|
| **Transient** | Rate limit (429), timeout, 503 | Exponential backoff | Yes, up to 5x |
| **Recoverable** | Tool execution failed, parse error | Degrade gracefully | No |
| **Fatal** | Invalid config, no permissions, corrupt DB | Abort with clear message | No |

```typescript
// Error type definitions
abstract class AgentlintError extends Error {
  abstract readonly type: 'transient' | 'recoverable' | 'fatal';
  abstract readonly code: ErrorCode;
  abstract readonly suggestion?: string;
}

class TransientError extends AgentlintError {
  readonly type = 'transient';
  readonly retryAfter?: number;  // From Retry-After header
}

class RecoverableError extends AgentlintError {
  readonly type = 'recoverable';
  readonly degradedMode: DegradationLevel;
}

class FatalError extends AgentlintError {
  readonly type = 'fatal';
}
```

### Exit Codes

Consistent exit codes for scripting and CI/CD integration:

| Exit Code | Meaning | When |
|-----------|---------|------|
| 0 | Success | Analysis completed fully |
| 1 | Fatal error | Unrecoverable failure (invalid config, permissions) |
| 2 | Partial success | Analysis completed with degradation |
| 3 | Issues found | Analysis completed, issues require attention |
| 130 | User interrupt | Ctrl+C |

### Subagent Error Isolation

Per ADR-0011, subagents run in parallel. Error isolation ensures one failure doesn't cascade:

```typescript
interface SubagentResult {
  domain: AnalysisDomain;
  status: 'success' | 'failed' | 'degraded';
  findings?: Finding[];
  error?: RecoverableError;
  degradationReason?: string;
}

async function runSubagentsWithIsolation(
  subagents: Subagent[]
): Promise<SubagentResult[]> {
  const results = await Promise.allSettled(
    subagents.map(async (agent) => {
      try {
        return await runWithRetry(agent.execute());
      } catch (error) {
        if (error instanceof TransientError) {
          // Already exhausted retries
          return {
            domain: agent.domain,
            status: 'degraded',
            degradationReason: `API unavailable: ${error.message}`,
          };
        }
        throw error; // Propagate fatal errors
      }
    })
  );

  // Convert settled results to SubagentResult[]
  return results.map(handleSettledResult);
}
```

### LLM Fallback Strategy

When LLM is unavailable, gracefully degrade to static-only mode:

```typescript
async function analyseWithFallback(
  project: Project,
  config: AnalysisConfig
): Promise<AnalysisResult> {
  // Static analysis always runs first (Static-First principle)
  const staticResults = await runStaticAnalysis(project);

  // Attempt agentic analysis with fallback
  let agenticResults: AgenticResult | null = null;
  let degradationMessage: string | null = null;

  try {
    agenticResults = await runAgenticAnalysisWithRetry(project, config);
  } catch (error) {
    if (error instanceof TransientError) {
      degradationMessage = formatDegradationMessage(error);
      // Continue without agentic results
    } else {
      throw error; // Fatal errors propagate
    }
  }

  return {
    mode: agenticResults ? 'full' : 'static-only',
    static: staticResults,
    agentic: agenticResults,
    degradation: degradationMessage,
    exitCode: agenticResults ? 0 : 2,
  };
}
```

### Retry Implementation

Exponential backoff with jitter following best practices:

```typescript
interface RetryConfig {
  maxAttempts: number;      // Default: 5
  initialDelay: number;     // Default: 1000ms
  maxDelay: number;         // Default: 8000ms
  exponentialBase: number;  // Default: 2
  jitterFactor: number;     // Default: 0.5 (0-50% jitter)
  totalTimeout: number;     // Default: 30000ms
}

async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config: RetryConfig
): Promise<T> {
  let lastError: TransientError;
  const startTime = Date.now();

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!isTransientError(error)) {
        throw error; // Non-transient errors propagate immediately
      }

      lastError = error;

      // Check total timeout
      if (Date.now() - startTime > config.totalTimeout) {
        throw new TransientError(`Timeout after ${config.totalTimeout}ms`, {
          cause: lastError,
        });
      }

      // Honor Retry-After header if present
      const delay = error.retryAfter
        ? error.retryAfter * 1000
        : calculateBackoff(attempt, config);

      logger.warn(`Retry ${attempt}/${config.maxAttempts} in ${delay}ms...`);
      await sleep(delay);
    }
  }

  throw lastError!;
}

function calculateBackoff(attempt: number, config: RetryConfig): number {
  const baseDelay = Math.min(
    config.initialDelay * Math.pow(config.exponentialBase, attempt - 1),
    config.maxDelay
  );
  const jitter = baseDelay * config.jitterFactor * Math.random();
  return Math.floor(baseDelay + jitter);
}
```

### Error UX Output

Terminal output following CLI UX best practices:

```typescript
import chalk from 'chalk';

function formatError(error: AgentlintError): string {
  const lines: string[] = [];

  // Error indicator with color
  if (error.type === 'fatal') {
    lines.push(chalk.red('✗ Error: ') + error.message);
  } else if (error.type === 'recoverable') {
    lines.push(chalk.yellow('⚠ Warning: ') + error.message);
  }

  // Suggestion (indented)
  if (error.suggestion) {
    lines.push(chalk.dim('  → ') + error.suggestion);
  }

  // Verbose mode hint
  if (!process.env.VERBOSE) {
    lines.push(chalk.dim('  → Run with --verbose for detailed trace'));
  }

  return lines.join('\n');
}

function formatSummary(result: AnalysisResult): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(chalk.bold('Analysis Summary:'));

  // Static analysis (always present)
  lines.push(chalk.green('  ✓ Static analysis: ') +
    `${result.static.issueCount} issues found`);

  // Agentic components
  for (const [domain, status] of Object.entries(result.domainStatus)) {
    if (status === 'success') {
      lines.push(chalk.green(`  ✓ ${domain}: `) + 'completed');
    } else if (status === 'degraded') {
      lines.push(chalk.yellow(`  ⚠ ${domain}: `) +
        `DEGRADED (${result.degradationReasons[domain]})`);
    } else if (status === 'skipped') {
      lines.push(chalk.dim(`  ○ ${domain}: `) +
        `SKIPPED (${result.skipReasons[domain]})`);
    }
  }

  // Overall status
  lines.push('');
  if (result.exitCode === 0) {
    lines.push(chalk.green('Analysis completed successfully'));
  } else if (result.exitCode === 2) {
    lines.push(chalk.yellow('Analysis completed with partial results'));
  }

  return lines.join('\n');
}
```

### Consequences

**Good:**
- Static analysis always works (Progressive Value principle)
- Users see available results even when LLM fails
- Clear, actionable error messages with suggestions
- Exit codes enable CI/CD integration
- Follows Claude Code's graceful degradation patterns
- Exponential backoff prevents thundering herd

**Bad:**
- Partial results may confuse users expecting full analysis
- Degraded mode still incurs some LLM costs (failed calls count)
- Complexity in tracking which components succeeded/failed
- Need to maintain degradation state throughout analysis

**Neutral:**
- Requires consistent error classification across codebase
- May need user education on exit codes
- Verbose mode adds implementation complexity

## Pros and Cons of Options

### Option 1: Continue with Degraded + Exponential Backoff

Graceful degradation with retry for transient errors, continue with available results.

- Good: Aligns with Progressive Value principle
- Good: Users always get some results
- Good: Follows Claude Code's patterns
- Good: Good CI/CD experience (exit codes)
- Neutral: Requires clear degradation messaging
- Bad: Partial results may be misleading without context
- Bad: Implementation complexity

### Option 2: Fail Fast with Clear Errors

Abort entire analysis if any critical component fails.

- Good: Simple implementation
- Good: No ambiguity about result completeness
- Good: Users know to fix issues before re-running
- Neutral: Consistent behavior
- Bad: Violates Progressive Value principle
- Bad: User loses all results on partial failure
- Bad: Poor experience for large analyses

### Option 3: Interactive Recovery Mode

Prompt user for action on each error (retry, skip, abort).

- Good: Maximum user control
- Good: Users can make informed decisions
- Neutral: Educational for users
- Bad: Terrible for CI/CD (non-interactive)
- Bad: Interrupts user flow
- Bad: Doesn't work in scripted environments

### Option 4: Checkpoint and Resume

Save progress, allow resume from last successful point (Claude Code style).

- Good: No lost progress
- Good: Handles long-running analyses well
- Good: Natural for agentic patterns
- Neutral: Claude Code uses this effectively
- Bad: Implementation complexity (state management)
- Bad: Checkpoint storage overhead
- Bad: May be overkill for typical agentlint runs (< 2 min)

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | All error handling runs locally |
| II. Improvement-Oriented | Yes | Partial results still contribute to baseline |
| III. Causal-First | Partial | Degraded causal traces may miss some origins |
| IV. Mixed-Methods | Yes | Static (quantitative) always available; agentic (qualitative) may degrade |
| V. Language-Agnostic | Yes | Error handling independent of target language |
| VI. Tool-Agnostic | Yes | Adapter errors handled uniformly |
| VII. Static-First | Yes | Static analysis completes before agentic, always available |
| VIII. Progressive Value | Yes | Core principle—static works without LLM |
| IX. Agent-Aware | Yes | Subagent isolation prevents cascade failures |

## More Information

### Related Documents
- [ADR-0006: Agentic Analysis Implementation](./0006-agentic-analysis-implementation.md) - Vercel AI SDK integration
- [ADR-0009: Observability Strategy](./0009-observability-strategy.md) - Error logging via OTel
- [ADR-0011: Parallel Processing Architecture](./0011-parallel-processing-architecture.md) - Subagent isolation
- [ADR-0013: Testing Strategy](./0013-testing-strategy.md) - Testing error scenarios
- Architecture Vision: [Section 2 - Design Principles](../../agentlint-architecture-vision.md#design-principles)
- Design Questions: [Section 4.2 - Error Handling](../../design-questions.md#42-error-handling--recovery)

### Research Sources

**Claude Code Patterns:**
- [Anthropic: Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices) - Checkpoint recovery, graceful degradation
- [Claude Skills: Error Recovery Patterns](https://claude-plugins.dev/skills/@applied-artificial-intelligence/claude-code-toolkit/error-recovery-patterns) - 13-category error taxonomy
- [Claude Agent SDK Best Practices](https://skywork.ai/blog/claude-agent-sdk-best-practices-ai-agents-2025/) - Error handling in agent SDK

**Agentic Error Handling:**
- [DEV: Error Recovery in AI Agents](https://dev.to/gantz/error-recovery-in-ai-agents-graceful-degradation-and-retry-strategies-40ca) - Graceful degradation patterns
- [Galileo: Multi-Agent Failure Recovery](https://galileo.ai/blog/multi-agent-ai-system-failure-recovery) - Compound reliability problem
- [SparkCo: LangGraph Error Handling](https://sparkco.ai/blog/advanced-error-handling-strategies-in-langgraph-applications) - Multi-level error handling
- [Gocodeo: Error Recovery Strategies](https://www.gocodeo.com/post/error-recovery-and-fallback-strategies-in-ai-agent-development) - Circuit breaker patterns
- [PraisonAI: Graceful Degradation](https://docs.praison.ai/docs/best-practices/graceful-degradation) - Degradation patterns

**LLM API Retry Strategies:**
- [OpenAI Cookbook: Rate Limits](https://cookbook.openai.com/examples/how_to_handle_rate_limits) - Exponential backoff with jitter
- [Requesty: Rate Limits for LLM Providers](https://www.requesty.ai/blog/rate-limits-for-llm-providers-openai-anthropic-and-deepseek) - Provider-specific limits
- [MarkAICode: LLM API Retry Logic](https://markaicode.com/llm-api-retry-logic-implementation/) - Implementation guide
- [Vellum: LLM Request Failure Routing](https://www.vellum.ai/blog/what-to-do-when-an-llm-request-fails) - Fallback strategies

**CLI UX:**
- [clig.dev: Command Line Interface Guidelines](https://clig.dev/) - Exit codes, error messages
- [Lucas Costa: UX Patterns for CLI Tools](https://lucasfcosta.com/2022/06/01/ux-patterns-cli-tools.html) - Colors, suggestions
- [Medium: Error Handling in CLI Tools](https://medium.com/@czhoudev/error-handling-in-cli-tools-a-practical-pattern-thats-worked-for-me-6c658a9141a9) - Practical patterns

**Vercel AI SDK:**
- [AI SDK: Error Handling](https://ai-sdk.dev/docs/ai-sdk-core/error-handling) - Error types
- [AI SDK: ToolCallRepairError](https://ai-sdk.dev/docs/reference/ai-sdk-errors/ai-tool-call-repair-error) - Tool execution errors

**Distributed Systems:**
- [Microsoft: Handling Partial Failure](https://learn.microsoft.com/en-us/dotnet/architecture/microservices/implement-resilient-applications/handle-partial-failure) - Continue vs abort patterns
- [Temporal: Error Handling in Distributed Systems](https://temporal.io/blog/error-handling-in-distributed-systems) - Resilience patterns

### Implementation Notes

#### 1. Error Type Registration

```typescript
// src/errors/types.ts
export enum ErrorCode {
  // Transient (retryable)
  RATE_LIMIT = 'E001',
  NETWORK_TIMEOUT = 'E002',
  SERVICE_UNAVAILABLE = 'E003',

  // Recoverable (degrade gracefully)
  LLM_API_ERROR = 'E101',
  TOOL_EXECUTION_FAILED = 'E102',
  SESSION_PARSE_ERROR = 'E103',
  MALFORMED_RESPONSE = 'E104',

  // Fatal (abort)
  INVALID_CONFIG = 'E201',
  PERMISSION_DENIED = 'E202',
  CORRUPT_DATABASE = 'E203',
  MISSING_API_KEY = 'E204',
}

export const ERROR_SUGGESTIONS: Record<ErrorCode, string> = {
  [ErrorCode.RATE_LIMIT]: 'Wait a moment and retry, or reduce analysis scope',
  [ErrorCode.NETWORK_TIMEOUT]: 'Check your network connection',
  [ErrorCode.MISSING_API_KEY]: 'Set ANTHROPIC_API_KEY environment variable',
  // ...
};
```

#### 2. Retry Configuration

```typescript
// src/config/retry.ts
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 5,
  initialDelay: 1000,
  maxDelay: 8000,
  exponentialBase: 2,
  jitterFactor: 0.5,
  totalTimeout: 30000,
};

// Provider-specific overrides
export const ANTHROPIC_RETRY_CONFIG: RetryConfig = {
  ...DEFAULT_RETRY_CONFIG,
  // Anthropic has generous rate limits, fewer retries needed
  maxAttempts: 3,
};
```

#### 3. Degradation State

```typescript
// src/analysis/degradation.ts
interface DegradationState {
  mode: 'full' | 'degraded' | 'static-only';
  failedDomains: AnalysisDomain[];
  reasons: Map<AnalysisDomain, string>;
  exitCode: 0 | 2;
}

function computeDegradationState(results: SubagentResult[]): DegradationState {
  const failedDomains = results
    .filter(r => r.status === 'failed' || r.status === 'degraded')
    .map(r => r.domain);

  if (failedDomains.length === 0) {
    return { mode: 'full', failedDomains: [], reasons: new Map(), exitCode: 0 };
  }

  if (failedDomains.length === results.length) {
    return {
      mode: 'static-only',
      failedDomains,
      reasons: new Map(results.map(r => [r.domain, r.degradationReason!])),
      exitCode: 2,
    };
  }

  return {
    mode: 'degraded',
    failedDomains,
    reasons: new Map(results
      .filter(r => r.degradationReason)
      .map(r => [r.domain, r.degradationReason!])),
    exitCode: 2,
  };
}
```

### Follow-Up Decisions

This ADR surfaces the need for:

1. **Safe Mode Command**: `agentlint analyse --static-only` for guaranteed deterministic results
2. **Verbose Error Output**: `--verbose` flag implementation for debugging
3. **Error Telemetry**: Track error rates for product improvement (via ADR-0009 OTel)
