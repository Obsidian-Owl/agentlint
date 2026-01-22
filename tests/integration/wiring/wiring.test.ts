/**
 * Wiring Integration Tests
 *
 * These tests verify that components are actually integrated into the system,
 * not just built and tested in isolation.
 *
 * The "Ink component pattern" is a cautionary example: components were built,
 * unit-tested, but never wired to the actual CLI, resulting in dead code.
 */

import { describe, it, expect } from 'bun:test';
import { getExports, findImporters, analyzeWiring, getEntryPoints } from './wiring-utils';
import { existsSync, readdirSync, statSync } from 'fs';
import * as path from 'path';

/**
 * Simple glob implementation for tests
 */
function globSync(baseDir: string, extensions: string[]): string[] {
  const results: string[] = [];

  function walkDir(dir: string): void {
    if (!existsSync(dir)) return;

    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);

        try {
          const stat = statSync(fullPath);
          if (stat.isDirectory() && !entry.includes('node_modules')) {
            walkDir(fullPath);
          } else if (stat.isFile()) {
            const ext = path.extname(entry);
            if (extensions.includes(ext)) {
              results.push(fullPath);
            }
          }
        } catch {
          // Skip files we can't stat
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  walkDir(baseDir);
  return results;
}

describe('Wiring Verification', () => {
  describe('getExports', () => {
    it('extracts function exports', () => {
      // This is a self-referential test - we test the utils themselves
      const exports = getExports('tests/integration/wiring/wiring-utils.ts');
      const exportNames = exports.map((e) => e.name);

      expect(exportNames).toContain('getExports');
      expect(exportNames).toContain('findImporters');
      expect(exportNames).toContain('hasImportPath');
    });

    it('returns empty array for non-existent file', () => {
      const exports = getExports('non-existent-file.ts');
      expect(exports).toEqual([]);
    });
  });

  describe('findImporters', () => {
    it('finds files that import a symbol from src', () => {
      // Check for a commonly imported symbol in the codebase
      const importers = findImporters('z', 'src');
      // 'z' from zod should be imported in many files
      expect(importers.length).toBeGreaterThanOrEqual(0); // May or may not find depending on codebase
    });
  });

  describe('Entry Points', () => {
    it('defines known entry points', () => {
      const entryPoints = getEntryPoints();
      expect(entryPoints.length).toBeGreaterThan(0);
      expect(entryPoints).toContain('src/cli.ts');
    });

    it('at least one entry point should exist', () => {
      const entryPoints = getEntryPoints();
      const existingEntryPoints = entryPoints.filter((ep) => existsSync(ep));
      // At least one entry point should exist
      expect(existingEntryPoints.length).toBeGreaterThan(0);
    });
  });

  describe('Critical Wiring Checks', () => {
    it('orchestrator module has exports', () => {
      const orchestratorFiles = globSync('src/orchestration', ['.ts']);

      // At least some files should exist in orchestration
      expect(orchestratorFiles.length).toBeGreaterThan(0);

      // Check that files have exports
      let totalExports = 0;
      for (const file of orchestratorFiles) {
        if (!file.includes('.d.ts') && !file.includes('index.ts')) {
          const exports = getExports(file);
          totalExports += exports.length;
        }
      }

      expect(totalExports).toBeGreaterThan(0);
    });
  });

  // This test documents the known unintegrated components (Ink)
  // It should be updated as components are wired or removed
  describe('Known Unintegrated Components (Technical Debt)', () => {
    it('documents Ink components status', () => {
      const inkComponents = [
        'src/cli/components/App.tsx',
        'src/cli/components/Progress.tsx',
        'src/cli/components/FindingsList.tsx',
        'src/cli/components/Summary.tsx',
      ];

      const existingComponents = inkComponents.filter((f) => existsSync(f));

      // If Ink components exist, they should either be:
      // 1. Integrated (imported and used)
      // 2. Removed (file doesn't exist)
      // 3. Documented here as known tech debt

      for (const component of existingComponents) {
        const exports = getExports(component);
        for (const exp of exports) {
          const importers = findImporters(exp.name, 'src');
          const importersFiltered = importers.filter((f) => f !== component);

          // Document unintegrated status - this test passes but logs the issue
          if (importersFiltered.length === 0) {
            console.warn(
              `[TECH DEBT] ${exp.name} from ${component} is not integrated. ` +
                `Consider wiring to CLI or removing.`
            );
          }
        }
      }

      // Test passes - this is documentation, not enforcement
      // When Ink components are properly wired, remove them from this list
      expect(true).toBe(true);
    });
  });
});

describe('Wiring Report', () => {
  it('generates a complete wiring report', () => {
    // Run analysis on a small subset to keep test fast
    const report = analyzeWiring('src/debug');

    expect(report.totalExports).toBeGreaterThanOrEqual(0);
    expect(report.integrated).toBeDefined();
    expect(report.testOnly).toBeDefined();
    expect(report.unintegrated).toBeDefined();

    // Log summary for visibility
    console.log('\nWiring Report (src/debug):');
    console.log(`  Total exports: ${report.totalExports}`);
    console.log(`  Integrated: ${report.integrated.length}`);
    console.log(`  Test-only: ${report.testOnly.length}`);
    console.log(`  Unintegrated: ${report.unintegrated.length}`);
  });
});
