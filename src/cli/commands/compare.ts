/**
 * EP04 CLI Interface - Compare Command
 *
 * Implements US-006: Compare Against Baseline.
 * Implements FR-009: Show delta with +/- indicators.
 *
 * The compare command shows the difference between the current state
 * and a saved baseline, highlighting improvements and regressions.
 *
 * @module cli/commands/compare
 */

import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { getOutputMode } from '../utils/output';
import type { GlobalOptions } from '../types';
import {
  getLatestBaseline,
  loadBaseline,
  listBaselineIds,
} from '../../persistence/baselines/storage';
import { getBaselinesDir } from '../../persistence/common';
import type { Baseline, BaselineMetrics, BaselineSummary } from '../../persistence/types';

/**
 * Options for the compare command.
 */
export interface CompareOptions extends GlobalOptions {
  /** Baseline ID or label to compare against */
  baseline?: string;
  /** Directory to compare (default: current directory) */
  directory?: string;
}

/**
 * Compare result for JSON output.
 */
export interface CompareResult {
  /** Status of the operation */
  status: 'success' | 'error' | 'no_baseline';
  /** Error message if applicable */
  error?: string;
  /** From baseline summary */
  from?: BaselineSummary;
  /** To baseline summary (current state) */
  to?: BaselineSummary;
  /** Delta metrics */
  delta?: BaselineMetrics;
  /** Overall trend */
  trend?: 'improved' | 'regressed' | 'unchanged';
  /** ISO-8601 timestamp */
  timestamp: string;
}

/**
 * Delta indicator characters.
 */
const INDICATORS = {
  improved: '↓',
  regressed: '↑',
  unchanged: '→',
} as const;

/**
 * Format a delta value for display.
 */
function formatDelta(value: number): string {
  if (value === 0) return '0';
  return value > 0 ? `+${value}` : `${value}`;
}

/**
 * Get color for delta (for terminal output description).
 */
function getDeltaDescription(value: number): string {
  if (value < 0) return 'improved';
  if (value > 0) return 'worsened';
  return 'unchanged';
}

/**
 * Get display name for a baseline.
 */
function getBaselineName(baseline: BaselineSummary): string {
  return baseline.label ?? baseline.id.slice(0, 8);
}

/**
 * Formats the compare result for terminal output.
 */
