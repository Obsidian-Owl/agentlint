/**
 * Unit tests for appReducer
 *
 * Tests all 16 message types and state transitions.
 * Uses test-first approach per EP17 tasks.md.
 */

import { describe, test, expect } from 'bun:test';
import {
  createInitialState,
  type AppMessage,
  type ExplorationStep,
  type ConversationalContext,
  type PermissionDecision,
} from '../../../src/tui/types';
import type { Finding, Recommendation } from '../../../src/orchestration/types';
import { appReducer } from '../../../src/tui/state/app-reducer';

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockStreamChunk() {
  return {
    type: 'text' as const,
    level: 'normal' as const,
    content: 'Test content',
    timestamp: new Date().toISOString(),
  };
}

function createMockFinding(): Finding {
  return {
    id: 'finding-1',
    type: 'quality_issue',
    title: 'Test Finding',
    description: 'A test finding',
    severity: 'medium',
    location: { file: 'test.ts', line: 1 },
    origin: null,
    recommendations: [],
    detectedAt: new Date().toISOString(),
    detectedInPhase: 'analyze',
  };
}

function createMockRecommendation(): Recommendation {
  return {
    type: 'preventive',
    action: 'Test action',
    rationale: 'Test rationale',
    priority: 'medium',
    effort: 'small',
  };
}

function createMockExplorationStep(): ExplorationStep {
  return {
    id: 'step-1',
    topic: 'Test Topic',
    context: 'Test context',
    timestamp: new Date().toISOString(),
    parentId: null,
  };
}

function createMockConversationalContext(): ConversationalContext {
  return {
    currentTopic: 'testing',
    drillDownDepth: 1,
    mentionedEntities: ['skill-1'],
    lastAgentQuestion: 'What would you like to explore?',
    lastUserResponse: 'testing',
    pendingOptions: [],
  };
}

function createMockPermissionDecision(): PermissionDecision {
  return {
    allowed: true,
    scope: 'session',
    grantedAt: new Date().toISOString(),
    tool: 'read_file',
    pattern: '/path/to/file',
  };
}

