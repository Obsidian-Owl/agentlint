/**
 * EP09 Temporal Analysis - Trends Module
 *
 * Exports all trend analysis functionality.
 *
 * @module temporal/trends
 */

// Metric aggregation
export {
  aggregateMetrics,
  getAvailableMetrics,
  calculateMetricCoverage,
  isCoreMetric,
} from './aggregator';
export type { AggregatedMetric, AggregationResult, AggregationOptions } from './aggregator';
