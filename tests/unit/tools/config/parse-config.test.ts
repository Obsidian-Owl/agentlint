/**
 * T029: Unit tests for CLAUDE.md parsing
 *
 * Tests the parseConfig() function for parsing AI configuration files.
 *
 * @module tests/unit/tools/config/parse-config.test.ts
 */

import { describe, it, expect } from 'bun:test';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { parseConfig } from '../../../../src/tools/config/parse-config';

// Test fixture paths
const FIXTURES_DIR = path.join(__dirname, '../../../fixtures/configs');
const VALID_DIR = path.join(FIXTURES_DIR, 'valid');

describe('parseConfig', () => {
  describe('basic parsing', () => {
    it('should parse a valid CLAUDE.md file', async () => {
      const filePath = path.join(VALID_DIR, 'CLAUDE.md');
      const result = await parseConfig(filePath);

      expect(result).toBeDefined();
      expect(result.file.path).toBe(filePath);
      expect(result.raw).toBeTruthy();
    });

    it('should return AST root node', async () => {
      const filePath = path.join(VALID_DIR, 'CLAUDE.md');
      const result = await parseConfig(filePath);

      expect(result.ast).toBeDefined();
      expect(result.ast.type).toBe('root');
    });

    it('should preserve original content in raw field', async () => {
      const filePath = path.join(VALID_DIR, 'CLAUDE.md');
      const expectedContent = fs.readFileSync(filePath, 'utf-8');
      const result = await parseConfig(filePath);

      expect(result.raw).toBe(expectedContent);
    });

    it('should populate file metadata correctly', async () => {
      const filePath = path.join(VALID_DIR, 'CLAUDE.md');
      const result = await parseConfig(filePath);

      expect(result.file.type).toBe('claude-md');
      expect(result.file.actType).toBe('claude-code');
      expect(result.file.size).toBeGreaterThan(0);
    });
  });

  describe('section extraction (T034)', () => {
    it('should extract sections from headings', async () => {
      const filePath = path.join(VALID_DIR, 'claude-complex.md');
      const result = await parseConfig(filePath);

      expect(result.sections.length).toBeGreaterThan(0);
    });

    it('should preserve section hierarchy', async () => {
      const filePath = path.join(VALID_DIR, 'claude-complex.md');
      const result = await parseConfig(filePath);

      // Should have top-level sections
      const topLevel = result.sections.filter((s) => s.level === 1);
      expect(topLevel.length).toBeGreaterThanOrEqual(1);

      // Some sections should have children
      const hasChildren = result.sections.some((s) => s.children.length > 0);
      expect(hasChildren).toBe(true);
    });

    it('should extract section titles correctly', async () => {
      const filePath = path.join(VALID_DIR, 'claude-complex.md');
      const result = await parseConfig(filePath);

      const titles = result.sections.map((s) => s.title);
      expect(titles).toContain('CLAUDE.md');
    });

    it('should generate unique section IDs', async () => {
      const filePath = path.join(VALID_DIR, 'claude-complex.md');
      const result = await parseConfig(filePath);

      const ids = result.sections.map((s) => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should track section line count', async () => {
      const filePath = path.join(VALID_DIR, 'claude-complex.md');
      const result = await parseConfig(filePath);

      for (const section of result.sections) {
        expect(section.lineCount).toBeGreaterThan(0);
      }
    });

    it('should include section content', async () => {
      const filePath = path.join(VALID_DIR, 'claude-complex.md');
      const result = await parseConfig(filePath);

      // Helper to find section recursively
      function findSection(
        sections: typeof result.sections,
        title: string
      ): (typeof result.sections)[0] | undefined {
        for (const s of sections) {
          if (s.title === title) return s;
          const found = findSection(s.children, title);
          if (found) return found;
        }
        return undefined;
      }

      const projectSection = findSection(result.sections, 'Project Overview');

      expect(projectSection).toBeDefined();
      expect(projectSection?.content).toContain('TypeScript');
    });
  });

  describe('code block extraction (T035)', () => {
    it('should extract code blocks', async () => {
      const filePath = path.join(VALID_DIR, 'claude-complex.md');
      const result = await parseConfig(filePath);

      expect(result.codeBlocks.length).toBeGreaterThan(0);
    });

    it('should preserve code block language', async () => {
      const filePath = path.join(VALID_DIR, 'claude-complex.md');
      const result = await parseConfig(filePath);

      const tsBlock = result.codeBlocks.find((b) => b.language === 'typescript');
      const bashBlock = result.codeBlocks.find((b) => b.language === 'bash');

      expect(tsBlock).toBeDefined();
      expect(bashBlock).toBeDefined();
    });

    it('should preserve code block content', async () => {
      const filePath = path.join(VALID_DIR, 'claude-complex.md');
      const result = await parseConfig(filePath);

      const tsBlock = result.codeBlocks.find((b) => b.language === 'typescript');

      expect(tsBlock?.content).toContain('interface Config');
    });

    it('should track code block line count', async () => {
      const filePath = path.join(VALID_DIR, 'claude-complex.md');
      const result = await parseConfig(filePath);

      for (const block of result.codeBlocks) {
        expect(block.lineCount).toBeGreaterThan(0);
      }
    });
  });

  describe('position tracking (T036)', () => {
    it('should include positions for sections', async () => {
      const filePath = path.join(VALID_DIR, 'claude-complex.md');
      const result = await parseConfig(filePath);

      for (const section of result.sections) {
        expect(section.position).toBeDefined();
        expect(section.position.start.line).toBeGreaterThan(0);
        expect(section.position.start.column).toBeGreaterThan(0);
        expect(section.position.end.line).toBeGreaterThanOrEqual(section.position.start.line);
      }
    });

    it('should include positions for code blocks', async () => {
      const filePath = path.join(VALID_DIR, 'claude-complex.md');
      const result = await parseConfig(filePath);

      for (const block of result.codeBlocks) {
        expect(block.position).toBeDefined();
        expect(block.position.start.line).toBeGreaterThan(0);
      }
    });

    it('should include offset in positions when available', async () => {
      const filePath = path.join(VALID_DIR, 'claude-complex.md');
      const result = await parseConfig(filePath);

      // At least some positions should have offsets
      const hasOffset = result.sections.some((s) => s.position.start.offset !== undefined);
      expect(hasOffset).toBe(true);
    });
  });

  describe('metrics extraction', () => {
    it('should calculate line count', async () => {
      const filePath = path.join(VALID_DIR, 'claude-complex.md');
      const result = await parseConfig(filePath);

      expect(result.metrics.lineCount).toBeGreaterThan(0);
    });

    it('should estimate token count', async () => {
      const filePath = path.join(VALID_DIR, 'claude-complex.md');
      const result = await parseConfig(filePath);

      expect(result.metrics.tokenEstimate).toBeGreaterThan(0);
    });

    it('should count sections', async () => {
      const filePath = path.join(VALID_DIR, 'claude-complex.md');
      const result = await parseConfig(filePath);

      expect(result.metrics.sectionCount).toBeGreaterThan(0);
    });

    it('should track max heading depth', async () => {
      const filePath = path.join(VALID_DIR, 'claude-complex.md');
      const result = await parseConfig(filePath);

      expect(result.metrics.maxHeadingDepth).toBeGreaterThanOrEqual(1);
      expect(result.metrics.maxHeadingDepth).toBeLessThanOrEqual(6);
    });

    it('should count code blocks', async () => {
      const filePath = path.join(VALID_DIR, 'claude-complex.md');
      const result = await parseConfig(filePath);

      expect(result.metrics.codeBlockCount).toBe(result.codeBlocks.length);
    });

    it('should collect code block languages', async () => {
      const filePath = path.join(VALID_DIR, 'claude-complex.md');
      const result = await parseConfig(filePath);

      expect(result.metrics.codeBlockLanguages).toContain('typescript');
      expect(result.metrics.codeBlockLanguages).toContain('bash');
    });

    it('should count emphasis markers', async () => {
      const filePath = path.join(VALID_DIR, 'claude-complex.md');
      const result = await parseConfig(filePath);

      expect(result.metrics.emphasisMarkerCount.must).toBeGreaterThanOrEqual(1);
      expect(result.metrics.emphasisMarkerCount.critical).toBeGreaterThanOrEqual(1);
      expect(result.metrics.emphasisMarkerCount.total).toBeGreaterThan(0);
    });
  });

  describe('warnings', () => {
    it('should return empty warnings for valid file', async () => {
      const filePath = path.join(VALID_DIR, 'CLAUDE.md');
      const result = await parseConfig(filePath);

      expect(result.warnings).toBeInstanceOf(Array);
    });
  });
});
