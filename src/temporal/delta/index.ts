/**
 * EP09 Temporal Analysis - Delta Module
 *
 * Exports delta calculation and summarization utilities.
 *
 * @module temporal/delta
 */

// Calculator
export {
  getDiffPatcher,
  calculateDelta,
  calculateMetricsDelta,
  applyDelta,
  reverseDelta,
} from './calculator';

export type { DeltaCalculatorOptions, RawDelta, MetricsDelta } from './calculator';

// Summarizer
export { createDeltaSummary, formatDeltaSummary } from './summarizer';

export type { SummarizerOptions } from './summarizer';

// Trends
export {
  getTrendIndicator,
  createTrendIndicator,
  createMetricChangeWithTrend,
  countChangesByDirection,
  isInvertedMetric,
  getDirectionSymbol,
} from './trends';

// Note: isDirectionImprovement was removed per ADR-0019.
// The agent determines whether a direction represents improvement based on context.

export type { Direction, TrendIndicatorResult } from './trends';

// Note: determineOverallTrendFromChanges and ChangeClassification were
// removed per ADR-0019. Use countChangesByDirection instead.
