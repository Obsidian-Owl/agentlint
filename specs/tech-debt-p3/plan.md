# Plan: P3+ Tech Debt Remediation

> **Legacy Note (2026-01)**: This plan references "Claude Agent SDK" which was replaced by Opencode SDK. See [ADR-0024](../../docs/architecture/adr/0024-opencode-sdk-migration.md).

## Overview

Address remaining tech debt findings (P3 and below) focusing on error resilience, testing determinism, and observability patterns aligned with [Claude Agent SDK best practices](https://platform.claude.com/docs/en/agent-sdk/overview) and [Anthropic's engineering guidance](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk).

**Reference**: [ADR-0011: Testing Strategy](../docs/architecture/adr/0011-testing-strategy-for-agentic-components.md)

## P3+ Issues Summary

| Priority | Pattern             | File(s)                    | Severity | Impact             |
| -------- | ------------------- | -------------------------- | -------- | ------------------ |
| P3       | SILENT_FAILURE      | alpha-client.ts:437        | 8        | Error opacity      |
| P3       | UNHANDLED_REJECTION | alpha-client.ts:113        | 7        | Crash risk         |
| P4       | MISSING_VCR         | honeyhive-api-live.test.ts | 6        | CI non-determinism |
| P4       | MISSING_VCR         | vercel-proxy-live.test.ts  | 6        | CI non-determinism |
| P5       | UNSTRUCTURED_ERRORS | Multiple CLI/tools         | 4        | Debug difficulty   |

---

## Task 1: Fix SILENT_FAILURE in Telemetry Client (Severity 8)

**File**: `src/telemetry/alpha-client.ts`

### Problem

The `flush()` method catch block (lines 437-454) logs warnings but provides no structured feedback. This follows "graceful degradation" but violates observability principles - failures are invisible to calling code.

### Solution

Per [Claude Agent SDK patterns](https://docs.claude.com/en/docs/agent-sdk/overview), error handling should:

1. Classify errors by category (timeout, network, api_error)
2. Emit structured events for observability
3. Enable optional callback for error notification

**Add error classification:**

```typescript
type TelemetryErrorCategory = 'timeout' | 'network' | 'rate_limited' | 'server_error' | 'unknown';

interface TelemetryError {
  category: TelemetryErrorCategory;
  message: string;
  eventCount: number;
  timestamp: string;
}

private classifyError(error: unknown, eventCount: number): TelemetryError {
  const timestamp = new Date().toISOString();

  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return { category: 'timeout', message: error.message, eventCount, timestamp };
    }
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return { category: 'network', message: error.message, eventCount, timestamp };
    }
  }

  return {
    category: 'unknown',
    message: error instanceof Error ? error.message : String(error),
    eventCount,
    timestamp
  };
}
```

**Add optional error callback:**

```typescript
export interface TelemetryClientOptions {
  onError?: (error: TelemetryError) => void;
}

private onError: ((error: TelemetryError) => void) | null = null;

// In constructor
this.onError = options?.onError ?? null;
```

**Update catch block:**

```typescript
} catch (error) {
  const classified = this.classifyError(error, events.length);

  // Always log in debug mode
  this.logWarning(
    `Telemetry ${classified.category}: ${classified.message} (${classified.eventCount} events dropped)`
  );

  // Notify callback if registered
  if (this.onError) {
    this.onError(classified);
  }

  // Don't crash, continue gracefully
}
```

### Constitution Alignment

- **Principle III (Causal-First)**: Error classification enables tracing failures to root cause
- **Principle VIII (Compounding Value)**: Error patterns can inform future improvements

---

## Task 2: Fix UNHANDLED_REJECTION (Severity 7)

**File**: `src/telemetry/alpha-client.ts`

### Problem

Line 113: `void this.flush();` creates a floating promise. While it has a `.catch()` in the interval handler (line 79), the direct call in `record()` has no error handling.

### Solution

Use consistent error handling pattern across all flush calls.

**Update record() method:**

```typescript
record(event: TelemetryEvent): void {
  if (!this.enabled) {
    return;
  }

  this.buffer.push(event);

  // Flush if buffer is full
  if (this.buffer.length >= MAX_BUFFER_SIZE) {
    this.flush().catch((error) => {
      const classified = this.classifyError(error, this.buffer.length);
      this.logWarning(`Buffer flush failed: ${classified.message}`);
      if (this.onError) {
        this.onError(classified);
      }
    });
  }
}
```

### Alternative: Safe Fire-and-Forget Helper

```typescript
/**
 * Safely execute a promise without awaiting, ensuring errors are handled.
 */
private safeFireAndForget(promise: Promise<void>, context: string): void {
  promise.catch((error) => {
    const classified = this.classifyError(error, this.buffer.length);
    this.logWarning(`${context}: ${classified.message}`);
    if (this.onError) {
      this.onError(classified);
    }
  });
}

// Usage
this.safeFireAndForget(this.flush(), 'Buffer flush');
```

---

## Task 3: Create VCR Recordings for Live Tests (Severity 6)

**Files**:

- `tests/integration/honeyhive-api-live.test.ts`
- `tests/integration/vercel-proxy-live.test.ts`

### Problem

Per [ADR-0011](../docs/architecture/adr/0011-testing-strategy-for-agentic-components.md), integration tests should use VCR recordings for deterministic CI. These live tests make actual network calls, which:

1. Are non-deterministic (API responses may change)
2. Require API keys in CI
3. Can fail due to network issues
4. Cost money for API calls

### Solution

Create VCR-enabled versions of these tests that record real API responses and replay them in CI.

**1. Create recording cassettes:**

```bash
# Create recordings directory
mkdir -p tests/integration/recordings

# Record HoneyHive API interactions
VCR_MODE=record HONEYHIVE_API_KEY=xxx bun test tests/integration/honeyhive-api-live.test.ts

# Record Vercel proxy interactions
VCR_MODE=record bun test tests/integration/vercel-proxy-live.test.ts
```

**2. Create VCR-enabled test file:**

```typescript
// tests/integration/honeyhive-api.test.ts (VCR version)
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { vcr, createAuthRedactFilter } from '../lib/vcr';

const CASSETTE_PATH = 'tests/integration/recordings/honeyhive-api.json';

describe('HoneyHive API Integration (VCR)', () => {
  beforeAll(async () => {
    await vcr.load(CASSETTE_PATH);
    vcr.setupMocks();
  });

  afterAll(() => {
    vcr.cleanup();
  });

  test('creates session with correct format', async () => {
    // Test uses recorded response
    const response = await fetch('https://api.honeyhive.ai/session/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer [REDACTED]', // VCR filter redacts this
      },
      body: JSON.stringify({
        session: {
          project: 'agentlint',
          session_name: 'test-session',
          source: 'integration-test',
        },
      }),
    });

    expect(response.ok).toBe(true);
  });
});
```

**3. Keep live tests for manual/release validation:**

```typescript
// tests/integration/honeyhive-api-live.test.ts
// Rename to clearly indicate it's a live test
// Only runs with RUN_LIVE_TESTS=1 (blocked by preload)
```

**4. Update test scripts:**

```json
{
  "scripts": {
    "test:integration": "bun test tests/integration/*.test.ts",
    "test:integration:record": "VCR_MODE=record bun test tests/integration/*.test.ts",
    "test:live": "RUN_LIVE_TESTS=1 bun test tests/integration/*-live.test.ts"
  }
}
```

### Recording Filter Configuration

Per [VCR best practices](https://github.com/vcr/vcr), filter sensitive data:

```typescript
const vcr = new VCR({
  requestFilter: createAuthRedactFilter(),
  responseFilter: (response) => ({
    ...response,
    body: typeof response.body === 'object' ? sanitizeResponseBody(response.body) : response.body,
  }),
});
```

---

## Task 4: Standardize Error Logging (Severity 4)

**Files**: Multiple CLI commands and tools

### Problem

Inconsistent `console.error()` usage across the codebase:

- Some use structured format: `console.error('[module] message:', error)`
- Some use bare strings: `console.error('Error: message')`
- No standard error classification

### Solution

Create a standardized CLI error helper that provides consistent formatting.

**Create error utility:**

```typescript
// src/cli/utils/error.ts
import { redact } from '../../debug/redaction';

type CLIErrorCategory = 'validation' | 'io' | 'network' | 'config' | 'internal';

interface CLIErrorOptions {
  category?: CLIErrorCategory;
  details?: string;
  suggestion?: string;
}

/**
 * Print a user-facing error message with consistent formatting.
 */
export function printError(message: string, options: CLIErrorOptions = {}): void {
  const { category = 'internal', details, suggestion } = options;

  // Redact any secrets that may have leaked into error messages
  const safeMessage = redact(message);
  const safeDetails = details ? redact(details) : undefined;

  console.error(`Error: ${safeMessage}`);

  if (safeDetails) {
    console.error(`  Details: ${safeDetails}`);
  }

  if (suggestion) {
    console.error(`  Suggestion: ${suggestion}`);
  }

  // Debug logging includes category for filtering
  if (process.env.DEBUG) {
    console.error(`  [category: ${category}]`);
  }
}

/**
 * Print an error from an exception with consistent formatting.
 */
export function printException(error: unknown, context?: string): void {
  const message = error instanceof Error ? error.message : String(error);
  const prefix = context ? `${context}: ` : '';

  printError(`${prefix}${message}`, {
    category: 'internal',
    details: error instanceof Error ? error.stack?.split('\n')[1] : undefined,
  });
}
```

**Update CLI commands to use the utility:**

```typescript
// Before
console.error(`Error: ${directory} is not a directory`);

// After
import { printError } from '../utils/error';
printError(`${directory} is not a directory`, {
  category: 'validation',
  suggestion: 'Provide a valid directory path',
});
```

---

## Task 5: Add Telemetry Error Metrics (Optional Enhancement)

**File**: `src/telemetry/alpha-client.ts`

### Problem

Telemetry failures are invisible - we have no insight into how often they occur or what types fail most.

### Solution

Add self-telemetry for error tracking (telemetry about telemetry failures).

```typescript
interface TelemetryMetrics {
  flushAttempts: number;
  flushSuccesses: number;
  flushFailures: number;
  eventsDropped: number;
  errorsByCategory: Record<TelemetryErrorCategory, number>;
}

private metrics: TelemetryMetrics = {
  flushAttempts: 0,
  flushSuccesses: 0,
  flushFailures: 0,
  eventsDropped: 0,
  errorsByCategory: {
    timeout: 0,
    network: 0,
    rate_limited: 0,
    server_error: 0,
    unknown: 0,
  },
};

/**
 * Get telemetry health metrics.
 */
getMetrics(): TelemetryMetrics {
  return { ...this.metrics };
}

// Update in flush():
this.metrics.flushAttempts++;
if (response.ok) {
  this.metrics.flushSuccesses++;
} else {
  this.metrics.flushFailures++;
  this.metrics.eventsDropped += events.length;
}

// In catch:
this.metrics.flushFailures++;
this.metrics.eventsDropped += events.length;
this.metrics.errorsByCategory[classified.category]++;
```

---

## Files to Modify

| File                                           | Changes                                 |
| ---------------------------------------------- | --------------------------------------- |
| `src/telemetry/alpha-client.ts`                | Tasks 1, 2, 5 - error handling, metrics |
| `tests/integration/honeyhive-api-live.test.ts` | Task 3 - rename, keep as live           |
| `tests/integration/vercel-proxy-live.test.ts`  | Task 3 - rename, keep as live           |

## Files to Create

| File                                              | Purpose                        |
| ------------------------------------------------- | ------------------------------ |
| `tests/integration/honeyhive-api.test.ts`         | VCR-enabled HoneyHive tests    |
| `tests/integration/vercel-proxy.test.ts`          | VCR-enabled Vercel proxy tests |
| `tests/integration/recordings/honeyhive-api.json` | HoneyHive API cassette         |
| `tests/integration/recordings/vercel-proxy.json`  | Vercel proxy cassette          |
| `src/cli/utils/error.ts`                          | Standardized CLI error utility |

---

## Implementation Order

1. **Task 1**: SILENT_FAILURE (highest severity, foundational for Task 2)
2. **Task 2**: UNHANDLED_REJECTION (depends on Task 1 error classification)
3. **Task 4**: Standardize error logging (improves overall observability)
4. **Task 3**: VCR recordings (requires live API access to record)
5. **Task 5**: Telemetry metrics (optional enhancement)

---

## Verification

### 1. Unit Tests Pass

```bash
bun run test
```

### 2. Type Check

```bash
bun run typecheck
```

### 3. Telemetry Error Callback Test

```typescript
describe('telemetry error handling', () => {
  it('calls onError callback when flush fails', async () => {
    const errors: TelemetryError[] = [];
    const client = new AlphaTelemetryClient({
      onError: (e) => errors.push(e),
    });

    // Force a failure (mock network error)
    // ...

    expect(errors).toHaveLength(1);
    expect(errors[0].category).toBe('network');
  });
});
```

### 4. VCR Playback Test

```bash
# Ensure VCR tests pass without network
CI=true bun test tests/integration/honeyhive-api.test.ts
```

### 5. Re-run Tech Debt Review

```bash
/dev.tech-debt-review
# Expected: P3+ issues should be resolved, score should improve
```

---

## Constitution Alignment

| Task                | Principle                 | Alignment                                    |
| ------------------- | ------------------------- | -------------------------------------------- |
| SILENT_FAILURE      | III (Causal-First)        | Classified errors enable root cause analysis |
| UNHANDLED_REJECTION | VIII (Compounding Value)  | Prevents silent degradation over time        |
| MISSING_VCR         | I (Local-First)           | VCR recordings enable offline CI             |
| UNSTRUCTURED_ERRORS | IX (Agent-Aware)          | Consistent errors help agent comprehension   |
| TELEMETRY_METRICS   | II (Improvement-Oriented) | Metrics enable continuous improvement        |

---

## Sources

- [Claude Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Building Agents with Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)
- [Claude Agent SDK Best Practices](https://skywork.ai/blog/claude-agent-sdk-best-practices-ai-agents-2025/)
- [VCR Testing Pattern](https://github.com/vcr/vcr)
- [VCR Best Practices](https://blog.arkency.com/3-tips-to-tune-your-vcr-in-tests/)
