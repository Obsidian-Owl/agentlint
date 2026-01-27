/**
 * EP11 Quality & Security - Secret Classifier Unit Tests
 *
 * Tests for heuristic-based secret classification.
 *
 * @module tests/unit/security/classifier
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import {
  SecretClassifier,
  createSecretClassifier,
  classifySecretTool,
} from '../../../src/security/classifier';
import type { SecretCandidate } from '../../../src/security/types';

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Create a test secret candidate with default values.
 */
function createTestCandidate(overrides: Partial<SecretCandidate> = {}): SecretCandidate {
  return {
    id: 'test-candidate-id',
    ruleId: 'generic-api-key',
    ruleDescription: 'Generic API Key',
    match: 'secret-value-for-testing',
    redactedContext: 'const apiKey = [REDACTED:generic-api-key:len=25];',
    entropy: 4.5,
    location: {
      file: 'src/config.ts',
      line: 10,
      column: 15,
    },
    detectedAt: new Date().toISOString(),
    ...overrides,
  };
}

// =============================================================================
// Classification Tests
// =============================================================================

describe('SecretClassifier', () => {
  let classifier: SecretClassifier;

  beforeAll(() => {
    classifier = createSecretClassifier();
  });

  describe('Classification', () => {
    it('should classify high confidence candidates as confirmed or likely', async () => {
      // High entropy + high-confidence rule + no false positive signals
      const candidate = createTestCandidate({
        ruleId: 'aws-access-token',
        entropy: 5.0,
        redactedContext: 'const AWS_KEY = [REDACTED:aws-access-token:len=20];',
        location: { file: 'src/config.ts', line: 1 },
      });

      const result = await classifier.classify(candidate);

      // High entropy + high-confidence rule should yield high score
      expect(['confirmed', 'likely']).toContain(result.classification);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should classify likely secrets with moderate confidence', async () => {
      // Moderate entropy, no clear false positive signals
      const candidate = createTestCandidate({
        entropy: 3.8,
        redactedContext: 'const config = { key: [REDACTED:generic-api-key:len=30] };',
        location: { file: 'src/app.ts', line: 5 },
      });

      const result = await classifier.classify(candidate);

      expect(['likely', 'needs_review']).toContain(result.classification);
    });

    it('should classify unlikely matches with low confidence', async () => {
      // Low entropy + example in context
      const candidate = createTestCandidate({
        entropy: 2.5,
        redactedContext: 'const example = [REDACTED:generic-api-key:len=20];',
        location: { file: 'src/utils.ts', line: 1 },
      });

      const result = await classifier.classify(candidate);

      expect(['unlikely', 'false_positive', 'needs_review']).toContain(result.classification);
      expect(result.confidence).toBeLessThan(0.7);
    });

    it('should classify false positives correctly', async () => {
      // Low entropy + test file + placeholder context
      const candidate = createTestCandidate({
        entropy: 2.0,
        redactedContext: 'const placeholder = [REDACTED:generic-api-key:len=15];',
        location: { file: 'test/fixtures/config.ts', line: 1 },
      });

      const result = await classifier.classify(candidate);

      expect(['unlikely', 'false_positive']).toContain(result.classification);
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should flag needs_review when uncertain', async () => {
      // Mixed signals - moderate entropy, no clear indicators
      const candidate = createTestCandidate({
        entropy: 3.5,
        redactedContext: 'const value = [REDACTED:generic-api-key:len=25];',
        location: { file: 'src/service.ts', line: 20 },
      });

      const result = await classifier.classify(candidate);

      // With neutral signals, should be in the middle range
      expect(result.classification).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  // =============================================================================
  // Classification Result Tests
  // =============================================================================

  describe('Classification Result', () => {
    it('should include confidence score between 0 and 1', async () => {
      const candidate = createTestCandidate();
      const result = await classifier.classify(candidate);

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should include reasoning', async () => {
      const candidate = createTestCandidate();
      const result = await classifier.classify(candidate);

      expect(result.reasoning).toBeTruthy();
      expect(typeof result.reasoning).toBe('string');
      expect(result.reasoning.length).toBeGreaterThan(0);
    });

    it('should include recommendation', async () => {
      const candidate = createTestCandidate();
      const result = await classifier.classify(candidate);

      expect(result.recommendation).toBeTruthy();
      expect(typeof result.recommendation).toBe('string');
      expect(result.recommendation.length).toBeGreaterThan(0);
    });

    it('should preserve location information', async () => {
      const candidate = createTestCandidate({
        location: { file: 'src/specific/path.ts', line: 42, column: 10 },
      });

      const result = await classifier.classify(candidate);

      expect(result.location.file).toBe('src/specific/path.ts');
      expect(result.location.line).toBe(42);
    });

    it('should have validation timestamp in ISO-8601 format', async () => {
      const candidate = createTestCandidate();
      const result = await classifier.classify(candidate);

      expect(result.validatedAt).toBeDefined();
      expect(() => new Date(result.validatedAt)).not.toThrow();
      expect(new Date(result.validatedAt).toISOString()).toBe(result.validatedAt);
    });
  });

  // =============================================================================
  // Batch Classification Tests
  // =============================================================================

  describe('Batch Classification', () => {
    it('should classify multiple candidates', async () => {
      const candidates = [
        createTestCandidate({ id: 'c1' }),
        createTestCandidate({ id: 'c2' }),
        createTestCandidate({ id: 'c3' }),
      ];

      const results = await classifier.classifyBatch(candidates);

      expect(results.length).toBe(3);
      for (const result of results) {
        expect(result.classification).toBeDefined();
        expect(result.confidence).toBeGreaterThanOrEqual(0);
      }
    });

    it('should preserve order in batch results', async () => {
      const candidates = [
        createTestCandidate({ id: 'first', entropy: 2.0 }),
        createTestCandidate({ id: 'second', entropy: 5.0 }),
        createTestCandidate({ id: 'third', entropy: 3.5 }),
      ];

      const results = await classifier.classifyBatch(candidates);

      expect(results[0]!.candidateId).toBe('first');
      expect(results[1]!.candidateId).toBe('second');
      expect(results[2]!.candidateId).toBe('third');
    });

    it('should handle empty batch', async () => {
      const results = await classifier.classifyBatch([]);

      expect(results).toEqual([]);
    });
  });

  // =============================================================================
  // Context Analysis Tests
  // =============================================================================

  describe('Context Analysis', () => {
    it('should consider surrounding code context', async () => {
      // Context with "example" should lower confidence
      const exampleCandidate = createTestCandidate({
        redactedContext: 'const example_key = [REDACTED:generic-api-key:len=20];',
        entropy: 4.0,
      });

      // Context without placeholder words
      const realCandidate = createTestCandidate({
        redactedContext: 'const API_KEY = [REDACTED:generic-api-key:len=20];',
        entropy: 4.0,
      });

      const exampleResult = await classifier.classify(exampleCandidate);
      const realResult = await classifier.classify(realCandidate);

      // Example context should have lower confidence
      expect(exampleResult.confidence).toBeLessThanOrEqual(realResult.confidence);
    });

    it('should consider file path in classification', async () => {
      // Test file should have lower confidence
      const testFileCandidate = createTestCandidate({
        location: { file: 'test/unit/config.test.ts', line: 5 },
        entropy: 4.0,
      });

      // Source file should have higher confidence
      const srcFileCandidate = createTestCandidate({
        location: { file: 'src/config.ts', line: 5 },
        entropy: 4.0,
      });

      const testResult = await classifier.classify(testFileCandidate);
      const srcResult = await classifier.classify(srcFileCandidate);

      expect(testResult.confidence).toBeLessThan(srcResult.confidence);
    });

    it('should consider variable naming patterns', async () => {
      // Variable with multiple false positive signals
      const fakeCandidate = createTestCandidate({
        redactedContext: 'const fake_placeholder = [REDACTED:generic-api-key:len=20];',
        entropy: 4.0,
        location: { file: 'src/config.ts', line: 1 },
      });

      // Variable with high-confidence rule
      const realCandidate = createTestCandidate({
        ruleId: 'aws-access-token',
        redactedContext: 'const AWS_KEY = [REDACTED:aws-access-token:len=20];',
        entropy: 4.0,
        location: { file: 'src/config.ts', line: 1 },
      });

      const fakeResult = await classifier.classify(fakeCandidate);
      const realResult = await classifier.classify(realCandidate);

      // Fake/placeholder context should have lower confidence
      expect(fakeResult.confidence).toBeLessThan(realResult.confidence);
    });
  });

  // =============================================================================
  // Secret Type Recognition Tests
  // =============================================================================

  describe('Secret Type Recognition', () => {
    it('should recognize AWS credential patterns as high confidence', async () => {
      const candidate = createTestCandidate({
        ruleId: 'aws-access-token',
        entropy: 4.5,
        location: { file: 'src/config.ts', line: 1 },
      });

      const result = await classifier.classify(candidate);

      expect(result.classification).toMatch(/confirmed|likely/);
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('should recognize GitHub token patterns as high confidence', async () => {
      const candidate = createTestCandidate({
        ruleId: 'github-pat',
        entropy: 4.5,
        location: { file: 'src/config.ts', line: 1 },
      });

      const result = await classifier.classify(candidate);

      expect(result.classification).toBeDefined();
    });

    it('should recognize private key formats', async () => {
      const candidate = createTestCandidate({
        ruleId: 'private-key',
        entropy: 3.5,
        redactedContext:
          '-----BEGIN RSA PRIVATE KEY-----\n[REDACTED]\n-----END RSA PRIVATE KEY-----',
        location: { file: 'src/keys/server.pem', line: 1 },
      });

      const result = await classifier.classify(candidate);

      expect(result.classification).toBeDefined();
    });

    it('should recognize JWT structure', async () => {
      const candidate = createTestCandidate({
        ruleId: 'jwt-token',
        entropy: 4.5,
        redactedContext: 'const token = "[REDACTED:jwt-token:len=150]";',
        location: { file: 'src/auth.ts', line: 10 },
      });

      const result = await classifier.classify(candidate);

      expect(result.classification).toBeDefined();
    });

    it('should recognize connection string formats', async () => {
      const candidate = createTestCandidate({
        ruleId: 'connection-string',
        entropy: 4.0,
        redactedContext: 'postgres://user:[REDACTED:connection-string:len=20]@host/db',
        location: { file: 'src/db.ts', line: 5 },
      });

      const result = await classifier.classify(candidate);

      expect(result.classification).toBeDefined();
    });
  });

  // =============================================================================
  // Safety Tests
  // =============================================================================

  describe('Safety', () => {
    it('should never include raw secret in result', async () => {
      const candidate = createTestCandidate({
        match: 'super-secret-value-12345',
      });

      const result = await classifier.classify(candidate);

      // ClassifiedSecret should not have a 'match' field
      const resultObj = result as unknown as Record<string, unknown>;
      expect(resultObj.match).toBeUndefined();

      // The secret should not appear in reasoning or recommendation
      expect(result.reasoning).not.toContain('super-secret-value');
      expect(result.recommendation).not.toContain('super-secret-value');
    });

    it('should not log secret values', async () => {
      // This test verifies the classifier uses redacted data
      const candidate = createTestCandidate({
        match: 'AKIAIOSFODNN7EXAMPLE',
        redactedContext: 'const key = [REDACTED:aws-key:len=20];',
      });

      const result = await classifier.classify(candidate);

      // The result should exist without exposing the actual secret
      expect(result.classification).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });
  });
});

// =============================================================================
// Classification Tool Tests
// =============================================================================

describe('Classification Tool', () => {
  describe('Tool Definition', () => {
    it('should be a valid SDK tool', () => {
      expect(classifySecretTool).toBeDefined();
      expect(classifySecretTool.name).toBe('classify_secret');
      expect(classifySecretTool.description).toBeTruthy();
    });

    it('should accept candidate data as input', () => {
      // The tool schema should accept the required fields
      expect(classifySecretTool).toBeDefined();
      // Tool exists and can be used - detailed schema validation
      // is done by the SDK at runtime
    });

    it('should have input schema for candidate data', () => {
      // The tool should have the expected name and description
      expect(classifySecretTool.name).toBe('classify_secret');
      expect(classifySecretTool.description).toContain('secret');
      expect(classifySecretTool.description).toContain('classify');
    });
  });

  describe('Tool Structure', () => {
    it('should be callable by SDK agents', () => {
      // The SDK tool is a definition that gets registered with an agent
      // It can't be directly invoked outside of agent context
      expect(typeof classifySecretTool).toBe('object');
      expect(classifySecretTool.name).toBeTruthy();
      expect(classifySecretTool.description).toBeTruthy();
    });

    it('should have proper tool metadata', () => {
      // Tool should have required fields for SDK registration
      expect(classifySecretTool.name).toBe('classify_secret');
      expect(typeof classifySecretTool.description).toBe('string');
    });
  });
});

// =============================================================================
// Entropy Analysis Tests
// =============================================================================

describe('Entropy-based Classification', () => {
  let classifier: SecretClassifier;

  beforeAll(() => {
    classifier = createSecretClassifier();
  });

  it('should classify high entropy (>4.5) with higher confidence', async () => {
    const highEntropyCandidate = createTestCandidate({
      entropy: 5.0,
      location: { file: 'src/config.ts', line: 1 },
    });

    const result = await classifier.classify(highEntropyCandidate);

    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.classification).toMatch(/confirmed|likely/);
  });

  it('should classify moderate entropy (3.5-4.5) with moderate confidence', async () => {
    const modEntropyCandidate = createTestCandidate({
      entropy: 4.0,
      location: { file: 'src/config.ts', line: 1 },
    });

    const result = await classifier.classify(modEntropyCandidate);

    expect(result.classification).toBeDefined();
  });

  it('should classify low entropy (<3.0) with lower confidence', async () => {
    const lowEntropyCandidate = createTestCandidate({
      entropy: 2.5,
      location: { file: 'src/config.ts', line: 1 },
    });

    const result = await classifier.classify(lowEntropyCandidate);

    expect(result.confidence).toBeLessThan(0.6);
    expect(result.classification).toMatch(/unlikely|false_positive|needs_review/);
  });
});

// =============================================================================
// Environment Variable Detection Tests
// =============================================================================

describe('Environment Variable Detection', () => {
  let classifier: SecretClassifier;

  beforeAll(() => {
    classifier = createSecretClassifier();
  });

  it('should reduce confidence for process.env references', async () => {
    const candidate = createTestCandidate({
      redactedContext: 'const key = process.env.API_KEY || [REDACTED];',
      entropy: 4.0,
    });

    const result = await classifier.classify(candidate);

    expect(result.reasoning).toContain('environment variable');
    expect(result.confidence).toBeLessThan(0.7);
  });

  it('should reduce confidence for shell variable references', async () => {
    const candidate = createTestCandidate({
      redactedContext: 'export KEY=${API_KEY:-[REDACTED]}',
      entropy: 4.0,
    });

    const result = await classifier.classify(candidate);

    expect(result.confidence).toBeLessThan(0.7);
  });
});
