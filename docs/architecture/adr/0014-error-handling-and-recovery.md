---
status: accepted
date: 2026-01-13
decision-makers: [CTO, Architecture Lead]
consulted: [Development Team]
informed: [All Contributors]
---

# ADR-0014: Error Handling and Recovery

## Context and Problem Statement

agentlint is an agent-orchestrated application where an LLM agent orchestrates all analysis (ADR-0006). This creates several failure modes: LLM API unavailability, network issues, rate limits, tool execution failures, and corrupt data. This ADR establishes how agentlint handles failures while maintaining the best possible user experience.

The key challenges are:
1. LLM availability is required—agentlint cannot function without it
2. Subagent failures (ADR-0011) shouldn't bring down entire analysis
3. Users expect clear, actionable error messages
4. Tool execution failures should be isolated when possible
5. Scripting/CI integration requires predictable exit codes

## Decision Drivers

- **LLM is required**: The agent cannot reason without an LLM (see Constitution)
- **Partial success**: Analysis should complete as much as possible even with failures
- **User experience**: Clear errors with suggested fixes (CLI best practices)
- **Reliability**: Compound reliability problem—4 subagents at 95% = 81% overall
- **Subagent isolation**: One subagent failure shouldn't cascade
- **Scripting integration**: Exit codes for CI/CD pipelines
- **Cost awareness**: Failed LLM calls still consume tokens

## Considered Options

1. Partial Completion with Exponential Backoff
2. Fail Fast with Clear Errors
3. Interactive Recovery Mode
4. Checkpoint and Resume

## Decision Outcome

Chosen option: **"Partial Completion with Exponential Backoff"** because it maximizes the value delivered to users even when some components fail, while providing clear feedback about what succeeded and what didn't.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ERROR HANDLING ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LAYER 1: ERROR CLASSIFICATION                                              │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                             │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐ │
│  │ TRANSIENT           │  │ RECOVERABLE         │  │ FATAL               │ │
│  │                     │  │                     │  │                     │ │
│  │ • Rate limit (429)  │  │ • Tool exec failed  │  │ • No API key        │ │
│  │ • Network timeout   │  │ • Session parse err │  │ • Invalid config    │ │
│  │ • Service unavail   │  │ • Subagent timeout  │  │ • Corrupt database  │ │
│  │   (503)             │  │ • Malformed resp    │  │ • No permissions    │ │
│  │                     │  │                     │  │                     │ │
│  │ Strategy: Retry     │  │ Strategy: Continue  │  │ Strategy: Abort     │ │
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
│  LAYER 3: PARTIAL COMPLETION                                               │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ FULL SUCCESS         │ PARTIAL SUCCESS       │ FAILURE             │   │
│  │ (All components)     │ (Some failed)         │ (Agent cannot run)  │   │
│  ├──────────────────────┼───────────────────────┼─────────────────────┤   │
│  │ ✓ Agent connected    │ ✓ Agent connected     │ ✗ No LLM available  │   │
│  │ ✓ All tools work     │ ⚠ Some tools failed   │ ✗ Cannot proceed    │   │
│  │ ✓ All subagents OK   │ ⚠ Some subagents fail │                     │   │
│  │ ✓ Full report        │ ⚠ Partial report      │ ✗ No report         │   │
│  │                      │   (clearly marked)    │                     │   │
│  │ Exit code: 0         │ Exit code: 2          │ Exit code: 1        │   │
│  └──────────────────────┴───────────────────────┴─────────────────────┘   │
│                                                                             │
│  User is ALWAYS informed of partial completion with clear messaging        │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LAYER 4: ERROR UX (Structured Output + Suggestions)                       │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                             │
│  Terminal Output:                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ⚠ Warning: LLM API rate limited, retrying (2/5)...                 │   │
│  │ ✗ Error: Session subagent failed after retries                     │   │
│  │   → Continuing analysis without session findings                   │   │
│  │   → Run with --verbose for detailed error trace                    │   │
│  │                                                                     │   │
│  │ Analysis completed with partial results:                            │   │
│  │   ✓ Config analysis: 3 recommendations                             │   │
│  │   ✓ Docs analysis: 2 findings                                      │   │
│  │   ⚠ Session analysis: FAILED (API timeout after retries)          │   │
│  │   ⚠ Code analysis: SKIPPED (depends on session context)           │   │
│  │                                                                     │   │
│  │ Suggestion: Check your API key or try again later                  │   │
│  │ Exit code: 2 (partial success)                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  FATAL Error (no LLM):                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ✗ Error: Cannot connect to LLM provider                            │   │
│  │   agentlint requires an LLM to function.                           │   │
│  │                                                                     │   │
│  │   Suggestion: Set ANTHROPIC_API_KEY environment variable           │   │
│  │   Documentation: https://agentlint.dev/docs/getting-started        │   │
│  │ Exit code: 1 (fatal error)                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Error Classification

