/**
 * Unit tests for quality signal extraction
 *
 * Tests pattern detection for test, build, and lint outputs from session entries.
 *
 * @module tests/unit/sessions/extraction/quality-signals.test.ts
 */

import { describe, it, expect } from 'bun:test';
import type { SessionEntry } from '../../../../src/tools/sessions/types';
import {
  extractQualitySignals,
  aggregateQualitySignals,
} from '../../../../src/sessions/extraction/quality-signals';

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Create a Bash tool use entry.
 */
function createBashToolEntry(
  toolId: string,
  command: string,
  timestamp: string,
  lineNumber: number
): SessionEntry {
  return {
    type: 'assistant',
    uuid: `assistant-${lineNumber}`,
    timestamp,
    lineNumber,
    message: {
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: toolId,
          name: 'Bash',
          input: {
            command,
          },
        },
      ],
    },
  };
}

/**
 * Create a tool result entry.
 */
function createToolResult(
  toolUseId: string,
  content: string,
  timestamp: string,
  lineNumber: number,
  isError = false
): SessionEntry {
  return {
    type: 'tool_result',
    uuid: `result-${lineNumber}`,
    timestamp,
    lineNumber,
    toolResult: {
      toolUseId,
      content,
      isError,
    },
  };
}

// =============================================================================
// Test Output Detection Tests (T047)
// =============================================================================

