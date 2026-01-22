/**
 * Performance tests for debug redaction
 *
 * Tests that secret redaction meets performance targets:
 * - 1000 lines < 500ms
 * - Large strings (100KB) < 100ms
 *
 * @module tests/performance/redaction
 */

import { describe, it, expect } from 'bun:test';
import { redact } from '../../src/debug/redaction';

// =============================================================================
// Test Data Generators
// =============================================================================

/**
 * Generate a string with embedded secrets for testing.
 * Secrets are designed to match the actual redaction patterns.
 */
function generateTestContent(lineCount: number): string {
  const lines: string[] = [];
  const secretTypes = [
    // OpenAI key (sk-[a-zA-Z0-9]{32,}) - needs 32+ chars after sk-
    'API key: sk-abcdefghijklmnopqrstuvwxyz123456789012',
    // AWS access key (AKIA[A-Z0-9]{16})
    'AWS access key: AKIAIOSFODNN7EXAMPLE',
    // GitHub token (ghp_[a-zA-Z0-9]{36,})
    'GitHub token: ghp_abcdefghijklmnopqrstuvwxyz1234567890',
    // Password with pattern
    'Password: password=MySecretPass123!',
    // Connection string with credentials
    'Connection string: postgresql://user:secretpass@localhost/db',
    // JWT token
    'Bearer token: Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
    // NPM token (npm_[a-zA-Z0-9]{36,})
    'NPM token: npm_abcdefghijklmnopqrstuvwxyz1234567890',
    // Normal lines
    'Normal log line with no secrets',
    'DEBUG: Processing request from 192.168.1.100',
    'INFO: User john@example.com logged in',
    'ERROR: Connection timeout after 30s',
    // Stripe key (sk_live_[a-zA-Z0-9]{24,})
    'Stripe key: sk_live_1234567890abcdefghijklmnop',
  ];

  for (let i = 0; i < lineCount; i++) {
    lines.push(secretTypes[i % secretTypes.length]!);
  }

  return lines.join('\n');
}

/**
 * Generate a large string with realistic log content.
 */
function generateLargeContent(sizeKB: number): string {
  const targetSize = sizeKB * 1024;
  const lines: string[] = [];
  let currentSize = 0;

  const templates = [
    '[2024-01-15T10:30:45.123Z] INFO: Application started on port 3000',
    '[2024-01-15T10:30:46.234Z] DEBUG: Database connection established',
    '[2024-01-15T10:30:47.345Z] WARN: High memory usage detected: 85%',
    '[2024-01-15T10:30:48.456Z] ERROR: Failed to process request: timeout',
    // OpenAI key with 32+ chars after sk-
    '[2024-01-15T10:30:49.567Z] INFO: API key used: sk-abcdefghijklmnopqrstuvwxyz123456',
    // AWS key
    '[2024-01-15T10:30:50.678Z] DEBUG: AWS credentials: AKIAIOSFODNN7EXAMPLE',
    '[2024-01-15T10:30:51.789Z] INFO: Normal processing completed',
    '[2024-01-15T10:30:52.890Z] DEBUG: Cache hit ratio: 0.95',
  ];

  while (currentSize < targetSize) {
    const line = templates[lines.length % templates.length]!;
    lines.push(line);
    currentSize += line.length + 1; // +1 for newline
  }

  return lines.join('\n');
}

// =============================================================================
// Performance Tests
// =============================================================================

