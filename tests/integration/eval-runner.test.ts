/**
 * EP11 Evaluation Runner Integration Tests
 *
 * Integration tests for the evaluation runner using VCR recordings.
 * Tests the full evaluation workflow from golden scenarios to results.
 *
 * @module tests/integration/eval-runner
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { createTestEvaluationRunner } from '../../src/eval/runner';
import type {
  GoldenScenario,
  GoldenManifest,
  EvaluationSummary,
  GoldenInput,
} from '../../src/eval/types';
import { EVAL_THRESHOLDS } from '../../src/eval/types';

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Create a test golden scenario.
 */
function createTestScenario(id: string, difficulty: 'easy' | 'medium' | 'hard' = 'easy'): GoldenScenario {
  return {
    id,
    version: '1.0.0',
    source: 'dogfood',
    input: {
      claudeMd: `# CLAUDE.md\n\nTest project for ${id}.\n\n## Project Overview\nThis is a test.`,
      projectType: 'typescript',
    },
    expectedProperties: {
      shouldDetect: ['missing-development-workflow'],
      shouldNotDetect: [],
      recommendationTypes: ['preventive'],
    },
    rubricWeights: EVAL_THRESHOLDS.DEFAULT_WEIGHTS,
    metadata: {
      addedAt: new Date().toISOString(),
      difficulty,
      tags: ['test'],
    },
  };
}

/**
 * Create a test manifest.
 */
function createTestManifest(scenarios: GoldenScenario[]): GoldenManifest {
  return {
    version: '1.0.0',
    updatedAt: new Date().toISOString(),
    scenarios: scenarios.map((s) => ({
      id: s.id,
      path: `${s.id}.json`,
      source: s.source,
      difficulty: s.metadata.difficulty,
      tags: s.metadata.tags,
    })),
    stats: {
      total: scenarios.length,
      bySource: { dogfood: scenarios.length },
      byDifficulty: {
        easy: scenarios.filter((s) => s.metadata.difficulty === 'easy').length,
        medium: scenarios.filter((s) => s.metadata.difficulty === 'medium').length,
        hard: scenarios.filter((s) => s.metadata.difficulty === 'hard').length,
      },
    },
  };
}

/**
 * Mock analysis function for testing.
 */
async function mockAnalysisFn(_input: GoldenInput): Promise<unknown> {
  // Simulate analysis output
  return {
    format_version: '1.0',
    command: 'analyse',
    timestamp: new Date().toISOString(),
    success: true,
    findings: [
      {
        id: 'FND-001',
        type: 'missing-development-workflow',
        severity: 'medium',
        description: 'Missing Development Workflow section',
        location: { file: 'CLAUDE.md', line: 1 },
        origin: { type: 'detection', description: 'Config analysis' },
      },
    ],
    recommendations: [
      {
        id: 'REC-001',
        title: 'Add Development Workflow',
        priority: 'high',
        description: 'Add workflow documentation',
        findingIds: ['FND-001'],
      },
    ],
    metrics: {
      findingsCount: 1,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 1,
      lowCount: 0,
      infoCount: 0,
    },
  };
}

// =============================================================================
// Test Setup
// =============================================================================

import type { EvaluationRunner } from '../../src/eval/runner';

let tempDir: string;
let runner: EvaluationRunner;

