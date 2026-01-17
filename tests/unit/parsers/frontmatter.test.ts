/**
 * Unit tests for frontmatter parser
 *
 * T014: Tests for src/parsers/frontmatter.ts
 */

import { describe, it, beforeAll } from 'bun:test';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';

// Import will be added after T015 creates the parser
// import { parseFrontmatter, type FrontmatterParseResult } from '../../../src/parsers/frontmatter';

const FIXTURES_DIR = join(import.meta.dir, '../../fixtures/configs');

describe('parseFrontmatter', () => {
  // Variables used in skipped tests - prefixed with _ to avoid unused warnings
  let _skillContent: string;
  let _invalidYamlContent: string;
  let _noFrontmatterContent: string;

  beforeAll(async () => {
    _skillContent = await readFile(join(FIXTURES_DIR, 'valid/skill/SKILL.md'), 'utf-8');
    _invalidYamlContent = await readFile(join(FIXTURES_DIR, 'malformed/invalid-yaml.md'), 'utf-8');
    _noFrontmatterContent = await readFile(join(FIXTURES_DIR, 'valid/claude-simple.md'), 'utf-8');
    // Consume variables to prevent unused warnings (tests are skipped)
    void [_skillContent, _invalidYamlContent, _noFrontmatterContent];
  });

  describe('valid frontmatter extraction', () => {
    it.skip('should extract frontmatter from skill file', async () => {
      // const result = await parseFrontmatter(skillContent);
      // expect(result.frontmatter).toBeDefined();
      // expect(result.hasFrontmatter).toBe(true);
    });

    it.skip('should parse name field', async () => {
      // const result = await parseFrontmatter(skillContent);
      // expect(result.frontmatter?.name).toBe('test-skill');
    });

    it.skip('should parse description field', async () => {
      // const result = await parseFrontmatter(skillContent);
      // expect(result.frontmatter?.description).toBe('A test skill for validation');
    });

    it.skip('should parse version field', async () => {
      // const result = await parseFrontmatter(skillContent);
      // expect(result.frontmatter?.version).toBe('1.0.0');
    });

    it.skip('should return content without frontmatter', async () => {
      // const result = await parseFrontmatter(skillContent);
      // expect(result.content).not.toContain('---');
      // expect(result.content).toContain('# Test Skill');
    });

    it.skip('should track frontmatter position', async () => {
      // const result = await parseFrontmatter(skillContent);
      // expect(result.frontmatterPosition?.start?.line).toBe(1);
      // expect(result.frontmatterPosition?.end?.line).toBe(6);
    });
  });

  describe('no frontmatter handling', () => {
    it.skip('should handle files without frontmatter', async () => {
      // const result = await parseFrontmatter(noFrontmatterContent);
      // expect(result.hasFrontmatter).toBe(false);
      // expect(result.frontmatter).toBeUndefined();
    });

    it.skip('should return original content when no frontmatter', async () => {
      // const result = await parseFrontmatter(noFrontmatterContent);
      // expect(result.content).toBe(noFrontmatterContent);
    });

    it.skip('should handle content starting with ---', async () => {
      // const content = '---\nThis is not frontmatter, just a horizontal rule\n';
      // const result = await parseFrontmatter(content);
      // expect(result.hasFrontmatter).toBe(false);
    });
  });

  describe('invalid frontmatter handling', () => {
    it.skip('should handle invalid YAML gracefully', async () => {
      // const result = await parseFrontmatter(invalidYamlContent);
      // expect(result.warnings).toBeDefined();
      // expect(result.warnings.length).toBeGreaterThan(0);
    });

    it.skip('should return warning for invalid YAML', async () => {
      // const result = await parseFrontmatter(invalidYamlContent);
      // const warning = result.warnings.find(w => w.code === 'INVALID_YAML');
      // expect(warning).toBeDefined();
      // expect(warning?.recoverable).toBe(true);
    });

    it.skip('should still return content on invalid YAML', async () => {
      // const result = await parseFrontmatter(invalidYamlContent);
      // expect(result.content).toContain('# Invalid YAML Frontmatter');
    });

    it.skip('should handle unclosed frontmatter', async () => {
      // const unclosed = '---\nname: test\nThis has no closing ---';
      // const result = await parseFrontmatter(unclosed);
      // expect(result.hasFrontmatter).toBe(false);
      // expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it.skip('should handle empty frontmatter', async () => {
      // const emptyFm = '---\n---\n# Content';
      // const result = await parseFrontmatter(emptyFm);
      // expect(result.hasFrontmatter).toBe(true);
      // expect(result.frontmatter).toEqual({});
    });

    it.skip('should handle frontmatter with only whitespace', async () => {
      // const whitespace = '---\n   \n\t\n---\n# Content';
      // const result = await parseFrontmatter(whitespace);
      // expect(result.hasFrontmatter).toBe(true);
    });

    it.skip('should handle nested YAML structures', async () => {
      // const nested = '---\nconfig:\n  key1: value1\n  key2: value2\n---\n# Content';
      // const result = await parseFrontmatter(nested);
      // expect(result.frontmatter?.config?.key1).toBe('value1');
    });

    it.skip('should handle YAML arrays', async () => {
      // const arrays = '---\ntags:\n  - tag1\n  - tag2\n---\n# Content';
      // const result = await parseFrontmatter(arrays);
      // expect(result.frontmatter?.tags).toEqual(['tag1', 'tag2']);
    });

    it.skip('should handle empty content', async () => {
      // const result = await parseFrontmatter('');
      // expect(result.hasFrontmatter).toBe(false);
      // expect(result.content).toBe('');
    });
  });

  describe('skill-specific validation', () => {
    it.skip('should validate required skill fields', async () => {
      // const missingName = '---\ndescription: test\n---\n# Content';
      // const result = await parseFrontmatter(missingName, { requiredFields: ['name'] });
      // expect(result.warnings.some(w => w.code === 'MISSING_REQUIRED_FIELD')).toBe(true);
    });

    it.skip('should validate name length constraint', async () => {
      // const longName = '---\nname: ' + 'a'.repeat(100) + '\n---\n# Content';
      // const result = await parseFrontmatter(longName, { maxNameLength: 64 });
      // expect(result.warnings.length).toBeGreaterThan(0);
    });

    it.skip('should validate description length constraint', async () => {
      // const longDesc = '---\nname: test\ndescription: ' + 'a'.repeat(300) + '\n---\n# Content';
      // const result = await parseFrontmatter(longDesc, { maxDescriptionLength: 200 });
      // expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});
