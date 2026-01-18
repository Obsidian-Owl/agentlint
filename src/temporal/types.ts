/**
 * EP09 Temporal Analysis - Type Definitions
 *
 * These interfaces define the contract for temporal analysis features.
 * Extends EP03 Persistence Layer types without breaking changes.
 *
 * @module temporal/types
 */

import type { BaselineMetrics } from '../persistence/types';

// =============================================================================
// Extended Metrics
// =============================================================================

/**
 * Extended baseline metrics for temporal analysis.
 *
 * Note: As of EP09, extended fields are added directly to BaselineMetrics
 * in src/persistence/types.ts for backward compatibility. This type alias
 * is kept for semantic clarity in temporal analysis code.
 *
 * @see BaselineMetrics in src/persistence/types.ts
 */
export type ExtendedBaselineMetrics = BaselineMetrics;

// =============================================================================
// Delta Types
// =============================================================================

/**
 * Result of comparing two baselines.
 */
export interface BaselineDelta {
  /** UUID of the older baseline */
  fromId: string;
  /** UUID of the newer baseline */
  toId: string;
  /** ISO-8601 timestamp of older baseline */
  fromTimestamp: string;
  /** ISO-8601 timestamp of newer baseline */
  toTimestamp: string;
  /** jsondiffpatch delta object */
  delta: unknown;
  /** Human-readable summary */
  summary: DeltaSummary;
  /** Git commits between baselines */
  gitCommitsInRange?: string[];
}

/**
 * Human-readable interpretation of a delta.
 *
 * Note: Per ADR-0019, tools return data; agent interprets meaning.
 * The `changeCounts` field replaces `overallTrend` - the agent
 * determines whether changes represent improvement or regression.
 */
export interface DeltaSummary {
  /** List of changed metrics */
  metricsChanged: MetricChange[];
  /** New warnings in the newer baseline */
  warningsAdded: string[];
  /** Warnings removed in the newer baseline */
  warningsResolved: string[];
  /** New recommendations */
  recommendationsAdded: string[];
  /** Addressed recommendations */
  recommendationsResolved: string[];
  /** Visual trend indicators */
  trendIndicators: TrendIndicator[];
  /** Counts of metric changes by direction (agent interprets meaning) */
  changeCounts: {
    /** Number of metrics that increased in value */
    increased: number;
    /** Number of metrics that decreased in value */
    decreased: number;
    /** Number of metrics that stayed the same */
    unchanged: number;
  };
}

/**
 * Single metric change between baselines.
 *
 * Note: Per ADR-0019, `isImprovement` was removed. The agent determines
 * whether a change is an improvement based on context (metric semantics,
 * project goals, etc.). The `direction` field shows raw change direction.
 */
export interface MetricChange {
  /** Metric name */
  name: string;
  /** Previous value */
  from: number;
  /** New value */
  to: number;
  /** Absolute change (to - from) */
  change: number;
  /** Percentage change */
  percentChange: number;
  /** Visual indicator showing raw change direction */
  direction: '↑' | '↓' | '→';
}

/**
 * Visual trend indicator for display.
 */
export interface TrendIndicator {
  /** Metric name */
  metric: string;
  /** Direction symbol */
  indicator: '↑' | '↓' | '→';
  /** Human-readable label */
  label: string;
}

// =============================================================================
// Trend Analysis Types
// =============================================================================

/**
 * Multi-baseline pattern analysis.
 */
export interface TrendAnalysis {
  /** Project being analyzed */
  projectPath: string;
  /** Time range covered */
  dateRange: DateRange;
  /** Number of baselines analyzed */
  baselineCount: number;
  /** UUIDs of included baselines */
  baselineIds: string[];
  /** Trends for each metric */
  metricTrends: MetricTrend[];
  /** Points where trends changed */
  inflectionPoints?: InflectionPoint[];
  /** Git commits linked to changes */
  correlatedCommits?: CorrelatedCommit[];
  /** Sentiment trends from reviews */
  qualitativeTrends?: QualitativeTrend[];
}

/**
 * Date range for analysis.
 */
export interface DateRange {
  /** ISO-8601 start date */
  start: string;
  /** ISO-8601 end date */
  end: string;
}

/**
 * Single metric trend over time.
 *
 * Note: Per ADR-0019, `direction` was removed. The agent interprets
 * the trend based on slope, rSquared, and volatility. Use rSquared
 * to determine trend reliability and volatility to detect noise.
 */
export interface MetricTrend {
  /** Name of the metric */
  metricName: string;
  /** Time series data */
  values: TimeSeriesPoint[];
  /** Linear regression slope (positive = increasing, negative = decreasing) */
  slope: number;
  /** R² coefficient of determination (0-1, higher = more linear/reliable) */
  rSquared: number;
  /** Coefficient of variation (stdDev/mean, higher = more volatile) */
  volatility: number;
  /** Average value */
  meanValue: number;
  /** Standard deviation */
  standardDeviation: number;
  /** Oldest value */
  firstValue: number;
  /** Most recent value */
  lastValue: number;
  /** Overall percent change */
  percentChange: number;
}

/**
 * Single point in a time series.
 */
export interface TimeSeriesPoint {
  /** ISO-8601 timestamp */
  timestamp: string;
  /** Metric value */
  value: number;
  /** Source baseline UUID */
  baselineId: string;
}

/**
 * Point where a trend changed direction.
 */
export interface InflectionPoint {
  /** When the trend changed */
  timestamp: string;
  /** Which metric changed */
  metric: string;
  /** Previous trend direction */
  beforeDirection: string;
  /** New trend direction */
  afterDirection: string;
  /** Possible causes */
  correlatedChanges: string[];
}

/**
 * Git commit correlated with metric changes.
 */
