/**
 * T023: Integration tests for scan command
 *
 * Tests US-004: End-to-end scan command behavior
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { $ } from 'bun';

describe('scan command integration', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'agentlint-scan-integration-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('terminal output', () => {
    // Note: When piped (non-TTY), output defaults to JSON per FR-012.
    // Use --plain flag to test terminal-like output.

    test('shows "no configs found" message for empty directory', async () => {
      const result = await $`bun run src/cli.ts scan -d ${testDir} --plain`.text();
      expect(result).toContain('No AI configuration files found');
    });

    test('shows helpful message when no configs found', async () => {
      const result = await $`bun run src/cli.ts scan -d ${testDir} --plain`.text();
      expect(result.toLowerCase()).toContain('create');
    });

    test('lists found config files', async () => {
      await writeFile(join(testDir, 'CLAUDE.md'), '# Claude Instructions');

      const result = await $`bun run src/cli.ts scan -d ${testDir} --plain`.text();
      expect(result).toContain('CLAUDE.md');
      expect(result).toContain('Claude Code');
    });

    test('shows config type for each file', async () => {
      await writeFile(join(testDir, '.cursorrules'), 'rules');

      const result = await $`bun run src/cli.ts scan -d ${testDir} --plain`.text();
      expect(result).toContain('Cursor');
    });

    test('shows multiple configs', async () => {
      await writeFile(join(testDir, 'CLAUDE.md'), '# Claude');
      await writeFile(join(testDir, '.cursorrules'), 'cursor');

      const result = await $`bun run src/cli.ts scan -d ${testDir} --plain`.text();
      expect(result).toContain('CLAUDE.md');
      expect(result).toContain('.cursorrules');
    });

    test('shows summary count', async () => {
      await writeFile(join(testDir, 'CLAUDE.md'), '# Claude');
      await writeFile(join(testDir, '.cursorrules'), 'cursor');

      const result = await $`bun run src/cli.ts scan -d ${testDir} --plain`.text();
      expect(result).toMatch(/found\s*2/i);
    });

    test('defaults to JSON when piped (non-TTY)', async () => {
      // Without --plain, piped output should default to JSON (FR-012)
      await writeFile(join(testDir, 'CLAUDE.md'), '# Claude');
      const result = await $`bun run src/cli.ts scan -d ${testDir}`.text();
      const json = JSON.parse(result);
      expect(json.configs).toBeDefined();
    });
  });

  describe('JSON output', () => {
    test('outputs valid JSON with --json flag', async () => {
      const result = await $`bun run src/cli.ts scan -d ${testDir} --json`.text();
      const json = JSON.parse(result);
      expect(json).toBeDefined();
    });

    test('JSON has configs array', async () => {
      const result = await $`bun run src/cli.ts scan -d ${testDir} --json`.text();
      const json = JSON.parse(result);
      expect(Array.isArray(json.configs)).toBe(true);
    });

    test('JSON has directory property', async () => {
      const result = await $`bun run src/cli.ts scan -d ${testDir} --json`.text();
      const json = JSON.parse(result);
      expect(json.directory).toBe(testDir);
    });

    test('JSON includes found configs', async () => {
      await writeFile(join(testDir, 'CLAUDE.md'), '# Claude');

      const result = await $`bun run src/cli.ts scan -d ${testDir} --json`.text();
      const json = JSON.parse(result);
      expect(json.configs.length).toBe(1);
      expect(json.configs[0].type).toBe('claude-code');
    });

    test('JSON includes scannedAt timestamp', async () => {
      const result = await $`bun run src/cli.ts scan -d ${testDir} --json`.text();
      const json = JSON.parse(result);
      expect(json.scannedAt).toBeDefined();
      // Should be ISO date string
      expect(() => new Date(json.scannedAt)).not.toThrow();
    });
  });

  describe('directory option', () => {
    test('scans current directory by default', async () => {
      // The CLI should work when run from project root (has CLAUDE.md)
      const result = await $`bun run src/cli.ts scan`.text();
      expect(result).toContain('CLAUDE.md');
    });

    test('scans specified directory with -d flag', async () => {
      await writeFile(join(testDir, 'CLAUDE.md'), '# Test');

      const result = await $`bun run src/cli.ts scan -d ${testDir}`.text();
      expect(result).toContain('CLAUDE.md');
    });

    test('scans specified directory with --directory flag', async () => {
      await writeFile(join(testDir, 'CLAUDE.md'), '# Test');

      const result = await $`bun run src/cli.ts scan --directory ${testDir}`.text();
      expect(result).toContain('CLAUDE.md');
    });

    test('shows error for non-existent directory', async () => {
      const proc = Bun.spawn(['bun', 'run', 'src/cli.ts', 'scan', '-d', '/nonexistent/path'], {
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      expect(stderr.toLowerCase()).toContain('not found');
      expect(exitCode).not.toBe(0);
    });
  });

  describe('exit codes', () => {
    test('exits with 0 when configs found', async () => {
      await writeFile(join(testDir, 'CLAUDE.md'), '# Claude');

      const proc = Bun.spawn(['bun', 'run', 'src/cli.ts', 'scan', '-d', testDir], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const exitCode = await proc.exited;

      expect(exitCode).toBe(0);
    });

    test('exits with 0 when no configs found (not an error)', async () => {
      const proc = Bun.spawn(['bun', 'run', 'src/cli.ts', 'scan', '-d', testDir], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const exitCode = await proc.exited;

      expect(exitCode).toBe(0);
    });
  });
});
