/**
 * EP09 Temporal Analysis - Configuration
 *
 * Manages threshold configuration for temporal analysis.
 * Loads from ~/.agentlint/config.json with sensible defaults.
 *
 * @module temporal/config
 */

import { homedir } from 'os';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';

import type { ThresholdConfig, MetricThreshold } from './types';
import { ConfigurationError } from './errors';

// =============================================================================
// Default Configuration
// =============================================================================

/**
 * Default threshold configuration per spec.md Q4 resolution.
 * Default 5% threshold for percentage-based metrics.
 */
export const DEFAULT_THRESHOLD_CONFIG: ThresholdConfig = {
  default: 0.05, // 5% change threshold
  metricOverrides: {
    // Absolute thresholds for discrete metrics
    warningCount: { absolute: 1, inverted: true },
    criticalCount: { absolute: 1, inverted: true },
    highCount: { absolute: 1, inverted: true },
    // Higher tolerance for token metrics (naturally volatile)
    avgTokensPerSession: { percentage: 0.1, inverted: true },
    configTokens: { percentage: 0.1, inverted: false },
    // Coverage score uses absolute threshold
    coverageScore: { absolute: 5, inverted: false },
  },
};

/**
 * Metrics where lower values are generally considered better.
 *
 * Per ADR-0019, this is provided as OPTIONAL context for the agent.
 * The agent ultimately decides whether a change is an improvement
 * based on project context, user goals, and semantic understanding.
 *
 * Tools should NOT use this to make judgment calls - only to provide
 * context to the agent when requested.
 */
export const INVERTED_METRICS = new Set([
  'warningCount',
  'criticalCount',
  'highCount',
  'mediumCount',
  'lowCount',
  'findingsCount',
  'avgTokensPerSession',
  'errorRate',
  'avgIterationsPerSession',
]);

// =============================================================================
// Configuration Loading
// =============================================================================

/**
 * Get the path to the global config file.
 */
export function getGlobalConfigPath(): string {
  return join(homedir(), '.agentlint', 'config.json');
}

/**
 * Load threshold configuration from ~/.agentlint/config.json.
 * Falls back to defaults if file doesn't exist or lacks temporal config.
 *
 * @returns Merged threshold configuration
 */
export function loadThresholdConfig(): ThresholdConfig {
  const configPath = getGlobalConfigPath();

  if (!existsSync(configPath)) {
    return DEFAULT_THRESHOLD_CONFIG;
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content) as {
      temporal?: {
        thresholds?: Partial<ThresholdConfig>;
      };
    };

    if (!config.temporal?.thresholds) {
      return DEFAULT_THRESHOLD_CONFIG;
    }

    // Merge user config with defaults
    return mergeThresholdConfig(DEFAULT_THRESHOLD_CONFIG, config.temporal.thresholds);
  } catch (error) {
    throw new ConfigurationError(
      `Failed to parse config at ${configPath}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Merge user threshold config with defaults.
 * User config overrides default values.
 */
function mergeThresholdConfig(
  defaults: ThresholdConfig,
  userConfig: Partial<ThresholdConfig>
): ThresholdConfig {
  const merged: ThresholdConfig = {
    default: userConfig.default ?? defaults.default,
    metricOverrides: { ...defaults.metricOverrides },
  };

  // Merge metric overrides
  if (userConfig.metricOverrides) {
    for (const [metric, override] of Object.entries(userConfig.metricOverrides)) {
      merged.metricOverrides![metric] = override;
    }
  }

  return merged;
}

// =============================================================================
// Threshold Resolution
// =============================================================================

/**
 * Get the threshold for a specific metric.
 *
 * @param metricName - Name of the metric
 * @param config - Threshold configuration
 * @returns Resolved threshold value (percentage or absolute)
 */
export function getThresholdForMetric(
  metricName: string,
  config: ThresholdConfig = DEFAULT_THRESHOLD_CONFIG
): MetricThreshold {
  const override = config.metricOverrides?.[metricName];

  if (override === undefined) {
    // No override, use default percentage threshold
    const isInverted = INVERTED_METRICS.has(metricName);
    return {
      percentage: config.default,
      inverted: isInverted,
    };
  }

  if (typeof override === 'number') {
    // Simple number override is treated as absolute threshold
    const isInverted = INVERTED_METRICS.has(metricName);
    return {
      absolute: override,
      inverted: isInverted,
    };
  }

  // Full MetricThreshold object
  return {
    ...override,
    // Default inverted based on metric name if not specified
    inverted: override.inverted ?? INVERTED_METRICS.has(metricName),
  };
}

/**
 * Check if a change exceeds the significance threshold.
 *
 * @param from - Previous value
 * @param to - Current value
 * @param metricName - Name of the metric
 * @param config - Threshold configuration
 * @returns Whether the change is significant
 */
export function isSignificantChange(
  from: number,
  to: number,
  metricName: string,
  config: ThresholdConfig = DEFAULT_THRESHOLD_CONFIG
): boolean {
  const threshold = getThresholdForMetric(metricName, config);
  const absoluteChange = Math.abs(to - from);

  if (threshold.absolute !== undefined) {
    return absoluteChange >= threshold.absolute;
  }

  if (threshold.percentage !== undefined) {
    // Avoid division by zero
    if (from === 0) {
      return to !== 0;
    }
    const percentChange = absoluteChange / Math.abs(from);
    return percentChange >= threshold.percentage;
  }

  // Fallback to default percentage
  if (from === 0) {
    return to !== 0;
  }
  return Math.abs(to - from) / Math.abs(from) >= config.default;
}

// =============================================================================
// Note: isImprovement() was removed per ADR-0019
// =============================================================================
//
// The isImprovement() function was removed because determining whether a
// change is an "improvement" is a JUDGMENT call that should be made by the
// agent, not by tool code.
//
// The agent can use INVERTED_METRICS as optional context, but ultimately
// decides based on:
// - Project-specific goals
// - User preferences
// - Semantic understanding of the change
// - Context that tools cannot access
//
// See ADR-0019: Tool/Agent Boundary for Temporal Analysis
