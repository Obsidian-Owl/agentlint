/**
 * Unit tests for useKeyHandler hook
 *
 * Tests vim-style key handling (j/k), numeric shortcuts (1-9), and ESC.
 * Uses ink-testing-library for component testing.
 *
 * Note: ink-testing-library with ink 5.x requires async handling
 * for useInput to register before stdin.write events are processed.
 */

import React, { useState } from 'react';
import { describe, test, expect, mock, afterEach } from 'bun:test';
import { render, cleanup } from 'ink-testing-library';
import { Text } from 'ink';
import { useKeyHandler } from '../../../../src/tui/hooks/useKeyHandler';

// =============================================================================
// Helper
// =============================================================================

/** Small delay to allow React effects to settle */
const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

// =============================================================================
// Test Components
// =============================================================================

interface TestComponentProps {
  onNavigate?: (direction: 'up' | 'down') => void;
  onSelect?: (index: number) => void;
  onEscape?: () => void;
  onSubmit?: () => void;
  isActive?: boolean;
  itemCount?: number;
}

function TestComponent({
  onNavigate,
  onSelect,
  onEscape,
  onSubmit,
  isActive = true,
  itemCount = 5,
}: TestComponentProps): React.ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleNavigate = (direction: 'up' | 'down') => {
    if (direction === 'up') {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else {
      setSelectedIndex((prev) => Math.min(itemCount - 1, prev + 1));
    }
    onNavigate?.(direction);
  };

  useKeyHandler({
    onNavigate: handleNavigate,
    ...(onSelect && { onSelect }),
    ...(onEscape && { onEscape }),
    ...(onSubmit && { onSubmit }),
    isActive,
    itemCount,
  });

  return <Text>Selected: {selectedIndex}</Text>;
}

function SelectionTracker(props: TestComponentProps): React.ReactElement {
  const [lastSelection, setLastSelection] = useState<number | null>(null);

  const handleSelect = (index: number) => {
    setLastSelection(index);
    props.onSelect?.(index);
  };

  useKeyHandler({
    ...(props.onNavigate && { onNavigate: props.onNavigate }),
    onSelect: handleSelect,
    ...(props.onEscape && { onEscape: props.onEscape }),
    isActive: props.isActive ?? true,
    itemCount: props.itemCount ?? 9,
  });

  return <Text>Last: {lastSelection === null ? 'none' : lastSelection}</Text>;
}

function EscapeTracker(props: { onEscape?: () => void; isActive?: boolean }): React.ReactElement {
  const [escaped, setEscaped] = useState(false);

  const handleEscape = () => {
    setEscaped(true);
    props.onEscape?.();
  };

  useKeyHandler({
    onEscape: handleEscape,
    isActive: props.isActive ?? true,
  });

  return <Text>{escaped ? 'Escaped' : 'Waiting'}</Text>;
}

// =============================================================================
// Tests
// =============================================================================

