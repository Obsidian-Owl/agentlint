/**
 * EP17 TUI Hooks - Key Handler
 *
 * Global key handling hook for vim-style navigation (j/k),
 * numeric shortcuts (1-9), and escape key.
 *
 * @module tui/hooks/useKeyHandler
 */

import { useInput } from 'ink';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for the useKeyHandler hook.
 */
export interface KeyHandlerOptions {
  /** Callback when navigation key is pressed (j/k or arrows) */
  onNavigate?: (direction: 'up' | 'down') => void;
  /** Callback when numeric key 1-9 is pressed (0-indexed) */
  onSelect?: (index: number) => void;
  /** Callback when ESC is pressed */
  onEscape?: () => void;
  /** Callback when Enter/Return is pressed */
  onSubmit?: () => void;
  /** Whether key handling is active (default: true) */
  isActive?: boolean;
  /** Number of items for numeric selection bounds checking */
  itemCount?: number;
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook for handling common TUI keyboard interactions.
 *
 * Supports:
 * - Vim-style navigation: `j` (down), `k` (up)
 * - Arrow key navigation: Up/Down arrows
 * - Numeric shortcuts: `1`-`9` for quick selection (0-indexed)
 * - Escape: Dismiss/cancel
 * - Enter: Submit/confirm
 *
 * @example
 * ```tsx
 * useKeyHandler({
 *   onNavigate: (dir) => setIndex(dir === 'up' ? index - 1 : index + 1),
 *   onSelect: (i) => selectItem(i),
 *   onEscape: () => dismiss(),
 *   itemCount: items.length,
 * });
 * ```
 */
export function useKeyHandler(options: KeyHandlerOptions): void {
  const {
    onNavigate,
    onSelect,
    onEscape,
    onSubmit,
    isActive = true,
    itemCount = Number.MAX_SAFE_INTEGER,
  } = options;

  useInput(
    (input, key) => {
      // Vim-style navigation: j = down, k = up
      if (input === 'j') {
        onNavigate?.('down');
        return;
      }

      if (input === 'k') {
        onNavigate?.('up');
        return;
      }

      // Arrow key navigation
      if (key.downArrow) {
        onNavigate?.('down');
        return;
      }

      if (key.upArrow) {
        onNavigate?.('up');
        return;
      }

      // Numeric selection (1-9 → index 0-8)
      const num = parseInt(input, 10);
      if (!isNaN(num) && num >= 1 && num <= 9) {
        const index = num - 1;
        // Only call if within bounds
        if (index < itemCount) {
          onSelect?.(index);
        }
        return;
      }

      // Escape key
      if (key.escape) {
        onEscape?.();
        return;
      }

      // Enter/Return key
      if (key.return) {
        onSubmit?.();
        return;
      }
    },
    { isActive }
  );
}

// =============================================================================
// Exports
// =============================================================================

export default useKeyHandler;
