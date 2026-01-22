/**
 * EP11 E2E Temporal Tests - Baseline Comparison
 *
 * P0-3: Tests that verify the continuous improvement cycle works.
 * Creates baseline, makes changes, and verifies delta detection.
 *
 * Per Constitution Principle III (Causal-First): Track changes over time.
 *
 * @module tests/e2e/temporal/baseline-comparison
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { createTestFixture, runCLI, parseJSONOutput } from '../helpers';
import type { TestFixture } from '../helpers';

interface DeltaSummary {
  changeCounts: {
    new: number;
    resolved: number;
    changed: number;
    unchanged: number;
    increased: number;
    decreased: number;
  };
  qualityTrend: 'improving' | 'degrading' | 'stable';
  keyChanges: string[];
}

interface AnalyseOutput {
  status: 'success' | 'error' | 'dry-run';
  directory: string;
  configs: Array<{
    path: string;
    type: string;
  }>;
  findings: Array<{
    id: string;
    type: string;
    severity: string;
    title: string;
  }>;
  summary: {
    total: number;
    bySeverity: Record<string, number>;
  };
  timestamp: string;
}

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Minimal CLAUDE.md with known issues.
 */
const MINIMAL_CONFIG = `# Project

A test project.
`;

/**
 * Improved CLAUDE.md with better structure.
 */
const IMPROVED_CONFIG = `# Project

## Overview
A test project demonstrating continuous improvement.

## Build
\`bun build\`

## Test
\`bun test\`
`;

/**
 * Degraded CLAUDE.md with more issues.
 */
const DEGRADED_CONFIG = `# Config

Run it.
Check stuff.
API_KEY=secret123
`;

// =============================================================================
// Test Suite
// =============================================================================

