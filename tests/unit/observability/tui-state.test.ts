/**
 * EP22 US-004 T050: TUI State Observability Tests
 *
 * Tests for TUI state transition instrumentation.
 * Verifies that state changes are recorded as span events.
 */

import { describe, it, expect } from 'bun:test';
import { TraceContextProvider, type SpanExporter } from '../../../src/observability/trace-context';
import type { ExportableSpan } from '../../../src/observability/exporters/local-exporter';
import {
  recordStateChange,
  recordAgentWorkChange,
  recordQuestionAsked,
} from '../../../src/observability/instrumentation/tui';
import type { TuiState } from '../../../src/tui/types';
import type { AgentPhase } from '../../../src/tui/state/agent-state';

describe('TUI State Instrumentation', () => {
  describe('recordStateChange', () => {
    it('should add span event for TUI state transitions', async () => {
      const provider = new TraceContextProvider();
      const exportedSpans: ExportableSpan[] = [];

      const mockExporter: SpanExporter = {
        export: (spans: ExportableSpan[]) => {
          exportedSpans.push(...spans);
        },
      };

      provider.registerExporter(mockExporter);

      await provider.run(async () => {
        await provider.withSpan({ name: 'test-span' }, async (span) => {
          recordStateChange(span, 'loading', 'welcome');
        });
      });

      expect(exportedSpans).toHaveLength(1);
      const span = exportedSpans[0]!;
      expect(span.events).toHaveLength(1);
      expect(span.events[0]!.name).toBe('tui.state.change');
      expect(span.events[0]!.attributes).toEqual({
        'tui.state.from': 'loading',
        'tui.state.to': 'welcome',
      });
    });

    it('should record multiple state transitions', async () => {
      const provider = new TraceContextProvider();
      const exportedSpans: ExportableSpan[] = [];

      const mockExporter: SpanExporter = {
        export: (spans: ExportableSpan[]) => {
          exportedSpans.push(...spans);
        },
      };

      provider.registerExporter(mockExporter);

      await provider.run(async () => {
        await provider.withSpan({ name: 'test-span' }, async (span) => {
          recordStateChange(span, 'loading', 'welcome');
          recordStateChange(span, 'welcome', 'analysing');
          recordStateChange(span, 'analysing', 'presenting');
        });
      });

      expect(exportedSpans).toHaveLength(1);
      const span = exportedSpans[0]!;
      expect(span.events).toHaveLength(3);

      expect(span.events[0]!.name).toBe('tui.state.change');
      expect(span.events[0]!.attributes).toEqual({
        'tui.state.from': 'loading',
        'tui.state.to': 'welcome',
      });

      expect(span.events[1]!.name).toBe('tui.state.change');
      expect(span.events[1]!.attributes).toEqual({
        'tui.state.from': 'welcome',
        'tui.state.to': 'analysing',
      });

      expect(span.events[2]!.name).toBe('tui.state.change');
      expect(span.events[2]!.attributes).toEqual({
        'tui.state.from': 'analysing',
        'tui.state.to': 'presenting',
      });
    });

    it('should handle all valid TUI states', async () => {
      const provider = new TraceContextProvider();
      const exportedSpans: ExportableSpan[] = [];

      const mockExporter: SpanExporter = {
        export: (spans: ExportableSpan[]) => {
          exportedSpans.push(...spans);
        },
      };

      provider.registerExporter(mockExporter);

      const states: TuiState[] = [
        'loading',
        'welcome',
        'analysing',
        'presenting',
        'idle',
        'conversing',
      ];

      await provider.run(async () => {
        await provider.withSpan({ name: 'test-span' }, async (span) => {
          for (let i = 0; i < states.length - 1; i++) {
            recordStateChange(span, states[i]!, states[i + 1]!);
          }
        });
      });

      expect(exportedSpans).toHaveLength(1);
      const span = exportedSpans[0]!;
      expect(span.events).toHaveLength(states.length - 1);
    });
  });

  describe('recordAgentWorkChange', () => {
    it('should add span event for agent work state transitions', async () => {
      const provider = new TraceContextProvider();
      const exportedSpans: ExportableSpan[] = [];

      const mockExporter: SpanExporter = {
        export: (spans: ExportableSpan[]) => {
          exportedSpans.push(...spans);
        },
      };

      provider.registerExporter(mockExporter);

      await provider.run(async () => {
        await provider.withSpan({ name: 'test-span' }, async (span) => {
          recordAgentWorkChange(span, 'idle', 'thinking');
        });
      });

      expect(exportedSpans).toHaveLength(1);
      const span = exportedSpans[0]!;
      expect(span.events).toHaveLength(1);
      expect(span.events[0]!.name).toBe('tui.agent_work.change');
      expect(span.events[0]!.attributes).toEqual({
        'tui.agent_work.from': 'idle',
        'tui.agent_work.to': 'thinking',
      });
    });

    it('should record agent work phase transitions', async () => {
      const provider = new TraceContextProvider();
      const exportedSpans: ExportableSpan[] = [];

      const mockExporter: SpanExporter = {
        export: (spans: ExportableSpan[]) => {
          exportedSpans.push(...spans);
        },
      };

      provider.registerExporter(mockExporter);

      await provider.run(async () => {
        await provider.withSpan({ name: 'test-span' }, async (span) => {
          recordAgentWorkChange(span, 'idle', 'thinking');
          recordAgentWorkChange(span, 'thinking', 'calling_tool');
          recordAgentWorkChange(span, 'calling_tool', 'waiting_response');
          recordAgentWorkChange(span, 'waiting_response', 'streaming');
          recordAgentWorkChange(span, 'streaming', 'complete');
        });
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
        expect(span.events[i]!.name).toBe('tui.agent_work.change');
        expect(span.events[i]!.attributes).toEqual({
          'tui.agent_work.from': phases[i],
          'tui.agent_work.to': nextPhases[i],
        });
      }
    });

    it('should handle error state transitions', async () => {
      const provider = new TraceContextProvider();
      const exportedSpans: ExportableSpan[] = [];

      const mockExporter: SpanExporter = {
        export: (spans: ExportableSpan[]) => {
          exportedSpans.push(...spans);
        },
      };

      provider.registerExporter(mockExporter);

      await provider.run(async () => {
        await provider.withSpan({ name: 'test-span' }, async (span) => {
          recordAgentWorkChange(span, 'thinking', 'error');
          recordAgentWorkChange(span, 'error', 'idle');
        });
      });

      expect(exportedSpans).toHaveLength(1);
      const span = exportedSpans[0]!;
      expect(span.events).toHaveLength(2);

      expect(span.events[0]!.attributes).toEqual({
        'tui.agent_work.from': 'thinking',
        'tui.agent_work.to': 'error',
      });

      expect(span.events[1]!.attributes).toEqual({
        'tui.agent_work.from': 'error',
        'tui.agent_work.to': 'idle',
      });
    });
  });

  describe('recordQuestionAsked', () => {
    it('should add span event for question prompts', async () => {
      const provider = new TraceContextProvider();
      const exportedSpans: ExportableSpan[] = [];

      const mockExporter: SpanExporter = {
        export: (spans: ExportableSpan[]) => {
          exportedSpans.push(...spans);
        },
      };

      provider.registerExporter(mockExporter);

      await provider.run(async () => {
        await provider.withSpan({ name: 'test-span' }, async (span) => {
          recordQuestionAsked(span, 'req-123', 3);
        });
      });

      expect(exportedSpans).toHaveLength(1);
      const span = exportedSpans[0]!;
      expect(span.events).toHaveLength(1);
      expect(span.events[0]!.name).toBe('tui.question.asked');
      expect(span.events[0]!.attributes).toEqual({
        'tui.question.request_id': 'req-123',
        'tui.question.count': 3,
      });
    });

    it('should record multiple question prompts', async () => {
      const provider = new TraceContextProvider();
      const exportedSpans: ExportableSpan[] = [];

      const mockExporter: SpanExporter = {
        export: (spans: ExportableSpan[]) => {
          exportedSpans.push(...spans);
        },
      };

      provider.registerExporter(mockExporter);

      await provider.run(async () => {
        await provider.withSpan({ name: 'test-span' }, async (span) => {
          recordQuestionAsked(span, 'req-1', 2);
          recordQuestionAsked(span, 'req-2', 4);
          recordQuestionAsked(span, 'req-3', 1);
        });
      });

      expect(exportedSpans).toHaveLength(1);
      const span = exportedSpans[0]!;
      expect(span.events).toHaveLength(3);

      expect(span.events[0]!.attributes).toEqual({
        'tui.question.request_id': 'req-1',
        'tui.question.count': 2,
      });

      expect(span.events[1]!.attributes).toEqual({
        'tui.question.request_id': 'req-2',
        'tui.question.count': 4,
      });

      expect(span.events[2]!.attributes).toEqual({
        'tui.question.request_id': 'req-3',
        'tui.question.count': 1,
      });
    });

    it('should handle single question prompts', async () => {
      const provider = new TraceContextProvider();
      const exportedSpans: ExportableSpan[] = [];

      const mockExporter: SpanExporter = {
        export: (spans: ExportableSpan[]) => {
          exportedSpans.push(...spans);
        },
      };

      provider.registerExporter(mockExporter);

      await provider.run(async () => {
        await provider.withSpan({ name: 'test-span' }, async (span) => {
          recordQuestionAsked(span, 'single-question', 1);
        });
      });

      expect(exportedSpans).toHaveLength(1);
      const span = exportedSpans[0]!;
      expect(span.events).toHaveLength(1);
      expect(span.events[0]!.attributes).toEqual({
        'tui.question.request_id': 'single-question',
        'tui.question.count': 1,
      });
    });
  });

  describe('Integration', () => {
    it('should record mixed TUI events in single span', async () => {
      const provider = new TraceContextProvider();
      const exportedSpans: ExportableSpan[] = [];

      const mockExporter: SpanExporter = {
        export: (spans: ExportableSpan[]) => {
          exportedSpans.push(...spans);
        },
      };

      provider.registerExporter(mockExporter);

      await provider.run(async () => {
        await provider.withSpan({ name: 'test-span' }, async (span) => {
          recordStateChange(span, 'loading', 'welcome');
          recordAgentWorkChange(span, 'idle', 'thinking');
          recordQuestionAsked(span, 'req-1', 2);
          recordStateChange(span, 'welcome', 'analysing');
          recordAgentWorkChange(span, 'thinking', 'calling_tool');
        });
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
      const provider = new TraceContextProvider();
      const exportedSpans: ExportableSpan[] = [];

      const mockExporter: SpanExporter = {
        export: (spans: ExportableSpan[]) => {
          exportedSpans.push(...spans);
        },
      };

      provider.registerExporter(mockExporter);

      await provider.run(async () => {
        await provider.withSpan({ name: 'test-span' }, async (span) => {
          recordStateChange(span, 'loading', 'welcome');
          await new Promise((resolve) => setTimeout(resolve, 10));
          recordAgentWorkChange(span, 'idle', 'thinking');
          await new Promise((resolve) => setTimeout(resolve, 10));
          recordQuestionAsked(span, 'req-1', 1);
        });
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
