/**
 * T060: Unit test verifying checkpoint includes trace_id and span_id
 * Tests that checkpoints capture trace context for replay correlation.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { CheckpointHandler, createCheckpointHandler } from '../../../src/orchestration/checkpoint';
import { traceContextProvider } from '../../../src/observability/trace-context';
import type { CheckpointEvent, SessionState } from '../../../src/orchestration/types';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a minimal SessionState for testing.
 * Allows overriding specific fields while providing sensible defaults.
 */
function createTestSessionState(overrides: Partial<SessionState> = {}): SessionState {
  return {
    id: 'test-session',
    startedAt: new Date().toISOString(),
    lastCheckpointAt: null,
    phase: 'analyze',
    findings: [],
    toolResultCache: {},
    checkpointSequence: 0,
    taskGoal: 'test task',
    projectContext: {
      name: 'test-project',
      path: '/test',
      hasClaudeMd: false,
      primaryLanguage: 'typescript',
      agentType: 'claude-code',
    },
    metrics: {
      toolCalls: 1,
      llmCalls: 0,
      tokensUsed: 0,
      elapsedMs: 100,
    },
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('Checkpoint Trace Context Integration', () => {
  let checkpointEvents: CheckpointEvent[];
  let handler: CheckpointHandler;

  beforeEach(() => {
    checkpointEvents = [];
    handler = createCheckpointHandler({
      onCheckpoint: (event) => {
        checkpointEvents.push(event);
      },
    }) as CheckpointHandler;
  });

  it('should include trace_id and span_id in checkpoint', async () => {
    await traceContextProvider.run(async () => {
      const context = traceContextProvider.getContext();
      expect(context).toBeDefined();
      expect(context?.traceId).toMatch(/^[0-9a-f]{32}$/);
      expect(context?.spanId).toMatch(/^[0-9a-f]{16}$/);

      const state = createTestSessionState();
      handler.emit('tool_complete', state, { toolName: 'test_tool' });

      expect(checkpointEvents).toHaveLength(1);
      const checkpoint = checkpointEvents[0];
      if (!checkpoint) throw new Error('Expected checkpoint to be defined');

      expect(checkpoint.state.traceContext).toBeDefined();
      expect(checkpoint.state.traceContext?.traceId).toBe(context?.traceId);
      expect(checkpoint.state.traceContext?.spanId).toBe(context?.spanId);
    });
  });

  it('should handle checkpoints without active trace context', () => {
    const state = createTestSessionState();
    handler.emit('tool_complete', state, { toolName: 'test_tool' });

    expect(checkpointEvents).toHaveLength(1);
    const checkpoint = checkpointEvents[0];
    expect(checkpoint).toBeDefined();
    // No trace context should be present if not running in trace
    expect(checkpoint?.state.traceContext).toBeUndefined();
  });

  it('should include parent_span_id when present', async () => {
    await traceContextProvider.run(async () => {
      await traceContextProvider.withSpan({ name: 'parent-operation' }, async () => {
        const context = traceContextProvider.getContext();
        expect(context?.parentSpanId).toBeDefined();

        const state = createTestSessionState();
        handler.emit('tool_complete', state, { toolName: 'test_tool' });

        expect(checkpointEvents).toHaveLength(1);
        const checkpoint = checkpointEvents[0];
        expect(checkpoint).toBeDefined();
        expect(checkpoint?.state.traceContext).toBeDefined();
        expect(checkpoint?.state.traceContext?.parentSpanId).toBe(context?.parentSpanId);
      });
    });
  });

  it('should preserve trace context through multiple checkpoints', async () => {
    await traceContextProvider.run(async () => {
      const context = traceContextProvider.getContext();
      const state = createTestSessionState({
        metrics: { toolCalls: 0, llmCalls: 0, tokensUsed: 0, elapsedMs: 0 },
      });

      handler.emit('tool_complete', state, { toolName: 'tool_1' });
      handler.emit('tool_complete', state, { toolName: 'tool_2' });
      handler.emit('phase_change', state, { newPhase: 'recommend' });

      expect(checkpointEvents).toHaveLength(3);

      // All checkpoints should have the same trace ID
      for (const checkpoint of checkpointEvents) {
        expect(checkpoint.state.traceContext?.traceId).toBe(context?.traceId);
      }
    });
  });

  it('should validate trace ID format (32 hex chars)', async () => {
    await traceContextProvider.run(async () => {
      const state = createTestSessionState();
      handler.emit('tool_complete', state);

      const checkpoint = checkpointEvents[0];
      expect(checkpoint).toBeDefined();
      expect(checkpoint?.state.traceContext?.traceId).toMatch(/^[0-9a-f]{32}$/);
    });
  });

  it('should validate span ID format (16 hex chars)', async () => {
    await traceContextProvider.run(async () => {
      const state = createTestSessionState();
      handler.emit('tool_complete', state);

      const checkpoint = checkpointEvents[0];
      expect(checkpoint).toBeDefined();
      expect(checkpoint?.state.traceContext?.spanId).toMatch(/^[0-9a-f]{16}$/);
    });
  });
});
