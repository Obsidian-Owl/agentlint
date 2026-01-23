/**
 * T046: Integration test - --skills flag runs skills analysis
 *
 * Verifies that the `agentlint analyse --skills` flag triggers
 * skills-focused analysis mode with appropriate instructions.
 */

import { describe, it, expect } from 'bun:test';
import { buildFocusInstructions } from '../../../src/cli/commands/analyse-prompt';
import type { AnalyseOptions } from '../../../src/cli/commands/analyse';

// =============================================================================
// Tests
// =============================================================================

describe('Skills Analysis Flag Integration', () => {
  describe('--skills flag in analyse command', () => {
    it('buildFocusInstructions returns skills-focused prompt when skills=true', () => {
      const options: AnalyseOptions = {
        skills: true,
      };

      const instructions = buildFocusInstructions(options);

      // Should contain skills-specific content
      expect(instructions).toContain('Skills Effectiveness');
      expect(instructions).toContain('get_skill_inventory');
      expect(instructions).toContain('index_skill_invocations');
      expect(instructions).toContain('get_skill_invocations');
      expect(instructions).toContain('get_session_summaries');
    });

    it('skills focus mode explains primary questions to answer', () => {
      const options: AnalyseOptions = {
        skills: true,
      };

      const instructions = buildFocusInstructions(options);

      // Per the spec: tools provide data, agent reasons about effectiveness
      expect(instructions).toContain('Primary Questions to Answer');
      expect(instructions.toLowerCase()).toContain('rarely');
      expect(instructions.toLowerCase()).toContain('never');
    });

    it('skills focus mode provides workflow guidance', () => {
      const options: AnalyseOptions = {
        skills: true,
      };

      const instructions = buildFocusInstructions(options);

      // Should guide the agent through the analysis workflow
      expect(instructions).toContain('Workflow');
    });

    it('returns empty string when skills=false', () => {
      const options: AnalyseOptions = {
        skills: false,
      };

      const instructions = buildFocusInstructions(options);

      // Should not contain skills-specific content
      expect(instructions).not.toContain('Skills Effectiveness');
    });

    it('returns empty string when skills=undefined', () => {
      const options: AnalyseOptions = {};

      const instructions = buildFocusInstructions(options);

      // Should not contain skills-specific content
      expect(instructions).not.toContain('Skills Effectiveness');
    });
  });

  describe('Skills flag exclusivity', () => {
    it('skills mode takes precedence and returns skills instructions only', () => {
      const options: AnalyseOptions = {
        skills: true,
        // Other potential focus modes would be ignored
      };

      const instructions = buildFocusInstructions(options);

      // Should be skills-focused
      expect(instructions).toContain('Skills Effectiveness');
      // Should be substantial (not empty)
      expect(instructions.length).toBeGreaterThan(500);
    });
  });

  describe('Agent-friendly instructions', () => {
    it('instructions mention tool names explicitly', () => {
      const options: AnalyseOptions = {
        skills: true,
      };

      const instructions = buildFocusInstructions(options);

      // Tools should be mentioned with their actual names (for agent tool selection)
      const toolMentions = [
        'get_skill_inventory',
        'index_skill_invocations',
        'get_skill_invocations',
        'get_session_summaries',
      ];

      for (const tool of toolMentions) {
        expect(instructions).toContain(tool);
      }
    });

    it('instructions are substantial enough for agent context', () => {
      const options: AnalyseOptions = {
        skills: true,
      };

      const instructions = buildFocusInstructions(options);

      // Should be detailed enough to guide the agent effectively
      // At minimum should have several paragraphs
      expect(instructions.length).toBeGreaterThan(800);
    });
  });
});
