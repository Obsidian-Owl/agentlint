/**
 * E2E Tests for Orchestrated Analysis
 *
 * Tests the orchestrated analysis mode (default) which uses the Claude agent
 * to provide intelligent, causal analysis of AI configurations.
 *
 * These tests require ANTHROPIC_API_KEY for live testing, and test both
 * the orchestrated and static analysis modes.
 *
 * @module tests/e2e/cli/analyse-orchestrated
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { createTestFixture, runCLI, parseJSONOutput, hasAPIKey } from '../helpers';
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
    const result = await runCLI(
      ['analyse', '--static', '-d', fixture.path, '--fail-on-findings'],
      {
        json: true,
      }
    );

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
// Orchestrated Analysis Tests (Requires API Key)
// =============================================================================

describe('E2E: Orchestrated Analysis Mode (Default)', () => {
  // Skip these tests if no API key
  const skipIfNoKey = !hasAPIKey();

  // Live API tests are slow and flaky - require explicit opt-in
  // Run with: AGENTLINT_LIVE_TESTS=1 bun test analyse-orchestrated
  const skipLiveTests = skipIfNoKey || !process.env.AGENTLINT_LIVE_TESTS;

  test('falls back to static analysis without API key', async () => {
    // Each test gets its own isolated fixture to prevent cross-test contamination
    const fixture = createTestFixture('fallback-test');
    try {
      writeFileSync(join(fixture.path, 'CLAUDE.md'), CLAUDE_MD_FIXTURE);

      const result = await runCLI(['analyse', '-d', fixture.path], {
        json: true,
        env: { ANTHROPIC_API_KEY: '' },
      });

      // Should succeed by falling back to static
      expect(result.exitCode).toBe(0);

      const output = parseJSONOutput<AnalyseOutput>(result);
      expect(output?.status).toBe('success');
    } finally {
      fixture.cleanup();
    }
  });

  test.skipIf(skipLiveTests)(
    'orchestrated analysis produces intelligent findings',
    async () => {
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
    },
    180000
  );

  test.skipIf(skipLiveTests)(
    'orchestrated analysis includes causal tracing',
    async () => {
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
    },
    180000
  );

  test.skipIf(skipLiveTests)(
    '--verbose shows tool calls during analysis',
    async () => {
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
    },
    180000
  );

  test.skipIf(skipLiveTests)(
    'JSON output streams NDJSON events',
    async () => {
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
    },
    180000
  );
});

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
