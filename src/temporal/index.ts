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
