/**
 * Unit tests for frontmatter parser
 *
 * T014: Tests for src/parsers/frontmatter.ts
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import {
  parseFrontmatter,
  parseFrontmatterSync,
} from '../../../src/parsers/frontmatter';

const FIXTURES_DIR = join(import.meta.dir, '../../fixtures/configs');

describe('parseFrontmatter', () => {
  let skillContent: string;
  let invalidYamlContent: string;
  let noFrontmatterContent: string;

  beforeAll(async () => {
    skillContent = await readFile(join(FIXTURES_DIR, 'valid/skill/SKILL.md'), 'utf-8');
    invalidYamlContent = await readFile(
      join(FIXTURES_DIR, 'malformed/invalid-yaml.md'),
      'utf-8'
    );
    noFrontmatterContent = await readFile(
      join(FIXTURES_DIR, 'valid/claude-simple.md'),
      'utf-8'
    );
  });

  // =============================================================================
  // Valid Frontmatter Extraction
  // =============================================================================

  describe('valid frontmatter extraction', () => {
    it('should extract frontmatter from skill file', async () => {
      const result = await parseFrontmatter(skillContent);

      expect(result.frontmatter).toBeDefined();
      expect(result.hasFrontmatter).toBe(true);
    });

    it('should parse name field', async () => {
      const result = await parseFrontmatter(skillContent);

      expect(result.frontmatter?.name).toBe('test-skill');
    });

    it('should parse description field', async () => {
      const result = await parseFrontmatter(skillContent);

      expect(result.frontmatter?.description).toBe('A test skill for validation');
    });

    it('should parse version field', async () => {
      const result = await parseFrontmatter(skillContent);

      expect(result.frontmatter?.version).toBe('1.0.0');
    });

    it('should return content without frontmatter', async () => {
      const result = await parseFrontmatter(skillContent);

      expect(result.content).not.toContain('---\nname:');
      expect(result.content).toContain('# Test Skill');
    });

    it('should track frontmatter position', async () => {
      const result = await parseFrontmatter(skillContent);

      expect(result.frontmatterPosition?.start?.line).toBe(1);
      // End line depends on frontmatter content
      expect(result.frontmatterPosition?.end?.line).toBeGreaterThan(1);
    });
  });

  // =============================================================================
  // No Frontmatter Handling
  // =============================================================================

  describe('no frontmatter handling', () => {
    it('should handle files without frontmatter', async () => {
      const result = await parseFrontmatter(noFrontmatterContent);

      expect(result.hasFrontmatter).toBe(false);
      expect(result.frontmatter).toBeUndefined();
    });

    it('should return original content when no frontmatter', async () => {
      const result = await parseFrontmatter(noFrontmatterContent);

      expect(result.content).toBe(noFrontmatterContent);
    });

    it('should handle content starting with --- without closing', async () => {
      const content = '---\nThis is not frontmatter, just a line\nNo closing marker';
      const result = await parseFrontmatter(content);

      expect(result.hasFrontmatter).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  // =============================================================================
  // Invalid Frontmatter Handling
  // =============================================================================

  describe('invalid frontmatter handling', () => {
    it('should handle invalid YAML gracefully', async () => {
      const result = await parseFrontmatter(invalidYamlContent);

      expect(result.warnings).toBeDefined();
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should return warning for invalid YAML', async () => {
      const result = await parseFrontmatter(invalidYamlContent);
      const warning = result.warnings.find((w) => w.code === 'INVALID_YAML');

      expect(warning).toBeDefined();
      expect(warning?.recoverable).toBe(true);
    });

    it('should still return content on invalid YAML', async () => {
      const result = await parseFrontmatter(invalidYamlContent);

      expect(result.content).toContain('# Invalid YAML Frontmatter');
    });

    it('should handle unclosed frontmatter', async () => {
      const unclosed = '---\nname: test\nThis has no closing ---';
      const result = await parseFrontmatter(unclosed);

      expect(result.hasFrontmatter).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  // =============================================================================
  // Edge Cases
  // =============================================================================

  describe('edge cases', () => {
    it('should handle empty frontmatter', async () => {
      // Frontmatter regex requires newline between delimiters: ---\n<content>\n---
      const emptyFm = '---\n\n---\n# Content';
      const result = await parseFrontmatter(emptyFm);

      expect(result.hasFrontmatter).toBe(true);
      expect(result.frontmatter).toEqual({});
    });

    it('should handle frontmatter with only whitespace', async () => {
      const whitespace = '---\n   \n\t\n---\n# Content';
      const result = await parseFrontmatter(whitespace);

      expect(result.hasFrontmatter).toBe(true);
      expect(result.frontmatter).toEqual({});
    });

    it('should handle nested YAML structures', async () => {
      const nested = '---\nconfig:\n  key1: value1\n  key2: value2\n---\n# Content';
      const result = await parseFrontmatter(nested);

      const config = result.frontmatter?.config as Record<string, unknown> | undefined;
      expect(config?.key1).toBe('value1');
    });

    it('should handle YAML arrays', async () => {
      const arrays = '---\ntags:\n  - tag1\n  - tag2\n---\n# Content';
      const result = await parseFrontmatter(arrays);

      expect(result.frontmatter?.tags).toEqual(['tag1', 'tag2']);
    });

    it('should handle empty content', async () => {
      const result = await parseFrontmatter('');

      expect(result.hasFrontmatter).toBe(false);
      expect(result.content).toBe('');
    });
  });

  // =============================================================================
  // Skill-Specific Validation
  // =============================================================================

  describe('skill-specific validation', () => {
    it('should validate required skill fields', async () => {
      const missingName = '---\ndescription: test\n---\n# Content';
      const result = await parseFrontmatter(missingName, {
        requiredFields: ['name'],
      });

      expect(
        result.warnings.some((w) => w.code === 'MISSING_REQUIRED_FIELD')
      ).toBe(true);
    });

    it('should validate name length constraint', async () => {
      const longName = '---\nname: ' + 'a'.repeat(100) + '\n---\n# Content';
      const result = await parseFrontmatter(longName, { maxNameLength: 64 });

      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should validate description length constraint', async () => {
      const longDesc =
        '---\nname: test\ndescription: ' + 'a'.repeat(300) + '\n---\n# Content';
      const result = await parseFrontmatter(longDesc, {
        maxDescriptionLength: 200,
      });

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  // =============================================================================
  // Sync API
  // =============================================================================

  describe('parseFrontmatterSync', () => {
    it('should work synchronously', () => {
      const result = parseFrontmatterSync('---\nname: test\n---\n# Content');

      expect(result.hasFrontmatter).toBe(true);
      expect(result.frontmatter?.name).toBe('test');
    });

    it('should handle errors synchronously', () => {
      const result = parseFrontmatterSync('');

      expect(result.hasFrontmatter).toBe(false);
    });
  });

  // =============================================================================
  // Additional Edge Cases
  // =============================================================================

  describe('additional edge cases', () => {
    it('should handle YAML with special characters', async () => {
      const special = '---\nname: "test: with colon"\n---\n# Content';
      const result = await parseFrontmatter(special);

      expect(result.frontmatter?.name).toBe('test: with colon');
    });

    it('should handle multiline strings', async () => {
      const multiline = '---\ndesc: |\n  Line 1\n  Line 2\n---\n# Content';
      const result = await parseFrontmatter(multiline);

      expect(result.frontmatter?.desc).toContain('Line 1');
    });

    it('should handle YAML booleans', async () => {
      const bools = '---\nenabled: true\ndisabled: false\n---\n# Content';
      const result = await parseFrontmatter(bools);

      expect(result.frontmatter?.enabled).toBe(true);
      expect(result.frontmatter?.disabled).toBe(false);
    });

    it('should handle YAML numbers', async () => {
      const nums = '---\ncount: 42\nprice: 19.99\n---\n# Content';
      const result = await parseFrontmatter(nums);

      expect(result.frontmatter?.count).toBe(42);
      expect(result.frontmatter?.price).toBe(19.99);
    });

    it('should handle frontmatter at very start of file', async () => {
      const noLeadingSpace = '---\nname: test\n---\nContent';
      const result = await parseFrontmatter(noLeadingSpace);

      expect(result.hasFrontmatter).toBe(true);
    });

    it('should handle frontmatter with trailing newlines', async () => {
      const trailingNewlines = '---\nname: test\n---\n\n\n# Content';
      const result = await parseFrontmatter(trailingNewlines);

      expect(result.hasFrontmatter).toBe(true);
      expect(result.content).toContain('# Content');
    });

    it('should handle YAML with null values', async () => {
      const nullValues = '---\nname: test\noptional: null\n---\n# Content';
      const result = await parseFrontmatter(nullValues);

      expect(result.frontmatter?.name).toBe('test');
      expect(result.frontmatter?.optional).toBeNull();
    });

    it('should handle YAML arrays (non-object frontmatter)', async () => {
      const arrayFm = '---\n- item1\n- item2\n---\n# Content';
      const result = await parseFrontmatter(arrayFm);

      // Should warn that frontmatter must be an object
      expect(result.warnings.some((w) => w.code === 'INVALID_YAML')).toBe(true);
    });
  });
});
