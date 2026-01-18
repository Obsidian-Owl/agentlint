/**
 * EP09 Temporal Analysis - TruLens Evaluation Runner
 *
 * Orchestrates TruLens evaluations from TypeScript by calling
 * the Python evaluation scripts as subprocesses per ADR-0011.
 *
 * Usage:
 *   bun run tests/evals/run-evals.ts
 *   bun run tests/evals/run-evals.ts --scenario trend-detection
 *   bun run tests/evals/run-evals.ts --all
 *
 * @module tests/evals/run-evals
 */

import { $ } from 'bun';
import { parseArgs } from 'node:util';

// =============================================================================
// Types
// =============================================================================

interface EvalResults {
  trulens_available: boolean;
  scenarios: Record<
    string,
    {
      scores: Record<string, number>;
      overall: number;
      passed: boolean;
    }
  >;
  aggregate_scores: Record<string, number>;
  overall_score: number;
  passed: boolean;
  failed_metrics: string[];
}

// =============================================================================
// Configuration
// =============================================================================

const EVAL_CONFIG = {
  pythonModule: 'tests.evals.temporal.run',
  goldenDatasetPath: 'tests/evals/golden/temporal',
  databasePath: '.agentlint/evals.db',
  thresholds: {
    overall: 0.7,
    trend_accuracy: 0.7,
    review_quality: 0.7,
    recommendation_actionability: 0.7,
    causal_accuracy: 0.7,
    mixed_methods_alignment: 0.7,
  },
};

// =============================================================================
// Main Functions
// =============================================================================

/**
 * Run TruLens evaluations via Python subprocess.
 *
 * @param options - Evaluation options
 * @returns Evaluation results
 */
async function runEvaluations(options: {
  scenario?: string;
  all?: boolean;
  verbose?: boolean;
}): Promise<EvalResults> {
  const args = [
    '--json',
    '--golden',
    EVAL_CONFIG.goldenDatasetPath,
    '--database',
    EVAL_CONFIG.databasePath,
  ];

  if (options.scenario) {
    args.push('--scenario', options.scenario);
  }

  if (options.all) {
    args.push('--all');
  }

  const pythonCmd = `python -m ${EVAL_CONFIG.pythonModule} ${args.join(' ')}`;

  if (options.verbose) {
    console.log(`Running: ${pythonCmd}`);
  }

  try {
    const result = await $`python -m ${EVAL_CONFIG.pythonModule} ${args}`.text();
    return JSON.parse(result) as EvalResults;
  } catch (error) {
    // Try with python3 if python fails
    try {
      const result = await $`python3 -m ${EVAL_CONFIG.pythonModule} ${args}`.text();
      return JSON.parse(result) as EvalResults;
    } catch {
      throw new Error(`Failed to run Python evaluations: ${String(error)}`);
    }
  }
}

/**
 * Check if results meet release thresholds.
 *
 * @param results - Evaluation results
 * @returns Whether all thresholds are met
 */
function checkReleaseThresholds(results: EvalResults): boolean {
  if (!results.passed) {
    return false;
  }

  if (results.overall_score < EVAL_CONFIG.thresholds.overall) {
    return false;
  }

  return true;
}

/**
 * Print results summary to console.
 *
 * @param results - Evaluation results
 */
function printResults(results: EvalResults): void {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('                    TEMPORAL ANALYSIS EVALS                       ');
  console.log('════════════════════════════════════════════════════════════════\n');

  console.log(`TruLens Available: ${results.trulens_available ? 'Yes' : 'No (using stubs)'}`);
  console.log(`Scenarios Evaluated: ${Object.keys(results.scenarios).length}`);

  if (Object.keys(results.aggregate_scores).length > 0) {
    console.log('\nAggregate Scores:');
    for (const [name, score] of Object.entries(results.aggregate_scores)) {
      const threshold = EVAL_CONFIG.thresholds[name as keyof typeof EVAL_CONFIG.thresholds] ?? 0.7;
      const status = score >= threshold ? '✓' : '✗';
      console.log(`  ${status} ${name}: ${score.toFixed(2)} (threshold: ${threshold})`);
    }

    console.log(`\nOverall Score: ${results.overall_score.toFixed(2)}`);
  }

  console.log('\n────────────────────────────────────────────────────────────────');

  if (results.passed) {
    console.log('                          ✓ PASSED                             ');
  } else {
    console.log('                          ✗ FAILED                             ');
    console.log(`  Failed: ${results.failed_metrics.join(', ')}`);
  }

  console.log('────────────────────────────────────────────────────────────────\n');
}

// =============================================================================
// CLI Entry Point
// =============================================================================

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      scenario: { type: 'string', short: 's' },
      all: { type: 'boolean', short: 'a' },
      verbose: { type: 'boolean', short: 'v' },
      json: { type: 'boolean', short: 'j' },
      'release-gate': { type: 'boolean' },
    },
    strict: false,
  });

  try {
    const evalOptions: { scenario?: string; all?: boolean; verbose?: boolean } = {};
    if (typeof values.scenario === 'string') {
      evalOptions.scenario = values.scenario;
    }
    if (typeof values.all === 'boolean') {
      evalOptions.all = values.all;
    }
    if (typeof values.verbose === 'boolean') {
      evalOptions.verbose = values.verbose;
    }
    const results = await runEvaluations(evalOptions);

    if (values.json) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      printResults(results);
    }

    // Release gate mode: exit with error if thresholds not met
    if (values['release-gate']) {
      if (!checkReleaseThresholds(results)) {
        console.error('Release gate failed: evaluation thresholds not met');
        process.exit(1);
      }
    }

    // Exit with appropriate code
    process.exit(results.passed ? 0 : 1);
  } catch (error) {
    console.error('Evaluation error:', error);
    process.exit(2);
  }
}

// Run if executed directly
if (import.meta.main) {
  main().catch(console.error);
}

// Export for programmatic use
export { runEvaluations, checkReleaseThresholds, printResults, type EvalResults };
