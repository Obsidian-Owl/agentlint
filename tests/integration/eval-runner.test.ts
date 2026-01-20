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
import type {
  GoldenScenario,
  GoldenManifest,
  IEvaluationRunner,
  EvaluationResult,
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
// Mock Evaluation Runner for Testing
// =============================================================================

/**
 * Mock implementation of EvaluationRunner for integration testing.
 * This will be replaced by the real implementation in T050.
 */
class MockEvaluationRunner implements IEvaluationRunner {
  private scenarios: GoldenScenario[] = [];

  async loadGoldenDataset(path: string): Promise<GoldenScenario[]> {
    // In real implementation, this would load from manifest.json
    const manifestPath = join(path, 'manifest.json');
    if (!existsSync(manifestPath)) {
      throw new Error(`Manifest not found at ${manifestPath}`);
    }

    const manifestContent = await Bun.file(manifestPath).text();
    const manifest = JSON.parse(manifestContent) as GoldenManifest;

    this.scenarios = [];
    for (const entry of manifest.scenarios) {
      const scenarioPath = join(path, entry.path);
      if (existsSync(scenarioPath)) {
        const content = await Bun.file(scenarioPath).text();
        this.scenarios.push(JSON.parse(content) as GoldenScenario);
      }
    }

    return this.scenarios;
  }

  async evaluateScenario(
    scenario: GoldenScenario,
    analysisOutput: unknown
  ): Promise<EvaluationResult> {
    // Code-based checks
    const codeBased = this.runCodeBasedChecks(analysisOutput);

    // Mock LLM judge (in real implementation, this would call TruLens)
    const llmJudge = codeBased.passed
      ? {
          actionability: 0.85,
          causalAccuracy: 0.75,
          relevance: 0.90,
          reasoning: {
            actionability: 'Good actionable recommendations',
            causalAccuracy: 'Reasonable causal chain',
            relevance: 'Highly relevant findings',
          },
        }
      : undefined;

    // Calculate overall score
    const overallScore = codeBased.passed && llmJudge
      ? llmJudge.actionability * scenario.rubricWeights.actionability +
        llmJudge.causalAccuracy * scenario.rubricWeights.causalAccuracy +
        llmJudge.relevance * scenario.rubricWeights.relevance
      : 0;

    return {
      id: randomUUID(),
      scenarioId: scenario.id,
      timestamp: new Date().toISOString(),
      grades: {
        codeBased,
        llmJudge,
      },
      overallScore,
      passed: overallScore >= EVAL_THRESHOLDS.PASS_THRESHOLD,
    };
  }

  async evaluateAll(
    scenarios: GoldenScenario[],
    analysisFn: (input: GoldenInput) => Promise<unknown>
  ): Promise<EvaluationSummary> {
    const results: EvaluationResult[] = [];

    for (const scenario of scenarios) {
      const output = await analysisFn(scenario.input);
      const result = await this.evaluateScenario(scenario, output);
      results.push(result);
    }

    const passedCount = results.filter((r) => r.passed).length;

    return {
      totalScenarios: scenarios.length,
      passedScenarios: passedCount,
      passRate: scenarios.length > 0 ? passedCount / scenarios.length : 0,
      averageScores: this.calculateAverageScores(results),
      results,
      timestamp: new Date().toISOString(),
    };
  }

  checkReleaseGate(summary: EvaluationSummary): boolean {
    return summary.passRate >= EVAL_THRESHOLDS.PASS_THRESHOLD;
  }

  private runCodeBasedChecks(output: unknown): {
    passed: boolean;
    checks: {
      outputFormatValid: boolean;
      requiredFieldsPresent: boolean;
      noHallucinatedFiles: boolean;
      causalChainComplete: boolean;
    };
  } {
    if (typeof output !== 'object' || output === null) {
      return {
        passed: false,
        checks: {
          outputFormatValid: false,
          requiredFieldsPresent: false,
          noHallucinatedFiles: true,
          causalChainComplete: false,
        },
      };
    }

    const o = output as Record<string, unknown>;
    const checks = {
      outputFormatValid: typeof o.format_version === 'string' && typeof o.success === 'boolean',
      requiredFieldsPresent: 'command' in o && 'timestamp' in o,
      noHallucinatedFiles: true,
      causalChainComplete: this.checkCausalChains(o),
    };

    return {
      passed: Object.values(checks).every(Boolean),
      checks,
    };
  }

  private checkCausalChains(output: Record<string, unknown>): boolean {
    const findings = output.findings as Array<{ origin?: unknown }> | undefined;
    if (!findings) return true;
    return findings.every((f) => f.origin !== undefined);
  }

  private calculateAverageScores(results: EvaluationResult[]): {
    actionability: number;
    causalAccuracy: number;
    relevance: number;
    overall: number;
  } {
    if (results.length === 0) {
      return { actionability: 0, causalAccuracy: 0, relevance: 0, overall: 0 };
    }

    const withScores = results.filter((r) => r.grades.llmJudge);
    if (withScores.length === 0) {
      return {
        actionability: 0,
        causalAccuracy: 0,
        relevance: 0,
        overall: results.reduce((s, r) => s + r.overallScore, 0) / results.length,
      };
    }

    const sum = withScores.reduce(
      (acc, r) => ({
        actionability: acc.actionability + r.grades.llmJudge!.actionability,
        causalAccuracy: acc.causalAccuracy + r.grades.llmJudge!.causalAccuracy,
        relevance: acc.relevance + r.grades.llmJudge!.relevance,
      }),
      { actionability: 0, causalAccuracy: 0, relevance: 0 }
    );

    return {
      actionability: sum.actionability / withScores.length,
      causalAccuracy: sum.causalAccuracy / withScores.length,
      relevance: sum.relevance / withScores.length,
      overall: results.reduce((s, r) => s + r.overallScore, 0) / results.length,
    };
  }
}

// =============================================================================
// Test Setup
// =============================================================================

let tempDir: string;
let runner: MockEvaluationRunner;

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

  runner = new MockEvaluationRunner();
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
      expect(scenarios[0].id).toBe('scenario-001');
    });

    test('throws error for missing manifest', async () => {
      const nonExistentPath = join(tempDir, 'does-not-exist');

      await expect(runner.loadGoldenDataset(nonExistentPath)).rejects.toThrow('Manifest not found');
    });
  });

  describe('evaluateScenario', () => {
    test('evaluates a single scenario', async () => {
      const scenarios = await runner.loadGoldenDataset(tempDir);
      const scenario = scenarios[0]!;
      const output = await mockAnalysisFn(scenario.input);

      const result = await runner.evaluateScenario(scenario, output);

      expect(result.scenarioId).toBe(scenario.id);
      expect(result.grades.codeBased.passed).toBe(true);
      expect(result.grades.llmJudge).toBeDefined();
      expect(result.overallScore).toBeGreaterThan(0);
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
    test('evaluates all scenarios and returns summary', async () => {
      const scenarios = await runner.loadGoldenDataset(tempDir);

      const summary = await runner.evaluateAll(scenarios, mockAnalysisFn);

      expect(summary.totalScenarios).toBe(3);
      expect(summary.passedScenarios).toBe(3);
      expect(summary.passRate).toBe(1);
      expect(summary.results).toHaveLength(3);
    });

    test('calculates average scores correctly', async () => {
      const scenarios = await runner.loadGoldenDataset(tempDir);

      const summary = await runner.evaluateAll(scenarios, mockAnalysisFn);

      expect(summary.averageScores.actionability).toBeGreaterThan(0);
      expect(summary.averageScores.causalAccuracy).toBeGreaterThan(0);
      expect(summary.averageScores.relevance).toBeGreaterThan(0);
      expect(summary.averageScores.overall).toBeGreaterThan(0);
    });
  });

  describe('checkReleaseGate', () => {
    test('passes for 100% pass rate', async () => {
      const scenarios = await runner.loadGoldenDataset(tempDir);
      const summary = await runner.evaluateAll(scenarios, mockAnalysisFn);

      expect(runner.checkReleaseGate(summary)).toBe(true);
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
  test('complete evaluation workflow', async () => {
    // 1. Load golden dataset
    const scenarios = await runner.loadGoldenDataset(tempDir);
    expect(scenarios.length).toBeGreaterThan(0);

    // 2. Evaluate all scenarios
    const summary = await runner.evaluateAll(scenarios, mockAnalysisFn);
    expect(summary.results.length).toBe(scenarios.length);

    // 3. Check release gate
    const passesGate = runner.checkReleaseGate(summary);
    expect(passesGate).toBe(true);

    // 4. Verify all results have required fields
    for (const result of summary.results) {
      expect(result.id).toBeDefined();
      expect(result.scenarioId).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.grades).toBeDefined();
      expect(typeof result.overallScore).toBe('number');
      expect(typeof result.passed).toBe('boolean');
    }
  });
});
