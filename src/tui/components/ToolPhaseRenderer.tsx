/**
 * ToolPhaseRenderer Component
 *
 * Renders tool invocations in three distinct visual phases:
 * - Preparing: Tool call initiated, building command
 * - Running: Tool executing, waiting for response
 * - Complete: Tool finished with result (success/error)
 *
 * @module tui/components/ToolPhaseRenderer
 */

import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { StreamChunk } from '../../orchestration/types';

// =============================================================================
// Types
// =============================================================================

export type ToolPhase = 'preparing' | 'running' | 'complete';

export interface ToolPhaseRendererProps {
  chunk: StreamChunk;
  phase: ToolPhase;
}

interface TruncatedResultProps {
  content: string;
  maxLines?: number;
}

// =============================================================================
// Sub-components
// =============================================================================

function TruncatedResult({ content, maxLines = 10 }: TruncatedResultProps): React.ReactElement {
  const lines = content.split('\n');
  const truncated = lines.length > maxLines;
  const displayLines = truncated ? lines.slice(0, maxLines) : lines;

  return (
    <Box flexDirection="column">
      <Text wrap="wrap">{displayLines.join('\n')}</Text>
      {truncated && (
        <Text dimColor italic>
          ... {lines.length - maxLines} more lines
        </Text>
      )}
    </Box>
  );
}

function getPhaseIcon(phase: ToolPhase, success?: boolean): string {
  switch (phase) {
    case 'preparing':
      return '◇';
    case 'running':
      return '◈';
    case 'complete':
      return success === false ? '✗' : '✓';
  }
}

function getPhaseLabel(phase: ToolPhase): string {
  switch (phase) {
    case 'preparing':
      return 'Preparing...';
    case 'running':
      return 'Running...';
    case 'complete':
      return 'Complete';
  }
}

function getPhaseColor(phase: ToolPhase, success?: boolean): string {
  switch (phase) {
    case 'preparing':
      return 'cyan';
    case 'running':
      return 'yellow';
    case 'complete':
      return success === false ? 'red' : 'green';
  }
}

// =============================================================================
// Component
// =============================================================================

export function ToolPhaseRenderer({ chunk, phase }: ToolPhaseRendererProps): React.ReactElement {
  const toolName = (chunk.metadata?.toolName as string) ?? 'Tool';
  const success = chunk.metadata?.success as boolean | undefined;
  const durationMs = chunk.metadata?.durationMs as number | undefined;
  const output = chunk.metadata?.output as string | undefined;

  const color = getPhaseColor(phase, success);
  const icon = getPhaseIcon(phase, success);
  const label = getPhaseLabel(phase);
  const isActive = phase === 'preparing' || phase === 'running';

  const headerContent = (
    <Box gap={1}>
      {isActive ? (
        <Text color={color}>
          <Spinner type="dots" />
        </Text>
      ) : (
        <Text color={color}>{icon}</Text>
      )}
      <Text bold color={color}>
        {toolName}
      </Text>
      <Text dimColor>
        {label}
        {durationMs !== undefined && phase === 'complete' && ` (${durationMs}ms)`}
      </Text>
    </Box>
  );

  if (phase !== 'complete' || !output) {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor={color} paddingX={1} paddingY={0}>
        {headerContent}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={color} paddingX={1} paddingY={0}>
      {headerContent}
      <Box marginTop={1} flexDirection="column">
        <Box marginBottom={1}>
          <Text dimColor>{'─'.repeat(40)}</Text>
        </Box>
        <TruncatedResult content={output} maxLines={10} />
      </Box>
    </Box>
  );
}

export default ToolPhaseRenderer;
