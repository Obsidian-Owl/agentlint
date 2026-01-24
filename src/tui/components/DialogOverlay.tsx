/**
 * EP17 TUI Components - Dialog Overlay
 *
 * Modal dialog wrapper with focus trapping and ESC dismissal.
 * Used to wrap permission dialogs, recommendation dialogs, etc.
 *
 * @module tui/components/DialogOverlay
 */

import React from 'react';
import { Box, Text, useInput } from 'ink';
import type { DialogOverlayProps } from '../types';

// =============================================================================
// Component
// =============================================================================

/**
 * Dialog overlay wrapper component.
 *
 * Provides:
 * - Visual border/frame around dialog content
 * - Title bar (optional)
 * - ESC key handling for dismissal
 * - Focus trapping (handled by parent focus manager)
 *
 * @example
 * ```tsx
 * <DialogOverlay title="Permission Required" onDismiss={handleClose}>
 *   <PermissionContent />
 * </DialogOverlay>
 * ```
 */
export function DialogOverlay({
  children,
  title,
  onDismiss,
}: DialogOverlayProps): React.ReactElement {
  // Handle ESC key for dismissal
  useInput((_input, key) => {
    if (key.escape && onDismiss) {
      onDismiss();
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} paddingY={0}>
      {title && (
        <Box marginBottom={1}>
          <Text bold color="cyan">
            {title}
          </Text>
        </Box>
      )}
      <Box flexDirection="column">{children}</Box>
    </Box>
  );
}

// =============================================================================
// Exports
// =============================================================================

export default DialogOverlay;
