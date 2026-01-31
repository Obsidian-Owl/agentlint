/**
 * EP22 US-004 T050: TUI State Observability Tests
 *
 * Tests for TUI state transition instrumentation.
 * Verifies that state changes are recorded as span events.
 */

import { describe, it, expect } from 'bun:test';
import { TraceContextProvider, type SpanExporter } from '../../../src/observability/trace-context';
import type { ExportableSpan } from '../../../src/observability/exporters/local-exporter';
import type { ActiveSpan } from '../../../src/observability/types';
import {
  recordStateChange,
  recordAgentWorkChange,
  recordQuestionAsked,
} from '../../../src/observability/instrumentation/tui';
import type { TuiState } from '../../../src/tui/types';
import type { AgentPhase } from '../../../src/tui/state/agent-state';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a TraceContextProvider with a mock exporter that captures spans.
 * Returns the provider and array of exported spans.
 */
function createTestProvider() {
  const provider = new TraceContextProvider();
  const exportedSpans: ExportableSpan[] = [];

  const mockExporter: SpanExporter = {
    export: (spans: ExportableSpan[]) => {
      exportedSpans.push(...spans);
    },
  };

  provider.registerExporter(mockExporter);

  return { provider, exportedSpans };
}

/**
 * Executes a test function within a span and returns the exported spans.
 */
async function withTestSpan(
  fn: (span: ActiveSpan) => void | Promise<void>
): Promise<ExportableSpan[]> {
  const { provider, exportedSpans } = createTestProvider();

  await provider.run(async () => {
    await provider.withSpan({ name: 'test-span' }, async (span) => {
      await fn(span);
    });
  });

  return exportedSpans;
}

/**
 * Asserts that a span event has expected name and attributes.
 */
function expectEventMatch(
  event: ExportableSpan['events'][0],
  expectedName: string,
  expectedAttrs: Record<string, unknown>
) {
  expect(event.name).toBe(expectedName);
  expect(event.attributes).toEqual(expectedAttrs);
}

