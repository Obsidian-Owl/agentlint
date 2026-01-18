/**
 * EP09 Temporal Analysis Module
 *
 * Provides longitudinal tracking of AI-assisted development workflow effectiveness
 * through mixed-methods measurement—combining quantitative metrics with structured
 * qualitative reviews.
 *
 * @module temporal
 */

// =============================================================================
// Types
// =============================================================================

export type {
  // Extended Metrics
  ExtendedBaselineMetrics,

  // Delta Types
  BaselineDelta,
  DeltaSummary,
  MetricChange,
  TrendIndicator,

  // Trend Analysis Types
  TrendAnalysis,
  DateRange,
  MetricTrend,
  TimeSeriesPoint,
  InflectionPoint,
  CorrelatedCommit,

  // Qualitative Review Types
  ReviewDimensionName,
  QualitativeReview,
  ReviewDimension,
  QualitativeTrend,
  SentimentPoint,

  // Recommendation Tracking Types
  RecommendationStatus,
  RecommendationTracking,

  // Configuration Types
  ThresholdConfig,
  MetricThreshold,

  // File Format Types
  QualitativeReviewFile,
  RecommendationTrackingFile,
} from './types';

// =============================================================================
// Errors
// =============================================================================

export {
  TemporalError,
  InsufficientDataError,
  BaselineNotFoundError,
  ReviewNotFoundError,
  SchemaVersionError,
  GitCorrelationError,
  ConfigurationError,
} from './errors';

// =============================================================================
// Configuration
// =============================================================================

export {
  DEFAULT_THRESHOLD_CONFIG,
  INVERTED_METRICS,
  getGlobalConfigPath,
  loadThresholdConfig,
  getThresholdForMetric,
  isSignificantChange,
  isImprovement,
} from './config';

// =============================================================================
// Delta Calculation
// =============================================================================

export { calculateDelta, calculateMetricsDelta } from './delta/calculator';
export { createDeltaSummary } from './delta/summarizer';

// =============================================================================
// Trend Analysis
// =============================================================================

export {
  // Metric aggregation
  aggregateMetrics,
  getAvailableMetrics,
  calculateMetricCoverage,
  isCoreMetric,
  // Linear regression
  calculateSlope,
  linearRegression,
  timeSeriestoPoints,
  predict,
  classifyTrend,
  calculateStats,
  // Metric trends
  getMetricTrend,
  detectInflectionPoints,
  isLowerBetterMetric,
  summarizeTrends,
  // Analysis builder
  buildTrendAnalysis,
  hasSufficientBaselines,
  getTrendSummary,
  getSignificantTrends,
  getTrendsByDirection,
} from './trends';

export type {
  AggregatedMetric,
  AggregationResult,
  AggregationOptions,
  RegressionResult,
  Point,
  MetricTrendOptions,
  TrendAnalysisOptions,
} from './trends';

// =============================================================================
// Qualitative Reviews
// =============================================================================

export {
  REVIEW_DIMENSIONS,
  DIMENSION_BY_NAME,
  getDimension,
  getDimensionNames,
  getDimensionsBySignalType,
  getPromptText,
  getProbeText,
} from './qualitative/dimensions';

export type { SignalType, DimensionDefinition } from './qualitative/dimensions';

export {
  calculateOverallSentiment,
  isValidSentiment,
  clampSentiment,
  getSentimentLabel,
  getSentimentEmoji,
  analyzeSentimentIndicators,
  calculateSentimentTrend,
  compareSentiment,
  createEmptyDimension,
  aggregateSentimentStats,
} from './qualitative/sentiment';

export type {
  SentimentValue,
  SentimentOptions,
  SentimentIndicatorAnalysis,
} from './qualitative/sentiment';

// =============================================================================
// Tools
// =============================================================================

export {
  TOOL_DESCRIPTIONS,
  storeBaselineTool,
  queryBaselineTool,
  listBaselinesTool,
  calculateDeltaTool,
  queryTrendsTool,
  conductReviewTool,
  getReviewHistoryTool,
} from './tools';
