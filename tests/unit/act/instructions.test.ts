/**
 * Tests for ACT Instructions
 *
 * T017-T019: Claude Code analyzer instruction tests
 * T023-T024: Generalized analyzer instruction tests (added in Phase 5)
 *
 * @module tests/unit/act/instructions.test
 */

import { describe, it, expect } from 'bun:test';
import {
  ACTInstructionsSchema,
  DEFAULT_ACT_TOOLS,
  GENERALIZED_ACT_TOOLS,
} from '../../../src/act/types.js';
import { claudeCodeInstructions } from '../../../src/act/instructions/claude-code.js';
import { generalizedInstructions } from '../../../src/act/instructions/generalized.js';

describe('claudeCodeInstructions', () => {
  // T017: Unit test for claudeCodeInstructions schema validation
  describe('schema validation', () => {
    it('should validate against ACTInstructionsSchema', () => {
      const result = ACTInstructionsSchema.safeParse(claudeCodeInstructions);
      expect(result.success).toBe(true);
    });

    it('should have valid name format (lowercase alphanumeric with hyphens)', () => {
      expect(claudeCodeInstructions.name).toMatch(/^[a-z0-9-]+$/);
    });

    it('should have non-empty displayName', () => {
      expect(claudeCodeInstructions.displayName.length).toBeGreaterThan(0);
    });

    it('should have non-empty description', () => {
      expect(claudeCodeInstructions.description.length).toBeGreaterThan(0);
    });

    it('should have non-empty prompt', () => {
      expect(claudeCodeInstructions.prompt.length).toBeGreaterThan(0);
    });
  });

  // T018: Unit test for Claude Code tools list
  describe('tools', () => {
    it('should include all 5 default tools', () => {
      const expectedTools = [
        'discover_configs',
        'parse_config',
        'analyze_hierarchy',
        'search_sessions',
        'get_session_stats',
      ];

      for (const tool of expectedTools) {
        expect(claudeCodeInstructions.tools).toContain(tool);
      }
    });

    it('should have exactly 5 tools (DEFAULT_ACT_TOOLS)', () => {
      expect(claudeCodeInstructions.tools).toHaveLength(5);
      expect(claudeCodeInstructions.tools).toEqual([...DEFAULT_ACT_TOOLS]);
    });

    it('should NOT include Task tool (single-depth constraint)', () => {
      expect(claudeCodeInstructions.tools).not.toContain('Task');
    });
  });

  // T019: Unit test for Claude Code actTypes and priority
  describe('actTypes and priority', () => {
    it("should have actTypes: ['claude-code']", () => {
      expect(claudeCodeInstructions.actTypes).toEqual(['claude-code']);
    });

    it('should have priority: 100 (highest)', () => {
      expect(claudeCodeInstructions.priority).toBe(100);
    });
  });

  // T022: Verify prompt size < 50KB (NFR-002)
  describe('prompt size (NFR-002)', () => {
    it('should have prompt size under 50KB', () => {
      const promptBytes = new TextEncoder().encode(claudeCodeInstructions.prompt).length;
      const maxBytes = 50 * 1024; // 50KB

      expect(promptBytes).toBeLessThan(maxBytes);
    });

    it('should have prompt size logged for documentation', () => {
      const promptBytes = new TextEncoder().encode(claudeCodeInstructions.prompt).length;
      // This test documents the actual size for reference
      // Currently ~7.2KB which is well under 50KB limit
      expect(promptBytes).toBeLessThan(10 * 1024); // Should be under 10KB
    });
  });

  // Context engineering structure tests
  describe('prompt structure', () => {
    it('should contain ROLE IDENTITY section', () => {
      expect(claudeCodeInstructions.prompt).toContain('## ROLE IDENTITY');
    });

    it('should contain DOMAIN KNOWLEDGE section', () => {
      expect(claudeCodeInstructions.prompt).toContain('## DOMAIN KNOWLEDGE');
    });

    it('should contain YOUR TASK section', () => {
      expect(claudeCodeInstructions.prompt).toContain('## YOUR TASK');
    });

    it('should contain TOOLS AVAILABLE section', () => {
      expect(claudeCodeInstructions.prompt).toContain('## TOOLS AVAILABLE');
    });

    it('should contain OUTPUT FORMAT section', () => {
      expect(claudeCodeInstructions.prompt).toContain('## OUTPUT FORMAT');
    });
  });
});

