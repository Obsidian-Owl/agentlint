/**
 * EP09 Temporal Analysis - Review Trigger Conditions
 *
 * Defines conditions that trigger qualitative review prompts.
 * Per ADR-0019, provides trigger detection data; agent decides whether to act.
 *
 * Trigger types:
 * 1. Major inflection detected - significant slope change in metrics
 * 2. Time-based - configurable interval since last review
 * 3. Threshold-based - significant change in specific metrics
 *
 * @module temporal/reminders/triggers
 */

import type { InflectionDetectionResult } from '../trends/inflection';
import type { DeltaSummary, QualitativeReview } from '../types';

// =============================================================================
// Types
// =============================================================================

/**
 * Type of review trigger.
 */
export type TriggerType = 'inflection' | 'time' | 'threshold';

/**
 * Reason a trigger condition was met.
 */
export interface TriggerReason {
  /** Type of trigger */
  type: TriggerType;
  /** Description of why trigger fired */
  description: string;
  /** Severity of the trigger (for prioritization) */
  severity: 'low' | 'medium' | 'high';
  /** Relevant data for the trigger */
  metadata?: Record<string, unknown>;
}

/**
 * Result of checking all trigger conditions.
 */
export interface TriggerCheckResult {
  /** Whether any trigger condition was met */
  shouldTrigger: boolean;
  /** All reasons that triggered (may be multiple) */
  reasons: TriggerReason[];
  /** Summary for agent */
  summary: string;
}

/**
 * Configuration for trigger conditions.
 */
export interface TriggerConfig {
  /** Minimum days since last review to trigger time-based review */
  minDaysSinceReview?: number;
  /** Minimum slope change percentage to count as major inflection */
  minInflectionSlopeChange?: number;
  /** Minimum R² for inflection to be considered reliable */
  minInflectionRSquared?: number;
  /** Metric-specific thresholds (metric name → percent change) */
  metricThresholds?: Record<string, number>;
  /** Default threshold for metrics not in metricThresholds */
  defaultMetricThreshold?: number;
}

// =============================================================================
// Constants
// =============================================================================

/** Default days between reviews */
const DEFAULT_MIN_DAYS_SINCE_REVIEW = 30;

/** Default slope change percentage to count as major inflection */
const DEFAULT_MIN_INFLECTION_SLOPE_CHANGE = 0.5; // 50%

/** Default R² threshold for reliable inflection */
const DEFAULT_MIN_INFLECTION_R_SQUARED = 0.5;

/** Default percent change threshold for metrics */
const DEFAULT_METRIC_THRESHOLD = 0.2; // 20%

// =============================================================================
// Inflection Triggers
// =============================================================================

/**
 * Check if a major inflection point should trigger a review.
 *
 * Per ADR-0019, returns raw detection data. Agent interprets significance.
 *
 * @param inflectionResult - Result from inflection point detection
 * @param config - Trigger configuration
 * @returns Trigger reason if condition met, null otherwise
 */
export function checkInflectionTrigger(
  inflectionResult: InflectionDetectionResult,
  config: TriggerConfig = {}
): TriggerReason | null {
  const minSlopeChange = config.minInflectionSlopeChange ?? DEFAULT_MIN_INFLECTION_SLOPE_CHANGE;
  const minRSquared = config.minInflectionRSquared ?? DEFAULT_MIN_INFLECTION_R_SQUARED;

  // Find significant inflection points
  const significantInflections = inflectionResult.inflectionPoints.filter(
    (p) =>
      p.slopeChangePercent >= minSlopeChange &&
      p.rSquaredBefore >= minRSquared &&
      p.rSquaredAfter >= minRSquared
  );

  if (significantInflections.length === 0) {
    return null;
  }

  // Find the most significant one
  const mostSignificant = significantInflections.reduce((max, current) =>
    current.slopeChangePercent > max.slopeChangePercent ? current : max
  );

  // Determine severity based on slope change magnitude
  let severity: 'low' | 'medium' | 'high';
  if (mostSignificant.slopeChangePercent >= 1.0) {
    severity = 'high';
  } else if (mostSignificant.slopeChangePercent >= 0.5) {
    severity = 'medium';
  } else {
    severity = 'low';
  }

  return {
    type: 'inflection',
    description: `Major inflection detected in ${inflectionResult.metric}: slope changed by ${(mostSignificant.slopeChangePercent * 100).toFixed(0)}%`,
    severity,
    metadata: {
      metric: inflectionResult.metric,
      slopeChangePercent: mostSignificant.slopeChangePercent,
      timestamp: mostSignificant.timestamp,
      slopeBefore: mostSignificant.slopeBefore,
      slopeAfter: mostSignificant.slopeAfter,
    },
  };
}

// =============================================================================
// Time-Based Triggers
// =============================================================================

/**
 * Check if time since last review should trigger a new review.
 *
 * @param lastReview - Most recent qualitative review (null if never reviewed)
 * @param config - Trigger configuration
 * @returns Trigger reason if condition met, null otherwise
 */