| Error Type | Examples | Strategy | Retry? |
|------------|----------|----------|--------|
| **Transient** | Rate limit (429), timeout, 503 | Exponential backoff | Yes, up to 5x |
| **Recoverable** | Tool execution failed, subagent timeout | Continue without component | No |
| **Fatal** | No API key, invalid config, corrupt DB | Abort with clear message | No |

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
  readonly failedComponent: string;
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
| 1 | Fatal error | LLM unavailable, invalid config, permissions |
| 2 | Partial success | Analysis completed but some components failed |
| 3 | Issues found | Analysis completed, findings require attention |
| 130 | User interrupt | Ctrl+C |

### LLM Availability Check

The agent requires an LLM to function. A pre-flight check validates availability:

```typescript
async function validateLLMAvailability(config: Config): Promise<void> {
  if (!config.llm?.apiKey && !process.env.ANTHROPIC_API_KEY) {
    throw new FatalError({
      code: ErrorCode.MISSING_API_KEY,
      message: 'agentlint requires an LLM to function',
      suggestion: 'Set ANTHROPIC_API_KEY environment variable or configure in ~/.config/agentlint/config.toml',
    });
  }

  // Test connection with a minimal request
  try {
    await testLLMConnection(config);
  } catch (error) {
    if (isTransientError(error)) {
      // Will retry during analysis
      logger.warn('LLM connection slow, will retry during analysis');
    } else {
      throw new FatalError({
        code: ErrorCode.LLM_CONNECTION_FAILED,
        message: `Cannot connect to LLM provider: ${error.message}`,
        suggestion: 'Check your API key and network connection',
      });
    }
  }
}
```

### Subagent Error Isolation

Per ADR-0011, subagents run in parallel. Error isolation ensures one failure doesn't cascade:

```typescript
interface SubagentResult {
  domain: AnalysisDomain;
  status: 'success' | 'failed';
  findings?: Finding[];
  error?: RecoverableError;
}

async function runSubagentsWithIsolation(
  subagents: Subagent[]
): Promise<SubagentResult[]> {
  const results = await Promise.allSettled(
    subagents.map(async (agent) => {
      try {
        return await runWithRetry(agent.execute());
      } catch (error) {
        // Log the error, return failure result
        logger.error(`Subagent ${agent.domain} failed: ${error.message}`);
        return {
          domain: agent.domain,
          status: 'failed',
          error: new RecoverableError({
            message: error.message,
            failedComponent: agent.domain,
          }),
        };
      }
    })
  );

  return results.map(handleSettledResult);
}
```

### Tool Execution Error Handling

When a tool fails, the agent receives an error response and can decide how to proceed:

```typescript
async function executeToolWithErrorHandling(
  tool: Tool,
  args: ToolArgs
): Promise<ToolResult | ToolError> {
  try {
    return await tool.execute(args);
  } catch (error) {
    // Return error to agent instead of throwing
    return {
      type: 'error',
      tool: tool.name,
      error: error.message,
      suggestion: 'The agent may try an alternative approach',
    };
  }
}

// Agent receives tool error and can reason about it:
// Agent: "The ConfigParserTool failed to parse CLAUDE.md. Let me try
//         reading it with ReadFileTool to understand the format issue."
```

### Retry Implementation

Exponential backoff with jitter following best practices:

```typescript
interface RetryConfig {
  maxAttempts: number;      // Default: 5
  initialDelay: number;     // Default: 1000ms
  maxDelay: number;         // Default: 8000ms
  exponentialBase: number;  // Default: 2
  jitterFactor: number;     // Default: 0.5
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

      if (Date.now() - startTime > config.totalTimeout) {
        throw new TransientError(`Timeout after ${config.totalTimeout}ms`, {
          cause: lastError,
        });
      }

      const delay = error.retryAfter
        ? error.retryAfter * 1000
        : calculateBackoff(attempt, config);

      logger.warn(`Retry ${attempt}/${config.maxAttempts} in ${delay}ms...`);
      await sleep(delay);
    }
  }

  throw lastError!;
}
```

### Consequences

**Good:**
- Users get partial results even when some components fail
- Clear, actionable error messages with suggestions
- Exit codes enable CI/CD integration
- Subagent isolation prevents cascade failures
- Exponential backoff prevents thundering herd

**Bad:**
- Partial results may confuse users expecting full analysis
- Need to clearly communicate what succeeded vs failed
- Complexity in tracking which components succeeded/failed

