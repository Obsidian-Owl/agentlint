/**
 * Unit tests for global learning storage (US-006)
 *
 * Tests global scope learnings stored in ~/.agentlint/learnings/
 * Tests scope handling, directory auto-creation, and scope separation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import type { CreateLearningInput } from '../../../../src/persistence/types';

// Functions to be implemented in T036-T041
import {
  saveLearning,
  loadLearning,
  listLearnings,
  getLearningsDir,
} from '../../../../src/persistence/learnings/storage';

describe('learnings/global', () => {
  const testProjectDir = join(tmpdir(), 'agentlint-test-learnings-project');
  const testGlobalDir = join(tmpdir(), 'agentlint-test-learnings-global');

  // Helper to create a test learning input
  function createTestLearningInput(overrides: Partial<CreateLearningInput> = {}): CreateLearningInput {
    return {
      title: 'Test Learning',
      content: '# Test Learning\n\nThis is a test learning content.',
      tags: ['test', 'unit-test'],
      category: 'patterns',
      scope: 'project',
      ...overrides,
    };
  }

  beforeEach(() => {
    // Clean up test directories
    if (existsSync(testProjectDir)) {
      rmSync(testProjectDir, { recursive: true });
    }
    if (existsSync(testGlobalDir)) {
      rmSync(testGlobalDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test directories
    if (existsSync(testProjectDir)) {
      rmSync(testProjectDir, { recursive: true });
    }
    if (existsSync(testGlobalDir)) {
      rmSync(testGlobalDir, { recursive: true });
    }
  });

  describe('global scope storage', () => {
    it('should save global learning to global directory', async () => {
      const input = createTestLearningInput({
        scope: 'global',
        title: 'Global Pattern',
      });

      const result = await saveLearning(input, { baseDir: testGlobalDir });

      expect(result.filePath).toContain(testGlobalDir);
      expect(existsSync(result.filePath)).toBe(true);
    });

    it('should create global directory if it does not exist', async () => {
      const input = createTestLearningInput({ scope: 'global' });

      expect(existsSync(testGlobalDir)).toBe(false);

      await saveLearning(input, { baseDir: testGlobalDir });

      expect(existsSync(testGlobalDir)).toBe(true);
    });

    it('should preserve scope in saved file', async () => {
      const input = createTestLearningInput({ scope: 'global' });

      const saved = await saveLearning(input, { baseDir: testGlobalDir });
      const loaded = await loadLearning(saved.id, { baseDir: testGlobalDir });

      expect(loaded?.scope).toBe('global');
    });

    it('should store global and project learnings separately', async () => {
      const projectInput = createTestLearningInput({
        scope: 'project',
        title: 'Project Learning',
      });
      const globalInput = createTestLearningInput({
        scope: 'global',
        title: 'Global Learning',
      });

      await saveLearning(projectInput, { baseDir: testProjectDir });
      await saveLearning(globalInput, { baseDir: testGlobalDir });

      const projectIds = await listLearnings({ baseDir: testProjectDir });
      const globalIds = await listLearnings({ baseDir: testGlobalDir });

      expect(projectIds.length).toBe(1);
      expect(globalIds.length).toBe(1);
      expect(projectIds[0]).not.toBe(globalIds[0]);
    });
  });

  describe('origin tracking for promoted learnings', () => {
    it('should preserve origin.project when promoting', async () => {
      const input = createTestLearningInput({
        scope: 'global',
        origin: {
          project: '/original/project/path',
        },
      });

      const saved = await saveLearning(input, { baseDir: testGlobalDir });
      const loaded = await loadLearning(saved.id, { baseDir: testGlobalDir });

      expect(loaded?.origin?.project).toBe('/original/project/path');
    });

    it('should preserve origin.sessionId', async () => {
      const input = createTestLearningInput({
        scope: 'global',
        origin: {
          project: '/test/project',
          sessionId: 'session-uuid-123',
        },
      });

      const saved = await saveLearning(input, { baseDir: testGlobalDir });
      const loaded = await loadLearning(saved.id, { baseDir: testGlobalDir });

      expect(loaded?.origin?.sessionId).toBe('session-uuid-123');
    });

    it('should preserve origin.promotedAt timestamp', async () => {
      const promotedAt = new Date().toISOString();
      const input = createTestLearningInput({
        scope: 'global',
        origin: {
          project: '/test/project',
          promotedAt,
        },
      });

      const saved = await saveLearning(input, { baseDir: testGlobalDir });
      const loaded = await loadLearning(saved.id, { baseDir: testGlobalDir });

      expect(loaded?.origin?.promotedAt).toBe(promotedAt);
    });
  });

  describe('getLearningsDir for scopes', () => {
    it('should return different default directories for project and global', () => {
      const projectDir = getLearningsDir('project');
      const globalDir = getLearningsDir('global');

      expect(projectDir).not.toBe(globalDir);
    });

    it('should include home directory in global path', () => {
      const globalDir = getLearningsDir('global');

      // Global should be in home directory
      expect(globalDir.startsWith('/') || globalDir.includes('Users') || globalDir.includes('home')).toBe(
        true
      );
    });

    it('should include .agentlint in project path', () => {
      const projectDir = getLearningsDir('project');

      expect(projectDir).toContain('.agentlint');
    });
  });

  describe('cross-directory operations', () => {
    it('should not find project learning in global directory', async () => {
      const input = createTestLearningInput({ scope: 'project' });
      const saved = await saveLearning(input, { baseDir: testProjectDir });

      const loadedFromGlobal = await loadLearning(saved.id, { baseDir: testGlobalDir });

      expect(loadedFromGlobal).toBeNull();
    });

    it('should not find global learning in project directory', async () => {
      const input = createTestLearningInput({ scope: 'global' });
      const saved = await saveLearning(input, { baseDir: testGlobalDir });

      const loadedFromProject = await loadLearning(saved.id, { baseDir: testProjectDir });

      expect(loadedFromProject).toBeNull();
    });
  });

  describe('multiple global learnings', () => {
    it('should handle multiple global learnings', async () => {
      const inputs = [
        createTestLearningInput({ scope: 'global', title: 'Global 1', category: 'patterns' }),
        createTestLearningInput({ scope: 'global', title: 'Global 2', category: 'anti-patterns' }),
        createTestLearningInput({ scope: 'global', title: 'Global 3', category: 'tools' }),
      ];

      for (const input of inputs) {
        await saveLearning(input, { baseDir: testGlobalDir });
      }

      const ids = await listLearnings({ baseDir: testGlobalDir });

      expect(ids.length).toBe(3);
    });

    it('should preserve category in global learnings', async () => {
      const input = createTestLearningInput({
        scope: 'global',
        category: 'workflows',
      });

      const saved = await saveLearning(input, { baseDir: testGlobalDir });
      const loaded = await loadLearning(saved.id, { baseDir: testGlobalDir });

      expect(loaded?.category).toBe('workflows');
    });
  });

  describe('global learning validation metadata', () => {
    it('should handle full learning metadata', async () => {
      const input = createTestLearningInput({
        scope: 'global',
        title: 'Validated Global Pattern',
        tags: ['api', 'error-handling', 'best-practice'],
        category: 'patterns',
        origin: {
          project: '/path/to/original',
          sessionId: 'sess-123',
          promotedAt: '2026-01-15T10:00:00Z',
        },
      });

      const saved = await saveLearning(input, { baseDir: testGlobalDir });
      const loaded = await loadLearning(saved.id, { baseDir: testGlobalDir });

      expect(loaded?.title).toBe('Validated Global Pattern');
      expect(loaded?.tags).toContain('api');
      expect(loaded?.tags).toContain('error-handling');
      expect(loaded?.origin?.promotedAt).toBe('2026-01-15T10:00:00Z');
    });
  });
});
