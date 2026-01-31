/**
 * ActionMenu Component
 *
 * Interactive menu with numbered options for the welcome screen.
 * Supports keyboard selection via number keys.
 *
 * @module tui/components/ActionMenu
 */

import React from 'react';
import { Box, Text, useInput } from 'ink';

// =============================================================================
// Types
// =============================================================================

export interface MenuOption {
  key: string;
  label: string;
  action: string;
}

export interface ActionMenuProps {
  title?: string;
  subtitle?: string;
  options: MenuOption[];
  onSelect: (action: string) => void;
  hint?: string;
  disabled?: boolean;
}

// =============================================================================
// Component
// =============================================================================

export function ActionMenu({
  title,
  subtitle,
  options,
  onSelect,
  hint = 'Press a number to select...',
  disabled = false,
}: ActionMenuProps): React.ReactElement {
  useInput(
    (input) => {
      const option = options.find((o) => o.key === input);
      if (option) {
        onSelect(option.action);
      }
    },
    { isActive: !disabled }
  );

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={2} paddingY={1}>
      {title && (
        <Box marginBottom={1}>
          <Text bold>{title}</Text>
        </Box>
      )}
      {subtitle && (
        <Box marginBottom={1}>
          <Text dimColor>{subtitle}</Text>
        </Box>
      )}

      <Box flexDirection="column">
        {options.map((opt) => (
          <Box key={opt.key}>
            <Text color="yellow">[{opt.key}]</Text>
            <Text> {opt.label}</Text>
          </Box>
        ))}
      </Box>

      {hint && (
        <Box marginTop={1}>
          <Text dimColor italic>
            {hint}
          </Text>
        </Box>
      )}
    </Box>
  );
}

export default ActionMenu;
