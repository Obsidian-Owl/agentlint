/**
 * EP22 US-004 T053: TUI State Integration Tests
 *
 * Integration tests for TUI state transition observability.
 * Verifies that InkRenderer records state changes to trace context.
 *
 * IMPORTANT: These tests use the singleton traceContextProvider because
 * InkRenderer imports and uses the singleton internally. Tests must
 * register exporters on the singleton and clear them after each test.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'bun:test';
import { traceContextProvider, type SpanExporter } from '../../../src/observability/trace-context';
import type { ExportableSpan } from '../../../src/observability/exporters/local-exporter';
import { InkRenderer } from '../../../src/tui/renderers/ink-renderer';
import type { TuiState } from '../../../src/tui/types';
import type { AgentWorkState } from '../../../src/tui/state/agent-state';

describe('TUI State Integration', () => {
  let exportedSpans: ExportableSpan[];
  let mockExporter: SpanExporter;

  beforeAll(() => {
    // Mock stdin to prevent Ink errors in test environment
    if (!process.stdin.isTTY) {
      process.stdin.isTTY = true;
      process.stdin.setRawMode = () => process.stdin;
    }
  });

  beforeEach(() => {
    // Reset exported spans and register fresh exporter on singleton
    exportedSpans = [];
    mockExporter = {
      export: (spans: ExportableSpan[]) => {
        exportedSpans.push(...spans);
      },
    };
    traceContextProvider.registerExporter(mockExporter);
  });

  afterEach(() => {
    // Clear exporter to prevent test pollution
    traceContextProvider.clearExporter();
  });

  describe('InkRenderer State Transitions', () => {
    it('should record TUI state transitions in trace context', async () => {
      await traceContextProvider.run(async () => {
        const renderer = new InkRenderer();

        // Don't actually start the renderer (would create React instance)
        // Just test the state change methods which should emit events

        renderer.setTuiState('welcome');
        renderer.setTuiState('analysing');

        // Wait for instrumentation to complete
        await renderer.flushInstrumentation();
      });

      // Should have spans for state transitions
      expect(exportedSpans.length).toBeGreaterThan(0);

      // Find state transition spans
      const transitionSpans = exportedSpans.filter((s) => s.name === 'tui.state_transition');
      expect(transitionSpans.length).toBeGreaterThan(0);

      // Check for state change events
      const eventsWithStateChanges = transitionSpans
        .flatMap((s) => s.events)
        .filter((e) => e.name === 'tui.state.change');
      expect(eventsWithStateChanges.length).toBeGreaterThan(0);
    });

    it('should record agent work state transitions', async () => {
      await traceContextProvider.run(async () => {
        const renderer = new InkRenderer();

        const thinkingState: AgentWorkState = { phase: 'thinking', startedAt: Date.now() };
        renderer.setAgentState(thinkingState);

        const callingToolState: AgentWorkState = {
          phase: 'calling_tool',
          tool: 'test_tool',
          startedAt: Date.now(),
        };
        renderer.setAgentState(callingToolState);

        // Wait for instrumentation to complete
        await renderer.flushInstrumentation();
      });

      // Should have spans for agent work transitions
      expect(exportedSpans.length).toBeGreaterThan(0);

      const transitionSpans = exportedSpans.filter((s) => s.name === 'tui.agent_work_transition');
      expect(transitionSpans.length).toBeGreaterThan(0);

      // Check for agent work change events
      const eventsWithAgentChanges = transitionSpans
        .flatMap((s) => s.events)
        .filter((e) => e.name === 'tui.agent_work.change');
      expect(eventsWithAgentChanges.length).toBeGreaterThan(0);
    });

    it('should record question prompt events', async () => {
      await traceContextProvider.run(async () => {
        const renderer = new InkRenderer();

        // Request user answers - should record question event
        void renderer.requestUserAnswers({
          questions: [
            {
              question: 'Test question 1?',
              header: 'Question 1',
              options: [
                { label: 'Yes', description: 'Affirmative' },
                { label: 'No', description: 'Negative' },
              ],
            },
            {
              question: 'Test question 2?',
              header: 'Question 2',
              options: [{ label: 'Option A' }, { label: 'Option B' }],
            },
          ],
        });

        // Wait for instrumentation to complete
        await renderer.flushInstrumentation();

        // Note: We don't actually resolve the promise since that would require UI interaction
        // The event should be recorded regardless
      });

      // Should have spans for question prompts
      expect(exportedSpans.length).toBeGreaterThan(0);

      const questionSpans = exportedSpans.filter((s) => s.name === 'tui.question_prompt');
      expect(questionSpans.length).toBeGreaterThan(0);

      // Check for question asked events
      const eventsWithQuestions = questionSpans
        .flatMap((s) => s.events)
        .filter((e) => e.name === 'tui.question.asked');
      expect(eventsWithQuestions.length).toBeGreaterThan(0);

      // Verify event attributes
      const questionEvent = eventsWithQuestions[0]!;
      expect(questionEvent.attributes?.['tui.question.count']).toBe(2);
      expect(questionEvent.attributes?.['tui.question.request_id']).toBeDefined();
    });

    it('should not duplicate events for same-state transitions', async () => {
      await traceContextProvider.run(async () => {
        const renderer = new InkRenderer();

        // Set same state multiple times
        renderer.setTuiState('welcome');
        renderer.setTuiState('welcome');
        renderer.setTuiState('welcome');

        // Wait for instrumentation to complete
        await renderer.flushInstrumentation();
      });

      // Should only have one transition span (loading -> welcome)
      const transitionSpans = exportedSpans.filter((s) => s.name === 'tui.state_transition');
      expect(transitionSpans.length).toBe(1);
    });

    it('should handle trace context not available gracefully', () => {
      // Outside of traceContextProvider.run(), there's no trace context
      // Clear the exporter first to ensure we're testing without context
      traceContextProvider.clearExporter();

      const renderer = new InkRenderer();

      // These should not throw even without trace context
      // Note: setTuiState and setAgentState are synchronous and safe to call
      expect(() => renderer.setTuiState('welcome')).not.toThrow();
      expect(() =>
        renderer.setAgentState({ phase: 'thinking', startedAt: Date.now() })
      ).not.toThrow();

      // requestUserAnswers returns a Promise that never resolves without user input,
      // but calling it should not throw even without trace context.
      // Use .catch() to properly handle any async rejection per SonarQube guidelines.
      renderer.requestUserAnswers({ questions: [] }).catch(() => {
        // Expected - method may reject without trace context or with empty questions
      });
      // If we got here without throwing synchronously, the test passes
    });
  });

  describe('State Transition Sequence', () => {
    it('should record complete state transition sequence', async () => {
      await traceContextProvider.run(async () => {
        const renderer = new InkRenderer();

        // Simulate typical state flow
        const states: TuiState[] = ['loading', 'welcome', 'analysing', 'presenting'];
        for (const state of states) {
          renderer.setTuiState(state);
          await new Promise((resolve) => setTimeout(resolve, 10));
        }

        // Wait for instrumentation to complete
        await renderer.flushInstrumentation();
      });

      const transitionSpans = exportedSpans.filter((s) => s.name === 'tui.state_transition');
      expect(transitionSpans.length).toBe(3); // 3 transitions for 4 states

      // Verify sequence
      const events = transitionSpans
        .flatMap((s) => s.events)
        .filter((e) => e.name === 'tui.state.change');
      expect(events.length).toBe(3);

      // Check transition order
      expect(events[0]!.attributes?.['tui.state.from']).toBe('loading');
      expect(events[0]!.attributes?.['tui.state.to']).toBe('welcome');

      expect(events[1]!.attributes?.['tui.state.from']).toBe('welcome');
      expect(events[1]!.attributes?.['tui.state.to']).toBe('analysing');

      expect(events[2]!.attributes?.['tui.state.from']).toBe('analysing');
      expect(events[2]!.attributes?.['tui.state.to']).toBe('presenting');
    });

    it('should record agent work flow transitions', async () => {
      await traceContextProvider.run(async () => {
        const renderer = new InkRenderer();

        // Simulate agent work flow
        renderer.setAgentState({ phase: 'idle' });
        await new Promise((resolve) => setTimeout(resolve, 10));

        renderer.setAgentState({ phase: 'thinking', startedAt: Date.now() });
        await new Promise((resolve) => setTimeout(resolve, 10));

        renderer.setAgentState({ phase: 'calling_tool', tool: 'read_file', startedAt: Date.now() });
        await new Promise((resolve) => setTimeout(resolve, 10));

        renderer.setAgentState({ phase: 'streaming', startedAt: Date.now() });
        await new Promise((resolve) => setTimeout(resolve, 10));

        renderer.setAgentState({ phase: 'complete', durationMs: 1000 });

        // Wait for instrumentation to complete
        await renderer.flushInstrumentation();
      });

      const transitionSpans = exportedSpans.filter((s) => s.name === 'tui.agent_work_transition');
      expect(transitionSpans.length).toBe(4); // 4 transitions for 5 states

      const events = transitionSpans
        .flatMap((s) => s.events)
        .filter((e) => e.name === 'tui.agent_work.change');
      expect(events.length).toBe(4);

      // Verify flow
      expect(events[0]!.attributes?.['tui.agent_work.from']).toBe('idle');
      expect(events[0]!.attributes?.['tui.agent_work.to']).toBe('thinking');

      expect(events[1]!.attributes?.['tui.agent_work.from']).toBe('thinking');
      expect(events[1]!.attributes?.['tui.agent_work.to']).toBe('calling_tool');

      expect(events[2]!.attributes?.['tui.agent_work.from']).toBe('calling_tool');
      expect(events[2]!.attributes?.['tui.agent_work.to']).toBe('streaming');

      expect(events[3]!.attributes?.['tui.agent_work.from']).toBe('streaming');
      expect(events[3]!.attributes?.['tui.agent_work.to']).toBe('complete');
    });
  });
});