describe('extractQualitySignals', () => {
  describe('test output detection', () => {
    it('should detect bun test passing output', () => {
      const entries: SessionEntry[] = [
        createBashToolEntry('bash-1', 'bun run test', '2026-01-24T10:00:00Z', 1),
        createToolResult(
          'bash-1',
          `bun test v1.0.0

 ✓ tests/unit/example.test.ts > example test
 ✓ tests/unit/another.test.ts > another test

 2 pass
 0 fail
 2 expect() calls`,
          '2026-01-24T10:00:05Z',
          2
        ),
      ];

      const signals = extractQualitySignals(entries, 'session-123');

      expect(signals).toHaveLength(1);
      expect(signals[0]!.signalType).toBe('test');
      expect(signals[0]!.passed).toBe(true);
      expect(signals[0]!.sessionId).toBe('session-123');
    });

    it('should detect bun test failing output', () => {
      const entries: SessionEntry[] = [
        createBashToolEntry('bash-1', 'bun test', '2026-01-24T10:00:00Z', 1),
        createToolResult(
          'bash-1',
          `bun test v1.0.0

 ✓ tests/unit/example.test.ts > passing test
 ✗ tests/unit/failing.test.ts > failing test
   Expected: 1
   Received: 2

 1 pass
 1 fail`,
          '2026-01-24T10:00:05Z',
          2,
          true
        ),
      ];

      const signals = extractQualitySignals(entries, 'session-fail');

      expect(signals).toHaveLength(1);
      expect(signals[0]!.signalType).toBe('test');
      expect(signals[0]!.passed).toBe(false);
    });

    it('should detect jest passing output', () => {
      const entries: SessionEntry[] = [
        createBashToolEntry('bash-1', 'npm test', '2026-01-24T10:00:00Z', 1),
        createToolResult(
          'bash-1',
          `PASS src/__tests__/example.test.ts
  Example Suite
    ✓ should work (5 ms)
    ✓ should also work (3 ms)

Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total`,
          '2026-01-24T10:00:10Z',
          2
        ),
      ];

      const signals = extractQualitySignals(entries, 'session-jest');

      expect(signals).toHaveLength(1);
      expect(signals[0]!.signalType).toBe('test');
      expect(signals[0]!.passed).toBe(true);
    });

    it('should detect jest failing output', () => {
      const entries: SessionEntry[] = [
        createBashToolEntry('bash-1', 'npm test', '2026-01-24T10:00:00Z', 1),
        createToolResult(
          'bash-1',
          `FAIL src/__tests__/example.test.ts
  Example Suite
    ✓ should work (5 ms)
    ✕ should fail (3 ms)

Test Suites: 1 failed, 1 total
Tests:       1 failed, 1 passed, 2 total`,
          '2026-01-24T10:00:10Z',
          2,
          true
        ),
      ];

      const signals = extractQualitySignals(entries, 'session-jest-fail');

      expect(signals).toHaveLength(1);
      expect(signals[0]!.signalType).toBe('test');
      expect(signals[0]!.passed).toBe(false);
    });

    it('should detect pytest passing output', () => {
      const entries: SessionEntry[] = [
        createBashToolEntry('bash-1', 'pytest', '2026-01-24T10:00:00Z', 1),
        createToolResult(
          'bash-1',
          `========================= test session starts ==========================
platform linux -- Python 3.11.0
collected 5 items

tests/test_example.py .....                                              [100%]

========================== 5 passed in 0.12s ===========================`,
          '2026-01-24T10:00:05Z',
          2
        ),
      ];

      const signals = extractQualitySignals(entries, 'session-pytest');

      expect(signals).toHaveLength(1);
      expect(signals[0]!.signalType).toBe('test');
      expect(signals[0]!.passed).toBe(true);
    });

    it('should detect pytest failing output', () => {
      const entries: SessionEntry[] = [
        createBashToolEntry('bash-1', 'pytest', '2026-01-24T10:00:00Z', 1),
        createToolResult(
          'bash-1',
          `========================= test session starts ==========================
platform linux -- Python 3.11.0
collected 5 items

tests/test_example.py ...F.                                              [100%]

========================== 1 failed, 4 passed in 0.15s ==================`,
          '2026-01-24T10:00:05Z',
          2,
          true
        ),
      ];

      const signals = extractQualitySignals(entries, 'session-pytest-fail');

      expect(signals).toHaveLength(1);
      expect(signals[0]!.signalType).toBe('test');
      expect(signals[0]!.passed).toBe(false);
    });

    it('should detect vitest passing output', () => {
      const entries: SessionEntry[] = [
        createBashToolEntry('bash-1', 'npx vitest run', '2026-01-24T10:00:00Z', 1),
        createToolResult(
          'bash-1',
          ` ✓ src/example.test.ts (2)

 Test Files  1 passed (1)
      Tests  2 passed (2)`,
          '2026-01-24T10:00:05Z',
          2
        ),
      ];

      const signals = extractQualitySignals(entries, 'session-vitest');

      expect(signals).toHaveLength(1);
      expect(signals[0]!.signalType).toBe('test');
      expect(signals[0]!.passed).toBe(true);
    });

    it('should return passed=null for indeterminate test output', () => {
      const entries: SessionEntry[] = [
        createBashToolEntry('bash-1', 'bun test', '2026-01-24T10:00:00Z', 1),
        createToolResult(
          'bash-1',
          `Running tests...
Some output here that doesn't clearly indicate pass/fail`,
          '2026-01-24T10:00:05Z',
          2
        ),
      ];

      const signals = extractQualitySignals(entries, 'session-unclear');

      expect(signals).toHaveLength(1);
      expect(signals[0]!.signalType).toBe('test');
      expect(signals[0]!.passed).toBe(null);
    });

    it('should preserve raw output for agent interpretation', () => {
      const rawOutput = `bun test v1.0.0
 ✓ tests/example.test.ts
 2 pass`;

      const entries: SessionEntry[] = [
        createBashToolEntry('bash-1', 'bun test', '2026-01-24T10:00:00Z', 1),
        createToolResult('bash-1', rawOutput, '2026-01-24T10:00:05Z', 2),
      ];

      const signals = extractQualitySignals(entries, 'session-raw');

      expect(signals).toHaveLength(1);
      expect(signals[0]!.rawOutput).toBe(rawOutput);
    });
  });

  // ===========================================================================
  // Build Output Detection Tests (T048)
  // ===========================================================================

  describe('build output detection', () => {
    it('should detect tsc success', () => {
      const entries: SessionEntry[] = [
        createBashToolEntry('bash-1', 'tsc --noEmit', '2026-01-24T10:00:00Z', 1),
        createToolResult('bash-1', '', '2026-01-24T10:00:05Z', 2),
      ];

      const signals = extractQualitySignals(entries, 'session-tsc');

      expect(signals).toHaveLength(1);
      expect(signals[0]!.signalType).toBe('build');
      expect(signals[0]!.passed).toBe(true);
    });

    it('should detect tsc failure with errors', () => {
      const entries: SessionEntry[] = [
        createBashToolEntry('bash-1', 'tsc', '2026-01-24T10:00:00Z', 1),
        createToolResult(
          'bash-1',
          `src/index.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.
src/utils.ts(25,10): error TS2339: Property 'foo' does not exist on type 'Bar'.

Found 2 errors.`,
          '2026-01-24T10:00:05Z',
          2,
          true
        ),
      ];

      const signals = extractQualitySignals(entries, 'session-tsc-fail');

      expect(signals).toHaveLength(1);
      expect(signals[0]!.signalType).toBe('build');
      expect(signals[0]!.passed).toBe(false);
    });

    it('should detect npm run build success', () => {
      const entries: SessionEntry[] = [
        createBashToolEntry('bash-1', 'npm run build', '2026-01-24T10:00:00Z', 1),
        createToolResult(
          'bash-1',
          `> project@1.0.0 build
> tsc && node build.js

Build complete.`,
          '2026-01-24T10:00:10Z',
          2
        ),
      ];

      const signals = extractQualitySignals(entries, 'session-npm-build');

      expect(signals).toHaveLength(1);
      expect(signals[0]!.signalType).toBe('build');
      expect(signals[0]!.passed).toBe(true);
    });

    it('should detect npm run build failure', () => {
      const entries: SessionEntry[] = [
        createBashToolEntry('bash-1', 'npm run build', '2026-01-24T10:00:00Z', 1),
        createToolResult(
          'bash-1',
          `> project@1.0.0 build
> tsc

error TS2304: Cannot find name 'missing'.
npm ERR! code 1`,
          '2026-01-24T10:00:10Z',
          2,
          true
        ),
      ];

      const signals = extractQualitySignals(entries, 'session-npm-build-fail');

      expect(signals).toHaveLength(1);
      expect(signals[0]!.signalType).toBe('build');
      expect(signals[0]!.passed).toBe(false);
    });

    it('should detect bun build success', () => {
      const entries: SessionEntry[] = [
        createBashToolEntry('bash-1', 'bun build src/index.ts', '2026-01-24T10:00:00Z', 1),
        createToolResult(
          'bash-1',
          `  dist/index.js  150.25 KB

[47ms] bundle 1 modules`,
          '2026-01-24T10:00:05Z',
          2
        ),
      ];

      const signals = extractQualitySignals(entries, 'session-bun-build');

      expect(signals).toHaveLength(1);
      expect(signals[0]!.signalType).toBe('build');
      expect(signals[0]!.passed).toBe(true);
    });
  });

  describe('lint output detection', () => {
    it('should detect eslint success', () => {
      const entries: SessionEntry[] = [
        createBashToolEntry('bash-1', 'npx eslint src/', '2026-01-24T10:00:00Z', 1),
        createToolResult('bash-1', '', '2026-01-24T10:00:05Z', 2),
      ];

      const signals = extractQualitySignals(entries, 'session-eslint');

      expect(signals).toHaveLength(1);
      expect(signals[0]!.signalType).toBe('lint');
      expect(signals[0]!.passed).toBe(true);
    });

    it('should detect eslint failure', () => {
      const entries: SessionEntry[] = [
        createBashToolEntry('bash-1', 'eslint src/', '2026-01-24T10:00:00Z', 1),
        createToolResult(
          'bash-1',
          `/src/index.ts
  10:5  error  'unused' is assigned a value but never used  @typescript-eslint/no-unused-vars
  25:1  error  Missing return type on function              @typescript-eslint/explicit-function-return-type

✖ 2 problems (2 errors, 0 warnings)`,
          '2026-01-24T10:00:05Z',
          2,
          true
        ),
      ];

      const signals = extractQualitySignals(entries, 'session-eslint-fail');

      expect(signals).toHaveLength(1);
      expect(signals[0]!.signalType).toBe('lint');
      expect(signals[0]!.passed).toBe(false);
    });

    it('should detect biome check success', () => {
      const entries: SessionEntry[] = [
        createBashToolEntry('bash-1', 'biome check src/', '2026-01-24T10:00:00Z', 1),
        createToolResult(
          'bash-1',
          `Checked 42 files in 150ms. No fixes needed.`,
          '2026-01-24T10:00:05Z',
          2
        ),
      ];

      const signals = extractQualitySignals(entries, 'session-biome');

      expect(signals).toHaveLength(1);
      expect(signals[0]!.signalType).toBe('lint');
      expect(signals[0]!.passed).toBe(true);
    });

    it('should detect biome check failure', () => {
      const entries: SessionEntry[] = [
        createBashToolEntry('bash-1', 'biome check src/', '2026-01-24T10:00:00Z', 1),
        createToolResult(
          'bash-1',
          `src/index.ts:10:5 lint/suspicious/noExplicitAny ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ✖ Unexpected any. Specify a different type.

Checked 42 files in 150ms. Some fixes needed.`,
          '2026-01-24T10:00:05Z',
          2,
          true
        ),
      ];

      const signals = extractQualitySignals(entries, 'session-biome-fail');

      expect(signals).toHaveLength(1);
      expect(signals[0]!.signalType).toBe('lint');
      expect(signals[0]!.passed).toBe(false);
    });

    it('should detect prettier format check success', () => {
      const entries: SessionEntry[] = [
        createBashToolEntry('bash-1', 'prettier --check src/', '2026-01-24T10:00:00Z', 1),
        createToolResult(
          'bash-1',
          `Checking formatting...
All matched files use Prettier code style!`,
          '2026-01-24T10:00:05Z',
          2
        ),
      ];

      const signals = extractQualitySignals(entries, 'session-prettier');

      expect(signals).toHaveLength(1);
      expect(signals[0]!.signalType).toBe('lint');
      expect(signals[0]!.passed).toBe(true);
    });

    it('should detect prettier format check failure', () => {
      const entries: SessionEntry[] = [
        createBashToolEntry('bash-1', 'prettier --check src/', '2026-01-24T10:00:00Z', 1),
        createToolResult(
          'bash-1',
          `Checking formatting...
[warn] src/index.ts
[warn] src/utils.ts
[warn] Code style issues found in 2 files.`,
          '2026-01-24T10:00:05Z',
          2,
          true
        ),
      ];

      const signals = extractQualitySignals(entries, 'session-prettier-fail');

      expect(signals).toHaveLength(1);
      expect(signals[0]!.signalType).toBe('lint');
      expect(signals[0]!.passed).toBe(false);
    });
  });

  describe('multiple quality signals', () => {
    it('should extract multiple signals from a session', () => {
      const entries: SessionEntry[] = [
        createBashToolEntry('bash-1', 'tsc --noEmit', '2026-01-24T10:00:00Z', 1),
        createToolResult('bash-1', '', '2026-01-24T10:00:05Z', 2),
        createBashToolEntry('bash-2', 'eslint src/', '2026-01-24T10:00:10Z', 3),
        createToolResult('bash-2', '', '2026-01-24T10:00:15Z', 4),
        createBashToolEntry('bash-3', 'bun test', '2026-01-24T10:00:20Z', 5),
        createToolResult(
          'bash-3',
          `bun test v1.0.0
 ✓ tests/example.test.ts
 1 pass`,
          '2026-01-24T10:00:30Z',
          6
        ),
      ];

      const signals = extractQualitySignals(entries, 'session-multi');

      expect(signals).toHaveLength(3);
      expect(signals[0]!.signalType).toBe('build');
      expect(signals[1]!.signalType).toBe('lint');
      expect(signals[2]!.signalType).toBe('test');
    });
  });

  describe('edge cases', () => {
    it('should return empty array for entries with no quality signals', () => {
      const entries: SessionEntry[] = [
        {
          type: 'user',
          uuid: 'user-1',
          timestamp: '2026-01-24T10:00:00Z',
          lineNumber: 1,
          message: { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
        },
        {
          type: 'assistant',
          uuid: 'assistant-1',
          timestamp: '2026-01-24T10:00:01Z',
          lineNumber: 2,
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'read-1',
                name: 'Read',
                input: { file_path: '/src/index.ts' },
              },
            ],
          },
        },
        createToolResult('read-1', 'File contents', '2026-01-24T10:00:02Z', 3),
      ];

      const signals = extractQualitySignals(entries, 'session-no-quality');

      expect(signals).toHaveLength(0);
    });

    it('should return empty array for empty entries', () => {
      const signals = extractQualitySignals([], 'session-empty');

      expect(signals).toHaveLength(0);
    });

    it('should handle Bash command without result', () => {
      const entries: SessionEntry[] = [
        createBashToolEntry('bash-1', 'bun test', '2026-01-24T10:00:00Z', 1),
        // No result entry
      ];

      const signals = extractQualitySignals(entries, 'session-pending');

      // Should still extract a signal but with null passed
      expect(signals).toHaveLength(1);
      expect(signals[0]!.passed).toBe(null);
    });

    it('should preserve source location for tracing', () => {
      const entries: SessionEntry[] = [
        {
          ...createBashToolEntry('bash-1', 'bun test', '2026-01-24T10:00:00Z', 42),
          filePath: '/path/to/session.jsonl',
        },
        createToolResult('bash-1', '1 pass', '2026-01-24T10:00:05Z', 43),
      ];

      const signals = extractQualitySignals(entries, 'session-trace');

      expect(signals[0]!.filePath).toBe('/path/to/session.jsonl');
      expect(signals[0]!.lineNumber).toBe(42);
    });
  });
});

