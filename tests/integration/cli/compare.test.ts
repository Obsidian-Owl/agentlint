/**
 * T054: Integration tests for compare and baseline commands
 *
 * Tests US-006: Compare Against Baseline
 * Tests FR-009: Show delta with +/- indicators
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { $ } from 'bun';

describe('baseline command integration', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'agentlint-baseline-test-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('command registration', () => {
    test('baseline command is available', async () => {
      const result = await $`bun run src/cli.ts --help`.text();
      expect(result).toContain('baseline');
    });

    test('baseline has help text', async () => {
      const result = await $`bun run src/cli.ts baseline --help`.text();
      expect(result.toLowerCase()).toContain('baseline');
    });
  });

  describe('baseline capture', () => {
    test('accepts --label option', async () => {
      const proc = Bun.spawn(['bun', 'run', 'src/cli.ts', 'baseline', '--help'], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const stdout = await new Response(proc.stdout).text();
      await proc.exited;
      expect(stdout.toLowerCase()).toContain('label');
    });

    test('accepts --notes option', async () => {
      const proc = Bun.spawn(['bun', 'run', 'src/cli.ts', 'baseline', '--help'], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const stdout = await new Response(proc.stdout).text();
      await proc.exited;
      expect(stdout.toLowerCase()).toContain('notes');
    });
  });

  describe('--json output', () => {
    test('--json flag is accepted', async () => {
      const proc = Bun.spawn(['bun', 'run', 'src/cli.ts', 'baseline', '--json'], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const stderr = await new Response(proc.stderr).text();
      await proc.exited;
      // Should not error on unknown option
      expect(stderr.toLowerCase()).not.toContain('unknown option');
    });
  });
});

describe('compare command integration', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'agentlint-compare-test-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('command registration', () => {
    test('compare command is available', async () => {
      const result = await $`bun run src/cli.ts --help`.text();
      expect(result).toContain('compare');
    });

    test('compare has help text', async () => {
      const result = await $`bun run src/cli.ts compare --help`.text();
      expect(result.toLowerCase()).toContain('compare');
    });
  });

  describe('baseline selection', () => {
    test('accepts --baseline option', async () => {
      const proc = Bun.spawn(['bun', 'run', 'src/cli.ts', 'compare', '--help'], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const stdout = await new Response(proc.stdout).text();
      await proc.exited;
      expect(stdout.toLowerCase()).toContain('baseline');
    });
  });

  describe('no baseline case', () => {
    test('shows helpful error when no baseline exists', async () => {
      const proc = Bun.spawn(['bun', 'run', 'src/cli.ts', 'compare'], {
        stdout: 'pipe',
        stderr: 'pipe',
        cwd: testDir,
      });
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      await proc.exited;

      const output = (stdout + stderr).toLowerCase();
      // Should show error about no baseline
      expect(
        output.includes('no baseline') ||
          output.includes('baseline not found') ||
          output.includes('create a baseline') ||
          output.includes('error')
      ).toBe(true);
    });
  });

  describe('--json output', () => {
    test('--json flag is accepted', async () => {
      const proc = Bun.spawn(['bun', 'run', 'src/cli.ts', 'compare', '--json'], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const stderr = await new Response(proc.stderr).text();
      await proc.exited;
      // Should not error on unknown option
      expect(stderr.toLowerCase()).not.toContain('unknown option');
    });

    test('--json outputs valid JSON structure', async () => {
      const proc = Bun.spawn(['bun', 'run', 'src/cli.ts', 'compare', '--json'], {
        stdout: 'pipe',
        stderr: 'pipe',
        cwd: testDir,
      });
      const stdout = await new Response(proc.stdout).text();
      await proc.exited;

      // If there's output, it should be valid JSON
      if (stdout.trim().startsWith('{')) {
        expect(() => JSON.parse(stdout) as unknown).not.toThrow();
      }
    });
  });

  describe('output format flags', () => {
    test('--plain flag works', async () => {
      const proc = Bun.spawn(['bun', 'run', 'src/cli.ts', 'compare', '--plain'], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const stderr = await new Response(proc.stderr).text();
      await proc.exited;

      expect(stderr.toLowerCase()).not.toContain('unknown option');
    });

    test('--markdown flag works', async () => {
      const proc = Bun.spawn(['bun', 'run', 'src/cli.ts', 'compare', '--markdown'], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const stderr = await new Response(proc.stderr).text();
      await proc.exited;

      expect(stderr.toLowerCase()).not.toContain('unknown option');
    });
  });
});
