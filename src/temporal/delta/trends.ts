/**
 * EP09 Temporal Analysis - Trend Indicator Calculation
 *
 * Calculates trend indicators (↑ ↓ →) for metric changes with
 * configurable significance thresholds.
 *
 * @module temporal/delta/trends
 */

import type { ThresholdConfig, TrendIndicator, MetricChange } from '../types';
import { isSignificantChange, isImprovement, INVERTED_METRICS } from '../config';

// =============================================================================
// Types
// =============================================================================

/**
 * Direction indicator for metric changes.
 */
export type Direction = '↑' | '↓' | '→';

/**
 * Classification of metric change.
 */
export type ChangeClassification = 'improved' | 'regressed' | 'unchanged';

/**
 * Result of trend indicator calculation.
 */
export interface TrendIndicatorResult {
  /** Direction arrow */
  direction: Direction;
  /** Whether this is an improvement */
  isImprovement: boolean;
  /** Whether the change is significant */
  isSignificant: boolean;
  /** Classification of the change */
  classification: ChangeClassification;
  /** Absolute change */
  change: number;
  /** Percentage change (0-100 scale) */
  percentChange: number;
  /** Human-readable label */
  label: string;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Get trend indicator for a metric change.
 *
 * @param from - Previous value
 * @param to - Current value
 * @param metricName - Name of the metric (for threshold lookup)
 * @param thresholds - Optional threshold configuration
 * @returns Trend indicator result with direction and classification
 *
 * @example
 * ```typescript
 * const result = getTrendIndicator(100, 90, 'avgTokensPerSession');
 * // { direction: '↓', isImprovement: true, isSignificant: true, ... }
 * ```
 */
export function getTrendIndicator(
  from: number,
  to: number,
  metricName: string,
  thresholds?: ThresholdConfig
): TrendIndicatorResult {
  const change = to - from;
  const percentChange = calculatePercentChange(from, to);
  const significant = isSignificantChange(from, to, metricName, thresholds);
  const improved = isImprovement(from, to, metricName, thresholds);

  // Determine direction
  let direction: Direction;
  if (!significant || Math.abs(change) < 0.001) {
    direction = '→';
  } else if (change > 0) {
    direction = '↑';
  } else {
    direction = '↓';
  }

  // Classify the change
  let classification: ChangeClassification;
  if (!significant) {
    classification = 'unchanged';
  } else if (improved) {
    classification = 'improved';
  } else {
    classification = 'regressed';
  }

  // Build label
  const label = formatTrendLabel(metricName, direction, percentChange, improved);

  return {
    direction,
    isImprovement: improved,
    isSignificant: significant,
    classification,
    change,
    percentChange,
    label,
  };
}

/**
 * Create a TrendIndicator object for display purposes.
 *
 * @param metricName - Name of the metric
 * @param from - Previous value
 * @param to - Current value
 * @param thresholds - Optional threshold configuration
 * @returns TrendIndicator object
 */
export function createTrendIndicator(
  metricName: string,
  from: number,
  to: number,
  thresholds?: ThresholdConfig
): TrendIndicator {
  const result = getTrendIndicator(from, to, metricName, thresholds);

  return {
    metric: metricName,
    indicator: result.direction,
    label: result.label,
  };
}

/**
 * Create a MetricChange object with full analysis.
 *
 * @param name - Metric name
 * @param from - Previous value
 * @param to - Current value
 * @param thresholds - Optional threshold configuration
 * @returns MetricChange object
 */
export function createMetricChangeWithTrend(
  name: string,
  from: number,
  to: number,
  thresholds?: ThresholdConfig
): MetricChange {
  const result = getTrendIndicator(from, to, name, thresholds);

  return {
    name,
    from,
    to,
    change: result.change,
    percentChange: result.percentChange,
    direction: result.direction,
    isImprovement: result.isImprovement,
  };
}

/**
 * Determine overall trend from multiple metric changes.
 *
 * @param changes - Array of metric changes
 * @returns Aggregate trend direction
 */
export function determineOverallTrendFromChanges(
  changes: MetricChange[]
): 'improved' | 'regressed' | 'unchanged' {
  if (changes.length === 0) {
    return 'unchanged';
  }

  let improvements = 0;
  let regressions = 0;

  for (const change of changes) {
    if (change.direction === '→') {
      continue; // Unchanged doesn't count
    }
    if (change.isImprovement) {
      improvements++;
    } else {
      regressions++;
    }
  }

  if (improvements > regressions) {
    return 'improved';
  } else if (regressions > improvements) {
    return 'regressed';
  }
  return 'unchanged';
}

/**
 * Check if a metric is inverted (lower is better).
 *
 * @param metricName - Name of the metric
 * @returns Whether lower values are better
 */
export function isInvertedMetric(metricName: string): boolean {
  return INVERTED_METRICS.has(metricName);
}

/**
 * Get direction symbol based on value change.
 *
 * @param change - Numeric change (to - from)
 * @param threshold - Optional threshold for significance (default: 0.001)
 * @returns Direction arrow
 */
export function getDirectionSymbol(change: number, threshold = 0.001): Direction {
  if (Math.abs(change) < threshold) {
    return '→';
  }
  return change > 0 ? '↑' : '↓';
}

/**
 * Get improvement arrow based on metric and direction.
 * For inverted metrics (lower is better), ↓ is improvement.
 * For normal metrics (higher is better), ↑ is improvement.
 *
 * @param direction - Direction of change
 * @param isInverted - Whether lower is better
 * @returns Whether this direction represents improvement
 */
export function isDirectionImprovement(direction: Direction, isInverted: boolean): boolean {
  if (direction === '→') {
    return false; // No change is not improvement
  }
  if (isInverted) {
    return direction === '↓'; // Lower is better
  }
  return direction === '↑'; // Higher is better
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Calculate percentage change between two values.
 */
function calculatePercentChange(from: number, to: number): number {
  if (from === 0) {
    return to === 0 ? 0 : 100;
  }
  return ((to - from) / Math.abs(from)) * 100;
}

/**
 * Format a human-readable trend label.
 */
function formatTrendLabel(
  metricName: string,
  direction: Direction,
  percentChange: number,
  isImprovement: boolean
): string {
  const formattedName = formatMetricName(metricName);

  if (direction === '→') {
    return `${formattedName}: unchanged`;
  }

  const directionWord = direction === '↑' ? 'increased' : 'decreased';
  const formattedPercent = Math.abs(percentChange).toFixed(1);
  const sentiment = isImprovement ? '(improved)' : '(regressed)';

  return `${formattedName}: ${directionWord} ${formattedPercent}% ${sentiment}`;
}

/**
 * Format metric name for display.
 * Converts camelCase to Title Case with spaces.
 */
function formatMetricName(name: string): string {
  // Handle common metric name patterns
  return name
    .replace(/([A-Z])/g, ' $1') // Add space before capitals
    .replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter
    .trim();
}
