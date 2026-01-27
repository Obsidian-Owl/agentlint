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
import { getClaudeCodeInstructions } from '../../../src/act/instructions/claude-code.js';
import { getGeneralizedInstructions } from '../../../src/act/instructions/generalized.js';

describe('getClaudeCodeInstructions', () => {
  // T017: Unit test for claudeCodeInstructions schema validation
  describe('schema validation', () => {
    it('should validate against ACTInstructionsSchema', () => {
      const result = ACTInstructionsSchema.safeParse(getClaudeCodeInstructions());
      expect(result.success).toBe(true);
    });

    it('should have valid name format (lowercase alphanumeric with hyphens)', () => {
      expect(getClaudeCodeInstructions().name).toMatch(/^[a-z0-9-]+$/);
    });

    it('should have non-empty displayName', () => {
      expect(getClaudeCodeInstructions().displayName.length).toBeGreaterThan(0);
    });

    it('should have non-empty description', () => {
      expect(getClaudeCodeInstructions().description.length).toBeGreaterThan(0);
    });

    it('should have non-empty prompt', () => {
      expect(getClaudeCodeInstructions().prompt.length).toBeGreaterThan(0);
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
        expect(getClaudeCodeInstructions().tools).toContain(tool);
      }
    });

    it('should have exactly 5 tools (DEFAULT_ACT_TOOLS)', () => {
      expect(getClaudeCodeInstructions().tools).toHaveLength(5);
      expect(getClaudeCodeInstructions().tools).toEqual([...DEFAULT_ACT_TOOLS]);
    });

    it('should NOT include Task tool (single-depth constraint)', () => {
      expect(getClaudeCodeInstructions().tools).not.toContain('Task');
    });
  });

  // T019: Unit test for Claude Code actTypes and priority
  describe('actTypes and priority', () => {
    it("should have actTypes: ['claude-code']", () => {
      expect(getClaudeCodeInstructions().actTypes).toEqual(['claude-code']);
    });

    it('should have priority: 100 (highest)', () => {
      expect(getClaudeCodeInstructions().priority).toBe(100);
    });
  });

  // T022: Verify prompt size < 50KB (NFR-002)
  describe('prompt size (NFR-002)', () => {
    it('should have prompt size under 50KB', () => {
      const promptBytes = new TextEncoder().encode(getClaudeCodeInstructions().prompt).length;
      const maxBytes = 50 * 1024; // 50KB

      expect(promptBytes).toBeLessThan(maxBytes);
    });

    it('should have prompt size logged for documentation', () => {
      const promptBytes = new TextEncoder().encode(getClaudeCodeInstructions().prompt).length;
      expect(promptBytes).toBeLessThan(10 * 1024); // Should be under 10KB
    });
  });

  // Context engineering structure tests
  describe('prompt structure', () => {
    it('should contain ROLE IDENTITY section', () => {
      expect(getClaudeCodeInstructions().prompt).toContain('## ROLE IDENTITY');
    });

    it('should contain DOMAIN KNOWLEDGE section', () => {
      expect(getClaudeCodeInstructions().prompt).toContain('## DOMAIN KNOWLEDGE');
    });

    it('should contain YOUR TASK section', () => {
      expect(getClaudeCodeInstructions().prompt).toContain('## YOUR TASK');
    });

    it('should contain TOOLS AVAILABLE section', () => {
      expect(getClaudeCodeInstructions().prompt).toContain('## TOOLS AVAILABLE');
    });

    it('should contain OUTPUT FORMAT section', () => {
      expect(getClaudeCodeInstructions().prompt).toContain('## OUTPUT FORMAT');
    });
  });
});

// T023-T024: Generalized analyzer instruction tests
describe('getGeneralizedInstructions', () => {
  // T023: Unit test for generalizedInstructions schema validation
  describe('schema validation', () => {
    it('should validate against ACTInstructionsSchema', () => {
      const result = ACTInstructionsSchema.safeParse(getGeneralizedInstructions());
      expect(result.success).toBe(true);
    });

    it('should have valid name format (lowercase alphanumeric with hyphens)', () => {
      expect(getGeneralizedInstructions().name).toMatch(/^[a-z0-9-]+$/);
    });

    it('should have non-empty displayName', () => {
      expect(getGeneralizedInstructions().displayName.length).toBeGreaterThan(0);
    });

    it('should have non-empty description', () => {
      expect(getGeneralizedInstructions().description.length).toBeGreaterThan(0);
    });

    it('should have non-empty prompt', () => {
      expect(getGeneralizedInstructions().prompt.length).toBeGreaterThan(0);
    });
  });

  // T024: Unit test for Generalized actTypes and priority
  describe('actTypes and priority', () => {
    it("should have actTypes: ['agents-md', 'unknown']", () => {
      expect(getGeneralizedInstructions().actTypes).toEqual(['agents-md', 'unknown']);
    });

    it('should have priority: 10 (fallback)', () => {
      expect(getGeneralizedInstructions().priority).toBe(10);
    });
  });

  // T027: Unit test for GENERALIZED_ACT_TOOLS
  describe('tools', () => {
    it('should use only GENERALIZED_ACT_TOOLS subset', () => {
      expect(getGeneralizedInstructions().tools).toEqual([...GENERALIZED_ACT_TOOLS]);
    });

    it('should have exactly 2 tools (discover_configs, parse_config)', () => {
      expect(getGeneralizedInstructions().tools).toHaveLength(2);
      expect(getGeneralizedInstructions().tools).toContain('discover_configs');
      expect(getGeneralizedInstructions().tools).toContain('parse_config');
    });

    it('should NOT include session analysis tools', () => {
      expect(getGeneralizedInstructions().tools).not.toContain('search_sessions');
      expect(getGeneralizedInstructions().tools).not.toContain('get_session_stats');
      expect(getGeneralizedInstructions().tools).not.toContain('analyze_hierarchy');
    });

    it('should NOT include Task tool (single-depth constraint)', () => {
      expect(getGeneralizedInstructions().tools).not.toContain('Task');
    });
  });

  // Prompt size test (NFR-002)
  describe('prompt size (NFR-002)', () => {
    it('should have prompt size under 50KB', () => {
      const promptBytes = new TextEncoder().encode(getGeneralizedInstructions().prompt).length;
      const maxBytes = 50 * 1024; // 50KB

      expect(promptBytes).toBeLessThan(maxBytes);
    });

    it('should have prompt size logged for documentation', () => {
      const promptBytes = new TextEncoder().encode(getGeneralizedInstructions().prompt).length;
      expect(promptBytes).toBeLessThan(10 * 1024); // Should be under 10KB
    });
  });

  // Context engineering structure tests
  describe('prompt structure', () => {
    it('should contain ROLE IDENTITY section', () => {
      expect(getGeneralizedInstructions().prompt).toContain('## ROLE IDENTITY');
    });

    it('should contain DOMAIN KNOWLEDGE section', () => {
      expect(getGeneralizedInstructions().prompt).toContain('## DOMAIN KNOWLEDGE');
    });

    it('should contain YOUR TASK section', () => {
      expect(getGeneralizedInstructions().prompt).toContain('## YOUR TASK');
    });

    it('should contain TOOLS AVAILABLE section', () => {
      expect(getGeneralizedInstructions().prompt).toContain('## TOOLS AVAILABLE');
    });

    it('should contain OUTPUT FORMAT section', () => {
      expect(getGeneralizedInstructions().prompt).toContain('## OUTPUT FORMAT');
    });

    it('should contain IMPORTANT NOTES section', () => {
      expect(getGeneralizedInstructions().prompt).toContain('## IMPORTANT NOTES');
    });
  });
});
