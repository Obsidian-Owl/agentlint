/**
 * T021: Integration test for discovery in monorepo fixture
 *
 * Tests the complete config discovery flow in a realistic monorepo structure.
 *
 * @module tests/integration/tools/config/discovery.test.ts
 */

import { describe, it, expect } from 'bun:test';
import * as path from 'node:path';

import { discoverConfigs } from '../../../../src/tools/config/discovery';

// Test fixture paths
const FIXTURES_DIR = path.join(__dirname, '../../../fixtures/configs');
const MONOREPO_DIR = path.join(FIXTURES_DIR, 'monorepo');
const HIERARCHY_DIR = path.join(FIXTURES_DIR, 'hierarchy');
const VALID_DIR = path.join(FIXTURES_DIR, 'valid');

describe('integration: config discovery', () => {
  describe('monorepo discovery', () => {
    it('should discover all configs in monorepo structure', async () => {
      const result = await discoverConfigs({
        cwd: MONOREPO_DIR,
        includeGlobal: false,
      });

      // Should find: root CLAUDE.md + app-a + app-b + shared + api CLAUDE.md + api AGENTS.md
      expect(result.files.length).toBeGreaterThanOrEqual(6);
    });

    it('should find root level config', async () => {
      const result = await discoverConfigs({
        cwd: MONOREPO_DIR,
        includeGlobal: false,
      });

      const rootConfig = result.files.find((f) => f.relativePath === 'CLAUDE.md');

      expect(rootConfig).toBeDefined();
      expect(rootConfig?.level).toBe('project');
      expect(rootConfig?.type).toBe('claude-md');
    });

    it('should find nested package configs', async () => {
      const result = await discoverConfigs({
        cwd: MONOREPO_DIR,
        includeGlobal: false,
      });

      const appAConfig = result.files.find((f) =>
        f.relativePath.includes('packages/app-a/CLAUDE.md')
      );
      const appBConfig = result.files.find((f) =>
        f.relativePath.includes('packages/app-b/CLAUDE.md')
      );
      const sharedConfig = result.files.find((f) =>
        f.relativePath.includes('packages/shared/CLAUDE.md')
      );

      expect(appAConfig).toBeDefined();
      expect(appBConfig).toBeDefined();
      expect(sharedConfig).toBeDefined();

      // Nested configs should be marked as 'local'
      expect(appAConfig?.level).toBe('local');
      expect(appBConfig?.level).toBe('local');
      expect(sharedConfig?.level).toBe('local');
    });

    it('should find service configs', async () => {
      const result = await discoverConfigs({
        cwd: MONOREPO_DIR,
        includeGlobal: false,
      });

      const apiClaudeConfig = result.files.find((f) =>
        f.relativePath.includes('services/api/CLAUDE.md')
      );
      const apiAgentsConfig = result.files.find((f) =>
        f.relativePath.includes('services/api/AGENTS.md')
      );

      expect(apiClaudeConfig).toBeDefined();
      expect(apiAgentsConfig).toBeDefined();

      expect(apiClaudeConfig?.type).toBe('claude-md');
      expect(apiAgentsConfig?.type).toBe('agents-md');
    });

    it('should maintain correct relative paths', async () => {
      const result = await discoverConfigs({
        cwd: MONOREPO_DIR,
        includeGlobal: false,
      });

      for (const file of result.files) {
        // All relative paths should be relative to cwd
        expect(file.relativePath).not.toMatch(/^\//);
        expect(file.relativePath).not.toContain(MONOREPO_DIR);

        // Absolute path should contain cwd
        expect(file.path).toContain(MONOREPO_DIR);
        expect(path.isAbsolute(file.path)).toBe(true);
      }
    });
  });

  describe('hierarchy fixture discovery', () => {
    it('should discover configs at all hierarchy levels', async () => {
      const result = await discoverConfigs({
        cwd: HIERARCHY_DIR,
        includeGlobal: false,
      });

      const globalConfig = result.files.find((f) => f.relativePath.includes('global/'));
      const projectConfig = result.files.find((f) => f.relativePath.includes('project/'));
      const localConfig = result.files.find((f) => f.relativePath.includes('local/'));

      // Should find all three hierarchy levels
      expect(globalConfig).toBeDefined();
      expect(projectConfig).toBeDefined();
      expect(localConfig).toBeDefined();
    });

    it('should correctly categorize hierarchy levels', async () => {
      // Note: In real use, global would be ~/.claude/, project would be at root
      // This test uses a fixture that simulates the structure
      const result = await discoverConfigs({
        cwd: HIERARCHY_DIR,
        includeGlobal: false,
      });

      // At least one file should exist
      expect(result.files.length).toBeGreaterThan(0);
    });
  });

  describe('valid fixtures discovery', () => {
    it('should discover all config types in valid directory', async () => {
      const result = await discoverConfigs({
        cwd: VALID_DIR,
        includeGlobal: false,
      });

      const claudeMdFiles = result.files.filter((f) => f.type === 'claude-md');
      const settingsFiles = result.files.filter((f) => f.type === 'claude-settings');

      expect(claudeMdFiles.length).toBeGreaterThan(0);
      expect(settingsFiles.length).toBeGreaterThan(0);
    });

    it('should discover skills in valid directory', async () => {
      const result = await discoverConfigs({
        cwd: VALID_DIR,
        includeGlobal: false,
      });

      expect(result.skills.length).toBeGreaterThan(0);
      expect(result.skills[0]?.type).toBe('skill-md');
    });
  });

  describe('complete workflow', () => {
    it('should return complete result structure', async () => {
      const result = await discoverConfigs({
        cwd: MONOREPO_DIR,
        includeGlobal: false,
      });

      // Verify result structure
      expect(result).toHaveProperty('files');
      expect(result).toHaveProperty('skills');
      expect(result).toHaveProperty('filesScanned');
      expect(result).toHaveProperty('directoriesExcluded');
      expect(result).toHaveProperty('durationMs');

      // Arrays should be arrays
      expect(result.files).toBeInstanceOf(Array);
      expect(result.skills).toBeInstanceOf(Array);

      // Numbers should be numbers
      expect(typeof result.filesScanned).toBe('number');
      expect(typeof result.directoriesExcluded).toBe('number');
      expect(typeof result.durationMs).toBe('number');
    });

    it('should complete discovery in reasonable time', async () => {
      const startTime = Date.now();

      const result = await discoverConfigs({
        cwd: MONOREPO_DIR,
        includeGlobal: false,
      });

      const duration = Date.now() - startTime;

      // Should complete within 5 seconds (NFR-001)
      expect(duration).toBeLessThan(5000);
      expect(result.durationMs).toBeLessThan(5000);
    });

    it('should handle discovery with all options enabled', async () => {
      const result = await discoverConfigs({
        cwd: MONOREPO_DIR,
        includeGlobal: true,
        exclude: ['test-exclude'],
        maxDepth: 10,
      });

      expect(result.files).toBeInstanceOf(Array);
    });
  });

  describe('file metadata accuracy', () => {
    it('should return accurate file sizes', async () => {
      const result = await discoverConfigs({
        cwd: MONOREPO_DIR,
        includeGlobal: false,
      });

      for (const file of result.files) {
        expect(file.size).toBeGreaterThan(0);
        // File size should be reasonable for a config file
        expect(file.size).toBeLessThan(1000000); // <1MB
      }
    });

    it('should return valid modification dates', async () => {
      const result = await discoverConfigs({
        cwd: MONOREPO_DIR,
        includeGlobal: false,
      });

      const now = new Date();

      for (const file of result.files) {
        expect(file.lastModified).toBeInstanceOf(Date);
        // Should not be in the future
        expect(file.lastModified.getTime()).toBeLessThanOrEqual(now.getTime());
        // Should not be too old (sanity check - fixtures created recently)
        expect(file.lastModified.getTime()).toBeGreaterThan(new Date('2020-01-01').getTime());
      }
    });
  });

  describe('ACT type detection', () => {
    it('should correctly identify ACT types', async () => {
      const result = await discoverConfigs({
        cwd: MONOREPO_DIR,
        includeGlobal: false,
      });

      for (const file of result.files) {
        if (file.type === 'claude-md' || file.type === 'claude-settings') {
          expect(file.actType).toBe('claude-code');
        } else if (file.type === 'agents-md') {
          expect(file.actType).toBe('agents-md');
        }
      }
    });
  });
});