describe('TUI State Instrumentation', () => {
  describe('recordStateChange', () => {
    it('should add span event for TUI state transitions', async () => {
      const exportedSpans = await withTestSpan((span) => {
        recordStateChange(span, 'loading', 'welcome');
      });

      expect(exportedSpans).toHaveLength(1);
      const span = exportedSpans[0]!;
      expect(span.events).toHaveLength(1);
      expectEventMatch(span.events[0]!, 'tui.state.change', {
        'tui.state.from': 'loading',
        'tui.state.to': 'welcome',
      });
    });

    it('should record multiple state transitions', async () => {
      const exportedSpans = await withTestSpan((span) => {
        recordStateChange(span, 'loading', 'welcome');
        recordStateChange(span, 'welcome', 'analysing');
        recordStateChange(span, 'analysing', 'presenting');
      });

      expect(exportedSpans).toHaveLength(1);
      const span = exportedSpans[0]!;
      expect(span.events).toHaveLength(3);

      expectEventMatch(span.events[0]!, 'tui.state.change', {
        'tui.state.from': 'loading',
        'tui.state.to': 'welcome',
      });

      expectEventMatch(span.events[1]!, 'tui.state.change', {
        'tui.state.from': 'welcome',
        'tui.state.to': 'analysing',
      });

      expectEventMatch(span.events[2]!, 'tui.state.change', {
        'tui.state.from': 'analysing',
        'tui.state.to': 'presenting',
      });
    });

    it('should handle all valid TUI states', async () => {
      const states: TuiState[] = [
        'loading',
        'welcome',
        'analysing',
        'presenting',
        'idle',
        'conversing',
      ];

      const exportedSpans = await withTestSpan((span) => {
        for (let i = 0; i < states.length - 1; i++) {
          recordStateChange(span, states[i]!, states[i + 1]!);
        }
      });

      expect(exportedSpans).toHaveLength(1);
      const span = exportedSpans[0]!;
      expect(span.events).toHaveLength(states.length - 1);
    });
  });

  describe('recordAgentWorkChange', () => {
    it('should add span event for agent work state transitions', async () => {
      const exportedSpans = await withTestSpan((span) => {
        recordAgentWorkChange(span, 'idle', 'thinking');
      });

      expect(exportedSpans).toHaveLength(1);
      const span = exportedSpans[0]!;
      expect(span.events).toHaveLength(1);
      expectEventMatch(span.events[0]!, 'tui.agent_work.change', {
        'tui.agent_work.from': 'idle',
        'tui.agent_work.to': 'thinking',
      });
    });

    it('should record agent work phase transitions', async () => {
      const exportedSpans = await withTestSpan((span) => {
        recordAgentWorkChange(span, 'idle', 'thinking');
        recordAgentWorkChange(span, 'thinking', 'calling_tool');
        recordAgentWorkChange(span, 'calling_tool', 'waiting_response');
        recordAgentWorkChange(span, 'waiting_response', 'streaming');
        recordAgentWorkChange(span, 'streaming', 'complete');
      });

      expect(exportedSpans).toHaveLength(1);
      const span = exportedSpans[0]!;
      expect(span.events).toHaveLength(5);

      const phases: AgentPhase[] = [
        'idle',
        'thinking',
        'calling_tool',
        'waiting_response',
        'streaming',
      ];
      const nextPhases: AgentPhase[] = [
        'thinking',
        'calling_tool',
        'waiting_response',
        'streaming',
        'complete',
      ];

      for (let i = 0; i < phases.length; i++) {
        expectEventMatch(span.events[i]!, 'tui.agent_work.change', {
          'tui.agent_work.from': phases[i],
          'tui.agent_work.to': nextPhases[i],
        });
      }
    });

    it('should handle error state transitions', async () => {
      const exportedSpans = await withTestSpan((span) => {
        recordAgentWorkChange(span, 'thinking', 'error');
        recordAgentWorkChange(span, 'error', 'idle');
      });

      expect(exportedSpans).toHaveLength(1);
      const span = exportedSpans[0]!;
      expect(span.events).toHaveLength(2);

      expectEventMatch(span.events[0]!, 'tui.agent_work.change', {
        'tui.agent_work.from': 'thinking',
        'tui.agent_work.to': 'error',
      });

      expectEventMatch(span.events[1]!, 'tui.agent_work.change', {
        'tui.agent_work.from': 'error',
        'tui.agent_work.to': 'idle',
      });
    });
  });

  describe('recordQuestionAsked', () => {
    it('should add span event for question prompts', async () => {
      const exportedSpans = await withTestSpan((span) => {
        recordQuestionAsked(span, 'req-123', 3);
      });

      expect(exportedSpans).toHaveLength(1);
      const span = exportedSpans[0]!;
      expect(span.events).toHaveLength(1);
      expectEventMatch(span.events[0]!, 'tui.question.asked', {
        'tui.question.request_id': 'req-123',
        'tui.question.count': 3,
      });
    });

    it('should record multiple question prompts', async () => {
      const exportedSpans = await withTestSpan((span) => {
        recordQuestionAsked(span, 'req-1', 2);
        recordQuestionAsked(span, 'req-2', 4);
        recordQuestionAsked(span, 'req-3', 1);
      });

      expect(exportedSpans).toHaveLength(1);
      const span = exportedSpans[0]!;
      expect(span.events).toHaveLength(3);

      expectEventMatch(span.events[0]!, 'tui.question.asked', {
        'tui.question.request_id': 'req-1',
        'tui.question.count': 2,
      });

      expectEventMatch(span.events[1]!, 'tui.question.asked', {
        'tui.question.request_id': 'req-2',
        'tui.question.count': 4,
      });

      expectEventMatch(span.events[2]!, 'tui.question.asked', {
        'tui.question.request_id': 'req-3',
        'tui.question.count': 1,
      });
    });

    it('should handle single question prompts', async () => {
      const exportedSpans = await withTestSpan((span) => {
        recordQuestionAsked(span, 'single-question', 1);
      });

      expect(exportedSpans).toHaveLength(1);
      const span = exportedSpans[0]!;
      expect(span.events).toHaveLength(1);
      expectEventMatch(span.events[0]!, 'tui.question.asked', {
        'tui.question.request_id': 'single-question',
        'tui.question.count': 1,
      });
    });
  });

  describe('Integration', () => {
    it('should record mixed TUI events in single span', async () => {
      const exportedSpans = await withTestSpan((span) => {
        recordStateChange(span, 'loading', 'welcome');
        recordAgentWorkChange(span, 'idle', 'thinking');
        recordQuestionAsked(span, 'req-1', 2);
        recordStateChange(span, 'welcome', 'analysing');
        recordAgentWorkChange(span, 'thinking', 'calling_tool');
      });

      expect(exportedSpans).toHaveLength(1);
      const span = exportedSpans[0]!;
      expect(span.events).toHaveLength(5);

      expect(span.events[0]!.name).toBe('tui.state.change');
      expect(span.events[1]!.name).toBe('tui.agent_work.change');
      expect(span.events[2]!.name).toBe('tui.question.asked');
      expect(span.events[3]!.name).toBe('tui.state.change');
      expect(span.events[4]!.name).toBe('tui.agent_work.change');
    });

    it('should maintain event order chronologically', async () => {
      const exportedSpans = await withTestSpan(async (span) => {
        recordStateChange(span, 'loading', 'welcome');
        await new Promise((resolve) => setTimeout(resolve, 10));
        recordAgentWorkChange(span, 'idle', 'thinking');
        await new Promise((resolve) => setTimeout(resolve, 10));
        recordQuestionAsked(span, 'req-1', 1);
      });

      expect(exportedSpans).toHaveLength(1);
      const span = exportedSpans[0]!;
      expect(span.events).toHaveLength(3);

      // Verify timestamps are in order
      expect(span.events[0]!.timestamp).toBeLessThanOrEqual(span.events[1]!.timestamp);
      expect(span.events[1]!.timestamp).toBeLessThanOrEqual(span.events[2]!.timestamp);
    });
  });
});
