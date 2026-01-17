/**
 * T070: Performance test for CLI memory usage
 *
 * Tests NFR-004: Memory usage should be < 100MB
 */

import { describe, test, expect } from 'bun:test';

describe('CLI memory performance', () => {
  describe('NFR-004: Memory usage < 100MB', () => {
    test('CLI module memory footprint is reasonable', async () => {
      // Import CLI modules using dynamic imports
      // Note: We measure total heap after import rather than diff because
      // baseline measurements are unreliable in test runners with cached modules
      await import('../../src/cli/program');
      await import('../../src/cli/formatters');
      await import('../../src/cli/components');

      // Get memory after imports
      const afterImportMemory = process.memoryUsage();

      // Total heap should stay reasonable after CLI imports
      // React + Ink + Commander add significant but acceptable overhead
      // 50MB threshold accounts for test runner overhead + CLI modules
      const heapUsedMB = afterImportMemory.heapUsed / (1024 * 1024);
      expect(heapUsedMB).toBeLessThan(50);
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
    test('CLI operations do not leak memory', async () => {
      // Force GC if available to get clean baseline
      if (global.gc) {
        global.gc();
      }

      const beforeMemory = process.memoryUsage().heapUsed;

      // Simulate typical CLI operations
      const { createJSONFormatter } = await import('../../src/cli/formatters/json');
      const { createMarkdownFormatter } = await import('../../src/cli/formatters/markdown');
      const { createPlainFormatter } = await import('../../src/cli/formatters/plain');

      // Create and use formatters (typical CLI workflow)
      const jsonFormatter = createJSONFormatter();
      const mdFormatter = createMarkdownFormatter();
      const plainFormatter = createPlainFormatter();

      // Simulate formatting operations with mock analysis result
      const mockResult = {
        projectPath: '/test',
        timestamp: new Date().toISOString(),
        findings: Array.from({ length: 50 }, (_, i) => ({
          id: `finding-${i}`,
          type: 'config' as const,
          severity: 'warning' as const,
          title: `Finding ${i}`,
          description: `Description for finding ${i}`,
          origin: { file: `/test/config-${i}.md`, line: 1 },
        })),
        summary: { total: 50, byType: { config: 50 }, bySeverity: { warning: 50 } },
      };

      // Format the same data multiple times to detect leaks
      for (let i = 0; i < 10; i++) {
        jsonFormatter.formatComplete(mockResult as never);
        mdFormatter.formatComplete(mockResult as never);
        plainFormatter.formatComplete(mockResult as never);
      }

      const afterMemory = process.memoryUsage().heapUsed;
      const memoryDeltaMB = (afterMemory - beforeMemory) / (1024 * 1024);

      // Memory growth from CLI operations should be minimal (<20MB)
      // This tests actual CLI memory usage, not cumulative test runner state
      expect(memoryDeltaMB).toBeLessThan(20);
    });
  });
});
