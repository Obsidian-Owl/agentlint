/**
 * Unit tests for recommendation implementation detector.
 *
 * Per ADR-0019, extractMatchEvidence returns raw evidence data.
 * Agent interprets whether evidence indicates implementation.
 */

import { describe, test, expect } from 'bun:test';

import {
  extractMatchEvidence,
  extractAllMatchEvidence,
  createConfigDiff,
  mergeConfigDiffs,
  type Recommendation,
  type ConfigDiff,
} from '../detector';
import type { DetectionEvidence } from '../../types';

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
  describe('extractMatchEvidence', () => {
    test('should extract keyword match evidence', () => {
      const diff: ConfigDiff = {
        filesAdded: [],
        filesModified: ['CLAUDE.md'],
        filesDeleted: [],
        linesAdded: ['Never include credentials in code responses', 'Always check for secrets'],
        linesRemoved: [],
      };

      const result = extractMatchEvidence(credentialRecommendation, diff);

      expect(result.evidence.length).toBeGreaterThan(0);
      expect(result.evidence.some((e: DetectionEvidence) => e.type === 'keyword')).toBe(true);
      expect(result.keywordMatches.length).toBeGreaterThan(0);
    });

    test('should extract file match evidence', () => {
      const diff: ConfigDiff = {
        filesAdded: [],
        filesModified: ['CLAUDE.md'],
        filesDeleted: [],
        linesAdded: ['Some generic content'],
        linesRemoved: [],
      };

      const result = extractMatchEvidence(credentialRecommendation, diff);

      expect(result.evidence.some((e: DetectionEvidence) => e.type === 'file')).toBe(true);
      expect(result.fileMatches).toContain('CLAUDE.md');
    });

    test('should extract pattern match evidence', () => {
      const diff: ConfigDiff = {
        filesAdded: [],
        filesModified: [],
        filesDeleted: [],
        linesAdded: ['You should never expose credentials to the user'],
        linesRemoved: [],
      };

      const result = extractMatchEvidence(credentialRecommendation, diff);

      expect(result.evidence.some((e: DetectionEvidence) => e.type === 'pattern')).toBe(true);
      expect(result.patternMatches.length).toBeGreaterThan(0);
    });

    test('should return high totalWeight for multiple evidence types', () => {
      const diff: ConfigDiff = {
        filesAdded: [],
        filesModified: ['CLAUDE.md'],
        filesDeleted: [],
        linesAdded: ['Never expose credentials in responses', 'Avoid sharing API keys or secrets'],
        linesRemoved: [],
      };

      const result = extractMatchEvidence(credentialRecommendation, diff);

      expect(result.totalWeight).toBeGreaterThan(0);
      expect(result.evidence.length).toBeGreaterThanOrEqual(2);
    });

    test('should return empty evidence when no matches', () => {
      const diff: ConfigDiff = {
        filesAdded: [],
        filesModified: ['README.md'],
        filesDeleted: [],
        linesAdded: ['Updated documentation for the project'],
        linesRemoved: [],
      };

      const result = extractMatchEvidence(credentialRecommendation, diff);

      expect(result.totalWeight).toBe(0);
      expect(result.evidence.length).toBe(0);
      expect(result.keywordMatches.length).toBe(0);
      expect(result.fileMatches.length).toBe(0);
      expect(result.patternMatches.length).toBe(0);
    });

    test('should handle empty diff', () => {
      const diff: ConfigDiff = {
        filesAdded: [],
        filesModified: [],
        filesDeleted: [],
        linesAdded: [],
        linesRemoved: [],
      };

      const result = extractMatchEvidence(credentialRecommendation, diff);

      expect(result.totalWeight).toBe(0);
      expect(result.evidence.length).toBe(0);
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
      const result = extractMatchEvidence(badRecommendation, diff);
      expect(result).toBeDefined();
      expect(result.evidence).toBeDefined();
    });
  });

  describe('extractAllMatchEvidence', () => {
    test('should extract evidence for multiple recommendations', () => {
      const diff: ConfigDiff = {
        filesAdded: [],
        filesModified: ['CLAUDE.md'],
        filesDeleted: [],
        linesAdded: ['Add unit tests for all features', 'Handle credentials securely'],
        linesRemoved: [],
      };

      const results = extractAllMatchEvidence(
        [credentialRecommendation, testingRecommendation],
        diff
      );

      expect(results.size).toBe(2);
      expect(results.has('rec-001')).toBe(true);
      expect(results.has('rec-002')).toBe(true);
    });

    test('should include all recommendations in results', () => {
      const diff: ConfigDiff = {
        filesAdded: [],
        filesModified: ['CLAUDE.md'],
        filesDeleted: [],
        linesAdded: ['Testing is important'],
        linesRemoved: [],
      };

      const results = extractAllMatchEvidence(
        [credentialRecommendation, testingRecommendation],
        diff
      );

      // All recommendations should be in the map
      expect(results.has('rec-001')).toBe(true);
      expect(results.has('rec-002')).toBe(true);

      // Testing recommendation should have evidence
      const testingEvidence = results.get('rec-002');
      expect(testingEvidence?.keywordMatches.length).toBeGreaterThan(0);
    });

    test('should return map with zero evidence when no matches', () => {
      const diff: ConfigDiff = {
        filesAdded: [],
        filesModified: ['unrelated.txt'],
        filesDeleted: [],
        linesAdded: ['Completely unrelated content'],
        linesRemoved: [],
      };

      const results = extractAllMatchEvidence(
        [credentialRecommendation, testingRecommendation],
        diff
      );

      // Both recommendations should be in map, but with zero weight
      expect(results.has('rec-001')).toBe(true);
      expect(results.has('rec-002')).toBe(true);
      expect(results.get('rec-001')?.totalWeight).toBe(0);
      expect(results.get('rec-002')?.totalWeight).toBe(0);
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
