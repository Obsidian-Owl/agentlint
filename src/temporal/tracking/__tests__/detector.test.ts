/**
 * Unit tests for recommendation implementation detector.
 */

import { describe, test, expect } from 'bun:test';

import {
  detectImplementation,
  detectImplementations,
  createConfigDiff,
  mergeConfigDiffs,
  type Recommendation,
  type ConfigDiff,
} from '../detector';

// =============================================================================
// Test Data
// =============================================================================

const credentialRecommendation: Recommendation = {
  id: 'rec-001',
  summary: 'Add credential guidance',
  description: 'Add guidance about handling credentials and secrets',
  keywords: ['credential', 'secret', 'API key', 'password'],
  targetFiles: ['CLAUDE.md', 'AGENTS.md'],
  patterns: ['never.*credential', 'avoid.*secret'],
};

const testingRecommendation: Recommendation = {
  id: 'rec-002',
  summary: 'Add testing guidelines',
  keywords: ['test', 'unit test', 'coverage'],
  targetFiles: ['CLAUDE.md'],
};

// =============================================================================
// Tests
// =============================================================================

describe('Recommendation Implementation Detector', () => {
  describe('detectImplementation', () => {
    test('should detect implementation via keyword match', () => {
      const diff: ConfigDiff = {
        filesAdded: [],
        filesModified: ['CLAUDE.md'],
        filesDeleted: [],
        linesAdded: ['Never include credentials in code responses', 'Always check for secrets'],
        linesRemoved: [],
      };

      const result = detectImplementation(credentialRecommendation, diff);

      expect(result.detected).toBe(true);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.evidence.length).toBeGreaterThan(0);
      expect(result.evidence.some((e) => e.type === 'keyword')).toBe(true);
    });

    test('should detect implementation via file match', () => {
      const diff: ConfigDiff = {
        filesAdded: [],
        filesModified: ['CLAUDE.md'],
        filesDeleted: [],
        linesAdded: ['Some generic content'],
        linesRemoved: [],
      };

      const result = detectImplementation(credentialRecommendation, diff);

      expect(result.evidence.some((e) => e.type === 'file')).toBe(true);
      expect(result.evidence.find((e) => e.type === 'file')?.location).toBe('CLAUDE.md');
    });

    test('should detect implementation via pattern match', () => {
      const diff: ConfigDiff = {
        filesAdded: [],
        filesModified: [],
        filesDeleted: [],
        linesAdded: ['You should never expose credentials to the user'],
        linesRemoved: [],
      };

      const result = detectImplementation(credentialRecommendation, diff);

      expect(result.evidence.some((e) => e.type === 'pattern')).toBe(true);
    });

    test('should return high confidence for multiple evidence types', () => {
      const diff: ConfigDiff = {
        filesAdded: [],
        filesModified: ['CLAUDE.md'],
        filesDeleted: [],
        linesAdded: ['Never expose credentials in responses', 'Avoid sharing API keys or secrets'],
        linesRemoved: [],
      };

      const result = detectImplementation(credentialRecommendation, diff);

      expect(result.detected).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(50);
      expect(result.evidence.length).toBeGreaterThanOrEqual(2);
    });

    test('should not detect when no matches', () => {
      const diff: ConfigDiff = {
        filesAdded: [],
        filesModified: ['README.md'],
        filesDeleted: [],
        linesAdded: ['Updated documentation for the project'],
        linesRemoved: [],
      };

      const result = detectImplementation(credentialRecommendation, diff);

      expect(result.detected).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.evidence.length).toBe(0);
    });

    test('should handle empty diff', () => {
      const diff: ConfigDiff = {
        filesAdded: [],
        filesModified: [],
        filesDeleted: [],
        linesAdded: [],
        linesRemoved: [],
      };

      const result = detectImplementation(credentialRecommendation, diff);

      expect(result.detected).toBe(false);
      expect(result.confidence).toBe(0);
    });

    test('should provide explanation in result', () => {
      const diff: ConfigDiff = {
        filesAdded: [],
        filesModified: ['CLAUDE.md'],
        filesDeleted: [],
        linesAdded: ['Add credential handling guidelines'],
        linesRemoved: [],
      };

      const result = detectImplementation(credentialRecommendation, diff);

      expect(result.explanation).toBeDefined();
      expect(result.explanation.length).toBeGreaterThan(0);
    });

    test('should suggest appropriate status based on confidence', () => {
      // High confidence case
      const highConfidenceDiff: ConfigDiff = {
        filesAdded: [],
        filesModified: ['CLAUDE.md'],
        filesDeleted: [],
        linesAdded: [
          'Never expose credentials in responses',
          'Avoid API keys and secrets',
          'Password handling guidelines',
          'Never leak credentials',
        ],
        linesRemoved: [],
      };

      const highResult = detectImplementation(credentialRecommendation, highConfidenceDiff);
      expect(highResult.suggestedStatus).toBe('detected_pending_confirm');

      // No match case
      const noMatchDiff: ConfigDiff = {
        filesAdded: [],
        filesModified: [],
        filesDeleted: [],
        linesAdded: [],
        linesRemoved: [],
      };

      const noResult = detectImplementation(credentialRecommendation, noMatchDiff);
      expect(noResult.suggestedStatus).toBe('pending');
    });

    test('should handle invalid regex patterns gracefully', () => {
      const badRecommendation: Recommendation = {
        id: 'bad-rec',
        summary: 'Bad recommendation',
        keywords: ['test'],
        patterns: ['[invalid(regex'],
      };

      const diff: ConfigDiff = {
        filesAdded: [],
        filesModified: [],
        filesDeleted: [],
        linesAdded: ['test content'],
        linesRemoved: [],
      };

      // Should not throw
      const result = detectImplementation(badRecommendation, diff);
      expect(result).toBeDefined();
    });
  });

  describe('detectImplementations', () => {
    test('should check multiple recommendations', () => {
      const diff: ConfigDiff = {
        filesAdded: [],
        filesModified: ['CLAUDE.md'],
        filesDeleted: [],
        linesAdded: ['Add unit tests for all features', 'Handle credentials securely'],
        linesRemoved: [],
      };

      const results = detectImplementations(
        [credentialRecommendation, testingRecommendation],
        diff
      );

      expect(results.size).toBe(2);
      expect(results.has('rec-001')).toBe(true);
      expect(results.has('rec-002')).toBe(true);
    });

    test('should only return detected recommendations', () => {
      const diff: ConfigDiff = {
        filesAdded: [],
        filesModified: ['CLAUDE.md'],
        filesDeleted: [],
        linesAdded: ['Testing is important'],
        linesRemoved: [],
      };

      const results = detectImplementations(
        [credentialRecommendation, testingRecommendation],
        diff
      );

      // Only testing recommendation should be detected
      expect(results.has('rec-002')).toBe(true);
      // Credential recommendation might not be detected without keywords
    });

    test('should return empty map when no matches', () => {
      const diff: ConfigDiff = {
        filesAdded: [],
        filesModified: ['unrelated.txt'],
        filesDeleted: [],
        linesAdded: ['Completely unrelated content'],
        linesRemoved: [],
      };

      const results = detectImplementations(
        [credentialRecommendation, testingRecommendation],
        diff
      );

      expect(results.size).toBe(0);
    });
  });

  describe('createConfigDiff', () => {
    test('should identify added lines', () => {
      const before = ['line 1', 'line 2'];
      const after = ['line 1', 'line 2', 'line 3'];

      const diff = createConfigDiff(before, after, 'test.md');

      expect(diff.linesAdded).toContain('line 3');
      expect(diff.linesRemoved).toEqual([]);
      expect(diff.filesModified).toContain('test.md');
    });

    test('should identify removed lines', () => {
      const before = ['line 1', 'line 2', 'line 3'];
      const after = ['line 1', 'line 2'];

      const diff = createConfigDiff(before, after, 'test.md');

      expect(diff.linesRemoved).toContain('line 3');
      expect(diff.linesAdded).toEqual([]);
      expect(diff.filesModified).toContain('test.md');
    });

    test('should identify new file', () => {
      const before: string[] = [];
      const after = ['line 1', 'line 2'];

      const diff = createConfigDiff(before, after, 'new.md');

      expect(diff.filesAdded).toContain('new.md');
      expect(diff.filesModified).toEqual([]);
    });

    test('should identify deleted file', () => {
      const before = ['line 1', 'line 2'];
      const after: string[] = [];

      const diff = createConfigDiff(before, after, 'deleted.md');

      expect(diff.filesDeleted).toContain('deleted.md');
      expect(diff.filesModified).toEqual([]);
    });

    test('should handle no changes', () => {
      const before = ['line 1', 'line 2'];
      const after = ['line 1', 'line 2'];

      const diff = createConfigDiff(before, after, 'unchanged.md');

      expect(diff.linesAdded).toEqual([]);
      expect(diff.linesRemoved).toEqual([]);
      expect(diff.filesModified).toEqual([]);
    });
  });

  describe('mergeConfigDiffs', () => {
    test('should merge multiple diffs', () => {
      const diff1: ConfigDiff = {
        filesAdded: ['new1.md'],
        filesModified: ['mod1.md'],
        filesDeleted: [],
        linesAdded: ['line 1'],
        linesRemoved: [],
      };

      const diff2: ConfigDiff = {
        filesAdded: ['new2.md'],
        filesModified: ['mod2.md'],
        filesDeleted: ['del1.md'],
        linesAdded: ['line 2'],
        linesRemoved: ['old line'],
      };

      const merged = mergeConfigDiffs([diff1, diff2]);

      expect(merged.filesAdded).toContain('new1.md');
      expect(merged.filesAdded).toContain('new2.md');
      expect(merged.filesModified).toContain('mod1.md');
      expect(merged.filesModified).toContain('mod2.md');
      expect(merged.filesDeleted).toContain('del1.md');
      expect(merged.linesAdded).toContain('line 1');
      expect(merged.linesAdded).toContain('line 2');
      expect(merged.linesRemoved).toContain('old line');
    });

    test('should deduplicate file lists', () => {
      const diff1: ConfigDiff = {
        filesAdded: [],
        filesModified: ['CLAUDE.md'],
        filesDeleted: [],
        linesAdded: [],
        linesRemoved: [],
      };

      const diff2: ConfigDiff = {
        filesAdded: [],
        filesModified: ['CLAUDE.md'],
        filesDeleted: [],
        linesAdded: [],
        linesRemoved: [],
      };

      const merged = mergeConfigDiffs([diff1, diff2]);

      expect(merged.filesModified.length).toBe(1);
      expect(merged.filesModified).toContain('CLAUDE.md');
    });

    test('should handle empty array', () => {
      const merged = mergeConfigDiffs([]);

      expect(merged.filesAdded).toEqual([]);
      expect(merged.filesModified).toEqual([]);
      expect(merged.filesDeleted).toEqual([]);
      expect(merged.linesAdded).toEqual([]);
      expect(merged.linesRemoved).toEqual([]);
    });
  });
});
