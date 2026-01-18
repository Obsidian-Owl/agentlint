/**
 * EP09 Temporal Analysis - Delta Summarizer
 *
 * Converts raw delta output into human-readable summaries with
 * trend indicators and improvement classification.
 *
 * @module temporal/delta/summarizer
 */

import type { Baseline } from '../../persistence/types';
import type { DeltaSummary, MetricChange, TrendIndicator, ThresholdConfig } from '../types';
import { isSignificantChange, isImprovement } from '../config';
import type { MetricsDelta } from './calculator';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for delta summarization.
 */
export interface SummarizerOptions {
  /** Threshold configuration */
  thresholds?: ThresholdConfig;
  /** Include zero-change metrics in output */
  includeUnchanged?: boolean;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Create a human-readable summary from a metrics delta.
 *
 * @param metricsDelta - The metrics delta from calculateDelta
 * @param from - Original baseline
 * @param to - Target baseline
 * @param options - Summarizer options
 * @returns Structured delta summary
 *
 * @example
 * ```typescript
 * const { delta, metricsDelta } = calculateDelta(from, to);
 * const summary = createDeltaSummary(metricsDelta, from, to);
 * console.log(summary.overallTrend); // 'improved' | 'regressed' | 'unchanged'
 * ```
 */
export function createDeltaSummary(
  metricsDelta: MetricsDelta | null,
  from: Baseline,
  to: Baseline,
  options: SummarizerOptions = {}
): DeltaSummary {
  const metricsChanged: MetricChange[] = [];
  const trendIndicators: TrendIndicator[] = [];

  // Process metrics changes
  if (metricsDelta !== null) {
    for (const change of metricsDelta.changed) {
      const metricChange = createMetricChange(
        change.name,
        change.from,
        change.to,
        options.thresholds
      );
      metricsChanged.push(metricChange);

      // Add trend indicator for significant changes
      if (isSignificantChange(change.from, change.to, change.name, options.thresholds)) {
        trendIndicators.push({
          metric: change.name,
          indicator: metricChange.direction,
          label: formatTrendLabel(change.name, metricChange),
        });
      }
    }
  }

  // Calculate warnings and recommendations
  const { warningsAdded, warningsResolved } = extractWarningChanges(from, to);
  const { recommendationsAdded, recommendationsResolved } = extractRecommendationChanges(from, to);

  // Determine overall trend
  const overallTrend = determineOverallTrend(metricsChanged, warningsAdded, warningsResolved);

  return {
    metricsChanged,
    warningsAdded,
    warningsResolved,
    recommendationsAdded,
    recommendationsResolved,
    trendIndicators,
    overallTrend,
  };
}

/**
 * Format a delta summary as human-readable text.
 *
 * @param summary - The delta summary
 * @returns Formatted text
 */
export function formatDeltaSummary(summary: DeltaSummary): string {
  const lines: string[] = [];

  // Overall trend header
  const trendEmoji =
    summary.overallTrend === 'improved' ? '📈' : summary.overallTrend === 'regressed' ? '📉' : '➡️';
  lines.push(`## Delta Summary ${trendEmoji}\n`);
  lines.push(`**Overall Trend**: ${capitalize(summary.overallTrend)}\n`);

  // Metrics changes
  if (summary.metricsChanged.length > 0) {
    lines.push(`### Metric Changes\n`);
    for (const change of summary.metricsChanged) {
      const changeStr =
        change.percentChange >= 0
          ? `+${change.percentChange.toFixed(1)}%`
          : `${change.percentChange.toFixed(1)}%`;
      const status = change.isImprovement ? '✓' : '⚠';
      lines.push(
        `- ${status} **${change.name}**: ${change.from} → ${change.to} (${change.direction} ${changeStr})`
      );
    }
    lines.push('');
  }

  // Warnings
  if (summary.warningsAdded.length > 0) {
    lines.push(`### New Warnings (${summary.warningsAdded.length})\n`);
    for (const warning of summary.warningsAdded) {
      lines.push(`- ⚠️ ${warning}`);
    }
    lines.push('');
  }

  if (summary.warningsResolved.length > 0) {
    lines.push(`### Resolved Warnings (${summary.warningsResolved.length})\n`);
    for (const warning of summary.warningsResolved) {
      lines.push(`- ✅ ${warning}`);
    }
    lines.push('');
  }

  // Recommendations
  if (summary.recommendationsAdded.length > 0) {
    lines.push(`### New Recommendations (${summary.recommendationsAdded.length})\n`);
    for (const rec of summary.recommendationsAdded) {
      lines.push(`- 💡 ${rec}`);
    }
    lines.push('');
  }

  if (summary.recommendationsResolved.length > 0) {
    lines.push(`### Addressed Recommendations (${summary.recommendationsResolved.length})\n`);
    for (const rec of summary.recommendationsResolved) {
      lines.push(`- ✓ ${rec}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Create a MetricChange object with trend information.
 */
function createMetricChange(
  name: string,
  from: number,
  to: number,
  thresholds?: ThresholdConfig
): MetricChange {
  const change = to - from;
  const percentChange = from !== 0 ? ((to - from) / from) * 100 : to !== 0 ? 100 : 0;

  // Determine direction
  let direction: '↑' | '↓' | '→';
  if (Math.abs(change) < 0.001) {
    direction = '→';
  } else if (change > 0) {
    direction = '↑';
  } else {
    direction = '↓';
  }

  // Check if this is an improvement
  const improvement = isImprovement(from, to, name, thresholds);

  return {
    name,
    from,
    to,
    change,
    percentChange,
    direction,
    isImprovement: improvement,
  };
}

/**
 * Format a trend label for display.
 */
function formatTrendLabel(metricName: string, change: MetricChange): string {
  const direction = change.change > 0 ? 'increased' : 'decreased';
  const amount = Math.abs(change.percentChange).toFixed(1);
  return `${metricName} ${direction} by ${amount}%`;
}

/**
 * Extract warning changes between baselines.
 */
function extractWarningChanges(
  from: Baseline,
  to: Baseline
): { warningsAdded: string[]; warningsResolved: string[] } {
  // In the full implementation, this would analyze findings
  // For now, return empty arrays as a placeholder
  const warningsAdded: string[] = [];
  const warningsResolved: string[] = [];

  // Compare warning counts as a simple heuristic
  const fromWarnings = from.metrics.warningCount ?? 0;
  const toWarnings = to.metrics.warningCount ?? 0;

  if (toWarnings > fromWarnings) {
    warningsAdded.push(`${toWarnings - fromWarnings} new warning(s) detected`);
  } else if (toWarnings < fromWarnings) {
    warningsResolved.push(`${fromWarnings - toWarnings} warning(s) resolved`);
  }

  return { warningsAdded, warningsResolved };
}

/**
 * Extract recommendation changes between baselines.
 */
function extractRecommendationChanges(
  from: Baseline,
  to: Baseline
): { recommendationsAdded: string[]; recommendationsResolved: string[] } {
  const recommendationsAdded: string[] = [];
  const recommendationsResolved: string[] = [];

  // Get recommendation IDs from findings
  const fromRecs = new Set(from.findings.flatMap((f) => f.recommendations).map((r) => r.action));
  const toRecs = new Set(to.findings.flatMap((f) => f.recommendations).map((r) => r.action));

  // Find added recommendations
  for (const rec of toRecs) {
    if (!fromRecs.has(rec)) {
      recommendationsAdded.push(rec);
    }
  }

  // Find resolved recommendations
  for (const rec of fromRecs) {
    if (!toRecs.has(rec)) {
      recommendationsResolved.push(rec);
    }
  }

  return { recommendationsAdded, recommendationsResolved };
}

/**
 * Determine the overall trend based on all changes.
 */
function determineOverallTrend(
  metricsChanged: MetricChange[],
  warningsAdded: string[],
  warningsResolved: string[]
): 'improved' | 'regressed' | 'unchanged' {
  // Count improvements and regressions
  let improvements = 0;
  let regressions = 0;

  for (const change of metricsChanged) {
    if (change.isImprovement) {
      improvements++;
    } else if (change.direction !== '→') {
      regressions++;
    }
  }

  // Factor in warnings
  improvements += warningsResolved.length;
  regressions += warningsAdded.length;

  // Determine overall trend
  if (improvements > regressions) {
    return 'improved';
  } else if (regressions > improvements) {
    return 'regressed';
  }
  return 'unchanged';
}

/**
 * Capitalize first letter of a string.
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
