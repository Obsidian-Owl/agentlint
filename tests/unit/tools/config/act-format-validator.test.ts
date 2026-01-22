/**
 * Unit tests for ACT Format Validator
 *
 * Tests the validateACTFormat() function for validating Claude Code artifact formats.
 * Covers frontmatter presence requirements for agents and skills.
 *
 * @module tests/unit/tools/config/act-format-validator.test.ts
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import type { ConfigType } from '../../../../src/tools/types';
import type { ACTFormatValidationInput, ACTFormatValidationResult } from '../../../../src/tools/config/act-format-validator';

// Lazy load to allow tests to be written first (TDD)
let validateACTFormat: (input: ACTFormatValidationInput) => ACTFormatValidationResult;

describe('validateACTFormat', () => {
  beforeAll(async () => {
    const module = await import('../../../../src/tools/config/act-format-validator');
    validateACTFormat = module.validateACTFormat;
  });

  describe('agent files (claude-agent)', () => {
    it('should detect missing frontmatter in agent files', () => {
      const result = validateACTFormat({
        configType: 'claude-agent',
        filePath: '.claude/agents/my-agent.md',
        content: '# My Agent\n\nDoes something useful.',
        hasFrontmatter: false,
      });

      expect(result.isValid).toBe(false);
      expect(result.issues.length).toBe(1);
      expect(result.issues[0]?.type).toBe('missing-frontmatter');
      expect(result.issues[0]?.severity).toBe('high');
      expect(result.issues[0]?.message).toContain('Agent');
    });

    it('should pass agent files with valid frontmatter', () => {
      const result = validateACTFormat({
        configType: 'claude-agent',
        filePath: '.claude/agents/my-agent.md',
        content: '---\nmodel: sonnet\n---\n\n# My Agent',
        frontmatter: { model: 'sonnet' },
        hasFrontmatter: true,
      });

      expect(result.isValid).toBe(true);
      expect(result.issues.length).toBe(0);
    });

    it('should pass agent files with empty frontmatter (fields are optional)', () => {
      const result = validateACTFormat({
        configType: 'claude-agent',
        filePath: '.claude/agents/my-agent.md',
        content: '---\n---\n\n# My Agent',
        frontmatter: {},
        hasFrontmatter: true,
      });

      expect(result.isValid).toBe(true);
      expect(result.issues.length).toBe(0);
    });

    it('should detect invalid model value in agent frontmatter', () => {
      const result = validateACTFormat({
        configType: 'claude-agent',
        filePath: '.claude/agents/my-agent.md',
        content: '---\nmodel: gpt-4\n---\n\n# My Agent',
        frontmatter: { model: 'gpt-4' },
        hasFrontmatter: true,
      });

      expect(result.isValid).toBe(false);
      expect(result.issues.length).toBe(1);
      expect(result.issues[0]?.type).toBe('invalid-field-value');
      expect(result.issues[0]?.message).toContain('model');
    });

    it('should accept full model ID starting with claude-', () => {
      const result = validateACTFormat({
        configType: 'claude-agent',
        filePath: '.claude/agents/my-agent.md',
        content: '---\nmodel: claude-sonnet-4-20250514\n---\n\n# My Agent',
        frontmatter: { model: 'claude-sonnet-4-20250514' },
        hasFrontmatter: true,
      });

      expect(result.isValid).toBe(true);
      expect(result.issues.length).toBe(0);
    });

    it('should accept shorthand model names', () => {
      const shorthandModels = ['sonnet', 'opus', 'haiku'];

      for (const model of shorthandModels) {
        const result = validateACTFormat({
          configType: 'claude-agent',
          filePath: '.claude/agents/my-agent.md',
          content: `---\nmodel: ${model}\n---\n\n# My Agent`,
          frontmatter: { model },
          hasFrontmatter: true,
        });

        expect(result.isValid).toBe(true);
        expect(result.issues.length).toBe(0);
      }
    });
  });

  describe('skill files (skill-md)', () => {
    it('should detect missing frontmatter in skill files', () => {
      const result = validateACTFormat({
        configType: 'skill-md',
        filePath: '.claude/skills/my-skill/SKILL.md',
        content: '# My Skill\n\nDoes something useful.',
        hasFrontmatter: false,
      });

      expect(result.isValid).toBe(false);
      expect(result.issues.length).toBe(1);
      expect(result.issues[0]?.type).toBe('missing-frontmatter');
      expect(result.issues[0]?.severity).toBe('high');
      expect(result.issues[0]?.message).toContain('Skill');
    });

    it('should detect missing name field in skill frontmatter', () => {
      const result = validateACTFormat({
        configType: 'skill-md',
        filePath: '.claude/skills/my-skill/SKILL.md',
        content: '---\ndescription: A skill\n---\n\n# My Skill',
        frontmatter: { description: 'A skill' },
        hasFrontmatter: true,
      });

      expect(result.isValid).toBe(false);
      expect(result.issues.some((i) => i.type === 'missing-required-field')).toBe(true);
      expect(result.issues.some((i) => i.message.includes('name'))).toBe(true);
    });

    it('should detect missing description field in skill frontmatter', () => {
      const result = validateACTFormat({
        configType: 'skill-md',
        filePath: '.claude/skills/my-skill/SKILL.md',
        content: '---\nname: my-skill\n---\n\n# My Skill',
        frontmatter: { name: 'my-skill' },
        hasFrontmatter: true,
      });

      expect(result.isValid).toBe(false);
      expect(result.issues.some((i) => i.type === 'missing-required-field')).toBe(true);
      expect(result.issues.some((i) => i.message.includes('description'))).toBe(true);
    });

    it('should pass skill files with all required fields', () => {
      const result = validateACTFormat({
        configType: 'skill-md',
        filePath: '.claude/skills/my-skill/SKILL.md',
        content: '---\nname: my-skill\ndescription: A skill that does something\n---\n\n# My Skill',
        frontmatter: {
          name: 'my-skill',
          description: 'A skill that does something',
        },
        hasFrontmatter: true,
      });

      expect(result.isValid).toBe(true);
      expect(result.issues.length).toBe(0);
    });

    it('should pass skill files with optional fields', () => {
      const result = validateACTFormat({
        configType: 'skill-md',
        filePath: '.claude/skills/my-skill/SKILL.md',
        content: '---\nname: my-skill\ndescription: A skill\nallowed_tools:\n  - Read\n  - Glob\nuser_invocable: true\n---',
        frontmatter: {
          name: 'my-skill',
          description: 'A skill',
          allowed_tools: ['Read', 'Glob'],
          user_invocable: true,
        },
        hasFrontmatter: true,
      });

      expect(result.isValid).toBe(true);
      expect(result.issues.length).toBe(0);
    });

    it('should detect name that is too long (>64 chars)', () => {
      const longName = 'a'.repeat(65);
      const result = validateACTFormat({
        configType: 'skill-md',
        filePath: '.claude/skills/my-skill/SKILL.md',
        content: `---\nname: ${longName}\ndescription: A skill\n---`,
        frontmatter: {
          name: longName,
          description: 'A skill',
        },
        hasFrontmatter: true,
      });

      expect(result.isValid).toBe(false);
      expect(result.issues.some((i) => i.type === 'invalid-field-value')).toBe(true);
    });

    it('should detect description that is too long (>1024 chars)', () => {
      const longDescription = 'a'.repeat(1025);
      const result = validateACTFormat({
        configType: 'skill-md',
        filePath: '.claude/skills/my-skill/SKILL.md',
        content: `---\nname: my-skill\ndescription: ${longDescription}\n---`,
        frontmatter: {
          name: 'my-skill',
          description: longDescription,
        },
        hasFrontmatter: true,
      });

      expect(result.isValid).toBe(false);
      expect(result.issues.some((i) => i.type === 'invalid-field-value')).toBe(true);
    });
  });

  describe('non-frontmatter-required types', () => {
    it('should pass CLAUDE.md files without frontmatter', () => {
      const result = validateACTFormat({
        configType: 'claude-md',
        filePath: 'CLAUDE.md',
        content: '# Project\n\nThis is a project.',
        hasFrontmatter: false,
      });

      expect(result.isValid).toBe(true);
      expect(result.issues.length).toBe(0);
    });

    it('should pass settings.json files without frontmatter check', () => {
      const result = validateACTFormat({
        configType: 'claude-settings',
        filePath: '.claude/settings.json',
        content: '{"model": "claude-sonnet-4"}',
        hasFrontmatter: false,
      });

      expect(result.isValid).toBe(true);
      expect(result.issues.length).toBe(0);
    });

    it('should pass rule files without frontmatter', () => {
      const result = validateACTFormat({
        configType: 'claude-rule',
        filePath: '.claude/rules/typescript.md',
        content: '# TypeScript Rules\n\nAlways use strict mode.',
        hasFrontmatter: false,
      });

      expect(result.isValid).toBe(true);
      expect(result.issues.length).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty frontmatter object', () => {
      const result = validateACTFormat({
        configType: 'claude-agent',
        filePath: '.claude/agents/my-agent.md',
        content: '---\n---\n\n# My Agent',
        frontmatter: {},
        hasFrontmatter: true,
      });

      // Agent files with empty frontmatter are valid (all fields optional)
      expect(result.isValid).toBe(true);
    });

    it('should handle undefined frontmatter with hasFrontmatter=true', () => {
      const result = validateACTFormat({
        configType: 'claude-agent',
        filePath: '.claude/agents/my-agent.md',
        content: '---\n---\n\n# My Agent',
        frontmatter: undefined,
        hasFrontmatter: true,
      });

      // Should not throw, frontmatter check is based on hasFrontmatter flag
      expect(result.isValid).toBe(true);
    });

    it('should generate unique issue IDs for different files', () => {
      const result1 = validateACTFormat({
        configType: 'claude-agent',
        filePath: '.claude/agents/agent1.md',
        content: '# Agent 1',
        hasFrontmatter: false,
      });

      const result2 = validateACTFormat({
        configType: 'claude-agent',
        filePath: '.claude/agents/agent2.md',
        content: '# Agent 2',
        hasFrontmatter: false,
      });

      expect(result1.issues[0]?.id).not.toBe(result2.issues[0]?.id);
    });

    it('should provide helpful suggestions for missing frontmatter', () => {
      const result = validateACTFormat({
        configType: 'claude-agent',
        filePath: '.claude/agents/my-agent.md',
        content: '# My Agent',
        hasFrontmatter: false,
      });

      expect(result.issues[0]?.suggestion).toBeDefined();
      expect(result.issues[0]?.suggestion).toContain('---');
    });
  });
});

describe('act-schemas', () => {
  let requiresFrontmatter: (configType: ConfigType) => boolean;

  beforeAll(async () => {
    const module = await import('../../../../src/tools/config/schemas');
    requiresFrontmatter = module.requiresFrontmatter;
  });

  it('should require frontmatter for claude-agent', () => {
    expect(requiresFrontmatter('claude-agent')).toBe(true);
  });

  it('should require frontmatter for skill-md', () => {
    expect(requiresFrontmatter('skill-md')).toBe(true);
  });

  it('should not require frontmatter for claude-md', () => {
    expect(requiresFrontmatter('claude-md')).toBe(false);
  });

  it('should not require frontmatter for claude-settings', () => {
    expect(requiresFrontmatter('claude-settings')).toBe(false);
  });

  it('should not require frontmatter for claude-rule', () => {
    expect(requiresFrontmatter('claude-rule')).toBe(false);
  });
});
