/**
 * T030: Unit tests for settings.json parsing
 *
 * Tests the parseConfig() function for parsing .claude/settings.json files.
 *
 * @module tests/unit/tools/config/parse-settings.test.ts
 */

import { describe, it, expect } from 'bun:test';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { parseSettingsConfig } from '../../../../src/tools/config/parse-config';

// Test fixture paths
const FIXTURES_DIR = path.join(__dirname, '../../../fixtures/configs');
const VALID_DIR = path.join(FIXTURES_DIR, 'valid');
const MALFORMED_DIR = path.join(FIXTURES_DIR, 'malformed');

describe('parseSettingsConfig', () => {
  describe('valid settings parsing', () => {
    it('should parse valid settings.json file', async () => {
      const filePath = path.join(VALID_DIR, 'settings.json');
      const result = await parseSettingsConfig(filePath);

      expect(result).toBeDefined();
      expect(result.file.path).toBe(filePath);
      expect(result.file.type).toBe('claude-settings');
    });

    it('should extract model setting', async () => {
      const filePath = path.join(VALID_DIR, 'settings.json');
      const result = await parseSettingsConfig(filePath);

      // Settings are stored in frontmatter for JSON configs
      expect(result.frontmatter).toBeDefined();
      expect(result.frontmatter?.model).toBe('claude-sonnet-4-20250514');
    });

    it('should extract permissions object', async () => {
      const filePath = path.join(VALID_DIR, 'settings.json');
      const result = await parseSettingsConfig(filePath);

      const permissions = result.frontmatter?.permissions as Record<string, boolean>;
      expect(permissions).toBeDefined();
      expect(permissions.allow_file_write).toBe(true);
      expect(permissions.allow_shell_commands).toBe(true);
    });

    it('should extract context settings', async () => {
      const filePath = path.join(VALID_DIR, 'settings.json');
      const result = await parseSettingsConfig(filePath);

      const context = result.frontmatter?.context as Record<string, number>;
      expect(context).toBeDefined();
      expect(context.max_tokens).toBe(100000);
    });

    it('should preserve raw content', async () => {
      const filePath = path.join(VALID_DIR, 'settings.json');
      const expectedContent = fs.readFileSync(filePath, 'utf-8');
      const result = await parseSettingsConfig(filePath);

      expect(result.raw).toBe(expectedContent);
    });

    it('should set correct file metadata', async () => {
      const filePath = path.join(VALID_DIR, 'settings.json');
      const result = await parseSettingsConfig(filePath);

      expect(result.file.type).toBe('claude-settings');
      expect(result.file.actType).toBe('claude-code');
      expect(result.file.size).toBeGreaterThan(0);
    });
  });

  describe('settings metrics', () => {
    it('should calculate line count', async () => {
      const filePath = path.join(VALID_DIR, 'settings.json');
      const result = await parseSettingsConfig(filePath);

      expect(result.metrics.lineCount).toBeGreaterThan(0);
    });

    it('should estimate token count', async () => {
      const filePath = path.join(VALID_DIR, 'settings.json');
      const result = await parseSettingsConfig(filePath);

      expect(result.metrics.tokenEstimate).toBeGreaterThan(0);
    });

    it('should have zero sections for JSON', async () => {
      const filePath = path.join(VALID_DIR, 'settings.json');
      const result = await parseSettingsConfig(filePath);

      // JSON configs don't have markdown sections
      expect(result.sections.length).toBe(0);
    });

    it('should have zero code blocks for JSON', async () => {
      const filePath = path.join(VALID_DIR, 'settings.json');
      const result = await parseSettingsConfig(filePath);

      // JSON configs don't have code blocks
      expect(result.codeBlocks.length).toBe(0);
    });
  });

  describe('invalid settings handling', () => {
    it('should handle invalid JSON gracefully', async () => {
      const filePath = path.join(MALFORMED_DIR, 'invalid-settings.json');

      // Should not throw, should return partial result or error in warnings
      const result = await parseSettingsConfig(filePath);

      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should include parse error in warnings', async () => {
      const filePath = path.join(MALFORMED_DIR, 'invalid-settings.json');
      const result = await parseSettingsConfig(filePath);

      const hasParseError = result.warnings.some(
        (w) => w.code === 'INVALID_YAML' || w.message.includes('parse')
      );
      expect(hasParseError).toBe(true);
    });
  });

  describe('validation warnings', () => {
    it('should warn on unknown model names', async () => {
      // Create a temp file with unknown model
      const tempPath = path.join(VALID_DIR, 'temp-unknown-model.json');
      fs.writeFileSync(
        tempPath,
        JSON.stringify({ model: 'unknown-model-name' })
      );

      try {
        const result = await parseSettingsConfig(tempPath);

        const hasModelWarning = result.warnings.some((w) =>
          w.message.includes('model')
        );
        expect(hasModelWarning).toBe(true);
      } finally {
        fs.unlinkSync(tempPath);
      }
    });
  });
});
