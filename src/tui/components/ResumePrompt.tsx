/**
 * ResumePrompt Component
 *
 * Displays a prompt when interrupted epic work is detected.
 * Offers options to resume, start fresh, or discard the interrupted state.
 *
 * @module tui/components/ResumePrompt
 */

import React from 'react';
import { Box, Text, useInput } from 'ink';

// =============================================================================
// Types
// =============================================================================

export interface EpicAutoModeState {
  /** Epic identifier (e.g., "EP15") */
  epicId: string;
  /** Epic title */
  epicTitle: string;
  /** Last task identifier (e.g., "T003") */
  lastTask: string;
  /** Last task title */
  lastTaskTitle: string;
  /** Progress: completed tasks */
  completedTasks: number;
  /** Progress: total tasks */
  totalTasks: number;
  /** Feature directory path */
  featureDir: string;
}

export interface ResumePromptProps {
  state: EpicAutoModeState;
  onSelect: (action: 'resume' | 'fresh' | 'discard') => void;
  disabled?: boolean;
}

// =============================================================================
// Component
// =============================================================================

export function ResumePrompt({
  state,
  onSelect,
  disabled = false,
}: ResumePromptProps): React.ReactElement {
  useInput(
    (input) => {
      if (input === '1') {
        onSelect('resume');
      } else if (input === '2') {
        onSelect('fresh');
      } else if (input === '3') {
        onSelect('discard');
      }
    },
    { isActive: !disabled }
  );

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={2} paddingY={1}>
      <Text bold color="yellow">
        Interrupted work detected!
      </Text>

      <Box marginY={1} flexDirection="column">
        <Text>
          <Text bold>Epic:</Text>
          <Text>
            {' '}
            {state.epicId} {state.epicTitle}
          </Text>
        </Text>
        <Text>
          <Text bold>Last task:</Text>
          <Text>
            {' '}
            {state.lastTask} - {state.lastTaskTitle}
          </Text>
        </Text>
        <Text>
          <Text bold>Progress:</Text>
          <Text>
            {' '}
            {state.completedTasks}/{state.totalTasks} tasks complete
          </Text>
        </Text>
      </Box>

      <Box marginY={1} flexDirection="column">
        <Box>
          <Text color="green">[1]</Text>
          <Text> Resume where you left off </Text>
          <Text dimColor>(Recommended)</Text>
        </Box>
        <Box>
          <Text color="yellow">[2]</Text>
          <Text> Start fresh analysis</Text>
        </Box>
        <Box>
          <Text color="red">[3]</Text>
          <Text> Discard interrupted state</Text>
        </Box>
      </Box>

      <Text dimColor italic>
        Press 1, 2, or 3 to choose
      </Text>
    </Box>
  );
}

export default ResumePrompt;
