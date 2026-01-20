/**
 * Unit tests for recommendations/subagent/recommendation-advisor.ts
 *
 * Tests the Recommendation Advisor subagent definition, prompt structure,
 * and builder functions following EP08/EP09 patterns.
 *
 * @module recommendations/__tests__/subagent.test
 */

import { describe, it, expect } from 'bun:test';

import {
  recommendationAdvisorInstructions,
  buildRecommendationAdvisorAgent,
  buildRecommendationSubagents,
} from '../subagent/recommendation-advisor';
import { RECOMMENDATION_ADVISOR_TOOLS } from '../subagent/types';

// =============================================================================
// Tests
// =============================================================================

describe('recommendations/subagent/recommendation-advisor', () => {
  describe('recommendationAdvisorInstructions', () => {
    it('should have correct name', () => {
      expect(recommendationAdvisorInstructions.name).toBe('recommendation-advisor');
    });

    it('should have meaningful description', () => {
      expect(recommendationAdvisorInstructions.description).toContain('recommendation');
      expect(recommendationAdvisorInstructions.description).toContain('findings');
    });

    it('should include all recommendation advisor tools', () => {
      for (const tool of RECOMMENDATION_ADVISOR_TOOLS) {
        expect(recommendationAdvisorInstructions.tools).toContain(tool);
      }
    });

    it('should NOT include Task tool (C8 single-depth constraint)', () => {
      expect(recommendationAdvisorInstructions.tools).not.toContain('Task');
    });

    it('should have a comprehensive system prompt', () => {
      const prompt = recommendationAdvisorInstructions.prompt;

      // Check for key sections per 4-layer structure
      expect(prompt).toContain('ROLE IDENTITY');
      expect(prompt).toContain('DOMAIN KNOWLEDGE');
      expect(prompt).toContain('YOUR TASK');
      expect(prompt).toContain('OUTPUT FORMAT');
    });

    it('should reference Constitution in prompt', () => {
      expect(recommendationAdvisorInstructions.prompt).toContain('Constitution');
    });

    it('should explain recommendation types in prompt', () => {
      const prompt = recommendationAdvisorInstructions.prompt;

      expect(prompt).toContain('symptomatic');
      expect(prompt).toContain('preventive');
      expect(prompt).toContain('systemic');
    });

    it('should explain priority levels in prompt', () => {
      const prompt = recommendationAdvisorInstructions.prompt;

      expect(prompt).toContain('high');
      expect(prompt).toContain('medium');
      expect(prompt).toContain('low');
    });

    it('should have appropriate priority', () => {
      expect(recommendationAdvisorInstructions.priority).toBeGreaterThan(0);
      expect(recommendationAdvisorInstructions.priority).toBeLessThanOrEqual(100);
    });

    it('should have prompt under 50KB (NFR-005)', () => {
      const promptBytes = new TextEncoder().encode(recommendationAdvisorInstructions.prompt).length;
      expect(promptBytes).toBeLessThan(50 * 1024);
    });
  });

  describe('prompt content', () => {
    const prompt = recommendationAdvisorInstructions.prompt;

    it('should explain traced origins', () => {
      expect(prompt).toContain('tracedOrigin');
    });

    it('should explain causal-first approach', () => {
      expect(prompt).toContain('causal');
    });

    it('should list available tools', () => {
      expect(prompt).toContain('create_recommendation');
      expect(prompt).toContain('add_recommendation_event');
      expect(prompt).toContain('list_recommendations');
    });

    it('should provide guidance on prioritization', () => {
      expect(prompt).toContain('compounding');
    });

    it('should mention clarifying questions', () => {
      expect(prompt).toContain('clarifying');
    });

    it('should emphasize agent judgment role', () => {
      expect(prompt).toContain('judgment');
    });
  });

  describe('buildRecommendationAdvisorAgent', () => {
    it('should return valid AgentDefinition', () => {
      const agent = buildRecommendationAdvisorAgent();

      expect(agent.description).toBe(recommendationAdvisorInstructions.description);
      expect(agent.prompt).toBe(recommendationAdvisorInstructions.prompt);
      expect(agent.tools).toEqual([...recommendationAdvisorInstructions.tools]);
    });

    it('should not include model override by default (inherit)', () => {
      const agent = buildRecommendationAdvisorAgent();

      expect(agent.model).toBeUndefined();
    });
  });

  describe('buildRecommendationSubagents', () => {
    it('should return subagent with correct name', () => {
      const subagents = buildRecommendationSubagents();

      expect(Object.keys(subagents)).toContain('recommendation-advisor');
    });

    it('should return at least 1 subagent', () => {
      const subagents = buildRecommendationSubagents();

      expect(Object.keys(subagents).length).toBeGreaterThanOrEqual(1);
    });

    it('should match individual builder output', () => {
      const subagents = buildRecommendationSubagents();

      expect(subagents['recommendation-advisor']).toEqual(buildRecommendationAdvisorAgent());
    });
  });
});
