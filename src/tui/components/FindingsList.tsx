/**
 * FindingsList Component
 *
 * Displays a list of analysis findings with severity indicators,
 * keyboard navigation, and selection support.
 * Enhanced from cli/components for TUI architecture (EP17).
 *
 * @module tui/components/FindingsList
 */

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Finding, Severity } from '../../orchestration';
import { useColors } from '../../cli/utils/colors';

// =============================================================================
// Types
// =============================================================================

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
  /** Enable keyboard navigation (default: false) */
  interactive?: boolean;
  /** Callback when a finding is selected */
  onSelect?: (finding: Finding) => void;
  /** Currently selected index (controlled mode) */
  selectedIndex?: number;
  /** Callback when selection changes (controlled mode) */
  onSelectionChange?: (index: number) => void;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Get color for severity level.
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

// =============================================================================
// Sub-components
// =============================================================================

/**
 * Single finding item component.
 */
function FindingItem({
  finding,
  compact,
  showRecommendations,
  colors,
  isSelected,
  index,
}: {
  finding: Finding;
  compact: boolean;
  showRecommendations: boolean;
  colors: ReturnType<typeof useColors>;
  isSelected: boolean;
  index: number;
}): React.ReactElement {
  const severityColor = getSeverityColor(finding.severity, colors);
  const severitySymbol = getSeveritySymbol(finding.severity);
  const location = formatLocation(finding.location);

  // Selection indicator
  const selectionIndicator = isSelected ? (
    <Text color="cyan" bold>
      {'> '}
    </Text>
  ) : (
    <Text>{'  '}</Text>
  );

  // Index indicator (1-9 for quick selection)
  const indexIndicator = index < 9 ? <Text dimColor>[{index + 1}] </Text> : <Text dimColor> </Text>;

  if (compact) {
    return (
      <Box>
        {selectionIndicator}
        {indexIndicator}
        <Text color={severityColor}>[{severitySymbol}]</Text>
        <Text> </Text>
        <Text bold={isSelected}>{finding.title}</Text>
        {location && <Text color={colors.dim}> ({location})</Text>}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        {selectionIndicator}
        {indexIndicator}
        <Text color={severityColor} bold>
          [{finding.severity.toUpperCase()}]
        </Text>
        <Text> </Text>
        <Text bold={isSelected}>{finding.title}</Text>
      </Box>
      {location && (
        <Box marginLeft={4}>
          <Text color={colors.dim}>at {location}</Text>
        </Box>
      )}
      <Box marginLeft={4}>
        <Text>{finding.description}</Text>
      </Box>
      {showRecommendations && finding.recommendations.length > 0 && (
        <Box flexDirection="column" marginLeft={4} marginTop={1}>
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

// =============================================================================
// Component
// =============================================================================

/**
 * FindingsList component with keyboard navigation.
 *
 * Enhanced with:
 * - j/k or arrow keys for navigation
 * - 1-9 for quick selection
 * - Enter to select/activate
 * - Visual selection indicator
 *
 * @example
 * ```tsx
 * <FindingsList findings={findings} />
 * <FindingsList findings={findings} interactive onSelect={handleSelect} />
 * ```
 */
export function FindingsList({
  findings,
  showEmpty = false,
  compact = false,
  showRecommendations = false,
  interactive = false,
  onSelect,
  selectedIndex: controlledIndex,
  onSelectionChange,
}: FindingsListProps): React.ReactElement {
  const colors = useColors();
  const [internalIndex, setInternalIndex] = useState(0);

  // Use controlled or internal state
  const selectedIndex = controlledIndex ?? internalIndex;
  const setSelectedIndex = onSelectionChange ?? setInternalIndex;

  // Handle keyboard input
  useInput(
    useCallback(
      (input: string, key: { upArrow?: boolean; downArrow?: boolean; return?: boolean }) => {
        if (findings.length === 0) return;

        // Navigation
        if (input === 'j' || key.downArrow) {
          const newIndex = Math.min(selectedIndex + 1, findings.length - 1);
          setSelectedIndex(newIndex);
          return;
        }
        if (input === 'k' || key.upArrow) {
          const newIndex = Math.max(selectedIndex - 1, 0);
          setSelectedIndex(newIndex);
          return;
        }

        // Quick select with numbers 1-9
        const num = parseInt(input, 10);
        if (!isNaN(num) && num >= 1 && num <= 9) {
          const targetIndex = num - 1;
          if (targetIndex < findings.length) {
            setSelectedIndex(targetIndex);
            onSelect?.(findings[targetIndex]!);
          }
          return;
        }

        // Enter to select
        if (key.return && findings[selectedIndex]) {
          onSelect?.(findings[selectedIndex]);
        }
      },
      [findings, selectedIndex, setSelectedIndex, onSelect]
    ),
    { isActive: interactive }
  );

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
      {findings.map((finding, index) => (
        <FindingItem
          key={finding.id}
          finding={finding}
          compact={compact}
          showRecommendations={showRecommendations}
          colors={colors}
          isSelected={interactive && index === selectedIndex}
          index={index}
        />
      ))}
      {interactive && (
        <Box marginTop={1}>
          <Text dimColor>j/k: navigate | 1-9: quick select | Enter: view details</Text>
        </Box>
      )}
    </Box>
  );
}

export default FindingsList;
