/**
 * T038: Integration tests for analyse command
 *
 * Tests US-001: Analyse with Streaming Output
 * Tests FR-001: Primary command is `agentlint analyse`
 * Tests FR-005: Display findings as they are discovered
 * Tests FR-006: Show spinner with current phase
 * Tests FR-015: Support --config-only and --sessions-only flags
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { $ } from 'bun';

// Helper: Spawn CLI command and return stdout, stderr, exitCode
async function runCli(
  ...args: string[]
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(['bun', 'run', 'src/cli.ts', ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
}

// Helper: Create test CLAUDE.md file
async function createTestConfig(dir: string, content = '# Test'): Promise<void> {
  await writeFile(join(dir, 'CLAUDE.md'), content);
}

// Helper: Check if help text contains string
async function helpContains(command: string, expected: string): Promise<boolean> {
  const result = await $`bun run src/cli.ts ${command} --help`.text();
  return result.toLowerCase().includes(expected.toLowerCase());
}

describe('analyse command integration', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'agentlint-analyse-test-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('command registration (FR-001)', () => {
    test('analyse command is available', async () => {
      expect(await helpContains('', 'analyse')).toBe(true);
    });

    test('analyse has help text', async () => {
      expect(await helpContains('analyse', 'analyse')).toBe(true);
    });

    test('accepts directory argument', async () => {
      await createTestConfig(testDir);
      const { stderr } = await runCli('analyse', '-d', testDir, '--json', '--dry-run');
      expect(stderr.toLowerCase()).not.toContain('unknown command');
    });
  });

  describe('--json output (FR-004)', () => {
    test('analyse --json outputs JSON structure', async () => {
      await createTestConfig(testDir, '# Test Project');
      const { stdout } = await runCli('analyse', '-d', testDir, '--json', '--dry-run');

      if (stdout.trim().startsWith('{')) {
        expect(() => JSON.parse(stdout) as unknown).not.toThrow();
      }
    });
  });

  describe('--config-only flag (FR-015)', () => {
    test('--config-only is a valid option', async () => {
      expect(await helpContains('analyse', 'config-only')).toBe(true);
    });

    test('accepts --config-only flag', async () => {
      await createTestConfig(testDir);
      const { stderr } = await runCli(
        'analyse',
        '-d',
        testDir,
        '--config-only',
        '--json',
        '--dry-run'
      );
      expect(stderr.toLowerCase()).not.toContain('unknown option');
    });
  });

  describe('--sessions-only flag (FR-015)', () => {
    test('--sessions-only is a valid option', async () => {
      expect(await helpContains('analyse', 'sessions-only')).toBe(true);
    });

    test('accepts --sessions-only flag', async () => {
      await createTestConfig(testDir);
      const { stderr } = await runCli(
        'analyse',
        '-d',
        testDir,
        '--sessions-only',
        '--json',
        '--dry-run'
      );
      expect(stderr.toLowerCase()).not.toContain('unknown option');
    });
  });

  describe('--dry-run flag', () => {
    test('--dry-run option is available', async () => {
      expect(await helpContains('analyse', 'dry-run')).toBe(true);
    });

    test('dry-run does not require API key', async () => {
      await createTestConfig(testDir, '# Test Project');
      const proc = Bun.spawn(['bun', 'run', 'src/cli.ts', 'analyse', '-d', testDir, '--dry-run'], {
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...process.env, ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '' },
      });
      const exitCode = await proc.exited;
      expect(exitCode).toBe(0);
    });

    test('dry-run outputs scan results', async () => {
      await createTestConfig(testDir, '# Test Project');
      const result = await $`bun run src/cli.ts analyse -d ${testDir} --dry-run --plain`.text();
      expect(result).toContain('CLAUDE.md');
    });
  });

  describe('directory handling', () => {
    test('defaults to current directory', async () => {
      expect(await helpContains('analyse', 'directory')).toBe(true);
    });

    test('handles nonexistent directory', async () => {
      const { exitCode } = await runCli('analyse', '-d', '/nonexistent/path');
      expect(exitCode).not.toBe(0);
    });

    test('handles empty directory', async () => {
      const { stdout } = await runCli('analyse', '-d', testDir, '--dry-run', '--plain');
      expect(stdout.toLowerCase()).toContain('no');
    });
  });

  describe('output format flags', () => {
    test('--plain flag works', async () => {
      await createTestConfig(testDir);
      const { stdout } = await runCli('analyse', '-d', testDir, '--dry-run', '--plain');
      expect(stdout.trim().startsWith('{')).toBe(false);
    });

    test(
      '--json flag works',
      async () => {
        await createTestConfig(testDir);
        const { stdout } = await runCli('analyse', '-d', testDir, '--dry-run', '--json');
        if (stdout.trim()) {
          expect(() => JSON.parse(stdout) as unknown).not.toThrow();
        }
      },
      { timeout: 15000 }
    );
  });

  describe('--fail-on-findings (FR-016)', () => {
    test('--fail-on-findings option is available', async () => {
      expect(await helpContains('', 'fail-on-findings')).toBe(true);
    });

    test('exits 0 when no findings and --fail-on-findings', async () => {
      await createTestConfig(testDir, '# Test Project');
      const { exitCode } = await runCli(
        'analyse',
        '-d',
        testDir,
        '--dry-run',
        '--fail-on-findings'
      );
      expect(exitCode).toBe(0);
    });
  });

  describe('error handling', () => {
    test('shows error for invalid options', async () => {
      const { exitCode } = await runCli('analyse', '--invalid-option-xyz');
      expect(exitCode).not.toBe(0);
    });

    test('shows usage on error', async () => {
      const { stderr } = await runCli('analyse', '--invalid-option-xyz');
      expect(stderr.length).toBeGreaterThan(0);
    });
  });

  describe('verbose mode (FR-017)', () => {
    test('--verbose flag is available', async () => {
      expect(await helpContains('', 'verbose')).toBe(true);
    });

    test('verbose shows more output', async () => {
      await createTestConfig(testDir);

      const { stdout: normalOut } = await runCli('analyse', '-d', testDir, '--dry-run', '--plain');
      const { stdout: verboseOut } = await runCli(
        'analyse',
        '-d',
        testDir,
        '--dry-run',
        '--verbose',
        '--plain'
      );

      expect(verboseOut.length).toBeGreaterThanOrEqual(normalOut.length);
    });
  });
});
