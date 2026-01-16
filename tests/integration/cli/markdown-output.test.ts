/**
 * T060: Integration tests for --markdown flag
 *
 * Tests US-007: Export Results to Markdown
 * Tests FR-008: Markdown output for documentation
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('markdown output integration', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'agentlint-markdown-test-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('--markdown flag acceptance', () => {
    test('scan command accepts --markdown', async () => {
      const proc = Bun.spawn(['bun', 'run', 'src/cli.ts', 'scan', '--markdown'], {
        stdout: 'pipe',
        stderr: 'pipe',
        cwd: testDir,
      });
      const stderr = await new Response(proc.stderr).text();
      await proc.exited;

      expect(stderr.toLowerCase()).not.toContain('unknown option');
    });

    test('analyse command accepts --markdown', async () => {
      const proc = Bun.spawn(['bun', 'run', 'src/cli.ts', 'analyse', '--markdown', '--dry-run'], {
        stdout: 'pipe',
        stderr: 'pipe',
        cwd: testDir,
      });
      const stderr = await new Response(proc.stderr).text();
      await proc.exited;

      expect(stderr.toLowerCase()).not.toContain('unknown option');
    });

    test('trace command accepts --markdown', async () => {
      const proc = Bun.spawn(['bun', 'run', 'src/cli.ts', 'trace', 'FND-001', '--markdown'], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const stderr = await new Response(proc.stderr).text();
      await proc.exited;

      expect(stderr.toLowerCase()).not.toContain('unknown option');
    });

    test('compare command accepts --markdown', async () => {
      const proc = Bun.spawn(['bun', 'run', 'src/cli.ts', 'compare', '--markdown'], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const stderr = await new Response(proc.stderr).text();
      await proc.exited;

      expect(stderr.toLowerCase()).not.toContain('unknown option');
    });

    test('baseline command accepts --markdown', async () => {
      const proc = Bun.spawn(['bun', 'run', 'src/cli.ts', 'baseline', '--markdown'], {
        stdout: 'pipe',
        stderr: 'pipe',
        cwd: testDir,
      });
      const stderr = await new Response(proc.stderr).text();
      await proc.exited;

      expect(stderr.toLowerCase()).not.toContain('unknown option');
    });
  });

  describe('markdown output format', () => {
    test('scan --markdown outputs valid Markdown', async () => {
      // Create a test config file
      await writeFile(join(testDir, 'CLAUDE.md'), '# Test Project\n\nA test project.');

      const proc = Bun.spawn(['bun', 'run', 'src/cli.ts', 'scan', '--markdown', '-d', testDir], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const stdout = await new Response(proc.stdout).text();
      await proc.exited;

      // Should contain Markdown formatting
      expect(stdout.includes('#') || stdout.includes('-') || stdout.includes('|')).toBe(true);
    });

    test('analyse --markdown outputs valid Markdown', async () => {
      await writeFile(join(testDir, 'CLAUDE.md'), '# Test Project');

      const proc = Bun.spawn(
        ['bun', 'run', 'src/cli.ts', 'analyse', '--markdown', '--dry-run', '-d', testDir],
        {
          stdout: 'pipe',
          stderr: 'pipe',
        }
      );
      const stdout = await new Response(proc.stdout).text();
      await proc.exited;

      // Should contain Markdown formatting
      expect(stdout.includes('#') || stdout.includes('-') || stdout.includes('|')).toBe(true);
    });

    test('trace --markdown outputs Markdown with headers', async () => {
      const proc = Bun.spawn(['bun', 'run', 'src/cli.ts', 'trace', 'FND-001', '--markdown'], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const stdout = await new Response(proc.stdout).text();
      await proc.exited;

      // Should contain Markdown header
      expect(stdout).toContain('#');
    });

    test('compare --markdown outputs Markdown table', async () => {
      const proc = Bun.spawn(['bun', 'run', 'src/cli.ts', 'compare', '--markdown'], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const stdout = await new Response(proc.stdout).text();
      await proc.exited;

      // Should contain Markdown formatting
      expect(stdout.includes('#') || stdout.includes('|') || stdout.includes('>')).toBe(true);
    });
  });

  describe('markdown output content', () => {
    test('scan --markdown includes config file names', async () => {
      await writeFile(join(testDir, 'CLAUDE.md'), '# Test');

      const proc = Bun.spawn(['bun', 'run', 'src/cli.ts', 'scan', '--markdown', '-d', testDir], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const stdout = await new Response(proc.stdout).text();
      await proc.exited;

      expect(stdout).toContain('CLAUDE.md');
    });

    test('scan --markdown includes config types', async () => {
      await writeFile(join(testDir, 'CLAUDE.md'), '# Test');

      const proc = Bun.spawn(['bun', 'run', 'src/cli.ts', 'scan', '--markdown', '-d', testDir], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const stdout = await new Response(proc.stdout).text();
      await proc.exited;

      // Should mention the config type
      const lower = stdout.toLowerCase();
      expect(lower.includes('claude') || lower.includes('config')).toBe(true);
    });
  });

  describe('output mode exclusivity', () => {
    test('--markdown takes precedence over default', async () => {
      await writeFile(join(testDir, 'CLAUDE.md'), '# Test');

      const proc = Bun.spawn(['bun', 'run', 'src/cli.ts', 'scan', '--markdown', '-d', testDir], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const stdout = await new Response(proc.stdout).text();
      await proc.exited;

      // Should not be JSON (would start with '{')
      const trimmed = stdout.trim();
      expect(trimmed.startsWith('{') && trimmed.endsWith('}')).toBe(false);
    });

    test('--json takes precedence over --markdown', async () => {
      await writeFile(join(testDir, 'CLAUDE.md'), '# Test');

      const proc = Bun.spawn(
        ['bun', 'run', 'src/cli.ts', 'scan', '--json', '--markdown', '-d', testDir],
        {
          stdout: 'pipe',
          stderr: 'pipe',
        }
      );
      const stdout = await new Response(proc.stdout).text();
      await proc.exited;

      // Should be valid JSON
      if (stdout.trim()) {
        expect(() => JSON.parse(stdout) as unknown).not.toThrow();
      }
    });
  });
});
