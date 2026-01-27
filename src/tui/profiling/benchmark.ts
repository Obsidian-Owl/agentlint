/**
 * TUI Performance Profiling - Benchmark Script
 *
 * Profiles TUI rendering performance with varying chunk counts.
 * Run with: bun run src/tui/profiling/benchmark.ts
 *
 * Targets (from AGE-959):
 * - < 50ms render time at 1000 chunks
 * - < 200MB memory at 1000 chunks
 * - Responsive scrolling (no jank)
 *
 * @module tui/profiling
 */

import { render } from 'ink-testing-library';
import React from 'react';
import { AgentOutput } from '../components/AgentOutput';
import type { StreamChunk } from '../../orchestration/types';

// =============================================================================
// Test Data Generation
// =============================================================================

function generateChunk(
  index: number,
  type: 'text' | 'tool_start' | 'tool_result' = 'text'
): StreamChunk {
  const content =
    type === 'text'
      ? `This is chunk ${index} with some sample content that might include **markdown** and \`code\`.`
      : type === 'tool_start'
        ? `Starting tool execution for operation ${index}`
        : `Tool result for operation ${index}: { "status": "success", "data": ${index} }`;

  const chunk: StreamChunk = {
    type,
    level: 'normal',
    content,
    timestamp: new Date().toISOString(),
  };
  if (type !== 'text') {
    chunk.metadata = { toolId: `tool-${index}`, toolName: 'test_tool' };
  }
  return chunk;
}

function generateChunks(count: number): StreamChunk[] {
  const chunks: StreamChunk[] = [];
  for (let i = 0; i < count; i++) {
    // Mix of chunk types: 70% text, 15% tool_start, 15% tool_result
    const rand = Math.random();
    const type = rand < 0.7 ? 'text' : rand < 0.85 ? 'tool_start' : 'tool_result';
    chunks.push(generateChunk(i, type));
  }
  return chunks;
}

// =============================================================================
// Profiling Functions
// =============================================================================

interface ProfileResult {
  chunkCount: number;
  initialRenderMs: number;
  rerenderMs: number;
  memoryMB: number;
  heapUsedMB: number;
}

function formatMemory(bytes: number): number {
  return Math.round((bytes / 1024 / 1024) * 100) / 100;
}

function profileRender(chunkCount: number): ProfileResult {
  // Force GC if available (run with --expose-gc)
  if (global.gc) {
    global.gc();
  }

  const chunks = generateChunks(chunkCount);

  // Measure initial render
  const startInitial = performance.now();
  const { rerender, unmount } = render(
    React.createElement(AgentOutput, { chunks, isStreaming: false })
  );
  const initialRenderMs = performance.now() - startInitial;

  // Measure re-render with one more chunk
  const newChunks = [...chunks, generateChunk(chunkCount)];
  const startRerender = performance.now();
  rerender(React.createElement(AgentOutput, { chunks: newChunks, isStreaming: true }));
  const rerenderMs = performance.now() - startRerender;

  // Measure memory
  const memUsage = process.memoryUsage();

  // Cleanup
  unmount();

  return {
    chunkCount,
    initialRenderMs: Math.round(initialRenderMs * 100) / 100,
    rerenderMs: Math.round(rerenderMs * 100) / 100,
    memoryMB: formatMemory(memUsage.rss),
    heapUsedMB: formatMemory(memUsage.heapUsed),
  };
}

// =============================================================================
// Main Benchmark
// =============================================================================

function runBenchmark(): void {
  console.log('TUI Performance Benchmark');
  console.log('='.repeat(60));
  console.log();

  const chunkCounts = [10, 50, 100, 250, 500, 750, 1000, 1500, 2000];
  const results: ProfileResult[] = [];

  for (const count of chunkCounts) {
    // Warm up
    profileRender(Math.min(count, 10));

    // Actual measurement (average of 3 runs)
    const runs: ProfileResult[] = [];
    for (let i = 0; i < 3; i++) {
      runs.push(profileRender(count));
    }

    const avgResult: ProfileResult = {
      chunkCount: count,
      initialRenderMs:
        Math.round((runs.reduce((a, r) => a + r.initialRenderMs, 0) / 3) * 100) / 100,
      rerenderMs: Math.round((runs.reduce((a, r) => a + r.rerenderMs, 0) / 3) * 100) / 100,
      memoryMB: Math.round((runs.reduce((a, r) => a + r.memoryMB, 0) / 3) * 100) / 100,
      heapUsedMB: Math.round((runs.reduce((a, r) => a + r.heapUsedMB, 0) / 3) * 100) / 100,
    };

    results.push(avgResult);
    console.log(
      `${count.toString().padStart(5)} chunks: ` +
        `initial=${avgResult.initialRenderMs.toString().padStart(7)}ms, ` +
        `rerender=${avgResult.rerenderMs.toString().padStart(7)}ms, ` +
        `heap=${avgResult.heapUsedMB.toString().padStart(6)}MB`
    );
  }

  console.log();
  console.log('='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));

  // Check against targets
  const result1000 = results.find((r) => r.chunkCount === 1000);
  if (result1000) {
    const renderPass = result1000.initialRenderMs < 50;
    const memoryPass = result1000.heapUsedMB < 200;

    console.log();
    console.log('Target: < 50ms render at 1000 chunks');
    console.log(`  Actual: ${result1000.initialRenderMs}ms - ${renderPass ? 'PASS' : 'FAIL'}`);
    console.log();
    console.log('Target: < 200MB memory at 1000 chunks');
    console.log(`  Actual: ${result1000.heapUsedMB}MB - ${memoryPass ? 'PASS' : 'FAIL'}`);
  }

  // Performance regression thresholds
  console.log();
  console.log('Performance Regression Thresholds (for CI):');
  console.log('  - Initial render at 1000 chunks: < 100ms (2x target)');
  console.log('  - Re-render at 1000 chunks: < 50ms');
  console.log('  - Memory at 1000 chunks: < 300MB');

  // Output JSON for CI integration
  const jsonOutput = {
    timestamp: new Date().toISOString(),
    results,
    targets: {
      render1000Ms: 50,
      memory1000MB: 200,
    },
    pass: result1000 ? result1000.initialRenderMs < 50 && result1000.heapUsedMB < 200 : false,
  };

  console.log();
  console.log('JSON Output:');
  console.log(JSON.stringify(jsonOutput, null, 2));
}

// Run if executed directly
runBenchmark();
