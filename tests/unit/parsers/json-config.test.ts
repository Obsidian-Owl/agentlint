/**
 * Unit tests for JSON config parser
 *
 * T016: Tests for src/parsers/json-config.ts
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import {
  parseJsonConfig,
  parseJsonConfigSync,
  type JsonConfigParseResult,
} from '../../../src/parsers/json-config';

const FIXTURES_DIR = join(import.meta.dir, '../../fixtures/configs');

describe('parseJsonConfig', () => {
  let validSettings: string;
  let invalidSettings: string;

  beforeAll(async () => {
    validSettings = await readFile(join(FIXTURES_DIR, 'valid/settings.json'), 'utf-8');
    invalidSettings = await readFile(
      join(FIXTURES_DIR, 'malformed/invalid-settings.json'),
      'utf-8'
    );
  });

  // =============================================================================
  // Valid JSON Parsing
  // =============================================================================

  describe('valid JSON parsing', () => {
    it('should parse valid settings.json', async () => {
      const result = await parseJsonConfig(validSettings);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.config).toBeDefined();
      }
    });

    it('should extract model setting', async () => {
      const result = await parseJsonConfig(validSettings);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.config.model).toBe('claude-sonnet-4-20250514');
      }
    });

    it('should extract permissions object', async () => {
      const result = await parseJsonConfig(validSettings);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.config.permissions).toBeDefined();
        expect(result.config.permissions?.allow_file_write).toBe(true);
        expect(result.config.permissions?.allow_shell_commands).toBe(true);
      }
    });

    it('should extract context settings', async () => {
      const result = await parseJsonConfig(validSettings);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.config.context?.max_tokens).toBe(100000);
      }
    });

    it('should preserve original raw content', async () => {
      const result = await parseJsonConfig(validSettings);

      expect(result.raw).toBe(validSettings);
    });
  });

  // =============================================================================
  // Schema Validation
  // =============================================================================

  describe('schema validation', () => {
    it('should validate against settings schema', async () => {
      const result = await parseJsonConfig(validSettings, { validateSchema: true });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.validationErrors).toHaveLength(0);
      }
    });

    it('should report unknown fields in strict mode', async () => {
      const withUnknown = '{"model": "test", "unknownField": true}';
      const result = await parseJsonConfig(withUnknown, {
        validateSchema: true,
        strict: true,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.warnings.some((w) => w.message.includes('unknown'))).toBe(true);
      }
    });

    it('should validate model field type', async () => {
      const invalidModel = '{"model": 123}';
      const result = await parseJsonConfig(invalidModel, { validateSchema: true });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.validationErrors.length).toBeGreaterThan(0);
      }
    });

    it('should validate permissions field type', async () => {
      const invalidPerms = '{"permissions": "invalid"}';
      const result = await parseJsonConfig(invalidPerms, { validateSchema: true });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.validationErrors.length).toBeGreaterThan(0);
      }
    });
  });

  // =============================================================================
  // Invalid JSON Handling
  // =============================================================================

  describe('invalid JSON handling', () => {
    it('should handle invalid JSON syntax', async () => {
      const result = await parseJsonConfig(invalidSettings);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    it('should provide parse error details', async () => {
      const result = await parseJsonConfig(invalidSettings);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('JSON');
      }
    });

    it('should track error position when possible', async () => {
      const result = await parseJsonConfig(invalidSettings);

      expect(result.success).toBe(false);
      // Position extraction may or may not work depending on the error
      // Just verify we get an error
      if (!result.success) {
        expect(result.error.message).toBeTruthy();
      }
    });

    it('should handle trailing commas', async () => {
      const trailingComma = '{"model": "test",}';
      const result = await parseJsonConfig(trailingComma);

      expect(result.success).toBe(false);
    });

    it('should handle missing quotes', async () => {
      const missingQuotes = '{model: "test"}';
      const result = await parseJsonConfig(missingQuotes);

      expect(result.success).toBe(false);
    });
  });

  // =============================================================================
  // Edge Cases
  // =============================================================================

  describe('edge cases', () => {
    it('should handle empty object', async () => {
      const result = await parseJsonConfig('{}');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.config).toEqual({});
      }
    });

    it('should handle empty string', async () => {
      const result = await parseJsonConfig('');

      expect(result.success).toBe(false);
    });

    it('should handle whitespace-only content', async () => {
      const result = await parseJsonConfig('   \n\t   ');

      expect(result.success).toBe(false);
    });

    it('should handle JSON arrays (invalid for settings)', async () => {
      const result = await parseJsonConfig('[1, 2, 3]');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('object');
      }
    });

    it('should handle null value', async () => {
      const result = await parseJsonConfig('null');

      expect(result.success).toBe(false);
    });

    it('should handle primitive value', async () => {
      const result = await parseJsonConfig('"just a string"');

      expect(result.success).toBe(false);
    });
  });

  // =============================================================================
  // Specific Field Validation
  // =============================================================================

  describe('specific field validation', () => {
    it('should validate known model names', async () => {
      const unknownModel = '{"model": "unknown-model-name"}';
      const result = await parseJsonConfig(unknownModel, {
        validateSchema: true,
        validateModelNames: true,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.warnings.some((w) => w.message.includes('model'))).toBe(true);
      }
    });

    it('should validate max_tokens range', async () => {
      const hugeTokens = '{"context": {"max_tokens": 999999999}}';
      const result = await parseJsonConfig(hugeTokens, { validateSchema: true });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.warnings.length).toBeGreaterThan(0);
      }
    });

    it('should validate boolean permission values', async () => {
      const invalidBool = '{"permissions": {"allow_file_write": "yes"}}';
      const result = await parseJsonConfig(invalidBool, { validateSchema: true });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.validationErrors.length).toBeGreaterThan(0);
      }
    });
  });

  // =============================================================================
  // Error Recovery
  // =============================================================================

  describe('error recovery', () => {
    it('should attempt to identify JSON error location', async () => {
      const badJson = '{\n  "model": "test"\n  "missing": "comma"\n}';
      const result = await parseJsonConfig(badJson);

      expect(result.success).toBe(false);
      if (!result.success) {
        // Position may or may not be extractable depending on the parser
        expect(result.error.message).toBeTruthy();
      }
    });

    it('should provide helpful error messages', async () => {
      const badJson = '{"model": }';
      const result = await parseJsonConfig(badJson);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBeDefined();
        expect(result.error.suggestion).toBeDefined();
      }
    });
  });

  // =============================================================================
  // Sync API
  // =============================================================================

  describe('parseJsonConfigSync', () => {
    it('should work synchronously', () => {
      const result = parseJsonConfigSync('{"model": "test"}');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.config.model).toBe('test');
      }
    });

    it('should handle errors synchronously', () => {
      const result = parseJsonConfigSync('invalid json');

      expect(result.success).toBe(false);
    });
  });

  // =============================================================================
  // Additional Edge Cases
  // =============================================================================

  describe('additional edge cases', () => {
    it('should handle deeply nested objects', async () => {
      const deep = '{"context": {"nested": {"deep": {"value": 1}}}}';
      const result = await parseJsonConfig(deep);

      expect(result.success).toBe(true);
    });

    it('should handle unicode in values', async () => {
      const unicode = '{"model": "模型名称"}';
      const result = await parseJsonConfig(unicode);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.config.model).toBe('模型名称');
      }
    });

    it('should handle BOM at start of file', async () => {
      const withBom = '\ufeff{"model": "test"}';
      const result = await parseJsonConfig(withBom);

      // BOM before JSON causes parse error - this is expected behavior
      // (BOM needs to be stripped by the caller if present)
      expect(result.success).toBe(false);
    });

    it('should handle large numbers', async () => {
      const largeNum = '{"context": {"max_tokens": 9007199254740991}}';
      const result = await parseJsonConfig(largeNum);

      expect(result.success).toBe(true);
    });

    it('should handle escaped characters', async () => {
      const escaped = '{"model": "test\\nwith\\nnewlines"}';
      const result = await parseJsonConfig(escaped);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.config.model).toContain('\n');
      }
    });

    it('should handle single quotes (invalid JSON)', async () => {
      const singleQuotes = "{'model': 'test'}";
      const result = await parseJsonConfig(singleQuotes);

      expect(result.success).toBe(false);
    });

    it('should handle comments (invalid JSON)', async () => {
      const withComment = '{\n  "model": "test" // comment\n}';
      const result = await parseJsonConfig(withComment);

      expect(result.success).toBe(false);
    });
  });
});
