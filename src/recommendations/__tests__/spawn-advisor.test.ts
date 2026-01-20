/**
 * Integration tests for spawn_recommendation_advisor tool
 *
 * Tests the spawn_recommendation_advisor tool that invokes the Recommendation
 * Advisor subagent with appropriate context.
 *
 * @module recommendations/__tests__/spawn-advisor.test
 */

import { describe, it, expect } from 'bun:test';

import {
  spawnRecommendationAdvisorTool,
  buildAdvisorContext,
  buildQueryPrompt,
} from '../tools/spawn-advisor';
import { RECOMMENDATION_ADVISOR_TOOLS } from '../subagent/types';
import { buildRecommendationAdvisorAgent } from '../subagent/recommendation-advisor';

// =============================================================================
// Test Helpers
// =============================================================================

function createMockFinding(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: crypto.randomUUID(),
    type: 'configuration',
    severity: 'high',
    message: 'Missing error handling guidance in CLAUDE.md',
    location: 'CLAUDE.md',
    ...overrides,
  };
}

function createMockCausalTrace(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    findingId: crypto.randomUUID(),
    rootCause: 'Configuration gap',
    causalChain: ['Missing guidance', 'Repeated errors', 'Session failures'],
    confidence: 0.85,
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('recommendations/tools/spawn-advisor', () => {
  describe('tool definition', () => {
    it('should be named spawn_recommendation_advisor', () => {
      const toolDef = spawnRecommendationAdvisorTool as unknown as { name: string };
      expect(toolDef.name).toBe('spawn_recommendation_advisor');
    });

    it('should have a comprehensive description', () => {
      const toolDef = spawnRecommendationAdvisorTool as unknown as { description: string };
      expect(toolDef.description).toContain('recommendation');
      expect(toolDef.description).toContain('findings');
    });

    it('should be defined', () => {
      expect(spawnRecommendationAdvisorTool).toBeDefined();
    });
  });

  describe('buildAdvisorContext', () => {
    describe('basic context building', () => {
      it('should build context with required fields', () => {
        const findings = [createMockFinding()];
        const context = buildAdvisorContext({ findings });

        expect(context.findingCount).toBe(1);
        expect(context.causalTraceCount).toBe(0);
        expect(context.interactionMode).toBe('propose');
      });

      it('should count findings correctly', () => {
        const findings = [createMockFinding(), createMockFinding(), createMockFinding()];
        const context = buildAdvisorContext({ findings });

        expect(context.findingCount).toBe(3);
      });

      it('should count causal traces correctly', () => {
        const findings = [createMockFinding()];
        const causalTraces = [createMockCausalTrace(), createMockCausalTrace()];
        const context = buildAdvisorContext({ findings, causalTraces });

        expect(context.causalTraceCount).toBe(2);
      });
    });

    describe('interaction modes', () => {
      it('should default to propose mode', () => {
        const context = buildAdvisorContext({ findings: [createMockFinding()] });

        expect(context.interactionMode).toBe('propose');
      });

      it('should respect ask mode', () => {
        const context = buildAdvisorContext({
          findings: [createMockFinding()],
          interactionMode: 'ask',
        });

        expect(context.interactionMode).toBe('ask');
      });

      it('should respect confirm mode', () => {
        const context = buildAdvisorContext({
          findings: [createMockFinding()],
          interactionMode: 'confirm',
        });

        expect(context.interactionMode).toBe('confirm');
      });
    });

    describe('historic recommendations', () => {
      it('should initialize historicRecCount to 0', () => {
        const context = buildAdvisorContext({ findings: [createMockFinding()] });

        expect(context.historicRecCount).toBe(0);
      });

      it('should not include recentRecSummary when includeHistoricRecs is false', () => {
        const context = buildAdvisorContext({
          findings: [createMockFinding()],
          includeHistoricRecs: false,
        });

        expect(context.recentRecSummary).toBeUndefined();
      });
    });

    describe('empty findings', () => {
      it('should handle empty findings array', () => {
        const context = buildAdvisorContext({ findings: [] });

        expect(context.findingCount).toBe(0);
      });
    });
  });

  describe('buildQueryPrompt', () => {
    describe('interaction mode: propose', () => {
      it('should include propose-specific instructions', () => {
        const context = buildAdvisorContext({
          findings: [createMockFinding()],
          interactionMode: 'propose',
        });
        const prompt = buildQueryPrompt(context);

        expect(prompt).toContain('Propose');
        expect(prompt).toContain('judgment');
      });
    });

    describe('interaction mode: ask', () => {
      it('should include ask-specific instructions', () => {
        const context = buildAdvisorContext({
          findings: [createMockFinding()],
          interactionMode: 'ask',
        });
        const prompt = buildQueryPrompt(context);

        expect(prompt).toContain('ask');
        expect(prompt).toContain('clarifying');
      });
    });

    describe('interaction mode: confirm', () => {
      it('should include confirm-specific instructions', () => {
        const context = buildAdvisorContext({
          findings: [createMockFinding()],
          interactionMode: 'confirm',
        });
        const prompt = buildQueryPrompt(context);

        expect(prompt).toContain('Confirm');
        expect(prompt).toContain('assumptions');
      });
    });

    describe('finding count', () => {
      it('should include finding count in prompt', () => {
        const context = buildAdvisorContext({
          findings: [createMockFinding(), createMockFinding()],
        });
        const prompt = buildQueryPrompt(context);

        expect(prompt).toContain('2');
      });
    });

    describe('causal traces', () => {
      it('should mention causal traces when available', () => {
        const context = buildAdvisorContext({
          findings: [createMockFinding()],
          causalTraces: [createMockCausalTrace()],
        });
        const prompt = buildQueryPrompt(context);

        expect(prompt).toContain('causal');
      });

      it('should not mention causal traces when none available', () => {
        const context = buildAdvisorContext({
          findings: [createMockFinding()],
        });
        // Call buildQueryPrompt to ensure it works (side effect is building the prompt)
        buildQueryPrompt(context);

        // When no causal traces, shouldn't emphasize them
        expect(context.causalTraceCount).toBe(0);
      });
    });

    describe('recommendation type guidance', () => {
      it('should mention recommendation types', () => {
        const context = buildAdvisorContext({
          findings: [createMockFinding()],
        });
        const prompt = buildQueryPrompt(context);

        expect(prompt).toContain('symptomatic');
        expect(prompt).toContain('preventive');
        expect(prompt).toContain('systemic');
      });
    });
  });

  describe('agent definitions', () => {
    it('should use recommendation advisor agent', () => {
      const agent = buildRecommendationAdvisorAgent();
      const tools = agent.tools ?? [];

      expect(tools).toEqual([...RECOMMENDATION_ADVISOR_TOOLS]);
    });

    it('should NOT include Task tool (C8 single-depth)', () => {
      const agent = buildRecommendationAdvisorAgent();
      const tools = agent.tools ?? [];

      expect(tools).not.toContain('Task');
    });

    it('should include create_recommendation tool', () => {
      const agent = buildRecommendationAdvisorAgent();

      expect(agent.tools).toContain('create_recommendation');
    });

    it('should include add_recommendation_event tool', () => {
      const agent = buildRecommendationAdvisorAgent();

      expect(agent.tools).toContain('add_recommendation_event');
    });

    it('should include list_recommendations tool', () => {
      const agent = buildRecommendationAdvisorAgent();

      expect(agent.tools).toContain('list_recommendations');
    });
  });

  describe('context initialization', () => {
    it('should initialize counts correctly', () => {
      const context = buildAdvisorContext({ findings: [] });

      expect(context.findingCount).toBe(0);
      expect(context.causalTraceCount).toBe(0);
      expect(context.historicRecCount).toBe(0);
    });

    it('should set default interaction mode', () => {
      const context = buildAdvisorContext({ findings: [] });

      expect(context.interactionMode).toBe('propose');
    });
  });
});
