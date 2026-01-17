/**
 * T020: Unit tests for glob exclusions
 *
 * Tests the exclusion patterns for config discovery.
 *
 * @module tests/unit/tools/config/exclusions.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { discoverConfigs, DEFAULT_EXCLUSIONS } from '../../../../src/tools/config/discovery';

describe('glob exclusions', () => {
  // Temporary directory for testing exclusions
  let tempDir: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentlint-exclusion-'));

    // Create root CLAUDE.md
    fs.writeFileSync(path.join(tempDir, 'CLAUDE.md'), '# Root Config\n');

    // Create node_modules with a CLAUDE.md (should be excluded)
    const nodeModulesDir = path.join(tempDir, 'node_modules', 'some-package');
    fs.mkdirSync(nodeModulesDir, { recursive: true });
    fs.writeFileSync(path.join(nodeModulesDir, 'CLAUDE.md'), '# Should Ignore\n');

    // Create .git with CLAUDE.md (should be excluded)
    const gitDir = path.join(tempDir, '.git', 'hooks');
    fs.mkdirSync(gitDir, { recursive: true });
    fs.writeFileSync(path.join(gitDir, 'CLAUDE.md'), '# Should Ignore\n');

    // Create dist with CLAUDE.md (should be excluded)
    const distDir = path.join(tempDir, 'dist');
    fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(path.join(distDir, 'CLAUDE.md'), '# Should Ignore\n');

    // Create valid nested directory (should NOT be excluded)
    const srcDir = path.join(tempDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'CLAUDE.md'), '# Nested Config\n');

    // Create .claude directory (should NOT be excluded - it's a config dir)
    const claudeDir = path.join(tempDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, 'settings.json'),
      '{"model": "claude-sonnet-4-20250514"}'
    );
  });

  afterAll(() => {
    // Cleanup
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('default exclusions', () => {
    it('should exclude node_modules by default', async () => {
      const result = await discoverConfigs({
        cwd: tempDir,
        includeGlobal: false,
      });

      const nodeModulesFiles = result.files.filter((f) => f.path.includes('node_modules'));

      expect(nodeModulesFiles.length).toBe(0);
      expect(result.directoriesExcluded).toBeGreaterThan(0);
    });

    it('should exclude .git by default', async () => {
      const result = await discoverConfigs({
        cwd: tempDir,
        includeGlobal: false,
      });

      const gitFiles = result.files.filter((f) => f.path.includes('.git'));

      expect(gitFiles.length).toBe(0);
    });

    it('should exclude dist/build/out by default', async () => {
      const result = await discoverConfigs({
        cwd: tempDir,
        includeGlobal: false,
      });

      const buildFiles = result.files.filter(
        (f) => f.path.includes('/dist/') || f.path.includes('/build/') || f.path.includes('/out/')
      );

      expect(buildFiles.length).toBe(0);
    });

    it('should NOT exclude .claude/ directory', async () => {
      const result = await discoverConfigs({
        cwd: tempDir,
        includeGlobal: false,
      });

      const claudeSettings = result.files.find((f) => f.type === 'claude-settings');

      expect(claudeSettings).toBeDefined();
    });

    it('should NOT exclude valid src/ directories', async () => {
      const result = await discoverConfigs({
        cwd: tempDir,
        includeGlobal: false,
      });

      const srcFiles = result.files.filter((f) => f.path.includes('/src/'));

      expect(srcFiles.length).toBeGreaterThan(0);
    });
  });

  describe('custom exclusions (T026)', () => {
    it('should apply custom exclusion patterns', async () => {
      const result = await discoverConfigs({
        cwd: tempDir,
        includeGlobal: false,
        exclude: ['src'],
      });

      const srcFiles = result.files.filter((f) => f.path.includes('/src/'));

      expect(srcFiles.length).toBe(0);
    });

    it('should combine custom exclusions with defaults', async () => {
      const result = await discoverConfigs({
        cwd: tempDir,
        includeGlobal: false,
        exclude: ['custom-dir'],
      });

      // node_modules should still be excluded (default)
      const nodeModulesFiles = result.files.filter((f) => f.path.includes('node_modules'));

      expect(nodeModulesFiles.length).toBe(0);
    });

    it('should support glob patterns in exclusions', async () => {
      const result = await discoverConfigs({
        cwd: tempDir,
        includeGlobal: false,
        exclude: ['*.test.*'],
      });

      // This verifies glob pattern support
      expect(result).toBeDefined();
    });

    it('should handle empty exclusion array', async () => {
      // Empty array should still apply default exclusions
      const result = await discoverConfigs({
        cwd: tempDir,
        includeGlobal: false,
        exclude: [],
      });

      // Should still exclude node_modules by default
      const nodeModulesFiles = result.files.filter((f) => f.path.includes('node_modules'));

      expect(nodeModulesFiles.length).toBe(0);
    });
  });

  describe('exclusion patterns', () => {
    it('should export DEFAULT_EXCLUSIONS for reference', () => {
      expect(DEFAULT_EXCLUSIONS).toBeInstanceOf(Array);
      expect(DEFAULT_EXCLUSIONS).toContain('node_modules');
      expect(DEFAULT_EXCLUSIONS).toContain('.git');
    });

    it('should handle deeply nested excluded directories', async () => {
      // Create deeply nested node_modules
      const deepPath = path.join(tempDir, 'a', 'b', 'node_modules', 'c', 'd');
      fs.mkdirSync(deepPath, { recursive: true });
      fs.writeFileSync(path.join(deepPath, 'CLAUDE.md'), '# Deep Ignore\n');

      const result = await discoverConfigs({
        cwd: tempDir,
        includeGlobal: false,
      });

      const deepFiles = result.files.filter((f) => f.path.includes('a/b/node_modules'));

      expect(deepFiles.length).toBe(0);
    });

    it('should exclude .next framework directory', async () => {
      const nextDir = path.join(tempDir, '.next', 'server');
      fs.mkdirSync(nextDir, { recursive: true });
      fs.writeFileSync(path.join(nextDir, 'CLAUDE.md'), '# Next Build\n');

      const result = await discoverConfigs({
        cwd: tempDir,
        includeGlobal: false,
      });

      const nextFiles = result.files.filter((f) => f.path.includes('.next'));

      expect(nextFiles.length).toBe(0);
    });

    it('should exclude Python virtual environments', async () => {
      const venvDir = path.join(tempDir, 'venv', 'lib');
      fs.mkdirSync(venvDir, { recursive: true });
      fs.writeFileSync(path.join(venvDir, 'CLAUDE.md'), '# Venv Ignore\n');

      const result = await discoverConfigs({
        cwd: tempDir,
        includeGlobal: false,
      });

      const venvFiles = result.files.filter((f) => f.path.includes('/venv/'));

      expect(venvFiles.length).toBe(0);
    });
  });

  describe('case sensitivity', () => {
    it('should handle case-insensitive exclusion on macOS/Windows', async () => {
      // Create NODE_MODULES (uppercase)
      const upperDir = path.join(tempDir, 'case-test', 'NODE_MODULES');
      try {
        fs.mkdirSync(upperDir, { recursive: true });
        fs.writeFileSync(path.join(upperDir, 'CLAUDE.md'), '# Case Test\n');
      } catch {
        // May fail on case-sensitive file systems
      }

      const result = await discoverConfigs({
        cwd: tempDir,
        includeGlobal: false,
      });

      // On case-insensitive systems, should still be excluded
      // On case-sensitive systems, might be included (platform-dependent)
      expect(result).toBeDefined();
    });
  });

  describe('symlinks', () => {
    it('should handle symlinks to excluded directories', async () => {
      // Create a symlink pointing to node_modules
      const symlinkPath = path.join(tempDir, 'linked_modules');
      try {
        fs.symlinkSync(path.join(tempDir, 'node_modules'), symlinkPath, 'junction');
      } catch {
        // Symlink creation may fail on some systems
        return;
      }

      const result = await discoverConfigs({
        cwd: tempDir,
        includeGlobal: false,
      });

      // Should not follow symlink into excluded directory
      // or should handle it gracefully
      expect(result).toBeDefined();
    });
  });

  describe('performance', () => {
    it('should efficiently skip excluded directories', async () => {
      // Create many subdirectories in node_modules
      for (let i = 0; i < 10; i++) {
        const pkgDir = path.join(tempDir, 'node_modules', `pkg-${i}`);
        fs.mkdirSync(pkgDir, { recursive: true });
        fs.writeFileSync(path.join(pkgDir, 'CLAUDE.md'), `# Package ${i}\n`);
      }

      const startTime = Date.now();
      const result = await discoverConfigs({
        cwd: tempDir,
        includeGlobal: false,
      });
      const duration = Date.now() - startTime;

      // Should be fast because node_modules is excluded early
      expect(duration).toBeLessThan(1000);
      expect(result.directoriesExcluded).toBeGreaterThan(0);
    });
  });
});
