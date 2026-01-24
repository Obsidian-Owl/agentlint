/**
 * App Component - Root TUI Application
 *
 * The main application component that composes all sub-components
 * and provides the AppContext to the component tree.
 *
 * @module tui/components
 */

import React, { useCallback, useState, useMemo } from 'react';
import { Box, useInput, useApp as useInkApp } from 'ink';

import { AppProvider, useAppState, useAppDispatch } from '../state/app-context';
import { AgentOutput } from './AgentOutput';
import { InputField } from './InputField';
import { Breadcrumbs } from './Breadcrumbs';
import { DialogOverlay } from './DialogOverlay';
import { PermissionDialog } from './PermissionDialog';
import { RecommendationDialog } from './RecommendationDialog';
import type { AppProps, AppState, PermissionDecision } from '../types';
import { createInitialState } from '../types';

// =============================================================================
// Inner App Component (uses context)
// =============================================================================

interface InnerAppProps {
  onInput?: ((input: string) => void) | undefined;
  onStart?: (() => void) | undefined;
  onExit?: (() => void) | undefined;
}

function InnerApp({ onInput, onExit }: InnerAppProps): React.ReactElement {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { exit } = useInkApp();

  const [inputValue, setInputValue] = useState('');

  const {
    streamBuffer,
    isStreaming,
    explorationPath,
    viewStack,
    pendingPermission,
    recommendations,
  } = state;

  // Current dialog type (top of stack)
  const currentDialog = viewStack.length > 0 ? viewStack[viewStack.length - 1] : null;

  /**
   * Handle input submission.
   */
  const handleInputSubmit = useCallback(
    (value: string) => {
      if (value.trim()) {
        onInput?.(value);
        setInputValue('');
        dispatch({ type: 'CLEAR_INPUT_BUFFER' });
      }
    },
    [onInput, dispatch]
  );

  /**
   * Handle input change.
   */
  const handleInputChange = useCallback(
    (value: string) => {
      setInputValue(value);
      dispatch({ type: 'UPDATE_INPUT_BUFFER', payload: { input: value } });
    },
    [dispatch]
  );

  /**
   * Handle breadcrumb navigation.
   */
  const handleBreadcrumbNavigate = useCallback(
    (_stepId: string) => {
      // Pop back to that step
      dispatch({ type: 'POP_EXPLORATION' });
    },
    [dispatch]
  );

  /**
   * Handle permission decision.
   */
  const handlePermissionDecision = useCallback(
    (decision: PermissionDecision) => {
      // Cache the decision
      const key = decision.pattern ? `${decision.tool}:${decision.pattern}` : decision.tool;
      dispatch({ type: 'CACHE_PERMISSION', payload: { key, decision } });
      // Clear pending permission
      dispatch({ type: 'SET_PENDING_PERMISSION', payload: { permission: null } });
      // Pop the dialog
      dispatch({ type: 'POP_DIALOG' });
    },
    [dispatch]
  );

  /**
   * Handle recommendation action.
   */
  const handleRecommendationAction = useCallback(
    (_action: 'accept' | 'dismiss' | 'defer') => {
      // Pop the dialog
      dispatch({ type: 'POP_DIALOG' });
    },
    [dispatch]
  );

  /**
   * Handle global keyboard input.
   */
  useInput(
    useCallback(
      (input: string, key: { escape?: boolean }) => {
        // Don't handle input when dialog is open
        if (currentDialog) return;

        // Exit on 'q'
        if (input === 'q') {
          onExit?.();
          exit();
          return;
        }

        // Escape dismisses current view
        if (key.escape) {
          if (explorationPath.length > 0) {
            dispatch({ type: 'POP_EXPLORATION' });
          }
        }
      },
      [currentDialog, explorationPath.length, onExit, exit, dispatch]
    )
  );

  // Get current recommendation for dialog
  const currentRecommendation = recommendations.length > 0 ? recommendations[0] : null;

  return (
    <Box flexDirection="column" padding={1}>
      {/* Breadcrumbs */}
      {explorationPath.length > 0 && (
        <Box marginBottom={1}>
          <Breadcrumbs steps={explorationPath} onNavigate={handleBreadcrumbNavigate} />
        </Box>
      )}

      {/* Agent Output */}
      <Box flexGrow={1} marginBottom={1}>
        <AgentOutput chunks={streamBuffer} isStreaming={isStreaming} />
      </Box>

      {/* Input Field */}
      <InputField
        value={inputValue}
        onChange={handleInputChange}
        onSubmit={handleInputSubmit}
        disabled={isStreaming}
        placeholder="Type your question or press q to quit..."
      />

      {/* Permission Dialog */}
      {currentDialog === 'permission' && pendingPermission && (
        <DialogOverlay title="Permission Required">
          <PermissionDialog
            tool={pendingPermission.tool}
            description={pendingPermission.description}
            {...(pendingPermission.pattern ? { pattern: pendingPermission.pattern } : {})}
            onDecision={handlePermissionDecision}
          />
        </DialogOverlay>
      )}

      {/* Recommendation Dialog */}
      {currentDialog === 'recommendation' && currentRecommendation && (
        <DialogOverlay title="Recommendation">
          <RecommendationDialog
            recommendation={currentRecommendation}
            onAction={handleRecommendationAction}
          />
        </DialogOverlay>
      )}
    </Box>
  );
}

// =============================================================================
// App Component (provides context)
// =============================================================================

/**
 * Root TUI application component.
 *
 * Provides AppContext and renders the component tree.
 *
 * @param props - Application properties
 * @returns React element
 */
export function App({
  initialState,
  onInput,
  onStart: _onStart,
  onExit,
}: AppProps): React.ReactElement {
  // Merge initial state with defaults
  const mergedInitialState = useMemo(() => {
    const defaultState = createInitialState();
    return {
      ...defaultState,
      ...initialState,
    } as AppState;
  }, [initialState]);

  // Build InnerApp props, only including defined callbacks
  const innerProps: InnerAppProps = {};
  if (onInput) innerProps.onInput = onInput;
  if (onExit) innerProps.onExit = onExit;

  return (
    <AppProvider initialState={mergedInitialState}>
      <InnerApp {...innerProps} />
    </AppProvider>
  );
}
