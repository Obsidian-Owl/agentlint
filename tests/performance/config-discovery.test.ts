/**
 * T073: Performance tests for config discovery
 *
 * Tests that config discovery completes within acceptable time limits.
 * Target: <5 seconds for typical project structures (NFR-001)
 *
 * @module tests/performance/config-discovery.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { discoverConfigs } from '../../src/tools/config/discovery';

describe('Config Discovery Performance', () => {
  let tempDir: string;

  // Create a realistic project structure for performance testing
  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentlint-perf-'));

    // Create a structure similar to a real project with multiple nested directories
    const structure = [
      // Root configs
      'CLAUDE.md',
      '.claude/settings.json',

      // Source directories
      'src/components/CLAUDE.md',
      'src/services/CLAUDE.md',
      'src/utils/helpers.ts',
      'src/types/index.ts',

      // Multiple packages (monorepo style)
      'packages/core/CLAUDE.md',
      'packages/core/src/index.ts',
      'packages/cli/CLAUDE.md',
      'packages/cli/src/index.ts',
      'packages/web/CLAUDE.md',
      'packages/web/src/index.ts',

      // Skills
      'skills/deploy/SKILL.md',
      'skills/deploy/scripts/deploy.sh',
      'skills/test/SKILL.md',
      'skills/test/scripts/test.sh',

      // Test directories
      'tests/unit/index.test.ts',
      'tests/integration/index.test.ts',

      // Docs
      'docs/README.md',
      'docs/architecture/CLAUDE.md',
    ];

    // Create files
    for (const relativePath of structure) {
      const fullPath = path.join(tempDir, relativePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });

      if (relativePath.endsWith('.md')) {
        fs.writeFileSync(
          fullPath,
          `# ${path.basename(relativePath)}\n\nContent for ${relativePath}`
        );
      } else if (relativePath.endsWith('.json')) {
        fs.writeFileSync(fullPath, '{}');
      } else {
        fs.writeFileSync(fullPath, `// ${relativePath}`);
      }
    }

    // Create node_modules (should be excluded)
    fs.mkdirSync(path.join(tempDir, 'node_modules/@test/package'), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, 'node_modules/@test/package/CLAUDE.md'),
      '# Should be excluded'
    );
  });

  afterAll(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should complete discovery in <1 second for typical project', async () => {
    const start = performance.now();

    const result = await discoverConfigs({
      cwd: tempDir,
      includeGlobal: false,
    });

    const elapsed = performance.now() - start;

    // Should find multiple config files
    expect(result.files.length).toBeGreaterThan(0);

    // Should complete quickly (target: <1s, allowing buffer)
    expect(elapsed).toBeLessThan(1000);

    console.log(`Discovery completed in ${elapsed.toFixed(2)}ms`);
    console.log(`Files found: ${result.files.length}`);
    console.log(`Skills found: ${result.skills.length}`);
  });

  it('should handle large directory structures within 5 seconds', async () => {
    // Create additional nested directories
    const deepStructure = tempDir;

    // Create 100 directories with some containing CLAUDE.md
    for (let i = 0; i < 50; i++) {
      const dir = path.join(deepStructure, `module-${i}`, 'src');
      fs.mkdirSync(dir, { recursive: true });
      if (i % 5 === 0) {
        fs.writeFileSync(
          path.join(dir, 'CLAUDE.md'),
          `# Module ${i}\n\nModule-specific instructions.`
        );
      }
    }

    const start = performance.now();

    const result = await discoverConfigs({
      cwd: deepStructure,
      includeGlobal: false,
      maxDepth: 10,
    });

    const elapsed = performance.now() - start;

    // Should complete within 5 seconds (NFR-001)
    expect(elapsed).toBeLessThan(5000);

    console.log(`Large structure discovery: ${elapsed.toFixed(2)}ms`);
    console.log(`Files found: ${result.files.length}`);
  });

  it('should exclude node_modules efficiently', async () => {
    const start = performance.now();

    const result = await discoverConfigs({
      cwd: tempDir,
      includeGlobal: false,
    });

    const elapsed = performance.now() - start;

    // Should not find any files from node_modules
    const nodeModulesFiles = result.files.filter((f) => f.path.includes('node_modules'));
    expect(nodeModulesFiles.length).toBe(0);

    // Should still be fast
    expect(elapsed).toBeLessThan(1000);
  });

  it('should maintain consistent performance with parseSkills option', async () => {
    // Test without parseSkills
    const startWithout = performance.now();
    await discoverConfigs({
      cwd: tempDir,
      includeGlobal: false,
      parseSkills: false,
    });
    const elapsedWithout = performance.now() - startWithout;

    // Test with parseSkills
    const startWith = performance.now();
    const resultWith = await discoverConfigs({
      cwd: tempDir,
      includeGlobal: false,
      parseSkills: true,
    });
    const elapsedWith = performance.now() - startWith;

    // Both should complete reasonably fast
    expect(elapsedWithout).toBeLessThan(1000);
    expect(elapsedWith).toBeLessThan(2000); // Allow more time for parsing

    console.log(`Without parseSkills: ${elapsedWithout.toFixed(2)}ms`);
    console.log(`With parseSkills: ${elapsedWith.toFixed(2)}ms`);
    console.log(
      `Overhead: ${(elapsedWith - elapsedWithout).toFixed(2)}ms for ${resultWith.parsedSkills?.length || 0} skills`
    );
  });

  it('should scale linearly with depth', async () => {
    const depths = [5, 10, 15];
    const times: number[] = [];

    for (const depth of depths) {
      const start = performance.now();

      await discoverConfigs({
        cwd: tempDir,
        includeGlobal: false,
        maxDepth: depth,
      });

      times.push(performance.now() - start);
    }

    // Time should not grow exponentially (allow 3x growth for 3x depth)
    const maxAllowedRatio = 3;
    const actualRatio = times[2]! / times[0]!;

    expect(actualRatio).toBeLessThan(maxAllowedRatio);

    console.log(
      `Depth scaling: ${depths.map((d, i) => `${d}=${times[i]!.toFixed(2)}ms`).join(', ')}`
    );
  });
});
