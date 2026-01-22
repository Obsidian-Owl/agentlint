/**
 * EP11 Quality & Security - Evaluation Runner
 *
 * Orchestrates evaluation across golden scenarios using code-based
 * checks and TruLens LLM-as-judge via Python subprocess.
 *
 * @module eval/runner
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { randomUUID } from 'crypto';
import type {
  GoldenScenario,
  GoldenManifest,
  GoldenInput,
  EvaluationResult,
  EvaluationSummary,
  EvaluationGrades,
  LLMJudgeGrade,
  IEvaluationRunner,
} from './types';
import { EVAL_THRESHOLDS } from './types';
import { CodeBasedGrader } from './graders/code-based';
import { calculateOverallScore, calculateAverageScores } from './scoring';

// =============================================================================
// Types
// =============================================================================

/**
 * TruLens subprocess response.
 */
interface TruLensResponse {
  scores: {
    actionability: number;
    causalAccuracy: number;
    relevance: number;
  };
  reasoning: {
    actionability: string;
    causalAccuracy: string;
    relevance: string;
  };
  overallScore: number;
  passed: boolean;
  trulensAvailable: boolean;
  model: string | null;
  error?: string;
}

/**
 * Runner configuration options.
 */
export interface EvaluationRunnerOptions {
  /** Path to TruLens runner script */
  trulensRunnerPath?: string;

  /** Working directory for TruLens (for uv) */
  trulensWorkingDir?: string;

  /** Timeout for TruLens subprocess in ms */
  trulensTimeoutMs?: number;

  /** Skip LLM judge evaluation (code-based only) */
  skipLLMJudge?: boolean;
}

// =============================================================================
// TruLens Subprocess
// =============================================================================

/**
 * Call the TruLens Python subprocess for LLM-as-judge evaluation.
 */
async function callTruLens(
  scenario: GoldenScenario,
  output: unknown,
  options: EvaluationRunnerOptions
): Promise<TruLensResponse | null> {
  const runnerPath =
    options.trulensRunnerPath ?? resolve(__dirname, '../../tests/evals/trulens-runner.py');
  const workingDir = options.trulensWorkingDir ?? resolve(__dirname, '../../tests/evals');
  const timeoutMs = options.trulensTimeoutMs ?? 60000;

  if (!existsSync(runnerPath)) {
    console.warn(`TruLens runner not found at ${runnerPath}`);
    return null;
  }

  const request = JSON.stringify({ scenario, output });

  return new Promise((resolve) => {
    const proc = spawn('uv', ['run', 'python', runnerPath, '-'], {
      cwd: workingDir,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    const timeout = setTimeout(() => {
      proc.kill('SIGTERM');
      resolve({
        error: 'TruLens timeout',
        scores: { actionability: 0, causalAccuracy: 0, relevance: 0 },
        reasoning: { actionability: '', causalAccuracy: '', relevance: '' },
        overallScore: 0,
        passed: false,
        trulensAvailable: false,
        model: null,
      });
    }, timeoutMs);

    proc.on('close', (code) => {
      clearTimeout(timeout);

      if (code !== 0) {
        console.warn(`TruLens exited with code ${code}: ${stderr}`);
        resolve(null);
        return;
      }

      try {
        // Find the JSON line (skip bytecode compilation messages)
        const lines = stdout.trim().split('\n');
        const jsonLine = lines.find((line) => line.startsWith('{'));
        if (!jsonLine) {
          console.warn('No JSON output from TruLens');
          resolve(null);
          return;
        }
        resolve(JSON.parse(jsonLine) as TruLensResponse);
      } catch (e) {
        console.warn(`Failed to parse TruLens output: ${String(e)}`);
        resolve(null);
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      console.warn(`TruLens spawn error: ${err.message}`);
      resolve(null);
    });

    // Write input to stdin
    proc.stdin.write(request);
    proc.stdin.end();
  });
}

// =============================================================================
// EvaluationRunner Implementation
// =============================================================================

/**
 * Orchestrates evaluation across golden scenarios.
 */
export class EvaluationRunner implements IEvaluationRunner {
  private codeBasedGrader: CodeBasedGrader;
  private options: EvaluationRunnerOptions;

  constructor(options: EvaluationRunnerOptions = {}) {
    this.codeBasedGrader = new CodeBasedGrader();
    this.options = options;
  }

  /**
   * Load golden scenarios from a manifest directory.
   */
  async loadGoldenDataset(path: string): Promise<GoldenScenario[]> {
    const manifestPath = join(path, 'manifest.json');

    if (!existsSync(manifestPath)) {
      throw new Error(`Manifest not found at ${manifestPath}`);
    }

    const manifestContent = await Bun.file(manifestPath).text();
    const manifest = JSON.parse(manifestContent) as GoldenManifest;

    const scenarios: GoldenScenario[] = [];

    for (const entry of manifest.scenarios) {
      const scenarioPath = join(path, entry.path);
      if (existsSync(scenarioPath)) {
        const content = await Bun.file(scenarioPath).text();
        scenarios.push(JSON.parse(content) as GoldenScenario);
      } else {
        console.warn(`Scenario file not found: ${scenarioPath}`);
      }
    }

    return scenarios;
  }

  /**
   * Evaluate a single scenario against analysis output.
   */
  async evaluateScenario(
    scenario: GoldenScenario,
    analysisOutput: unknown
  ): Promise<EvaluationResult> {
    // Run code-based checks first
    const codeBased = this.codeBasedGrader.grade(scenario, analysisOutput);

    // If code-based checks fail, skip LLM judge
    if (!codeBased.passed) {
      return {
        id: randomUUID(),
        scenarioId: scenario.id,
        timestamp: new Date().toISOString(),
        grades: { codeBased },
        overallScore: 0,
        passed: false,
      };
    }

    // Run LLM judge if enabled
    let llmJudge: LLMJudgeGrade | undefined;

    if (!this.options.skipLLMJudge) {
      const trulensResponse = await callTruLens(scenario, analysisOutput, this.options);

      if (trulensResponse && !trulensResponse.error) {
        llmJudge = {
          actionability: trulensResponse.scores.actionability,
          causalAccuracy: trulensResponse.scores.causalAccuracy,
          relevance: trulensResponse.scores.relevance,
          reasoning: trulensResponse.reasoning,
        };
      }
    }

    // Build grades object conditionally to satisfy exactOptionalPropertyTypes
    const grades: EvaluationGrades = { codeBased };
    if (llmJudge !== undefined) {
      grades.llmJudge = llmJudge;
    }

    // Calculate overall score
    const overallScore = calculateOverallScore(grades, scenario.rubricWeights);

    return {
      id: randomUUID(),
      scenarioId: scenario.id,
      timestamp: new Date().toISOString(),
      grades,
      overallScore,
      passed: overallScore >= EVAL_THRESHOLDS.PASS_THRESHOLD,
    };
  }

  /**
   * Evaluate all scenarios in a dataset.
   */
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
      averageScores: calculateAverageScores(results),
      results,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Check if evaluation passes the release gate.
   */
  checkReleaseGate(summary: EvaluationSummary): boolean {
    return summary.passRate >= EVAL_THRESHOLDS.PASS_THRESHOLD;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an evaluation runner with default options.
 */
export function createEvaluationRunner(options?: EvaluationRunnerOptions): EvaluationRunner {
  return new EvaluationRunner(options);
}

/**
 * Create an evaluation runner for testing (code-based only).
 */
export function createTestEvaluationRunner(): EvaluationRunner {
  return new EvaluationRunner({ skipLLMJudge: true });
}

// =============================================================================
// Exports
// =============================================================================

export default EvaluationRunner;