// T023-T024: Generalized analyzer instruction tests
describe('generalizedInstructions', () => {
  // T023: Unit test for generalizedInstructions schema validation
  describe('schema validation', () => {
    it('should validate against ACTInstructionsSchema', () => {
      const result = ACTInstructionsSchema.safeParse(generalizedInstructions);
      expect(result.success).toBe(true);
    });

    it('should have valid name format (lowercase alphanumeric with hyphens)', () => {
      expect(generalizedInstructions.name).toMatch(/^[a-z0-9-]+$/);
    });

    it('should have non-empty displayName', () => {
      expect(generalizedInstructions.displayName.length).toBeGreaterThan(0);
    });

    it('should have non-empty description', () => {
      expect(generalizedInstructions.description.length).toBeGreaterThan(0);
    });

    it('should have non-empty prompt', () => {
      expect(generalizedInstructions.prompt.length).toBeGreaterThan(0);
    });
  });

  // T024: Unit test for Generalized actTypes and priority
  describe('actTypes and priority', () => {
    it("should have actTypes: ['agents-md', 'unknown']", () => {
      expect(generalizedInstructions.actTypes).toEqual(['agents-md', 'unknown']);
    });

    it('should have priority: 10 (fallback)', () => {
      expect(generalizedInstructions.priority).toBe(10);
    });
  });

  // T027: Unit test for GENERALIZED_ACT_TOOLS
  describe('tools', () => {
    it('should use only GENERALIZED_ACT_TOOLS subset', () => {
      expect(generalizedInstructions.tools).toEqual([...GENERALIZED_ACT_TOOLS]);
    });

    it('should have exactly 2 tools (discover_configs, parse_config)', () => {
      expect(generalizedInstructions.tools).toHaveLength(2);
      expect(generalizedInstructions.tools).toContain('discover_configs');
      expect(generalizedInstructions.tools).toContain('parse_config');
    });

    it('should NOT include session analysis tools', () => {
      expect(generalizedInstructions.tools).not.toContain('search_sessions');
      expect(generalizedInstructions.tools).not.toContain('get_session_stats');
      expect(generalizedInstructions.tools).not.toContain('analyze_hierarchy');
    });

    it('should NOT include Task tool (single-depth constraint)', () => {
      expect(generalizedInstructions.tools).not.toContain('Task');
    });
  });

  // Prompt size test (NFR-002)
  describe('prompt size (NFR-002)', () => {
    it('should have prompt size under 50KB', () => {
      const promptBytes = new TextEncoder().encode(generalizedInstructions.prompt).length;
      const maxBytes = 50 * 1024; // 50KB

      expect(promptBytes).toBeLessThan(maxBytes);
    });

    it('should have prompt size logged for documentation', () => {
      const promptBytes = new TextEncoder().encode(generalizedInstructions.prompt).length;
      // This test documents the actual size for reference
      // Currently ~5.1KB which is well under 50KB limit
      expect(promptBytes).toBeLessThan(10 * 1024); // Should be under 10KB
    });
  });

  // Context engineering structure tests
  describe('prompt structure', () => {
    it('should contain ROLE IDENTITY section', () => {
      expect(generalizedInstructions.prompt).toContain('## ROLE IDENTITY');
    });

    it('should contain DOMAIN KNOWLEDGE section', () => {
      expect(generalizedInstructions.prompt).toContain('## DOMAIN KNOWLEDGE');
    });

    it('should contain YOUR TASK section', () => {
      expect(generalizedInstructions.prompt).toContain('## YOUR TASK');
    });

    it('should contain TOOLS AVAILABLE section', () => {
      expect(generalizedInstructions.prompt).toContain('## TOOLS AVAILABLE');
    });

    it('should contain OUTPUT FORMAT section', () => {
      expect(generalizedInstructions.prompt).toContain('## OUTPUT FORMAT');
    });

    it('should contain IMPORTANT NOTES section', () => {
      expect(generalizedInstructions.prompt).toContain('## IMPORTANT NOTES');
    });
  });
});
