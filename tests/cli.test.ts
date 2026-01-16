/**
 * CLI smoke tests
 *
 * Tests CLI behavior with Commander.js (EP04).
 */

import { describe, test, expect } from 'bun:test';
import { $ } from 'bun';

describe('CLI', () => {
  describe('--version', () => {
    test('outputs version string', async () => {
      const result = await $`bun run src/cli.ts --version`.text();
      // Commander.js outputs just the version number
      expect(result.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });

    test('-v is alias for --version', async () => {
      const result = await $`bun run src/cli.ts -v`.text();
      expect(result.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('--help', () => {
    test('outputs help text', async () => {
      const result = await $`bun run src/cli.ts --help`.text();
      expect(result).toContain('Usage:');
      expect(result).toContain('agentlint');
    });

    test('includes available commands', async () => {
      const result = await $`bun run src/cli.ts --help`.text();
      expect(result).toContain('Commands:');
      expect(result).toContain('update');
    });

    test('includes all EP04 commands', async () => {
      const result = await $`bun run src/cli.ts --help`.text();
      expect(result).toContain('scan');
      expect(result).toContain('analyse');
      expect(result).toContain('baseline');
      expect(result).toContain('compare');
      expect(result).toContain('trace');
      expect(result).toContain('learn');
      expect(result).toContain('recommend');
      expect(result).toContain('validate');
    });

    test('-h is alias for --help', async () => {
      const result = await $`bun run src/cli.ts -h`.text();
      expect(result).toContain('Usage:');
    });
  });

  describe('no arguments', () => {
    test('shows help when no command given', async () => {
      // Commander.js shows help on stderr when no command is given
      const proc = Bun.spawn(['bun', 'run', 'src/cli.ts'], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      const output = stdout + stderr;

      expect(output).toContain('Usage:');
    });
  });

  describe('unknown command', () => {
    test('shows error for unknown command', async () => {
      const proc = Bun.spawn(['bun', 'run', 'src/cli.ts', 'unknown-cmd'], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      // Commander.js uses lowercase "error: unknown command"
      expect(stderr).toContain('unknown command');
      expect(exitCode).toBe(1);
    });
  });

  describe('global options', () => {
    test('--json option is available', async () => {
      const result = await $`bun run src/cli.ts --help`.text();
      expect(result).toContain('--json');
    });

    test('--markdown option is available', async () => {
      const result = await $`bun run src/cli.ts --help`.text();
      expect(result).toContain('--markdown');
    });

    test('--plain option is available', async () => {
      const result = await $`bun run src/cli.ts --help`.text();
      expect(result).toContain('--plain');
    });

    test('--verbose option is available', async () => {
      const result = await $`bun run src/cli.ts --help`.text();
      expect(result).toContain('--verbose');
    });

    test('--fail-on-findings option is available', async () => {
      const result = await $`bun run src/cli.ts --help`.text();
      expect(result).toContain('--fail-on-findings');
    });
  });
});
