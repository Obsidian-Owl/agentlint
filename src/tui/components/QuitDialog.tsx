/**
 * QuitDialog Component
 *
 * Confirmation dialog before quitting agentlint.
 * Safe default is "No" to prevent accidental data loss.
 *
 * @module tui/components/QuitDialog
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

// =============================================================================
// Types
// =============================================================================

export interface QuitDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
}

// =============================================================================
// Component
// =============================================================================

export function QuitDialog({ onConfirm, onCancel }: QuitDialogProps): React.ReactElement {
  const [selectedNo, setSelectedNo] = useState(true);

  useInput((input, key) => {
    console.error('[QUIT DEBUG] QuitDialog received input:', input, 'key:', key);
    if (input.toLowerCase() === 'y') {
      console.error('[QUIT DEBUG] Calling onConfirm()');
      onConfirm();
      return;
    }
    if (input.toLowerCase() === 'n' || key.escape) {
      onCancel();
      return;
    }
    if (key.tab || key.leftArrow || key.rightArrow) {
      setSelectedNo(!selectedNo);
      return;
    }
    if (key.return) {
      if (selectedNo) {
        onCancel();
      } else {
        onConfirm();
      }
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={2} paddingY={1}>
      <Text bold color="yellow">
        Quit agentlint?
      </Text>
      <Text dimColor>Any unsaved work will be preserved.</Text>

      <Box marginTop={1} gap={2}>
        <Box>
          {!selectedNo ? (
            <Text color="green" bold inverse>
              {' [Y]es '}
            </Text>
          ) : (
            <Text>{' [Y]es '}</Text>
          )}
        </Box>
        <Box>
          {selectedNo ? (
            <Text color="cyan" bold inverse>
              {' [N]o '}
            </Text>
          ) : (
            <Text>{' [N]o '}</Text>
          )}
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text dimColor italic>
          y/n to select • Tab to toggle • Enter to confirm
        </Text>
      </Box>
    </Box>
  );
}

export default QuitDialog;
