/**
 * EP04 CLI Interface - Baseline Command
 *
 * Implements US-006: Compare Against Baseline.
 *
 * The baseline command captures a point-in-time snapshot of analysis results
 * that can be used for later comparison to track improvement over time.
 *
 * @module cli/commands/baseline
 */

import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getOutputMode } from '../utils/output';
import type { GlobalOptions } from '../types';
import { scanForConfigs } from './scan';
import { saveBaseline } from '../../persistence/baselines/storage';
import { getBaselinesDir } from '../../persistence/common';
import type { Baseline, BaselineMetrics } from '../../persistence/types';

/**
 * Options for the baseline command.
 */
export interface BaselineOptions extends GlobalOptions {
  /** User-assigned label for the baseline */
  label?: string;
  /** User notes about the baseline */
  notes?: string;
  /** Directory to capture baseline for (default: current directory) */
  directory?: string;
}

/**
 * Baseline capture result for JSON output.
 */
export interface BaselineResult {
  /** Status of the operation */
  status: 'success' | 'error';
  /** Error message if status is 'error' */
  error?: string;
  /** ID of the created baseline */
  baselineId?: string;
  /** Label if provided */
  label?: string | null;
  /** ISO-8601 timestamp */
  timestamp: string;
  /** Summary metrics */
  metrics?: BaselineMetrics;
}

/**
 * Get current git commit hash (if in a git repo).
 */
async function getGitCommit(directory: string): Promise<string | null> {
  try {
    const proc = Bun.spawn(['git', 'rev-parse', 'HEAD'], {
      cwd: directory,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    if (exitCode === 0) {
      return stdout.trim();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Formats the baseline result for terminal output.
 */
function formatTerminal(result: BaselineResult): string {
  const lines: string[] = [];

  lines.push('');

  if (result.status === 'error') {
    lines.push(`Error: ${result.error}`);
    lines.push('');
    return lines.join('\n');
  }

  lines.push('Baseline Captured');
  lines.push('=================');
  lines.push('');
  lines.push(`ID: ${result.baselineId}`);

  if (result.label) {
    lines.push(`Label: ${result.label}`);
  }

  if (result.metrics) {
    lines.push('');
    lines.push('Metrics:');
    lines.push(`  Total Findings: ${result.metrics.findingsCount}`);
    if (result.metrics.criticalCount > 0) {
      lines.push(`  Critical: ${result.metrics.criticalCount}`);
    }
    if (result.metrics.highCount > 0) {
      lines.push(`  High: ${result.metrics.highCount}`);
    }
    if (result.metrics.mediumCount > 0) {
      lines.push(`  Medium: ${result.metrics.mediumCount}`);
    }
    if (result.metrics.lowCount > 0) {
      lines.push(`  Low: ${result.metrics.lowCount}`);
    }
    if (result.metrics.infoCount > 0) {
      lines.push(`  Info: ${result.metrics.infoCount}`);
    }
  }

  lines.push('');
  lines.push('To compare against this baseline later:');
  lines.push(`  agentlint compare -b ${result.label ?? result.baselineId}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Formats the baseline result for JSON output.
 */
function formatJson(result: BaselineResult): string {
  return JSON.stringify(result, null, 2);
}

/**
 * Runs the baseline command.
 *
 * @param options - Command options
 * @returns Exit code (0 for success, non-zero for failure)
 */
export async function runBaseline(options: BaselineOptions): Promise<number> {
  const directory = resolve(options.directory ?? '.');
  const outputMode = getOutputMode(options);

  // Scan for configs to get the config path
  const scanResult = await scanForConfigs(directory);

  // Get git commit
  const gitCommit = await getGitCommit(directory);

  // Create baseline with empty findings (in a real implementation,
  // this would come from running the analysis)
  const baselineId = randomUUID();
  const firstConfig = scanResult.configs[0];
  const configPath = firstConfig?.path ?? null;
  const actType = firstConfig?.type ?? 'unknown';

  // In a real implementation, these would come from running analysis
  const metrics: BaselineMetrics = {
    findingsCount: 0,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    infoCount: 0,
  };

  const baseline: Baseline = {
    id: baselineId,
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    projectPath: directory,
    actType,
    configPath,
    gitCommit,
    metrics,
    findings: [],
    label: options.label ?? null,
    notes: options.notes ?? null,
  };

  // Save the baseline
  try {
    const baseDir = getBaselinesDir(directory);
    await saveBaseline(baseline, { baseDir });

    const result: BaselineResult = {
      status: 'success',
      baselineId,
      label: options.label ?? null,
      timestamp: baseline.createdAt,
      metrics,
    };

    if (outputMode === 'json') {
      console.log(formatJson(result));
    } else {
      console.log(formatTerminal(result));
    }

    return 0;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const result: BaselineResult = {
      status: 'error',
      error: errorMessage,
      timestamp: new Date().toISOString(),
    };

    if (outputMode === 'json') {
      console.log(formatJson(result));
    } else {
      console.error(`Error: ${errorMessage}`);
    }

    return 1;
  }
}

export default runBaseline;
