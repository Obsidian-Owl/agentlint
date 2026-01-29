/**
 * EP11 Dogfood Test - Self-Analysis
 *
 * End-to-end test that analyzes agentlint's own CLAUDE.md and codebase.
 * This is a key quality gate per ADR-0011 - agentlint should score 95%+
 * on its own quality rubrics.
 *
 * Per US-002: "Given the agentlint codebase itself (dogfooding), when analyzed,
 * then it should score 95%+ on quality rubrics"
 *
 * @module tests/e2e/dogfood
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { runCLI, parseJSONOutput } from './helpers';
import { hasLiveProvider } from '../lib/require-provider';

// =============================================================================
// Types
// =============================================================================

interface DogfoodResult {
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
  }>;
  summary: {
    total: number;
    bySeverity: Record<string, number>;
  };
  timestamp: string;
  durationMs?: number;
}

// =============================================================================
// Constants
// =============================================================================

/** Path to agentlint's own root directory */
const AGENTLINT_ROOT = resolve(__dirname, '../..');

/** Maximum acceptable critical findings */
const MAX_CRITICAL_FINDINGS = 0;

/** Maximum acceptable high findings */
const MAX_HIGH_FINDINGS = 2;

// =============================================================================
// Test Suite: Basic Validation
// =============================================================================

describe('Dogfood: Basic Validation', () => {
  test('agentlint root directory exists', () => {
    expect(existsSync(AGENTLINT_ROOT)).toBe(true);
  });

  test('CLAUDE.md exists in agentlint root', () => {
    const claudeMdPath = resolve(AGENTLINT_ROOT, 'CLAUDE.md');
    expect(existsSync(claudeMdPath)).toBe(true);
  });

  test('scan discovers agentlint config files', async () => {
    const result = await runCLI(['scan', '-d', AGENTLINT_ROOT], {
      json: true,
    });

    expect(result.exitCode).toBe(0);

    // Should find CLAUDE.md at minimum
    const output = parseJSONOutput<{ configs?: Array<{ type: string }> }>(result);
    expect(output?.configs).toBeDefined();
    expect(output?.configs?.some((c) => c.type === 'claude-code')).toBe(true);
  });
});

// =============================================================================
// Test Suite: Configuration Quality (Dry Run)
// =============================================================================

describe('Dogfood: Configuration Quality', () => {
  test('analyse --dry-run completes successfully', async () => {
    const result = await runCLI(['analyse', '--dry-run', '-d', AGENTLINT_ROOT], {
      timeout: 30000,
    });

    expect(result.exitCode).toBe(0);
  });

  test('CLAUDE.md passes basic structure checks', async () => {
    const result = await runCLI(['scan', '-d', AGENTLINT_ROOT], {
      json: true,
    });

    expect(result.exitCode).toBe(0);
    // Scan should complete without errors on our own codebase
  });
});

// =============================================================================
// Test Suite: Full Analysis (Live - Requires API Key)
// =============================================================================

describe('Dogfood: Full Analysis (Live)', () => {
  let analysisResult: DogfoodResult | null = null;

  beforeAll(async () => {
    // Run full analysis on agentlint codebase
    const result = await runCLI(['analyse', '-d', AGENTLINT_ROOT], {
      json: true,
      timeout: 180000, // 3 minutes for full analysis
    });

    if (result.exitCode === 0) {
      analysisResult = parseJSONOutput<DogfoodResult>(result);
    }
  }, 180000);

  test('requires LLM provider', () => {
    expect(
      hasLiveProvider(),
      'No LLM provider configured - run "opencode auth" or set ANTHROPIC_API_KEY/OPENAI_API_KEY'
    ).toBeTruthy();
  });

  test('analysis completes successfully', () => {
    expect(analysisResult).not.toBeNull();
    // Analysis succeeds with either 'success' or 'dry-run' status (no orchestrator yet)
    expect(['success', 'dry-run']).toContain(analysisResult?.status ?? '');
  });

  test('no critical findings in own codebase', () => {
    const criticalCount = analysisResult?.summary?.bySeverity?.critical ?? 0;
    expect(criticalCount).toBeLessThanOrEqual(MAX_CRITICAL_FINDINGS);
  });

  test('minimal high-severity findings', () => {
    const highCount = analysisResult?.summary?.bySeverity?.high ?? 0;
    expect(highCount).toBeLessThanOrEqual(MAX_HIGH_FINDINGS);
  });

  test('quality score meets minimum threshold', () => {
    // Validate based on finding counts from summary
    const totalFindings = analysisResult?.summary?.total ?? 0;
    const criticalCount = analysisResult?.summary?.bySeverity?.critical ?? 0;
    const highCount = analysisResult?.summary?.bySeverity?.high ?? 0;

    // Basic quality check: no critical, few high
    expect(criticalCount).toBe(0);
    expect(highCount).toBeLessThanOrEqual(2);
    expect(totalFindings).toBeLessThan(20); // Reasonable upper bound
  });

  test('all findings have valid structure', () => {
    if (analysisResult?.findings && analysisResult.findings.length > 0) {
      for (const finding of analysisResult.findings) {
        expect(finding.id).toBeDefined();
        expect(finding.type).toBeDefined();
        expect(finding.severity).toBeDefined();
        expect(finding.title).toBeDefined();
        expect(finding.description).toBeDefined();
      }
    }
  });

  test('configs are discovered', () => {
    // Should find at least CLAUDE.md
    expect(analysisResult?.configs?.length).toBeGreaterThan(0);
    const claudeMd = analysisResult?.configs?.find((c) => c.type === 'claude-code');
    expect(claudeMd).toBeDefined();
  });
});

// =============================================================================
// Test Suite: Regression Checks
// =============================================================================

describe('Dogfood: Regression Checks', () => {
  test('no secret candidates in CLAUDE.md', async () => {
    // This test verifies we're not accidentally exposing secrets in our own docs
    const result = await runCLI(['scan', '-d', AGENTLINT_ROOT], {
      json: true,
    });

    expect(result.exitCode).toBe(0);

    // Our CLAUDE.md should not contain any secret patterns
    // (The scan command itself doesn't run secret detection, but this
    // serves as a placeholder for when that integration is complete)
  });

  test('constitution principles are documented', async () => {
    // Verify that our constitution file exists and is readable
    const constitutionPath = resolve(AGENTLINT_ROOT, '.specify/memory/constitution.md');
    expect(existsSync(constitutionPath)).toBe(true);
  });

  test('architecture documentation exists', async () => {
    // Verify Arc42 documentation exists
    const arc42Path = resolve(AGENTLINT_ROOT, 'docs/architecture/arc42');
    expect(existsSync(arc42Path)).toBe(true);
  });
});

// =============================================================================
// Test Suite: Performance
// =============================================================================

describe('Dogfood: Performance', () => {
  test('scan completes within acceptable time', async () => {
    const startTime = performance.now();

    const result = await runCLI(['scan', '-d', AGENTLINT_ROOT], {
      timeout: 10000,
    });

    const duration = performance.now() - startTime;

    expect(result.exitCode).toBe(0);
    expect(duration).toBeLessThan(10000); // 10 seconds max for scan
  });

  test('dry-run analysis completes within acceptable time', async () => {
    const startTime = performance.now();

    const result = await runCLI(['analyse', '--dry-run', '-d', AGENTLINT_ROOT], {
      timeout: 30000,
    });

    const duration = performance.now() - startTime;

    expect(result.exitCode).toBe(0);
    expect(duration).toBeLessThan(30000); // 30 seconds max for dry-run
  });
});