beforeAll(() => {
  tempDir = join(tmpdir(), `eval-runner-test-${randomUUID()}`);
  mkdirSync(tempDir, { recursive: true });

  // Create test scenarios
  const scenarios = [
    createTestScenario('scenario-001', 'easy'),
    createTestScenario('scenario-002', 'medium'),
    createTestScenario('scenario-003', 'hard'),
  ];

  // Write manifest
  const manifest = createTestManifest(scenarios);
  writeFileSync(join(tempDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // Write scenario files
  for (const scenario of scenarios) {
    writeFileSync(join(tempDir, `${scenario.id}.json`), JSON.stringify(scenario, null, 2));
  }

  runner = createTestEvaluationRunner();
});

afterAll(() => {
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

// =============================================================================
// Test Suite
// =============================================================================

describe('EvaluationRunner Integration', () => {
  describe('loadGoldenDataset', () => {
    test('loads scenarios from manifest', async () => {
      const scenarios = await runner.loadGoldenDataset(tempDir);

      expect(scenarios).toHaveLength(3);
      expect(scenarios[0]!.id).toBe('scenario-001');
    });

    test('throws error for missing manifest', async () => {
      const nonExistentPath = join(tempDir, 'does-not-exist');

      await expect(runner.loadGoldenDataset(nonExistentPath)).rejects.toThrow('Manifest not found');
    });
  });

  describe('evaluateScenario', () => {
    test('evaluates a single scenario (code-based only)', async () => {
      const scenarios = await runner.loadGoldenDataset(tempDir);
      const scenario = scenarios[0]!;
      const output = await mockAnalysisFn(scenario.input);

      const result = await runner.evaluateScenario(scenario, output);

      expect(result.scenarioId).toBe(scenario.id);
      expect(result.grades.codeBased.passed).toBe(true);
      // With skipLLMJudge: true, no LLM judge grades are provided
      expect(result.grades.llmJudge).toBeUndefined();
      // Without LLM judge, overall score is 0 by design
      expect(result.overallScore).toBe(0);
    });

    test('returns 0 score for invalid output', async () => {
      const scenarios = await runner.loadGoldenDataset(tempDir);
      const scenario = scenarios[0]!;

      const result = await runner.evaluateScenario(scenario, null);

      expect(result.grades.codeBased.passed).toBe(false);
      expect(result.overallScore).toBe(0);
      expect(result.passed).toBe(false);
    });
  });

  describe('evaluateAll', () => {
    test('evaluates all scenarios and returns summary (code-based only)', async () => {
      const scenarios = await runner.loadGoldenDataset(tempDir);

      const summary = await runner.evaluateAll(scenarios, mockAnalysisFn);

      expect(summary.totalScenarios).toBe(3);
      // Without LLM judge, no scenarios pass (overallScore = 0)
      expect(summary.passedScenarios).toBe(0);
      expect(summary.passRate).toBe(0);
      expect(summary.results).toHaveLength(3);
      // But all code-based checks should pass
      expect(summary.results.every((r) => r.grades.codeBased.passed)).toBe(true);
    });

    test('calculates average scores correctly (code-based only)', async () => {
      const scenarios = await runner.loadGoldenDataset(tempDir);

      const summary = await runner.evaluateAll(scenarios, mockAnalysisFn);

      // Without LLM judge, individual scores are 0
      expect(summary.averageScores.actionability).toBe(0);
      expect(summary.averageScores.causalAccuracy).toBe(0);
      expect(summary.averageScores.relevance).toBe(0);
      expect(summary.averageScores.overall).toBe(0);
    });
  });

  describe('checkReleaseGate', () => {
    test('fails without LLM judge (code-based only mode)', async () => {
      const scenarios = await runner.loadGoldenDataset(tempDir);
      const summary = await runner.evaluateAll(scenarios, mockAnalysisFn);

      // Without LLM judge, pass rate is 0, so release gate fails
      expect(runner.checkReleaseGate(summary)).toBe(false);
    });

    test('fails for low pass rate', () => {
      const summary: EvaluationSummary = {
        totalScenarios: 10,
        passedScenarios: 5,
        passRate: 0.5,
        averageScores: { actionability: 0.5, causalAccuracy: 0.5, relevance: 0.5, overall: 0.5 },
        results: [],
        timestamp: new Date().toISOString(),
      };

      expect(runner.checkReleaseGate(summary)).toBe(false);
    });
  });
});

// =============================================================================
// End-to-End Workflow
// =============================================================================

describe('Evaluation E2E Workflow', () => {
  test('complete evaluation workflow (code-based only)', async () => {
    // 1. Load golden dataset
    const scenarios = await runner.loadGoldenDataset(tempDir);
    expect(scenarios.length).toBeGreaterThan(0);

    // 2. Evaluate all scenarios
    const summary = await runner.evaluateAll(scenarios, mockAnalysisFn);
    expect(summary.results.length).toBe(scenarios.length);

    // 3. Check release gate - will fail without LLM judge
    const passesGate = runner.checkReleaseGate(summary);
    expect(passesGate).toBe(false); // Expected without LLM grades

    // 4. Verify all results have required fields
    for (const result of summary.results) {
      expect(result.id).toBeDefined();
      expect(result.scenarioId).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.grades).toBeDefined();
      expect(result.grades.codeBased.passed).toBe(true); // Code-based passes
      expect(typeof result.overallScore).toBe('number');
      expect(typeof result.passed).toBe('boolean');
    }
  });
});