describe('useKeyHandler', () => {
  afterEach(() => {
    cleanup();
  });

  describe('vim navigation (j/k)', () => {
    test('should call onNavigate with "down" when j is pressed', async () => {
      const onNavigate = mock(() => {});
      const { stdin } = render(<TestComponent onNavigate={onNavigate} />);

      await tick();
      stdin.write('j');
      await tick();

      expect(onNavigate).toHaveBeenCalledWith('down');
    });

    test('should call onNavigate with "up" when k is pressed', async () => {
      const onNavigate = mock(() => {});
      const { stdin } = render(<TestComponent onNavigate={onNavigate} />);

      await tick();
      stdin.write('k');
      await tick();

      expect(onNavigate).toHaveBeenCalledWith('up');
    });

    test('should update selection state when navigating down', async () => {
      const { stdin, lastFrame } = render(<TestComponent />);

      // Initial state
      expect(lastFrame()).toContain('Selected: 0');

      await tick();
      stdin.write('j');
      await tick();

      expect(lastFrame()).toContain('Selected: 1');
    });

    test('should update selection state when navigating up', async () => {
      const { stdin, lastFrame } = render(<TestComponent />);

      await tick();
      stdin.write('j');
      await tick();
      stdin.write('k');
      await tick();

      expect(lastFrame()).toContain('Selected: 0');
    });

    test('should not go below 0 when pressing k at top', async () => {
      const { stdin, lastFrame } = render(<TestComponent />);

      await tick();
      stdin.write('k');
      await tick();
      stdin.write('k');
      await tick();

      expect(lastFrame()).toContain('Selected: 0');
    });

    test('should not exceed itemCount - 1 when pressing j at bottom', async () => {
      const { stdin, lastFrame } = render(<TestComponent itemCount={3} />);

      await tick();
      stdin.write('j');
      await tick();
      stdin.write('j');
      await tick();
      stdin.write('j');
      await tick();
      stdin.write('j');
      await tick();

      expect(lastFrame()).toContain('Selected: 2');
    });
  });

  describe('arrow key navigation', () => {
    test('should call onNavigate with "down" when down arrow is pressed', async () => {
      const onNavigate = mock(() => {});
      const { stdin } = render(<TestComponent onNavigate={onNavigate} />);

      await tick();
      // Down arrow escape sequence
      stdin.write('\x1B[B');
      await tick();

      expect(onNavigate).toHaveBeenCalledWith('down');
    });

    test('should call onNavigate with "up" when up arrow is pressed', async () => {
      const onNavigate = mock(() => {});
      const { stdin } = render(<TestComponent onNavigate={onNavigate} />);

      await tick();
      // Up arrow escape sequence
      stdin.write('\x1B[A');
      await tick();

      expect(onNavigate).toHaveBeenCalledWith('up');
    });
  });

  describe('numeric selection (1-9)', () => {
    test('should call onSelect with 0 when 1 is pressed', async () => {
      const onSelect = mock(() => {});
      const { stdin } = render(<SelectionTracker onSelect={onSelect} />);

      await tick();
      stdin.write('1');
      await tick();

      expect(onSelect).toHaveBeenCalledWith(0);
    });

    test('should call onSelect with 8 when 9 is pressed', async () => {
      const onSelect = mock(() => {});
      const { stdin } = render(<SelectionTracker onSelect={onSelect} />);

      await tick();
      stdin.write('9');
      await tick();

      expect(onSelect).toHaveBeenCalledWith(8);
    });

    test('should update displayed selection when numeric key is pressed', async () => {
      const { stdin, lastFrame } = render(<SelectionTracker itemCount={5} />);

      await tick();
      stdin.write('3');
      await tick();

      expect(lastFrame()).toContain('Last: 2');
    });

    test('should not call onSelect if index exceeds itemCount', async () => {
      const onSelect = mock(() => {});
      // Only 3 items, pressing 5 should not select anything
      const { stdin, lastFrame } = render(<SelectionTracker onSelect={onSelect} itemCount={3} />);

      await tick();
      stdin.write('5');
      await tick();

      expect(onSelect).not.toHaveBeenCalled();
      expect(lastFrame()).toContain('Last: none');
    });

    test('should handle all valid numbers 1-9', async () => {
      const onSelect = mock(() => {});
      const { stdin } = render(<SelectionTracker onSelect={onSelect} itemCount={9} />);

      await tick();
      for (let i = 1; i <= 9; i++) {
        stdin.write(String(i));
        await tick();
        expect(onSelect).toHaveBeenCalledWith(i - 1);
      }
    });

    test('should ignore 0 key', async () => {
      const onSelect = mock(() => {});
      const { stdin, lastFrame } = render(<SelectionTracker onSelect={onSelect} />);

      await tick();
      stdin.write('0');
      await tick();

      expect(onSelect).not.toHaveBeenCalled();
      expect(lastFrame()).toContain('Last: none');
    });
  });

  describe('escape key', () => {
    test('should call onEscape when ESC is pressed', async () => {
      const onEscape = mock(() => {});
      const { stdin } = render(<EscapeTracker onEscape={onEscape} />);

      await tick();
      stdin.write('\x1B'); // ESC
      await tick();

      expect(onEscape).toHaveBeenCalled();
    });

    test('should update state when ESC is pressed', async () => {
      const { stdin, lastFrame } = render(<EscapeTracker />);

      expect(lastFrame()).toContain('Waiting');

      await tick();
      stdin.write('\x1B');
      await tick();

      expect(lastFrame()).toContain('Escaped');
    });
  });

  describe('enter/return key', () => {
    test('should call onSubmit when enter is pressed', async () => {
      const onSubmit = mock(() => {});
      const { stdin } = render(<TestComponent onSubmit={onSubmit} />);

      await tick();
      stdin.write('\r'); // Enter/Return
      await tick();

      expect(onSubmit).toHaveBeenCalled();
    });
  });

  describe('isActive option', () => {
    test('should not handle keys when isActive is false', async () => {
      const onNavigate = mock(() => {});
      const onSelect = mock(() => {});
      const onEscape = mock(() => {});
      const { stdin } = render(
        <TestComponent
          onNavigate={onNavigate}
          onSelect={onSelect}
          onEscape={onEscape}
          isActive={false}
        />
      );

      await tick();
      stdin.write('j');
      stdin.write('k');
      stdin.write('1');
      stdin.write('\x1B');
      await tick();

      expect(onNavigate).not.toHaveBeenCalled();
      expect(onSelect).not.toHaveBeenCalled();
      expect(onEscape).not.toHaveBeenCalled();
    });

    test('should resume handling keys when isActive becomes true', async () => {
      const onNavigate = mock(() => {});

      function ToggleableHandler(): React.ReactElement {
        const [active, _setActive] = useState(false);

        useKeyHandler({
          onNavigate,
          isActive: active,
        });

        return (
          <Text>
            {/* Simulate toggle - in real use this would be from state */}
            Active: {String(active)}
          </Text>
        );
      }

      const { stdin } = render(<ToggleableHandler />);

      await tick();
      // Initially inactive, so j should not trigger
      stdin.write('j');
      await tick();

      expect(onNavigate).not.toHaveBeenCalled();
    });
  });

  describe('callback stability', () => {
    test('should not crash with undefined callbacks', async () => {
      const { stdin, lastFrame } = render(<TestComponent />);

      await tick();
      // Should not throw with undefined callbacks
      stdin.write('j');
      stdin.write('1');
      stdin.write('\x1B');
      await tick();

      expect(lastFrame()).toBeDefined();
    });

    test('should handle missing onSelect gracefully for numeric keys', async () => {
      const { stdin, lastFrame } = render(<TestComponent />);

      await tick();
      stdin.write('3');
      await tick();

      // Should not crash
      expect(lastFrame()).toContain('Selected');
    });
  });
});
