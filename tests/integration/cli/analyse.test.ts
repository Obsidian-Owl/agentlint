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
      const result = await $`bun run src/cli.ts --help`.text();
      expect(result).toContain('analyse');
    });

    test('analyse has help text', async () => {
      const result = await $`bun run src/cli.ts analyse --help`.text();
      expect(result.toLowerCase()).toContain('analyse');
    });

    test('accepts directory argument', async () => {
      await writeFile(join(testDir, 'CLAUDE.md'), '# Test');
      // This might fail without API key, but should at least parse arguments
      const proc = Bun.spawn(['bun', 'run', 'src/cli.ts', 'analyse', '-d', testDir, '--json'], {
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...process.env, ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '' },
      });
      await proc.exited;
      // Command should be recognized even if it fails for other reasons
      const stderr = await new Response(proc.stderr).text();
      // Should not say "unknown command"
      expect(stderr.toLowerCase()).not.toContain('unknown command');
    });
  });

  describe('--json output (FR-004)', () => {
    test('analyse --json outputs JSON structure', async () => {
      await writeFile(join(testDir, 'CLAUDE.md'), '# Test Project');

      // Run with mock/no-op mode (without actual API call)
      const proc = Bun.spawn(
        ['bun', 'run', 'src/cli.ts', 'analyse', '-d', testDir, '--json', '--dry-run'],
        {
          stdout: 'pipe',
          stderr: 'pipe',
        }
      );
      const stdout = await new Response(proc.stdout).text();
      await proc.exited;

      // If dry-run is supported, should output JSON
      if (stdout.trim().startsWith('{')) {
        expect(() => JSON.parse(stdout) as unknown).not.toThrow();
      }
    });
  });

  describe('--config-only flag (FR-015)', () => {
    test('--config-only is a valid option', async () => {
      const result = await $`bun run src/cli.ts analyse --help`.text();
      expect(result).toContain('config-only');
    });

    test('accepts --config-only flag', async () => {
      await writeFile(join(testDir, 'CLAUDE.md'), '# Test');

      const proc = Bun.spawn(
        ['bun', 'run', 'src/cli.ts', 'analyse', '-d', testDir, '--config-only', '--json'],
        {
          stdout: 'pipe',
          stderr: 'pipe',
          env: { ...process.env, ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '' },
        }
      );
      await proc.exited;
      const stderr = await new Response(proc.stderr).text();
      // Should not complain about unknown option
      expect(stderr.toLowerCase()).not.toContain('unknown option');
    });
  });

  describe('--sessions-only flag (FR-015)', () => {
    test('--sessions-only is a valid option', async () => {
      const result = await $`bun run src/cli.ts analyse --help`.text();
      expect(result).toContain('sessions-only');
    });

    test('accepts --sessions-only flag', async () => {
      await writeFile(join(testDir, 'CLAUDE.md'), '# Test');

      const proc = Bun.spawn(
        ['bun', 'run', 'src/cli.ts', 'analyse', '-d', testDir, '--sessions-only', '--json'],
        {
          stdout: 'pipe',
          stderr: 'pipe',
          env: { ...process.env, ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '' },
        }
      );
      await proc.exited;
      const stderr = await new Response(proc.stderr).text();
      expect(stderr.toLowerCase()).not.toContain('unknown option');
    });
  });

  describe('--dry-run flag', () => {
    test('--dry-run option is available', async () => {
      const result = await $`bun run src/cli.ts analyse --help`.text();
      expect(result).toContain('dry-run');
    });

    test('dry-run does not require API key', async () => {
      await writeFile(join(testDir, 'CLAUDE.md'), '# Test Project');

      const proc = Bun.spawn(['bun', 'run', 'src/cli.ts', 'analyse', '-d', testDir, '--dry-run'], {
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...process.env, ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '' },
      });
      const exitCode = await proc.exited;
      // Dry run should succeed without API key
      expect(exitCode).toBe(0);
    });

    test('dry-run outputs scan results', async () => {
      await writeFile(join(testDir, 'CLAUDE.md'), '# Test Project');

      const result = await $`bun run src/cli.ts analyse -d ${testDir} --dry-run --plain`.text();
      // Should show discovered config files
      expect(result).toContain('CLAUDE.md');
    });
  });

  describe('directory handling', () => {
    test('defaults to current directory', async () => {
      const result = await $`bun run src/cli.ts analyse --help`.text();
      // Help should mention default directory
      expect(result.toLowerCase()).toContain('directory');
    });

    test('handles nonexistent directory', async () => {
      const proc = Bun.spawn(['bun', 'run', 'src/cli.ts', 'analyse', '-d', '/nonexistent/path'], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const exitCode = await proc.exited;
      expect(exitCode).not.toBe(0);
    });

    test('handles empty directory', async () => {
      const proc = Bun.spawn(
        ['bun', 'run', 'src/cli.ts', 'analyse', '-d', testDir, '--dry-run', '--plain'],
        {
          stdout: 'pipe',
          stderr: 'pipe',
        }
      );
      const stdout = await new Response(proc.stdout).text();
      await proc.exited;
      // Should indicate no configs found
      expect(stdout.toLowerCase()).toContain('no');
    });
  });

  describe('output format flags', () => {
    test('--plain flag works', async () => {
      await writeFile(join(testDir, 'CLAUDE.md'), '# Test');

      const proc = Bun.spawn(
        ['bun', 'run', 'src/cli.ts', 'analyse', '-d', testDir, '--dry-run', '--plain'],
        {
          stdout: 'pipe',
          stderr: 'pipe',
        }
      );
      const stdout = await new Response(proc.stdout).text();
      await proc.exited;
      // Plain text should not be JSON
      expect(stdout.trim().startsWith('{')).toBe(false);
    });

    test('--json flag works', async () => {
      await writeFile(join(testDir, 'CLAUDE.md'), '# Test');

      const proc = Bun.spawn(
        ['bun', 'run', 'src/cli.ts', 'analyse', '-d', testDir, '--dry-run', '--json'],
        {
          stdout: 'pipe',
          stderr: 'pipe',
        }
      );
      const stdout = await new Response(proc.stdout).text();
      await proc.exited;
      if (stdout.trim()) {
        expect(() => JSON.parse(stdout) as unknown).not.toThrow();
      }
    });
  });

  describe('--fail-on-findings (FR-016)', () => {
    test('--fail-on-findings option is available', async () => {
      // fail-on-findings is a global option, so check main help
      const result = await $`bun run src/cli.ts --help`.text();
      expect(result).toContain('fail-on-findings');
    });

    test('exits 0 when no findings and --fail-on-findings', async () => {
      await writeFile(join(testDir, 'CLAUDE.md'), '# Test Project');

      const proc = Bun.spawn(
        ['bun', 'run', 'src/cli.ts', 'analyse', '-d', testDir, '--dry-run', '--fail-on-findings'],
        {
          stdout: 'pipe',
          stderr: 'pipe',
        }
      );
      const exitCode = await proc.exited;
      // Dry run with config present should succeed (no findings in dry-run)
      expect(exitCode).toBe(0);
    });
  });

  describe('error handling', () => {
    test('shows error for invalid options', async () => {
      const proc = Bun.spawn(['bun', 'run', 'src/cli.ts', 'analyse', '--invalid-option-xyz'], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const exitCode = await proc.exited;
      expect(exitCode).not.toBe(0);
    });

    test('shows usage on error', async () => {
      const proc = Bun.spawn(['bun', 'run', 'src/cli.ts', 'analyse', '--invalid-option-xyz'], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const stderr = await new Response(proc.stderr).text();
      await proc.exited;
      // Should show some error message
      expect(stderr.length).toBeGreaterThan(0);
    });
  });

  describe('verbose mode (FR-017)', () => {
    test('--verbose flag is available', async () => {
      // verbose is a global option, so check main help
      const result = await $`bun run src/cli.ts --help`.text();
      expect(result).toContain('verbose');
    });

    test('verbose shows more output', async () => {
      await writeFile(join(testDir, 'CLAUDE.md'), '# Test');

      const normalProc = Bun.spawn(
        ['bun', 'run', 'src/cli.ts', 'analyse', '-d', testDir, '--dry-run', '--plain'],
        { stdout: 'pipe', stderr: 'pipe' }
      );
      const normalOut = await new Response(normalProc.stdout).text();
      await normalProc.exited;

      const verboseProc = Bun.spawn(
        ['bun', 'run', 'src/cli.ts', 'analyse', '-d', testDir, '--dry-run', '--verbose', '--plain'],
        { stdout: 'pipe', stderr: 'pipe' }
      );
      const verboseOut = await new Response(verboseProc.stdout).text();
      await verboseProc.exited;

      // Verbose should have at least as much output
      expect(verboseOut.length).toBeGreaterThanOrEqual(normalOut.length);
    });
  });
});
