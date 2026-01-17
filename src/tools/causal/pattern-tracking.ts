/**
 * EP07 Causal Tracing Engine - Pattern Tracking
 *
 * Tracks frequency and severity of issue patterns over time.
 * Provides trend analysis and alert generation for pattern monitoring.
 *
 * @module src/tools/causal/pattern-tracking
 */

import type { IssuePattern, GapType } from './types';

// =============================================================================
// Types
// =============================================================================

/**
 * Severity levels for patterns.
 */
export enum SeverityLevel {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  CRITICAL = 4,
}

/**
 * Direction of trend.
 */
export type TrendDirection = 'increasing' | 'decreasing' | 'stable' | 'unknown';

/**
 * Frequency data point at a point in time.
 */
export interface FrequencyRecord {
  /** ISO timestamp when recorded */
  timestamp: string;
  /** Frequency count at this time */
  frequency: number;
  /** Severity level at this time */
  severity: SeverityLevel;
}

/**
 * Trend analysis result.
 */
export interface TrendAnalysis {
  /** Direction of the trend */
  direction: TrendDirection;
  /** Rate of change (positive = increasing) */
  rateOfChange: number;
  /** Number of data points used */
  dataPoints: number;
}

/**
 * Alert generated for a pattern.
 */
export interface PatternAlert {
  /** Type of alert */
  type: 'rapid_increase' | 'became_systemic' | 'critical_severity' | 'sustained_high';
  /** Alert message */
  message: string;
  /** Timestamp when alert was generated */
  timestamp: string;
  /** Related pattern ID */
  patternId: string;
}

/**
 * Summary of a tracked pattern.
 */
export interface PatternSummary {
  /** Pattern ID */
  patternId: string;
  /** Current frequency */
  currentFrequency: number;
  /** Current severity level */
  currentSeverity: SeverityLevel;
  /** Trend analysis */
  trend: TrendAnalysis;
  /** First time this pattern was tracked */
  firstTracked: string;
  /** Last time this pattern was tracked */
  lastTracked: string;
  /** Total number of tracking records */
  totalRecords: number;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Frequency thresholds for severity levels.
 */
const SEVERITY_THRESHOLDS = {
  LOW: 0,
  MEDIUM: 3,
  HIGH: 6,
  CRITICAL: 10,
};

/**
 * Category severity modifiers (higher = more severe).
 */
const CATEGORY_SEVERITY: Record<GapType, number> = {
  missing_config: 1.5,
  context_loss: 1.3,
  missing_guidance: 1.0,
  terminology_gap: 0.8,
  missing_example: 0.6,
  other: 0.5,
};

/**
 * Minimum data points needed for trend analysis.
 */
const MIN_TREND_DATA_POINTS = 2;

/**
 * Rate of change threshold for "rapid increase" alert.
 */
const RAPID_INCREASE_THRESHOLD = 2.0;

// =============================================================================
// PatternTracker Class
// =============================================================================

/**
 * Tracks pattern frequency and severity over time.
 *
 * Provides:
 * - Frequency history tracking
 * - Severity assessment
 * - Trend analysis
 * - Alert generation
 *
 * @example
 * ```typescript
 * const tracker = new PatternTracker();
 *
 * // Track patterns as they're detected
 * tracker.trackFrequency(pattern);
 *
 * // Analyze trends
 * const trend = tracker.analyzeTrend(pattern.id);
 * console.log(`Trend: ${trend.direction}`);
 *
 * // Check for alerts
 * const alerts = tracker.checkAlerts(pattern.id);
 * for (const alert of alerts) {
 *   console.log(`Alert: ${alert.message}`);
 * }
 * ```
 */
export class PatternTracker {
  /** Frequency history by pattern ID */
  private readonly history: Map<string, FrequencyRecord[]>;

  /** Last tracked systemic status by pattern ID */
  private readonly lastSystemic: Map<string, boolean>;

  /**
   * Create a new PatternTracker.
   */
  constructor() {
    this.history = new Map();
    this.lastSystemic = new Map();
  }

  /**
   * Assess severity level for a pattern.
   *
   * @param pattern - Pattern to assess
   * @returns Severity level
   */
  assessSeverity(pattern: IssuePattern): SeverityLevel {
    const baseScore = this.calculateBaseSeverity(pattern.frequency);
    const categoryModifier = CATEGORY_SEVERITY[pattern.category] ?? 1.0;
    const recencyModifier = this.calculateRecencyModifier(pattern);

    const adjustedScore = baseScore * categoryModifier * recencyModifier;

    // Map to severity level
    if (adjustedScore >= SEVERITY_THRESHOLDS.CRITICAL) {
      return SeverityLevel.CRITICAL;
    } else if (adjustedScore >= SEVERITY_THRESHOLDS.HIGH) {
      return SeverityLevel.HIGH;
    } else if (adjustedScore >= SEVERITY_THRESHOLDS.MEDIUM) {
      return SeverityLevel.MEDIUM;
    }
    return SeverityLevel.LOW;
  }

  /**
   * Track frequency for a pattern.
   *
   * @param pattern - Pattern to track
   */
  trackFrequency(pattern: IssuePattern): void {
    const record: FrequencyRecord = {
      timestamp: new Date().toISOString(),
      frequency: pattern.frequency,
      severity: this.assessSeverity(pattern),
    };

    const existing = this.history.get(pattern.id) ?? [];
    existing.push(record);
    this.history.set(pattern.id, existing);

    // Track systemic status for alerts
    this.lastSystemic.set(pattern.id, pattern.isSystemic);
  }