export function checkTimeTrigger(
  lastReview: QualitativeReview | null,
  config: TriggerConfig = {}
): TriggerReason | null {
  const minDays = config.minDaysSinceReview ?? DEFAULT_MIN_DAYS_SINCE_REVIEW;

  // If never reviewed, trigger
  if (!lastReview) {
    return {
      type: 'time',
      description: 'No previous qualitative review found',
      severity: 'medium',
      metadata: {
        daysSinceReview: null,
        minDaysRequired: minDays,
      },
    };
  }

  // Calculate days since last review
  const lastReviewDate = new Date(lastReview.createdAt);
  const now = new Date();
  const daysSinceReview = Math.floor(
    (now.getTime() - lastReviewDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceReview >= minDays) {
    // Determine severity based on how overdue
    let severity: 'low' | 'medium' | 'high';
    if (daysSinceReview >= minDays * 2) {
      severity = 'high';
    } else if (daysSinceReview >= minDays * 1.5) {
      severity = 'medium';
    } else {
      severity = 'low';
    }

    return {
      type: 'time',
      description: `${daysSinceReview} days since last qualitative review (threshold: ${minDays} days)`,
      severity,
      metadata: {
        daysSinceReview,
        minDaysRequired: minDays,
        lastReviewDate: lastReview.createdAt,
      },
    };
  }

  return null;
}

// =============================================================================
// Threshold-Based Triggers
// =============================================================================

/**
 * Check if significant metric changes should trigger a review.
 *
 * @param deltaSummary - Delta summary between baselines
 * @param config - Trigger configuration
 * @returns Trigger reason if condition met, null otherwise
 */
export function checkThresholdTrigger(
  deltaSummary: DeltaSummary,
  config: TriggerConfig = {}
): TriggerReason | null {
  const defaultThreshold = config.defaultMetricThreshold ?? DEFAULT_METRIC_THRESHOLD;
  const metricThresholds = config.metricThresholds ?? {};

  // Find metrics that exceeded their thresholds
  const exceededMetrics: Array<{
    name: string;
    percentChange: number;
    threshold: number;
  }> = [];

  for (const change of deltaSummary.metricsChanged) {
    const threshold = metricThresholds[change.name] ?? defaultThreshold;
    const absPercentChange = Math.abs(change.percentChange) / 100;

    if (absPercentChange >= threshold) {
      exceededMetrics.push({
        name: change.name,
        percentChange: change.percentChange,
        threshold: threshold * 100,
      });
    }
  }

  if (exceededMetrics.length === 0) {
    return null;
  }

  // Determine severity based on number and magnitude of exceeded thresholds
  const maxChange = Math.max(...exceededMetrics.map((m) => Math.abs(m.percentChange)));
  let severity: 'low' | 'medium' | 'high';
  if (exceededMetrics.length >= 3 || maxChange >= 50) {
    severity = 'high';
  } else if (exceededMetrics.length >= 2 || maxChange >= 30) {
    severity = 'medium';
  } else {
    severity = 'low';
  }

  const metricDescriptions = exceededMetrics
    .slice(0, 3)
    .map((m) => `${m.name}: ${m.percentChange >= 0 ? '+' : ''}${m.percentChange.toFixed(1)}%`)
    .join(', ');

  return {
    type: 'threshold',
    description: `Significant metric changes detected: ${metricDescriptions}`,
    severity,
    metadata: {
      exceededMetrics,
      totalMetricsExceeded: exceededMetrics.length,
    },
  };
}

// =============================================================================
// Combined Trigger Check
// =============================================================================

/**
 * Check all trigger conditions and return combined result.
 *
 * @param params - Parameters for trigger checking
 * @returns Combined trigger check result
 */
export function checkAllTriggers(params: {
  inflectionResult?: InflectionDetectionResult;
  lastReview?: QualitativeReview | null;
  deltaSummary?: DeltaSummary;
  config?: TriggerConfig;
}): TriggerCheckResult {
  const { inflectionResult, lastReview, deltaSummary, config = {} } = params;

  const reasons: TriggerReason[] = [];

  // Check inflection trigger
  if (inflectionResult) {
    const inflectionTrigger = checkInflectionTrigger(inflectionResult, config);
    if (inflectionTrigger) {
      reasons.push(inflectionTrigger);
    }
  }

  // Check time trigger
  if (lastReview !== undefined) {
    const timeTrigger = checkTimeTrigger(lastReview, config);
    if (timeTrigger) {
      reasons.push(timeTrigger);
    }
  }

  // Check threshold trigger
  if (deltaSummary) {
    const thresholdTrigger = checkThresholdTrigger(deltaSummary, config);
    if (thresholdTrigger) {
      reasons.push(thresholdTrigger);
    }
  }

  // Create summary
  const shouldTrigger = reasons.length > 0;
  let summary: string;

  if (shouldTrigger) {
    const highSeverityCount = reasons.filter((r) => r.severity === 'high').length;
    if (highSeverityCount > 0) {
      summary = `High-priority review recommended: ${highSeverityCount} critical trigger(s)`;
    } else {
      summary = `Review recommended: ${reasons.length} trigger condition(s) met`;
    }
  } else {
    summary = 'No review triggers detected';
  }

  return {
    shouldTrigger,
    reasons,
    summary,
  };
}

// =============================================================================
// Default Configuration
// =============================================================================

/**
 * Get the default trigger configuration.
 *
 * @returns Default trigger configuration
 */
export function getDefaultTriggerConfig(): Required<TriggerConfig> {
  return {
    minDaysSinceReview: DEFAULT_MIN_DAYS_SINCE_REVIEW,
    minInflectionSlopeChange: DEFAULT_MIN_INFLECTION_SLOPE_CHANGE,
    minInflectionRSquared: DEFAULT_MIN_INFLECTION_R_SQUARED,
    metricThresholds: {},
    defaultMetricThreshold: DEFAULT_METRIC_THRESHOLD,
  };
}
