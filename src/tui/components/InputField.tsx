/**
 * EP17 TUI Components - Input Field
 *
 * User input capture with prompt and placeholder support.
 *
 * @module tui/components/InputField
 */

import React from 'react';
import { Box, Text, useInput } from 'ink';
import type { InputFieldProps } from '../types';

// =============================================================================
// Component
// =============================================================================

/**
 * Input field component for user text entry.
 *
 * Features:
 * - Text input with backspace support
 * - Placeholder when empty
 * - Disabled state (during streaming)
 * - Enter key submission
 * - Visual prompt indicator
 *
 * @example
 * ```tsx
 * <InputField
 *   value={state.inputBuffer}
 *   onChange={(v) => dispatch({ type: 'UPDATE_INPUT_BUFFER', payload: { input: v } })}
 *   onSubmit={(v) => sendToAgent(v)}
 *   disabled={state.isStreaming}
 *   placeholder="Ask a question..."
 *   disabledPlaceholder="Agent is working, please wait..."
 * />
 * ```
 */
export function InputField({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = '',
  disabledPlaceholder = 'Agent is working, please wait...',
  queuedInput,
}: InputFieldProps): React.ReactElement {
  useInput(
    (input, key) => {
      if (disabled) {
        return;
      }

      // Handle enter/return
      if (key.return) {
        onSubmit(value);
        return;
      }

      // Handle backspace
      if (key.backspace) {
        if (value.length > 0) {
          onChange(value.slice(0, -1));
        } else {
          onChange('');
        }
        return;
      }

      // Handle delete key
      if (key.delete) {
        if (value.length > 0) {
          onChange(value.slice(0, -1));
        }
        return;
      }

      // Ignore control characters and arrow keys
      if (key.ctrl || key.meta || key.upArrow || key.downArrow || key.leftArrow || key.rightArrow) {
        return;
      }

      // Ignore escape and tab (handled elsewhere)
      if (key.escape || key.tab) {
        return;
      }

      // Append regular input
      if (input.length > 0) {
        onChange(value + input);
      }
    },
    { isActive: !disabled }
  );

  const showPlaceholder = value.length === 0;
  const displayPlaceholder = disabled ? disabledPlaceholder : placeholder;

  return (
    <Box flexDirection="column">
      {queuedInput && (
        <Box marginBottom={0}>
          <Text dimColor>[Queued: {queuedInput}]</Text>
        </Box>
      )}
      <Box>
        <Text color="green" bold>
          {'\u276F '}
        </Text>
        {showPlaceholder && displayPlaceholder.length > 0 ? (
          <Text dimColor>{displayPlaceholder}</Text>
        ) : (
          <Text>{value}</Text>
        )}
        {!disabled && <Text color="green">{'_'}</Text>}
      </Box>
    </Box>
  );
}

// =============================================================================
// Exports
// =============================================================================

export default InputField;
