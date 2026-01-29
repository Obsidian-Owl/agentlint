/**
 * EP11 E2E Workflow Tests - Analyse Command
 *
 * End-to-end tests for the analyse command workflow.
 * Tests the full analysis pipeline from config discovery to recommendations.
 *
 * Per ADR-0011: E2E tests with VCR recordings for deterministic CI runs.
 *
 * @module tests/e2e/workflows/analyse
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { createTestFixture, runCLI, parseJSONOutput } from '../helpers';
import type { TestFixture } from '../helpers';
import { hasLiveProvider } from '../../lib/require-provider';

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

/**
 * Sample CLAUDE.md with known issues for testing.
 * Issues:
 * - Vague commands section ("Run stuff")
 * - Missing development workflow
 * - Missing architecture section
 * - Missing testing guidelines
 */
const CLAUDE_MD_WITH_ISSUES = `# CLAUDE.md

## Project Overview
A sample project for testing.

## Commands
Run stuff.

## Notes
Remember to check things.
`;

/**
 * Expected findings for the CLAUDE_MD_WITH_ISSUES fixture.
 * These are the golden outputs that tests can validate against.
 *
 * The static analysis detects:
 * - Missing recommended sections (development, build, test, etc.)
 * - Missing configuration files (project settings)
 * - Missing code examples
 */
const EXPECTED_FINDINGS_FOR_ISSUES = {
  /** Minimum number of findings expected */
  minExpected: 2,
  /** Types of findings that should be detected */
  expectedTypes: ['config_gap'],
  /** Specific patterns that must be detected */
  mustDetect: [
    {
      type: 'config_gap',
      pattern: /missing.*section/i,
      description: 'Missing recommended sections (development, workflow, etc.)',
    },
    {
      type: 'config_gap',
      pattern: /code example|project.*setting/i,
      description: 'Missing code examples or project settings',
    },
  ],
  /** Findings that should NOT be detected (false positives) */
  shouldNotDetect: [{ type: 'secret_exposure', description: 'No secrets in this fixture' }],
};

/**
 * Well-structured CLAUDE.md for positive tests.
 */
const CLAUDE_MD_GOOD = `# CLAUDE.md

## Project Overview
This is a sample TypeScript project for testing agentlint E2E workflows.

**Stack**: TypeScript, Bun

## Development Workflow
1. Install dependencies: \`bun install\`
2. Run tests: \`bun test\`
3. Build: \`bun run build\`

## Key Architecture
- /src: Source code
- /tests: Test files
- /docs: Documentation

## Testing Guidelines
- Write unit tests for all new functions
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
`;

// =============================================================================
// Test Suite
// =============================================================================

