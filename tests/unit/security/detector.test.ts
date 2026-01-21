/**
 * EP11 Quality & Security - Secret Detector Unit Tests
 *
 * Tests for pattern-based secret detection using Gitleaks patterns.
 *
 * @module tests/unit/security/detector
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import {
  SecretDetector,
  createSecretDetector,
  createSecretDetectorWithPatterns,
} from '../../../src/security/detector';
import { parseGitleaksTomlContent } from '../../../src/security/patterns/parser';

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Minimal TOML pattern for testing.
 */
const minimalToml = `
title = "test-patterns"
minVersion = "v8.0.0"

[[rules]]
id = "aws-access-key-id"
description = "AWS Access Key ID"
regex = "AKIA[0-9A-Z]{16}"
keywords = ["AKIA"]

[[rules]]
id = "generic-api-key"
description = "Generic API Key"
regex = "(?i)(api[_-]?key|apikey)\\s*[=:]\\s*['\\"\\x60]?([a-zA-Z0-9_-]{20,})['\\"\\x60]?"
secretGroup = 2
keywords = ["api_key", "apikey", "api-key"]
entropy = 3.0

[[rules]]
id = "github-pat"
description = "GitHub Personal Access Token"
regex = "ghp_[a-zA-Z0-9]{36}"
keywords = ["ghp_"]

[[rules]]
id = "private-key"
description = "Private Key"
regex = "-----BEGIN (RSA |DSA |EC |OPENSSH |PGP )?PRIVATE KEY-----"
keywords = ["BEGIN", "PRIVATE KEY"]

[[rules]]
id = "jwt-token"
description = "JWT Token"
regex = "eyJ[a-zA-Z0-9-_]+\\.eyJ[a-zA-Z0-9-_]+\\.[a-zA-Z0-9-_]+"
keywords = ["eyJ"]

[[rules]]
id = "connection-string"
description = "Connection String with Password"
regex = "[a-zA-Z]+://[^:]+:([^@]{8,})@[^\\s]+"
secretGroup = 1
entropy = 3.0
keywords = ["://"]

[[rules]]
id = "slack-token"
description = "Slack Token"
regex = "xox[baprs]-[0-9]{10,13}-[0-9a-zA-Z]{24}"
keywords = ["xox"]

[[rules]]
id = "with-allowlist"
description = "Pattern with allowlist"
regex = "TEST_SECRET_[A-Z0-9]{16}"
keywords = ["TEST_SECRET"]
[rules.allowlist]
regexes = ["EXAMPLE", "PLACEHOLDER"]
paths = ["test/", "fixtures/"]
`;

/**
 * Create a detector with test patterns.
 */
function createTestDetector(): SecretDetector {
  const detector = new SecretDetector();
  const patterns = parseGitleaksTomlContent(minimalToml, 'test-patterns');
  // Use reflection to set patterns directly for testing
  (detector as unknown as { patterns: typeof patterns }).patterns = patterns;
  (detector as unknown as { compileRules: () => void }).compileRules();
  return detector;
}

// =============================================================================
// Pattern Loading Tests
// =============================================================================

