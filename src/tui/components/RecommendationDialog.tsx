/**
 * RecommendationDialog Component
 *
 * Displays a recommendation with accept/dismiss/defer action options.
 * Supports keyboard shortcuts for quick decisions.
 *
 * @module tui/components
 */

import React, { useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import type { RecommendationDialogProps } from '../types';

// =============================================================================
// Helpers
// =============================================================================

/**
 * Get color for recommendation type.
 */
function getTypeColor(type: 'symptomatic' | 'preventive' | 'systemic'): string {
  switch (type) {
    case 'symptomatic':
      return 'yellow';
    case 'preventive':
      return 'cyan';
    case 'systemic':
      return 'magenta';
  }
}

/**
 * Get color for priority level.
 */
function getPriorityColor(priority: 'high' | 'medium' | 'low'): string {
  switch (priority) {
    case 'high':
      return 'red';
    case 'medium':
      return 'yellow';
    case 'low':
      return 'green';
  }
}

// =============================================================================
// Component
// =============================================================================

/**
 * Recommendation dialog component for action decisions.
 *
 * Displays the recommendation details with keyboard shortcuts
 * for accept, dismiss, or defer actions.
 *
 * @param props - Dialog properties
 * @returns React element
 */
export function RecommendationDialog({
  recommendation,
  onAction,
}: RecommendationDialogProps): React.ReactElement {
  const { type, action, rationale, priority, effort } = recommendation;

  /**
   * Handle keyboard input for action decisions.
   */
  useInput(
    useCallback(
      (input: string, key: { escape?: boolean; return?: boolean }) => {
        const lowered = input.toLowerCase();

        // Accept
        if (lowered === 'a' || lowered === 'y' || key.return) {
          onAction('accept');
          return;
        }

        // Dismiss
        if (lowered === 'n' || lowered === 'x') {
          onAction('dismiss');
          return;
        }

        // Defer
        if (lowered === 'd' || key.escape) {
          onAction('defer');
          return;
        }
      },
      [onAction]
    )
  );

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Recommendation
        </Text>
      </Box>

      {/* Metadata */}
      <Box marginBottom={1} gap={2}>
        <Box>
          <Text bold>Type: </Text>
          <Text color={getTypeColor(type)}>{type}</Text>
        </Box>
        <Box>
          <Text bold>Priority: </Text>
          <Text color={getPriorityColor(priority)}>{priority}</Text>
        </Box>
        {effort && (
          <Box>
            <Text bold>Effort: </Text>
            <Text>{effort}</Text>
          </Box>
        )}
      </Box>

      {/* Action */}
      <Box marginBottom={1} flexDirection="column">
        <Text bold>Action:</Text>
        <Box marginLeft={2}>
          <Text>{action}</Text>
        </Box>
      </Box>

      {/* Rationale */}
      <Box marginBottom={1} flexDirection="column">
        <Text bold>Rationale:</Text>
        <Box marginLeft={2}>
          <Text dimColor>{rationale}</Text>
        </Box>
      </Box>

      {/* Options */}
      <Box flexDirection="column" marginTop={1}>
        <Box>
          <Text bold color="green">
            [a/Enter]
          </Text>
          <Text> Accept</Text>
        </Box>
        <Box>
          <Text bold color="red">
            [n/x]
          </Text>
          <Text> Dismiss</Text>
        </Box>
        <Box>
          <Text bold color="yellow">
            [d/Esc]
          </Text>
          <Text> Defer</Text>
        </Box>
      </Box>
    </Box>
  );
}
