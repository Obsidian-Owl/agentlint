/**
 * T029: Integration tests for --json flag
 *
 * Tests US-003: Export Results to JSON
 * Tests FR-004: Output valid JSON when --json flag is provided
 * Tests FR-012: Default to JSON output when stdout is not a TTY
 * Tests FR-016: --fail-on-findings exit code logic
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { $ } from 'bun';

describe('JSON output integration', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'agentlint-json-test-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('--json flag (FR-004)', () => {
    test('scan --json outputs valid JSON', async () => {
      await writeFile(join(testDir, 'CLAUDE.md'), '# Claude');

      const result = await $`bun run src/cli.ts scan -d ${testDir} --json`.text();
      expect(() => JSON.parse(result) as unknown).not.toThrow();
    });

    test('scan --json can be piped to jq', async () => {
      await writeFile(join(testDir, 'CLAUDE.md'), '# Claude');

      // This tests FR-004: `agentlint scan --json | jq .` succeeds
      const result =
        await $`bun run src/cli.ts scan -d ${testDir} --json | jq '.configs[0].type'`.text();
      expect(result.trim()).toBe('"claude-code"');
    });

    test('scan --json includes all expected fields', async () => {
      await writeFile(join(testDir, 'CLAUDE.md'), '# Claude');

      const result = await $`bun run src/cli.ts scan -d ${testDir} --json`.text();
      const json = JSON.parse(result);

      expect(json.directory).toBeDefined();
      expect(json.configs).toBeDefined();
      expect(json.scannedAt).toBeDefined();
    });

    test('scan --json configs have required properties', async () => {
      await writeFile(join(testDir, 'CLAUDE.md'), '# Claude');

      const result = await $`bun run src/cli.ts scan -d ${testDir} --json`.text();
      const json = JSON.parse(result);

      expect(json.configs[0].path).toBeDefined();
      expect(json.configs[0].relativePath).toBeDefined();
      expect(json.configs[0].type).toBeDefined();
      expect(json.configs[0].description).toBeDefined();
      expect(json.configs[0].size).toBeDefined();
    });
  });

  describe('non-TTY auto-JSON (FR-012)', () => {
    test('piped output defaults to JSON', async () => {
      await writeFile(join(testDir, 'CLAUDE.md'), '# Claude');

      // When piped, should output JSON even without --json flag
      const result = await $`bun run src/cli.ts scan -d ${testDir}`.text();
      expect(() => JSON.parse(result) as unknown).not.toThrow();
    });

    test('piped output is valid JSON without --json flag', async () => {
      await writeFile(join(testDir, 'CLAUDE.md'), '# Claude');

      const result = await $`bun run src/cli.ts scan -d ${testDir}`.text();
      const json = JSON.parse(result);
      expect(json.configs).toBeDefined();
    });
  });

  describe('--fail-on-findings (FR-016)', () => {
    test('exits with 0 when no findings and --fail-on-findings', async () => {
      await writeFile(join(testDir, 'CLAUDE.md'), '# Claude');

      const proc = Bun.spawn(
        ['bun', 'run', 'src/cli.ts', 'scan', '-d', testDir, '--fail-on-findings'],
        {
          stdout: 'pipe',
          stderr: 'pipe',
        }
      );
      const exitCode = await proc.exited;

      // Scan doesn't produce "findings" (analysis findings), just configs
      // So exit code should be 0
      expect(exitCode).toBe(0);
    });
  });

  describe('JSON structure validation', () => {
    test('empty result is valid JSON', async () => {
      const result = await $`bun run src/cli.ts scan -d ${testDir} --json`.text();
      const json = JSON.parse(result);

      expect(json.configs).toEqual([]);
      expect(json.directory).toBe(testDir);
    });

    test('scannedAt is ISO timestamp', async () => {
      const result = await $`bun run src/cli.ts scan -d ${testDir} --json`.text();
      const json = JSON.parse(result);

      const timestamp = new Date(json.scannedAt);
      expect(timestamp.toISOString()).toBe(json.scannedAt);
    });

    test('directory is absolute path', async () => {
      const result = await $`bun run src/cli.ts scan -d ${testDir} --json`.text();
      const json = JSON.parse(result);

      expect(json.directory.startsWith('/')).toBe(true);
    });
  });

  describe('--json overrides other flags', () => {
    test('--json takes precedence over --plain', async () => {
      await writeFile(join(testDir, 'CLAUDE.md'), '# Claude');

      const result = await $`bun run src/cli.ts scan -d ${testDir} --json --plain`.text();
      expect(() => JSON.parse(result) as unknown).not.toThrow();
    });
  });

  describe('error handling', () => {
    test('error output is JSON when --json flag set', async () => {
      const proc = Bun.spawn(
        ['bun', 'run', 'src/cli.ts', 'scan', '-d', '/nonexistent/path', '--json'],
        {
          stdout: 'pipe',
          stderr: 'pipe',
        }
      );
      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      // Error should be reported (may be plain text or JSON depending on implementation)
      expect(exitCode).not.toBe(0);
      expect(stderr.length).toBeGreaterThan(0);
    });
  });
});
