/**
 * T022: Unit tests for scan command
 *
 * Tests US-004: Scan for AI Configurations
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanForConfigs, CONFIG_PATTERNS, getConfigType } from '../../../../src/cli/commands/scan';

describe('scan command', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'agentlint-scan-test-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('CONFIG_PATTERNS', () => {
    test('includes CLAUDE.md pattern', () => {
      expect(CONFIG_PATTERNS.some((p) => p.pattern.includes('CLAUDE.md'))).toBe(true);
    });

    test('includes .cursorrules pattern', () => {
      expect(CONFIG_PATTERNS.some((p) => p.pattern.includes('.cursorrules'))).toBe(true);
    });

    test('includes GitHub Copilot patterns', () => {
      expect(CONFIG_PATTERNS.some((p) => p.type === 'github-copilot')).toBe(true);
    });

    test('includes Continue.dev patterns', () => {
      expect(CONFIG_PATTERNS.some((p) => p.type === 'continue')).toBe(true);
    });

    test('each pattern has type, pattern, and description', () => {
      for (const config of CONFIG_PATTERNS) {
        expect(config.type).toBeDefined();
        expect(config.pattern).toBeDefined();
        expect(config.description).toBeDefined();
      }
    });
  });

  describe('getConfigType', () => {
    test('identifies CLAUDE.md as claude-code', () => {
      expect(getConfigType('CLAUDE.md')).toBe('claude-code');
    });

    test('identifies .cursorrules as cursor', () => {
      expect(getConfigType('.cursorrules')).toBe('cursor');
    });

    test('identifies .github/copilot-instructions.md as github-copilot', () => {
      expect(getConfigType('.github/copilot-instructions.md')).toBe('github-copilot');
    });

    test('identifies .continue/config.json as continue', () => {
      expect(getConfigType('.continue/config.json')).toBe('continue');
    });

    test('returns unknown for unrecognized files', () => {
      expect(getConfigType('random.txt')).toBe('unknown');
    });
  });

  describe('scanForConfigs', () => {
    test('returns empty array for directory with no configs', async () => {
      const result = await scanForConfigs(testDir);
      expect(result.configs).toEqual([]);
      expect(result.directory).toBe(testDir);
    });

    test('finds CLAUDE.md in directory', async () => {
      await writeFile(join(testDir, 'CLAUDE.md'), '# Claude Instructions');

      const result = await scanForConfigs(testDir);
      expect(result.configs.length).toBe(1);
      expect(result.configs[0]?.type).toBe('claude-code');
      expect(result.configs[0]?.path).toContain('CLAUDE.md');
    });

    test('finds .cursorrules in directory', async () => {
      await writeFile(join(testDir, '.cursorrules'), 'cursor rules');

      const result = await scanForConfigs(testDir);
      expect(result.configs.length).toBe(1);
      expect(result.configs[0]?.type).toBe('cursor');
    });

    test('finds GitHub Copilot config', async () => {
      await mkdir(join(testDir, '.github'), { recursive: true });
      await writeFile(join(testDir, '.github', 'copilot-instructions.md'), '# Copilot');

      const result = await scanForConfigs(testDir);
      expect(result.configs.length).toBe(1);
      expect(result.configs[0]?.type).toBe('github-copilot');
    });

    test('finds Continue.dev config', async () => {
      await mkdir(join(testDir, '.continue'), { recursive: true });
      await writeFile(join(testDir, '.continue', 'config.json'), '{}');

      const result = await scanForConfigs(testDir);
      expect(result.configs.length).toBe(1);
      expect(result.configs[0]?.type).toBe('continue');
    });

    test('finds multiple config types', async () => {
      await writeFile(join(testDir, 'CLAUDE.md'), '# Claude');
      await writeFile(join(testDir, '.cursorrules'), 'cursor');
      await mkdir(join(testDir, '.github'), { recursive: true });
      await writeFile(join(testDir, '.github', 'copilot-instructions.md'), '# Copilot');

      const result = await scanForConfigs(testDir);
      expect(result.configs.length).toBe(3);

      const types = result.configs.map((c) => c.type);
      expect(types).toContain('claude-code');
      expect(types).toContain('cursor');
      expect(types).toContain('github-copilot');
    });

    test('includes file size in result', async () => {
      const content = '# Claude Instructions\n\nSome content here';
      await writeFile(join(testDir, 'CLAUDE.md'), content);

      const result = await scanForConfigs(testDir);
      expect(result.configs[0]?.size).toBe(content.length);
    });

    test('includes relative path from scan directory', async () => {
      await writeFile(join(testDir, 'CLAUDE.md'), '# Claude');

      const result = await scanForConfigs(testDir);
      expect(result.configs[0]?.relativePath).toBe('CLAUDE.md');
    });

    test('handles nested config files', async () => {
      await mkdir(join(testDir, '.github'), { recursive: true });
      await writeFile(join(testDir, '.github', 'copilot-instructions.md'), '# Copilot');

      const result = await scanForConfigs(testDir);
      expect(result.configs[0]?.relativePath).toBe('.github/copilot-instructions.md');
    });
  });

  describe('ScanResult', () => {
    test('has directory property', async () => {
      const result = await scanForConfigs(testDir);
      expect(result.directory).toBe(testDir);
    });

    test('has configs array', async () => {
      const result = await scanForConfigs(testDir);
      expect(Array.isArray(result.configs)).toBe(true);
    });

    test('has scannedAt timestamp', async () => {
      const before = new Date();
      const result = await scanForConfigs(testDir);
      const after = new Date();

      expect(new Date(result.scannedAt).getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(new Date(result.scannedAt).getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });
});