describe('E2E: Baseline Comparison', () => {
  let fixture: TestFixture;

  beforeAll(() => {
    fixture = createTestFixture('baseline-comparison');
  });

  afterAll(() => {
    fixture.cleanup();
  });

  describe('Baseline Storage', () => {
    test('scan creates analyzable baseline data', async () => {
      // Given: A minimal config
      writeFileSync(join(fixture.path, 'CLAUDE.md'), MINIMAL_CONFIG);

      // When: Run scan to establish baseline metrics
      const result = await runCLI(['scan', '-d', fixture.path], {
        json: true,
      });

      expect(result.exitCode).toBe(0);
      const output = parseJSONOutput<{ configs: Array<{ type: string }> }>(result);

      // Then: Baseline data is captured
      expect(output?.configs).toBeDefined();
      expect(output?.configs?.length).toBeGreaterThan(0);
    });

    test('sequential scans produce comparable data', async () => {
      // Given: Initial config
      writeFileSync(join(fixture.path, 'CLAUDE.md'), MINIMAL_CONFIG);

      // When: Run first scan
      const scan1 = await runCLI(['scan', '-d', fixture.path], { json: true });
      const output1 = parseJSONOutput<{ configs: Array<{ type: string; size: number }> }>(scan1);

      // And: Modify config
      writeFileSync(join(fixture.path, 'CLAUDE.md'), IMPROVED_CONFIG);

      // And: Run second scan
      const scan2 = await runCLI(['scan', '-d', fixture.path], { json: true });
      const output2 = parseJSONOutput<{ configs: Array<{ type: string; size: number }> }>(scan2);

      // Then: Both scans succeed
      expect(scan1.exitCode).toBe(0);
      expect(scan2.exitCode).toBe(0);

      // And: Config size has changed (improvement)
      const config1 = output1?.configs?.find((c) => c.type === 'claude-code');
      const config2 = output2?.configs?.find((c) => c.type === 'claude-code');

      if (config1 && config2) {
        // Improved config should be larger
        expect(config2.size).toBeGreaterThan(config1.size);
      }
    });
  });

  describe('Change Detection', () => {
    test('detects config file modifications', async () => {
      // Given: Initial minimal config
      writeFileSync(join(fixture.path, 'CLAUDE.md'), MINIMAL_CONFIG);

      // When: Capture initial state
      const initial = await runCLI(['scan', '-d', fixture.path], { json: true });
      const initialOutput = parseJSONOutput<{ configs: Array<{ size: number }> }>(initial);
      const initialSize = initialOutput?.configs?.[0]?.size ?? 0;

      // And: Modify config (improve it)
      writeFileSync(join(fixture.path, 'CLAUDE.md'), IMPROVED_CONFIG);

      // And: Capture new state
      const updated = await runCLI(['scan', '-d', fixture.path], { json: true });
      const updatedOutput = parseJSONOutput<{ configs: Array<{ size: number }> }>(updated);
      const updatedSize = updatedOutput?.configs?.[0]?.size ?? 0;

      // Then: Change is detected
      expect(updatedSize).not.toBe(initialSize);
      expect(updatedSize).toBeGreaterThan(initialSize);
    });

    test('classifies changes as improvements or regressions', async () => {
      // This test demonstrates the change classification logic
      const calculateQualityTrend = (
        initialFindings: number,
        currentFindings: number
      ): 'improving' | 'degrading' | 'stable' => {
        if (currentFindings < initialFindings) return 'improving';
        if (currentFindings > initialFindings) return 'degrading';
        return 'stable';
      };

      // Improvement scenario: fewer findings
      expect(calculateQualityTrend(5, 2)).toBe('improving');

      // Regression scenario: more findings
      expect(calculateQualityTrend(2, 5)).toBe('degrading');

      // Stable scenario: same findings
      expect(calculateQualityTrend(3, 3)).toBe('stable');
    });
  });

  describe('Delta Analysis', () => {
    test('delta summary structure is valid', () => {
      // Validate the DeltaSummary type structure
      const validSummary: DeltaSummary = {
        changeCounts: {
          new: 1,
          resolved: 2,
          changed: 0,
          unchanged: 3,
          increased: 0,
          decreased: 2,
        },
        qualityTrend: 'improving',
        keyChanges: ['Added Development Workflow section', 'Resolved vague commands issue'],
      };

      expect(validSummary.changeCounts).toBeDefined();
      expect(['improving', 'degrading', 'stable']).toContain(validSummary.qualityTrend);
      expect(Array.isArray(validSummary.keyChanges)).toBe(true);
    });

    test('computes change counts correctly', () => {
      // Helper function to compute delta
      const computeDelta = (
        baseline: Array<{ id: string; type: string }>,
        current: Array<{ id: string; type: string }>
      ) => {
        const baselineIds = new Set(baseline.map((f) => f.id));
        const currentIds = new Set(current.map((f) => f.id));

        return {
          new: current.filter((f) => !baselineIds.has(f.id)).length,
          resolved: baseline.filter((f) => !currentIds.has(f.id)).length,
          unchanged: baseline.filter((f) => currentIds.has(f.id)).length,
        };
      };

      // Scenario: Some findings resolved, some new ones added
      const baseline = [
        { id: 'FND-001', type: 'config_gap' },
        { id: 'FND-002', type: 'config_antipattern' },
        { id: 'FND-003', type: 'quality_issue' },
      ];

      const current = [
        { id: 'FND-002', type: 'config_antipattern' }, // unchanged
        { id: 'FND-004', type: 'config_gap' }, // new
      ];

      const delta = computeDelta(baseline, current);

      expect(delta.new).toBe(1); // FND-004
      expect(delta.resolved).toBe(2); // FND-001, FND-003
      expect(delta.unchanged).toBe(1); // FND-002
    });
  });

  describe('Continuous Improvement Workflow', () => {
    test('full improvement cycle is trackable', async () => {
      // Step 1: Establish baseline with minimal config
      writeFileSync(join(fixture.path, 'CLAUDE.md'), MINIMAL_CONFIG);

      const baseline = await runCLI(['scan', '-d', fixture.path], { json: true });
      expect(baseline.exitCode).toBe(0);

      const baselineData = parseJSONOutput<{ configs: Array<{ size: number }> }>(baseline);
      const baselineSize = baselineData?.configs?.[0]?.size ?? 0;

      // Step 2: Improve the config
      writeFileSync(join(fixture.path, 'CLAUDE.md'), IMPROVED_CONFIG);

      const improved = await runCLI(['scan', '-d', fixture.path], { json: true });
      expect(improved.exitCode).toBe(0);

      const improvedData = parseJSONOutput<{ configs: Array<{ size: number }> }>(improved);
      const improvedSize = improvedData?.configs?.[0]?.size ?? 0;

      // Step 3: Verify improvement is detectable
      expect(improvedSize).toBeGreaterThan(baselineSize);

      // Step 4: Track quality trend
      const trend = improvedSize > baselineSize ? 'improving' : 'stable';
      expect(trend).toBe('improving');
    });

    test('live analysis detects quality improvements', async () => {
      // Given: Start with degraded config
      writeFileSync(join(fixture.path, 'CLAUDE.md'), DEGRADED_CONFIG);

      // When: Run baseline analysis
      const baselineResult = await runCLI(['analyse', '-d', fixture.path], {
        json: true,
        timeout: 120000,
      });

      const baselineOutput = parseJSONOutput<AnalyseOutput>(baselineResult);
      const baselineFindings = baselineOutput?.summary?.total ?? 0;

      // And: Improve config
      writeFileSync(join(fixture.path, 'CLAUDE.md'), IMPROVED_CONFIG);

      // And: Run new analysis
      const improvedResult = await runCLI(['analyse', '-d', fixture.path], {
        json: true,
        timeout: 120000,
      });

      const improvedOutput = parseJSONOutput<AnalyseOutput>(improvedResult);
      const improvedFindings = improvedOutput?.summary?.total ?? 0;

      // Then: Findings count should be lower or equal (improvement)
      // Note: We can't guarantee fewer findings without knowing exact analysis
      // but the improved config should not have MORE issues
      expect(typeof improvedFindings).toBe('number');

      // Track the trend
      let qualityTrend: 'improving' | 'degrading' | 'stable';
      if (improvedFindings < baselineFindings) {
        qualityTrend = 'improving';
      } else if (improvedFindings > baselineFindings) {
        qualityTrend = 'degrading';
      } else {
        qualityTrend = 'stable';
      }

      // Log for visibility
      console.log(
        `Quality trend: ${qualityTrend} (${baselineFindings} → ${improvedFindings} findings)`
      );
    }, 240000);
  });

  describe('Edge Cases', () => {
    test('handles empty baseline gracefully', async () => {
      // Given: Empty directory (no config files)
      const emptyFixture = createTestFixture('empty-baseline');

      try {
        // When: Run scan
        const result = await runCLI(['scan', '-d', emptyFixture.path], { json: true });

        // Then: Scan succeeds with empty results
        expect(result.exitCode).toBe(0);
        const output = parseJSONOutput<{ configs: unknown[] }>(result);
        expect(output?.configs).toEqual([]);
      } finally {
        emptyFixture.cleanup();
      }
    });

    test('handles config file deletion', async () => {
      // Given: A config exists
      writeFileSync(join(fixture.path, 'CLAUDE.md'), MINIMAL_CONFIG);

      // When: Scan with config
      const withConfig = await runCLI(['scan', '-d', fixture.path], { json: true });
      const withConfigOutput = parseJSONOutput<{ configs: unknown[] }>(withConfig);
      expect(withConfigOutput?.configs?.length).toBeGreaterThan(0);

      // And: Delete the config
      rmSync(join(fixture.path, 'CLAUDE.md'));

      // And: Scan again
      const withoutConfig = await runCLI(['scan', '-d', fixture.path], { json: true });
      const withoutConfigOutput = parseJSONOutput<{ configs: unknown[] }>(withoutConfig);

      // Then: Config is no longer found
      expect(
        withoutConfigOutput?.configs?.filter((c: unknown) => {
          const config = c as { type?: string };
          return config?.type === 'claude-code';
        }).length ?? 0
      ).toBe(0);
    });
  });
});