describe('Debug Redaction Performance', () => {
  describe('NFR: 1000 lines < 500ms', () => {
    it('should redact 1000 lines in under 500ms', () => {
      const content = generateTestContent(1000);

      const startTime = performance.now();
      const redacted = redact(content);
      const elapsed = performance.now() - startTime;

      // Verify redaction worked - OpenAI key should be redacted
      expect(redacted).not.toContain('sk-abcdefghijklmnopqrstuvwxyz123456789012');
      // AWS key should be redacted
      expect(redacted).not.toContain('AKIAIOSFODNN7EXAMPLE');
      // Should contain redaction markers
      expect(redacted).toContain('[REDACTED:');

      // Verify performance
      expect(elapsed).toBeLessThan(500);
      console.log(`Redacted 1000 lines in ${elapsed.toFixed(2)}ms`);
    });

    it('should redact 5000 lines in under 2000ms', () => {
      const content = generateTestContent(5000);

      const startTime = performance.now();
      const redacted = redact(content);
      const elapsed = performance.now() - startTime;

      expect(redacted).toContain('[REDACTED:');
      expect(elapsed).toBeLessThan(2000);
      console.log(`Redacted 5000 lines in ${elapsed.toFixed(2)}ms`);
    });

    it('should redact 10000 lines in under 4000ms', () => {
      const content = generateTestContent(10000);

      const startTime = performance.now();
      const redacted = redact(content);
      const elapsed = performance.now() - startTime;

      expect(redacted).toContain('[REDACTED:');
      expect(elapsed).toBeLessThan(4000);
      console.log(`Redacted 10000 lines in ${elapsed.toFixed(2)}ms`);
    });
  });

  describe('Large string handling', () => {
    it('should redact 100KB content in under 100ms', () => {
      const content = generateLargeContent(100);

      const startTime = performance.now();
      const redacted = redact(content);
      const elapsed = performance.now() - startTime;

      expect(redacted).toContain('[REDACTED:');
      expect(elapsed).toBeLessThan(100);
      console.log(`Redacted 100KB in ${elapsed.toFixed(2)}ms`);
    });

    it('should redact 500KB content in under 500ms', () => {
      const content = generateLargeContent(500);

      const startTime = performance.now();
      const redacted = redact(content);
      const elapsed = performance.now() - startTime;

      expect(redacted).toContain('[REDACTED:');
      expect(elapsed).toBeLessThan(500);
      console.log(`Redacted 500KB in ${elapsed.toFixed(2)}ms`);
    });

    it('should redact 1MB content in under 1000ms', () => {
      const content = generateLargeContent(1024);

      const startTime = performance.now();
      const redacted = redact(content);
      const elapsed = performance.now() - startTime;

      expect(redacted).toContain('[REDACTED:');
      expect(elapsed).toBeLessThan(1000);
      console.log(`Redacted 1MB in ${elapsed.toFixed(2)}ms`);
    });
  });

  describe('Repeated redaction efficiency', () => {
    it('should maintain consistent performance over 100 iterations', () => {
      const content = generateTestContent(100);
      const times: number[] = [];

      for (let i = 0; i < 100; i++) {
        const startTime = performance.now();
        redact(content);
        times.push(performance.now() - startTime);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      // Average should be fast
      expect(avgTime).toBeLessThan(10);
      // No single iteration should be too slow
      expect(maxTime).toBeLessThan(50);

      console.log(`100 iterations: avg=${avgTime.toFixed(2)}ms, max=${maxTime.toFixed(2)}ms`);
    });
  });

  describe('Pattern matching efficiency', () => {
    it('should handle content with no secrets efficiently', () => {
      const cleanContent = Array(1000)
        .fill('Normal log line with no sensitive data at all')
        .join('\n');

      const startTime = performance.now();
      const redacted = redact(cleanContent);
      const elapsed = performance.now() - startTime;

      // Should be unchanged
      expect(redacted).toBe(cleanContent);
      // Should still be fast
      expect(elapsed).toBeLessThan(100);
      console.log(`Scanned 1000 clean lines in ${elapsed.toFixed(2)}ms`);
    });

    it('should handle content with many secrets efficiently', () => {
      // Every line has secrets that match actual patterns
      // OpenAI: sk-[a-zA-Z0-9]{32,}  GitHub: ghp_[a-zA-Z0-9]{36,}
      const secretContent = Array(1000)
        .fill(
          'API: sk-abcdefghijklmnopqrstuvwxyz123456 and ghp_abcdefghijklmnopqrstuvwxyz1234567890'
        )
        .join('\n');

      const startTime = performance.now();
      const redacted = redact(secretContent);
      const elapsed = performance.now() - startTime;

      // All should be redacted
      expect(redacted).not.toContain('sk-abcdefghijklmnopqrstuvwxyz123456');
      expect(redacted).not.toContain('ghp_abcdefghijklmnopqrstuvwxyz1234567890');
      expect(elapsed).toBeLessThan(500);
      console.log(`Redacted 2000 secrets in ${elapsed.toFixed(2)}ms`);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string quickly', () => {
      const startTime = performance.now();
      const redacted = redact('');
      const elapsed = performance.now() - startTime;

      expect(redacted).toBe('');
      expect(elapsed).toBeLessThan(1);
    });

    it('should handle single character quickly', () => {
      const startTime = performance.now();
      const redacted = redact('x');
      const elapsed = performance.now() - startTime;

      expect(redacted).toBe('x');
      expect(elapsed).toBeLessThan(1);
    });

    it('should handle very long single line', () => {
      // Use AWS key pattern (AKIA[A-Z0-9]{16}) which is more reliably detected
      const secret = 'AKIAIOSFODNN7EXAMPLE';
      // Use spaces to ensure word boundaries
      const longLine = 'x '.repeat(50000) + secret + ' y'.repeat(50000);

      const startTime = performance.now();
      const redacted = redact(longLine);
      const elapsed = performance.now() - startTime;

      expect(redacted).not.toContain(secret);
      expect(redacted).toContain('[REDACTED:');
      expect(elapsed).toBeLessThan(200);
      console.log(`Redacted 200KB single line in ${elapsed.toFixed(2)}ms`);
    });
  });
});
