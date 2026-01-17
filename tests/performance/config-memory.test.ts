/**
 * T074: Performance tests for parsing memory usage
 *
 * Tests that config parsing stays within acceptable memory limits.
 * Target: <50MB for typical configs (NFR-004)
 *
 * @module tests/performance/config-memory.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { parseConfig } from '../../src/tools/config/parse-config';
import { discoverConfigs } from '../../src/tools/config/discovery';
import { analyzeHierarchy } from '../../src/tools/config/hierarchy';

/**
 * Get current heap usage in MB.
 */
function getHeapUsedMB(): number {
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
  return process.memoryUsage().heapUsed / 1024 / 1024;
}

/**
 * Generate a large CLAUDE.md content for testing.
 */
function generateLargeConfig(lineCount: number): string {
  const lines: string[] = [];

  lines.push('# Large Configuration');
  lines.push('');
  lines.push('## Overview');
  lines.push('');
  lines.push('This is a large configuration file for performance testing.');
  lines.push('');

  // Add sections
  for (let i = 0; i < Math.floor(lineCount / 20); i++) {
    lines.push(`## Section ${i + 1}`);
    lines.push('');
    lines.push(`This is section ${i + 1} with some content.`);
    lines.push('');
    lines.push('Guidelines:');
    lines.push('');

    for (let j = 0; j < 5; j++) {
      lines.push(
        `- Rule ${j + 1}: ALWAYS follow this guideline when working on ${i % 2 === 0 ? 'frontend' : 'backend'} code.`
      );
    }

    lines.push('');

    // Add code blocks
    lines.push('```typescript');
    lines.push(`// Example for section ${i + 1}`);
    lines.push('function example() {');
    lines.push('  return true;');
    lines.push('}');
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}

describe('Config Parsing Memory', () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentlint-mem-'));
  });

  afterAll(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should parse typical config (<100 lines) with minimal memory', async () => {
    const config = `# Project Config

## Guidelines

- Use TypeScript
- Write tests
- Follow patterns

## Architecture

Standard layered architecture.

\`\`\`typescript
// Example
const x = 1;
\`\`\`
`;

    const configPath = path.join(tempDir, 'small.md');
    fs.writeFileSync(configPath, config);

    const beforeMB = getHeapUsedMB();
    const result = await parseConfig(configPath);
    const afterMB = getHeapUsedMB();

    const memoryUsed = afterMB - beforeMB;

    // Small config should use <5MB
    expect(memoryUsed).toBeLessThan(5);
    expect(result.metrics.lineCount).toBeLessThan(100);

    console.log(`Small config: ${result.metrics.lineCount} lines, ~${memoryUsed.toFixed(2)}MB memory`);
  });

  it('should parse medium config (300 lines) within 20MB', async () => {
    const config = generateLargeConfig(300);
    const configPath = path.join(tempDir, 'medium.md');
    fs.writeFileSync(configPath, config);

    const beforeMB = getHeapUsedMB();
    const result = await parseConfig(configPath);
    const afterMB = getHeapUsedMB();

    const memoryUsed = afterMB - beforeMB;

    // Medium config should use <20MB
    expect(memoryUsed).toBeLessThan(20);
    expect(result.metrics.lineCount).toBeGreaterThanOrEqual(200);

    console.log(`Medium config: ${result.metrics.lineCount} lines, ~${memoryUsed.toFixed(2)}MB memory`);
  });

  it('should parse large config (1000 lines) within 50MB (NFR-004)', async () => {
    const config = generateLargeConfig(1000);
    const configPath = path.join(tempDir, 'large.md');
    fs.writeFileSync(configPath, config);

    const beforeMB = getHeapUsedMB();
    const result = await parseConfig(configPath);
    const afterMB = getHeapUsedMB();

    const memoryUsed = afterMB - beforeMB;

    // Large config should stay within 50MB (NFR-004)
    expect(memoryUsed).toBeLessThan(50);
    expect(result.metrics.lineCount).toBeGreaterThanOrEqual(500);

    console.log(`Large config: ${result.metrics.lineCount} lines, ~${memoryUsed.toFixed(2)}MB memory`);
  });

  it('should release memory after parsing completes', async () => {
    const config = generateLargeConfig(500);
    const configPath = path.join(tempDir, 'release.md');
    fs.writeFileSync(configPath, config);

    const baselineMB = getHeapUsedMB();

    // Parse multiple times
    for (let i = 0; i < 5; i++) {
      await parseConfig(configPath);
    }

    // Force GC and check memory
    if (global.gc) {
      global.gc();
    }

    const afterMB = getHeapUsedMB();
    const memoryGrowth = afterMB - baselineMB;

    // Memory should not grow significantly after multiple parses
    // Allow some growth for caching, but not proportional to parse count
    expect(memoryGrowth).toBeLessThan(30);

    console.log(`Memory growth after 5 parses: ~${memoryGrowth.toFixed(2)}MB`);
  });

  it('should handle discovery of many configs efficiently', async () => {
    // Create multiple config files
    const numConfigs = 20;
    for (let i = 0; i < numConfigs; i++) {
      const dir = path.join(tempDir, `module-${i}`);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'CLAUDE.md'),
        `# Module ${i}\n\nModule instructions for ${i}.`
      );
    }

    const beforeMB = getHeapUsedMB();

    const result = await discoverConfigs({
      cwd: tempDir,
      includeGlobal: false,
      parseSkills: true,
    });

    const afterMB = getHeapUsedMB();
    const memoryUsed = afterMB - beforeMB;

    // Discovery of 20+ configs should use <30MB
    expect(memoryUsed).toBeLessThan(30);
    expect(result.files.length).toBeGreaterThanOrEqual(numConfigs);

    console.log(`Discovery of ${result.files.length} configs: ~${memoryUsed.toFixed(2)}MB`);
  });

  it('should handle hierarchy analysis efficiently', async () => {
    // Create hierarchical structure
    const dirs = [
      'project',
      'project/src',
      'project/src/components',
      'project/tests',
      'project/docs',
    ];

    const hierarchyDir = path.join(tempDir, 'hierarchy-test');
    for (const dir of dirs) {
      const fullDir = path.join(hierarchyDir, dir);
      fs.mkdirSync(fullDir, { recursive: true });
      fs.writeFileSync(
        path.join(fullDir, 'CLAUDE.md'),
        `# ${dir}\n\nInstructions for ${dir}.`
      );
    }

    const beforeMB = getHeapUsedMB();

    const result = await analyzeHierarchy({
      cwd: hierarchyDir,
      includeGlobal: false,
    });

    const afterMB = getHeapUsedMB();
    const memoryUsed = afterMB - beforeMB;

    // Hierarchy analysis should use <20MB
    expect(memoryUsed).toBeLessThan(20);
    expect(result.hierarchy.effectiveConfig.fileCount).toBeGreaterThanOrEqual(dirs.length);

    console.log(`Hierarchy analysis: ${result.hierarchy.effectiveConfig.fileCount} configs, ~${memoryUsed.toFixed(2)}MB`);
  });
});
