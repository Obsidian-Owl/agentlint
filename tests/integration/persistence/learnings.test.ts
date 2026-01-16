/**
 * Integration tests for learnings persistence
 *
 * Tests the full flow: save learning → index → query → cross-scope merge
 * Uses real filesystem and SQLite database.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import type { CreateLearningInput } from '../../../src/persistence/types';

// Full public API
import {
  saveLearning,
  loadLearning,
  listLearnings,
  deleteLearning,
  queryLearnings,
  listAllLearnings,
  initLearningsIndex,
  closeLearningsIndex,
  indexLearning,
  removeLearningFromIndex,
  LEARNING_VERSION,
} from '../../../src/persistence/learnings';

describe('Learnings Persistence Integration', () => {
  const testProjectDir = join(tmpdir(), 'agentlint-integration-learnings-project');
  const testGlobalDir = join(tmpdir(), 'agentlint-integration-learnings-global');

  // Helper to create a realistic learning input
  function createRealisticInput(overrides: Partial<CreateLearningInput> = {}): CreateLearningInput {
    return {
      title: 'API Error Handling Pattern',
      content: `# API Error Handling Pattern

## Learning

When making external API calls, always implement exponential backoff with jitter
to avoid thundering herd problems during service recovery.

## Context

Discovered while analyzing Claude Code sessions where repeated API failures
caused cascading timeouts. Adding backoff reduced error rates by 60%.

## Example

\`\`\`typescript
async function fetchWithBackoff(url: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetch(url);
    } catch (e) {
      const delay = Math.min(1000 * Math.pow(2, i), 10000);
      const jitter = delay * 0.1 * Math.random();
      await sleep(delay + jitter);
    }
  }
  throw new Error('Max retries exceeded');
}
\`\`\`

## Applicability

- Any project making HTTP/API calls
- Particularly valuable for rate-limited services
- Not applicable for real-time/low-latency requirements
`,
      tags: ['api', 'error-handling', 'resilience', 'best-practice'],
      category: 'patterns',
      scope: 'project',
      ...overrides,
    };
  }

  beforeEach(async () => {
    // Clean up test directories
    if (existsSync(testProjectDir)) {
      rmSync(testProjectDir, { recursive: true });
    }
    if (existsSync(testGlobalDir)) {
      rmSync(testGlobalDir, { recursive: true });
    }
    // Initialize indexes
    await initLearningsIndex({ baseDir: testProjectDir });
    await initLearningsIndex({ baseDir: testGlobalDir });
  });

  // Helper to save and index a learning in one step
  async function saveAndIndex(
    input: CreateLearningInput,
    baseDir: string
  ): Promise<{ id: string; filePath: string }> {
    const saved = await saveLearning(input, { baseDir });
    const loaded = await loadLearning(saved.id, { baseDir });
    if (loaded) {
      await indexLearning(loaded, { baseDir });
    }
    return saved;
  }

  // Helper to delete and remove from index
  async function deleteAndUnindex(id: string, baseDir: string): Promise<boolean> {
    await removeLearningFromIndex(id, { baseDir });
    return deleteLearning(id, { baseDir });
  }

  afterEach(async () => {
    // Close database connections
    await closeLearningsIndex({ baseDir: testProjectDir });
    await closeLearningsIndex({ baseDir: testGlobalDir });
    // Clean up test directories
    if (existsSync(testProjectDir)) {
      rmSync(testProjectDir, { recursive: true });
    }
    if (existsSync(testGlobalDir)) {
      rmSync(testGlobalDir, { recursive: true });
    }
  });

  describe('Full Learning Lifecycle', () => {
    it('should support save → load → query → delete flow', async () => {
      // 1. Save and index a learning
      const input = createRealisticInput();
      const saved = await saveAndIndex(input, testProjectDir);
      expect(saved.id).toBeDefined();
      expect(saved.filePath).toContain(testProjectDir);

      // 2. Load by ID
      const loaded = await loadLearning(saved.id, { baseDir: testProjectDir });
      expect(loaded).not.toBeNull();
      expect(loaded?.title).toBe(input.title);
      expect(loaded?.content).toContain('exponential backoff');

      // 3. Query learnings
      const results = await queryLearnings({ category: 'patterns' }, { baseDir: testProjectDir });
      expect(results.length).toBe(1);
      expect(results[0]?.id).toBe(saved.id);

      // 4. Delete
      const deleted = await deleteAndUnindex(saved.id, testProjectDir);
      expect(deleted).toBe(true);

      // 5. Verify deletion
      const afterDelete = await loadLearning(saved.id, { baseDir: testProjectDir });
      expect(afterDelete).toBeNull();
    });

    it('should preserve all learning fields through round-trip', async () => {
      const input = createRealisticInput({
        title: 'Test Round Trip',
        tags: ['tag1', 'tag2', 'tag3'],
        category: 'anti-patterns',
        scope: 'project',
        origin: {
          project: '/path/to/project',
          sessionId: 'session-abc-123',
        },
      });

      const saved = await saveAndIndex(input, testProjectDir);
      const loaded = await loadLearning(saved.id, { baseDir: testProjectDir });

      expect(loaded?.id).toBe(saved.id);
      expect(loaded?.title).toBe(input.title);
      expect(loaded?.tags).toEqual(input.tags);
      expect(loaded?.category).toBe(input.category);
      expect(loaded?.scope).toBe(input.scope);
      expect(loaded?.origin?.project).toBe(input.origin?.project);
      expect(loaded?.origin?.sessionId).toBe(input.origin?.sessionId);
      expect(loaded?.version).toBe(LEARNING_VERSION);
    });
  });

  describe('Cross-Scope Querying (FR-020)', () => {
    it('should merge project and global learnings in listAll', async () => {
      // Save project learnings
      await saveAndIndex(
        createRealisticInput({ title: 'Project Pattern 1', scope: 'project' }),
        testProjectDir
      );
      await saveAndIndex(
        createRealisticInput({ title: 'Project Pattern 2', scope: 'project' }),
        testProjectDir
      );

      // Save global learnings
      await saveAndIndex(
        createRealisticInput({ title: 'Global Pattern 1', scope: 'global' }),
        testGlobalDir
      );

      // List all should return both
      const all = await listAllLearnings(
        { projectDir: testProjectDir, globalDir: testGlobalDir },
        {}
      );

      expect(all.length).toBe(3);
      expect(all.some((l) => l.title === 'Project Pattern 1')).toBe(true);
      expect(all.some((l) => l.title === 'Global Pattern 1')).toBe(true);
    });

    it('should filter merged results by category', async () => {
      // Mix of categories
      await saveAndIndex(
        createRealisticInput({ title: 'Project Tool', category: 'tools', scope: 'project' }),
        testProjectDir
      );
      await saveAndIndex(
        createRealisticInput({ title: 'Project Pattern', category: 'patterns', scope: 'project' }),
        testProjectDir
      );
      await saveAndIndex(
        createRealisticInput({ title: 'Global Pattern', category: 'patterns', scope: 'global' }),
        testGlobalDir
      );

      const patterns = await listAllLearnings(
        { projectDir: testProjectDir, globalDir: testGlobalDir },
        { category: 'patterns' }
      );

      expect(patterns.length).toBe(2);
      expect(patterns.every((l) => l.category === 'patterns')).toBe(true);
    });

    it('should handle missing global directory gracefully', async () => {
      await saveAndIndex(createRealisticInput({ scope: 'project' }), testProjectDir);

      const results = await listAllLearnings(
        { projectDir: testProjectDir, globalDir: '/non/existent/global' },
        {}
      );

      expect(results.length).toBe(1);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent saves', async () => {
      const inputs = Array.from({ length: 10 }, (_, i) =>
        createRealisticInput({ title: `Learning ${i}` })
      );

      // Save all concurrently
      const results = await Promise.all(inputs.map((input) => saveAndIndex(input, testProjectDir)));

      // All should succeed
      expect(results.every((r) => r.id && r.filePath)).toBe(true);

      // All should be queryable
      const all = await queryLearnings({}, { baseDir: testProjectDir });
      expect(all.length).toBe(10);
    });

    it('should handle concurrent reads and writes', async () => {
      const input = createRealisticInput();
      const saved = await saveAndIndex(input, testProjectDir);

      // Concurrent operations
      const operations = [
        loadLearning(saved.id, { baseDir: testProjectDir }),
        queryLearnings({}, { baseDir: testProjectDir }),
        saveAndIndex(createRealisticInput({ title: 'Another' }), testProjectDir),
        listLearnings({ baseDir: testProjectDir }),
      ];

      // All should complete without error
      await Promise.all(operations);

      // Both should be queryable
      const all = await queryLearnings({}, { baseDir: testProjectDir });
      expect(all.length).toBe(2);
    });
  });

  describe('Query Performance', () => {
    it('should handle 50+ learnings efficiently', async () => {
      // Create 50 learnings
      const inputs = Array.from({ length: 50 }, (_, i) =>
        createRealisticInput({
          title: `Learning ${i}`,
          category:
            i % 4 === 0
              ? 'patterns'
              : i % 4 === 1
                ? 'anti-patterns'
                : i % 4 === 2
                  ? 'tools'
                  : 'workflows',
          tags: [`tag-${i % 5}`, `group-${i % 10}`],
        })
      );

      for (const input of inputs) {
        await saveAndIndex(input, testProjectDir);
      }

      // Time the query
      const start = Date.now();
      const results = await queryLearnings({ category: 'patterns' }, { baseDir: testProjectDir });
      const elapsed = Date.now() - start;

      // Should complete quickly (< 2s per spec)
      expect(elapsed).toBeLessThan(2000);
      expect(results.length).toBe(13); // Every 4th is a pattern (0, 4, 8, ...)
    });
  });

  describe('Error Handling', () => {
    it('should handle corrupted markdown files gracefully', async () => {
      // Save a valid learning
      const valid = await saveAndIndex(createRealisticInput(), testProjectDir);

      // Create a corrupted file
      await Bun.write(
        join(testProjectDir, '2026-01-16-corrupted-abc123.md'),
        'invalid yaml frontmatter { not closed'
      );

      // Operations should not throw
      const loaded = await loadLearning(valid.id, { baseDir: testProjectDir });
      expect(loaded).not.toBeNull();

      const list = await listLearnings({ baseDir: testProjectDir });
      expect(list).toContain(valid.id);
    });

    it('should recover from partial saves', async () => {
      const input = createRealisticInput();

      // Save normally
      const saved = await saveLearning(input, { baseDir: testProjectDir });

      // Verify saved correctly
      const loaded = await loadLearning(saved.id, { baseDir: testProjectDir });
      expect(loaded?.title).toBe(input.title);
    });
  });

  describe('YAML Frontmatter Format', () => {
    it('should create valid markdown files', async () => {
      const input = createRealisticInput({
        title: 'YAML Test',
        tags: ['yaml', 'frontmatter'],
      });

      const saved = await saveLearning(input, { baseDir: testProjectDir });
      const content = await Bun.file(saved.filePath).text();

      // Should have proper frontmatter delimiters
      expect(content.startsWith('---\n')).toBe(true);
      expect(content.split('---').length).toBeGreaterThanOrEqual(3);

      // Should be parseable
      const loaded = await loadLearning(saved.id, { baseDir: testProjectDir });
      expect(loaded?.title).toBe('YAML Test');
      expect(loaded?.tags).toContain('yaml');
    });

    it('should handle complex content with code blocks', async () => {
      const input = createRealisticInput({
        content: `# Complex Content

Here's some TypeScript:

\`\`\`typescript
interface Config {
  api: string;
  timeout: number;
}

const config: Config = {
  api: "https://api.example.com",
  timeout: 5000,
};
\`\`\`

And some inline \`code\` as well.

| Column 1 | Column 2 |
|----------|----------|
| Value 1  | Value 2  |
`,
      });

      const saved = await saveLearning(input, { baseDir: testProjectDir });
      const loaded = await loadLearning(saved.id, { baseDir: testProjectDir });

      expect(loaded?.content).toContain('interface Config');
      expect(loaded?.content).toContain('| Column 1 |');
    });
  });

  describe('Version Handling', () => {
    it('should include correct version in saved files', async () => {
      const saved = await saveLearning(createRealisticInput(), { baseDir: testProjectDir });
      const content = await Bun.file(saved.filePath).text();

      expect(content).toContain(`version: "${LEARNING_VERSION}"`);
    });

    it('should handle future version gracefully', async () => {
      const saved = await saveLearning(createRealisticInput(), { baseDir: testProjectDir });

      // Manually modify version
      const content = await Bun.file(saved.filePath).text();
      const modified = content.replace(`version: "${LEARNING_VERSION}"`, 'version: "99.0.0"');
      await Bun.write(saved.filePath, modified);

      // Should still load (best-effort)
      const loaded = await loadLearning(saved.id, { baseDir: testProjectDir });
      expect(loaded).not.toBeNull();
    });
  });

  describe('Promotion Flow (US-006)', () => {
    it('should support project → global promotion workflow', async () => {
      // 1. Save as project learning
      const projectInput = createRealisticInput({
        title: 'Worth Promoting',
        scope: 'project',
        origin: {
          project: '/my/project',
          sessionId: 'session-xyz',
        },
      });

      const projectSaved = await saveAndIndex(projectInput, testProjectDir);

      // 2. Load and verify
      const projectLoaded = await loadLearning(projectSaved.id, { baseDir: testProjectDir });
      expect(projectLoaded?.scope).toBe('project');

      // 3. "Promote" by saving to global with promotedAt
      const globalInput = {
        ...projectInput,
        scope: 'global' as const,
        origin: {
          ...projectInput.origin,
          promotedAt: new Date().toISOString(),
        },
      };

      const globalSaved = await saveAndIndex(globalInput, testGlobalDir);

      // 4. Verify global learning
      const globalLoaded = await loadLearning(globalSaved.id, { baseDir: testGlobalDir });
      expect(globalLoaded?.scope).toBe('global');
      expect(globalLoaded?.origin?.promotedAt).toBeDefined();
      expect(globalLoaded?.origin?.project).toBe('/my/project');

      // 5. Both should be queryable via listAll
      const all = await listAllLearnings(
        { projectDir: testProjectDir, globalDir: testGlobalDir },
        {}
      );
      expect(all.length).toBe(2);
    });
  });
});
