/**
 * StatusBar Component
 *
 * Enhanced status bar with multiple segments:
 * - Left: Help hint
 * - Middle-left: Token usage with warning at 80%
 * - Middle: Elapsed time and status
 * - Middle-right: Warnings count
 * - Right: Model and project path
 *
 * @module tui/components/StatusBar
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { StatusBarContext } from '../types';

// =============================================================================
// Types
// =============================================================================

export interface StatusBarProps {
  context: StatusBarContext;
}

// =============================================================================
// Helper Functions
// =============================================================================

function shortenPath(path: string, maxLength = 30): string {
  if (path.length <= maxLength) return path;
  const home = process.env['HOME'] ?? '';
  if (home && path.startsWith(home)) {
    path = '~' + path.slice(home.length);
  }
  if (path.length <= maxLength) return path;
  return '...' + path.slice(-(maxLength - 3));
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function formatTokens(used: number, limit: number): string {
  const usedK = (used / 1000).toFixed(1);
  const limitK = (limit / 1000).toFixed(0);
  return `${usedK}k/${limitK}k`;
}

function getTokenColor(used: number, limit: number): string {
  const ratio = used / limit;
  if (ratio >= 0.9) return 'red';
  if (ratio >= 0.8) return 'yellow';
  return 'green';
}

// =============================================================================
// Sub-components
// =============================================================================

interface TokenDisplayProps {
  used: number;
  limit: number;
}

function TokenDisplay({ used, limit }: TokenDisplayProps): React.ReactElement {
  const color = getTokenColor(used, limit);
  const display = formatTokens(used, limit);

  return <Text color={color}>◈ {display}</Text>;
}

// =============================================================================
// Component
// =============================================================================

export function StatusBar({ context }: StatusBarProps): React.ReactElement {
  const {
    helpHint,
    status,
    model,
    openRecommendations,
    projectPath,
    elapsedMs,
    tokenUsage,
    warnings,
  } = context;

  const shortPath = shortenPath(projectPath);
  const statusColor = status === 'Loading...' ? 'yellow' : status === 'Complete' ? 'green' : 'cyan';

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1} justifyContent="space-between">
      <Box gap={1}>
        <Text dimColor>{helpHint}</Text>

        {tokenUsage && (
          <>
            <Text dimColor>│</Text>
            <TokenDisplay used={tokenUsage.used} limit={tokenUsage.limit} />
          </>
        )}

        {elapsedMs !== undefined && elapsedMs > 0 && (
          <>
            <Text dimColor>│</Text>
            <Text dimColor>{formatElapsed(elapsedMs)}</Text>
          </>
        )}

        <Text dimColor>│</Text>
        <Text color={statusColor}>{status}</Text>

        {warnings && warnings.length > 0 && (
          <>
            <Text dimColor>│</Text>
            <Text color="yellow">⚠ {warnings.length}</Text>
          </>
        )}

        {openRecommendations > 0 && (
          <>
            <Text dimColor>│</Text>
            <Text color="cyan">{openRecommendations} recs</Text>
          </>
        )}
      </Box>

      <Box gap={1}>
        {model && <Text color="blue">{model}</Text>}
        <Text dimColor>│</Text>
        <Text dimColor>{shortPath}</Text>
      </Box>
    </Box>
  );
}

export default StatusBar;
