/**
 * Unit tests for persistence/learnings/indexer.ts
 *
 * Tests SQLite indexing operations for learnings.
 * Tests index creation, querying by category/tag, and listAll functionality.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import type { Learning } from '../../../../src/persistence/types';

// Functions to be implemented in T036-T041
import {
  initLearningsIndex,
  indexLearning,
  queryLearnings,
  getLearningById,
  removeLearningFromIndex,
  listAllLearnings,
  closeLearningsIndex,
} from '../../../../src/persistence/learnings/indexer';

describe('learnings/indexer', () => {
  const testBaseDir = join(tmpdir(), 'agentlint-test-learnings-indexer');

  // Helper to create a test learning
  function createTestLearning(overrides: Partial<Learning> = {}): Learning {
    return {
      id: crypto.randomUUID(),
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      title: 'Test Learning',
      content: '# Test Learning\n\nContent here.',
      tags: ['test'],
      category: 'patterns',
      scope: 'project',
      ...overrides,
    };
  }

  beforeEach(async () => {
    // Clean up test directory
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true });
    }
    // Initialize a fresh index
    await initLearningsIndex({ baseDir: testBaseDir });
  });

  afterEach(async () => {
    // Close database connection
    await closeLearningsIndex({ baseDir: testBaseDir });
    // Clean up test directory
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true });
    }
  });

  describe('initLearningsIndex', () => {
    it('should create learnings.db file', async () => {
      const dbPath = join(testBaseDir, 'learnings.db');
      expect(existsSync(dbPath)).toBe(true);
    });

    it('should create directory if it does not exist', async () => {
      const newDir = join(tmpdir(), 'agentlint-test-learnings-init-new');
      if (existsSync(newDir)) {
        rmSync(newDir, { recursive: true });
      }

      await initLearningsIndex({ baseDir: newDir });

      expect(existsSync(newDir)).toBe(true);
      expect(existsSync(join(newDir, 'learnings.db'))).toBe(true);

      await closeLearningsIndex({ baseDir: newDir });
      rmSync(newDir, { recursive: true });
    });

    it('should be idempotent (safe to call multiple times)', async () => {
      // Already initialized in beforeEach
      // Call again - should not throw
      await initLearningsIndex({ baseDir: testBaseDir });

      const dbPath = join(testBaseDir, 'learnings.db');
      expect(existsSync(dbPath)).toBe(true);
    });
  });

  describe('indexLearning', () => {
    it('should index a learning', async () => {
      const learning = createTestLearning();

      await indexLearning(learning, { baseDir: testBaseDir });

      const retrieved = await getLearningById(learning.id, { baseDir: testBaseDir });
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(learning.id);
    });

    it('should store all queryable fields', async () => {
      const learning = createTestLearning({
        title: 'API Patterns',
        category: 'patterns',
        tags: ['api', 'rest', 'best-practice'],
        scope: 'project',
      });

      await indexLearning(learning, { baseDir: testBaseDir });

      const retrieved = await getLearningById(learning.id, { baseDir: testBaseDir });
      expect(retrieved?.title).toBe('API Patterns');
      expect(retrieved?.category).toBe('patterns');
      expect(retrieved?.tags).toContain('api');
      expect(retrieved?.scope).toBe('project');
    });

    it('should handle update of existing learning', async () => {
      const learning = createTestLearning({ title: 'Original Title' });
      await indexLearning(learning, { baseDir: testBaseDir });

      // Update the learning
      const updated = { ...learning, title: 'Updated Title', updatedAt: new Date().toISOString() };
      await indexLearning(updated, { baseDir: testBaseDir });

      const retrieved = await getLearningById(learning.id, { baseDir: testBaseDir });
      expect(retrieved?.title).toBe('Updated Title');
    });
  });

  describe('queryLearnings', () => {
    beforeEach(async () => {
      // Seed with test data
      const learnings = [
        createTestLearning({ title: 'API Pattern', category: 'patterns', tags: ['api', 'rest'] }),
        createTestLearning({ title: 'DB Anti-Pattern', category: 'anti-patterns', tags: ['database', 'sql'] }),
        createTestLearning({ title: 'Git Workflow', category: 'workflows', tags: ['git', 'version-control'] }),
        createTestLearning({ title: 'Testing Tool', category: 'tools', tags: ['testing', 'jest'] }),
        createTestLearning({ title: 'Another API Pattern', category: 'patterns', tags: ['api', 'graphql'] }),
      ];

      for (const l of learnings) {
        await indexLearning(l, { baseDir: testBaseDir });
      }
    });

    it('should return all learnings with no filters', async () => {
      const results = await queryLearnings({}, { baseDir: testBaseDir });

      expect(results.length).toBe(5);
    });

    it('should filter by category', async () => {
      const results = await queryLearnings({ category: 'patterns' }, { baseDir: testBaseDir });

      expect(results.length).toBe(2);
      expect(results.every((r) => r.category === 'patterns')).toBe(true);
    });

    it('should filter by tag', async () => {
      const results = await queryLearnings({ tag: 'api' }, { baseDir: testBaseDir });

      expect(results.length).toBe(2);
      expect(results.every((r) => r.tags.includes('api'))).toBe(true);
    });

    it('should filter by scope', async () => {
      // Add a global learning
      const globalLearning = createTestLearning({ scope: 'global', title: 'Global Insight' });
      await indexLearning(globalLearning, { baseDir: testBaseDir });

      const projectResults = await queryLearnings({ scope: 'project' }, { baseDir: testBaseDir });
      const globalResults = await queryLearnings({ scope: 'global' }, { baseDir: testBaseDir });

      expect(projectResults.length).toBe(5);
      expect(globalResults.length).toBe(1);
    });

    it('should limit results', async () => {
      const results = await queryLearnings({ limit: 3 }, { baseDir: testBaseDir });

      expect(results.length).toBe(3);
    });

    it('should order by createdAt descending by default', async () => {
      const results = await queryLearnings({}, { baseDir: testBaseDir });

      for (let i = 0; i < results.length - 1; i++) {
        expect(new Date(results[i]!.createdAt).getTime()).toBeGreaterThanOrEqual(
          new Date(results[i + 1]!.createdAt).getTime()
        );
      }
    });

    it('should order by updatedAt when specified', async () => {
      const results = await queryLearnings({ orderBy: 'updatedAt' }, { baseDir: testBaseDir });

      for (let i = 0; i < results.length - 1; i++) {
        expect(new Date(results[i]!.updatedAt).getTime()).toBeGreaterThanOrEqual(
          new Date(results[i + 1]!.updatedAt).getTime()
        );
      }
    });

    it('should support ascending order', async () => {
      const results = await queryLearnings({ order: 'asc' }, { baseDir: testBaseDir });

      for (let i = 0; i < results.length - 1; i++) {
        expect(new Date(results[i]!.createdAt).getTime()).toBeLessThanOrEqual(
          new Date(results[i + 1]!.createdAt).getTime()
        );
      }
    });

    it('should combine multiple filters', async () => {
      const results = await queryLearnings(
        { category: 'patterns', tag: 'api' },
        { baseDir: testBaseDir }
      );

      expect(results.length).toBe(2);
      expect(results.every((r) => r.category === 'patterns' && r.tags.includes('api'))).toBe(true);
    });
  });

  describe('getLearningById', () => {
    it('should return learning by ID', async () => {
      const learning = createTestLearning({ title: 'Find Me' });
      await indexLearning(learning, { baseDir: testBaseDir });

      const retrieved = await getLearningById(learning.id, { baseDir: testBaseDir });

      expect(retrieved?.id).toBe(learning.id);
      expect(retrieved?.title).toBe('Find Me');
    });

    it('should return null for non-existent ID', async () => {
      const retrieved = await getLearningById('non-existent-id', { baseDir: testBaseDir });

      expect(retrieved).toBeNull();
    });
  });

  describe('removeLearningFromIndex', () => {
    it('should remove learning from index', async () => {
      const learning = createTestLearning();
      await indexLearning(learning, { baseDir: testBaseDir });

      const removed = await removeLearningFromIndex(learning.id, { baseDir: testBaseDir });

      expect(removed).toBe(true);

      const retrieved = await getLearningById(learning.id, { baseDir: testBaseDir });
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent ID', async () => {
      const removed = await removeLearningFromIndex('non-existent-id', { baseDir: testBaseDir });

      expect(removed).toBe(false);
    });

    it('should not affect other learnings', async () => {
      const learning1 = createTestLearning({ title: 'Learning 1' });
      const learning2 = createTestLearning({ title: 'Learning 2' });
      await indexLearning(learning1, { baseDir: testBaseDir });
      await indexLearning(learning2, { baseDir: testBaseDir });

      await removeLearningFromIndex(learning1.id, { baseDir: testBaseDir });

      const retrieved1 = await getLearningById(learning1.id, { baseDir: testBaseDir });
      const retrieved2 = await getLearningById(learning2.id, { baseDir: testBaseDir });

      expect(retrieved1).toBeNull();
      expect(retrieved2).not.toBeNull();
    });
  });

  describe('listAllLearnings', () => {
    it('should list learnings from single database', async () => {
      const learnings = [
        createTestLearning({ scope: 'project', title: 'Project 1' }),
        createTestLearning({ scope: 'project', title: 'Project 2' }),
      ];

      for (const l of learnings) {
        await indexLearning(l, { baseDir: testBaseDir });
      }

      const results = await listAllLearnings(
        { projectDir: testBaseDir },
        {}
      );

      expect(results.length).toBe(2);
    });

    it('should merge project and global learnings when both provided', async () => {
      const globalDir = join(tmpdir(), 'agentlint-test-learnings-global-listall');
      if (existsSync(globalDir)) {
        rmSync(globalDir, { recursive: true });
      }

      // Initialize global index
      await initLearningsIndex({ baseDir: globalDir });

      // Add project learnings
      const projectLearning = createTestLearning({ scope: 'project', title: 'Project Learning' });
      await indexLearning(projectLearning, { baseDir: testBaseDir });

      // Add global learnings
      const globalLearning = createTestLearning({ scope: 'global', title: 'Global Learning' });
      await indexLearning(globalLearning, { baseDir: globalDir });

      // Query both
      const results = await listAllLearnings(
        { projectDir: testBaseDir, globalDir },
        {}
      );

      expect(results.length).toBe(2);
      expect(results.some((r) => r.title === 'Project Learning')).toBe(true);
      expect(results.some((r) => r.title === 'Global Learning')).toBe(true);

      // Cleanup
      await closeLearningsIndex({ baseDir: globalDir });
      rmSync(globalDir, { recursive: true });
    });

    it('should apply filters to merged results', async () => {
      const globalDir = join(tmpdir(), 'agentlint-test-learnings-global-filter');
      if (existsSync(globalDir)) {
        rmSync(globalDir, { recursive: true });
      }

      await initLearningsIndex({ baseDir: globalDir });

      // Add mixed learnings
      await indexLearning(
        createTestLearning({ scope: 'project', category: 'patterns', title: 'P1' }),
        { baseDir: testBaseDir }
      );
      await indexLearning(
        createTestLearning({ scope: 'project', category: 'tools', title: 'P2' }),
        { baseDir: testBaseDir }
      );
      await indexLearning(
        createTestLearning({ scope: 'global', category: 'patterns', title: 'G1' }),
        { baseDir: globalDir }
      );

      const results = await listAllLearnings(
        { projectDir: testBaseDir, globalDir },
        { category: 'patterns' }
      );

      expect(results.length).toBe(2);
      expect(results.every((r) => r.category === 'patterns')).toBe(true);

      await closeLearningsIndex({ baseDir: globalDir });
      rmSync(globalDir, { recursive: true });
    });

    it('should handle missing global directory gracefully', async () => {
      const projectLearning = createTestLearning({ scope: 'project' });
      await indexLearning(projectLearning, { baseDir: testBaseDir });

      const results = await listAllLearnings(
        { projectDir: testBaseDir, globalDir: '/non/existent/path' },
        {}
      );

      expect(results.length).toBe(1);
    });

    it('should handle missing project directory gracefully', async () => {
      const globalDir = join(tmpdir(), 'agentlint-test-learnings-global-only');
      if (existsSync(globalDir)) {
        rmSync(globalDir, { recursive: true });
      }

      await initLearningsIndex({ baseDir: globalDir });
      const globalLearning = createTestLearning({ scope: 'global' });
      await indexLearning(globalLearning, { baseDir: globalDir });

      const results = await listAllLearnings(
        { projectDir: '/non/existent/path', globalDir },
        {}
      );

      expect(results.length).toBe(1);

      await closeLearningsIndex({ baseDir: globalDir });
      rmSync(globalDir, { recursive: true });
    });
  });

  describe('tag serialization', () => {
    it('should store tags as JSON array', async () => {
      const learning = createTestLearning({
        tags: ['tag-one', 'tag-two', 'tag-three'],
      });

      await indexLearning(learning, { baseDir: testBaseDir });
      const retrieved = await getLearningById(learning.id, { baseDir: testBaseDir });

      expect(retrieved?.tags).toEqual(['tag-one', 'tag-two', 'tag-three']);
    });

    it('should handle empty tags array', async () => {
      const learning = createTestLearning({ tags: [] });

      await indexLearning(learning, { baseDir: testBaseDir });
      const retrieved = await getLearningById(learning.id, { baseDir: testBaseDir });

      expect(retrieved?.tags).toEqual([]);
    });

    it('should handle special characters in tags', async () => {
      const learning = createTestLearning({
        tags: ['c++', 'node.js', 'error-handling'],
      });

      await indexLearning(learning, { baseDir: testBaseDir });
      const retrieved = await getLearningById(learning.id, { baseDir: testBaseDir });

      expect(retrieved?.tags).toContain('c++');
      expect(retrieved?.tags).toContain('node.js');
    });
  });
});
