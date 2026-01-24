/**
 * EP17 TUI Hooks - Focus Manager
 *
 * Hook for managing focus trapping in dialog overlays.
 * When a dialog is open, focus is trapped within it.
 *
 * @module tui/hooks/useFocusManager
 */

import { useCallback, useMemo } from 'react';
import type { FocusTarget, DialogType } from '../types';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for the useFocusManager hook.
 */
export interface FocusManagerOptions {
  /** Current dialog stack (from AppState) */
  viewStack: DialogType[];
  /** Current focus target (from AppState) */
  focusTarget: FocusTarget;
  /** Callback to update the view stack */
  onViewStackChange?: (stack: DialogType[]) => void;
  /** Callback when focus target changes */
  onFocusChange?: (target: FocusTarget) => void;
}

/**
 * Return value of useFocusManager hook.
 */
export interface FocusManagerResult {
  /** Push a new dialog onto the stack */
  pushDialog: (dialog: DialogType) => void;
  /** Pop the top dialog from the stack */
  popDialog: () => void;
  /** Explicitly trap focus to dialog */
  trapFocus: () => void;
  /** Explicitly release focus to main */
  releaseFocus: () => void;
  /** Whether focus should be trapped (dialog is open) */
  shouldTrapFocus: boolean;
  /** Current focus target */
  currentFocus: FocusTarget;
  /** Current view stack depth */
  stackDepth: number;
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook for managing focus in the TUI.
 *
 * Provides utilities for dialog focus trapping:
 * - Push/pop dialogs on the stack
 * - Automatically manage focus when dialogs open/close
 * - Explicitly trap/release focus
 *
 * @example
 * ```tsx
 * const { pushDialog, popDialog, shouldTrapFocus } = useFocusManager({
 *   viewStack: state.viewStack,
 *   focusTarget: state.focusTarget,
 *   onFocusChange: (target) => dispatch({ type: 'SET_FOCUS', payload: { target } }),
 *   onViewStackChange: (stack) => dispatch({ type: 'SET_VIEW_STACK', payload: { stack } }),
 * });
 *
 * // Show permission dialog
 * pushDialog('permission');
 *
 * // Close current dialog
 * popDialog();
 * ```
 */
export function useFocusManager(options: FocusManagerOptions): FocusManagerResult {
  const { viewStack, focusTarget, onViewStackChange, onFocusChange } = options;

  // Compute whether focus should be trapped
  const shouldTrapFocus = viewStack.length > 0;

  // Push a new dialog onto the stack
  const pushDialog = useCallback(
    (dialog: DialogType) => {
      const newStack = [...viewStack, dialog];
      onViewStackChange?.(newStack);
      onFocusChange?.('dialog');
    },
    [viewStack, onViewStackChange, onFocusChange]
  );

  // Pop the top dialog from the stack
  const popDialog = useCallback(() => {
    if (viewStack.length === 0) {
      return;
    }

    const newStack = viewStack.slice(0, -1);
    onViewStackChange?.(newStack);

    // Return focus based on stack state
    if (newStack.length === 0) {
      onFocusChange?.('main');
    } else {
      // Still have dialogs, keep focus on dialog
      onFocusChange?.('dialog');
    }
  }, [viewStack, onViewStackChange, onFocusChange]);

  // Explicitly trap focus to dialog
  const trapFocus = useCallback(() => {
    onFocusChange?.('dialog');
  }, [onFocusChange]);

  // Explicitly release focus to main
  const releaseFocus = useCallback(() => {
    onFocusChange?.('main');
  }, [onFocusChange]);

  // Memoize the result object
  const result = useMemo<FocusManagerResult>(
    () => ({
      pushDialog,
      popDialog,
      trapFocus,
      releaseFocus,
      shouldTrapFocus,
      currentFocus: focusTarget,
      stackDepth: viewStack.length,
    }),
    [pushDialog, popDialog, trapFocus, releaseFocus, shouldTrapFocus, focusTarget, viewStack.length]
  );

  return result;
}

// =============================================================================
// Exports
// =============================================================================

export default useFocusManager;
