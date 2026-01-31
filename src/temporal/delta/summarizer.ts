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
import { isSignificantChange } from '../config';
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
 * Per ADR-0019, returns raw change counts. The agent interprets
 * whether the overall trend is "improved" or "regressed".
 *
 * @param metricsDelta - The metrics delta from calculateDelta
 * @param from - Original baseline
 * @param to - Target baseline
 * @param options - Summarizer options
 * @returns Structured delta summary with change counts
 *
 * @example
 * ```typescript
 * const { delta, metricsDelta } = calculateDelta(from, to);
 * const summary = createDeltaSummary(metricsDelta, from, to);
 * // Agent interprets: "3 increased, 2 decreased, 1 unchanged"
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

  // Count changes by direction
  let increased = 0;
  let decreased = 0;
  let unchanged = 0;

  // Process metrics changes
  if (metricsDelta !== null) {
    for (const change of metricsDelta.changed) {
      const metricChange = createMetricChange(change.name, change.from, change.to);
      metricsChanged.push(metricChange);

      // Count by direction
      if (metricChange.direction === '↑') {
        increased++;
      } else if (metricChange.direction === '↓') {
        decreased++;
      } else {
        unchanged++;
      }

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

  return {
    metricsChanged,
    warningsAdded,
    warningsResolved,
    recommendationsAdded,
    recommendationsResolved,
    trendIndicators,
    changeCounts: { increased, decreased, unchanged },
  };
}

/**
 * Format a delta summary as human-readable text.
 *
 * Per ADR-0019, presents data without judgment. The agent interprets
 * whether the overall trend is positive or negative.
 *
 * @param summary - The delta summary
 * @returns Formatted text
 */
export function formatDeltaSummary(summary: DeltaSummary): string {
  const lines: string[] = [];

  // Change counts header
  const { increased, decreased, unchanged } = summary.changeCounts;
  lines.push(`## Delta Summary\n`);
  lines.push(
    `**Changes**: ${increased} ↑ increased, ${decreased} ↓ decreased, ${unchanged} → unchanged\n`
  );

  // Metrics changes
  if (summary.metricsChanged.length > 0) {
    lines.push(`### Metric Changes\n`);
    for (const change of summary.metricsChanged) {
      const changeStr =
        change.percentChange >= 0
          ? `+${change.percentChange.toFixed(1)}%`
          : `${change.percentChange.toFixed(1)}%`;
      lines.push(
        `- **${change.name}**: ${change.from} → ${change.to} (${change.direction} ${changeStr})`
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
 *
 * Per ADR-0019, returns raw direction without judgment about
 * whether it's an improvement. Agent interprets based on context.
 */
function createMetricChange(name: string, from: number, to: number): MetricChange {
  const change = to - from;
  const percentChange = from !== 0 ? ((to - from) / from) * 100 : to !== 0 ? 100 : 0;

  // Determine direction (raw change direction, not interpretation)
  let direction: '↑' | '↓' | '→';
  if (Math.abs(change) < 0.001) {
    direction = '→';
  } else if (change > 0) {
    direction = '↑';
  } else {
    direction = '↓';
  }

  return {
    name,
    from,
    to,
    change,
    percentChange,
    direction,
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
 *
 * Strategy:
 * 1. If findings contain low/medium severity items, analyze those by title
 * 2. Otherwise, fall back to warningCount metric for a summary
 */
function extractWarningChanges(
  from: Baseline,
  to: Baseline
): { warningsAdded: string[]; warningsResolved: string[] } {
  const warningsAdded: string[] = [];
  const warningsResolved: string[] = [];

  // Extract warnings (low + medium severity findings)
  const fromWarnings = new Map(
    from.findings
      .filter((f) => f.severity === 'low' || f.severity === 'medium')
      .map((f) => [f.title, f])
  );

  const toWarnings = new Map(
    to.findings
      .filter((f) => f.severity === 'low' || f.severity === 'medium')
      .map((f) => [f.title, f])
  );

  // If we have actual findings to analyze, use those
  if (fromWarnings.size > 0 || toWarnings.size > 0) {
    // Find added warnings (in 'to' but not in 'from')
    for (const [title, finding] of toWarnings) {
      if (!fromWarnings.has(title)) {
        const location = finding.location ? ` (${finding.location.file})` : '';
        warningsAdded.push(`${title}${location}`);
      }
    }

    // Find resolved warnings (in 'from' but not in 'to')
    for (const [title, finding] of fromWarnings) {
      if (!toWarnings.has(title)) {
        const location = finding.location ? ` (${finding.location.file})` : '';
        warningsResolved.push(`${title}${location}`);
      }
    }
  } else {
    // Fall back to warningCount metric for summary
    const fromWarningCount = from.metrics.warningCount ?? 0;
    const toWarningCount = to.metrics.warningCount ?? 0;

    if (toWarningCount > fromWarningCount) {
      warningsAdded.push(`${toWarningCount - fromWarningCount} new warning(s) detected`);
    } else if (toWarningCount < fromWarningCount) {
      warningsResolved.push(`${fromWarningCount - toWarningCount} warning(s) resolved`);
    }
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

// =============================================================================
// Note: determineOverallTrend() was removed per ADR-0019
// =============================================================================
//
// The determineOverallTrend() function was removed because determining
// whether changes represent overall "improvement" or "regression" is
// a JUDGMENT call that should be made by the agent, not tool code.
//
// The agent interprets change counts based on:
// - Metric semantics (which metrics matter most)
// - Project context (current goals)
// - User preferences
//
// See ADR-0019: Tool/Agent Boundary for Temporal Analysis
