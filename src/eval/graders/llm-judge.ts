/**
 * EP11 Quality & Security - LLM-as-Judge Grader
 *
 * LLM-based evaluation for qualitative metrics using TruLens subprocess.
 * Evaluates actionability, causal accuracy, and relevance of analysis outputs.
 *
 * @module eval/graders/llm-judge
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';
import type { GoldenScenario, LLMJudgeGrade, ILLMJudgeGrader } from '../types';

// =============================================================================
// Types
// =============================================================================

/**
 * TruLens subprocess response structure.
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
 * Configuration options for LLMJudgeGrader.
 */
export interface LLMJudgeGraderOptions {
  /** Path to TruLens runner script */
  runnerPath?: string;

  /** Working directory for TruLens (for uv) */
  workingDir?: string;

  /** Timeout for TruLens subprocess in ms (default: 60000) */
  timeoutMs?: number;

  /** Number of retry attempts on failure (default: 2) */
  retryCount?: number;

  /** Delay between retries in ms (default: 1000) */
  retryDelayMs?: number;

  /** Return default scores when TruLens unavailable instead of throwing */
  fallbackOnUnavailable?: boolean;
}

/**
 * Default scores returned when TruLens is unavailable and fallback is enabled.
 */
const DEFAULT_FALLBACK_SCORES: LLMJudgeGrade = {
  actionability: 0.5,
  causalAccuracy: 0.5,
  relevance: 0.5,
  reasoning: {
    actionability: 'TruLens unavailable - using default score',
    causalAccuracy: 'TruLens unavailable - using default score',
    relevance: 'TruLens unavailable - using default score',
  },
};

// =============================================================================
// LLMJudgeGrader Implementation
// =============================================================================

/**
 * LLM-as-judge grader using TruLens subprocess.
 *
 * Evaluates analysis outputs on three dimensions:
 * - Actionability: Are recommendations specific and implementable?
 * - Causal Accuracy: Do findings have accurate causal chains?
 * - Relevance: Are findings relevant to the input?
 *
 * @example
 * ```typescript
 * const grader = new LLMJudgeGrader({
 *   timeoutMs: 30000,
 *   retryCount: 3,
 * });
 *
 * const grade = await grader.grade(scenario, analysisOutput);
 * console.log(`Actionability: ${grade.actionability}`);
 * ```
 */
export class LLMJudgeGrader implements ILLMJudgeGrader {
  private readonly runnerPath: string;
  private readonly workingDir: string;
  private readonly timeoutMs: number;
  private readonly retryCount: number;
  private readonly retryDelayMs: number;
  private readonly fallbackOnUnavailable: boolean;

  constructor(options: LLMJudgeGraderOptions = {}) {
    this.runnerPath =
      options.runnerPath ??
      resolve(__dirname, '../../../tests/evals/trulens-runner.py');
    this.workingDir =
      options.workingDir ?? resolve(__dirname, '../../../tests/evals');
    this.timeoutMs = options.timeoutMs ?? 60000;
    this.retryCount = options.retryCount ?? 2;
    this.retryDelayMs = options.retryDelayMs ?? 1000;
    this.fallbackOnUnavailable = options.fallbackOnUnavailable ?? false;
  }

  /**
   * Grade analysis output using LLM-as-judge evaluation.
   *
   * @param scenario - The golden scenario being evaluated
   * @param output - The analysis output to evaluate
   * @returns LLM judge grade with scores and reasoning
   * @throws Error if TruLens is unavailable and fallback is disabled
   */
  async grade(scenario: GoldenScenario, output: unknown): Promise<LLMJudgeGrade> {
    // Check runner exists
    if (!existsSync(this.runnerPath)) {
      if (this.fallbackOnUnavailable) {
        return {
          ...DEFAULT_FALLBACK_SCORES,
          reasoning: {
            actionability: `TruLens runner not found at ${this.runnerPath}`,
            causalAccuracy: `TruLens runner not found at ${this.runnerPath}`,
            relevance: `TruLens runner not found at ${this.runnerPath}`,
          },
        };
      }
      throw new Error(`TruLens runner not found at ${this.runnerPath}`);
    }

    // Attempt evaluation with retries
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retryCount; attempt++) {
      try {
        const response = await this.callTruLens(scenario, output);

        if (response.error) {
          throw new Error(response.error);
        }

        return {
          actionability: response.scores.actionability,
          causalAccuracy: response.scores.causalAccuracy,
          relevance: response.scores.relevance,
          reasoning: response.reasoning,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on last attempt
        if (attempt < this.retryCount) {
          await this.delay(this.retryDelayMs);
        }
      }
    }

    // All retries failed
    if (this.fallbackOnUnavailable) {
      return {
        ...DEFAULT_FALLBACK_SCORES,
        reasoning: {
          actionability: `Evaluation failed after ${this.retryCount + 1} attempts: ${lastError?.message}`,
          causalAccuracy: `Evaluation failed after ${this.retryCount + 1} attempts: ${lastError?.message}`,
          relevance: `Evaluation failed after ${this.retryCount + 1} attempts: ${lastError?.message}`,
        },
      };
    }

    throw new Error(
      `LLM judge evaluation failed after ${this.retryCount + 1} attempts: ${lastError?.message}`
    );
  }

