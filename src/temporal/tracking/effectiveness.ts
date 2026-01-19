/**
 * EP09 Temporal Analysis - Effectiveness Data Provider
 *
 * Provides pre/post baseline pair data for agent effectiveness reasoning.
 * Per ADR-0019, returns raw data - agent interprets causality and effectiveness.
 *
 * @module temporal/tracking/effectiveness
 */

import type { Baseline } from '../../persistence/types';
import type { MetricChange } from '../types';

// =============================================================================
// Types
// =============================================================================

/**
 * Evidence for recommendation effectiveness analysis.
 *
 * Per ADR-0019, provides raw data for agent interpretation.
 * Agent determines:
 * - Whether metric changes indicate effectiveness
 * - Causality between recommendation and outcomes
 * - Overall effectiveness assessment
 */
export interface EffectivenessData {
  /** Pre-implementation baseline identifier */
  preBaselineId: string;
  /** Post-implementation baseline identifier */
  postBaselineId: string;
  /** Time elapsed between baselines (ISO 8601 duration or ms) */
  timeDelta: number;
  /** Pre-implementation timestamp */
  preTimestamp: string;
  /** Post-implementation timestamp */
  postTimestamp: string;
  /** Metric changes between baselines */
  metricChanges: MetricChange[];
  /** Total number of metrics compared */
  metricsCompared: number;
  /** Findings count before */
  findingsCountBefore: number;
  /** Findings count after */
  findingsCountAfter: number;
  /** Critical findings before */
  criticalCountBefore: number;
  /** Critical findings after */
  criticalCountAfter: number;
  /** Git commits between baselines (if available) */
  gitCommitsBetween: string[];
  /** Config changes detected */
  configChanged: boolean;
}

/**
 * Options for effectiveness data extraction.
 */
export interface EffectivenessOptions {
  /** Include only specified metrics */
  includeMetrics?: string[];
  /** Exclude specified metrics */
  excludeMetrics?: string[];
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Extract effectiveness data from pre/post baseline pair.
 *
 * Per ADR-0019 (Tool/Agent Boundary):
 * - This function provides DATA (metric changes, timestamps)
 * - Agent provides JUDGMENT (causality, effectiveness scoring)
 *
 * @param preBaseline - Baseline captured before recommendation implementation
 * @param postBaseline - Baseline captured after recommendation implementation
 * @param options - Optional filtering options
 * @returns Structured effectiveness data for agent analysis
 *
 * @example
 * ```typescript
 * const data = getEffectivenessData(beforeBaseline, afterBaseline);
 *
 * // Agent interprets: "findings decreased from 25 to 10 after implementing
 * // the recommendation - likely effective"
 * ```
 */
export function getEffectivenessData(
  preBaseline: Baseline,
  postBaseline: Baseline,
  options: EffectivenessOptions = {}
): EffectivenessData {
  // Calculate time delta in milliseconds
  const preDate = new Date(preBaseline.createdAt);
  const postDate = new Date(postBaseline.createdAt);
  const timeDelta = postDate.getTime() - preDate.getTime();

  // Extract metric changes
  const metricChanges = extractMetricChanges(preBaseline, postBaseline, options);

  // Detect config changes
  const configChanged = preBaseline.configPath !== postBaseline.configPath;

  // Extract git commits between baselines
  const gitCommitsBetween = extractGitCommitsBetween(preBaseline, postBaseline);

  return {
    preBaselineId: preBaseline.id,
    postBaselineId: postBaseline.id,
    timeDelta,
    preTimestamp: preBaseline.createdAt,
    postTimestamp: postBaseline.createdAt,
    metricChanges,
    metricsCompared: metricChanges.length,
    findingsCountBefore: preBaseline.metrics.findingsCount,
    findingsCountAfter: postBaseline.metrics.findingsCount,
    criticalCountBefore: preBaseline.metrics.criticalCount,
    criticalCountAfter: postBaseline.metrics.criticalCount,
    gitCommitsBetween,
    configChanged,
  };
}

/**
 * Check if effectiveness data indicates potential improvement.
 *
 * Per ADR-0019, this returns raw statistics, not a judgment.
 * Agent interprets whether the statistics indicate improvement.
 *
 * @param data - Effectiveness data to analyze
 * @returns Statistics about metric changes
 */
export function getEffectivenessStats(data: EffectivenessData): {
  metricsImproved: number;
  metricsRegressed: number;
  metricsUnchanged: number;
  findingsDelta: number;
  criticalDelta: number;
} {
  let metricsImproved = 0;
  let metricsRegressed = 0;
  let metricsUnchanged = 0;

  // Count by direction (agent interprets what "improved" means per metric)
  for (const change of data.metricChanges) {
    if (change.direction === '↓') {
      metricsImproved++; // Note: this is a raw count, agent decides if decrease = improvement
    } else if (change.direction === '↑') {
      metricsRegressed++;
    } else {
      metricsUnchanged++;
    }
  }

  return {
    metricsImproved,
    metricsRegressed,
    metricsUnchanged,
    findingsDelta: data.findingsCountAfter - data.findingsCountBefore,
    criticalDelta: data.criticalCountAfter - data.criticalCountBefore,
  };
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Extract metric changes between two baselines.
 */
function extractMetricChanges(
  preBaseline: Baseline,
  postBaseline: Baseline,
  options: EffectivenessOptions
): MetricChange[] {
  const changes: MetricChange[] = [];
  const preMetrics = preBaseline.metrics;
  const postMetrics = postBaseline.metrics;

  // Get all metric keys
  const allKeys = new Set([...Object.keys(preMetrics), ...Object.keys(postMetrics)]);

  for (const key of allKeys) {
    // Apply filters
    if (options.includeMetrics && !options.includeMetrics.includes(key)) {
      continue;
    }
    if (options.excludeMetrics && options.excludeMetrics.includes(key)) {
      continue;
    }

    const fromValue = (preMetrics as unknown as Record<string, number | undefined>)[key] ?? 0;
    const toValue = (postMetrics as unknown as Record<string, number | undefined>)[key] ?? 0;

    // Skip if both are undefined or NaN
    if (typeof fromValue !== 'number' || typeof toValue !== 'number') {
      continue;
    }

    const change = toValue - fromValue;
    const percentChange =
      fromValue !== 0 ? ((toValue - fromValue) / fromValue) * 100 : toValue !== 0 ? 100 : 0;

    // Determine direction
    let direction: '↑' | '↓' | '→';
    if (Math.abs(change) < 0.001) {
      direction = '→';
    } else if (change > 0) {
      direction = '↑';
    } else {
      direction = '↓';
    }

    changes.push({
      name: key,
      from: fromValue,
      to: toValue,
      change,
      percentChange,
      direction,
    });
  }

  return changes;
}

/**
 * Extract git commits between two baselines.
 *
 * Note: This is a simple implementation. A full implementation would
 * use git log to find commits between the two commit hashes.
 */
function extractGitCommitsBetween(preBaseline: Baseline, postBaseline: Baseline): string[] {
  const commits: string[] = [];

  // If we have both git commits, note them
  if (preBaseline.gitCommit && postBaseline.gitCommit) {
    if (preBaseline.gitCommit !== postBaseline.gitCommit) {
      // Just note the commits - full git log integration is in T044
      commits.push(preBaseline.gitCommit);
      commits.push(postBaseline.gitCommit);
    }
  }

  return commits;
}
