#!/usr/bin/env bun
/**
 * EP11 Quality & Security - Evaluation Runner Script
 *
 * Bun script to orchestrate TruLens evaluations.
 * Called by CI for release gates.
 *
 * Usage:
 *   bun tests/evals/run-evals.ts --all-datasets --all --release-gate
 *   bun tests/evals/run-evals.ts --dataset temporal
 *
 * Options:
 *   --all-datasets       Run all evaluation datasets (temporal, behavioral)
 *   --dataset <name>     Run specific dataset (temporal)
 *   --all                Run all scenarios in dataset
 *   --scenario <name>    Run specific scenario
 *   --release-gate       Fail if thresholds not met (exit code 1)
 *   --json               Output JSON results
 *   --help               Show this help
 *
 * Environment:
 *   ANTHROPIC_API_KEY    Required for LLM-as-judge evaluations
 *   UV_PROJECT_ENVIRONMENT  Path to uv virtual environment (default: tests/evals/.venv)
 */

import { spawnSync } from 'bun';
import { existsSync } from 'fs';
import { join, dirname } from 'path';

// =============================================================================
// Constants
// =============================================================================

const EVALS_DIR = dirname(import.meta.path);
const PYTHON_RUNNER = join(EVALS_DIR, 'temporal/run.py');
const GOLDEN_DIR = join(EVALS_DIR, 'golden/temporal');
const THRESHOLD = 0.7;

// =============================================================================
// Argument Parsing
// =============================================================================

interface EvalOptions {
  allDatasets: boolean;
  dataset: string | null;
  all: boolean;
  scenario: string | null;
  releaseGate: boolean;
  json: boolean;
  help: boolean;
}

function parseArgs(): EvalOptions {
  const args = process.argv.slice(2);
  const options: EvalOptions = {
    allDatasets: false,
    dataset: null,
    all: false,
    scenario: null,
    releaseGate: false,
    json: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--all-datasets':
        options.allDatasets = true;
        break;
      case '--dataset':
        options.dataset = args[++i] ?? null;
        break;
      case '--all':
        options.all = true;
        break;
      case '--scenario':
        options.scenario = args[++i] ?? null;
        break;
      case '--release-gate':
        options.releaseGate = true;
        break;
      case '--json':
        options.json = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
    }
  }

  return options;
}

function showHelp(): void {
  console.log(`
EP11 Evaluation Runner

Usage:
  bun tests/evals/run-evals.ts [options]

Options:
  --all-datasets       Run all evaluation datasets
  --dataset <name>     Run specific dataset (temporal)
  --all                Run all scenarios in dataset
  --scenario <name>    Run specific scenario
  --release-gate       Fail if thresholds not met
  --json               Output JSON results
  --help, -h           Show this help

Examples:
  bun tests/evals/run-evals.ts --all-datasets --all --release-gate
  bun tests/evals/run-evals.ts --dataset temporal --all
  bun tests/evals/run-evals.ts --dataset temporal --scenario scenario-05

Environment:
  ANTHROPIC_API_KEY    Required for LLM-as-judge evaluations
`);
}

// =============================================================================
// Evaluation Runner
// =============================================================================

interface EvalResult {
  dataset: string;
  passed: boolean;
  overallScore: number;
  scores: Record<string, number>;
  failedMetrics: string[];
}

async function runTemporalEvals(options: EvalOptions): Promise<EvalResult> {
  console.log('Running temporal evaluations...');

  // Check if Python runner exists
  if (!existsSync(PYTHON_RUNNER)) {
    throw new Error(`Python runner not found: ${PYTHON_RUNNER}`);
  }

  // Check if golden dataset exists
  if (!existsSync(GOLDEN_DIR)) {
    throw new Error(`Golden dataset not found: ${GOLDEN_DIR}`);
  }

  // Build command
  const uvPath = process.env.UV_PROJECT_ENVIRONMENT
    ? join(process.env.UV_PROJECT_ENVIRONMENT, 'bin', 'python')
    : 'python';

  const args: string[] = [PYTHON_RUNNER, '--golden', GOLDEN_DIR, '--json'];

  if (options.all) {
    args.push('--all');
  }

  if (options.scenario) {
    args.push('--scenario', options.scenario);
  }

  // Run Python evaluation
  const result = spawnSync([uvPath, ...args], {
    cwd: EVALS_DIR,
    env: {
      ...process.env,
      // Use uv's environment
      VIRTUAL_ENV: process.env.UV_PROJECT_ENVIRONMENT ?? join(EVALS_DIR, '.venv'),
    },
  });

  if (result.exitCode !== 0 && result.exitCode !== 1) {
    const stderr = result.stderr.toString();
    throw new Error(`Evaluation failed with exit code ${result.exitCode}: ${stderr}`);
  }

  // Parse JSON output
  const stdout = result.stdout.toString();
  const jsonMatch = stdout.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error(`Failed to parse evaluation output: ${stdout}`);
  }

  const evalResult = JSON.parse(jsonMatch[0]) as {
    passed: boolean;
    overall_score: number;
    aggregate_scores: Record<string, number>;
    failed_metrics: string[];
  };

  return {
    dataset: 'temporal',
    passed: evalResult.passed,
    overallScore: evalResult.overall_score,
    scores: evalResult.aggregate_scores,
    failedMetrics: evalResult.failed_metrics,
  };
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  const results: EvalResult[] = [];
  let allPassed = true;

  try {
    // Currently only temporal dataset is implemented
    if (options.allDatasets || options.dataset === 'temporal' || !options.dataset) {
      const result = await runTemporalEvals(options);
      results.push(result);

      if (!result.passed) {
        allPassed = false;
      }
    }

    // Output results
    if (options.json) {
      console.log(JSON.stringify({ results, allPassed }, null, 2));
    } else {
      console.log('\n=== Evaluation Summary ===');

      for (const result of results) {
        console.log(`\nDataset: ${result.dataset}`);
        console.log(`  Overall Score: ${result.overallScore.toFixed(2)}`);
        console.log(`  Status: ${result.passed ? 'PASSED' : 'FAILED'}`);

        if (Object.keys(result.scores).length > 0) {
          console.log('  Scores:');
          for (const [metric, score] of Object.entries(result.scores)) {
            const status = score >= THRESHOLD ? 'PASS' : 'FAIL';
            console.log(`    ${metric}: ${score.toFixed(2)} (${status})`);
          }
        }

        if (result.failedMetrics.length > 0) {
          console.log(`  Failed Metrics: ${result.failedMetrics.join(', ')}`);
        }
      }

      console.log('\n=== Final Result ===');
      console.log(`All Datasets: ${allPassed ? 'PASSED' : 'FAILED'}`);
    }

    // Exit with appropriate code
    if (options.releaseGate && !allPassed) {
      console.error('\nRelease gate failed: evaluations below threshold');
      process.exit(1);
    }
  } catch (error) {
    console.error('Evaluation error:', error);
    process.exit(2);
  }
}

main();
