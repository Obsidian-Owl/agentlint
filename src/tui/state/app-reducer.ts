/**
 * EP17 TUI State Management - App Reducer
 *
 * Pure reducer function for managing TUI application state.
 * Handles all 16 message types defined in AppMessage.
 *
 * @module tui/state/app-reducer
 */

import type { AppState, AppMessage, AppReducer } from '../types';

/**
 * Main reducer function for TUI state management.
 *
 * All state transitions are handled here. The reducer is a pure function
 * that takes the current state and a message, returning a new state.
 *
 * @param state Current application state
 * @param message Action message describing the state change
 * @returns New application state (never mutates input)
 */
export const appReducer: AppReducer = (state: AppState, message: AppMessage): AppState => {
  switch (message.type) {
    case 'SET_PHASE':
      return {
        ...state,
        analysisPhase: message.payload.phase,
      };

    case 'PUSH_DIALOG':
      return {
        ...state,
        viewStack: [...state.viewStack, message.payload.dialog],
        focusTarget: 'dialog',
      };

    case 'POP_DIALOG': {
      const newViewStack = state.viewStack.slice(0, -1);
      return {
        ...state,
        viewStack: newViewStack,
        focusTarget: newViewStack.length === 0 ? 'main' : 'dialog',
      };
    }

    case 'ADD_STREAM_CHUNK':
      return {
        ...state,
        streamBuffer: [...state.streamBuffer, message.payload.chunk],
      };

    case 'CLEAR_STREAM':
      return {
        ...state,
        streamBuffer: [],
      };

    case 'SET_STREAMING':
      return {
        ...state,
        isStreaming: message.payload.isStreaming,
      };

    case 'SET_PAUSED':
      return {
        ...state,
        isPaused: message.payload.isPaused,
      };

    case 'UPDATE_INPUT_BUFFER':
      return {
        ...state,
        inputBuffer: message.payload.input,
      };

    case 'CLEAR_INPUT_BUFFER':
      return {
        ...state,
        inputBuffer: '',
      };

    case 'ADD_EXPLORATION_STEP':
      return {
        ...state,
        explorationPath: [...state.explorationPath, message.payload.step],
      };

    case 'POP_EXPLORATION':
      return {
        ...state,
        explorationPath: state.explorationPath.slice(0, -1),
      };

    case 'ADD_FINDING':
      return {
        ...state,
        findings: [...state.findings, message.payload.finding],
      };

    case 'ADD_RECOMMENDATION':
      return {
        ...state,
        recommendations: [...state.recommendations, message.payload.recommendation],
      };

    case 'SET_CONTEXT':
      return {
        ...state,
        currentContext: message.payload.context,
      };

    case 'CACHE_PERMISSION': {
      const newCache = new Map(state.permissionCache);
      newCache.set(message.payload.key, message.payload.decision);
      return {
        ...state,
        permissionCache: newCache,
      };
    }

    case 'SET_FOCUS':
      return {
        ...state,
        focusTarget: message.payload.target,
      };

    case 'SET_CHECKPOINT':
      return {
        ...state,
        lastCheckpoint: message.payload.checkpoint,
      };

    default:
      // TypeScript exhaustiveness check
      return state;
  }
};
