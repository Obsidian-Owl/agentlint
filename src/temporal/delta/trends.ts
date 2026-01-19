/**
 * EP09 Temporal Analysis - Trend Indicator Calculation
 *
 * Calculates trend indicators (↑ ↓ →) for metric changes with
 * configurable significance thresholds.
 *
 * @module temporal/delta/trends
 */

import type { ThresholdConfig, TrendIndicator, MetricChange } from '../types';
import { isSignificantChange, INVERTED_METRICS } from '../config';

// =============================================================================
// Types
// =============================================================================

/**
 * Direction indicator for metric changes.
 */
export type Direction = '↑' | '↓' | '→';

/**
 * Result of trend indicator calculation.
 *
 * Per ADR-0019, returns raw direction and statistics. The agent
 * determines whether a change is an improvement based on context.
 */
export interface TrendIndicatorResult {
  /** Direction arrow showing raw change direction */
  direction: Direction;
  /** Whether the change is significant */
  isSignificant: boolean;
  /** Whether this metric is inverted (lower is typically better) */
  isInverted: boolean;
  /** Absolute change */
  change: number;
  /** Percentage change (0-100 scale) */
  percentChange: number;
  /** Human-readable label */
  label: string;
}

// Note: ChangeClassification and isImprovement were removed per ADR-0019.
// The agent determines classification based on context.

// =============================================================================
// Public API
// =============================================================================

/**
 * Get trend indicator for a metric change.
 *
 * Per ADR-0019, returns raw direction and statistics. The agent
 * determines whether a change is an improvement based on context.
 *
 * @param from - Previous value
 * @param to - Current value
 * @param metricName - Name of the metric (for threshold lookup)
 * @param thresholds - Optional threshold configuration
 * @returns Trend indicator result with direction and statistics
 *
 * @example
 * ```typescript
 * const result = getTrendIndicator(100, 90, 'avgTokensPerSession');
 * // { direction: '↓', isSignificant: true, isInverted: true, ... }
 * // Agent interprets: "For avgTokensPerSession, ↓ is typically good"
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
  const isInverted = INVERTED_METRICS.has(metricName);

  // Determine direction (raw change direction, not interpretation)
  let direction: Direction;
  if (!significant || Math.abs(change) < 0.001) {
    direction = '→';
  } else if (change > 0) {
    direction = '↑';
  } else {
    direction = '↓';
  }

  // Build label (raw description without improvement judgment)
  const label = formatTrendLabel(metricName, direction, percentChange, isInverted);

  return {
    direction,
    isSignificant: significant,
    isInverted,
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
 * Per ADR-0019, returns raw direction. Agent interprets improvement.
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
  };
}

/**
 * Count metric changes by direction.
 *
 * Per ADR-0019, returns raw counts. The agent interprets
 * whether the overall trend is positive or negative.
 *
 * @param changes - Array of metric changes
 * @returns Counts of changes by direction
 */
export function countChangesByDirection(changes: MetricChange[]): {
  /** Number of metrics that increased */
  increased: number;
  /** Number of metrics that decreased */
  decreased: number;
  /** Number of metrics unchanged */
  unchanged: number;
} {
  let increased = 0;
  let decreased = 0;
  let unchanged = 0;

  for (const change of changes) {
    if (change.direction === '↑') {
      increased++;
    } else if (change.direction === '↓') {
      decreased++;
    } else {
      unchanged++;
    }
  }

  return { increased, decreased, unchanged };
}

// Note: determineOverallTrendFromChanges was removed per ADR-0019.
// The agent determines overall trend based on counts and context.

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
 *
 * Per ADR-0019, returns raw direction info. The agent interprets meaning.
 */
function formatTrendLabel(
  metricName: string,
  direction: Direction,
  percentChange: number,
  isInverted: boolean
): string {
  const formattedName = formatMetricName(metricName);

  if (direction === '→') {
    return `${formattedName}: unchanged`;
  }

  const directionWord = direction === '↑' ? 'increased' : 'decreased';
  const formattedPercent = Math.abs(percentChange).toFixed(1);
  // Provide context but don't judge - agent interprets
  const context = isInverted ? '(lower typically better)' : '(higher typically better)';

  return `${formattedName}: ${directionWord} ${formattedPercent}% ${context}`;
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
