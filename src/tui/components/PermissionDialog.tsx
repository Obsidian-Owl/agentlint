/**
 * PermissionDialog Component
 *
 * Displays a permission request dialog with session/permanent choice options.
 * Supports keyboard shortcuts for quick decisions.
 *
 * @module tui/components
 */

import React, { useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import type { PermissionDialogProps, PermissionDecision, PermissionScope } from '../types';

// =============================================================================
// Component
// =============================================================================

/**
 * Permission dialog component for tool authorization requests.
 *
 * Displays the tool name, description, and optional pattern, with
 * keyboard shortcuts for session/permanent allow or deny.
 *
 * @param props - Dialog properties
 * @returns React element
 */
export function PermissionDialog({
  tool,
  description,
  pattern,
  onDecision,
}: PermissionDialogProps): React.ReactElement {
  /**
   * Create a permission decision and invoke callback.
   */
  const makeDecision = useCallback(
    (allowed: boolean, scope: PermissionScope) => {
      const decision: PermissionDecision = {
        allowed,
        scope,
        grantedAt: new Date().toISOString(),
        tool,
        pattern: pattern ?? null,
      };
      onDecision(decision);
    },
    [tool, pattern, onDecision]
  );

  /**
   * Handle keyboard input for permission decisions.
   */
  useInput(
    useCallback(
      (input: string, _key: { escape?: boolean }) => {
        switch (input.toLowerCase()) {
          case 'y':
            // Session allow
            makeDecision(true, 'session');
            break;
          case 'a':
            // Permanent allow
            makeDecision(true, 'permanent');
            break;
          case 'n':
            // Deny
            makeDecision(false, 'session');
            break;
        }
      },
      [makeDecision]
    )
  );

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="yellow">
          Permission Request
        </Text>
      </Box>

      {/* Tool info */}
      <Box marginBottom={1} flexDirection="column">
        <Box>
          <Text bold>Tool: </Text>
          <Text color="cyan">{tool}</Text>
        </Box>
        <Box>
          <Text dimColor>{description}</Text>
        </Box>
        {pattern && (
          <Box marginTop={1}>
            <Text bold>Pattern: </Text>
            <Text color="magenta">{pattern}</Text>
          </Box>
        )}
      </Box>

      {/* Options */}
      <Box flexDirection="column" marginTop={1}>
        <Box>
          <Text bold color="green">
            [y]
          </Text>
          <Text> Allow for this session</Text>
        </Box>
        <Box>
          <Text bold color="green">
            [a]
          </Text>
          <Text> Always allow (permanent)</Text>
        </Box>
        <Box>
          <Text bold color="red">
            [n]
          </Text>
          <Text> Deny</Text>
        </Box>
      </Box>
    </Box>
  );
}
