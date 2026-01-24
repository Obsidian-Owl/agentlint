/**
 * Progress Component
 *
 * Displays analysis progress with spinner, phase, percentage, and elapsed time.
 * Moved from cli/components as part of TUI architecture (EP17).
 *
 * @module tui/components/Progress
 */

import React from 'react';
import { Box, Text } from 'ink';
import { Spinner } from '@inkjs/ui';
import { useColors } from '../../cli/utils/colors';

// =============================================================================
// Types
// =============================================================================

/**
 * Props for the Progress component.
 */
export interface ProgressProps {
  /** Current analysis phase */
  phase: string;
  /** Optional custom message */
  message?: string | undefined;
  /** Whether the spinner is active (default: true) */
  isActive?: boolean | undefined;
  /** Optional progress percentage (0-100) */
  percent?: number | undefined;
  /** Optional elapsed time in milliseconds */
  elapsedMs?: number | undefined;
  /** Use plain text mode (no spinner) */
  plainText?: boolean | undefined;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Format elapsed time for display.
 *
 * @param ms - Elapsed time in milliseconds
 * @returns Formatted time string (e.g., "5s", "1m 30s")
 */
function formatElapsedTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Get display name for phase.
 *
 * @param phase - Internal phase name
 * @returns Human-readable phase name
 */
function getPhaseDisplayName(phase: string): string {
  const phaseNames: Record<string, string> = {
    init: 'Initializing',
    scanning: 'Scanning',
    analyzing: 'Analyzing',
    reporting: 'Reporting',
    complete: 'Complete',
    idle: 'Ready',
    presenting: 'Presenting',
    exploring: 'Exploring',
  };
  return phaseNames[phase] ?? phase;
}

// =============================================================================
// Component
// =============================================================================

/**
 * Progress component for displaying analysis progress.
 *
 * Shows a spinner with the current phase, optional percentage,
 * and elapsed time.
 *
 * @example
 * ```tsx
 * <Progress phase="scanning" message="Finding config files..." />
 * <Progress phase="analyzing" percent={50} elapsedMs={5000} />
 * ```
 */
export function Progress({
  phase,
  message,
  isActive = true,
  percent,
  elapsedMs,
  plainText = false,
}: ProgressProps): React.ReactElement {
  const colors = useColors();
  const phaseDisplay = getPhaseDisplayName(phase);

  // Build status text parts
  const parts: string[] = [phaseDisplay];

  if (percent !== undefined) {
    parts.push(`${percent}%`);
  }

  if (elapsedMs !== undefined) {
    parts.push(`(${formatElapsedTime(elapsedMs)})`);
  }

  const statusText = parts.join(' ');

  // Plain text mode (non-TTY or accessibility)
  if (plainText) {
    return (
      <Box>
        <Text>
          [{phase}] {message ?? statusText}
        </Text>
      </Box>
    );
  }

  // Full mode with spinner
  return (
    <Box flexDirection="row" gap={1}>
      {isActive && <Spinner />}
      <Text color={colors.info} bold>
        {statusText}
      </Text>
      {message && <Text color={colors.dim}> - {message}</Text>}
    </Box>
  );
}

export default Progress;
