/**
 * TruLens Evaluation Runner
 *
 * Orchestrates TruLens evaluations from TypeScript by calling
 * the Python evaluation scripts as subprocesses per ADR-0011.
 *
 * Supports multiple golden datasets:
 * - temporal: EP09 temporal analysis evaluations
 * - recommendations: EP10 recommendation advisor evaluations
 *
 * Usage:
 *   bun run tests/evals/run-evals.ts
 *   bun run tests/evals/run-evals.ts --dataset temporal
 *   bun run tests/evals/run-evals.ts --dataset recommendations
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

interface DatasetConfig {
  pythonModule: string;
  goldenDatasetPath: string;
  displayName: string;
  thresholds: Record<string, number>;
}

// =============================================================================
// Configuration
// =============================================================================

const DATASETS: Record<string, DatasetConfig> = {
  temporal: {
    pythonModule: 'tests.evals.temporal.run',
    goldenDatasetPath: 'tests/evals/golden/temporal',
    displayName: 'TEMPORAL ANALYSIS EVALS',
    thresholds: {
      overall: 0.7,
      trend_accuracy: 0.7,
      review_quality: 0.7,
      recommendation_actionability: 0.7,
      causal_accuracy: 0.7,
      mixed_methods_alignment: 0.7,
    },
  },
  recommendations: {
    pythonModule: 'tests.evals.recommendations.run',
    goldenDatasetPath: 'tests/evals/golden/recommendations',
    displayName: 'RECOMMENDATION ADVISOR EVALS',
    thresholds: {
      overall: 0.7,
      recommendation_specificity: 0.7,
      recommendation_causal_trace: 0.7,
      recommendation_prioritization: 0.7,
      advisor_question_quality: 0.7,
    },
  },
};

const COMMON_CONFIG = {
  databasePath: '.agentlint/evals.db',
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
  dataset?: string;
  scenario?: string;
  all?: boolean;
  verbose?: boolean;
}): Promise<EvalResults> {
  const datasetName = options.dataset ?? 'temporal';
  const config = DATASETS[datasetName];

  if (!config) {
    throw new Error(
      `Unknown dataset: ${datasetName}. Available: ${Object.keys(DATASETS).join(', ')}`
    );
  }

  const args = [
    '--json',
    '--golden',
    config.goldenDatasetPath,
    '--database',
    COMMON_CONFIG.databasePath,
  ];

  if (options.scenario) {
    args.push('--scenario', options.scenario);
  }

  if (options.all) {
    args.push('--all');
  }

  const pythonCmd = `python -m ${config.pythonModule} ${args.join(' ')}`;

  if (options.verbose) {
    console.log(`Running: ${pythonCmd}`);
  }

  try {
    const result = await $`python -m ${config.pythonModule} ${args}`.text();
    return JSON.parse(result) as EvalResults;
  } catch (error) {
    // Try with python3 if python fails
    try {
      const result = await $`python3 -m ${config.pythonModule} ${args}`.text();
      return JSON.parse(result) as EvalResults;
    } catch {
      throw new Error(`Failed to run Python evaluations: ${String(error)}`);
    }
  }
}

/**
 * Run evaluations for all datasets.
 *
 * @param options - Evaluation options
 * @returns Combined results for all datasets
 */
async function runAllDatasets(options: {
  scenario?: string;
  all?: boolean;
  verbose?: boolean;
}): Promise<Map<string, EvalResults>> {
  const results = new Map<string, EvalResults>();

  for (const datasetName of Object.keys(DATASETS)) {
    try {
      const result = await runEvaluations({
        ...options,
        dataset: datasetName,
      });
      results.set(datasetName, result);
    } catch (error) {
      console.error(`Failed to run ${datasetName} evaluations:`, error);
    }
  }

  return results;
}

/**
 * Check if results meet release thresholds.
 *
 * @param results - Evaluation results
 * @param datasetName - Name of the dataset
 * @returns Whether all thresholds are met
 */
function checkReleaseThresholds(results: EvalResults, datasetName: string = 'temporal'): boolean {
  const config = DATASETS[datasetName];
  if (!config) {
    return false;
  }

  if (!results.passed) {
    return false;
  }

  const overallThreshold = config.thresholds.overall ?? 0.7;
  if (results.overall_score < overallThreshold) {
    return false;
  }

  return true;
}

/**
 * Print results summary to console.
 *
 * @param results - Evaluation results
 * @param datasetName - Name of the dataset
 */
function printResults(results: EvalResults, datasetName: string = 'temporal'): void {
  const config = DATASETS[datasetName];
  const displayName = config?.displayName ?? 'EVALUATIONS';

  const padding = Math.max(0, Math.floor((64 - displayName.length) / 2));
  const paddedName = ' '.repeat(padding) + displayName + ' '.repeat(padding);

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log(paddedName);
  console.log('════════════════════════════════════════════════════════════════\n');

  console.log(`TruLens Available: ${results.trulens_available ? 'Yes' : 'No (using stubs)'}`);
  console.log(`Scenarios Evaluated: ${Object.keys(results.scenarios).length}`);

  if (Object.keys(results.aggregate_scores).length > 0) {
    console.log('\nAggregate Scores:');
    for (const [name, score] of Object.entries(results.aggregate_scores)) {
      const threshold = config?.thresholds[name] ?? 0.7;
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
      dataset: { type: 'string', short: 'd' },
      scenario: { type: 'string', short: 's' },
      all: { type: 'boolean', short: 'a' },
      verbose: { type: 'boolean', short: 'v' },
      json: { type: 'boolean', short: 'j' },
      'release-gate': { type: 'boolean' },
      'all-datasets': { type: 'boolean' },
    },
    strict: false,
  });

  try {
    // Run all datasets if requested
    if (values['all-datasets']) {
      const runOptions: { scenario?: string; all?: boolean; verbose?: boolean } = {};
      if (typeof values.scenario === 'string') {
        runOptions.scenario = values.scenario;
      }
      if (typeof values.all === 'boolean') {
        runOptions.all = values.all;
      }
      if (typeof values.verbose === 'boolean') {
        runOptions.verbose = values.verbose;
      }
      const allResults = await runAllDatasets(runOptions);

      let allPassed = true;

      for (const [datasetName, results] of allResults) {
        if (values.json) {
          console.log(JSON.stringify({ dataset: datasetName, ...results }, null, 2));
        } else {
          printResults(results, datasetName);
        }

        if (values['release-gate']) {
          if (!checkReleaseThresholds(results, datasetName)) {
            allPassed = false;
          }
        }

        if (!results.passed) {
          allPassed = false;
        }
      }

      if (values['release-gate'] && !allPassed) {
        console.error('Release gate failed: evaluation thresholds not met');
        process.exit(1);
      }

      process.exit(allPassed ? 0 : 1);
      return;
    }

    // Run single dataset
    const evalOptions: {
      dataset?: string;
      scenario?: string;
      all?: boolean;
      verbose?: boolean;
    } = {};

    if (typeof values.dataset === 'string') {
      evalOptions.dataset = values.dataset;
    }
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
    const datasetName = evalOptions.dataset ?? 'temporal';

    if (values.json) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      printResults(results, datasetName);
    }

    // Release gate mode: exit with error if thresholds not met
    if (values['release-gate']) {
      if (!checkReleaseThresholds(results, datasetName)) {
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
export {
  runEvaluations,
  runAllDatasets,
  checkReleaseThresholds,
  printResults,
  DATASETS,
  type EvalResults,
  type DatasetConfig,
};
