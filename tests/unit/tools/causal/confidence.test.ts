/**
 * EP07 Causal Tracing Engine - Confidence Scoring Unit Tests (T047)
 *
 * Tests for 6-factor confidence assessment:
 * - specificity: Issue clearly links to specific trigger
 * - temporal: Timing supports causal relationship
 * - mechanistic: Plausible mechanism explains causation
 * - evidenceQuality: Evidence is direct, not inferred
 * - reproducibility: Pattern seen multiple times
 * - alternatives: Alternative causes considered
 *
 * Confidence levels:
 * - high: 5-6 factors true
 * - medium: 3-4 factors true
 * - low: 0-2 factors true
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { v4 as uuidv4 } from 'uuid';

import type { EvidenceItem, Gap, ConfidenceScore } from '../../../../src/tools/causal/types';
import { computeConfidenceLevel } from '../../../../src/tools/causal/types';
import {
  ConfidenceAssessor,
  createConfidenceAssessor,
  assessConfidence,
  CONFIDENCE_THRESHOLDS,
} from '../../../../src/tools/causal/confidence';

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Create a test evidence item.
 */
function createTestEvidence(overrides: Partial<EvidenceItem> = {}): EvidenceItem {
  return {
    id: uuidv4(),
    type: 'SessionMatch',
    source: 'session-123',
    timestamp: new Date().toISOString(),
    content: 'Test evidence content',
    ...overrides,
  };
}

/**
 * Create a test gap.
 */
function createTestGap(overrides: Partial<Gap> = {}): Gap {
  return {
    type: 'missing_guidance',
    location: 'claude_md',
    expectedGuidance: 'Error handling guidelines',
    counterfactual: 'If guidance existed, issue would not have occurred',
    ...overrides,
  };
}

// =============================================================================
// Test Suites
// =============================================================================