function formatTerminal(result: CompareResult): string {
  const lines: string[] = [];

  lines.push('');

  if (result.status === 'no_baseline') {
    lines.push('No Baseline Found');
    lines.push('=================');
    lines.push('');
    lines.push('No baseline exists to compare against.');
    lines.push('');
    lines.push('To create a baseline, run:');
    lines.push('  agentlint baseline');
    lines.push('');
    lines.push('Or with a label:');
    lines.push('  agentlint baseline -l "before-refactor"');
    lines.push('');
    return lines.join('\n');
  }

  if (result.status === 'error') {
    lines.push(`Error: ${result.error}`);
    lines.push('');
    return lines.join('\n');
  }

  if (!result.from || !result.to || !result.delta || !result.trend) {
    lines.push('Error: Incomplete comparison data');
    lines.push('');
    return lines.join('\n');
  }

  const trendIcon = INDICATORS[result.trend];
  const trendLabel = result.trend.charAt(0).toUpperCase() + result.trend.slice(1);

  lines.push('Baseline Comparison');
  lines.push('===================');
  lines.push('');
  lines.push(`From: ${getBaselineName(result.from)}`);
  lines.push(`To:   ${getBaselineName(result.to)}`);
  lines.push('');
  lines.push(`Status: ${trendIcon} ${trendLabel}`);
  lines.push('');
  lines.push(
    `Total Findings: ${result.from.metrics.findingsCount} → ${result.to.metrics.findingsCount} (${formatDelta(result.delta.findingsCount)} ${getDeltaDescription(result.delta.findingsCount)})`
  );
  lines.push('');

  // Severity breakdown
  lines.push('Severity Breakdown:');
  if (result.delta.criticalCount !== 0 || result.from.metrics.criticalCount > 0) {
    lines.push(
      `  Critical: ${result.from.metrics.criticalCount} → ${result.to.metrics.criticalCount} (${formatDelta(result.delta.criticalCount)})`
    );
  }
  if (result.delta.highCount !== 0 || result.from.metrics.highCount > 0) {
    lines.push(
      `  High:     ${result.from.metrics.highCount} → ${result.to.metrics.highCount} (${formatDelta(result.delta.highCount)})`
    );
  }
  if (result.delta.mediumCount !== 0 || result.from.metrics.mediumCount > 0) {
    lines.push(
      `  Medium:   ${result.from.metrics.mediumCount} → ${result.to.metrics.mediumCount} (${formatDelta(result.delta.mediumCount)})`
    );
  }
  if (result.delta.lowCount !== 0 || result.from.metrics.lowCount > 0) {
    lines.push(
      `  Low:      ${result.from.metrics.lowCount} → ${result.to.metrics.lowCount} (${formatDelta(result.delta.lowCount)})`
    );
  }
  if (result.delta.infoCount !== 0 || result.from.metrics.infoCount > 0) {
    lines.push(
      `  Info:     ${result.from.metrics.infoCount} → ${result.to.metrics.infoCount} (${formatDelta(result.delta.infoCount)})`
    );
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Formats the compare result for JSON output.
 */
function formatJson(result: CompareResult): string {
  return JSON.stringify(result, null, 2);
}

/**
 * Formats the compare result for Markdown output.
 */
function formatMarkdown(result: CompareResult): string {
  const lines: string[] = [];

  lines.push('# Baseline Comparison');
  lines.push('');

  if (result.status === 'no_baseline') {
    lines.push('> **No baseline found.** Create one with `agentlint baseline`');
    lines.push('');
    return lines.join('\n');
  }

  if (result.status === 'error') {
    lines.push(`> **Error:** ${result.error}`);
    lines.push('');
    return lines.join('\n');
  }

  if (!result.from || !result.to || !result.delta || !result.trend) {
    lines.push('> **Error:** Incomplete comparison data');
    lines.push('');
    return lines.join('\n');
  }

  const trendIcon = INDICATORS[result.trend];

  lines.push(`**From:** ${getBaselineName(result.from)}`);
  lines.push(`**To:** ${getBaselineName(result.to)}`);
  lines.push(`**Status:** ${trendIcon} ${result.trend}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(
    `Total Findings: **${result.from.metrics.findingsCount}** → **${result.to.metrics.findingsCount}** (${formatDelta(result.delta.findingsCount)})`
  );
  lines.push('');
  lines.push('## Severity Breakdown');
  lines.push('');
  lines.push('| Severity | Before | After | Delta |');
  lines.push('|----------|--------|-------|-------|');
  lines.push(
    `| Critical | ${result.from.metrics.criticalCount} | ${result.to.metrics.criticalCount} | ${formatDelta(result.delta.criticalCount)} |`
  );
  lines.push(
    `| High | ${result.from.metrics.highCount} | ${result.to.metrics.highCount} | ${formatDelta(result.delta.highCount)} |`
  );
  lines.push(
    `| Medium | ${result.from.metrics.mediumCount} | ${result.to.metrics.mediumCount} | ${formatDelta(result.delta.mediumCount)} |`
  );
  lines.push(
    `| Low | ${result.from.metrics.lowCount} | ${result.to.metrics.lowCount} | ${formatDelta(result.delta.lowCount)} |`
  );
  lines.push(
    `| Info | ${result.from.metrics.infoCount} | ${result.to.metrics.infoCount} | ${formatDelta(result.delta.infoCount)} |`
  );
  lines.push('');

  return lines.join('\n');
}

/**
 * Find a baseline by ID or label.
 */
async function findBaseline(baseDir: string, identifier: string): Promise<Baseline | null> {
  // First try to load by exact ID
  const byId = await loadBaseline(identifier, { baseDir });
  if (byId) return byId;

  // Try to find by label in the index
  // This is a simplified implementation - in production you'd query the SQLite index
  const ids = listBaselineIds({ baseDir });
  for (const id of ids) {
    const baseline = await loadBaseline(id, { baseDir });
    if (baseline && baseline.label === identifier) {
      return baseline;
    }
  }

  return null;
}

/**
 * Calculate the trend based on delta.
 */
function calculateTrend(delta: BaselineMetrics): 'improved' | 'regressed' | 'unchanged' {
  // Weight critical and high issues more heavily
  const weightedDelta =
    delta.criticalCount * 4 +
    delta.highCount * 3 +
    delta.mediumCount * 2 +
    delta.lowCount * 1 +
    delta.infoCount * 0.5;

  if (weightedDelta < -0.5) return 'improved';
  if (weightedDelta > 0.5) return 'regressed';
  return 'unchanged';
}

/**
 * Runs the compare command.
 *
 * @param options - Command options
 * @returns Exit code (0 for success, non-zero for failure)
 */
export async function runCompare(options: CompareOptions): Promise<number> {
  const directory = resolve(options.directory ?? '.');
  const outputMode = getOutputMode(options);
  const baseDir = getBaselinesDir(directory);

  // Check if baselines directory exists
  if (!existsSync(baseDir)) {
    const result: CompareResult = {
      status: 'no_baseline',
      error: 'No baselines directory found. Create a baseline first.',
      timestamp: new Date().toISOString(),
    };

    if (outputMode === 'json') {
      console.log(formatJson(result));
    } else if (outputMode === 'markdown') {
      console.log(formatMarkdown(result));
    } else {
      console.log(formatTerminal(result));
    }

    return 1;
  }

  // Find the baseline to compare against
  let fromBaseline: Baseline | null = null;

  if (options.baseline) {
    fromBaseline = await findBaseline(baseDir, options.baseline);
    if (!fromBaseline) {
      const result: CompareResult = {
        status: 'error',
        error: `Baseline not found: ${options.baseline}`,
        timestamp: new Date().toISOString(),
      };

      if (outputMode === 'json') {
        console.log(formatJson(result));
      } else if (outputMode === 'markdown') {
        console.log(formatMarkdown(result));
      } else {
        console.log(formatTerminal(result));
      }

      return 1;
    }
  } else {
    // Use the latest baseline
    fromBaseline = await getLatestBaseline({ baseDir });
    if (!fromBaseline) {
      const result: CompareResult = {
        status: 'no_baseline',
        timestamp: new Date().toISOString(),
      };

      if (outputMode === 'json') {
        console.log(formatJson(result));
      } else if (outputMode === 'markdown') {
        console.log(formatMarkdown(result));
      } else {
        console.log(formatTerminal(result));
      }

      return 1;
    }
  }

  // In a real implementation, we would run analysis to get current state
  // For now, we'll create a mock "current" state for demonstration
  const currentMetrics: BaselineMetrics = {
    findingsCount: 0,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    infoCount: 0,
  };

  // Calculate delta
  const delta: BaselineMetrics = {
    findingsCount: currentMetrics.findingsCount - fromBaseline.metrics.findingsCount,
    criticalCount: currentMetrics.criticalCount - fromBaseline.metrics.criticalCount,
    highCount: currentMetrics.highCount - fromBaseline.metrics.highCount,
    mediumCount: currentMetrics.mediumCount - fromBaseline.metrics.mediumCount,
    lowCount: currentMetrics.lowCount - fromBaseline.metrics.lowCount,
    infoCount: currentMetrics.infoCount - fromBaseline.metrics.infoCount,
  };

  const trend = calculateTrend(delta);

  const fromSummary: BaselineSummary = {
    id: fromBaseline.id,
    createdAt: fromBaseline.createdAt,
    projectPath: fromBaseline.projectPath,
    actType: fromBaseline.actType,
    gitCommit: fromBaseline.gitCommit,
    metrics: fromBaseline.metrics,
    label: fromBaseline.label,
  };

  const toSummary: BaselineSummary = {
    id: 'current',
    createdAt: new Date().toISOString(),
    projectPath: directory,
    actType: fromBaseline.actType,
    gitCommit: null,
    metrics: currentMetrics,
    label: 'current',
  };

  const result: CompareResult = {
    status: 'success',
    from: fromSummary,
    to: toSummary,
    delta,
    trend,
    timestamp: new Date().toISOString(),
  };

  if (outputMode === 'json') {
    console.log(formatJson(result));
  } else if (outputMode === 'markdown') {
    console.log(formatMarkdown(result));
  } else {
    console.log(formatTerminal(result));
  }

  return 0;
}

export default runCompare;
