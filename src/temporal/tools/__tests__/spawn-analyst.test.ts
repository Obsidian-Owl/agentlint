/**
 * Unit tests for temporal/tools/spawn-analyst.ts
 *
 * Tests the spawn_temporal_analyst tool implementation.
 *
 * @module temporal/tools/__tests__/spawn-analyst.test
 */

import { describe, it, expect } from 'bun:test';

import { spawnTemporalAnalystTool, buildAnalysisContext, buildQueryPrompt } from '../spawn-analyst';
import { TEMPORAL_SUBAGENT_TOOLS, TEMPORAL_READONLY_TOOLS } from '../../subagent/types';
import { buildTemporalAnalyzerAgent, buildTemporalAnalyzerReadonlyAgent } from '../../subagent';

// =============================================================================
// Tests
// =============================================================================

describe('temporal/tools/spawn-analyst', () => {
  describe('tool definition', () => {
    it('should be named spawn_temporal_analyst', () => {
      const toolDef = spawnTemporalAnalystTool as unknown as { name: string };
      expect(toolDef.name).toBe('spawn_temporal_analyst');
    });

    it('should have a comprehensive description', () => {
      const toolDef = spawnTemporalAnalystTool as unknown as { description: string };
      expect(toolDef.description).toContain('temporal analysis subagent');
      expect(toolDef.description).toContain('Focus options');
      expect(toolDef.description).toContain('trends');
      expect(toolDef.description).toContain('reviews');
      expect(toolDef.description).toContain('comparison');
      expect(toolDef.description).toContain('comprehensive');
    });

    it('should be defined', () => {
      expect(spawnTemporalAnalystTool).toBeDefined();
    });
  });

  describe('buildAnalysisContext', () => {
    describe('focus: trends', () => {
      it('should build context with trends focus', () => {
        const context = buildAnalysisContext({ focus: 'trends' });

        expect(context.focus).toBe('trends');
        expect(context.baselineCount).toBe(0);
        expect(context.reviewCount).toBe(0);
        expect(context.daysSinceLastReview).toBeNull();
      });
    });

    describe('focus: reviews', () => {
      it('should build context with reviews focus', () => {
        const context = buildAnalysisContext({ focus: 'reviews' });

        expect(context.focus).toBe('reviews');
      });
    });

    describe('focus: comparison', () => {
      it('should include baseline IDs in context', () => {
        const context = buildAnalysisContext({
          focus: 'comparison',
          baselineId: 'baseline-001',
          compareToId: 'baseline-002',
        });

        expect(context.focus).toBe('comparison');
        expect(context.targetBaselineId).toBe('baseline-001');
        expect(context.comparisonBaselineId).toBe('baseline-002');
      });
    });

    describe('focus: comprehensive', () => {
      it('should build context with comprehensive focus', () => {
        const context = buildAnalysisContext({ focus: 'comprehensive' });

        expect(context.focus).toBe('comprehensive');
      });
    });

    describe('query parameter', () => {
      it('should include user query in context', () => {
        const context = buildAnalysisContext({
          focus: 'trends',
          query: 'Why did acceptance rate drop last week?',
        });

        expect(context.query).toBe('Why did acceptance rate drop last week?');
      });
    });

    describe('timeRange parameter', () => {
      it('should handle explicit date range', () => {
        const context = buildAnalysisContext({
          focus: 'trends',
          timeRange: {
            startDate: '2026-01-01T00:00:00Z',
            endDate: '2026-01-15T00:00:00Z',
          },
        });

        expect(context.dateRange).toBeDefined();
        expect(context.dateRange?.start).toBe('2026-01-01T00:00:00.000Z');
        expect(context.dateRange?.end).toBe('2026-01-15T00:00:00.000Z');
      });

      it('should handle daysBack parameter', () => {
        const context = buildAnalysisContext({
          focus: 'trends',
          timeRange: {
            daysBack: 7,
          },
        });

        expect(context.dateRange).toBeDefined();
        // Start should be approximately 7 days ago
        const start = new Date(context.dateRange!.start);
        const now = new Date();
        const daysDiff = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        expect(daysDiff).toBeGreaterThanOrEqual(6.9);
        expect(daysDiff).toBeLessThanOrEqual(7.1);
      });

      it('should default to 30 days when timeRange provided without start', () => {
        const context = buildAnalysisContext({
          focus: 'trends',
          timeRange: {}, // Empty timeRange triggers default
        });

        expect(context.dateRange).toBeDefined();
        const start = new Date(context.dateRange!.start);
        const now = new Date();
        const daysDiff = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        expect(daysDiff).toBeGreaterThanOrEqual(29.9);
        expect(daysDiff).toBeLessThanOrEqual(30.1);
      });
    });

    describe('includeRecommendations parameter', () => {
      it('should include recommendations by default', () => {
        const context = buildAnalysisContext({ focus: 'trends' });

        expect(context.includeRecommendations).toBe(true);
      });

      it('should respect includeRecommendations=false', () => {
        const context = buildAnalysisContext({
          focus: 'trends',
          includeRecommendations: false,
        });

        expect(context.includeRecommendations).toBe(false);
      });
    });
  });

  describe('buildQueryPrompt', () => {
    describe('focus: trends', () => {
      it('should include trend-specific instructions', () => {
        const context = buildAnalysisContext({ focus: 'trends' });
        const prompt = buildQueryPrompt('trends', context);

        expect(prompt).toContain('trends');
        expect(prompt).toContain('slope');
        expect(prompt).toContain('query_trends');
      });
    });

    describe('focus: reviews', () => {
      it('should include review-specific instructions', () => {
        const context = buildAnalysisContext({ focus: 'reviews' });
        const prompt = buildQueryPrompt('reviews', context);

        expect(prompt).toContain('sentiment');
        expect(prompt).toContain('get_review_history');
      });
    });

    describe('focus: comparison', () => {
      it('should include baseline IDs in prompt', () => {
        const context = buildAnalysisContext({
          focus: 'comparison',
          baselineId: 'baseline-001',
          compareToId: 'baseline-002',
        });
        const prompt = buildQueryPrompt('comparison', context);

        expect(prompt).toContain('baseline-001');
        expect(prompt).toContain('baseline-002');
        expect(prompt).toContain('calculate_delta');
      });
    });

    describe('focus: comprehensive', () => {
      it('should include comprehensive instructions', () => {
        const context = buildAnalysisContext({ focus: 'comprehensive' });
        const prompt = buildQueryPrompt('comprehensive', context);

        expect(prompt).toContain('comprehensive');
        expect(prompt).toContain('quantitative');
        expect(prompt).toContain('qualitative');
      });
    });

    describe('user query', () => {
      it('should include user query in prompt', () => {
        const context = buildAnalysisContext({
          focus: 'trends',
          query: 'Why did acceptance rate drop?',
        });
        const prompt = buildQueryPrompt('trends', context);

        expect(prompt).toContain('User question:');
        expect(prompt).toContain('Why did acceptance rate drop?');
      });
    });

    describe('date range', () => {
      it('should include date range in prompt', () => {
        const context = buildAnalysisContext({
          focus: 'trends',
          timeRange: {
            daysBack: 14,
          },
        });
        const prompt = buildQueryPrompt('trends', context);

        expect(prompt).toContain('Time range:');
      });
    });

    describe('recommendations', () => {
      it('should include recommendations request when enabled', () => {
        const context = buildAnalysisContext({
          focus: 'trends',
          includeRecommendations: true,
        });
        const prompt = buildQueryPrompt('trends', context);

        expect(prompt).toContain('Include actionable recommendations');
      });

      it('should not include recommendations request when disabled', () => {
        const context = buildAnalysisContext({
          focus: 'trends',
          includeRecommendations: false,
        });
        const prompt = buildQueryPrompt('trends', context);

        expect(prompt).not.toContain('Include actionable recommendations');
      });
    });
  });

  describe('agent definitions', () => {
    it('should use full analyzer by default', () => {
      const agent = buildTemporalAnalyzerAgent();
      const tools = agent.tools ?? [];

      expect(tools).toEqual([...TEMPORAL_SUBAGENT_TOOLS]);
      expect(tools.length).toBe(7);
    });

    it('should use readonly analyzer when requested', () => {
      const agent = buildTemporalAnalyzerReadonlyAgent();
      const tools = agent.tools ?? [];

      expect(tools).toEqual([...TEMPORAL_READONLY_TOOLS]);
      expect(tools.length).toBe(5);
    });

    it('should have fewer tools in readonly mode', () => {
      const fullAgent = buildTemporalAnalyzerAgent();
      const readonlyAgent = buildTemporalAnalyzerReadonlyAgent();
      const fullTools = fullAgent.tools ?? [];
      const readonlyTools = readonlyAgent.tools ?? [];

      expect(readonlyTools.length).toBeLessThan(fullTools.length);
    });

    it('should include query_baseline in both modes', () => {
      const fullAgent = buildTemporalAnalyzerAgent();
      const readonlyAgent = buildTemporalAnalyzerReadonlyAgent();

      expect(fullAgent.tools).toContain('query_baseline');
      expect(readonlyAgent.tools).toContain('query_baseline');
    });

    it('should include query_trends in both modes', () => {
      const fullAgent = buildTemporalAnalyzerAgent();
      const readonlyAgent = buildTemporalAnalyzerReadonlyAgent();

      expect(fullAgent.tools).toContain('query_trends');
      expect(readonlyAgent.tools).toContain('query_trends');
    });

    it('should only include store_baseline in full mode', () => {
      const fullAgent = buildTemporalAnalyzerAgent();
      const readonlyAgent = buildTemporalAnalyzerReadonlyAgent();

      expect(fullAgent.tools).toContain('store_baseline');
      expect(readonlyAgent.tools).not.toContain('store_baseline');
    });

    it('should only include conduct_review in full mode', () => {
      const fullAgent = buildTemporalAnalyzerAgent();
      const readonlyAgent = buildTemporalAnalyzerReadonlyAgent();

      expect(fullAgent.tools).toContain('conduct_review');
      expect(readonlyAgent.tools).not.toContain('conduct_review');
    });
  });

  describe('context initialization', () => {
    it('should initialize counts to zero', () => {
      const context = buildAnalysisContext({ focus: 'trends' });

      expect(context.baselineCount).toBe(0);
      expect(context.reviewCount).toBe(0);
    });

    it('should initialize daysSinceLastReview to null', () => {
      const context = buildAnalysisContext({ focus: 'trends' });

      expect(context.daysSinceLastReview).toBeNull();
    });

    it('should allow optional triggerSummary', () => {
      const context = buildAnalysisContext({ focus: 'trends' });

      // triggerSummary should be undefined by default
      expect(context.triggerSummary).toBeUndefined();
    });
  });
});