describe('Confidence Assessment', () => {
  let assessor: ConfidenceAssessor;

  beforeEach(() => {
    assessor = createConfidenceAssessor();
  });

  // ===========================================================================
  // T047: 6-Factor Evaluation
  // ===========================================================================

  describe('6-factor evaluation (T047)', () => {
    it('should evaluate specificity factor', () => {
      // Specific trigger with clear link
      const evidence = [
        createTestEvidence({
          type: 'SessionMatch',
          content: 'User prompt: Add error handling to the API endpoint',
          position: {
            filePath: 'src/api/handler.ts',
            line: 42,
          },
        }),
      ];

      const score = assessor.assess({
        evidence,
        issueDescription: 'API endpoint missing error handling at src/api/handler.ts:42',
      });

      expect(score.specificity).toBe(true);
    });

    it('should evaluate temporal factor', () => {
      const now = Date.now();
      const evidence = [
        createTestEvidence({
          timestamp: new Date(now - 1000).toISOString(), // 1 second ago
          type: 'SessionMatch',
        }),
        createTestEvidence({
          timestamp: new Date(now).toISOString(),
          type: 'TemporalMarker',
        }),
      ];

      const score = assessor.assess({
        evidence,
        issueDescription: 'Recent issue',
      });

      expect(score.temporal).toBe(true);
    });

    it('should evaluate mechanistic factor', () => {
      const evidence = [createTestEvidence()];
      const gap = createTestGap({
        expectedGuidance: 'Error handling best practices',
      });

      const score = assessor.assess({
        evidence,
        gap,
        mechanism: 'Missing error handling guidance led to unhandled exceptions',
        issueDescription: 'Unhandled exception in API',
      });

      expect(score.mechanistic).toBe(true);
    });

    it('should evaluate evidenceQuality factor', () => {
      // High quality: direct session matches with content
      const evidence = [
        createTestEvidence({
          type: 'SessionMatch',
          content: 'Direct match: implemented without error handling',
        }),
      ];

      const score = assessor.assess({
        evidence,
        issueDescription: 'Missing error handling',
      });

      expect(score.evidenceQuality).toBe(true);
    });

    it('should evaluate reproducibility factor', () => {
      // Multiple occurrences suggest pattern
      const evidence = [
        createTestEvidence({ type: 'SessionMatch' }),
        createTestEvidence({ type: 'SessionMatch' }),
        createTestEvidence({ type: 'SessionMatch' }),
      ];

      const score = assessor.assess({
        evidence,
        issueDescription: 'Recurring issue',
      });

      expect(score.reproducibility).toBe(true);
    });

    it('should evaluate alternatives factor', () => {
      // When gap is identified and mechanism explained, alternatives considered
      const evidence = [createTestEvidence()];
      const gap = createTestGap();

      const score = assessor.assess({
        evidence,
        gap,
        mechanism: 'Gap in guidance led to issue',
        issueDescription: 'Issue traced to configuration gap',
      });

      expect(score.alternatives).toBe(true);
    });
  });

  // ===========================================================================
  // Confidence Level Mapping
  // ===========================================================================

  describe('confidence level mapping', () => {
    it('should classify high confidence (5-6 factors)', () => {
      const factors: Omit<ConfidenceScore, 'overall'> = {
        specificity: true,
        temporal: true,
        mechanistic: true,
        evidenceQuality: true,
        reproducibility: true,
        alternatives: true,
      };

      const level = computeConfidenceLevel(factors);
      expect(level).toBe('high');
    });

    it('should classify high confidence with 5 factors', () => {
      const factors: Omit<ConfidenceScore, 'overall'> = {
        specificity: true,
        temporal: true,
        mechanistic: true,
        evidenceQuality: true,
        reproducibility: true,
        alternatives: false,
      };

      const level = computeConfidenceLevel(factors);
      expect(level).toBe('high');
    });

    it('should classify medium confidence (3-4 factors)', () => {
      const factors: Omit<ConfidenceScore, 'overall'> = {
        specificity: true,
        temporal: true,
        mechanistic: true,
        evidenceQuality: false,
        reproducibility: false,
        alternatives: false,
      };

      const level = computeConfidenceLevel(factors);
      expect(level).toBe('medium');
    });

    it('should classify medium confidence with 4 factors', () => {
      const factors: Omit<ConfidenceScore, 'overall'> = {
        specificity: true,
        temporal: true,
        mechanistic: true,
        evidenceQuality: true,
        reproducibility: false,
        alternatives: false,
      };

      const level = computeConfidenceLevel(factors);
      expect(level).toBe('medium');
    });

    it('should classify low confidence (0-2 factors)', () => {
      const factors: Omit<ConfidenceScore, 'overall'> = {
        specificity: true,
        temporal: true,
        mechanistic: false,
        evidenceQuality: false,
        reproducibility: false,
        alternatives: false,
      };

      const level = computeConfidenceLevel(factors);
      expect(level).toBe('low');
    });

    it('should classify low confidence with 0 factors', () => {
      const factors: Omit<ConfidenceScore, 'overall'> = {
        specificity: false,
        temporal: false,
        mechanistic: false,
        evidenceQuality: false,
        reproducibility: false,
        alternatives: false,
      };

      const level = computeConfidenceLevel(factors);
      expect(level).toBe('low');
    });
  });

  // ===========================================================================
  // Assessor Integration
  // ===========================================================================

  describe('assessor integration', () => {
    it('should return complete ConfidenceScore with overall', () => {
      const evidence = [createTestEvidence()];

      const score = assessor.assess({
        evidence,
        issueDescription: 'Test issue',
      });

      expect(score.specificity).toBeDefined();
      expect(score.temporal).toBeDefined();
      expect(score.mechanistic).toBeDefined();
      expect(score.evidenceQuality).toBeDefined();
      expect(score.reproducibility).toBeDefined();
      expect(score.alternatives).toBeDefined();
      expect(score.overall).toBeDefined();
      expect(['high', 'medium', 'low']).toContain(score.overall);
    });

    it('should compute overall from factors', () => {
      // Force all factors true by providing rich context
      const evidence = [
        createTestEvidence({
          type: 'SessionMatch',
          content: 'Specific match for error handling at src/api.ts:10',
          timestamp: new Date().toISOString(),
          position: { filePath: 'src/api.ts', line: 10 },
        }),
        createTestEvidence({ type: 'SessionMatch' }),
        createTestEvidence({ type: 'SessionMatch' }),
      ];
      const gap = createTestGap();

      const score = assessor.assess({
        evidence,
        gap,
        mechanism: 'Clear causal mechanism',
        issueDescription: 'Error handling issue at src/api.ts:10',
      });

      // With rich evidence, gap, and mechanism, should be high
      expect(['high', 'medium']).toContain(score.overall);
    });

    it('should handle minimal input', () => {
      const evidence = [createTestEvidence()];

      const score = assessor.assess({
        evidence,
        issueDescription: 'Simple issue',
      });

      // Should still return valid score, probably low
      expect(score.overall).toBeDefined();
    });

    it('should handle empty evidence', () => {
      const score = assessor.assess({
        evidence: [],
        issueDescription: 'Issue with no evidence',
      });

      // No evidence should result in low confidence
      expect(score.overall).toBe('low');
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('should handle evidence without timestamps', () => {
      const evidence = [createTestEvidence({ timestamp: undefined })];

      const score = assessor.assess({
        evidence,
        issueDescription: 'Test',
      });

      expect(score.temporal).toBe(false);
    });

    it('should handle evidence without position', () => {
      const evidence = [createTestEvidence({ position: undefined })];

      const score = assessor.assess({
        evidence,
        issueDescription: 'Test at specific location',
      });

      // Without position, specificity may be lower
      expect(score).toBeDefined();
    });

    it('should handle very old evidence', () => {
      const oldDate = new Date('2020-01-01').toISOString();
      const evidence = [createTestEvidence({ timestamp: oldDate })];

      const score = assessor.assess({
        evidence,
        issueDescription: 'Test',
      });

      // Old evidence may affect temporal scoring
      expect(score).toBeDefined();
    });

    it('should handle ConfigGap evidence type', () => {
      const evidence = [
        createTestEvidence({
          type: 'ConfigGap',
          content: 'Missing configuration',
        }),
      ];

      const score = assessor.assess({
        evidence,
        issueDescription: 'Config gap issue',
      });

      expect(score).toBeDefined();
    });

    it('should handle ToolTrace evidence type', () => {
      const evidence = [
        createTestEvidence({
          type: 'ToolTrace',
          content: 'Tool call pattern',
        }),
      ];

      const score = assessor.assess({
        evidence,
        issueDescription: 'Tool trace issue',
      });

      expect(score).toBeDefined();
    });
  });

  // ===========================================================================
  // Threshold Constants
  // ===========================================================================

  describe('threshold constants', () => {
    it('should export confidence thresholds', () => {
      expect(CONFIDENCE_THRESHOLDS).toBeDefined();
      expect(CONFIDENCE_THRESHOLDS.HIGH).toBe(5);
      expect(CONFIDENCE_THRESHOLDS.MEDIUM).toBe(3);
    });
  });
});

// =============================================================================
// Standalone Function Tests
// =============================================================================

describe('assessConfidence function', () => {
  it('should assess confidence from input', () => {
    const evidence = [createTestEvidence()];

    const score = assessConfidence({
      evidence,
      issueDescription: 'Test issue',
    });

    expect(score.overall).toBeDefined();
  });

  it('should be a pure function', () => {
    const evidence = [createTestEvidence()];
    const input = {
      evidence,
      issueDescription: 'Test',
    };

    const score1 = assessConfidence(input);
    const score2 = assessConfidence(input);

    expect(score1.overall).toEqual(score2.overall);
  });
});

// =============================================================================
// Factory Function Tests
// =============================================================================

describe('createConfidenceAssessor factory', () => {
  it('should create new assessor instance', () => {
    const assessor1 = createConfidenceAssessor();
    const assessor2 = createConfidenceAssessor();

    expect(assessor1).toBeDefined();
    expect(assessor2).toBeDefined();
    expect(assessor1).not.toBe(assessor2);
  });
});
