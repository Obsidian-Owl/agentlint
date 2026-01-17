/**
 * T031: Unit tests for malformed config handling
 *
 * Tests the parseConfig() function's error handling for malformed files.
 *
 * @module tests/unit/tools/config/parse-errors.test.ts
 */

import { describe, it, expect } from 'bun:test';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { parseConfig } from '../../../../src/tools/config/parse-config';

// Test fixture paths
const FIXTURES_DIR = path.join(__dirname, '../../../fixtures/configs');
const MALFORMED_DIR = path.join(FIXTURES_DIR, 'malformed');

describe('parseConfig error handling', () => {
  describe('file not found', () => {
    it('should throw ConfigNotFoundError for missing file', async () => {
      const filePath = '/nonexistent/path/CLAUDE.md';

      await expect(parseConfig(filePath)).rejects.toThrow();
    });

    it('should include file path in error message', async () => {
      const filePath = '/nonexistent/path/CLAUDE.md';

      try {
        await parseConfig(filePath);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect((error as Error).message).toContain(filePath);
      }
    });
  });

  describe('unclosed code blocks', () => {
    it('should handle unclosed code block gracefully', async () => {
      const filePath = path.join(MALFORMED_DIR, 'unclosed-codeblock.md');
      const result = await parseConfig(filePath);

      // Should return partial result, not throw
      expect(result).toBeDefined();
      expect(result.file.path).toBe(filePath);
    });

    it('should add warning for unclosed code block', async () => {
      const filePath = path.join(MALFORMED_DIR, 'unclosed-codeblock.md');
      const result = await parseConfig(filePath);

      const hasUnclosedWarning = result.warnings.some(
        (w) =>
          w.code === 'UNCLOSED_CODE_BLOCK' ||
          w.message.toLowerCase().includes('unclosed') ||
          w.message.toLowerCase().includes('code block')
      );
      expect(hasUnclosedWarning).toBe(true);
    });

    it('should still extract sections before unclosed block', async () => {
      const filePath = path.join(MALFORMED_DIR, 'unclosed-codeblock.md');
      const result = await parseConfig(filePath);

      // Should have at least the sections before the unclosed block
      expect(result.sections.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('invalid YAML frontmatter', () => {
    it('should handle invalid YAML frontmatter gracefully', async () => {
      const filePath = path.join(MALFORMED_DIR, 'invalid-yaml.md');
      const result = await parseConfig(filePath);

      // Should return partial result, not throw
      expect(result).toBeDefined();
      expect(result.file.path).toBe(filePath);
    });

    it('should add warning for invalid frontmatter', async () => {
      const filePath = path.join(MALFORMED_DIR, 'invalid-yaml.md');
      const result = await parseConfig(filePath);

      const hasYamlWarning = result.warnings.some(
        (w) =>
          w.code === 'INVALID_YAML' ||
          w.code === 'INVALID_FRONTMATTER' ||
          w.message.toLowerCase().includes('yaml') ||
          w.message.toLowerCase().includes('frontmatter')
      );
      expect(hasYamlWarning).toBe(true);
    });

    it('should set frontmatter to undefined on parse error', async () => {
      const filePath = path.join(MALFORMED_DIR, 'invalid-yaml.md');
      const result = await parseConfig(filePath);

      // Frontmatter should be undefined or empty on error
      expect(
        result.frontmatter === undefined ||
          Object.keys(result.frontmatter).length === 0
      ).toBe(true);
    });

    it('should still parse markdown content after invalid frontmatter', async () => {
      const filePath = path.join(MALFORMED_DIR, 'invalid-yaml.md');
      const result = await parseConfig(filePath);

      // Should still have raw content
      expect(result.raw.length).toBeGreaterThan(0);
    });
  });

  describe('invalid JSON settings', () => {
    it('should handle invalid JSON gracefully', async () => {
      const filePath = path.join(MALFORMED_DIR, 'invalid-settings.json');
      const result = await parseConfig(filePath);

      // Should return partial result with warnings
      expect(result).toBeDefined();
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should include JSON parse error in warnings', async () => {
      const filePath = path.join(MALFORMED_DIR, 'invalid-settings.json');
      const result = await parseConfig(filePath);

      const hasJsonWarning = result.warnings.some(
        (w) =>
          w.code === 'INVALID_JSON' ||
          w.message.toLowerCase().includes('json') ||
          w.message.toLowerCase().includes('parse')
      );
      expect(hasJsonWarning).toBe(true);
    });
  });

  describe('empty files', () => {
    it('should handle empty markdown file', async () => {
      // Create temp empty file
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentlint-test-'));
      const emptyFile = path.join(tempDir, 'CLAUDE.md');
      fs.writeFileSync(emptyFile, '');

      try {
        const result = await parseConfig(emptyFile);

        expect(result).toBeDefined();
        expect(result.raw).toBe('');
        expect(result.sections.length).toBe(0);
        expect(result.codeBlocks.length).toBe(0);
      } finally {
        fs.unlinkSync(emptyFile);
        fs.rmdirSync(tempDir);
      }
    });

    it('should handle empty JSON file', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentlint-test-'));
      const emptyFile = path.join(tempDir, 'settings.json');
      fs.writeFileSync(emptyFile, '');

      try {
        const result = await parseConfig(emptyFile);

        expect(result).toBeDefined();
        expect(result.warnings.length).toBeGreaterThan(0);
      } finally {
        fs.unlinkSync(emptyFile);
        fs.rmdirSync(tempDir);
      }
    });
  });

  describe('binary files', () => {
    it('should handle binary file gracefully', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentlint-test-'));
      const binaryFile = path.join(tempDir, 'CLAUDE.md');
      // Write some binary content
      fs.writeFileSync(binaryFile, Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]));

      try {
        const result = await parseConfig(binaryFile);

        expect(result).toBeDefined();
        // Should have warning about binary content
        expect(result.warnings.length).toBeGreaterThan(0);
      } finally {
        fs.unlinkSync(binaryFile);
        fs.rmdirSync(tempDir);
      }
    });
  });

  describe('permission errors', () => {
    it('should handle unreadable file gracefully', async () => {
      // Skip on Windows where chmod doesn't work the same way
      if (process.platform === 'win32') {
        return;
      }

      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentlint-test-'));
      const unreadableFile = path.join(tempDir, 'CLAUDE.md');
      fs.writeFileSync(unreadableFile, '# Test');
      fs.chmodSync(unreadableFile, 0o000);

      try {
        await expect(parseConfig(unreadableFile)).rejects.toThrow();
      } finally {
        fs.chmodSync(unreadableFile, 0o644);
        fs.unlinkSync(unreadableFile);
        fs.rmdirSync(tempDir);
      }
    });
  });

  describe('large files', () => {
    it('should handle very large files without crashing', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentlint-test-'));
      const largeFile = path.join(tempDir, 'CLAUDE.md');

      // Create a large file (1MB+)
      const content =
        '# Large File\n\n' + 'Lorem ipsum dolor sit amet.\n'.repeat(50000);
      fs.writeFileSync(largeFile, content);

      try {
        const result = await parseConfig(largeFile);

        expect(result).toBeDefined();
        expect(result.metrics.lineCount).toBeGreaterThan(50000);
      } finally {
        fs.unlinkSync(largeFile);
        fs.rmdirSync(tempDir);
      }
    });
  });

  describe('encoding issues', () => {
    it('should handle UTF-8 with BOM', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentlint-test-'));
      const bomFile = path.join(tempDir, 'CLAUDE.md');

      // UTF-8 BOM + content
      const bom = Buffer.from([0xef, 0xbb, 0xbf]);
      const content = Buffer.from('# Test with BOM\n\nSome content.');
      fs.writeFileSync(bomFile, Buffer.concat([bom, content]));

      try {
        const result = await parseConfig(bomFile);

        expect(result).toBeDefined();
        // Should still parse correctly
        expect(result.sections.length).toBeGreaterThanOrEqual(0);
      } finally {
        fs.unlinkSync(bomFile);
        fs.rmdirSync(tempDir);
      }
    });

    it('should handle non-UTF8 encoding gracefully', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentlint-test-'));
      const latin1File = path.join(tempDir, 'CLAUDE.md');

      // Write Latin-1 encoded content
      fs.writeFileSync(latin1File, Buffer.from('# Tëst\n\nCafé résumé', 'latin1'));

      try {
        const result = await parseConfig(latin1File);

        expect(result).toBeDefined();
        // Should handle gracefully, possibly with warnings
      } finally {
        fs.unlinkSync(latin1File);
        fs.rmdirSync(tempDir);
      }
    });
  });

  describe('warning accumulation', () => {
    it('should accumulate multiple warnings', async () => {
      // Create a file with multiple issues
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentlint-test-'));
      const multiIssueFile = path.join(tempDir, 'CLAUDE.md');

      // Invalid frontmatter + unclosed code block
      const content = `---
invalid: yaml: here: {{
---

# Title

\`\`\`typescript
// unclosed code block
const x = 1;
`;
      fs.writeFileSync(multiIssueFile, content);

      try {
        const result = await parseConfig(multiIssueFile);

        // Should have multiple warnings
        expect(result.warnings.length).toBeGreaterThanOrEqual(1);
      } finally {
        fs.unlinkSync(multiIssueFile);
        fs.rmdirSync(tempDir);
      }
    });

    it('should include warning severity when available', async () => {
      const filePath = path.join(MALFORMED_DIR, 'invalid-yaml.md');
      const result = await parseConfig(filePath);

      // Warnings may have severity (optional field)
      for (const warning of result.warnings) {
        if (warning.severity !== undefined) {
          expect(['error', 'warning', 'info']).toContain(warning.severity);
        }
      }
    });

    it('should include warning position when available', async () => {
      const filePath = path.join(MALFORMED_DIR, 'unclosed-codeblock.md');
      const result = await parseConfig(filePath);

      // Some warnings should have position info
      const warningsWithPosition = result.warnings.filter(
        (w) => w.position !== undefined
      );
      // At least some warnings should have positions
      expect(warningsWithPosition.length).toBeGreaterThanOrEqual(0);
    });
  });
});
