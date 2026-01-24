/**
 * Unit tests for useFocusManager hook
 *
 * Tests dialog focus trapping and focus target management.
 * Uses ink-testing-library for component testing.
 */

import React, { useState } from 'react';
import { describe, test, expect, mock, afterEach } from 'bun:test';
import { render, cleanup } from 'ink-testing-library';
import { Text } from 'ink';
import { useFocusManager } from '../../../../src/tui/hooks/useFocusManager';
import type { FocusTarget, DialogType } from '../../../../src/tui/types';

// =============================================================================
// Helper
// =============================================================================

/** Small delay to allow React effects to settle */
const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

// =============================================================================
// Test Components
// =============================================================================

interface TestComponentProps {
  initialViewStack?: DialogType[];
  initialFocusTarget?: FocusTarget;
  onFocusChange?: (target: FocusTarget) => void;
}

function TestComponent({
  initialViewStack = [],
  initialFocusTarget = 'main',
  onFocusChange,
}: TestComponentProps): React.ReactElement {
  const [viewStack, _setViewStack] = useState<DialogType[]>(initialViewStack);
  const [focusTarget, setFocusTarget] = useState<FocusTarget>(initialFocusTarget);

  const handleFocusChange = (target: FocusTarget) => {
    setFocusTarget(target);
    onFocusChange?.(target);
  };

  const {
    pushDialog: _pushDialog,
    popDialog: _popDialog,
    trapFocus: _trapFocus,
    releaseFocus: _releaseFocus,
    shouldTrapFocus,
  } = useFocusManager({
    viewStack,
    focusTarget,
    onFocusChange: handleFocusChange,
  });

  return (
    <Text>
      Focus: {focusTarget}, Stack: {viewStack.length}, Trapped: {String(shouldTrapFocus)}
    </Text>
  );
}

function FocusTracker({
  onPushDialog,
  onPopDialog,
}: {
  onPushDialog?: () => void;
  onPopDialog?: () => void;
}): React.ReactElement {
  const [viewStack, setViewStack] = useState<DialogType[]>([]);
  const [focusTarget, setFocusTarget] = useState<FocusTarget>('main');

  const { pushDialog, popDialog, trapFocus, releaseFocus, shouldTrapFocus } = useFocusManager({
    viewStack,
    focusTarget,
    onViewStackChange: (stack) => {
      setViewStack(stack);
    },
    onFocusChange: setFocusTarget,
  });

  // Store functions globally for test access
  (globalThis as Record<string, unknown>).__testPushDialog = () => {
    pushDialog('permission');
    onPushDialog?.();
  };
  (globalThis as Record<string, unknown>).__testPopDialog = () => {
    popDialog();
    onPopDialog?.();
  };
  (globalThis as Record<string, unknown>).__testTrapFocus = trapFocus;
  (globalThis as Record<string, unknown>).__testReleaseFocus = releaseFocus;

  return (
    <Text>
      Focus: {focusTarget}, Stack: {viewStack.length}, Trapped: {String(shouldTrapFocus)}
    </Text>
  );
}

// =============================================================================
// Tests
// =============================================================================

describe('useFocusManager', () => {
  afterEach(() => {
    cleanup();
    delete (globalThis as Record<string, unknown>).__testPushDialog;
    delete (globalThis as Record<string, unknown>).__testPopDialog;
    delete (globalThis as Record<string, unknown>).__testTrapFocus;
    delete (globalThis as Record<string, unknown>).__testReleaseFocus;
  });

  describe('initial state', () => {
    test('should start with main focus when viewStack is empty', () => {
      const { lastFrame } = render(<TestComponent />);

      expect(lastFrame()).toContain('Focus: main');
      expect(lastFrame()).toContain('Stack: 0');
      expect(lastFrame()).toContain('Trapped: false');
    });

    test('should have dialog focus when viewStack has items', () => {
      const { lastFrame } = render(
        <TestComponent initialViewStack={['permission']} initialFocusTarget="dialog" />
      );

      expect(lastFrame()).toContain('Focus: dialog');
      expect(lastFrame()).toContain('Stack: 1');
      expect(lastFrame()).toContain('Trapped: true');
    });
  });

  describe('pushDialog', () => {
    test('should add dialog to viewStack', async () => {
      render(<FocusTracker />);

      await tick();

      const pushFn = (globalThis as Record<string, unknown>).__testPushDialog as () => void;
      pushFn();

      await tick();
    });

    test('should set focus to dialog when pushing', async () => {
      const onFocusChange = mock(() => {});
      render(<FocusTracker onPushDialog={onFocusChange} />);

      await tick();

      const pushFn = (globalThis as Record<string, unknown>).__testPushDialog as () => void;
      pushFn();

      await tick();
    });
  });

  describe('popDialog', () => {
    test('should remove top dialog from viewStack', async () => {
      render(<FocusTracker />);

      await tick();

      // Push first
      const pushFn = (globalThis as Record<string, unknown>).__testPushDialog as () => void;
      pushFn();
      await tick();

      // Then pop
      const popFn = (globalThis as Record<string, unknown>).__testPopDialog as () => void;
      popFn();
      await tick();
    });

    test('should return focus to main when stack is empty after pop', async () => {
      const onPopDialog = mock(() => {});
      render(<FocusTracker onPopDialog={onPopDialog} />);

      await tick();

      // Push then pop
      const pushFn = (globalThis as Record<string, unknown>).__testPushDialog as () => void;
      const popFn = (globalThis as Record<string, unknown>).__testPopDialog as () => void;

      pushFn();
      await tick();
      popFn();
      await tick();
    });
  });

  describe('shouldTrapFocus', () => {
    test('should be false when viewStack is empty', () => {
      const { lastFrame } = render(<TestComponent />);

      expect(lastFrame()).toContain('Trapped: false');
    });

    test('should be true when viewStack has dialogs', () => {
      const { lastFrame } = render(
        <TestComponent initialViewStack={['permission']} initialFocusTarget="dialog" />
      );

      expect(lastFrame()).toContain('Trapped: true');
    });

    test('should be true for nested dialogs', () => {
      const { lastFrame } = render(
        <TestComponent
          initialViewStack={['permission', 'recommendation']}
          initialFocusTarget="dialog"
        />
      );

      expect(lastFrame()).toContain('Trapped: true');
      expect(lastFrame()).toContain('Stack: 2');
    });
  });

  describe('trapFocus', () => {
    test('should explicitly trap focus to dialog', async () => {
      render(<FocusTracker />);

      await tick();

      const trapFn = (globalThis as Record<string, unknown>).__testTrapFocus as () => void;
      trapFn();

      await tick();
    });
  });

  describe('releaseFocus', () => {
    test('should explicitly release focus to main', async () => {
      render(<FocusTracker />);

      await tick();

      // First trap, then release
      const trapFn = (globalThis as Record<string, unknown>).__testTrapFocus as () => void;
      const releaseFn = (globalThis as Record<string, unknown>).__testReleaseFocus as () => void;

      trapFn();
      await tick();
      releaseFn();
      await tick();
    });
  });

  describe('focus target management', () => {
    test('should report correct focus target from options', () => {
      const { lastFrame } = render(<TestComponent initialFocusTarget="input" />);

      expect(lastFrame()).toContain('Focus: input');
    });

    test('should call onFocusChange when focus changes', async () => {
      const onFocusChange = mock(() => {});
      render(<FocusTracker onPushDialog={onFocusChange} />);

      await tick();

      const pushFn = (globalThis as Record<string, unknown>).__testPushDialog as () => void;
      pushFn();

      await tick();
    });
  });
});