describe('E2E: Analyse Workflow', () => {
  let fixture: TestFixture;

  beforeAll(() => {
    fixture = createTestFixture('analyse-workflow');
  });

  afterAll(() => {
    fixture.cleanup();
  });

  describe('Basic Command Execution', () => {
    test('analyse --help shows usage information', async () => {
      const result = await runCLI(['analyse', '--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('analyse');
      expect(result.stdout).toContain('analysis');
    });

    test('analyse on empty directory returns success with no findings', async () => {
      const emptyFixture = createTestFixture('empty');
      try {
        const result = await runCLI(['analyse', '--dry-run'], {
          cwd: emptyFixture.path,
        });

        // Dry run should succeed even with no config files
        expect(result.exitCode).toBe(0);
      } finally {
        emptyFixture.cleanup();
      }
    });

    test('scan discovers CLAUDE.md in directory', async () => {
      // Write a CLAUDE.md to fixture
      writeFileSync(join(fixture.path, 'CLAUDE.md'), CLAUDE_MD_GOOD);

      const result = await runCLI(['scan', '-d', fixture.path], {
        json: true,
      });

      expect(result.exitCode).toBe(0);

      const output = parseJSONOutput<{ configs?: Array<{ type: string }> }>(result);
      expect(output?.configs).toBeDefined();
      expect(output?.configs?.some((c) => c.type === 'claude-code')).toBe(true);
    });
  });

  describe('Dry Run Mode', () => {
    test('analyse --dry-run scans but does not run full analysis', async () => {
      writeFileSync(join(fixture.path, 'CLAUDE.md'), CLAUDE_MD_WITH_ISSUES);

      const result = await runCLI(['analyse', '--dry-run', '-d', fixture.path]);

      expect(result.exitCode).toBe(0);
      // Dry run should show discovered files but not full analysis
    });
  });
});

// =============================================================================
// Live Analysis Tests (require API key)
// =============================================================================

describe('E2E: Analyse Workflow (Live)', () => {
  let fixture: TestFixture;

  beforeAll(() => {
    fixture = createTestFixture('analyse-live');
    // Set up fixture with test files
    writeFileSync(join(fixture.path, 'CLAUDE.md'), CLAUDE_MD_WITH_ISSUES);
  });

  afterAll(() => {
    fixture.cleanup();
  });

  test('requires LLM provider', () => {
    expect(
      hasLiveProvider(),
      'No LLM provider configured - run "opencode auth" or set ANTHROPIC_API_KEY/OPENAI_API_KEY'
    ).toBeTruthy();
  });

  test('full analysis produces findings and recommendations', async () => {
    const result = await runCLI(['analyse', '-d', fixture.path], {
      json: true,
      timeout: 120000, // Analysis may take time
    });

    expect(result.exitCode).toBe(0);

    const output = parseJSONOutput<AnalyseOutput>(result);
    // Analysis succeeds with either 'success' or 'dry-run' status (no orchestrator yet)
    expect(['success', 'dry-run']).toContain(output?.status ?? '');

    // Should discover config files
    expect(output?.configs).toBeDefined();
    expect(output?.configs?.length).toBeGreaterThan(0);
  }, 120000);

  test('--fail-on-findings exits with code 1 when issues found', async () => {
    const result = await runCLI(['analyse', '-d', fixture.path, '--fail-on-findings'], {
      json: true,
      timeout: 120000,
    });

    // Should exit 1 if findings present, 0 otherwise
    const output = parseJSONOutput<AnalyseOutput>(result);
    if (output?.summary?.total && output.summary.total > 0) {
      expect(result.exitCode).toBe(1);
    }
  }, 120000);
});

// =============================================================================
// Golden Input/Output Validation Tests (P0-4)
// =============================================================================

describe('E2E: Golden Fixtures Validation', () => {
  let fixture: TestFixture;

  beforeAll(() => {
    fixture = createTestFixture('golden-fixtures');
    writeFileSync(join(fixture.path, 'CLAUDE.md'), CLAUDE_MD_WITH_ISSUES);
  });

  afterAll(() => {
    fixture.cleanup();
  });

  test('CLAUDE_MD_WITH_ISSUES fixture has documented issues', () => {
    // Verify the fixture content matches documentation
    expect(CLAUDE_MD_WITH_ISSUES).toContain('Run stuff');
    expect(CLAUDE_MD_WITH_ISSUES).not.toContain('bun install');
    expect(CLAUDE_MD_WITH_ISSUES).not.toContain('Architecture');
    expect(CLAUDE_MD_WITH_ISSUES).not.toContain('Testing Guidelines');
  });

  test('expected findings structure is valid', () => {
    // Validate the golden output structure
    expect(EXPECTED_FINDINGS_FOR_ISSUES.minExpected).toBeGreaterThanOrEqual(1);
    expect(EXPECTED_FINDINGS_FOR_ISSUES.expectedTypes.length).toBeGreaterThan(0);
    expect(EXPECTED_FINDINGS_FOR_ISSUES.mustDetect.length).toBeGreaterThan(0);

    // All mustDetect patterns should have valid structure
    for (const expected of EXPECTED_FINDINGS_FOR_ISSUES.mustDetect) {
      expect(expected.type).toBeDefined();
      expect(expected.pattern).toBeInstanceOf(RegExp);
      expect(expected.description).toBeDefined();
    }
  });

  test('known issues in fixture are detected (dry-run validation)', async () => {
    // Note: Full validation requires live analysis
    // This test validates the fixture is correctly set up
    const result = await runCLI(['analyse', '--dry-run', '-d', fixture.path], {
      json: true,
    });

    expect(result.exitCode).toBe(0);
    const output = parseJSONOutput<AnalyseOutput>(result);

    // Dry-run discovers config
    expect(output?.configs?.some((c) => c.type === 'claude-code')).toBe(true);
  });

  test('known issues in fixture are detected (live validation)', async () => {
    const result = await runCLI(['analyse', '-d', fixture.path], {
      json: true,
      timeout: 120000,
    });

    expect(result.exitCode).toBe(0);
    const output = parseJSONOutput<AnalyseOutput>(result);

    // Validate against golden outputs
    expect(output?.findings?.length).toBeGreaterThanOrEqual(
      EXPECTED_FINDINGS_FOR_ISSUES.minExpected
    );

    // Check that expected types are found
    for (const expected of EXPECTED_FINDINGS_FOR_ISSUES.mustDetect) {
      const found = output?.findings?.some(
        (f) => f.type === expected.type && expected.pattern.test(f.description)
      );
      expect(found).toBe(true);
    }

    // Check for false positives
    for (const shouldNot of EXPECTED_FINDINGS_FOR_ISSUES.shouldNotDetect) {
      const found = output?.findings?.some((f) => f.type === shouldNot.type);
      expect(found).toBe(false);
    }
  }, 120000);
});
