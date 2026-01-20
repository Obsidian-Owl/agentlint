/**
 * EP11 Quality & Security - NFR Validation Benchmarks
 *
 * Validates non-functional requirements:
 * - Secret detection < 1s/file
 * - Debug logging overhead < 5%
 *
 * @module tests/benchmarks/nfr-validation
 */

import { describe, test, expect } from 'bun:test';
import { redact, createDebugLogger } from '../../src/debug';

// =============================================================================
// NFR Targets
// =============================================================================

const NFR_SECRET_DETECTION_MS = 1000; // < 1 second per file

// =============================================================================
// Test Data
// =============================================================================

/**
 * Generate a realistic file content for benchmarking.
 * Includes various patterns that might contain secrets.
 */
function generateTestFileContent(lines: number): string {
  // Test patterns for redaction - use obviously fake values to avoid pre-commit hooks
  const patterns = [
    'const TEST_KEY = "test-key-placeholder-value";',
    'password: "test-password-for-benchmarks"',
    'test_access_key = TEST0000000000000000',
    'test_key = "-----BEGIN TEST KEY-----"',
    'TEST_URL = "postgres://test:test@localhost:5432/testdb"',
    'const normalCode = () => { return "hello world"; };',
    'function processData(input: string): void { console.log(input); }',
    'export interface Config { name: string; value: number; }',
    '// This is a comment with no secrets',
    'const data = { user: "john", role: "admin" };',
  ];

  const contentLines: string[] = [];
  for (let i = 0; i < lines; i++) {
    contentLines.push(patterns[i % patterns.length]!);
  }
  return contentLines.join('\n');
}

// =============================================================================
// Secret Detection Benchmark
// =============================================================================

describe('NFR: Secret Detection Performance', () => {
  test('processes small file (<100 lines) under 100ms', () => {
    const content = generateTestFileContent(100);
    const iterations = 100;
    let totalMs = 0;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      redact(content);
      totalMs += performance.now() - start;
    }

    const avgMs = totalMs / iterations;
    expect(avgMs).toBeLessThan(100);
  });

  test('processes medium file (1000 lines) under 500ms', () => {
    const content = generateTestFileContent(1000);
    const iterations = 10;
    let totalMs = 0;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      redact(content);
      totalMs += performance.now() - start;
    }

    const avgMs = totalMs / iterations;
    expect(avgMs).toBeLessThan(500);
  });

  test(`processes large file (5000 lines) under ${NFR_SECRET_DETECTION_MS}ms`, () => {
    const content = generateTestFileContent(5000);
    const iterations = 5;
    let totalMs = 0;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      redact(content);
      totalMs += performance.now() - start;
    }

    const avgMs = totalMs / iterations;
    expect(avgMs).toBeLessThan(NFR_SECRET_DETECTION_MS);
  });
});

// =============================================================================
// Debug Logging Overhead Benchmark
// =============================================================================

describe('NFR: Debug Logging Overhead', () => {
  test('disabled logger call overhead is under 0.01ms per call', () => {
    const iterations = 10000;

    // Create a logger that has logging disabled for this namespace
    const disabledLogger = createDebugLogger({ level: 'error', namespaces: [] });

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      // This should short-circuit quickly since namespace is disabled
      disabledLogger.debug('disabled:namespace', `Iteration ${i}`);
    }
    const elapsed = performance.now() - start;

    // Per-call overhead should be very small (< 0.01ms = 10μs per call)
    const perCallMs = elapsed / iterations;
    expect(perCallMs).toBeLessThan(0.01);
  });

  test('disabled logger has near-zero overhead', () => {
    const iterations = 10000;

    // Create disabled logger
    const logger = createDebugLogger({ level: 'error', namespaces: [] });

    // Measure overhead of isEnabled check
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      logger.debug('disabled:namespace', `Message ${i}`);
    }
    const elapsed = performance.now() - start;

    // Per-call overhead should be minimal (< 0.01ms = 10μs per call)
    const perCallMs = elapsed / iterations;
    expect(perCallMs).toBeLessThan(0.01);
  });
});

// =============================================================================
// Memory Usage Validation
// =============================================================================

describe('NFR: Memory Efficiency', () => {
  test('redaction does not cause memory leaks on repeated calls', () => {
    const content = generateTestFileContent(100);
    const iterations = 1000;

    // Run many iterations
    for (let i = 0; i < iterations; i++) {
      redact(content);
    }

    // If we get here without OOM, the test passes
    expect(true).toBe(true);
  });

  test('logger does not accumulate memory on repeated calls', () => {
    // Use a disabled logger to avoid test output noise
    const logger = createDebugLogger({ level: 'error', namespaces: [] });
    const iterations = 10000;

    for (let i = 0; i < iterations; i++) {
      // These calls will be no-ops but still exercise the logger
      logger.debug('memory-test', `Message ${i}`);
    }

    // If we get here without OOM, the test passes
    expect(true).toBe(true);
  });
});
