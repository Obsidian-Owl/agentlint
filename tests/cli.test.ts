/**
 * CLI smoke tests
 */

import { describe, test, expect } from 'bun:test';
import { $ } from 'bun';

describe('CLI', () => {
  describe('--version', () => {
    test('outputs version string', async () => {
      const result = await $`bun run src/cli.ts --version`.text();
      expect(result).toContain('agentlint v');
    });

    test('includes platform info', async () => {
      const result = await $`bun run src/cli.ts --version`.text();
      expect(result).toMatch(/darwin|linux/);
      expect(result).toMatch(/arm64|x64/);
    });

    test('-v is alias for --version', async () => {
      const result = await $`bun run src/cli.ts -v`.text();
      expect(result).toContain('agentlint v');
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

    test('-h is alias for --help', async () => {
      const result = await $`bun run src/cli.ts -h`.text();
      expect(result).toContain('Usage:');
    });
  });

  describe('no arguments', () => {
    test('shows help by default', async () => {
      const result = await $`bun run src/cli.ts`.text();
      expect(result).toContain('Usage:');
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

      expect(stderr).toContain('Unknown command');
      expect(exitCode).toBe(2);
    });
  });
});
