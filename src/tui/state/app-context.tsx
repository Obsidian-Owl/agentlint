/**
 * EP17 TUI State Management - App Context
 *
 * React Context provider for TUI application state.
 * Uses useReducer for predictable state management.
 *
 * @module tui/state/app-context
 */

import React, { createContext, useContext, useReducer, type ReactNode, type Dispatch } from 'react';
import type { AppState, AppMessage } from '../types';
import { createInitialState } from '../types';
import { appReducer } from './app-reducer';

// =============================================================================
// Context Types
// =============================================================================

interface AppContextValue {
  state: AppState;
  dispatch: Dispatch<AppMessage>;
}

// =============================================================================
// Context
// =============================================================================

/**
 * React Context for TUI application state.
 * Provides access to state and dispatch throughout the component tree.
 */
export const AppContext = createContext<AppContextValue | null>(null);

// =============================================================================
// Provider
// =============================================================================

interface AppProviderProps {
  children: ReactNode;
  /** Optional initial state for testing or recovery */
  initialState?: Partial<AppState>;
}

/**
 * Provider component for TUI application state.
 * Wraps the component tree with state management context.
 *
 * @example
 * ```tsx
 * <AppProvider>
 *   <App />
 * </AppProvider>
 * ```
 */
export function AppProvider({ children, initialState }: AppProviderProps): React.ReactElement {
  const [state, dispatch] = useReducer(appReducer, {
    ...createInitialState(),
    ...initialState,
  });

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook to access the full app context (state and dispatch).
 * Throws if used outside of AppProvider.
 *
 * @example
 * ```tsx
 * const { state, dispatch } = useApp();
 * dispatch({ type: 'SET_PHASE', payload: { phase: 'scanning' } });
 * ```
 */
export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

/**
 * Hook to access only the app state.
 * Use when you only need to read state, not dispatch.
 *
 * @example
 * ```tsx
 * const state = useAppState();
 * console.log(state.analysisPhase);
 * ```
 */
export function useAppState(): AppState {
  const { state } = useApp();
  return state;
}

/**
 * Hook to access only the dispatch function.
 * Use when you only need to dispatch, not read state.
 *
 * @example
 * ```tsx
 * const dispatch = useAppDispatch();
 * dispatch({ type: 'PUSH_DIALOG', payload: { dialog: 'permission' } });
 * ```
 */
export function useAppDispatch(): Dispatch<AppMessage> {
  const { dispatch } = useApp();
  return dispatch;
}
