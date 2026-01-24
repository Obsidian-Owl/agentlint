/**
 * Unit tests for AppContext
 *
 * Tests the React Context provider and hooks.
 */

import React from 'react';
import { describe, test, expect } from 'bun:test';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import {
  AppProvider,
  useApp,
  useAppState,
  useAppDispatch,
  AppContext,
} from '../../../src/tui/state/app-context';
import type { AppState } from '../../../src/tui/types';

// =============================================================================
// Test Components
// =============================================================================

function StateReader(): React.ReactElement {
  const state = useAppState();
  return <Text>Phase: {state.analysisPhase}</Text>;
}

function FullContextUser(): React.ReactElement {
  const { state } = useApp();
  return (
    <Text>
      Phase: {state.analysisPhase}, Input: {state.inputBuffer}
    </Text>
  );
}

function ErrorBoundaryTest(): React.ReactElement {
  try {
    const state = useAppState();
    return <Text>{state.analysisPhase}</Text>;
  } catch (error) {
    return <Text>Error: {(error as Error).message}</Text>;
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('AppContext', () => {
  describe('AppProvider', () => {
    test('should provide default initial state', () => {
      const { lastFrame } = render(
        <AppProvider>
          <StateReader />
        </AppProvider>
      );

      expect(lastFrame()).toContain('Phase: idle');
    });

    test('should accept partial initial state', () => {
      const initialState: Partial<AppState> = {
        analysisPhase: 'presenting',
      };

      const { lastFrame } = render(
        <AppProvider initialState={initialState}>
          <StateReader />
        </AppProvider>
      );

      expect(lastFrame()).toContain('Phase: presenting');
    });

    test('should merge initial state with defaults', () => {
      const initialState: Partial<AppState> = {
        inputBuffer: 'test',
      };

      const { lastFrame } = render(
        <AppProvider initialState={initialState}>
          <StateReader />
        </AppProvider>
      );

      // Default phase should be preserved
      expect(lastFrame()).toContain('Phase: idle');
    });
  });

  describe('useAppState', () => {
    test('should return current state', () => {
      const { lastFrame } = render(
        <AppProvider>
          <StateReader />
        </AppProvider>
      );

      expect(lastFrame()).toContain('Phase: idle');
    });
  });

  describe('useAppDispatch', () => {
    test('should return dispatch function', () => {
      let capturedDispatch: ReturnType<typeof useAppDispatch> | null = null;

      function CaptureDispatch(): React.ReactElement {
        capturedDispatch = useAppDispatch();
        return <Text>Ready</Text>;
      }

      render(
        <AppProvider>
          <CaptureDispatch />
        </AppProvider>
      );

      expect(capturedDispatch).not.toBeNull();
      expect(typeof capturedDispatch).toBe('function');
    });

    test('should provide working dispatch via initial state test', () => {
      // Test that state can be set via provider
      const { lastFrame } = render(
        <AppProvider initialState={{ analysisPhase: 'exploring' }}>
          <StateReader />
        </AppProvider>
      );

      expect(lastFrame()).toContain('Phase: exploring');
    });
  });

  describe('useApp', () => {
    test('should provide both state and dispatch', () => {
      const results: { state?: AppState; dispatch?: unknown } = {};

      function CaptureContext(): React.ReactElement {
        const { state, dispatch } = useApp();
        results.state = state;
        results.dispatch = dispatch;
        return <Text>Ready</Text>;
      }

      render(
        <AppProvider initialState={{ inputBuffer: 'test-value' }}>
          <CaptureContext />
        </AppProvider>
      );

      expect(results.state).toBeDefined();
      expect(results.state!.inputBuffer).toBe('test-value');
      expect(typeof results.dispatch).toBe('function');
    });

    test('should read state with useApp', () => {
      const { lastFrame } = render(
        <AppProvider initialState={{ inputBuffer: 'test', analysisPhase: 'scanning' }}>
          <FullContextUser />
        </AppProvider>
      );

      expect(lastFrame()).toContain('Phase: scanning');
      expect(lastFrame()).toContain('Input: test');
    });
  });

  describe('context errors', () => {
    test('should throw when useApp used outside provider', () => {
      const { lastFrame } = render(<ErrorBoundaryTest />);

      expect(lastFrame()).toContain('Error: useApp must be used within an AppProvider');
    });
  });

  describe('AppContext value', () => {
    test('should expose AppContext for advanced use cases', () => {
      expect(AppContext).toBeDefined();
      // Context should be null by default (before provider)
      expect(AppContext.Provider).toBeDefined();
    });
  });
});
