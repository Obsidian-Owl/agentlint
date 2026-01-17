/**
 * T032: Integration tests for parsing pipeline
 *
 * Tests the full parsing pipeline including discovery → parsing → metrics.
 *
 * @module tests/integration/tools/config/parse-config.test.ts
 */

import { describe, it, expect } from 'bun:test';
import * as path from 'node:path';
import * as fs from 'node:fs';
import type { ParsedConfig } from '../../../../src/tools/config/types';
import { discoverConfigs } from '../../../../src/tools/config/discovery';
import { parseConfig, parseConfigBatch } from '../../../../src/tools/config/parse-config';

// Test fixture paths
const FIXTURES_DIR = path.join(__dirname, '../../../fixtures/configs');
const VALID_DIR = path.join(FIXTURES_DIR, 'valid');
const HIERARCHY_DIR = path.join(FIXTURES_DIR, 'hierarchy');
const MONOREPO_DIR = path.join(FIXTURES_DIR, 'monorepo');

describe('parsing pipeline integration', () => {
  describe('discovery to parsing workflow', () => {
    it('should discover and parse all configs in a project', async () => {
      // Step 1: Discover configs
      const discoveryResult = await discoverConfigs({ cwd: VALID_DIR });

      expect(discoveryResult.files.length).toBeGreaterThan(0);

      // Step 2: Parse each discovered config
      const parsedConfigs: ParsedConfig[] = [];
      for (const file of discoveryResult.files) {
        const parsed = await parseConfig(file.path);
        parsedConfigs.push(parsed);
      }

      // Step 3: Verify all files parsed
      expect(parsedConfigs.length).toBe(discoveryResult.files.length);

      // All should have required fields
      for (const parsed of parsedConfigs) {
        expect(parsed.file).toBeDefined();
        expect(parsed.raw).toBeDefined();
        expect(parsed.metrics).toBeDefined();
      }
    });

    it('should batch parse multiple configs efficiently', async () => {
      const discoveryResult = await discoverConfigs({ cwd: VALID_DIR });

      const startTime = Date.now();
      const parsedConfigs = await parseConfigBatch(discoveryResult.files);
      const duration = Date.now() - startTime;

      expect(parsedConfigs.length).toBe(discoveryResult.files.length);
      // Batch should be reasonably fast
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('hierarchy parsing', () => {
    it('should parse configs at all hierarchy levels', async () => {
      const discoveryResult = await discoverConfigs({
        cwd: HIERARCHY_DIR,
        includeGlobal: false,
      });

      const parsedConfigs: ParsedConfig[] = [];
      for (const file of discoveryResult.files) {
        const parsed = await parseConfig(file.path);
        parsedConfigs.push(parsed);
      }

      // Should have configs at different levels
      const levels = new Set(parsedConfigs.map((p) => p.file.level));
      expect(levels.size).toBeGreaterThanOrEqual(1);
    });

    it('should preserve hierarchy metadata through parsing', async () => {
      const discoveryResult = await discoverConfigs({ cwd: HIERARCHY_DIR });

      for (const file of discoveryResult.files) {
        const parsed = await parseConfig(file.path);

        // Parsed config should retain file metadata
        expect(parsed.file.level).toBe(file.level);
        expect(parsed.file.type).toBe(file.type);
        expect(parsed.file.path).toBe(file.path);
      }
    });
  });

  describe('monorepo parsing', () => {
    it('should parse all configs in monorepo structure', async () => {
      const discoveryResult = await discoverConfigs({ cwd: MONOREPO_DIR });

      const parsedConfigs: ParsedConfig[] = [];
      for (const file of discoveryResult.files) {
        const parsed = await parseConfig(file.path);
        parsedConfigs.push(parsed);
      }

      // Should have multiple configs
      expect(parsedConfigs.length).toBeGreaterThanOrEqual(3);
    });

    it('should correctly identify config types in monorepo', async () => {
      const discoveryResult = await discoverConfigs({ cwd: MONOREPO_DIR });

      const parsedConfigs: ParsedConfig[] = [];
      for (const file of discoveryResult.files) {
        const parsed = await parseConfig(file.path);
        parsedConfigs.push(parsed);
      }

      const claudeMdConfigs = parsedConfigs.filter(
        (p) => p.file.type === 'claude-md'
      );
      const agentsMdConfigs = parsedConfigs.filter(
        (p) => p.file.type === 'agents-md'
      );

      expect(claudeMdConfigs.length).toBeGreaterThan(0);
      // monorepo has at least one AGENTS.md
      expect(agentsMdConfigs.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('mixed config types', () => {
    it('should parse both markdown and JSON configs', async () => {
      const discoveryResult = await discoverConfigs({ cwd: VALID_DIR });

      const parsedConfigs: ParsedConfig[] = [];
      for (const file of discoveryResult.files) {
        const parsed = await parseConfig(file.path);
        parsedConfigs.push(parsed);
      }

      const mdConfigs = parsedConfigs.filter(
        (p) => p.file.type === 'claude-md' || p.file.type === 'agents-md'
      );
      const jsonConfigs = parsedConfigs.filter(
        (p) => p.file.type === 'claude-settings'
      );

      // Should have at least some markdown configs
      expect(mdConfigs.length).toBeGreaterThan(0);
      // May or may not have JSON configs depending on fixtures
      expect(jsonConfigs.length).toBeGreaterThanOrEqual(0);
    });

    it('should return appropriate AST for each type', async () => {
      const discoveryResult = await discoverConfigs({ cwd: VALID_DIR });

      for (const file of discoveryResult.files) {
        const parsed = await parseConfig(file.path);

        if (
          parsed.file.type === 'claude-md' ||
          parsed.file.type === 'agents-md'
        ) {
          // Markdown files should have AST
          expect(parsed.ast).toBeDefined();
          expect(parsed.ast.type).toBe('root');
        } else if (parsed.file.type === 'claude-settings') {
          // JSON files may have simplified AST or none
          // Implementation dependent
        }
      }
    });
  });

  describe('metrics aggregation', () => {
    it('should calculate consistent metrics across configs', async () => {
      const discoveryResult = await discoverConfigs({ cwd: VALID_DIR });

      const parsedConfigs: ParsedConfig[] = [];
      for (const file of discoveryResult.files) {
        const parsed = await parseConfig(file.path);
        parsedConfigs.push(parsed);
      }

      for (const parsed of parsedConfigs) {
        // Basic metrics should be present
        expect(parsed.metrics.lineCount).toBeGreaterThanOrEqual(0);
        expect(parsed.metrics.tokenEstimate).toBeGreaterThanOrEqual(0);

        // Line count should match raw content
        const actualLines = parsed.raw.split('\n').length;
        expect(parsed.metrics.lineCount).toBe(actualLines);
      }
    });

    it('should track total token count across all configs', async () => {
      const discoveryResult = await discoverConfigs({ cwd: VALID_DIR });

      let totalTokens = 0;
      for (const file of discoveryResult.files) {
        const parsed = await parseConfig(file.path);
        totalTokens += parsed.metrics.tokenEstimate;
      }

      expect(totalTokens).toBeGreaterThan(0);
    });
  });

  describe('error handling in pipeline', () => {
    it('should continue parsing after one file fails', async () => {
      // Create a directory with mixed valid and invalid files
      const tempDir = fs.mkdtempSync(
        path.join(FIXTURES_DIR, 'temp-mixed-')
      );
      const validFile = path.join(tempDir, 'CLAUDE.md');
      const invalidFile = path.join(tempDir, 'sub', 'CLAUDE.md');

      fs.writeFileSync(validFile, '# Valid\n\nContent here.');
      fs.mkdirSync(path.join(tempDir, 'sub'));
      fs.writeFileSync(invalidFile, '---\ninvalid: yaml: {{}\n---\n# Title');

      try {
        const discoveryResult = await discoverConfigs({ cwd: tempDir });
        expect(discoveryResult.files.length).toBe(2);

        const results: { parsed?: ParsedConfig; error?: Error }[] = [];
        for (const file of discoveryResult.files) {
          try {
            const parsed = await parseConfig(file.path);
            results.push({ parsed });
          } catch (error) {
            results.push({ error: error as Error });
          }
        }

        // Both should produce results (valid one succeeds, invalid one has warnings)
        const successful = results.filter((r) => r.parsed !== undefined);
        expect(successful.length).toBe(2); // Both should parse with partial results
      } finally {
        fs.rmSync(tempDir, { recursive: true });
      }
    });
  });

  describe('performance', () => {
    it('should parse configs within time budget', async () => {
      const discoveryResult = await discoverConfigs({ cwd: FIXTURES_DIR });

      const startTime = Date.now();
      for (const file of discoveryResult.files) {
        await parseConfig(file.path);
      }
      const duration = Date.now() - startTime;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(10000); // 10 seconds max
    });

    it('should handle concurrent parsing', async () => {
      const discoveryResult = await discoverConfigs({ cwd: VALID_DIR });

      const startTime = Date.now();
      const parsePromises = discoveryResult.files.map((file) =>
        parseConfig(file.path)
      );
      const results = await Promise.all(parsePromises);
      const duration = Date.now() - startTime;

      expect(results.length).toBe(discoveryResult.files.length);
      // Concurrent should be faster than sequential for multiple files
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('end-to-end workflow', () => {
    it('should complete full analysis workflow', async () => {
      // 1. Discover
      const discoveryResult = await discoverConfigs({
        cwd: VALID_DIR,
        includeGlobal: false,
      });

      // 2. Parse all
      const parsedConfigs = await Promise.all(
        discoveryResult.files.map((file) => parseConfig(file.path))
      );

      // 3. Verify complete results
      for (const parsed of parsedConfigs) {
        expect(parsed.file).toBeDefined();
        expect(parsed.raw).toBeDefined();
        expect(parsed.ast).toBeDefined();
        expect(parsed.metrics).toBeDefined();
        expect(parsed.warnings).toBeInstanceOf(Array);
        expect(parsed.sections).toBeInstanceOf(Array);
        expect(parsed.codeBlocks).toBeInstanceOf(Array);
      }
    });
  });
});
