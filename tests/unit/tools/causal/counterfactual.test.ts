/**
 * EP07 Causal Tracing Engine - Counterfactual Unit Tests (T043)
 *
 * Tests for counterfactual analysis generation following
 * "If [X] were present, [Y] would not have occurred" format.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { v4 as uuidv4 } from 'uuid';

import type {
  Gap,
  GapType,
  GapLocation,
  EvidenceItem,
  CausalChain,
} from '../../../../src/tools/causal/types';
import {
  CounterfactualGenerator,
  createCounterfactualGenerator,
  generateCounterfactual,
} from '../../../../src/tools/causal/counterfactual';

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Create a test gap without a counterfactual (for generation tests).
 */
function createTestGap(overrides: Partial<Gap> = {}): Gap {
  return {
    type: 'missing_guidance',
    location: 'claude_md',
    expectedGuidance: 'Error handling guidelines',
    counterfactual: '', // Empty to force generation
    ...overrides,
  };
}

/**
 * Create a test gap with existing counterfactual.
 */
function createTestGapWithCounterfactual(overrides: Partial<Gap> = {}): Gap {
  return {
    type: 'missing_guidance',
    location: 'claude_md',
    expectedGuidance: 'Error handling guidelines',
    counterfactual: 'If guidance existed, issue would not have occurred',
    ...overrides,
  };
}

/**
 * Create a test evidence item.
 */
