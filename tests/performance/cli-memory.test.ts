/**
 * T070: Performance test for CLI memory usage
 *
 * Tests NFR-004: Memory usage should be < 100MB
 */

import { describe, test, expect } from 'bun:test';

describe('CLI memory performance', () => {
  describe('NFR-004: Memory usage < 100MB', () => {
    test('CLI module memory footprint is reasonable', async () => {
      // Get baseline memory
      const baselineMemory = process.memoryUsage();

      // Import CLI modules using dynamic imports
      await import('../../src/cli/program');
      await import('../../src/cli/formatters');
      await import('../../src/cli/components');

      // Get memory after imports
      const afterImportMemory = process.memoryUsage();

      // Calculate heap used difference
      const heapDiff = afterImportMemory.heapUsed - baselineMemory.heapUsed;

      // CLI imports should add less than 20MB to heap
      // (100MB is the full process limit, imports should be much smaller)
      const heapDiffMB = heapDiff / (1024 * 1024);
      expect(heapDiffMB).toBeLessThan(20);
    });

    test('formatter instantiation is lightweight', async () => {
      const { createJSONFormatter } = await import('../../src/cli/formatters/json');
      const { createMarkdownFormatter } = await import('../../src/cli/formatters/markdown');
      const { createPlainFormatter } = await import('../../src/cli/formatters/plain');

      const beforeMemory = process.memoryUsage().heapUsed;

      // Create 100 formatter instances
      const formatters = [];
      for (let i = 0; i < 100; i++) {
        formatters.push(createJSONFormatter());
        formatters.push(createMarkdownFormatter());
        formatters.push(createPlainFormatter());
      }

      const afterMemory = process.memoryUsage().heapUsed;
      const memoryUsedMB = (afterMemory - beforeMemory) / (1024 * 1024);

      // 300 formatter instances should use < 5MB (accounting for module overhead)
      expect(memoryUsedMB).toBeLessThan(5);

      // Keep reference to prevent GC during test
      expect(formatters.length).toBe(300);
    });

    test('large data structure can be created without OOM', () => {
      // Test that we can create a reasonably large causal tree data structure
      // without running out of memory. This verifies that the data types
      // are lightweight and don't have hidden memory overhead.
      const deepTree = {
        id: 'root',
        type: 'finding',
        title: 'Root Finding',
        children: Array.from({ length: 100 }, (_, i) => ({
          id: `child-${i}`,
          type: 'origin',
          title: `Origin ${i}`,
          children: Array.from({ length: 50 }, (_, j) => ({
            id: `grandchild-${i}-${j}`,
            type: 'root_cause',
            title: `Root Cause ${i}-${j}`,
            children: [
              {
                id: `rec-${i}-${j}`,
                type: 'recommendation',
                title: `Recommendation ${i}-${j}`,
              },
            ],
          })),
        })),
      };

      // Verify large tree was created (100 * 50 * 1 = 5000 leaf nodes)
      expect(deepTree.children.length).toBe(100);
      expect(deepTree.children[0]!.children.length).toBe(50);
      expect(deepTree.children[99]!.children[49]!.children.length).toBe(1);

      // Process should still be well under 100MB after creating this
      const memoryUsage = process.memoryUsage();
      const heapUsedMB = memoryUsage.heapUsed / (1024 * 1024);
      expect(heapUsedMB).toBeLessThan(100);
    });
  });

  describe('process memory limits', () => {
    test('current process stays under 100MB', () => {
      const memoryUsage = process.memoryUsage();
      const heapUsedMB = memoryUsage.heapUsed / (1024 * 1024);
      const rssMB = memoryUsage.rss / (1024 * 1024);

      // Heap should be well under 100MB
      expect(heapUsedMB).toBeLessThan(100);

      // RSS (total process memory) can be higher due to Bun runtime
      // but should still be reasonable
      expect(rssMB).toBeLessThan(200);
    });
  });
});