  /**
   * Track multiple patterns at once.
   *
   * @param patterns - Patterns to track
   */
  trackPatterns(patterns: IssuePattern[]): void {
    for (const pattern of patterns) {
      this.trackFrequency(pattern);
    }
  }

  /**
   * Get frequency history for a pattern.
   *
   * @param patternId - Pattern ID
   * @returns Array of frequency records
   */
  getFrequencyHistory(patternId: string): FrequencyRecord[] {
    return this.history.get(patternId) ?? [];
  }

  /**
   * Analyze trend for a pattern.
   *
   * @param patternId - Pattern ID
   * @returns Trend analysis
   */
  analyzeTrend(patternId: string): TrendAnalysis {
    const records = this.history.get(patternId) ?? [];

    if (records.length < MIN_TREND_DATA_POINTS) {
      return {
        direction: 'unknown',
        rateOfChange: 0,
        dataPoints: records.length,
      };
    }

    // Calculate rate of change using simple linear regression
    const rateOfChange = this.calculateRateOfChange(records);
    const direction = this.determineDirection(rateOfChange);

    return {
      direction,
      rateOfChange,
      dataPoints: records.length,
    };
  }

  /**
   * Get summary for a tracked pattern.
   *
   * @param patternId - Pattern ID
   * @returns Pattern summary or undefined if not tracked
   */
  getPatternSummary(patternId: string): PatternSummary | undefined {
    const records = this.history.get(patternId);

    if (!records || records.length === 0) {
      return undefined;
    }

    const lastRecord = records[records.length - 1]!;
    const firstRecord = records[0]!;

    return {
      patternId,
      currentFrequency: lastRecord.frequency,
      currentSeverity: lastRecord.severity,
      trend: this.analyzeTrend(patternId),
      firstTracked: firstRecord.timestamp,
      lastTracked: lastRecord.timestamp,
      totalRecords: records.length,
    };
  }

  /**
   * Check for alerts on a pattern.
   *
   * @param patternId - Pattern ID
   * @returns Array of alerts
   */
  checkAlerts(patternId: string): PatternAlert[] {
    const alerts: PatternAlert[] = [];
    const records = this.history.get(patternId);

    if (!records || records.length === 0) {
      return alerts;
    }

    const lastRecord = records[records.length - 1]!;
    const now = new Date().toISOString();

    // Check for critical severity
    if (lastRecord.severity === SeverityLevel.CRITICAL) {
      alerts.push({
        type: 'critical_severity',
        message: `Pattern ${patternId} has reached critical severity`,
        timestamp: now,
        patternId,
      });
    }

    // Check for rapid increase
    if (records.length >= 2) {
      const trend = this.analyzeTrend(patternId);
      if (trend.rateOfChange >= RAPID_INCREASE_THRESHOLD) {
        alerts.push({
          type: 'rapid_increase',
          message: `Pattern ${patternId} is increasing rapidly (rate: ${trend.rateOfChange.toFixed(2)})`,
          timestamp: now,
          patternId,
        });
      }
    }

    // Check for becoming systemic
    if (records.length >= 2) {
      const prevRecord = records[records.length - 2]!;
      // Check if went from non-systemic to systemic frequency
      if (prevRecord.frequency < 3 && lastRecord.frequency >= 3) {
        alerts.push({
          type: 'became_systemic',
          message: `Pattern ${patternId} has become systemic`,
          timestamp: now,
          patternId,
        });
      }
    }

    return alerts;
  }

  /**
   * Get all tracked pattern IDs.
   *
   * @returns Array of pattern IDs
   */
  getAllTracked(): string[] {
    return Array.from(this.history.keys());
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Calculate base severity from frequency.
   */
  private calculateBaseSeverity(frequency: number): number {
    return frequency;
  }

  /**
   * Calculate recency modifier for severity.
   *
   * Recent patterns are considered more severe.
   */
  private calculateRecencyModifier(pattern: IssuePattern): number {
    const now = new Date().getTime();
    const lastOccurrence = new Date(pattern.lastOccurrence).getTime();
    const daysSinceLastOccurrence = (now - lastOccurrence) / (1000 * 60 * 60 * 24);

    // Recent issues (within last 7 days) get a boost
    if (daysSinceLastOccurrence < 7) {
      return 1.2;
    } else if (daysSinceLastOccurrence < 30) {
      return 1.0;
    }
    // Older issues are slightly less severe
    return 0.9;
  }

  /**
   * Calculate rate of change using frequency deltas.
   */
  private calculateRateOfChange(records: FrequencyRecord[]): number {
    if (records.length < 2) {
      return 0;
    }

    // Calculate average change per record
    let totalChange = 0;
    for (let i = 1; i < records.length; i++) {
      totalChange += records[i]!.frequency - records[i - 1]!.frequency;
    }

    return totalChange / (records.length - 1);
  }

  /**
   * Determine trend direction from rate of change.
   */
  private determineDirection(rateOfChange: number): TrendDirection {
    const threshold = 0.1; // Small changes are considered stable

    if (rateOfChange > threshold) {
      return 'increasing';
    } else if (rateOfChange < -threshold) {
      return 'decreasing';
    }
    return 'stable';
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new PatternTracker instance.
 *
 * @returns PatternTracker instance
 */
export function createPatternTracker(): PatternTracker {
  return new PatternTracker();
}
