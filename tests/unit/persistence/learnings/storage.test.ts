/**
 * Unit tests for persistence/learnings/storage.ts
 *
 * Tests learning save/load operations with markdown + YAML frontmatter format.
 * Tests project-scoped learnings in .agentlint/learnings/
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import type { Learning, CreateLearningInput } from '../../../../src/persistence/types';

// Functions to be implemented in T036-T041
import {
  saveLearning,
  loadLearning,
  listLearnings,
  deleteLearning,
  getLearningsDir,
  LEARNING_VERSION,
} from '../../../../src/persistence/learnings/storage';

describe('learnings/storage', () => {
  const testBaseDir = join(tmpdir(), 'agentlint-test-learnings-storage');

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
    // Clean up test directory
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true });
    }
  });

  describe('saveLearning', () => {
    it('should save learning to markdown file with YAML frontmatter', async () => {
      const input = createTestLearningInput();

      const result = await saveLearning(input, { baseDir: testBaseDir });

      expect(result.id).toBeDefined();
      expect(result.filePath).toContain(testBaseDir);
      expect(result.filePath).toEndWith('.md');
      expect(existsSync(result.filePath)).toBe(true);
    });

    it('should create directory if it does not exist', async () => {
      const input = createTestLearningInput();

      expect(existsSync(testBaseDir)).toBe(false);

      await saveLearning(input, { baseDir: testBaseDir });

      expect(existsSync(testBaseDir)).toBe(true);
    });

    it('should generate unique ID for each learning', async () => {
      const input = createTestLearningInput();

      const result1 = await saveLearning(input, { baseDir: testBaseDir });
      const result2 = await saveLearning(input, { baseDir: testBaseDir });

      expect(result1.id).not.toBe(result2.id);
    });

    it('should include version in saved file', async () => {
      const input = createTestLearningInput();

      const result = await saveLearning(input, { baseDir: testBaseDir });
      const content = await Bun.file(result.filePath).text();

      expect(content).toContain(`version: "${LEARNING_VERSION}"`);
    });

    it('should preserve all input fields', async () => {
      const input = createTestLearningInput({
        title: 'API Error Handling',
        content: '# API Error Handling\n\nAlways use exponential backoff.',
        tags: ['api', 'error-handling', 'resilience'],
        category: 'patterns',
        scope: 'project',
        origin: {
          project: '/test/project',
          sessionId: 'session-123',
        },
      });

      const result = await saveLearning(input, { baseDir: testBaseDir });
      const loaded = await loadLearning(result.id, { baseDir: testBaseDir });

      expect(loaded?.title).toBe(input.title);
      expect(loaded?.content).toContain('exponential backoff');
      expect(loaded?.tags).toEqual(input.tags);
      expect(loaded?.category).toBe(input.category);
      expect(loaded?.scope).toBe(input.scope);
      expect(loaded?.origin?.project).toBe(input.origin?.project);
      expect(loaded?.origin?.sessionId).toBe(input.origin?.sessionId);
    });

    it('should set createdAt and updatedAt timestamps', async () => {
      const input = createTestLearningInput();
      const beforeSave = new Date().toISOString();

      const result = await saveLearning(input, { baseDir: testBaseDir });
      const loaded = await loadLearning(result.id, { baseDir: testBaseDir });

      expect(loaded?.createdAt).toBeDefined();
      expect(loaded?.updatedAt).toBeDefined();
      expect(new Date(loaded!.createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeSave).getTime() - 1000
      );
    });

    it('should handle minimal input (no optional fields)', async () => {
      const input: CreateLearningInput = {
        title: 'Minimal Learning',
        content: 'Just the basics.',
        category: 'tools',
        scope: 'project',
      };

      const result = await saveLearning(input, { baseDir: testBaseDir });
      const loaded = await loadLearning(result.id, { baseDir: testBaseDir });

      expect(loaded?.title).toBe('Minimal Learning');
      expect(loaded?.tags).toEqual([]);
    });

    it('should create filename with date prefix and slug', async () => {
      const input = createTestLearningInput({ title: 'API Error Handling' });

      const result = await saveLearning(input, { baseDir: testBaseDir });
      const filename = result.filePath.split('/').pop()!;

      // Filename should be like: 2026-01-16-api-error-handling-abc123.md
      expect(filename).toMatch(/^\d{4}-\d{2}-\d{2}-[\w-]+-[a-f0-9]+\.md$/);
      expect(filename).toContain('api-error-handling');
    });

    it('should handle special characters in title', async () => {
      const input = createTestLearningInput({ title: "Don't Use & or < in Titles!" });

      const result = await saveLearning(input, { baseDir: testBaseDir });
      const loaded = await loadLearning(result.id, { baseDir: testBaseDir });

      expect(loaded?.title).toBe("Don't Use & or < in Titles!");
    });
  });

  describe('loadLearning', () => {
    it('should load saved learning by ID', async () => {
      const input = createTestLearningInput();
      const saved = await saveLearning(input, { baseDir: testBaseDir });

      const loaded = await loadLearning(saved.id, { baseDir: testBaseDir });

      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe(saved.id);
      expect(loaded?.title).toBe(input.title);
    });

    it('should return null for non-existent learning', async () => {
      const loaded = await loadLearning('non-existent-id', { baseDir: testBaseDir });

      expect(loaded).toBeNull();
    });

    it('should return null when directory does not exist', async () => {
      const loaded = await loadLearning('any-id', { baseDir: '/non/existent/path' });

      expect(loaded).toBeNull();
    });

    it('should handle corrupted markdown gracefully', async () => {
      // Create directory and corrupted file manually
      const { mkdir } = await import('node:fs/promises');
      await mkdir(testBaseDir, { recursive: true });
      await Bun.write(join(testBaseDir, '2026-01-16-corrupted-abc123.md'), 'not valid yaml frontmatter');

      const loaded = await loadLearning('abc123', { baseDir: testBaseDir });

      // Should return null for corrupted file
      expect(loaded).toBeNull();
    });

    it('should warn on version mismatch but still load', async () => {
      const input = createTestLearningInput();
      const saved = await saveLearning(input, { baseDir: testBaseDir });

      // Manually modify version in file
      const content = await Bun.file(saved.filePath).text();
      const modified = content.replace(`version: "${LEARNING_VERSION}"`, 'version: "0.0.1"');
      await Bun.write(saved.filePath, modified);

      // Should still load (best-effort parsing per spec)
      const loaded = await loadLearning(saved.id, { baseDir: testBaseDir });

      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe(saved.id);
    });

    it('should parse markdown content correctly', async () => {
      const input = createTestLearningInput({
        content: `# Main Section

Some text here.

## Subsection

- List item 1
- List item 2

\`\`\`typescript
const x = 1;
\`\`\`
`,
      });

      const saved = await saveLearning(input, { baseDir: testBaseDir });
      const loaded = await loadLearning(saved.id, { baseDir: testBaseDir });

      expect(loaded?.content).toContain('# Main Section');
      expect(loaded?.content).toContain('## Subsection');
      expect(loaded?.content).toContain('const x = 1');
    });
  });

  describe('listLearnings', () => {
    it('should return all learning IDs', async () => {
      const inputs = [
        createTestLearningInput({ title: 'Learning 1' }),
        createTestLearningInput({ title: 'Learning 2' }),
        createTestLearningInput({ title: 'Learning 3' }),
      ];

      const saved = [];
      for (const input of inputs) {
        saved.push(await saveLearning(input, { baseDir: testBaseDir }));
      }

      const ids = await listLearnings({ baseDir: testBaseDir });

      expect(ids.length).toBe(3);
      for (const s of saved) {
        expect(ids).toContain(s.id);
      }
    });

    it('should return empty array when no learnings exist', async () => {
      const ids = await listLearnings({ baseDir: testBaseDir });

      expect(ids).toEqual([]);
    });

    it('should return empty array when directory does not exist', async () => {
      const ids = await listLearnings({ baseDir: '/non/existent/path' });

      expect(ids).toEqual([]);
    });

    it('should only return .md files', async () => {
      const input = createTestLearningInput();
      await saveLearning(input, { baseDir: testBaseDir });

      // Create non-markdown files
      await Bun.write(join(testBaseDir, 'not-a-learning.txt'), 'some content');
      await Bun.write(join(testBaseDir, 'readme.json'), '{}');

      const ids = await listLearnings({ baseDir: testBaseDir });

      expect(ids.length).toBe(1);
    });
  });

  describe('deleteLearning', () => {
    it('should delete existing learning', async () => {
      const input = createTestLearningInput();
      const saved = await saveLearning(input, { baseDir: testBaseDir });

      const deleted = await deleteLearning(saved.id, { baseDir: testBaseDir });

      expect(deleted).toBe(true);

      const loaded = await loadLearning(saved.id, { baseDir: testBaseDir });
      expect(loaded).toBeNull();
    });

    it('should return false for non-existent learning', async () => {
      const deleted = await deleteLearning('non-existent', { baseDir: testBaseDir });

      expect(deleted).toBe(false);
    });

    it('should not affect other learnings', async () => {
      const input1 = createTestLearningInput({ title: 'Learning 1' });
      const input2 = createTestLearningInput({ title: 'Learning 2' });
      const saved1 = await saveLearning(input1, { baseDir: testBaseDir });
      const saved2 = await saveLearning(input2, { baseDir: testBaseDir });

      await deleteLearning(saved1.id, { baseDir: testBaseDir });

      const loaded1 = await loadLearning(saved1.id, { baseDir: testBaseDir });
      const loaded2 = await loadLearning(saved2.id, { baseDir: testBaseDir });

      expect(loaded1).toBeNull();
      expect(loaded2).not.toBeNull();
    });
  });

  describe('getLearningsDir', () => {
    it('should return default directory when no base provided', () => {
      const dir = getLearningsDir('project');

      expect(dir).toContain('.agentlint');
      expect(dir).toContain('learnings');
    });

    it('should return global directory for global scope', () => {
      const dir = getLearningsDir('global');

      expect(dir).toContain('agentlint');
      expect(dir).toContain('learnings');
    });

    it('should return custom directory when provided', () => {
      const customDir = '/custom/learnings/dir';
      const dir = getLearningsDir('project', customDir);

      expect(dir).toBe(customDir);
    });
  });

  describe('category filtering', () => {
    it('should save and load different categories', async () => {
      const categories = ['patterns', 'anti-patterns', 'tools', 'workflows'] as const;

      for (const category of categories) {
        const input = createTestLearningInput({
          title: `${category} Learning`,
          category,
        });
        const saved = await saveLearning(input, { baseDir: testBaseDir });
        const loaded = await loadLearning(saved.id, { baseDir: testBaseDir });

        expect(loaded?.category).toBe(category);
      }
    });
  });

  describe('YAML frontmatter format', () => {
    it('should create valid YAML frontmatter', async () => {
      const input = createTestLearningInput({
        title: 'Test Title',
        tags: ['tag1', 'tag2'],
        category: 'patterns',
      });

      const saved = await saveLearning(input, { baseDir: testBaseDir });
      const content = await Bun.file(saved.filePath).text();

      // Should start with ---
      expect(content).toMatch(/^---\n/);
      // Should have closing ---
      expect(content).toContain('\n---\n');
      // Should have required frontmatter fields
      expect(content).toContain('id:');
      expect(content).toContain('title:');
      expect(content).toContain('category:');
      expect(content).toContain('tags:');
    });

    it('should separate frontmatter from content', async () => {
      const input = createTestLearningInput({
        title: 'Test Title',
        content: '# My Learning\n\nThe actual content here.',
      });

      const saved = await saveLearning(input, { baseDir: testBaseDir });
      const content = await Bun.file(saved.filePath).text();

      // Content should be after the second ---
      const parts = content.split('---');
      expect(parts.length).toBeGreaterThanOrEqual(3);
      const markdownContent = parts.slice(2).join('---').trim();
      expect(markdownContent).toContain('# My Learning');
      expect(markdownContent).toContain('The actual content here');
    });
  });
});