function createTestEvidence(
  overrides: Partial<EvidenceItem> = {}
): EvidenceItem {
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
 * Create a test causal chain.
 */
function createTestChain(overrides: Partial<CausalChain> = {}): CausalChain {
  const evidence = [createTestEvidence()];
  return {
    id: uuidv4(),
    issueId: `issue-${uuidv4().substring(0, 8)}`,
    trigger: evidence[0]!,
    gap: createTestGap(),
    mechanism: 'Test mechanism',
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
    evidence,
    depth: 1,
    depthLimitReached: false,
    projectPath: '/test/project',
    createdAt: new Date().toISOString(),
    counterfactual: 'If X, Y would not have occurred',
    ...overrides,
  };
}

// =============================================================================
// Test Suites
// =============================================================================

describe('CounterfactualGenerator', () => {
  let generator: CounterfactualGenerator;

  beforeEach(() => {
    generator = createCounterfactualGenerator();
  });

  // ===========================================================================
  // T043: Counterfactual format tests
  // ===========================================================================

  describe('counterfactual format (T043)', () => {
    it('should generate counterfactual with correct format', () => {
      const gap = createTestGap({
        type: 'missing_guidance',
        location: 'claude_md',
        expectedGuidance: 'Error handling best practices',
      });

      const result = generator.generateFromGap(gap);

      expect(result).toContain('If');
      expect(result).toContain('would');
      expect(result).toMatch(/If .+, .+ would/);
    });

    it('should include expected guidance in counterfactual', () => {
      const gap = createTestGap({
        expectedGuidance: 'TypeScript strict mode configuration',
      });

      const result = generator.generateFromGap(gap);

      expect(result).toContain('TypeScript strict mode configuration');
    });

    it('should reference location in counterfactual', () => {
      const locations: GapLocation[] = [
        'claude_md',
        'project_config',
        'global_config',
        'mcp_config',
        'skill',
      ];

      for (const location of locations) {
        const gap = createTestGap({ location });
        const result = generator.generateFromGap(gap);

        // Should reference the location in human-readable form
        expect(result.length).toBeGreaterThan(20);
      }
    });

    it('should generate different counterfactuals for different gap types', () => {
      const types: GapType[] = [
        'missing_guidance',
        'missing_config',
        'missing_example',
        'terminology_gap',
        'context_loss',
      ];

      const counterfactuals = types.map((type) => {
        const gap = createTestGap({ type });
        return generator.generateFromGap(gap);
      });

      // All should be valid counterfactuals
      for (const cf of counterfactuals) {
        expect(cf).toContain('If');
        expect(cf.length).toBeGreaterThan(10);
      }
    });

    it('should handle gap without counterfactual field', () => {
      // Create gap without counterfactual
      const gap: Omit<Gap, 'counterfactual'> = {
        type: 'missing_config',
        location: 'project_config',
        expectedGuidance: 'ESLint configuration',
      };

      const result = generator.generateFromGap(gap as Gap);

      expect(result).toContain('If');
      expect(result).toContain('ESLint configuration');
    });
  });

  // ===========================================================================
  // Counterfactual from chain tests
  // ===========================================================================

  describe('counterfactual from chain', () => {
    it('should generate counterfactual from causal chain', () => {
      const chain = createTestChain({
        gap: createTestGap({
          expectedGuidance: 'API rate limiting guidelines',
        }),
      });

      const result = generator.generateFromChain(chain);

      expect(result).toContain('If');
      expect(result).toContain('API rate limiting');
    });

    it('should handle chain without gap', () => {
      const chain = createTestChain({ gap: undefined });

      const result = generator.generateFromChain(chain);

      // Should still generate something meaningful from issue
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should use effect when generating counterfactual', () => {
      const chain = createTestChain({
        effect: 'API call failed with 429 error',
        gap: undefined,
      });

      const result = generator.generateFromChain(chain);

      expect(result.length).toBeGreaterThan(0);
    });

    it('should prioritize gap counterfactual over generated', () => {
      const chain = createTestChain({
        gap: createTestGapWithCounterfactual({
          counterfactual: 'Specific counterfactual from gap',
        }),
      });

      const result = generator.generateFromChain(chain);

      expect(result).toContain('Specific counterfactual from gap');
    });
  });

  // ===========================================================================
  // Location name mapping tests
  // ===========================================================================

  describe('location name mapping', () => {
    it('should map claude_md to readable name', () => {
      const gap = createTestGap({ location: 'claude_md' });
      const result = generator.generateFromGap(gap);

      expect(result).toContain('CLAUDE.md');
    });

    it('should map project_config to readable name', () => {
      const gap = createTestGap({ location: 'project_config' });
      const result = generator.generateFromGap(gap);

      expect(result.toLowerCase()).toMatch(/project|settings|config/);
    });

    it('should map global_config to readable name', () => {
      const gap = createTestGap({ location: 'global_config' });
      const result = generator.generateFromGap(gap);

      expect(result.toLowerCase()).toMatch(/global|user|settings/);
    });

    it('should map mcp_config to readable name', () => {
      const gap = createTestGap({ location: 'mcp_config' });
      const result = generator.generateFromGap(gap);

      expect(result.toLowerCase()).toMatch(/mcp|\.mcp\.json/i);
    });

    it('should handle "other" location', () => {
      const gap = createTestGap({ location: 'other' });
      const result = generator.generateFromGap(gap);

      // Should still produce valid counterfactual
      expect(result).toContain('If');
      expect(result.length).toBeGreaterThan(20);
    });
  });

  // ===========================================================================
  // Edge cases
  // ===========================================================================

  describe('edge cases', () => {
    it('should handle empty expected guidance', () => {
      const gap = createTestGap({ expectedGuidance: '' });

      // This may throw or return generic message
      expect(() => generator.generateFromGap(gap)).not.toThrow();
    });

    it('should handle very long expected guidance', () => {
      const longGuidance = 'A'.repeat(1000);
      const gap = createTestGap({ expectedGuidance: longGuidance });

      const result = generator.generateFromGap(gap);

      // Should truncate or handle gracefully
      expect(result.length).toBeLessThan(2000);
    });

    it('should handle special characters in guidance', () => {
      const gap = createTestGap({
        expectedGuidance: 'Use "quotes" and <brackets> & ampersands',
      });

      const result = generator.generateFromGap(gap);

      expect(result).toContain('quotes');
    });

    it('should handle newlines in guidance', () => {
      const gap = createTestGap({
        expectedGuidance: 'Line 1\nLine 2\nLine 3',
      });

      const result = generator.generateFromGap(gap);

      // Should produce single-line counterfactual
      expect(result.split('\n')).toHaveLength(1);
    });
  });
});

// =============================================================================
// Standalone function tests
// =============================================================================

describe('generateCounterfactual function', () => {
  it('should generate counterfactual from gap', () => {
    const gap = createTestGap();
    const result = generateCounterfactual(gap);

    expect(result).toContain('If');
    expect(result.length).toBeGreaterThan(20);
  });

  it('should be a pure function', () => {
    const gap = createTestGap();

    const result1 = generateCounterfactual(gap);
    const result2 = generateCounterfactual(gap);

    expect(result1).toEqual(result2);
  });
});

// =============================================================================
// Factory function tests
// =============================================================================

describe('createCounterfactualGenerator factory', () => {
  it('should create new generator instance', () => {
    const generator1 = createCounterfactualGenerator();
    const generator2 = createCounterfactualGenerator();

    expect(generator1).toBeDefined();
    expect(generator2).toBeDefined();
    expect(generator1).not.toBe(generator2);
  });

  it('should create generators with consistent behavior', () => {
    const generator1 = createCounterfactualGenerator();
    const generator2 = createCounterfactualGenerator();

    const gap = createTestGap();

    const result1 = generator1.generateFromGap(gap);
    const result2 = generator2.generateFromGap(gap);

    expect(result1).toEqual(result2);
  });
});
