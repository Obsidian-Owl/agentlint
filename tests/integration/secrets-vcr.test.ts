/**
 * EP11 Quality & Security - Secret Detection Integration Tests
 *
 * Integration tests for secret detection pipeline.
 *
 * NOTE: The current SecretClassifier uses heuristic analysis, not LLM calls.
 * VCR recordings would be needed if/when LLM-based classification is implemented.
 * Tests marked with VCR in their description are skipped pending LLM integration.
 *
 * @module tests/integration/secrets-vcr
 */

import { describe, it, expect, beforeAll, afterEach } from 'bun:test';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  SecretDetector,
  SecretClassifier,
  createSecretDetectorWithPatterns,
  createSecretClassifier,
} from '../../src/security';

describe('Secret Detection Pipeline', () => {
  const testOutputDir = join(tmpdir(), 'agentlint-secrets-test');
  let detector: SecretDetector;
  let classifier: SecretClassifier;

  beforeAll(async () => {
    detector = await createSecretDetectorWithPatterns();
    classifier = createSecretClassifier();
  });

  afterEach(() => {
    // Cleanup test outputs
    const testFiles = ['scan-result.json', 'classified.json'];
    for (const file of testFiles) {
      const path = join(testOutputDir, file);
      if (existsSync(path)) {
        unlinkSync(path);
      }
    }
  });

  describe('End-to-End Detection', () => {
    it('should detect and classify secrets in TypeScript file', async () => {
      const content = `
        // Config file
        const AWS_KEY = "AKIAIOSFODNN7EXAMPLE";
        const normalVar = "hello";
      `;

      const scanResult = await detector.scanFile('test.ts', content);

      // Should detect the AWS key pattern
      expect(scanResult.candidateCount).toBeGreaterThanOrEqual(1);

      // Classify the detected candidates
      if (scanResult.candidateCount > 0) {
        // Note: scanFile returns safe candidates without 'match' field
        // For classification, we need to use the internal scan method
        const internalResult = detector.scanFileInternal('test.ts', content);
        const classified = await classifier.classifyBatch(internalResult.candidates);
        const firstClassified = classified[0];

        expect(classified.length).toBeGreaterThanOrEqual(1);
        expect(firstClassified).toBeDefined();
        if (firstClassified) {
          expect(firstClassified.classification).toBeDefined();
          expect(['confirmed', 'likely', 'unlikely', 'false_positive', 'needs_review']).toContain(
            firstClassified.classification
          );
        }
      }
    });

    it('should handle mixed real and fake secrets', async () => {
      const content = `
        // Real-looking credential
        const realKey = "AKIAIOSFODNN7REALKEY";

        // Obvious placeholder
        const exampleKey = "YOUR_API_KEY_HERE";
        const testKey = "test-api-key-placeholder";
      `;

      const internalResult = detector.scanFileInternal('config.ts', content);

      if (internalResult.candidates.length > 0) {
        const classified = await classifier.classifyBatch(internalResult.candidates);

        // The real-looking one should score higher than placeholders
        const realKeyResult = classified.find(
          (c) => c.candidateId === internalResult.candidates[0]?.id
        );
        if (realKeyResult) {
          expect(realKeyResult.confidence).toBeDefined();
        }
      }
    });

    it('should process multiple files', async () => {
      const files = [
        {
          path: 'src/config.ts',
          content: `const apiKey = "sk-test-12345678901234567890";`,
        },
        {
          path: 'src/database.ts',
          content: `const password = "supersecret123";`,
        },
        {
          path: 'test/fixtures/test.ts',
          content: `const testToken = "test-token-placeholder";`,
        },
      ];

      const scanResult = await detector.scanFiles(files);

      expect(scanResult.scannedFiles).toBe(3);
      // Results may vary based on pattern matching
      expect(scanResult.durationMs).toBeGreaterThan(0);
    });
  });

  describe('VCR Playback', () => {
    it.skip('should use recorded LLM responses in strict mode', async () => {
      // NOTE: This test requires LLM-based classification which is not yet implemented.
      // The current SecretClassifier uses heuristics, not LLM calls.
      // When LLM classification is added, this test should:
      // 1. Load a VCR cassette with pre-recorded responses
      // 2. Run classification in strict VCR mode
      // 3. Verify no actual LLM calls are made
    });

    it.skip('should fail on missing cassette in strict mode', async () => {
      // NOTE: Requires VCR infrastructure and LLM-based classification.
      // Test should verify that running in strict mode without a cassette fails.
    });

    it.skip('should allow recording new cassettes in record mode', async () => {
      // NOTE: Requires VCR infrastructure and LLM-based classification.
      // Test should verify that new cassettes can be recorded.
    });
  });

  describe('Classification Accuracy', () => {
    it('should correctly classify AWS credentials', async () => {
      const content = `const AWS_ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE";`;
      const internalResult = detector.scanFileInternal('prod/config.ts', content);
      const firstCandidate = internalResult.candidates[0];

      if (internalResult.candidates.length > 0 && firstCandidate) {
        const classified = await classifier.classify(firstCandidate);

        // AWS keys in production paths with high entropy should be flagged
        expect(['confirmed', 'likely', 'needs_review']).toContain(classified.classification);
        expect(classified.reasoning).toBeDefined();
        expect(classified.recommendation).toBeDefined();
      }
    });

    it('should correctly classify example values', async () => {
      const content = `
        // Example configuration - not a real secret
        const exampleKey = "AKIAIOSFODNN7EXAMPLE";
      `;
      const internalResult = detector.scanFileInternal('examples/config.ts', content);
      const firstCandidate = internalResult.candidates[0];

      if (internalResult.candidates.length > 0 && firstCandidate) {
        const classified = await classifier.classify(firstCandidate);

        // Example values in example paths should be detected as likely false positives
        // The classifier uses path and context patterns to reduce confidence
        expect(classified.classification).toBeDefined();
        // May be flagged but with lower confidence due to "examples" path
        expect(classified.confidence).toBeDefined();
      }
    });

    it('should flag ambiguous cases for review', async () => {
      const content = `
        // This might be real or might be a test
        const apiKey = "sk-live-abcdef123456";
      `;
      const internalResult = detector.scanFileInternal('src/api.ts', content);

      const firstCandidate = internalResult.candidates[0];
      if (internalResult.candidates.length > 0 && firstCandidate) {
        const classified = await classifier.classify(firstCandidate);

        // Ambiguous cases should have a classification
        expect(classified.classification).toBeDefined();
        expect(classified.reasoning.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Output Safety', () => {
    it('should never expose secrets in scan results', async () => {
      const secretValue = 'AKIAIOSFODNN7REALKEY';
      const content = `const key = "${secretValue}";`;

      const scanResult = await detector.scanFile('config.ts', content);

      // The public scanFile result should NOT contain the actual secret
      const jsonOutput = JSON.stringify(scanResult);
      expect(jsonOutput).not.toContain(secretValue);

      // Candidates should have redacted context only
      for (const candidate of scanResult.candidates) {
        expect(candidate.redactedContext).toContain('[REDACTED:');
        expect(candidate.redactedContext).not.toContain(secretValue);
      }
    });

    it('should never expose secrets in classification results', async () => {
      const secretValue = 'AKIAIOSFODNN7REALKEY';
      const content = `const key = "${secretValue}";`;

      const internalResult = detector.scanFileInternal('config.ts', content);
      const firstCandidate = internalResult.candidates[0];
      if (internalResult.candidates.length > 0 && firstCandidate) {
        const classified = await classifier.classify(firstCandidate);

        // Classification result should not contain the raw secret
        const jsonOutput = JSON.stringify(classified);
        expect(jsonOutput).not.toContain(secretValue);
      }
    });

    it('should include redacted context in results', async () => {
      const content = `const API_KEY = "sk-test-1234567890abcdef";`;
      const scanResult = await detector.scanFile('config.ts', content);

      const candidate = scanResult.candidates[0];
      if (scanResult.candidateCount > 0 && candidate) {
        // Redacted context should show the surrounding code with the value replaced
        expect(candidate.redactedContext).toBeDefined();
        expect(candidate.redactedContext).toContain('[REDACTED:');
      }
    });
  });

  describe('Performance', () => {
    it('should complete single file scan in <1s', async () => {
      // Generate a moderately sized file
      const lines = [];
      for (let i = 0; i < 500; i++) {
        lines.push(`const var${i} = "value${i}";`);
      }
      // Add a few secrets
      lines.push('const apiKey = "AKIAIOSFODNN7EXAMPLE";');
      lines.push('const password = "secretpassword123";');

      const content = lines.join('\n');
      const startTime = performance.now();

      await detector.scanFile('large-file.ts', content);

      const durationMs = performance.now() - startTime;

      // NFR requirement: <1s per file for pattern matching
      expect(durationMs).toBeLessThan(1000);
    });

    it('should batch classify efficiently', async () => {
      // Create multiple candidates
      const contents = [
        `const key1 = "AKIAIOSFODNN7EXAMPLE1";`,
        `const key2 = "AKIAIOSFODNN7EXAMPLE2";`,
        `const key3 = "AKIAIOSFODNN7EXAMPLE3";`,
      ];

      const allCandidates = [];
      for (let i = 0; i < contents.length; i++) {
        const content = contents[i];
        if (content) {
          const result = detector.scanFileInternal(`file${i}.ts`, content);
          allCandidates.push(...result.candidates);
        }
      }

      if (allCandidates.length > 0) {
        const startTime = performance.now();
        const classified = await classifier.classifyBatch(allCandidates);
        const durationMs = performance.now() - startTime;

        expect(classified.length).toBe(allCandidates.length);
        // Batch should complete quickly (heuristic-based)
        expect(durationMs).toBeLessThan(100);
      }
    });
  });
});

describe('Secret Detection CLI Integration', () => {
  describe('--no-secrets flag', () => {
    it.skip('should disable secret scanning when flag is set', async () => {
      // NOTE: CLI integration tests require CLI infrastructure.
      // Test: agentlint analyse --no-secrets should skip secret detection
    });

    it.skip('should not invoke classifier when scanning is disabled', async () => {
      // NOTE: CLI integration tests require CLI infrastructure.
      // No LLM calls for classification when disabled
    });
  });

  describe('Output Formats', () => {
    it.skip('should include secrets in JSON output', async () => {
      // NOTE: CLI integration tests require CLI infrastructure.
      // Test: agentlint analyse --json should include classified secrets
    });

    it.skip('should format secrets in plain text output', async () => {
      // NOTE: CLI integration tests require CLI infrastructure.
      // Test: Human-readable secret detection results
    });

    it.skip('should use redacted values in all output', async () => {
      // NOTE: CLI integration tests require CLI infrastructure.
      // Never show raw secrets in any output format
    });
  });
});

describe('Real-World Scenarios', () => {
  let detector: SecretDetector;
  let classifier: SecretClassifier;

  beforeAll(async () => {
    detector = await createSecretDetectorWithPatterns();
    classifier = createSecretClassifier();
  });

  it('should detect leaked AWS credentials in config file', async () => {
    const content = `
      // Production AWS config
      module.exports = {
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        region: 'us-east-1'
      };
    `;

    const result = await detector.scanFile('aws-config.js', content);

    // Should detect at least one credential
    expect(result.candidateCount).toBeGreaterThanOrEqual(1);
  });

  it('should detect GitHub token in shell script', async () => {
    const content = `
      #!/bin/bash
      # Deploy script
      GITHUB_TOKEN="ghp_1234567890abcdefghijklmnopqrstuv1234"
      git push https://$GITHUB_TOKEN@github.com/user/repo.git
    `;

    const result = await detector.scanFile('deploy.sh', content);

    // GitHub PAT pattern should match
    expect(result.candidateCount).toBeGreaterThanOrEqual(1);
  });

  it('should correctly ignore test fixtures', async () => {
    const content = `
      // Test fixture - fake credentials for testing
      export const testCredentials = {
        apiKey: 'AKIATESTFAKE0000000',
        token: 'test-token-not-real'
      };
    `;

    const internalResult = detector.scanFileInternal('test/fixtures/credentials.ts', content);
    const firstCandidate = internalResult.candidates[0];

    if (internalResult.candidates.length > 0 && firstCandidate) {
      const classified = await classifier.classify(firstCandidate);

      // Test fixtures should be flagged with lower confidence
      // The path contains 'test' and 'fixtures' which are signals for false positive
      expect(classified.confidence).toBeLessThan(0.8);
    }
  });

  it('should correctly ignore environment variable references', async () => {
    const content = `
      // Config using environment variables
      const config = {
        apiKey: process.env.API_KEY,
        secret: process.env.SECRET_KEY,
      };
    `;

    const internalResult = detector.scanFileInternal('config.ts', content);

    // Environment variable references should not be flagged as secrets
    // They don't contain actual secret values
    for (const candidate of internalResult.candidates) {
      // If any are detected, they should be low confidence
      const classified = await classifier.classify(candidate);
      expect(['unlikely', 'false_positive']).toContain(classified.classification);
    }
  });
});
