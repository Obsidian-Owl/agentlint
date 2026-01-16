/**
 * EP04 CLI Interface - FindingsList Component
 *
 * Implements FR-005: Display findings as they are discovered.
 *
 * Displays a list of analysis findings with:
 * - Severity indicators with color coding
 * - Finding title and type
 * - Optional location information
 * - Optional recommendations
 *
 * @module cli/components/FindingsList
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { Finding, Severity } from '../../orchestration';
import { useColors } from '../utils/colors';

/**
 * Props for the FindingsList component.
 */
export interface FindingsListProps {
  /** List of findings to display */
  findings: Finding[];
  /** Show empty state message when no findings (default: false) */
  showEmpty?: boolean;
  /** Use compact display mode (default: false) */
  compact?: boolean;
  /** Show recommendations (default: false) */
  showRecommendations?: boolean;
}

/**
 * Get color for severity level.
 *
 * @param severity - The severity level
 * @param colors - Color map from useColors
 * @returns Color string for the severity
 */
function getSeverityColor(severity: Severity, colors: ReturnType<typeof useColors>): string {
  switch (severity) {
    case 'critical':
      return colors.error;
    case 'high':
      return colors.error;
    case 'medium':
      return colors.warning;
    case 'low':
      return colors.info;
    case 'info':
      return colors.dim;
    default:
      return colors.text;
  }
}

/**
 * Get severity indicator symbol.
 *
 * @param severity - The severity level
 * @returns Symbol for the severity
 */
function getSeveritySymbol(severity: Severity): string {
  switch (severity) {
    case 'critical':
      return '!!!';
    case 'high':
      return '!!';
    case 'medium':
      return '!';
    case 'low':
      return '~';
    case 'info':
      return 'i';
    default:
      return '-';
  }
}

/**
 * Format location for display.
 *
 * @param location - The location object
 * @returns Formatted location string
 */
function formatLocation(location: Finding['location']): string | null {
  if (!location) return null;
  const { file, line, column } = location;
  if (line !== undefined && column !== undefined) {
    return `${file}:${line}:${column}`;
  }
  if (line !== undefined) {
    return `${file}:${line}`;
  }
  return file;
}

/**
 * Single finding item component.
 */
function FindingItem({
  finding,
  compact,
  showRecommendations,
  colors,
}: {
  finding: Finding;
  compact: boolean;
  showRecommendations: boolean;
  colors: ReturnType<typeof useColors>;
}): React.ReactElement {
  const severityColor = getSeverityColor(finding.severity, colors);
  const severitySymbol = getSeveritySymbol(finding.severity);
  const location = formatLocation(finding.location);

  if (compact) {
    return (
      <Box>
        <Text color={severityColor}>[{severitySymbol}]</Text>
        <Text> </Text>
        <Text bold>{finding.title}</Text>
        {location && <Text color={colors.dim}> ({location})</Text>}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color={severityColor} bold>
          [{finding.severity.toUpperCase()}]
        </Text>
        <Text> </Text>
        <Text bold>{finding.title}</Text>
      </Box>
      {location && (
        <Box marginLeft={2}>
          <Text color={colors.dim}>at {location}</Text>
        </Box>
      )}
      <Box marginLeft={2}>
        <Text>{finding.description}</Text>
      </Box>
      {showRecommendations && finding.recommendations.length > 0 && (
        <Box flexDirection="column" marginLeft={2} marginTop={1}>
          <Text color={colors.success} bold>
            Recommendations:
          </Text>
          {finding.recommendations.map((rec, idx) => (
            <Box key={idx} marginLeft={2}>
              <Text color={colors.dim}>• </Text>
              <Text>{rec.action}</Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

/**
 * FindingsList component for displaying analysis findings.
 *
 * Renders a list of findings with severity indicators, titles,
 * locations, and optional recommendations.
 *
 * @example
 * ```tsx
 * <FindingsList findings={findings} />
 * <FindingsList findings={findings} compact={true} />
 * <FindingsList findings={findings} showRecommendations={true} />
 * ```
 */
export function FindingsList({
  findings,
  showEmpty = false,
  compact = false,
  showRecommendations = false,
}: FindingsListProps): React.ReactElement {
  const colors = useColors();

  if (findings.length === 0) {
    if (showEmpty) {
      return (
        <Box>
          <Text color={colors.success}>No findings discovered.</Text>
        </Box>
      );
    }
    return <Box />;
  }

  return (
    <Box flexDirection="column">
      {findings.map((finding) => (
        <FindingItem
          key={finding.id}
          finding={finding}
          compact={compact}
          showRecommendations={showRecommendations}
          colors={colors}
        />
      ))}
    </Box>
  );
}

export default FindingsList;
