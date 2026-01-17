/**
 * Unit tests for markdown parser
 *
 * T012: Tests for src/parsers/markdown.ts
 */

import { describe, it, beforeAll } from 'bun:test';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';

// Import will be added after T013 creates the parser
// import { parseMarkdown, type MarkdownParseResult } from '../../../src/parsers/markdown';

const FIXTURES_DIR = join(import.meta.dir, '../../fixtures/configs');

describe('parseMarkdown', () => {
  // Variables used in skipped tests - prefixed with _ to avoid unused warnings
  let _simpleContent: string;
  let _complexContent: string;
  let _unclosedCodeblock: string;

  beforeAll(async () => {
    _simpleContent = await readFile(join(FIXTURES_DIR, 'valid/claude-simple.md'), 'utf-8');
    _complexContent = await readFile(join(FIXTURES_DIR, 'valid/claude-complex.md'), 'utf-8');
    _unclosedCodeblock = await readFile(join(FIXTURES_DIR, 'malformed/unclosed-codeblock.md'), 'utf-8');
    // Consume variables to prevent unused warnings (tests are skipped)
    void [_simpleContent, _complexContent, _unclosedCodeblock];
  });

  describe('basic parsing', () => {
    it.skip('should parse simple markdown into AST', async () => {
      // const result = await parseMarkdown(simpleContent);
      // expect(result.ast).toBeDefined();
      // expect(result.ast.type).toBe('root');
      // expect(result.ast.children.length).toBeGreaterThan(0);
    });

    it.skip('should preserve original content', async () => {
      // const result = await parseMarkdown(simpleContent);
      // expect(result.raw).toBe(simpleContent);
    });

    it.skip('should track line count', async () => {
      // const result = await parseMarkdown(simpleContent);
      // const lineCount = simpleContent.split('\n').length;
      // expect(result.lineCount).toBe(lineCount);
    });
  });

  describe('heading extraction', () => {
    it.skip('should extract all headings', async () => {
      // const result = await parseMarkdown(complexContent);
      // const headings = result.headings;
      // expect(headings.length).toBeGreaterThan(0);
      // expect(headings.some(h => h.text === 'CLAUDE.md')).toBe(true);
      // expect(headings.some(h => h.text === 'Project Overview')).toBe(true);
    });

    it.skip('should preserve heading levels', async () => {
      // const result = await parseMarkdown(complexContent);
      // const h1 = result.headings.find(h => h.text === 'CLAUDE.md');
      // const h2 = result.headings.find(h => h.text === 'Project Overview');
      // const h3 = result.headings.find(h => h.text === 'Layer 1: Core');
      // expect(h1?.level).toBe(1);
      // expect(h2?.level).toBe(2);
      // expect(h3?.level).toBe(3);
    });

    it.skip('should include heading positions', async () => {
      // const result = await parseMarkdown(complexContent);
      // const h1 = result.headings[0];
      // expect(h1?.position?.start?.line).toBe(1);
      // expect(h1?.position?.start?.column).toBe(1);
    });
  });

  describe('code block extraction', () => {
    it.skip('should extract code blocks', async () => {
      // const result = await parseMarkdown(complexContent);
      // expect(result.codeBlocks.length).toBe(2);
    });

    it.skip('should preserve code block languages', async () => {
      // const result = await parseMarkdown(complexContent);
      // const tsBlock = result.codeBlocks.find(b => b.language === 'typescript');
      // const bashBlock = result.codeBlocks.find(b => b.language === 'bash');
      // expect(tsBlock).toBeDefined();
      // expect(bashBlock).toBeDefined();
    });

    it.skip('should preserve code block content', async () => {
      // const result = await parseMarkdown(complexContent);
      // const tsBlock = result.codeBlocks.find(b => b.language === 'typescript');
      // expect(tsBlock?.content).toContain('interface Config');
    });

    it.skip('should track code block positions', async () => {
      // const result = await parseMarkdown(complexContent);
      // const block = result.codeBlocks[0];
      // expect(block?.position?.start?.line).toBeGreaterThan(0);
      // expect(block?.position?.end?.line).toBeGreaterThan(block.position.start.line);
    });
  });

  describe('GFM support', () => {
    it.skip('should parse GFM tables', async () => {
      // const result = await parseMarkdown(complexContent);
      // const tableNode = result.ast.children.find(n => n.type === 'table');
      // expect(tableNode).toBeDefined();
    });

    it.skip('should parse task lists', async () => {
      // const taskListContent = '- [ ] Todo item\n- [x] Done item';
      // const result = await parseMarkdown(taskListContent);
      // expect(result.ast).toBeDefined();
    });
  });

  describe('error handling', () => {
    it.skip('should handle unclosed code blocks gracefully', async () => {
      // const result = await parseMarkdown(unclosedCodeblock);
      // expect(result.ast).toBeDefined();
      // expect(result.warnings).toBeDefined();
      // expect(result.warnings.length).toBeGreaterThan(0);
    });

    it.skip('should return warning for unclosed code block', async () => {
      // const result = await parseMarkdown(unclosedCodeblock);
      // const warning = result.warnings.find(w => w.code === 'UNCLOSED_CODE_BLOCK');
      // expect(warning).toBeDefined();
      // expect(warning?.recoverable).toBe(true);
    });

    it.skip('should handle empty content', async () => {
      // const result = await parseMarkdown('');
      // expect(result.ast).toBeDefined();
      // expect(result.ast.children.length).toBe(0);
    });

    it.skip('should handle content with only whitespace', async () => {
      // const result = await parseMarkdown('   \n\n   \t\n');
      // expect(result.ast).toBeDefined();
    });
  });

  describe('position tracking', () => {
    it.skip('should track positions for all nodes', async () => {
      // const result = await parseMarkdown(simpleContent);
      // for (const child of result.ast.children) {
      //   expect(child.position).toBeDefined();
      //   expect(child.position?.start).toBeDefined();
      //   expect(child.position?.end).toBeDefined();
      // }
    });

    it.skip('should have valid position offsets', async () => {
      // const result = await parseMarkdown(simpleContent);
      // for (const child of result.ast.children) {
      //   if (child.position?.start?.offset !== undefined) {
      //     expect(child.position.start.offset).toBeGreaterThanOrEqual(0);
      //   }
      // }
    });
  });
});
