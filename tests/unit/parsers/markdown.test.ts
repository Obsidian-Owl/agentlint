/**
 * Unit tests for markdown parser
 *
 * T012: Tests for src/parsers/markdown.ts
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { parseMarkdown, parseMarkdownSync } from '../../../src/parsers/markdown';

const FIXTURES_DIR = join(import.meta.dir, '../../fixtures/configs');

describe('parseMarkdown', () => {
  let simpleContent: string;
  let complexContent: string;
  let unclosedCodeblock: string;

  beforeAll(async () => {
    simpleContent = await readFile(join(FIXTURES_DIR, 'valid/claude-simple.md'), 'utf-8');
    complexContent = await readFile(join(FIXTURES_DIR, 'valid/claude-complex.md'), 'utf-8');
    unclosedCodeblock = await readFile(
      join(FIXTURES_DIR, 'malformed/unclosed-codeblock.md'),
      'utf-8'
    );
  });

  // =============================================================================
  // Basic Parsing
  // =============================================================================

  describe('basic parsing', () => {
    it('should parse simple markdown into AST', async () => {
      const result = await parseMarkdown(simpleContent);

      expect(result.ast).toBeDefined();
      expect(result.ast.type).toBe('root');
      expect(result.ast.children.length).toBeGreaterThan(0);
    });

    it('should preserve original content', async () => {
      const result = await parseMarkdown(simpleContent);

      expect(result.raw).toBe(simpleContent);
    });

    it('should track line count', async () => {
      const result = await parseMarkdown(simpleContent);
      const lineCount = simpleContent.split('\n').length;

      expect(result.lineCount).toBe(lineCount);
    });
  });

  // =============================================================================
  // Heading Extraction
  // =============================================================================

  describe('heading extraction', () => {
    it('should extract all headings', async () => {
      const result = await parseMarkdown(complexContent);
      const headings = result.headings;

      expect(headings.length).toBeGreaterThan(0);
      expect(headings.some((h) => h.text === 'CLAUDE.md')).toBe(true);
      expect(headings.some((h) => h.text === 'Project Overview')).toBe(true);
    });

    it('should preserve heading levels', async () => {
      const result = await parseMarkdown(complexContent);
      const h1 = result.headings.find((h) => h.text === 'CLAUDE.md');
      const h2 = result.headings.find((h) => h.text === 'Project Overview');
      const h3 = result.headings.find((h) => h.text === 'Layer 1: Core');

      expect(h1?.level).toBe(1);
      expect(h2?.level).toBe(2);
      expect(h3?.level).toBe(3);
    });

    it('should include heading positions', async () => {
      const result = await parseMarkdown(complexContent);
      const h1 = result.headings[0];

      expect(h1?.position?.start?.line).toBe(1);
      expect(h1?.position?.start?.column).toBe(1);
    });
  });

  // =============================================================================
  // Code Block Extraction
  // =============================================================================

  describe('code block extraction', () => {
    it('should extract code blocks', async () => {
      const result = await parseMarkdown(complexContent);

      expect(result.codeBlocks.length).toBe(2);
    });

    it('should preserve code block languages', async () => {
      const result = await parseMarkdown(complexContent);
      const tsBlock = result.codeBlocks.find((b) => b.language === 'typescript');
      const bashBlock = result.codeBlocks.find((b) => b.language === 'bash');

      expect(tsBlock).toBeDefined();
      expect(bashBlock).toBeDefined();
    });

    it('should preserve code block content', async () => {
      const result = await parseMarkdown(complexContent);
      const tsBlock = result.codeBlocks.find((b) => b.language === 'typescript');

      expect(tsBlock?.content).toContain('interface Config');
    });

    it('should track code block positions', async () => {
      const result = await parseMarkdown(complexContent);
      const block = result.codeBlocks[0];

      expect(block?.position?.start?.line).toBeGreaterThan(0);
      expect(block?.position?.end?.line).toBeGreaterThan(
        block!.position!.start.line
      );
    });
  });

  // =============================================================================
  // GFM Support
  // =============================================================================

  describe('GFM support', () => {
    it('should parse GFM tables', async () => {
      const result = await parseMarkdown(complexContent);
      const tableNode = result.ast.children.find((n) => n.type === 'table');

      expect(tableNode).toBeDefined();
    });

    it('should parse task lists', async () => {
      const taskListContent = '- [ ] Todo item\n- [x] Done item';
      const result = await parseMarkdown(taskListContent);

      expect(result.ast).toBeDefined();
    });
  });

  // =============================================================================
  // Error Handling
  // =============================================================================

  describe('error handling', () => {
    it('should handle unclosed code blocks gracefully', async () => {
      const result = await parseMarkdown(unclosedCodeblock);

      expect(result.ast).toBeDefined();
      expect(result.warnings).toBeDefined();
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should return warning for unclosed code block', async () => {
      const result = await parseMarkdown(unclosedCodeblock);
      const warning = result.warnings.find(
        (w) => w.code === 'UNCLOSED_CODE_BLOCK'
      );

      expect(warning).toBeDefined();
      expect(warning?.recoverable).toBe(true);
    });

    it('should handle empty content', async () => {
      const result = await parseMarkdown('');

      expect(result.ast).toBeDefined();
      expect(result.ast.children.length).toBe(0);
    });

    it('should handle content with only whitespace', async () => {
      const result = await parseMarkdown('   \n\n   \t\n');

      expect(result.ast).toBeDefined();
    });
  });

  // =============================================================================
  // Position Tracking
  // =============================================================================

  describe('position tracking', () => {
    it('should track positions for all nodes', async () => {
      const result = await parseMarkdown(simpleContent);

      for (const child of result.ast.children) {
        expect(child.position).toBeDefined();
        expect(child.position?.start).toBeDefined();
        expect(child.position?.end).toBeDefined();
      }
    });

    it('should have valid position offsets', async () => {
      const result = await parseMarkdown(simpleContent);

      for (const child of result.ast.children) {
        if (child.position?.start?.offset !== undefined) {
          expect(child.position.start.offset).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  // =============================================================================
  // Sync API
  // =============================================================================

  describe('parseMarkdownSync', () => {
    it('should work synchronously', () => {
      const result = parseMarkdownSync('# Test\n\nContent');

      expect(result.ast).toBeDefined();
      expect(result.headings.length).toBe(1);
      expect(result.headings[0]!.text).toBe('Test');
    });

    it('should detect unclosed code blocks synchronously', () => {
      const result = parseMarkdownSync('# Test\n\n```js\ncode\n');

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  // =============================================================================
  // Additional Edge Cases
  // =============================================================================

  describe('additional edge cases', () => {
    it('should handle code blocks without language', async () => {
      const noLang = '# Test\n\n```\nsome code\n```\n';
      const result = await parseMarkdown(noLang);

      expect(result.codeBlocks.length).toBe(1);
      expect(result.codeBlocks[0]!.language).toBeUndefined();
    });

    it('should handle inline code in headings', async () => {
      const inlineCode = '# Config `options`\n';
      const result = await parseMarkdown(inlineCode);

      expect(result.headings.length).toBe(1);
      expect(result.headings[0]!.text).toContain('options');
    });

    it('should handle setext-style headings', async () => {
      const setext = 'Heading\n=======\n\nSubhead\n-------\n';
      const result = await parseMarkdown(setext);

      expect(result.headings.length).toBe(2);
      expect(result.headings[0]!.level).toBe(1);
      expect(result.headings[1]!.level).toBe(2);
    });

    it('should handle nested lists', async () => {
      const nested = '- Item 1\n  - Nested 1\n  - Nested 2\n- Item 2\n';
      const result = await parseMarkdown(nested);

      expect(result.ast).toBeDefined();
    });

    it('should handle links with special characters', async () => {
      const links = '# Test\n\n[Link text](https://example.com?foo=bar&baz=qux)\n';
      const result = await parseMarkdown(links);

      expect(result.ast).toBeDefined();
    });

    it('should count code block lines correctly', async () => {
      const multiLine = '```js\nline1\nline2\nline3\n```\n';
      const result = await parseMarkdown(multiLine);

      expect(result.codeBlocks.length).toBe(1);
      expect(result.codeBlocks[0]!.lineCount).toBe(3);
    });

    it('should handle frontmatter', async () => {
      const withFrontmatter = '---\nname: test\n---\n\n# Content\n';
      const result = await parseMarkdown(withFrontmatter);

      expect(result.ast).toBeDefined();
      // Frontmatter is parsed as yaml node
      const yamlNode = result.ast.children.find((n) => n.type === 'yaml');
      expect(yamlNode).toBeDefined();
    });

    it('should handle HTML comments', async () => {
      const withComment = '# Test\n\n<!-- comment -->\n\nContent\n';
      const result = await parseMarkdown(withComment);

      expect(result.ast).toBeDefined();
    });

    it('should handle consecutive headings', async () => {
      const consecutive = '# H1\n## H2\n### H3\n';
      const result = await parseMarkdown(consecutive);

      expect(result.headings.length).toBe(3);
    });
  });
});