**Neutral:**
- Requires consistent error classification across codebase
- May need user education on exit codes

## Pros and Cons of Options

### Option 1: Partial Completion with Exponential Backoff (Chosen)

Continue with available results when some components fail, retry transient errors.

- Good: Users always get maximum available value
- Good: Subagent isolation is natural
- Good: Good CI/CD experience (exit codes)
- Neutral: Requires clear status communication
- Bad: Partial results may be misleading without context
- Bad: Implementation complexity

### Option 2: Fail Fast with Clear Errors

Abort entire analysis if any critical component fails.

- Good: Simple implementation
- Good: No ambiguity about result completeness
- Bad: User loses all results on partial failure
- Bad: Poor experience for analyses that partially succeed

### Option 3: Interactive Recovery Mode

Prompt user for action on each error.

- Good: Maximum user control
- Bad: Terrible for CI/CD (non-interactive)
- Bad: Interrupts user flow

### Option 4: Checkpoint and Resume

Save progress, allow resume from last successful point.

- Good: No lost progress on long analyses
- Bad: Implementation complexity
- Bad: May be overkill for typical agentlint runs (< 2 min)

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | All error handling runs locally |
| II. Improvement-Oriented | Yes | Partial results still contribute to baseline |
| III. Causal-First | Partial | Failed subagents may miss some causal traces |
| IV. Mixed-Methods | Yes | Agent decides what's available based on component status |
| V. Language-Agnostic | Yes | Error handling independent of target language |
| VI. Tool-Agnostic | Yes | Adapter errors handled uniformly |
| VII. Intelligent Tooling | Yes | Tools serve agent needs; tool failures are isolated |
| VIII. Compounding Value | Yes | Value compounds through baseline tracking |
| IX. Agent-Aware | Yes | Agent receives error info and can reason about alternatives |

## More Information

### Related Documents
- [ADR-0006: Agent-Orchestrated Analysis](./0006-agent-orchestrated-analysis.md) - Agent architecture
- [ADR-0009: Observability Strategy](./0009-observability-strategy.md) - Error logging via OTel
- [ADR-0011: Agent Tool Concurrency](./0011-parallel-processing-architecture.md) - Subagent isolation
- [Constitution](../../../.specify/memory/constitution.md) - LLM requirement

### Research Sources

**LLM API Retry Strategies:**
- [OpenAI Cookbook: Rate Limits](https://cookbook.openai.com/examples/how_to_handle_rate_limits) - Exponential backoff
- [Requesty: Rate Limits for LLM Providers](https://www.requesty.ai/blog/rate-limits-for-llm-providers-openai-anthropic-and-deepseek) - Provider limits

**CLI UX:**
- [clig.dev: Command Line Interface Guidelines](https://clig.dev/) - Exit codes, error messages

### Implementation Notes

#### 1. Error Type Registration

```typescript
export enum ErrorCode {
  // Transient (retryable)
  RATE_LIMIT = 'E001',
  NETWORK_TIMEOUT = 'E002',
  SERVICE_UNAVAILABLE = 'E003',

  // Recoverable (continue without component)
  TOOL_EXECUTION_FAILED = 'E101',
  SUBAGENT_TIMEOUT = 'E102',
  SESSION_PARSE_ERROR = 'E103',

  // Fatal (abort)
  MISSING_API_KEY = 'E201',
  INVALID_CONFIG = 'E202',
  CORRUPT_DATABASE = 'E203',
  LLM_CONNECTION_FAILED = 'E204',
}

export const ERROR_SUGGESTIONS: Record<ErrorCode, string> = {
  [ErrorCode.RATE_LIMIT]: 'Wait a moment and retry, or reduce analysis scope',
  [ErrorCode.MISSING_API_KEY]: 'Set ANTHROPIC_API_KEY environment variable',
  [ErrorCode.LLM_CONNECTION_FAILED]: 'Check your API key and network connection',
  // ...
};
```

#### 2. Analysis Result with Partial Status

```typescript
interface AnalysisResult {
  status: 'success' | 'partial' | 'failed';
  exitCode: 0 | 1 | 2 | 3;

  // Component status
  components: {
    config: ComponentStatus;
    sessions: ComponentStatus;
    docs: ComponentStatus;
    code: ComponentStatus;
  };

  // Available findings
  findings: Finding[];
  recommendations: Recommendation[];

  // Error details for failed components
  errors: ComponentError[];
}

type ComponentStatus = 'success' | 'failed' | 'skipped';

interface ComponentError {
  component: string;
  error: AgentlintError;
  impact: string;  // "Session analysis unavailable for this run"
}
```