export interface CorrelatedCommit {
  /** Git commit hash */
  hash: string;
  /** Commit message */
  message: string;
  /** Commit timestamp */
  timestamp: string;
  /** Files modified */
  filesChanged: string[];
  /** Estimated relevance */
  likelyImpact: 'high' | 'medium' | 'low';
}

// =============================================================================
// Qualitative Review Types
// =============================================================================

/**
 * Qualitative review dimension names.
 */
export type ReviewDimensionName =
  | 'perceivedFriction'
  | 'trustCalibration'
  | 'taskFit'
  | 'configurationConfidence'
  | 'improvementAttribution'
  | 'workflowSatisfaction';

/**
 * Structured qualitative assessment linked to a baseline.
 */
export interface QualitativeReview {
  /** UUID v4 identifier */
  id: string;
  /** Linked baseline UUID */
  baselineId: string;
  /** ISO-8601 creation timestamp */
  createdAt: string;
  /** Individual dimension assessments */
  dimensions: ReviewDimension[];
  /** Aggregate sentiment (-2 to +2) */
  overallSentiment: number;
  /** Extracted themes from responses */
  themes: string[];
  /** Open-ended user notes */
  freeformNotes?: string;
  /** Why this review was conducted */
  triggerReason?: 'scheduled' | 'triggered' | 'manual';
}

/**
 * Single dimension within a qualitative review.
 */
export interface ReviewDimension {
  /** Dimension identifier */
  name: ReviewDimensionName;
  /** Question asked to user */
  promptText: string;
  /** User's response text */
  response: string;
  /** Rating (-2 to +2) */
  sentiment: -2 | -1 | 0 | 1 | 2;
  /** User's confidence in assessment */
  confidence?: 'high' | 'medium' | 'low';
}

/**
 * Sentiment trend from qualitative reviews.
 *
 * Note: Per ADR-0019, `direction` was removed. The agent interprets
 * the trend based on slope and slopeSignificant. Positive slope
 * indicates sentiment increasing over time; agent determines meaning.
 */
export interface QualitativeTrend {
  /** Which dimension */
  dimension: ReviewDimensionName;
  /** Time series of sentiment */
  values: SentimentPoint[];
  /** Linear regression slope (positive = sentiment increasing) */
  slope: number;
  /** Whether slope exceeds significance threshold */
  slopeSignificant: boolean;
  /** Whether aligned with quantitative metrics */
  alignedWithQuantitative?: boolean;
  /** Explanation if diverging */
  divergenceNote?: string;
}

/**
 * Single sentiment data point.
 */
export interface SentimentPoint {
  /** ISO-8601 timestamp */
  timestamp: string;
  /** Sentiment value (-2 to +2) */
  sentiment: number;
  /** Source review UUID */
  reviewId: string;
}

// =============================================================================
// Recommendation Tracking Types
// =============================================================================

/**
 * Recommendation implementation status.
 */
export type RecommendationStatus =
  | 'pending'
  | 'detected_pending_confirm'
  | 'implemented'
  | 'partial'
  | 'rejected'
  | 'ineffective';

/**
 * Tracks implementation status of a recommendation.
 */
export interface RecommendationTracking {
  /** UUID v4 identifier */
  id: string;
  /** ID of the recommendation */
  recommendationId: string;
  /** Summary of recommendation */
  recommendationText: string;
  /** Current implementation status */
  status: RecommendationStatus;
  /** When implementation was detected */
  detectedAt?: string;
  /** When user confirmed implementation */
  confirmedAt?: string;
  /** Baseline before implementation */
  preBaselineId?: string;
  /** Baseline after implementation */
  postBaselineId?: string;
  /** Measured effectiveness (0-100) */
  effectivenessScore?: number;
  /** User notes about implementation */
  notes?: string;
}

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Configurable significance thresholds.
 */
export interface ThresholdConfig {
  /** Default threshold (e.g., 0.05 = 5%) */
  default: number;
  /** Per-metric threshold overrides */
  metricOverrides?: Record<string, number | MetricThreshold>;
}

/**
 * Detailed threshold configuration for a metric.
 */
export interface MetricThreshold {
  /** Absolute value threshold */
  absolute?: number;
  /** Percentage threshold */
  percentage?: number;
  /** Lower is better (true) or higher is better (false) */
  inverted?: boolean;
}

// =============================================================================
// File Format Types
// =============================================================================

/**
 * File format for persisted qualitative reviews.
 */
export interface QualitativeReviewFile {
  /** File format version */
  version: string;
  /** The review data */
  review: QualitativeReview;
}

/**
 * File format for persisted recommendation tracking.
 */
export interface RecommendationTrackingFile {
  /** File format version */
  version: string;
  /** The tracking data */
  tracking: RecommendationTracking;
}

// =============================================================================
// Detection Evidence Types (ADR-0019)
// =============================================================================

/**
 * Evidence for a single match during detection.
 */
export interface DetectionEvidence {
  /** Type of evidence */
  type: 'keyword' | 'file' | 'pattern';
  /** What was matched */
  match: string;
  /** Where it was found */
  location: string;
  /** How strong is this evidence (0-100) */
  weight: number;
}

/**
 * Raw evidence extracted from config diff matching.
 *
 * Per ADR-0019, tools return evidence; agent interprets.
 * The agent determines whether this evidence indicates
 * implementation, what status to assign, and whether to
 * prompt for user confirmation.
 */
export interface MatchEvidence {
  /** All evidence found during matching */
  evidence: DetectionEvidence[];
  /** Sum of all evidence weights (higher = stronger signal) */
  totalWeight: number;
  /** Keywords that matched in added lines */
  keywordMatches: string[];
  /** Target files that were modified */
  fileMatches: string[];
  /** Regex patterns that matched */
  patternMatches: string[];
}
