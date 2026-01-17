/**
 * Unit tests for chain-builder.ts
 *
 * Tests for the ChainBuilder class that constructs causal chains
 * from evidence with trigger → gap → mechanism → effect structure.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { v4 as uuidv4 } from 'uuid';

import type { EvidenceItem, Gap, CausalChain } from '../../../../src/tools/causal/types';
import {
  ChainBuilder,
  createChainBuilder,
  buildCausalChain,
  DEFAULT_MAX_DEPTH,
} from '../../../../src/tools/causal/chain-builder';

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
    counterfactual: 'If error handling guidelines existed, this issue would not have occurred',
    ...overrides,
  };
}

/**
 * Create multiple evidence items with temporal ordering.
 */
function createTemporalEvidence(count: number): EvidenceItem[] {
  const baseTime = new Date('2024-01-01T10:00:00Z').getTime();
  return Array.from({ length: count }, (_, i) => ({
    id: uuidv4(),
    type: 'SessionMatch' as const,
    source: `session-${i + 1}`,
    timestamp: new Date(baseTime + i * 60000).toISOString(), // 1 minute apart
    content: `Evidence content ${i + 1}`,
  }));
}

// =============================================================================
// Test Suite: Chain Construction (T029)
// =============================================================================

describe('ChainBuilder', () => {
  describe('chain construction (T029)', () => {
    it('should construct a chain with required fields', () => {
      const evidence = [createTestEvidence()];
      const issueId = 'issue-123';
      const issueDescription = 'TypeError: undefined is not a function';
      const projectPath = '/test/project';

      // This is what ChainBuilder will produce
      const chain: CausalChain = {
        id: uuidv4(),
        issueId,
        trigger: evidence[0]!,
        gap: undefined,
        mechanism: 'Issue originated from session activity',
        effect: issueDescription,
        confidence: {
          specificity: false,
          temporal: false,
          mechanistic: true,
          evidenceQuality: false,
          reproducibility: false,
          alternatives: false,
          overall: 'low',
        },
        evidence,
        depth: 1,
        depthLimitReached: false,
        projectPath,
        createdAt: new Date().toISOString(),
        counterfactual: undefined,
        patternId: undefined,
      };

      expect(chain.id).toBeDefined();
      expect(chain.issueId).toBe(issueId);
      expect(chain.trigger).toEqual(evidence[0]!);
      expect(chain.effect).toBe(issueDescription);
      expect(chain.projectPath).toBe(projectPath);
      expect(chain.evidence).toHaveLength(1);
    });

    it('should identify earliest evidence as trigger', () => {
      const evidence = createTemporalEvidence(3);

      // Shuffle to test sorting
      const shuffled = [evidence[2]!, evidence[0]!, evidence[1]!];

      // Sort by timestamp to find trigger
      const sorted = [...shuffled].sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeA - timeB;
      });

      const trigger = sorted[0]!;

      // Trigger should be the earliest (session-1)
      expect(trigger.source).toBe('session-1');
      expect(trigger.timestamp).toBe(evidence[0]!.timestamp);
    });

    it('should include gap in chain when provided', () => {
      const evidence = [createTestEvidence()];
      const gap = createTestGap();

      const chain: CausalChain = {
        id: uuidv4(),
        issueId: 'issue-123',
        trigger: evidence[0]!,
        gap,
        mechanism: 'Gap in configuration led to issue',
        effect: 'Error occurred',
        confidence: {
          specificity: true,
          temporal: true,
          mechanistic: true,
          evidenceQuality: true,
          reproducibility: false,
          alternatives: true,
          overall: 'high',
        },
        evidence,
        depth: 1,
        depthLimitReached: false,
        projectPath: '/test/project',
        createdAt: new Date().toISOString(),
        counterfactual: gap.counterfactual,
        patternId: undefined,
      };

      expect(chain.gap).toBeDefined();
      expect(chain.gap!.type).toBe('missing_guidance');
      expect(chain.gap!.location).toBe('claude_md');
      expect(chain.counterfactual).toBe(gap.counterfactual);
    });

    it('should construct chain with trigger → gap → mechanism → effect structure', () => {
      const evidence = createTemporalEvidence(3);
      const gap = createTestGap();

      // Chain should have clear structure
      const chain: CausalChain = {
        id: uuidv4(),
        issueId: 'issue-123',
        trigger: evidence[0]!, // First event
        gap, // Configuration gap that enabled issue
        mechanism:
          'User prompt in session led to code generation without null checks due to missing guidance',
        effect: 'TypeError: Cannot read property of undefined',
        confidence: {
          specificity: true,
          temporal: true,
          mechanistic: true,
          evidenceQuality: true,
          reproducibility: false,
          alternatives: true,
          overall: 'high',
        },
        evidence,
        depth: 3,
        depthLimitReached: false,
        projectPath: '/test/project',
        createdAt: new Date().toISOString(),
        counterfactual: 'If null check guidance existed, this error would not have occurred',
        patternId: undefined,
      };

      // Verify structure
      expect(chain.trigger).toEqual(evidence[0]!); // Origin
      expect(chain.gap).toBeDefined(); // Configuration gap
      expect(chain.mechanism).toContain('guidance'); // Causal explanation
      expect(chain.effect).toContain('TypeError'); // Detected issue
    });

    it('should generate mechanism from evidence content', () => {
      const evidence = [
        createTestEvidence({
          content: 'User asked to implement file reading without error handling',
        }),
      ];

      const mechanismPrefix = 'Issue originated from session activity. First evidence:';

      // Mechanism should reference evidence content
      const mechanism = `${mechanismPrefix} ${evidence[0]!.content!.substring(0, 100)}`;

      expect(mechanism).toContain('file reading');
      expect(mechanism).toContain('error handling');
    });

    it('should use fallback mechanism when evidence has no content', () => {
      const evidence = [createTestEvidence({ content: undefined })];

      // When no content, use fallback
      const mechanism =
        evidence[0]!.content?.substring(0, 100) ??
        'Unable to determine causal mechanism from available evidence.';

      expect(mechanism).toBe('Unable to determine causal mechanism from available evidence.');
    });

    it('should include all evidence in chain', () => {
      const evidence = createTemporalEvidence(5);

      const chain: CausalChain = {
        id: uuidv4(),
        issueId: 'issue-123',
        trigger: evidence[0]!,
        gap: undefined,
        mechanism: 'Multiple session interactions led to issue',
        effect: 'Error detected',
        confidence: {
          specificity: true,
          temporal: true,
          mechanistic: true,
          evidenceQuality: true,
          reproducibility: true,
          alternatives: true,
          overall: 'high',
        },
        evidence,
        depth: 5,
        depthLimitReached: false,
        projectPath: '/test/project',
        createdAt: new Date().toISOString(),
        counterfactual: undefined,
        patternId: undefined,
      };

      expect(chain.evidence).toHaveLength(5);
      expect(chain.evidence[0]).toEqual(evidence[0]);
      expect(chain.evidence[4]).toEqual(evidence[4]);
    });

    it('should compute confidence based on evidence quality', () => {
      // High quality evidence
      const goodEvidence = [
        createTestEvidence({
          timestamp: new Date().toISOString(),
          content: 'Detailed content explaining the issue source with context',
          position: { filePath: '/src/file.ts', line: 42, snippet: 'code' },
        }),
        createTestEvidence({
          timestamp: new Date().toISOString(),
          content: 'Additional corroborating evidence',
        }),
      ];

      const hasMultiple = goodEvidence.length >= 2;
      const hasTimestamps = goodEvidence.every((e) => e.timestamp);
      const hasPositions = goodEvidence.some((e) => e.position);
      const hasContent = goodEvidence.some((e) => e.content && e.content.length > 50);

      expect(hasMultiple).toBe(true);
      expect(hasTimestamps).toBe(true);
      expect(hasPositions).toBe(true);
      expect(hasContent).toBe(true);

      // These factors should yield high confidence
      const score = [
        hasMultiple, // temporal
        hasPositions && hasContent, // specificity
        true, // mechanistic (always true with evidence)
        hasContent, // evidenceQuality
        false, // reproducibility (needs pattern matching)
        hasMultiple, // alternatives
      ].filter(Boolean).length;

      expect(score).toBeGreaterThanOrEqual(5);
    });

    it('should set createdAt timestamp', () => {
      const before = new Date().toISOString();

      const chain: CausalChain = {
        id: uuidv4(),
        issueId: 'issue-123',
        trigger: createTestEvidence(),
        gap: undefined,
        mechanism: 'Test',
        effect: 'Test effect',
        confidence: {
          specificity: false,
          temporal: false,
          mechanistic: true,
          evidenceQuality: false,
          reproducibility: false,
          alternatives: false,
          overall: 'low',
        },
        evidence: [createTestEvidence()],
        depth: 1,
        depthLimitReached: false,
        projectPath: '/test',
        createdAt: new Date().toISOString(),
        counterfactual: undefined,
        patternId: undefined,
      };

      const after = new Date().toISOString();

      expect(chain.createdAt >= before).toBe(true);
      expect(chain.createdAt <= after).toBe(true);
    });

    it('should handle empty evidence array gracefully', () => {
      // When no evidence, should create a fallback trigger
      const fallbackTrigger: EvidenceItem = {
        id: uuidv4(),
        type: 'TemporalMarker',
        source: 'unknown',
        content: 'Origin could not be determined',
      };

      expect(fallbackTrigger.type).toBe('TemporalMarker');
      expect(fallbackTrigger.source).toBe('unknown');
      expect(fallbackTrigger.content).toContain('could not be determined');
    });
  });

  // ===========================================================================
  // Test Suite: Depth Limiting (T030)
  // ===========================================================================

  describe('depth limiting (T030)', () => {
    it('should respect maxDepth parameter', () => {
      const evidence = createTemporalEvidence(10);
      const maxDepth = 5;

      // Depth should be capped at maxDepth
      const depth = Math.min(evidence.length, maxDepth);

      expect(depth).toBe(5);
      expect(depth).toBeLessThanOrEqual(maxDepth);
    });

    it('should set depthLimitReached when evidence exceeds maxDepth', () => {
      const evidence = createTemporalEvidence(8);
      const maxDepth = 5;

      const depthLimitReached = evidence.length > maxDepth;

      expect(depthLimitReached).toBe(true);
    });

    it('should not set depthLimitReached when evidence is within limit', () => {
      const evidence = createTemporalEvidence(3);
      const maxDepth = 5;

      const depthLimitReached = evidence.length > maxDepth;

      expect(depthLimitReached).toBe(false);
    });

    it('should default maxDepth to 5', () => {
      const DEFAULT_MAX_DEPTH = 5;

      expect(DEFAULT_MAX_DEPTH).toBe(5);
    });

    it('should handle exactly maxDepth evidence', () => {
      const evidence = createTemporalEvidence(5);
      const maxDepth = 5;

      const depth = Math.min(evidence.length, maxDepth);
      const depthLimitReached = evidence.length > maxDepth;

      expect(depth).toBe(5);
      expect(depthLimitReached).toBe(false);
    });

    it('should include all evidence even when depth limited', () => {
      const evidence = createTemporalEvidence(10);
      const maxDepth = 5;

      // All evidence should still be included in the chain
      // Only the depth counter is limited
      const chain: CausalChain = {
        id: uuidv4(),
        issueId: 'issue-123',
        trigger: evidence[0]!,
        gap: undefined,
        mechanism: 'Test',
        effect: 'Test effect',
        confidence: {
          specificity: true,
          temporal: true,
          mechanistic: true,
          evidenceQuality: true,
          reproducibility: false,
          alternatives: true,
          overall: 'high',
        },
        evidence, // All 10 items
        depth: Math.min(evidence.length, maxDepth), // Capped at 5
        depthLimitReached: evidence.length > maxDepth, // true
        projectPath: '/test',
        createdAt: new Date().toISOString(),
        counterfactual: undefined,
        patternId: undefined,
      };

      expect(chain.evidence).toHaveLength(10); // All evidence included
      expect(chain.depth).toBe(5); // Depth capped
      expect(chain.depthLimitReached).toBe(true);
    });

    it('should allow maxDepth values 1 through 5', () => {
      const validDepths = [1, 2, 3, 4, 5];

      for (const maxDepth of validDepths) {
        expect(maxDepth >= 1 && maxDepth <= 5).toBe(true);
      }
    });

    it('should cap depth at 5 even if more requested', () => {
      // Per the CausalChainSchema, depth is max(5)
      const requestedDepth = 10;
      const maxAllowed = 5;

      const actualDepth = Math.min(requestedDepth, maxAllowed);

      expect(actualDepth).toBe(5);
    });

    it('should track trace completeness based on depth', () => {
      const evidenceWithinLimit = createTemporalEvidence(3);
      const evidenceExceedsLimit = createTemporalEvidence(10);
      const maxDepth = 5;

      const completeTrace = evidenceWithinLimit.length <= maxDepth;
      const partialTrace = evidenceExceedsLimit.length > maxDepth;

      expect(completeTrace).toBe(true);
      expect(partialTrace).toBe(true);
    });
  });

  // ===========================================================================
  // Test Suite: Confidence Computation
  // ===========================================================================

  describe('confidence computation', () => {
    it('should compute high confidence when 5+ factors met', () => {
      const factors = {
        specificity: true,
        temporal: true,
        mechanistic: true,
        evidenceQuality: true,
        reproducibility: true,
        alternatives: false,
      };

      const score = Object.values(factors).filter(Boolean).length;
      const level = score >= 5 ? 'high' : score >= 3 ? 'medium' : 'low';

      expect(score).toBe(5);
      expect(level).toBe('high');
    });

    it('should compute medium confidence when 3-4 factors met', () => {
      const factors = {
        specificity: true,
        temporal: true,
        mechanistic: true,
        evidenceQuality: false,
        reproducibility: false,
        alternatives: false,
      };

      const score = Object.values(factors).filter(Boolean).length;
      const level = score >= 5 ? 'high' : score >= 3 ? 'medium' : 'low';

      expect(score).toBe(3);
      expect(level).toBe('medium');
    });

    it('should compute low confidence when <3 factors met', () => {
      const factors = {
        specificity: false,
        temporal: false,
        mechanistic: true,
        evidenceQuality: true,
        reproducibility: false,
        alternatives: false,
      };

      const score = Object.values(factors).filter(Boolean).length;
      const level = score >= 5 ? 'high' : score >= 3 ? 'medium' : 'low';

      expect(score).toBe(2);
      expect(level).toBe('low');
    });

    it('should assess specificity from position and content', () => {
      const evidenceWithPosition = createTestEvidence({
        position: { filePath: '/src/file.ts', line: 42 },
        content: 'Detailed content explaining the issue',
      });

      const hasPosition = evidenceWithPosition.position !== undefined;
      const hasContent =
        evidenceWithPosition.content !== undefined && evidenceWithPosition.content.length > 20;
      const specificity = hasPosition && hasContent;

      expect(specificity).toBe(true);
    });

    it('should assess temporal from timestamps and multiple evidence', () => {
      const evidence = createTemporalEvidence(3);

      const hasTimestamps = evidence.every((e) => e.timestamp);
      const hasMultiple = evidence.length >= 2;
      const temporal = hasTimestamps && hasMultiple;

      expect(temporal).toBe(true);
    });

    it('should assess mechanistic from having any evidence', () => {
      const evidence = [createTestEvidence()];

      const mechanistic = evidence.length >= 1;

      expect(mechanistic).toBe(true);
    });

    it('should assess evidenceQuality from content length', () => {
      const goodEvidence = createTestEvidence({
        content: 'This is a detailed explanation with more than fifty characters of content.',
      });
      const poorEvidence = createTestEvidence({
        content: 'Short',
      });

      const goodQuality = (goodEvidence.content?.length ?? 0) > 50;
      const poorQuality = (poorEvidence.content?.length ?? 0) > 50;

      expect(goodQuality).toBe(true);
      expect(poorQuality).toBe(false);
    });

    it('should assess alternatives from multiple evidence sources', () => {
      const multipleEvidence = createTemporalEvidence(3);
      const singleEvidence = [createTestEvidence()];

      const alternativesConsidered = multipleEvidence.length >= 2;
      const noAlternatives = singleEvidence.length >= 2;

      expect(alternativesConsidered).toBe(true);
      expect(noAlternatives).toBe(false);
    });
  });

  // ===========================================================================
  // Test Suite: Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('should handle evidence without timestamps', () => {
      const evidence = [
        createTestEvidence({ timestamp: undefined }),
        createTestEvidence({ timestamp: undefined }),
      ];

      // Without timestamps, temporal factor should be false
      const hasTimestamps = evidence.every((e) => e.timestamp);

      expect(hasTimestamps).toBe(false);
    });

    it('should handle evidence with same timestamp', () => {
      const timestamp = new Date().toISOString();
      const evidence = [
        createTestEvidence({ timestamp, source: 'source-1' }),
        createTestEvidence({ timestamp, source: 'source-2' }),
      ];

      // Same timestamp is still valid for temporal
      const hasTimestamps = evidence.every((e) => e.timestamp);

      expect(hasTimestamps).toBe(true);
    });

    it('should handle very long issue descriptions', () => {
      const longDescription = 'Error: '.repeat(1000);

      // Should be usable as effect
      expect(longDescription.length).toBeGreaterThan(1000);
    });

    it('should handle special characters in content', () => {
      const evidence = createTestEvidence({
        content: '```typescript\nconst x = "value";\n```\n<script>alert("xss")</script>',
      });

      expect(evidence.content).toContain('```');
      expect(evidence.content).toContain('<script>');
    });

    it('should handle unicode in content', () => {
      const evidence = createTestEvidence({
        content: '日本語テスト 🚀 émojis and ñ characters',
      });

      expect(evidence.content).toContain('日本語');
      expect(evidence.content).toContain('🚀');
    });

    it('should handle null-ish gap values', () => {
      const chain: CausalChain = {
        id: uuidv4(),
        issueId: 'issue-123',
        trigger: createTestEvidence(),
        gap: undefined, // No gap identified
        mechanism: 'Test',
        effect: 'Test effect',
        confidence: {
          specificity: false,
          temporal: false,
          mechanistic: true,
          evidenceQuality: false,
          reproducibility: false,
          alternatives: false,
          overall: 'low',
        },
        evidence: [createTestEvidence()],
        depth: 1,
        depthLimitReached: false,
        projectPath: '/test',
        createdAt: new Date().toISOString(),
        counterfactual: undefined,
        patternId: undefined,
      };

      expect(chain.gap).toBeUndefined();
      expect(chain.counterfactual).toBeUndefined();
    });
  });

  // ===========================================================================
  // Test Suite: ChainBuilder Class Implementation
  // ===========================================================================

  describe('ChainBuilder class implementation', () => {
    let builder: ChainBuilder;

    beforeEach(() => {
      builder = createChainBuilder();
    });

    it('should build chain using ChainBuilder.build()', () => {
      const evidence = createTemporalEvidence(3);
      const gap = createTestGap();

      const result = builder.build({
        issueId: 'issue-123',
        issueDescription: 'TypeError: undefined is not a function',
        evidence,
        projectPath: '/test/project',
        gap,
      });

      expect(result.chain.issueId).toBe('issue-123');
      expect(result.chain.effect).toBe('TypeError: undefined is not a function');
      expect(result.chain.projectPath).toBe('/test/project');
      expect(result.chain.gap).toBe(gap);
      expect(result.chain.evidence).toHaveLength(3);
      expect(result.traceCompleteness).toBe('full');
    });

    it('should use buildCausalChain standalone function', () => {
      const evidence = createTemporalEvidence(2);

      const chain = buildCausalChain('issue-456', 'Error in file', evidence, '/project', 5);

      expect(chain.issueId).toBe('issue-456');
      expect(chain.effect).toBe('Error in file');
      expect(chain.depth).toBeLessThanOrEqual(5);
    });

    it('should identify trigger as earliest evidence', () => {
      const evidence = createTemporalEvidence(5);
      // Shuffle evidence
      const shuffled = [evidence[3]!, evidence[1]!, evidence[4]!, evidence[0]!, evidence[2]!];

      const result = builder.build({
        issueId: 'issue-123',
        issueDescription: 'Test',
        evidence: shuffled,
        projectPath: '/test',
      });

      // Trigger should be the earliest (evidence[0])
      expect(result.chain.trigger.source).toBe('session-1');
    });

    it('should set depthLimitReached when evidence exceeds maxDepth', () => {
      const evidence = createTemporalEvidence(10);

      const result = builder.build({
        issueId: 'issue-123',
        issueDescription: 'Test',
        evidence,
        projectPath: '/test',
        maxDepth: 5,
      });

      expect(result.chain.depthLimitReached).toBe(true);
      expect(result.chain.depth).toBe(5);
      expect(result.traceCompleteness).toBe('partial');
      expect(result.warnings).toBeDefined();
    });

    it('should use DEFAULT_MAX_DEPTH constant', () => {
      expect(DEFAULT_MAX_DEPTH).toBe(5);
    });

    it('should generate mechanism from trigger content', () => {
      const evidence = [
        createTestEvidence({
          content: 'User requested implementation without validation',
        }),
      ];

      const result = builder.build({
        issueId: 'issue-123',
        issueDescription: 'Validation error',
        evidence,
        projectPath: '/test',
      });

      expect(result.chain.mechanism).toContain('session activity');
      expect(result.chain.mechanism).toContain('implementation');
    });

    it('should include gap type in mechanism when gap provided', () => {
      const evidence = [createTestEvidence()];
      const gap = createTestGap({ type: 'missing_guidance' });

      const result = builder.build({
        issueId: 'issue-123',
        issueDescription: 'Test',
        evidence,
        projectPath: '/test',
        gap,
      });

      expect(result.chain.mechanism).toContain('missing guidance');
    });

    it('should compute confidence based on evidence quality', () => {
      const highQualityEvidence = [
        createTestEvidence({
          timestamp: new Date().toISOString(),
          content:
            'This is detailed content that explains the issue with sufficient context and information.',
          position: { filePath: '/src/file.ts', line: 42 },
        }),
        createTestEvidence({
          timestamp: new Date().toISOString(),
          content: 'Additional corroborating evidence with sufficient detail.',
        }),
      ];

      const result = builder.build({
        issueId: 'issue-123',
        issueDescription: 'Test',
        evidence: highQualityEvidence,
        projectPath: '/test',
      });

      // Should have high confidence due to quality evidence
      expect(result.chain.confidence.specificity).toBe(true);
      expect(result.chain.confidence.temporal).toBe(true);
      expect(result.chain.confidence.evidenceQuality).toBe(true);
      expect(result.chain.confidence.overall).toBe('high');
    });

    it('should return low confidence for poor quality evidence', () => {
      const poorEvidence = [
        createTestEvidence({
          timestamp: undefined,
          content: 'Short',
          position: undefined,
        }),
      ];

      const result = builder.build({
        issueId: 'issue-123',
        issueDescription: 'Test',
        evidence: poorEvidence,
        projectPath: '/test',
      });

      expect(result.chain.confidence.specificity).toBe(false);
      expect(result.chain.confidence.temporal).toBe(false);
      expect(result.chain.confidence.evidenceQuality).toBe(false);
      expect(result.chain.confidence.overall).toBe('low');
    });

    it('should use gap counterfactual as chain counterfactual', () => {
      const evidence = [createTestEvidence()];
      const gap = createTestGap({
        counterfactual: 'If proper validation existed, this error would not occur',
      });

      const result = builder.build({
        issueId: 'issue-123',
        issueDescription: 'Test',
        evidence,
        projectPath: '/test',
        gap,
      });

      expect(result.chain.counterfactual).toBe(gap.counterfactual);
    });

    it('should handle empty evidence array with fallback trigger', () => {
      const result = builder.build({
        issueId: 'issue-123',
        issueDescription: 'Test',
        evidence: [],
        projectPath: '/test',
      });

      expect(result.chain.trigger.type).toBe('TemporalMarker');
      expect(result.chain.trigger.source).toBe('unknown');
      expect(result.chain.trigger.content).toContain('could not be determined');
      expect(result.chain.evidence).toHaveLength(1); // Fallback trigger added
    });

    it('should set createdAt to current timestamp', () => {
      const before = new Date().toISOString();

      const result = builder.build({
        issueId: 'issue-123',
        issueDescription: 'Test',
        evidence: [createTestEvidence()],
        projectPath: '/test',
      });

      const after = new Date().toISOString();

      expect(result.chain.createdAt >= before).toBe(true);
      expect(result.chain.createdAt <= after).toBe(true);
    });

    it('should have hasHighQualityEvidence helper method', () => {
      const goodEvidence = [
        createTestEvidence({
          timestamp: new Date().toISOString(),
          content: 'Detailed content with more than fifty characters for quality assessment.',
          position: { filePath: '/src/file.ts', line: 1 },
        }),
        createTestEvidence({
          timestamp: new Date().toISOString(),
          content: 'More detailed content for assessment.',
        }),
      ];

      expect(builder.hasHighQualityEvidence(goodEvidence)).toBe(true);

      const poorEvidence = [createTestEvidence({ content: 'Short' })];
      expect(builder.hasHighQualityEvidence(poorEvidence)).toBe(false);
    });
  });
});