// =============================================================================
// Quality Signal Aggregation Tests
// =============================================================================

describe('aggregateQualitySignals', () => {
  it('should aggregate by signal type and outcome', () => {
    const entries: SessionEntry[] = [
      createBashToolEntry('bash-1', 'bun test', '2026-01-24T10:00:00Z', 1),
      createToolResult('bash-1', '2 pass', '2026-01-24T10:00:05Z', 2),
      createBashToolEntry('bash-2', 'bun test', '2026-01-24T10:00:10Z', 3),
      createToolResult('bash-2', '1 fail', '2026-01-24T10:00:15Z', 4, true),
      createBashToolEntry('bash-3', 'tsc', '2026-01-24T10:00:20Z', 5),
      createToolResult('bash-3', '', '2026-01-24T10:00:25Z', 6),
      createBashToolEntry('bash-4', 'eslint src/', '2026-01-24T10:00:30Z', 7),
      createToolResult('bash-4', '', '2026-01-24T10:00:35Z', 8),
    ];

    const signals = extractQualitySignals(entries, 'session-agg');
    const summary = aggregateQualitySignals(signals);

    expect(summary.testsPassed).toBe(1);
    expect(summary.testsFailed).toBe(1);
    expect(summary.testsIndeterminate).toBe(0);
    expect(summary.buildsPassed).toBe(1);
    expect(summary.buildsFailed).toBe(0);
    expect(summary.buildsIndeterminate).toBe(0);
    expect(summary.lintsPassed).toBe(1);
    expect(summary.lintsFailed).toBe(0);
    expect(summary.lintsIndeterminate).toBe(0);
  });

  it('should count indeterminate correctly', () => {
    const entries: SessionEntry[] = [
      createBashToolEntry('bash-1', 'bun test', '2026-01-24T10:00:00Z', 1),
      createToolResult('bash-1', 'Running tests...', '2026-01-24T10:00:05Z', 2),
    ];

    const signals = extractQualitySignals(entries, 'session-indet');
    const summary = aggregateQualitySignals(signals);

    expect(summary.testsIndeterminate).toBe(1);
    expect(summary.testsPassed).toBe(0);
    expect(summary.testsFailed).toBe(0);
  });

  it('should return zeros for no signals', () => {
    const summary = aggregateQualitySignals([]);

    expect(summary.testsPassed).toBe(0);
    expect(summary.testsFailed).toBe(0);
    expect(summary.testsIndeterminate).toBe(0);
    expect(summary.buildsPassed).toBe(0);
    expect(summary.buildsFailed).toBe(0);
    expect(summary.buildsIndeterminate).toBe(0);
    expect(summary.lintsPassed).toBe(0);
    expect(summary.lintsFailed).toBe(0);
    expect(summary.lintsIndeterminate).toBe(0);
  });
});