  /**
   * Check if TruLens is available.
   *
   * @returns True if TruLens runner exists and can be executed
   */
  async isAvailable(): Promise<boolean> {
    if (!existsSync(this.runnerPath)) {
      return false;
    }

    try {
      const result = await this.checkTruLens();
      return result.trulensAvailable;
    } catch {
      return false;
    }
  }

  /**
   * Check TruLens availability and configuration.
   *
   * @returns TruLens status including model info
   */
  async checkTruLens(): Promise<{ trulensAvailable: boolean; model: string | null }> {
    return new Promise((resolve, reject) => {
      const proc = spawn('uv', ['run', 'python', this.runnerPath, '--check'], {
        cwd: this.workingDir,
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
        reject(new Error('TruLens check timeout'));
      }, 10000);

      proc.on('close', (code) => {
        clearTimeout(timeout);

        if (code !== 0) {
          reject(new Error(`TruLens check failed with code ${code}: ${stderr}`));
          return;
        }

        try {
          const lines = stdout.trim().split('\n');
          const jsonLine = lines.find((line) => line.startsWith('{'));
          if (!jsonLine) {
            reject(new Error('No JSON output from TruLens check'));
            return;
          }
          resolve(JSON.parse(jsonLine) as { trulensAvailable: boolean; model: string | null });
        } catch (e) {
          reject(new Error(`Failed to parse TruLens check output: ${String(e)}`));
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  /**
   * Call the TruLens Python subprocess.
   */
  private async callTruLens(
    scenario: GoldenScenario,
    output: unknown
  ): Promise<TruLensResponse> {
    const request = JSON.stringify({ scenario, output });

    return new Promise((resolve, reject) => {
      const proc = spawn('uv', ['run', 'python', this.runnerPath, '-'], {
        cwd: this.workingDir,
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
        reject(new Error('TruLens evaluation timeout'));
      }, this.timeoutMs);

      proc.on('close', (code) => {
        clearTimeout(timeout);

        if (code !== 0) {
          reject(new Error(`TruLens exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          // Find the JSON line (skip bytecode compilation messages)
          const lines = stdout.trim().split('\n');
          const jsonLine = lines.find((line) => line.startsWith('{'));
          if (!jsonLine) {
            reject(new Error('No JSON output from TruLens'));
            return;
          }
          resolve(JSON.parse(jsonLine) as TruLensResponse);
        } catch (e) {
          reject(new Error(`Failed to parse TruLens output: ${String(e)}`));
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      // Write input to stdin
      proc.stdin.write(request);
      proc.stdin.end();
    });
  }

  /**
   * Simple delay helper for retries.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new LLMJudgeGrader instance with default options.
 */
export function createLLMJudgeGrader(
  options?: LLMJudgeGraderOptions
): LLMJudgeGrader {
  return new LLMJudgeGrader(options);
}

/**
 * Create a test LLMJudgeGrader that falls back to default scores.
 */
export function createTestLLMJudgeGrader(): LLMJudgeGrader {
  return new LLMJudgeGrader({
    fallbackOnUnavailable: true,
    retryCount: 0,
    timeoutMs: 5000,
  });
}

// =============================================================================
// Exports
// =============================================================================

export default LLMJudgeGrader;
