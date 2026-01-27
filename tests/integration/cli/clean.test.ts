/**
 * Integration tests for clean command
 *
 * Tests end-to-end clean command behavior via CLI invocation.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { $ } from 'bun';

describe('clean command integration', () => {
  let testDir: string;
  let agentlintDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'agentlint-clean-integration-'));
    agentlintDir = join(testDir, '.agentlint');
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('preview mode (default)', () => {
    test('shows nothing to clean when .agentlint does not exist', async () => {
      const result = await $`bun run src/cli.ts clean -d ${testDir} --plain`.text();
      expect(result).toContain('Nothing to clean');
    });

    test('shows preview of what would be removed', async () => {
      await mkdir(agentlintDir, { recursive: true });
      await writeFile(join(agentlintDir, 'test.db'), 'test data');

      const result = await $`bun run src/cli.ts clean -d ${testDir} --plain`.text();

      expect(result).toContain('Would remove');
      expect(result).toContain('.agentlint/');
      expect(result).toContain('Run with --force');
    });

    test('does not actually remove anything without --force', async () => {
      await mkdir(agentlintDir, { recursive: true });
      await writeFile(join(agentlintDir, 'test.db'), 'test data');

      await $`bun run src/cli.ts clean -d ${testDir} --plain`.text();

      expect(existsSync(agentlintDir)).toBe(true);
    });

    test('shows file count and size', async () => {
      await mkdir(agentlintDir, { recursive: true });
      await writeFile(join(agentlintDir, 'test.db'), 'test data');

      const result = await $`bun run src/cli.ts clean -d ${testDir} --plain`.text();

      expect(result).toMatch(/Files:\s*\d+/);
      expect(result).toMatch(/Size:\s*\d+/);
    });

    test('indicates backup will be created', async () => {
      await mkdir(agentlintDir, { recursive: true });
      await writeFile(join(agentlintDir, 'test.db'), 'test data');

      const result = await $`bun run src/cli.ts clean -d ${testDir} --plain`.text();

      expect(result).toContain('Backup will be created');
      expect(result).toContain('.agentlint/backups/backup-');
    });
  });

  describe('force mode', () => {
    test('actually removes .agentlint directory', async () => {
      await mkdir(agentlintDir, { recursive: true });
      await writeFile(join(agentlintDir, 'test.db'), 'test data');

      expect(existsSync(agentlintDir)).toBe(true);

      await $`bun run src/cli.ts clean -d ${testDir} --force --no-backup --plain`.text();

      expect(existsSync(agentlintDir)).toBe(false);
    });

    test('shows success message after cleaning', async () => {
      await mkdir(agentlintDir, { recursive: true });
      await writeFile(join(agentlintDir, 'test.db'), 'test data');

      const result =
        await $`bun run src/cli.ts clean -d ${testDir} --force --no-backup --plain`.text();

      expect(result).toContain('Removed');
      expect(result).toContain('.agentlint/');
    });

    test('creates backup before cleaning when backup enabled', async () => {
      await mkdir(agentlintDir, { recursive: true });
      await mkdir(join(agentlintDir, 'baselines'), { recursive: true });
      await writeFile(join(agentlintDir, 'test.db'), 'test data');

      const result = await $`bun run src/cli.ts clean -d ${testDir} --force --plain`.text();

      expect(result).toContain('Backup created');
      expect(existsSync(agentlintDir)).toBe(false);
    });

    test('skips backup with --no-backup flag', async () => {
      await mkdir(agentlintDir, { recursive: true });
      await writeFile(join(agentlintDir, 'test.db'), 'test data');

      const result =
        await $`bun run src/cli.ts clean -d ${testDir} --force --no-backup --plain`.text();

      expect(result).not.toContain('Backup created');
    });
  });

  describe('JSON output', () => {
    test('outputs valid JSON with --json flag in preview mode', async () => {
      await mkdir(agentlintDir, { recursive: true });
      await writeFile(join(agentlintDir, 'test.db'), 'test data');

      const result = await $`bun run src/cli.ts clean -d ${testDir} --json`.text();
      const json = JSON.parse(result);

      expect(json.status).toBe('preview');
      expect(json.targets).toBeDefined();
      expect(json.targets.length).toBeGreaterThan(0);
      expect(json.totalSize).toBeGreaterThan(0);
      expect(json.totalFiles).toBeGreaterThan(0);
    });

    test('outputs success JSON after cleaning', async () => {
      await mkdir(agentlintDir, { recursive: true });
      await writeFile(join(agentlintDir, 'test.db'), 'test data');

      const result =
        await $`bun run src/cli.ts clean -d ${testDir} --force --no-backup --json`.text();
      const json = JSON.parse(result);

      expect(json.status).toBe('success');
      expect(json.cleaned).toBeDefined();
      expect(json.cleaned.length).toBeGreaterThan(0);
    });

    test('outputs nothing-to-clean JSON when no .agentlint', async () => {
      const result = await $`bun run src/cli.ts clean -d ${testDir} --json`.text();
      const json = JSON.parse(result);

      expect(json.status).toBe('nothing-to-clean');
    }, 15000); // Extended timeout for CI environments
  });

  describe('help output', () => {
    test('shows help with --help flag', async () => {
      const result = await $`bun run src/cli.ts clean --help`.text();

      expect(result).toContain('Remove .agentlint state directory');
      expect(result).toContain('--force');
      expect(result).toContain('--no-backup');
      expect(result).toContain('--global');
    });

    test('shows examples in help', async () => {
      const result = await $`bun run src/cli.ts clean --help`.text();

      expect(result).toContain('Examples');
      expect(result).toContain('agentlint clean --force');
    });
  });
});
