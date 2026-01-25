/**
 * Unit tests for temporal/subagent/types.ts
 *
 * Tests the TemporalSubagent type definitions and validation.
 *
 * @module temporal/subagent/__tests__/types.test
 */

import { describe, it, expect } from 'bun:test';

import {
  TEMPORAL_SUBAGENT_TOOLS,
  TEMPORAL_READONLY_TOOLS,
  TemporalSubagentInstructionsSchema,
  toAgentDefinition,
  type TemporalSubagentInstructions,
  type TemporalAnalysisContext,
  type TemporalAnalysisResult,
} from '../types';

// =============================================================================
// Test Fixtures
// =============================================================================

function createValidInstructions(
  overrides: Partial<TemporalSubagentInstructions> = {}
): TemporalSubagentInstructions {
  return {
    name: 'temporal-analyzer',
    displayName: 'Temporal Analyzer',
    description: 'Analyze workflow trends across baselines and qualitative reviews',
    prompt: 'You are the temporal analysis subagent...',
    tools: [...TEMPORAL_SUBAGENT_TOOLS],
    priority: 50,
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('temporal/subagent/types', () => {
  describe('TEMPORAL_SUBAGENT_TOOLS', () => {
    it('should include all temporal tools', () => {
      expect(TEMPORAL_SUBAGENT_TOOLS).toContain('store_baseline');
      expect(TEMPORAL_SUBAGENT_TOOLS).toContain('query_baseline');
      expect(TEMPORAL_SUBAGENT_TOOLS).toContain('list_baselines');
      expect(TEMPORAL_SUBAGENT_TOOLS).toContain('calculate_delta');
      expect(TEMPORAL_SUBAGENT_TOOLS).toContain('query_trends');
      expect(TEMPORAL_SUBAGENT_TOOLS).toContain('conduct_review');
      expect(TEMPORAL_SUBAGENT_TOOLS).toContain('get_review_history');
    });

    it('should have 7 tools total', () => {
      expect(TEMPORAL_SUBAGENT_TOOLS.length).toBe(7);
    });

    it('should NOT include Task tool (single-depth constraint)', () => {
      expect(TEMPORAL_SUBAGENT_TOOLS).not.toContain('Task');
    });
  });

  describe('TEMPORAL_READONLY_TOOLS', () => {
    it('should only include read operations', () => {
      expect(TEMPORAL_READONLY_TOOLS).not.toContain('store_baseline');
      expect(TEMPORAL_READONLY_TOOLS).not.toContain('conduct_review');
    });

    it('should include query operations', () => {
      expect(TEMPORAL_READONLY_TOOLS).toContain('query_baseline');
      expect(TEMPORAL_READONLY_TOOLS).toContain('list_baselines');
      expect(TEMPORAL_READONLY_TOOLS).toContain('calculate_delta');
      expect(TEMPORAL_READONLY_TOOLS).toContain('query_trends');
      expect(TEMPORAL_READONLY_TOOLS).toContain('get_review_history');
    });

    it('should have 5 tools total', () => {
      expect(TEMPORAL_READONLY_TOOLS.length).toBe(5);
    });
  });

  describe('TemporalSubagentInstructionsSchema', () => {
    it('should validate correct instructions', () => {
      const instructions = createValidInstructions();
      const result = TemporalSubagentInstructionsSchema.safeParse(instructions);

      expect(result.success).toBe(true);
    });

    it('should reject instructions with Task tool', () => {
      const instructions = createValidInstructions({
        tools: [...TEMPORAL_SUBAGENT_TOOLS, 'Task'],
      });
      const result = TemporalSubagentInstructionsSchema.safeParse(instructions);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('Task');
      }
    });

    it('should reject empty tools array', () => {
      const instructions = createValidInstructions({
        tools: [],
      });
      const result = TemporalSubagentInstructionsSchema.safeParse(instructions);

      expect(result.success).toBe(false);
    });

    it('should reject invalid name format', () => {
      const instructions = createValidInstructions({
        name: 'Invalid Name With Spaces',
      });
      const result = TemporalSubagentInstructionsSchema.safeParse(instructions);

      expect(result.success).toBe(false);
    });

    it('should accept valid model values', () => {
      for (const model of ['sonnet', 'opus', 'haiku', 'inherit'] as const) {
        const instructions = createValidInstructions({ model });
        const result = TemporalSubagentInstructionsSchema.safeParse(instructions);

        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid model values', () => {
      const instructions = createValidInstructions({
        model: 'gpt-4' as 'sonnet', // invalid
      });
      const result = TemporalSubagentInstructionsSchema.safeParse(instructions);

      expect(result.success).toBe(false);
    });

    it('should validate priority range', () => {
      // Valid range: 1-100
      const validLow = createValidInstructions({ priority: 1 });
      const validHigh = createValidInstructions({ priority: 100 });
      const invalidLow = createValidInstructions({ priority: 0 });
      const invalidHigh = createValidInstructions({ priority: 101 });

      expect(TemporalSubagentInstructionsSchema.safeParse(validLow).success).toBe(true);
      expect(TemporalSubagentInstructionsSchema.safeParse(validHigh).success).toBe(true);
      expect(TemporalSubagentInstructionsSchema.safeParse(invalidLow).success).toBe(false);
      expect(TemporalSubagentInstructionsSchema.safeParse(invalidHigh).success).toBe(false);
    });
  });

  describe('toAgentDefinition', () => {
    it('should convert instructions to AgentDefinition', () => {
      const instructions = createValidInstructions();
      const definition = toAgentDefinition(instructions);

      expect(definition.description).toBe(instructions.description);
      expect(definition.prompt).toBe(instructions.prompt);
      expect(definition.tools).toEqual([...instructions.tools]);
    });

    it('should include model when not inherit', () => {
      const instructions = createValidInstructions({ model: 'opus' });
      const definition = toAgentDefinition(instructions);

      expect(definition.model).toBe('opus');
    });

    it('should omit model when inherit', () => {
      const instructions = createValidInstructions({ model: 'inherit' });
      const definition = toAgentDefinition(instructions);

      expect(definition.model).toBeUndefined();
    });

    it('should omit model when not specified', () => {
      const instructions = createValidInstructions();
      delete (instructions as Partial<TemporalSubagentInstructions>).model;
      const definition = toAgentDefinition(instructions);

      expect(definition.model).toBeUndefined();
    });

    it('should create independent tools array', () => {
      const instructions = createValidInstructions();
      const definition = toAgentDefinition(instructions);

      // Modify the definition's tools
      definition.tools?.push('new_tool');

      // Original instructions should be unchanged
      expect(instructions.tools).not.toContain('new_tool');
    });
  });

  describe('TemporalAnalysisContext interface', () => {
    it('should define required context fields', () => {
      // Only baselineCount, reviewCount, daysSinceLastReview are required
      const context: TemporalAnalysisContext = {
        baselineCount: 5,
        reviewCount: 3,
        daysSinceLastReview: 15,
      };

      expect(context.baselineCount).toBe(5);
      expect(context.reviewCount).toBe(3);
      expect(context.daysSinceLastReview).toBe(15);
    });

    it('should allow null daysSinceLastReview when no reviews', () => {
      const context: TemporalAnalysisContext = {
        baselineCount: 5,
        reviewCount: 0,
        daysSinceLastReview: null,
      };

      expect(context.daysSinceLastReview).toBeNull();
    });

    it('should allow optional triggerSummary', () => {
      const contextWithTrigger: TemporalAnalysisContext = {
        baselineCount: 5,
        reviewCount: 3,
        daysSinceLastReview: 45,
        reviewTriggered: true,
        triggerSummary: 'Review due: 45 days since last review',
      };

      expect(contextWithTrigger.triggerSummary).toBeDefined();
    });

    it('should allow spawn tool fields', () => {
      const context: TemporalAnalysisContext = {
        focus: 'trends',
        query: 'What are the metric trends?',
        targetBaselineId: 'baseline-001',
        comparisonBaselineId: 'baseline-002',
        dateRange: {
          start: '2026-01-01T00:00:00Z',
          end: '2026-01-15T00:00:00Z',
        },
        includeRecommendations: true,
        baselineCount: 5,
        reviewCount: 3,
        daysSinceLastReview: 15,
      };

      expect(context.focus).toBe('trends');
      expect(context.query).toBe('What are the metric trends?');
      expect(context.targetBaselineId).toBe('baseline-001');
      expect(context.comparisonBaselineId).toBe('baseline-002');
      expect(context.dateRange?.start).toBe('2026-01-01T00:00:00Z');
      expect(context.includeRecommendations).toBe(true);
    });
  });

  describe('TemporalAnalysisResult interface', () => {
    it('should define successful result', () => {
      const result: TemporalAnalysisResult = {
        success: true,
        summary: 'Workflow metrics improving steadily over past 3 weeks.',
        trends: [
          {
            name: 'findingsCount',
            interpretation: 'Decreasing trend indicates improving code quality',
            confidence: 'high',
          },
        ],
        recommendations: [
          {
            action: 'Continue current practices',
            rationale: 'Metrics trending positively',
            priority: 'low',
          },
        ],
        reviewRecommended: false,
      };

      expect(result.success).toBe(true);
      expect(result.trends?.length).toBe(1);
      expect(result.recommendations?.length).toBe(1);
      expect(result.reviewRecommended).toBe(false);
    });

    it('should define failed result', () => {
      const result: TemporalAnalysisResult = {
        success: false,
        summary: 'Analysis could not be completed.',
        reviewRecommended: false,
        error: 'Insufficient baseline data for trend analysis',
      };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should define review-recommended result', () => {
      const result: TemporalAnalysisResult = {
        success: true,
        summary: 'Significant trend changes detected.',
        reviewRecommended: true,
        reviewReason: 'Major inflection point detected in perceived friction',
      };

      expect(result.reviewRecommended).toBe(true);
      expect(result.reviewReason).toBeDefined();
    });
  });
});
