/**
 * EP04 CLI Interface - CompareView Component
 *
 * Implements FR-009: Show delta with +/- indicators.
 *
 * Displays a comparison between two baselines showing:
 * - Delta metrics (improved/regressed)
 * - Severity breakdown changes
 * - Overall trend classification
 *
 * @module cli/components/CompareView
 */

import React from 'react';
import { Box, Text } from 'ink';
import { useColors } from '../utils/colors';
import type { BaselineMetrics } from '../../persistence/types';

/**
 * Baseline summary for comparison display.
 */
export interface BaselineSummary {
  /** Baseline ID */
  id: string;
  /** User-assigned label (or null) */
  label: string | null;
  /** ISO-8601 creation timestamp */
  createdAt: string;
  /** Aggregated metrics */
  metrics: BaselineMetrics;
}

/**
 * Comparison data for display.
 */
export interface ComparisonData {
  /** The older baseline */
  from: BaselineSummary;
  /** The newer baseline */
  to: BaselineSummary;
  /** Delta in metrics (to - from) */
  delta: BaselineMetrics;
  /** Overall trend classification */
  trend: 'improved' | 'regressed' | 'unchanged';
}

/**
 * Props for the CompareView component.
 */
export interface CompareViewProps {
  /** Comparison data to display */
  comparison: ComparisonData;
  /** Use compact display mode (default: false) */
  compact?: boolean | undefined;
  /** Show timestamps for baselines (default: false) */
  showTimestamps?: boolean | undefined;
}

/**
 * Delta indicator characters.
 */
const INDICATORS = {
  improved: '↓',
  regressed: '↑',
  unchanged: '→',
} as const;

/**
 * Get display name for a baseline.
 */
function getBaselineName(baseline: BaselineSummary): string {
  return baseline.label ?? baseline.id.slice(0, 8);
}

/**
 * Format a delta value with indicator.
 */
function formatDelta(value: number, invertColor: boolean = false): { text: string; color: string } {
  if (value === 0) {
    return { text: '0', color: 'gray' };
  }

  const sign = value > 0 ? '+' : '';
  const text = `${sign}${value}`;

  // For findings, negative is good (fewer issues), positive is bad
  // invertColor is used for cases where increase might be good
  if (invertColor) {
    return {
      text,
      color: value > 0 ? 'green' : 'red',
    };
  }

  return {
    text,
    color: value < 0 ? 'green' : 'red',
  };
}

/**
 * Format ISO timestamp for display.
 */
function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * MetricRow component for displaying a single metric comparison.
 */
interface MetricRowProps {
  label: string;
  fromValue: number;
  toValue: number;
  delta: number;
  colors: ReturnType<typeof useColors>;
}

function MetricRow({
  label,
  fromValue,
  toValue,
  delta,
  colors,
}: MetricRowProps): React.ReactElement {
  const deltaInfo = formatDelta(delta);

  return (
    <Box>
      <Box width={12}>
        <Text>{label}:</Text>
      </Box>
      <Box width={6}>
        <Text color={colors.dim}>{fromValue}</Text>
      </Box>
      <Text color={colors.dim}> → </Text>
      <Box width={6}>
        <Text>{toValue}</Text>
      </Box>
      <Text> (</Text>
      <Text color={deltaInfo.color}>{deltaInfo.text}</Text>
      <Text>)</Text>
    </Box>
  );
}

/**
 * CompareView component for displaying baseline comparison.
 *
 * Shows the difference between two baselines with:
 * - Overall trend indicator
 * - Total findings delta
 * - Severity breakdown changes
 *
 * @example
 * ```tsx
 * <CompareView
 *   comparison={{
 *     from: { id: 'abc', label: 'before', createdAt: '...', metrics: {...} },
 *     to: { id: 'def', label: 'after', createdAt: '...', metrics: {...} },
 *     delta: { findingsCount: -5, ... },
 *     trend: 'improved'
 *   }}
 * />
 * ```
 */
export function CompareView({
  comparison,
  compact = false,
  showTimestamps = false,
}: CompareViewProps): React.ReactElement {
  const colors = useColors();
  const { from, to, delta, trend } = comparison;

  // Determine trend styling
  const trendColor =
    trend === 'improved' ? colors.success : trend === 'regressed' ? colors.error : colors.dim;
  const trendIcon = INDICATORS[trend];
  const trendLabel = trend.charAt(0).toUpperCase() + trend.slice(1);

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold>Baseline Comparison</Text>
      </Box>

      {/* Baseline info */}
      <Box flexDirection="column" marginBottom={1}>
        <Box>
          <Text color={colors.dim}>From: </Text>
          <Text bold>{getBaselineName(from)}</Text>
          {showTimestamps && <Text color={colors.dim}> ({formatTimestamp(from.createdAt)})</Text>}
        </Box>
        <Box>
          <Text color={colors.dim}>To: </Text>
          <Text bold>{getBaselineName(to)}</Text>
          {showTimestamps && <Text color={colors.dim}> ({formatTimestamp(to.createdAt)})</Text>}
        </Box>
      </Box>

      {/* Trend indicator */}
      <Box marginBottom={1}>
        <Text>Status: </Text>
        <Text color={trendColor} bold>
          {trendIcon} {trendLabel}
        </Text>
      </Box>

      {/* Total findings delta */}
      <Box marginBottom={1}>
        <Text>Total Findings: </Text>
        <Text color={colors.dim}>{from.metrics.findingsCount}</Text>
        <Text color={colors.dim}> → </Text>
        <Text>{to.metrics.findingsCount}</Text>
        <Text> (</Text>
        <Text color={formatDelta(delta.findingsCount).color}>
          {formatDelta(delta.findingsCount).text}
        </Text>
        <Text>)</Text>
      </Box>

      {/* Severity breakdown (full mode) */}
      {!compact && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color={colors.dim}>Severity Breakdown:</Text>
          </Box>
          <Box flexDirection="column" marginLeft={2}>
            {delta.criticalCount !== 0 ||
            from.metrics.criticalCount > 0 ||
            to.metrics.criticalCount > 0 ? (
              <MetricRow
                label="Critical"
                fromValue={from.metrics.criticalCount}
                toValue={to.metrics.criticalCount}
                delta={delta.criticalCount}
                colors={colors}
              />
            ) : null}
            {delta.highCount !== 0 || from.metrics.highCount > 0 || to.metrics.highCount > 0 ? (
              <MetricRow
                label="High"
                fromValue={from.metrics.highCount}
                toValue={to.metrics.highCount}
                delta={delta.highCount}
                colors={colors}
              />
            ) : null}
            {delta.mediumCount !== 0 ||
            from.metrics.mediumCount > 0 ||
            to.metrics.mediumCount > 0 ? (
              <MetricRow
                label="Medium"
                fromValue={from.metrics.mediumCount}
                toValue={to.metrics.mediumCount}
                delta={delta.mediumCount}
                colors={colors}
              />
            ) : null}
            {delta.lowCount !== 0 || from.metrics.lowCount > 0 || to.metrics.lowCount > 0 ? (
              <MetricRow
                label="Low"
                fromValue={from.metrics.lowCount}
                toValue={to.metrics.lowCount}
                delta={delta.lowCount}
                colors={colors}
              />
            ) : null}
            {delta.infoCount !== 0 || from.metrics.infoCount > 0 || to.metrics.infoCount > 0 ? (
              <MetricRow
                label="Info"
                fromValue={from.metrics.infoCount}
                toValue={to.metrics.infoCount}
                delta={delta.infoCount}
                colors={colors}
              />
            ) : null}
          </Box>
        </Box>
      )}
    </Box>
  );
}

export default CompareView;
