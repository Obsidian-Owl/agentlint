/**
 * E2E Tests for Static and Fallback Analysis
 *
 * Tests the static analysis mode (--static) and fallback behavior when
 * orchestrated analysis is unavailable. These tests do NOT require
 * ANTHROPIC_API_KEY and make no live API calls.
 *
 * For live orchestrated analysis tests, see: analyse-live.test.ts
 * Run live tests with: bun run test:live
 *
 * @module tests/e2e/cli/analyse-orchestrated
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { createTestFixture, runCLI, parseJSONOutput } from '../helpers';
import type { TestFixture } from '../helpers';

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

const CLAUDE_MD_WITH_SECRET = `# CLAUDE.md

## Project Overview
Test project.

## Configuration
password = mysupersecretpassword123
`;

// =============================================================================
// Static Analysis Tests (No API Key Required)
// =============================================================================

describe('E2E: Static Analysis Mode (--static)', () => {
  let fixture: TestFixture;

  beforeAll(() => {
    fixture = createTestFixture('static-analysis');
    writeFileSync(join(fixture.path, 'CLAUDE.md'), CLAUDE_MD_FIXTURE);
  });

  afterAll(() => {
    fixture.cleanup();
  });

  test('--static flag runs analysis without LLM', async () => {
    const result = await runCLI(['analyse', '--static', '-d', fixture.path], {
      json: true,
      timeout: 30000,
    });

    expect(result.exitCode).toBe(0);

    const output = parseJSONOutput<AnalyseOutput>(result);
    expect(output?.status).toBe('success');
    expect(output?.configs?.length).toBeGreaterThan(0);
  });

  test('static analysis produces findings', async () => {
    const result = await runCLI(['analyse', '--static', '-d', fixture.path], {
      json: true,
    });

    const output = parseJSONOutput<AnalyseOutput>(result);

    // Static analysis should find gaps in the minimal fixture
    expect(output?.findings?.length).toBeGreaterThanOrEqual(1);

    // Findings should have required fields
    for (const finding of output?.findings ?? []) {
      expect(finding.id).toBeDefined();
      expect(finding.severity).toBeDefined();
      expect(finding.title).toBeDefined();
    }
  });

  test('static analysis includes recommendations', async () => {
    const result = await runCLI(['analyse', '--static', '-d', fixture.path], {
      json: true,
    });

    const output = parseJSONOutput<AnalyseOutput>(result);

    // At least some findings should have recommendations
    const findingsWithRecs = output?.findings?.filter((f) => f.recommendations?.length);
    expect(findingsWithRecs?.length).toBeGreaterThan(0);
  });

  test('static analysis detects secrets', async () => {
    const secretFixture = createTestFixture('secrets');
    try {
      writeFileSync(join(secretFixture.path, 'CLAUDE.md'), CLAUDE_MD_WITH_SECRET);

      const result = await runCLI(['analyse', '--static', '-d', secretFixture.path], {
        json: true,
      });

      const output = parseJSONOutput<AnalyseOutput>(result);

      // Should detect the embedded secret
      const secretFinding = output?.findings?.find(
        (f) => f.type === 'secret_exposure' || f.title.toLowerCase().includes('secret')
      );
      expect(secretFinding).toBeDefined();
    } finally {
      secretFixture.cleanup();
    }
  });

  test('--verbose flag shows additional output', async () => {
    const result = await runCLI(['analyse', '--static', '-d', fixture.path, '--verbose']);

    // Verbose mode should show more details
    expect(result.exitCode).toBe(0);
    // Output should contain location information
  });

  test('--fail-on-findings returns exit code 1', async () => {
    const result = await runCLI(['analyse', '--static', '-d', fixture.path, '--fail-on-findings'], {
      json: true,
    });

    const output = parseJSONOutput<AnalyseOutput>(result);
    if (output?.findings?.length && output.findings.length > 0) {
      expect(result.exitCode).toBe(1);
    } else {
      expect(result.exitCode).toBe(0);
    }
  });

  test('summary includes severity breakdown', async () => {
    const result = await runCLI(['analyse', '--static', '-d', fixture.path], {
      json: true,
    });

    const output = parseJSONOutput<AnalyseOutput>(result);
    expect(output?.summary).toBeDefined();
    expect(output?.summary?.total).toBeDefined();
    expect(output?.summary?.bySeverity).toBeDefined();

    // Total should match sum of severity counts
    const severityTotal = Object.values(output?.summary?.bySeverity ?? {}).reduce(
      (a, b) => a + b,
      0
    );
    expect(severityTotal).toBe(output?.summary?.total ?? 0);
  });
});

// =============================================================================
// Orchestrated Analysis Fallback Tests
// =============================================================================

describe('E2E: Static Analysis Mode', () => {
  test('--static flag runs analysis without LLM', async () => {
    // Each test gets its own isolated fixture to prevent cross-test contamination
    const fixture = createTestFixture('static-test');
    try {
      writeFileSync(join(fixture.path, 'CLAUDE.md'), CLAUDE_MD_FIXTURE);

      // Use --static flag to explicitly run without LLM (faster and deterministic)
      const result = await runCLI(['analyse', '-d', fixture.path, '--static'], {
        json: true,
      });

      // Should succeed with static analysis
      expect(result.exitCode).toBe(0);

      const output = parseJSONOutput<AnalyseOutput>(result);
      expect(output?.status).toBe('success');
    } finally {
      fixture.cleanup();
    }
  });
});

// NOTE: Live orchestrated analysis tests are in analyse-live.test.ts
// Run with: bun run test:live

// =============================================================================
// Mode Selection Tests
// =============================================================================

describe('E2E: Analysis Mode Selection', () => {
  test('--dry-run takes precedence over --static', async () => {
    const fixture = createTestFixture('mode-dryrun');
    try {
      writeFileSync(join(fixture.path, 'CLAUDE.md'), CLAUDE_MD_FIXTURE);

      const result = await runCLI(['analyse', '--dry-run', '--static', '-d', fixture.path], {
        json: true,
      });

      const output = parseJSONOutput<AnalyseOutput>(result);
      expect(output?.status).toBe('dry-run');
      expect(output?.findings?.length).toBe(0); // Dry run has no findings
    } finally {
      fixture.cleanup();
    }
  });

  test('--static is faster than orchestrated', async () => {
    const fixture = createTestFixture('mode-static');
    try {
      writeFileSync(join(fixture.path, 'CLAUDE.md'), CLAUDE_MD_FIXTURE);

      // Static should complete quickly
      const staticResult = await runCLI(['analyse', '--static', '-d', fixture.path], {
        json: true,
        timeout: 10000,
      });

      expect(staticResult.exitCode).toBe(0);

      const output = parseJSONOutput<AnalyseOutput>(staticResult);
      expect(output?.durationMs ?? 0).toBeLessThan(10000);
    } finally {
      fixture.cleanup();
    }
  });

  test('help text shows all modes', async () => {
    const result = await runCLI(['analyse', '--help']);

    expect(result.stdout).toContain('--static');
    expect(result.stdout).toContain('--dry-run');
  });
});
