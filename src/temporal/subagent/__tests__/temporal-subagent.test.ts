/**
 * Unit tests for temporal/subagent/temporal-subagent.ts
 *
 * Tests the Temporal Analyzer subagent implementation.
 *
 * @module temporal/subagent/__tests__/temporal-subagent.test
 */

import { describe, it, expect } from 'bun:test';

import {
  temporalAnalyzerInstructions,
  temporalAnalyzerReadonlyInstructions,
  buildTemporalAnalyzerAgent,
  buildTemporalAnalyzerReadonlyAgent,
  buildTemporalSubagents,
} from '../temporal-subagent';
import { TEMPORAL_SUBAGENT_TOOLS, TEMPORAL_READONLY_TOOLS } from '../types';

// =============================================================================
// Tests
// =============================================================================

describe('temporal/subagent/temporal-subagent', () => {
  describe('temporalAnalyzerInstructions', () => {
    it('should have correct name', () => {
      expect(temporalAnalyzerInstructions.name).toBe('temporal-analyzer');
    });

    it('should have meaningful description', () => {
      expect(temporalAnalyzerInstructions.description).toContain('workflow trends');
      expect(temporalAnalyzerInstructions.description).toContain('qualitative reviews');
    });

    it('should include all temporal tools', () => {
      for (const tool of TEMPORAL_SUBAGENT_TOOLS) {
        expect(temporalAnalyzerInstructions.tools).toContain(tool);
      }
    });

    it('should NOT include Task tool (C8 single-depth constraint)', () => {
      expect(temporalAnalyzerInstructions.tools).not.toContain('Task');
    });

    it('should have a comprehensive system prompt', () => {
      const prompt = temporalAnalyzerInstructions.prompt;

      // Check for key sections
      expect(prompt).toContain('ROLE IDENTITY');
      expect(prompt).toContain('DOMAIN KNOWLEDGE');
      expect(prompt).toContain('YOUR TASK');
      expect(prompt).toContain('TOOLS AVAILABLE');
      expect(prompt).toContain('OUTPUT FORMAT');
    });

    it('should reference ADR-0019 in prompt', () => {
      expect(temporalAnalyzerInstructions.prompt).toContain('ADR-0019');
    });

    it('should have appropriate priority', () => {
      expect(temporalAnalyzerInstructions.priority).toBe(75);
    });

    it('should have prompt under 50KB (NFR-002)', () => {
      const promptBytes = new TextEncoder().encode(temporalAnalyzerInstructions.prompt).length;
      expect(promptBytes).toBeLessThan(50 * 1024);
    });
  });

  describe('temporalAnalyzerReadonlyInstructions', () => {
    it('should have correct name', () => {
      expect(temporalAnalyzerReadonlyInstructions.name).toBe('temporal-analyzer-readonly');
    });

    it('should include only readonly tools', () => {
      for (const tool of TEMPORAL_READONLY_TOOLS) {
        expect(temporalAnalyzerReadonlyInstructions.tools).toContain(tool);
      }
    });

    it('should NOT include write tools', () => {
      expect(temporalAnalyzerReadonlyInstructions.tools).not.toContain('store_baseline');
      expect(temporalAnalyzerReadonlyInstructions.tools).not.toContain('conduct_review');
    });

    it('should have lower priority than full analyzer', () => {
      expect(temporalAnalyzerReadonlyInstructions.priority).toBeLessThan(
        temporalAnalyzerInstructions.priority
      );
    });

    it('should share the same prompt as full analyzer', () => {
      expect(temporalAnalyzerReadonlyInstructions.prompt).toBe(temporalAnalyzerInstructions.prompt);
    });
  });

  describe('buildTemporalAnalyzerAgent', () => {
    it('should return valid AgentDefinition', () => {
      const agent = buildTemporalAnalyzerAgent();

      expect(agent.description).toBe(temporalAnalyzerInstructions.description);
      expect(agent.prompt).toBe(temporalAnalyzerInstructions.prompt);
      expect(agent.tools).toEqual([...temporalAnalyzerInstructions.tools]);
    });

    it('should not include model override (inherit by default)', () => {
      const agent = buildTemporalAnalyzerAgent();

      expect(agent.model).toBeUndefined();
    });
  });

  describe('buildTemporalAnalyzerReadonlyAgent', () => {
    it('should return valid AgentDefinition', () => {
      const agent = buildTemporalAnalyzerReadonlyAgent();

      expect(agent.description).toBe(temporalAnalyzerReadonlyInstructions.description);
      expect(agent.prompt).toBe(temporalAnalyzerReadonlyInstructions.prompt);
      expect(agent.tools).toEqual([...temporalAnalyzerReadonlyInstructions.tools]);
    });
  });

  describe('buildTemporalSubagents', () => {
    it('should return both subagents', () => {
      const subagents = buildTemporalSubagents();

      expect(Object.keys(subagents)).toContain('temporal-analyzer');
      expect(Object.keys(subagents)).toContain('temporal-analyzer-readonly');
    });

    it('should return 2 subagents total', () => {
      const subagents = buildTemporalSubagents();

      expect(Object.keys(subagents).length).toBe(2);
    });

    it('should match individual builder output', () => {
      const subagents = buildTemporalSubagents();

      expect(subagents['temporal-analyzer']).toEqual(buildTemporalAnalyzerAgent());
      expect(subagents['temporal-analyzer-readonly']).toEqual(buildTemporalAnalyzerReadonlyAgent());
    });
  });

  describe('prompt content', () => {
    const prompt = temporalAnalyzerInstructions.prompt;

    it('should explain the 6 qualitative dimensions', () => {
      expect(prompt).toContain('perceivedFriction');
      expect(prompt).toContain('trustCalibration');
      expect(prompt).toContain('taskFit');
      expect(prompt).toContain('configurationConfidence');
      expect(prompt).toContain('improvementAttribution');
      expect(prompt).toContain('workflowSatisfaction');
    });

    it('should explain signal types', () => {
      expect(prompt).toContain('Leading');
      expect(prompt).toContain('Lagging');
      expect(prompt).toContain('Qualitative');
      expect(prompt).toContain('Causal');
    });

    it('should explain trend statistics', () => {
      expect(prompt).toContain('Slope');
      expect(prompt).toContain('R²');
      expect(prompt).toContain('Volatility');
    });

    it('should provide mixed-signal interpretation guidance', () => {
      expect(prompt).toContain('Interpreting Mixed Signals');
      expect(prompt).toContain('quantitative and qualitative');
    });

    it('should list available tools', () => {
      expect(prompt).toContain('query_baseline');
      expect(prompt).toContain('list_baselines');
      expect(prompt).toContain('calculate_delta');
      expect(prompt).toContain('query_trends');
      expect(prompt).toContain('get_review_history');
    });

    it('should emphasize agent judgment role', () => {
      expect(prompt).toContain("Interpret, don't just report");
      expect(prompt).toContain('Your value is in JUDGMENT');
    });
  });
});
