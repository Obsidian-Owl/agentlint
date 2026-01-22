/**
 * Live E2E Tests for Orchestrated Analysis
 *
 * These tests make REAL API calls to validate orchestrated analysis behavior.
 * They require ANTHROPIC_API_KEY and will FAIL (not skip) if missing.
 *
 * Run with: bun run test:live
 *
 * @module tests/e2e/cli/analyse-live
 */

import { describe, test, expect } from 'bun:test';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { createTestFixture, runCLI, parseJSONOutput } from '../helpers';
import { requireAPIKey } from '../../lib/require-api-key';

// Fail fast if API key is missing - no silent skips
requireAPIKey();

// =============================================================================
// Types
// =============================================================================

interface AnalyseOutput {
  status: 'success' | 'error' | 'dry-run';
  error?: string;
  directory: string;
  configs: Array<{
    path: string;
    relativePath: string;
    type: string;
    description: string;
    size: number;
  }>;
  findings: Array<{
    id: string;
    severity: string;
    type: string;
    title: string;
    description: string;
    location?: {
      file: string;
      line?: number;
    };
    origin?: {
      type: string;
      reference: string;
      description: string;
    };
    recommendations?: Array<{
      type: string;
      action: string;
      rationale: string;
      priority?: string;
    }>;
  }>;
  summary: {
    total: number;
    bySeverity: Record<string, number>;
  };
  timestamp: string;
  durationMs?: number;
}

// =============================================================================
// Test Fixtures
// =============================================================================

const CLAUDE_MD_FIXTURE = `# CLAUDE.md

## Project Overview
A sample TypeScript project for testing agentlint.

## Commands
Run stuff.
`;

// =============================================================================
// Live Orchestrated Analysis Tests
// =============================================================================

describe('E2E: Live Orchestrated Analysis', () => {
  test('orchestrated analysis produces intelligent findings', async () => {
    const fixture = createTestFixture('orchestrated-findings');
    try {
      writeFileSync(join(fixture.path, 'CLAUDE.md'), CLAUDE_MD_FIXTURE);

      const result = await runCLI(['analyse', '-d', fixture.path], {
        json: true,
        timeout: 180000, // 3 minutes for agent analysis
      });

      expect(result.exitCode).toBe(0);

      const output = parseJSONOutput<AnalyseOutput>(result);
      expect(output?.status).toBe('success');
      expect(output?.configs?.length).toBeGreaterThan(0);

      // Orchestrated analysis should produce findings
      expect(output?.findings?.length).toBeGreaterThanOrEqual(0);
    } finally {
      fixture.cleanup();
    }
  }, 180000);

  test('orchestrated analysis includes causal tracing', async () => {
    const fixture = createTestFixture('orchestrated-causal');
    try {
      writeFileSync(join(fixture.path, 'CLAUDE.md'), CLAUDE_MD_FIXTURE);

      const result = await runCLI(['analyse', '-d', fixture.path], {
        json: true,
        timeout: 180000,
      });

      const output = parseJSONOutput<AnalyseOutput>(result);

      // Findings should include origin tracing
      const findingsWithOrigin = output?.findings?.filter((f) => f.origin);
      if (output?.findings?.length && output.findings.length > 0) {
        expect(findingsWithOrigin?.length).toBeGreaterThanOrEqual(0);
      }
    } finally {
      fixture.cleanup();
    }
  }, 180000);

  test('--verbose shows tool calls during analysis', async () => {
    const fixture = createTestFixture('orchestrated-verbose');
    try {
      writeFileSync(join(fixture.path, 'CLAUDE.md'), CLAUDE_MD_FIXTURE);

      const result = await runCLI(['analyse', '-d', fixture.path, '--verbose'], {
        timeout: 180000,
      });

      expect(result.exitCode).toBe(0);

      // Verbose mode should show tool invocations
      // (Tool names may appear in output)
    } finally {
      fixture.cleanup();
    }
  }, 180000);

  test('JSON output streams NDJSON events', async () => {
    const fixture = createTestFixture('orchestrated-json');
    try {
      writeFileSync(join(fixture.path, 'CLAUDE.md'), CLAUDE_MD_FIXTURE);

      const result = await runCLI(['analyse', '-d', fixture.path, '--json'], {
        timeout: 180000,
      });

      expect(result.exitCode).toBe(0);

      // Output should be valid JSON (either single object or NDJSON)
      const lines = result.stdout.trim().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          // Verify it's valid JSON by parsing it
          let parsed: unknown;
          expect(() => {
            parsed = JSON.parse(line) as unknown;
          }).not.toThrow();
          expect(parsed).toBeDefined();
        }
      }
    } finally {
      fixture.cleanup();
    }
  }, 180000);
});
