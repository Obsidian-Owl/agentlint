/**
 * AgentStateIndicator Component
 *
 * Displays the current agent work state with animated spinner.
 *
 * @module tui/components/AgentStateIndicator
 */

import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { AgentWorkState } from '../state/agent-state';
import { getElapsedMs, getToolName } from '../state/agent-state';

// =============================================================================
// Types
// =============================================================================

export interface AgentStateIndicatorProps {
  state: AgentWorkState;
  showElapsed?: boolean;
}

// =============================================================================
// Component
// =============================================================================

export function AgentStateIndicator({
  state,
  showElapsed = true,
}: AgentStateIndicatorProps): React.ReactElement | null {
  const elapsedMs = getElapsedMs(state);
  const toolName = getToolName(state);

  const message = useMemo(() => {
    switch (state.phase) {
      case 'idle':
        return null;
      case 'thinking':
        return 'Thinking...';
      case 'calling_tool':
        return `Calling ${toolName}...`;
      case 'waiting_response':
        return `Waiting for ${toolName}...`;
      case 'streaming':
        return 'Generating...';
      case 'error':
        return `Error: ${state.message}`;
      case 'complete':
        return `Done (${state.durationMs}ms)`;
    }
  }, [state, toolName]);

  if (!message) return null;

  const isActive = state.phase !== 'idle' && state.phase !== 'complete' && state.phase !== 'error';
  const elapsedStr = elapsedMs !== null && showElapsed ? ` (${Math.round(elapsedMs / 1000)}s)` : '';

  const color = state.phase === 'error' ? 'red' : state.phase === 'complete' ? 'green' : 'cyan';

  return (
    <Box>
      {isActive && (
        <Text color={color}>
          <Spinner type="dots" />{' '}
        </Text>
      )}
      <Text color={color}>
        {message}
        {elapsedStr}
      </Text>
    </Box>
  );
}

export default AgentStateIndicator;
