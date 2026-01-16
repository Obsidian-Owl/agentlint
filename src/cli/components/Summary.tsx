/**
 * EP04 CLI Interface - Summary Component
 *
 * Displays analysis summary at the end of an analysis run.
 * Shows total findings, breakdown by severity, and elapsed time.
 *
 * @module cli/components/Summary
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { Finding, Severity } from '../../orchestration';
import { useColors } from '../utils/colors';

/**
 * Props for the Summary component.
 */
export interface SummaryProps {
  /** List of findings from analysis */
  findings: Finding[];
  /** Elapsed time in milliseconds */
  elapsedMs?: number | undefined;
  /** Whether the analysis completed successfully */
  success?: boolean | undefined;
  /** Error message if analysis failed */
  error?: string | undefined;
}

/**
 * Format elapsed time for display.
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
}

/**
 * Count findings by severity.
 */
function countBySeverity(findings: Finding[]): Record<Severity, number> {
  const counts: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  for (const finding of findings) {
    counts[finding.severity]++;
  }

  return counts;
}

/**
 * Summary component for displaying analysis results.
 *
 * Shows a summary box with:
 * - Total finding count
 * - Breakdown by severity
 * - Elapsed time
 * - Success/failure status
 *
 * @example
 * ```tsx
 * <Summary findings={findings} elapsedMs={5000} success={true} />
 * ```
 */
export function Summary({
  findings,
  elapsedMs,
  success = true,
  error,
}: SummaryProps): React.ReactElement {
  const colors = useColors();
  const counts = countBySeverity(findings);
  const total = findings.length;

  // Determine status color
  const statusColor = success ? colors.success : colors.error;
  const statusText = success ? 'Analysis Complete' : 'Analysis Failed';

  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Header */}
      <Box>
        <Text color={statusColor} bold>
          {statusText}
        </Text>
        {elapsedMs !== undefined && <Text color={colors.dim}> ({formatDuration(elapsedMs)})</Text>}
      </Box>

      {/* Error message if failed */}
      {error && (
        <Box marginTop={1}>
          <Text color={colors.error}>Error: {error}</Text>
        </Box>
      )}

      {/* Finding counts */}
      {success && (
        <Box flexDirection="column" marginTop={1}>
          <Box>
            <Text>
              Found <Text bold>{total}</Text> finding{total !== 1 ? 's' : ''}
            </Text>
          </Box>

          {total > 0 && (
            <Box marginTop={1} flexDirection="column">
              {counts.critical > 0 && (
                <Box>
                  <Text color={colors.error}>Critical: {counts.critical}</Text>
                </Box>
              )}
              {counts.high > 0 && (
                <Box>
                  <Text color={colors.error}>High: {counts.high}</Text>
                </Box>
              )}
              {counts.medium > 0 && (
                <Box>
                  <Text color={colors.warning}>Medium: {counts.medium}</Text>
                </Box>
              )}
              {counts.low > 0 && (
                <Box>
                  <Text color={colors.info}>Low: {counts.low}</Text>
                </Box>
              )}
              {counts.info > 0 && (
                <Box>
                  <Text color={colors.dim}>Info: {counts.info}</Text>
                </Box>
              )}
            </Box>
          )}

          {total === 0 && (
            <Box marginTop={1}>
              <Text color={colors.success}>No issues found. Your configuration looks good!</Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

export default Summary;