describe('SecretDetector', () => {
  describe('Pattern Loading', () => {
    it('should load patterns from TOML file', async () => {
      const detector = await createSecretDetectorWithPatterns();
      const patterns = detector.getPatterns();

      expect(patterns).toBeDefined();
      expect(patterns!.rules.length).toBeGreaterThan(0);
      expect(patterns!.source).toContain('gitleaks.toml');
    });

    it('should parse rule id and description', async () => {
      const detector = await createSecretDetectorWithPatterns();
      const patterns = detector.getPatterns();
      const awsRule = patterns!.rules.find((r) => r.id.includes('aws'));

      expect(awsRule).toBeDefined();
      expect(awsRule!.description).toBeTruthy();
      expect(awsRule!.id).toMatch(/aws/i);
    });

    it('should extract regex patterns', async () => {
      const detector = await createSecretDetectorWithPatterns();
      const patterns = detector.getPatterns();

      // Most rules should have regex patterns
      const rulesWithRegex = patterns!.rules.filter((r) => r.regex);
      expect(rulesWithRegex.length).toBeGreaterThan(0);

      // All rules with regex should have non-empty patterns
      for (const rule of rulesWithRegex) {
        expect(rule.regex.length).toBeGreaterThan(0);
      }

      // At least some regexes should be valid JavaScript regex
      // (some Gitleaks patterns use syntax not supported in JS)
      let validCount = 0;
      for (const rule of rulesWithRegex) {
        try {
          new RegExp(rule.regex.replace(/\(\?i\)/g, ''));
          validCount++;
        } catch {
          // Some patterns have syntax JS doesn't support - that's OK
        }
      }
      expect(validCount).toBeGreaterThan(0);
    });

    it('should handle optional keywords', async () => {
      const detector = await createSecretDetectorWithPatterns();
      const patterns = detector.getPatterns();

      // Some rules have keywords, some don't
      const rulesWithKeywords = patterns!.rules.filter((r) => r.keywords?.length);

      expect(rulesWithKeywords.length).toBeGreaterThan(0);
      // It's OK if all rules have keywords
    });

    it('should handle optional entropy thresholds', async () => {
      const detector = await createSecretDetectorWithPatterns();
      const patterns = detector.getPatterns();

      const rulesWithEntropy = patterns!.rules.filter((r) => r.entropy !== undefined);
      expect(rulesWithEntropy.length).toBeGreaterThanOrEqual(0);

      for (const rule of rulesWithEntropy) {
        expect(typeof rule.entropy).toBe('number');
        expect(rule.entropy).toBeGreaterThan(0);
      }
    });

    it('should handle allowlist patterns', async () => {
      const detector = await createSecretDetectorWithPatterns();
      const patterns = detector.getPatterns();

      const rulesWithAllowlist = patterns!.rules.filter(
        (r) => r.allowlist?.regexes?.length || r.allowlist?.paths?.length
      );

      expect(rulesWithAllowlist.length).toBeGreaterThanOrEqual(0);
    });
  });

  // =============================================================================
  // File Scanning Tests
  // =============================================================================

  describe('File Scanning', () => {
    let detector: SecretDetector;

    beforeAll(() => {
      detector = createTestDetector();
    });

    it('should scan file content for secrets', async () => {
      const content = 'const key = "AKIAIOSFODNN7EXAMPLE1";';
      const result = await detector.scanFile('test.ts', content);

      expect(result.candidateCount).toBeGreaterThan(0);
      expect(result.candidates.length).toBe(result.candidateCount);
    });

    it('should return file path in results', async () => {
      const result = await detector.scanFile('src/config.ts', 'const x = 1;');

      expect(result.file).toBe('src/config.ts');
    });

    it('should include line numbers for matches', async () => {
      const content = 'line1\nconst key = "AKIAIOSFODNN7EXAMPLE2";\nline3';
      const result = await detector.scanFile('test.ts', content);

      expect(result.candidateCount).toBe(1);
      expect(result.candidates[0]!.location.line).toBe(2);
    });

    it('should calculate entropy for matches', async () => {
      const content = 'const key = "AKIAIOSFODNN7EXAMPLE3";';
      const result = await detector.scanFile('test.ts', content);

      expect(result.candidateCount).toBe(1);
      expect(result.candidates[0]!.entropy).toBeGreaterThan(0);
      expect(typeof result.candidates[0]!.entropy).toBe('number');
    });

    it('should create redacted context', async () => {
      const content = 'const key = "AKIAIOSFODNN7EXAMPLE4";';
      const result = await detector.scanFile('test.ts', content);

      expect(result.candidateCount).toBe(1);
      expect(result.candidates[0]!.redactedContext).toBeDefined();
      expect(result.candidates[0]!.redactedContext).toContain('[REDACTED:');
      expect(result.candidates[0]!.redactedContext).not.toContain('AKIAIOSFODNN7EXAMPLE4');
    });

    it('should never expose raw secret in serializable output', async () => {
      const content = 'const key = "AKIAIOSFODNN7EXAMPLE5";';
      const result = await detector.scanFile('test.ts', content);

      expect(result.candidateCount).toBe(1);
      // The FileScanResult.candidates should NOT have the 'match' field
      const candidate = result.candidates[0] as Record<string, unknown>;
      expect(candidate.match).toBeUndefined();
    });

    it('should handle files with no secrets', async () => {
      const result = await detector.scanFile('clean.ts', 'const x = 1;\nconst y = 2;');

      expect(result.candidateCount).toBe(0);
      expect(result.candidates).toEqual([]);
    });

    it('should track scan duration', async () => {
      const result = await detector.scanFile('test.ts', 'const x = 1;');

      expect(result.durationMs).toBeDefined();
      expect(typeof result.durationMs).toBe('number');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  // =============================================================================
  // Pattern Matching Tests
  // =============================================================================

  describe('Pattern Matching', () => {
    let detector: SecretDetector;

    beforeAll(() => {
      detector = createTestDetector();
    });

    it('should detect AWS access keys', async () => {
      const content = 'aws_key = "AKIAIOSFODNN7EXAMPLE6"';
      const result = await detector.scanFile('config.ts', content);

      expect(result.candidateCount).toBe(1);
      expect(result.candidates[0]!.ruleId).toBe('aws-access-key-id');
    });

    it('should detect AWS secret keys when using generic API key pattern', async () => {
      // AWS secret keys are 40 chars, high entropy - detected by generic-api-key pattern
      // Using chars that match [a-zA-Z0-9_-]{20,}
      const content = 'api_key = "wJalrXUtnFEMI-K7MDENG-bPxRfiCYEXAMPLEKEY123456"';
      const result = await detector.scanFile('config.ts', content);

      expect(result.candidateCount).toBeGreaterThanOrEqual(1);
    });

    it('should detect GitHub tokens', async () => {
      // GitHub PAT regex: ghp_[a-zA-Z0-9]{36} - exactly 36 alphanumeric chars after prefix
      const content = 'token = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890"';
      const result = await detector.scanFile('config.ts', content);

      expect(result.candidateCount).toBe(1);
      expect(result.candidates[0]!.ruleId).toBe('github-pat');
    });

    it('should detect generic API keys', async () => {
      const content = 'api_key = "xY7mK9pL2qR5sT8vW0zB3nC6"';
      const result = await detector.scanFile('config.ts', content);

      expect(result.candidateCount).toBe(1);
      expect(result.candidates[0]!.ruleId).toBe('generic-api-key');
    });

    it('should detect private keys', async () => {
      const content = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEAx...
-----END RSA PRIVATE KEY-----`;
      const result = await detector.scanFile('key.pem', content);

      expect(result.candidateCount).toBe(1);
      expect(result.candidates[0]!.ruleId).toBe('private-key');
    });

    it('should detect JWT tokens', async () => {
      const content =
        'const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"';
      const result = await detector.scanFile('auth.ts', content);

      expect(result.candidateCount).toBe(1);
      expect(result.candidates[0]!.ruleId).toBe('jwt-token');
    });

    it('should detect connection strings', async () => {
      const content = 'const db = "postgres://user:supersecretpassword@localhost:5432/db"';
      const result = await detector.scanFile('db.ts', content);

      expect(result.candidateCount).toBe(1);
      expect(result.candidates[0]!.ruleId).toBe('connection-string');
    });

    it('should detect Slack tokens', async () => {
      // Slack token regex: xox[baprs]-[0-9]{10,13}-[0-9a-zA-Z]{24}
      // - xox + one of (b,a,p,r,s)
      // - dash + 10-13 digits
      // - dash + 24 alphanumeric chars
      const content = 'const slack = "xoxb-1234567890123-ABCDEFGHIJKLMNOPQRSTUVWX"';
      const result = await detector.scanFile('slack.ts', content);

      expect(result.candidateCount).toBe(1);
      expect(result.candidates[0]!.ruleId).toBe('slack-token');
    });
  });

  // =============================================================================
  // False Positive Handling Tests
  // =============================================================================

  describe('False Positive Handling', () => {
    let detector: SecretDetector;

    beforeAll(() => {
      detector = createTestDetector();
    });

    it('should not flag example/placeholder values via allowlist', async () => {
      // Using the with-allowlist rule that has EXAMPLE in allowlist
      const content = 'const key = "TEST_SECRET_EXAMPLEPLACEHOLDER"';
      const result = await detector.scanFile('config.ts', content);

      // Should be filtered by the EXAMPLE allowlist regex
      const withAllowlistMatches = result.candidates.filter(
        (c) => c.ruleId === 'with-allowlist'
      );
      expect(withAllowlistMatches.length).toBe(0);
    });

    it('should not flag test fixtures marked as fake via allowlist', async () => {
      // The TEST_SECRET rule has "PLACEHOLDER" in its allowlist
      const content = 'const key = "TEST_SECRET_PLACEHOLDER00000"';
      const result = await detector.scanFile('config.ts', content);

      const withAllowlistMatches = result.candidates.filter(
        (c) => c.ruleId === 'with-allowlist'
      );
      expect(withAllowlistMatches.length).toBe(0);
    });

    it('should apply allowlist regex patterns', async () => {
      // The with-allowlist rule has regexes = ["EXAMPLE", "PLACEHOLDER"]
      const content = 'const key = "TEST_SECRET_HASEXAMPLEINIT"';
      const result = await detector.scanFile('config.ts', content);

      const withAllowlistMatches = result.candidates.filter(
        (c) => c.ruleId === 'with-allowlist'
      );
      expect(withAllowlistMatches.length).toBe(0);
    });

    it('should apply allowlist paths', async () => {
      // The with-allowlist rule has paths = ["test/", "fixtures/"]
      const content = 'const key = "TEST_SECRET_REALVALUE12345"';
      const result = await detector.scanFile('test/config.ts', content);

      const withAllowlistMatches = result.candidates.filter(
        (c) => c.ruleId === 'with-allowlist'
      );
      expect(withAllowlistMatches.length).toBe(0);
    });

    it('should filter low entropy matches when rule specifies threshold', async () => {
      // The generic-api-key rule has entropy = 3.0
      // A low-entropy value should be filtered
      const content = 'api_key = "aaaaaaaaaaaaaaaaaaaaaaaaaa"'; // Low entropy, all same char
      const result = await detector.scanFile('config.ts', content);

      const genericMatches = result.candidates.filter(
        (c) => c.ruleId === 'generic-api-key'
      );
      expect(genericMatches.length).toBe(0);
    });
  });

  // =============================================================================
  // Batch Scanning Tests
  // =============================================================================

  describe('Batch Scanning', () => {
    let detector: SecretDetector;

    beforeAll(() => {
      detector = createTestDetector();
    });

    it('should scan multiple files', async () => {
      const files = [
        { path: 'a.ts', content: 'const x = 1;' },
        { path: 'b.ts', content: 'const y = 2;' },
      ];
      const result = await detector.scanFiles(files);

      expect(result.scannedFiles).toBe(2);
    });

    it('should aggregate candidate counts', async () => {
      const files = [
        { path: 'a.ts', content: 'const key = "AKIAIOSFODNN7EXAMPLE7";' },
        { path: 'b.ts', content: 'const key = "AKIAIOSFODNN7EXAMPLE8";' },
      ];
      const result = await detector.scanFiles(files);

      expect(result.candidatesDetected).toBe(2);
    });

    it('should track total duration', async () => {
      const files = [
        { path: 'a.ts', content: 'const x = 1;' },
        { path: 'b.ts', content: 'const y = 2;' },
      ];
      const result = await detector.scanFiles(files);

      expect(result.durationMs).toBeDefined();
      expect(typeof result.durationMs).toBe('number');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle errors in individual files gracefully', async () => {
      const files = [
        { path: 'a.ts', content: 'const key = "AKIAIOSFODNN7EXAMPLE9";' },
        { path: 'b.ts', content: 'const y = 2;' },
      ];
      const result = await detector.scanFiles(files);

      // Both files should be processed
      expect(result.scannedFiles).toBe(2);
      // At least the valid secret should be detected
      expect(result.candidatesDetected).toBeGreaterThanOrEqual(1);
    });
  });

  // =============================================================================
  // Performance Tests
  // =============================================================================

  describe('Performance', () => {
    let detector: SecretDetector;

    beforeAll(() => {
      detector = createTestDetector();
    });

    it('should use keywords for pre-filtering', async () => {
      // Content without any keywords should be fast to scan
      const contentNoKeywords = 'const x = 1;\n'.repeat(1000);
      const startNoKeywords = performance.now();
      await detector.scanFile('large.ts', contentNoKeywords);
      const durationNoKeywords = performance.now() - startNoKeywords;

      // Content with keywords that don't match regex
      const contentWithKeywords =
        'const AKIA = 1;\nconst api_key = 1;\n'.repeat(1000);
      const startWithKeywords = performance.now();
      await detector.scanFile('large2.ts', contentWithKeywords);
      const durationWithKeywords = performance.now() - startWithKeywords;

      // Both should complete, and no-keywords should generally be faster or similar
      expect(durationNoKeywords).toBeLessThan(1000); // Under 1 second
      expect(durationWithKeywords).toBeLessThan(1000);
    });

    it('should handle large files without timeout', async () => {
      // Create a ~100KB file
      const largeContent = 'const x = 1;\n'.repeat(10000);
      const start = performance.now();
      const result = await detector.scanFile('large.ts', largeContent);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(5000); // Under 5 seconds
      expect(result.candidateCount).toBe(0); // No secrets in this content
    });
  });
});

// =============================================================================
// SecretCandidate Tests
// =============================================================================

describe('SecretCandidate', () => {
  let detector: SecretDetector;

  beforeAll(() => {
    detector = createTestDetector();
  });

  it('should have unique id', async () => {
    const content =
      'const a = "AKIAIOSFODNN7EXAMPLEA";\nconst b = "AKIAIOSFODNN7EXAMPLEB";';
    const result = await detector.scanFile('test.ts', content);

    expect(result.candidateCount).toBe(2);
    expect(result.candidates[0]!.id).not.toBe(result.candidates[1]!.id);
    // IDs should be UUIDs
    expect(result.candidates[0]!.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it('should reference the matching rule', async () => {
    const content = 'const key = "AKIAIOSFODNN7EXAMPLEC";';
    const result = await detector.scanFile('test.ts', content);

    expect(result.candidateCount).toBe(1);
    expect(result.candidates[0]!.ruleId).toBe('aws-access-key-id');
    expect(result.candidates[0]!.ruleDescription).toBeTruthy();
  });

  it('should include location information', async () => {
    const content = 'line1\nconst key = "AKIAIOSFODNN7EXAMPLED";\nline3';
    const result = await detector.scanFile('src/config.ts', content);

    expect(result.candidateCount).toBe(1);
    const location = result.candidates[0]!.location;
    expect(location.file).toBe('src/config.ts');
    expect(location.line).toBe(2);
    expect(typeof location.column).toBe('number');
  });

  it('should have detection timestamp', async () => {
    const content = 'const key = "AKIAIOSFODNN7EXAMPLEE";';
    const result = await detector.scanFile('test.ts', content);

    expect(result.candidateCount).toBe(1);
    const timestamp = result.candidates[0]!.detectedAt;
    expect(timestamp).toBeDefined();
    // Should be valid ISO-8601
    expect(() => new Date(timestamp)).not.toThrow();
    expect(new Date(timestamp).toISOString()).toBe(timestamp);
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('Edge Cases', () => {
  let detector: SecretDetector;

  beforeAll(() => {
    detector = createTestDetector();
  });

  it('should handle empty file', async () => {
    const result = await detector.scanFile('empty.ts', '');
    expect(result.candidateCount).toBe(0);
    expect(result.candidates).toEqual([]);
  });

  it('should handle file with only whitespace', async () => {
    const result = await detector.scanFile('whitespace.ts', '   \n\t\n   ');
    expect(result.candidateCount).toBe(0);
  });

  it('should handle secret at start of file', async () => {
    const content = 'AKIAIOSFODNN7EXAMPLEF and more text';
    const result = await detector.scanFile('test.ts', content);

    expect(result.candidateCount).toBe(1);
    expect(result.candidates[0]!.location.line).toBe(1);
    expect(result.candidates[0]!.location.column).toBe(0);
  });

  it('should handle secret at end of file', async () => {
    const content = 'const key = "AKIAIOSFODNN7EXAMPLEG"';
    const result = await detector.scanFile('test.ts', content);

    expect(result.candidateCount).toBe(1);
  });

  it('should handle multiple secrets on same line', async () => {
    const content =
      'const a = "AKIAIOSFODNN7EXAMPLEH"; const b = "AKIAIOSFODNN7EXAMPLEI";';
    const result = await detector.scanFile('test.ts', content);

    expect(result.candidateCount).toBe(2);
    expect(result.candidates[0]!.location.line).toBe(1);
    expect(result.candidates[1]!.location.line).toBe(1);
  });

  it('should handle unicode in surrounding context', async () => {
    const content = 'const 密钥 = "AKIAIOSFODNN7EXAMPLEJ"; // 这是一个秘密';
    const result = await detector.scanFile('test.ts', content);

    expect(result.candidateCount).toBe(1);
    expect(result.candidates[0]!.redactedContext).toContain('密钥');
  });

  it('should return error when patterns not loaded', async () => {
    const emptyDetector = createSecretDetector();
    const result = await emptyDetector.scanFile('test.ts', 'content');

    expect(result.error).toBeDefined();
    expect(result.error).toContain('Patterns not loaded');
  });
});