function createMockCheckpoint() {
  return {
    version: '1.0' as const,
    sessionId: 'session-1',
    timestamp: new Date().toISOString(),
    sequence: 1,
    phase: 'analyze' as const,
    trigger: 'interval' as const,
    toolHistory: [],
    findings: [],
    metrics: {
      toolCalls: 0,
      llmCalls: 0,
      tokensUsed: 0,
      elapsedMs: 0,
    },
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('appReducer', () => {
  describe('SET_PHASE', () => {
    test('should update analysisPhase', () => {
      const state = createInitialState();
      const action: AppMessage = { type: 'SET_PHASE', payload: { phase: 'scanning' } };

      const newState = appReducer(state, action);

      expect(newState.analysisPhase).toBe('scanning');
    });

    test('should preserve other state fields', () => {
      const state = { ...createInitialState(), inputBuffer: 'test' };
      const action: AppMessage = { type: 'SET_PHASE', payload: { phase: 'exploring' } };

      const newState = appReducer(state, action);

      expect(newState.inputBuffer).toBe('test');
    });
  });

  describe('PUSH_DIALOG', () => {
    test('should push dialog to viewStack', () => {
      const state = createInitialState();
      const action: AppMessage = { type: 'PUSH_DIALOG', payload: { dialog: 'permission' } };

      const newState = appReducer(state, action);

      expect(newState.viewStack).toEqual(['permission']);
    });

    test('should stack multiple dialogs', () => {
      const state = { ...createInitialState(), viewStack: ['permission' as const] };
      const action: AppMessage = { type: 'PUSH_DIALOG', payload: { dialog: 'recommendation' } };

      const newState = appReducer(state, action);

      expect(newState.viewStack).toEqual(['permission', 'recommendation']);
    });

    test('should set focus to dialog', () => {
      const state = createInitialState();
      const action: AppMessage = { type: 'PUSH_DIALOG', payload: { dialog: 'permission' } };

      const newState = appReducer(state, action);

      expect(newState.focusTarget).toBe('dialog');
    });
  });

  describe('POP_DIALOG', () => {
    test('should pop top dialog from viewStack', () => {
      const state = {
        ...createInitialState(),
        viewStack: ['permission' as const, 'recommendation' as const],
      };
      const action: AppMessage = { type: 'POP_DIALOG' };

      const newState = appReducer(state, action);

      expect(newState.viewStack).toEqual(['permission']);
    });

    test('should return focus to main when stack empty', () => {
      const state = {
        ...createInitialState(),
        viewStack: ['permission' as const],
        focusTarget: 'dialog' as const,
      };
      const action: AppMessage = { type: 'POP_DIALOG' };

      const newState = appReducer(state, action);

      expect(newState.viewStack).toEqual([]);
      expect(newState.focusTarget).toBe('main');
    });

    test('should keep focus on dialog when stack not empty', () => {
      const state = {
        ...createInitialState(),
        viewStack: ['permission' as const, 'recommendation' as const],
        focusTarget: 'dialog' as const,
      };
      const action: AppMessage = { type: 'POP_DIALOG' };

      const newState = appReducer(state, action);

      expect(newState.focusTarget).toBe('dialog');
    });
  });

  describe('ADD_STREAM_CHUNK', () => {
    test('should append chunk to streamBuffer', () => {
      const state = createInitialState();
      const chunk = createMockStreamChunk();
      const action: AppMessage = { type: 'ADD_STREAM_CHUNK', payload: { chunk } };

      const newState = appReducer(state, action);

      expect(newState.streamBuffer).toHaveLength(1);
      expect(newState.streamBuffer[0]).toBe(chunk);
    });

    test('should preserve existing chunks', () => {
      const existingChunk = createMockStreamChunk();
      const state = { ...createInitialState(), streamBuffer: [existingChunk] };
      const newChunk = { ...createMockStreamChunk(), content: 'New content' };
      const action: AppMessage = { type: 'ADD_STREAM_CHUNK', payload: { chunk: newChunk } };

      const newState = appReducer(state, action);

      expect(newState.streamBuffer).toHaveLength(2);
    });
  });

  describe('CLEAR_STREAM', () => {
    test('should clear streamBuffer', () => {
      const state = { ...createInitialState(), streamBuffer: [createMockStreamChunk()] };
      const action: AppMessage = { type: 'CLEAR_STREAM' };

      const newState = appReducer(state, action);

      expect(newState.streamBuffer).toEqual([]);
    });
  });

  describe('SET_STREAMING', () => {
    test('should set isStreaming to true', () => {
      const state = createInitialState();
      const action: AppMessage = { type: 'SET_STREAMING', payload: { isStreaming: true } };

      const newState = appReducer(state, action);

      expect(newState.isStreaming).toBe(true);
    });

    test('should set isStreaming to false', () => {
      const state = { ...createInitialState(), isStreaming: true };
      const action: AppMessage = { type: 'SET_STREAMING', payload: { isStreaming: false } };

      const newState = appReducer(state, action);

      expect(newState.isStreaming).toBe(false);
    });
  });

  describe('SET_PAUSED', () => {
    test('should set isPaused to true', () => {
      const state = createInitialState();
      const action: AppMessage = { type: 'SET_PAUSED', payload: { isPaused: true } };

      const newState = appReducer(state, action);

      expect(newState.isPaused).toBe(true);
    });

    test('should set isPaused to false', () => {
      const state = { ...createInitialState(), isPaused: true };
      const action: AppMessage = { type: 'SET_PAUSED', payload: { isPaused: false } };

      const newState = appReducer(state, action);

      expect(newState.isPaused).toBe(false);
    });
  });

  describe('UPDATE_INPUT_BUFFER', () => {
    test('should update inputBuffer', () => {
      const state = createInitialState();
      const action: AppMessage = { type: 'UPDATE_INPUT_BUFFER', payload: { input: 'test input' } };

      const newState = appReducer(state, action);

      expect(newState.inputBuffer).toBe('test input');
    });
  });

  describe('CLEAR_INPUT_BUFFER', () => {
    test('should clear inputBuffer', () => {
      const state = { ...createInitialState(), inputBuffer: 'test input' };
      const action: AppMessage = { type: 'CLEAR_INPUT_BUFFER' };

      const newState = appReducer(state, action);

      expect(newState.inputBuffer).toBe('');
    });
  });

  describe('ADD_EXPLORATION_STEP', () => {
    test('should append step to explorationPath', () => {
      const state = createInitialState();
      const step = createMockExplorationStep();
      const action: AppMessage = { type: 'ADD_EXPLORATION_STEP', payload: { step } };

      const newState = appReducer(state, action);

      expect(newState.explorationPath).toHaveLength(1);
      expect(newState.explorationPath[0]).toBe(step);
    });

    test('should preserve existing steps', () => {
      const existingStep = createMockExplorationStep();
      const state = { ...createInitialState(), explorationPath: [existingStep] };
      const newStep = { ...createMockExplorationStep(), id: 'step-2', parentId: 'step-1' };
      const action: AppMessage = { type: 'ADD_EXPLORATION_STEP', payload: { step: newStep } };

      const newState = appReducer(state, action);

      expect(newState.explorationPath).toHaveLength(2);
    });
  });

  describe('POP_EXPLORATION', () => {
    test('should pop last step from explorationPath', () => {
      const step1 = createMockExplorationStep();
      const step2 = { ...createMockExplorationStep(), id: 'step-2' };
      const state = { ...createInitialState(), explorationPath: [step1, step2] };
      const action: AppMessage = { type: 'POP_EXPLORATION' };

      const newState = appReducer(state, action);

      expect(newState.explorationPath).toHaveLength(1);
      expect(newState.explorationPath[0]).toBe(step1);
    });

    test('should handle empty explorationPath', () => {
      const state = createInitialState();
      const action: AppMessage = { type: 'POP_EXPLORATION' };

      const newState = appReducer(state, action);

      expect(newState.explorationPath).toEqual([]);
    });
  });

  describe('ADD_FINDING', () => {
    test('should append finding to findings', () => {
      const state = createInitialState();
      const finding = createMockFinding();
      const action: AppMessage = { type: 'ADD_FINDING', payload: { finding } };

      const newState = appReducer(state, action);

      expect(newState.findings).toHaveLength(1);
      expect(newState.findings[0]).toBe(finding);
    });
  });

  describe('ADD_RECOMMENDATION', () => {
    test('should append recommendation to recommendations', () => {
      const state = createInitialState();
      const recommendation = createMockRecommendation();
      const action: AppMessage = { type: 'ADD_RECOMMENDATION', payload: { recommendation } };

      const newState = appReducer(state, action);

      expect(newState.recommendations).toHaveLength(1);
      expect(newState.recommendations[0]).toBe(recommendation);
    });
  });

  describe('SET_CONTEXT', () => {
    test('should update currentContext', () => {
      const state = createInitialState();
      const context = createMockConversationalContext();
      const action: AppMessage = { type: 'SET_CONTEXT', payload: { context } };

      const newState = appReducer(state, action);

      expect(newState.currentContext).toBe(context);
    });
  });

  describe('CACHE_PERMISSION', () => {
    test('should add permission to cache', () => {
      const state = createInitialState();
      const decision = createMockPermissionDecision();
      const action: AppMessage = {
        type: 'CACHE_PERMISSION',
        payload: { key: 'read_file:/path', decision },
      };

      const newState = appReducer(state, action);

      expect(newState.permissionCache.get('read_file:/path')).toBe(decision);
    });

    test('should not mutate original state', () => {
      const state = createInitialState();
      const decision = createMockPermissionDecision();
      const action: AppMessage = {
        type: 'CACHE_PERMISSION',
        payload: { key: 'read_file:/path', decision },
      };

      appReducer(state, action);

      expect(state.permissionCache.has('read_file:/path')).toBe(false);
    });
  });

  describe('SET_FOCUS', () => {
    test('should update focusTarget to main', () => {
      const state = { ...createInitialState(), focusTarget: 'dialog' as const };
      const action: AppMessage = { type: 'SET_FOCUS', payload: { target: 'main' } };

      const newState = appReducer(state, action);

      expect(newState.focusTarget).toBe('main');
    });

    test('should update focusTarget to input', () => {
      const state = createInitialState();
      const action: AppMessage = { type: 'SET_FOCUS', payload: { target: 'input' } };

      const newState = appReducer(state, action);

      expect(newState.focusTarget).toBe('input');
    });
  });

  describe('SET_CHECKPOINT', () => {
    test('should update lastCheckpoint', () => {
      const state = createInitialState();
      const checkpoint = createMockCheckpoint();
      const action: AppMessage = { type: 'SET_CHECKPOINT', payload: { checkpoint } };

      const newState = appReducer(state, action);

      expect(newState.lastCheckpoint).toBe(checkpoint);
    });
  });

  describe('state immutability', () => {
    test('should return new state object', () => {
      const state = createInitialState();
      const action: AppMessage = { type: 'SET_PHASE', payload: { phase: 'scanning' } };

      const newState = appReducer(state, action);

      expect(newState).not.toBe(state);
    });

    test('should not mutate arrays', () => {
      const state = createInitialState();
      const originalFindings = state.findings;
      const action: AppMessage = { type: 'ADD_FINDING', payload: { finding: createMockFinding() } };

      const newState = appReducer(state, action);

      expect(newState.findings).not.toBe(originalFindings);
      expect(state.findings).toHaveLength(0);
    });
  });
});
