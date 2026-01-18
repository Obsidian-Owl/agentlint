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

// Linear regression
export {
  calculateSlope,
  linearRegression,
  timeSeriestoPoints,
  timeSeriestoTimeWeightedPoints,
  predict,
  calculateStats,
} from './regression';
export type { RegressionResult, Point } from './regression';

// Note: classifyTrend was removed per ADR-0019.
// The agent interprets trend direction based on slope and rSquared.

// Metric trend calculation
export { getMetricTrend, detectInflectionPoints, summarizeTrends } from './metric-trend';
export type { MetricTrendOptions } from './metric-trend';

// Note: isLowerBetterMetric was removed per ADR-0019.
// See INVERTED_METRICS in config.ts for optional context.

// Trend analysis builder
export {
  buildTrendAnalysis,
  hasSufficientBaselines,
  getTrendSummary,
  getSignificantTrends,
  getTrendsByDirection,
} from './analysis';
export type { TrendAnalysisOptions } from './analysis';

// Inflection point detection (ADR-0019 compliant)
export {
  detectInflectionPoints as detectInflectionPointsStatistical,
  detectInflectionPointsFromSeries,
  findMostSignificantInflection,
  filterBySignificance,
  categorizeInflections,
} from './inflection';
export type {
  InflectionPointData,
  InflectionDetectionResult,
  InflectionDetectionOptions,
} from './inflection';
