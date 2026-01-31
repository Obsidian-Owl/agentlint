/**
 * SessionSummary Component
 *
 * Displays a summary of the last session and changes since then.
 * Shows session timing, findings count, and git delta.
 *
 * @module tui/components/SessionSummary
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { GitSummary } from '../welcome/types';
import { sanitizeForTerminal } from '../utils/sanitize';

// =============================================================================
// Types
// =============================================================================

export interface LastSessionInfo {
  /** When the last session occurred */
  sessionDate: Date;
  /** Duration of the session in ms */
  durationMs?: number;
  /** Number of findings from last session */
  findingsCount: number;
  /** Number of recommendations created */
  recommendationsCreated: number;
}

export interface SessionSummaryProps {
  /** Last session info (null if first run) */
  lastSession: LastSessionInfo | null;
  /** Current git summary */
  gitSummary: GitSummary | null;
  /** Number of open recommendations */
  openRecommendations: number;
  /** Commits since last session (null if unknown) */
  commitsSinceLastSession?: number | null;
  /** Files changed since last session (null if unknown) */
  filesChangedSinceLastSession?: number | null;
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30)
    return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) !== 1 ? 's' : ''} ago`;
  return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) !== 1 ? 's' : ''} ago`;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

// =============================================================================
// Component
// =============================================================================

export function SessionSummary({
  lastSession,
  gitSummary,
  openRecommendations,
  commitsSinceLastSession,
  filesChangedSinceLastSession,
}: SessionSummaryProps): React.ReactElement {
  // First run - show welcome message
  if (!lastSession) {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1}>
        <Text bold color="cyan">
          Welcome to agentlint!
        </Text>
        <Box marginTop={1}>
          <Text>First time here? Let's analyze your AI workflow.</Text>
        </Box>
        {gitSummary && (
          <Box marginTop={1} flexDirection="column">
            <Text dimColor>
              On branch <Text color="green">{sanitizeForTerminal(gitSummary.branch)}</Text>
              {gitSummary.uncommittedChanges > 0 && (
                <Text> with {gitSummary.uncommittedChanges} uncommitted changes</Text>
              )}
            </Text>
          </Box>
        )}
      </Box>
    );
  }

  // Returning user - show session summary (compact inline format)
  const timeAgo = formatTimeAgo(lastSession.sessionDate);
  const hasChanges =
    (commitsSinceLastSession && commitsSinceLastSession > 0) ||
    (filesChangedSinceLastSession && filesChangedSinceLastSession > 0);

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Compact session summary - single line */}
      <Box>
        <Text dimColor>Last session {timeAgo}</Text>
        {lastSession.durationMs && (
          <Text dimColor> ({formatDuration(lastSession.durationMs)})</Text>
        )}
        <Text dimColor>: </Text>
        <Text color={lastSession.findingsCount > 0 ? 'yellow' : 'green'}>
          {lastSession.findingsCount} issue{lastSession.findingsCount !== 1 ? 's' : ''}
        </Text>
        <Text dimColor> {'\u2022'} </Text>
        <Text color="cyan">
          {lastSession.recommendationsCreated} rec
          {lastSession.recommendationsCreated !== 1 ? 's' : ''}
        </Text>
      </Box>

      {/* Changes since - compact inline */}
      {hasChanges && (
        <Box>
          <Text dimColor>Since: </Text>
          {commitsSinceLastSession && commitsSinceLastSession > 0 && (
            <>
              <Text color="blue">
                {commitsSinceLastSession} commit{commitsSinceLastSession !== 1 ? 's' : ''}
              </Text>
              <Text dimColor> {'\u2022'} </Text>
            </>
          )}
          {filesChangedSinceLastSession && filesChangedSinceLastSession > 0 && (
            <>
              <Text color="blue">
                {filesChangedSinceLastSession} file{filesChangedSinceLastSession !== 1 ? 's' : ''}
              </Text>
              <Text dimColor> {'\u2022'} </Text>
            </>
          )}
          {openRecommendations > 0 && (
            <>
              <Text color="yellow">{openRecommendations} open</Text>
            </>
          )}
          {gitSummary && <Text dimColor> on {sanitizeForTerminal(gitSummary.branch)}</Text>}
        </Box>
      )}

      {/* No changes - just show branch */}
      {!hasChanges && gitSummary && (
        <Box>
          <Text dimColor>
            On <Text color="green">{sanitizeForTerminal(gitSummary.branch)}</Text>
            {gitSummary.uncommittedChanges > 0 && (
              <Text dimColor> ({gitSummary.uncommittedChanges} uncommitted)</Text>
            )}
          </Text>
        </Box>
      )}
    </Box>
  );
}

export default SessionSummary;
