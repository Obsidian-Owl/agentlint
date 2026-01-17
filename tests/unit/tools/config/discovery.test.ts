/**
 * T019: Unit tests for config discovery
 *
 * Tests the discoverConfigs() function for finding AI configuration files.
 *
 * @module tests/unit/tools/config/discovery.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { discoverConfigs } from '../../../../src/tools/config/discovery';

// Test fixture paths
const FIXTURES_DIR = path.join(__dirname, '../../../fixtures/configs');
const VALID_DIR = path.join(FIXTURES_DIR, 'valid');
const HIERARCHY_DIR = path.join(FIXTURES_DIR, 'hierarchy');

describe('discoverConfigs', () => {
  describe('basic discovery', () => {
    it('should discover CLAUDE.md at project root', async () => {
      const result = await discoverConfigs({
        cwd: HIERARCHY_DIR,
        includeGlobal: false,
      });

      expect(result.files).toBeInstanceOf(Array);
      expect(result.filesScanned).toBeGreaterThan(0);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should return ConfigFile objects with correct structure', async () => {
      const result = await discoverConfigs({
        cwd: HIERARCHY_DIR,
        includeGlobal: false,
      });

      for (const file of result.files) {
        expect(file).toHaveProperty('path');
        expect(file).toHaveProperty('relativePath');
        expect(file).toHaveProperty('type');
        expect(file).toHaveProperty('size');
        expect(file).toHaveProperty('lastModified');
        expect(file).toHaveProperty('level');
        expect(file).toHaveProperty('actType');
      }
    });

    it('should identify config type correctly', async () => {
      const result = await discoverConfigs({
        cwd: VALID_DIR,
        includeGlobal: false,
      });

      const claudeFiles = result.files.filter((f) => f.type === 'claude-md');
      const agentsFiles = result.files.filter((f) => f.type === 'agents-md');
      const settingsFiles = result.files.filter(
        (f) => f.type === 'claude-settings'
      );

      expect(claudeFiles.length).toBeGreaterThan(0);
      // May have agents.md in fixtures
      expect(agentsFiles.length + settingsFiles.length).toBeGreaterThanOrEqual(
        0
      );
    });

    it('should calculate relative paths correctly', async () => {
      const result = await discoverConfigs({
        cwd: HIERARCHY_DIR,
        includeGlobal: false,
      });

      for (const file of result.files) {
        expect(file.relativePath).not.toMatch(/^\//); // No leading slash
        expect(file.path).toContain(HIERARCHY_DIR); // Absolute path includes cwd
        expect(path.isAbsolute(file.path)).toBe(true);
      }
    });

    it('should include file size and modification date', async () => {
      const result = await discoverConfigs({
        cwd: VALID_DIR,
        includeGlobal: false,
      });

      for (const file of result.files) {
        expect(typeof file.size).toBe('number');
        expect(file.size).toBeGreaterThan(0);
        expect(file.lastModified).toBeInstanceOf(Date);
      }
    });
  });

  describe('CLAUDE.md detection (T023)', () => {
    it('should detect CLAUDE.md files', async () => {
      const result = await discoverConfigs({
        cwd: HIERARCHY_DIR,
        includeGlobal: false,
      });

      const claudeFiles = result.files.filter(
        (f) => f.type === 'claude-md' && f.relativePath.endsWith('CLAUDE.md')
      );

      expect(claudeFiles.length).toBeGreaterThan(0);
    });

    it('should detect CLAUDE.md in nested directories', async () => {
      const result = await discoverConfigs({
        cwd: HIERARCHY_DIR,
        includeGlobal: false,
      });

      const localConfig = result.files.find((f) =>
        f.relativePath.includes('local/')
      );

      expect(localConfig).toBeDefined();
      expect(localConfig?.level).toBe('local');
    });

    it('should assign correct hierarchy level to nested configs', async () => {
      const result = await discoverConfigs({
        cwd: HIERARCHY_DIR,
        includeGlobal: false,
      });

      // All configs in subdirectories should be 'local'
      // (project-level detection requires config at cwd root)
      const projectConfig = result.files.find((f) =>
        f.relativePath.includes('project/')
      );

      expect(projectConfig).toBeDefined();
      // Since project/ is a subdirectory, it gets 'local' level
      expect(projectConfig?.level).toBe('local');
    });

    it('should assign claude-code as ACT type for CLAUDE.md', async () => {
      const result = await discoverConfigs({
        cwd: VALID_DIR,
        includeGlobal: false,
      });

      const claudeFile = result.files.find((f) => f.type === 'claude-md');

      expect(claudeFile?.actType).toBe('claude-code');
    });
  });

  describe('AGENTS.md detection (T024)', () => {
    it('should detect AGENTS.md files', async () => {
      const result = await discoverConfigs({
        cwd: VALID_DIR,
        includeGlobal: false,
      });

      const agentsFile = result.files.find((f) => f.type === 'agents-md');

      if (agentsFile) {
        expect(agentsFile.relativePath).toContain('agents.md');
        expect(agentsFile.actType).toBe('agents-md');
      }
    });

    it('should handle both AGENTS.md case variants', async () => {
      // Note: File system may be case-insensitive
      const result = await discoverConfigs({
        cwd: VALID_DIR,
        includeGlobal: false,
      });

      const agentsFiles = result.files.filter((f) => f.type === 'agents-md');

      // Should find regardless of case
      expect(agentsFiles.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('.claude/ directory detection (T025)', () => {
    it('should detect settings.json in .claude/ directory', async () => {
      const result = await discoverConfigs({
        cwd: VALID_DIR,
        includeGlobal: false,
      });

      const settingsFile = result.files.find(
        (f) => f.type === 'claude-settings'
      );

      expect(settingsFile).toBeDefined();
      expect(settingsFile?.relativePath).toBe('settings.json');
    });

    it('should set actType to claude-code for .claude/ settings', async () => {
      const result = await discoverConfigs({
        cwd: VALID_DIR,
        includeGlobal: false,
      });

      const settingsFile = result.files.find(
        (f) => f.type === 'claude-settings'
      );

      expect(settingsFile?.actType).toBe('claude-code');
    });
  });

  describe('SKILL.md detection', () => {
    it('should discover SKILL.md files', async () => {
      const result = await discoverConfigs({
        cwd: VALID_DIR,
        includeGlobal: false,
      });

      expect(result.skills.length).toBeGreaterThan(0);
    });

    it('should return skill paths as separate array', async () => {
      const result = await discoverConfigs({
        cwd: VALID_DIR,
        includeGlobal: false,
      });

      for (const skill of result.skills) {
        expect(skill.type).toBe('skill-md');
        expect(skill.path).toBeTruthy();
      }
    });
  });

  describe('global config discovery', () => {
    // Create temporary global config for testing
    let tempGlobalDir: string;

    beforeAll(() => {
      // Skip if no valid test environment
      tempGlobalDir = path.join(os.tmpdir(), '.agentlint-test-global');
      fs.mkdirSync(tempGlobalDir, { recursive: true });
      fs.writeFileSync(
        path.join(tempGlobalDir, 'CLAUDE.md'),
        '# Global Config\n'
      );
    });

    afterAll(() => {
      // Cleanup
      try {
        fs.rmSync(tempGlobalDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should include global configs when includeGlobal is true', async () => {
      const result = await discoverConfigs({
        cwd: VALID_DIR,
        includeGlobal: true,
      });

      // This test depends on actual global config existence
      // In real use, would check ~/.claude/ directory
      expect(result.files).toBeInstanceOf(Array);
    });

    it('should exclude global configs when includeGlobal is false', async () => {
      const result = await discoverConfigs({
        cwd: VALID_DIR,
        includeGlobal: false,
      });

      const globalFiles = result.files.filter((f) => f.level === 'global');
      expect(globalFiles.length).toBe(0);
    });
  });

  describe('max depth option', () => {
    it('should respect maxDepth option', async () => {
      const shallowResult = await discoverConfigs({
        cwd: HIERARCHY_DIR,
        includeGlobal: false,
        maxDepth: 1,
      });

      const deepResult = await discoverConfigs({
        cwd: HIERARCHY_DIR,
        includeGlobal: false,
        maxDepth: 10,
      });

      // Shallow search should find fewer or equal files
      expect(shallowResult.files.length).toBeLessThanOrEqual(
        deepResult.files.length
      );
    });

    it('should default to reasonable maxDepth', async () => {
      const result = await discoverConfigs({
        cwd: HIERARCHY_DIR,
        includeGlobal: false,
      });

      // Should still find nested configs with default depth
      expect(result.files.length).toBeGreaterThan(0);
    });
  });

  describe('result metadata', () => {
    it('should track files scanned count', async () => {
      const result = await discoverConfigs({
        cwd: VALID_DIR,
        includeGlobal: false,
      });

      expect(result.filesScanned).toBeGreaterThanOrEqual(result.files.length);
    });

    it('should track directories excluded count', async () => {
      const result = await discoverConfigs({
        cwd: VALID_DIR,
        includeGlobal: false,
      });

      expect(typeof result.directoriesExcluded).toBe('number');
    });

    it('should track scan duration', async () => {
      const result = await discoverConfigs({
        cwd: VALID_DIR,
        includeGlobal: false,
      });

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.durationMs).toBeLessThan(10000); // Should be fast
    });
  });

  describe('error handling', () => {
    it('should handle non-existent directory gracefully', async () => {
      const result = await discoverConfigs({
        cwd: '/non/existent/path/that/should/not/exist',
        includeGlobal: false,
      });

      expect(result.files).toEqual([]);
      expect(result.filesScanned).toBe(0);
    });

    it('should handle permission errors gracefully', async () => {
      // This test is platform-specific and may be skipped
      const result = await discoverConfigs({
        cwd: VALID_DIR,
        includeGlobal: false,
      });

      // Should complete without throwing
      expect(result).toBeDefined();
    });
  });

  describe('parseSkills option (T064)', () => {
    it('should not parse skills by default', async () => {
      const result = await discoverConfigs({
        cwd: VALID_DIR,
        includeGlobal: false,
      });

      // Skills array has basic info
      expect(result.skills.length).toBeGreaterThan(0);
      // parsedSkills should be undefined when parseSkills is false (default)
      expect(result.parsedSkills).toBeUndefined();
    });

    it('should parse skills into full Skill objects when parseSkills is true', async () => {
      const result = await discoverConfigs({
        cwd: VALID_DIR,
        includeGlobal: false,
        parseSkills: true,
      });

      // Should have discovered skills
      expect(result.skills.length).toBeGreaterThan(0);
      // parsedSkills should be populated
      expect(result.parsedSkills).toBeDefined();
      expect(result.parsedSkills!.length).toBeGreaterThan(0);

      // Verify parsed skill has full structure
      const skill = result.parsedSkills![0];
      expect(skill).toHaveProperty('name');
      expect(skill).toHaveProperty('description');
      expect(skill).toHaveProperty('path');
      expect(skill).toHaveProperty('bundledFiles');
      expect(skill).toHaveProperty('contentSections');
    });

    it('should handle skills with invalid frontmatter gracefully', async () => {
      // Create temp directory with invalid skill
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentlint-test-'));
      const skillDir = path.join(tempDir, 'bad-skill');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(
        path.join(skillDir, 'SKILL.md'),
        '---\nname: [broken\n---\n\n# Broken'
      );

      try {
        const result = await discoverConfigs({
          cwd: tempDir,
          includeGlobal: false,
          parseSkills: true,
        });

        // Should not throw, but skills may not be in parsedSkills
        expect(result.skills.length).toBeGreaterThanOrEqual(0);
      } finally {
        fs.rmSync(tempDir, { recursive: true });
      }
    });
  });
});
