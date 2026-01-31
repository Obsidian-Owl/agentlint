/**
 * EP22 US-004 T051: TUI State Observability Instrumentation
 *
 * Provides instrumentation for TUI state transitions.
 * Records state changes as span events for observability.
 *
 * Tasks: T051
 */

import type { ActiveSpan } from '../types';
import type { TuiState } from '../../tui/types';
import type { AgentPhase } from '../../tui/state/agent-state';

/**
 * Record a TUI state transition as a span event.
 *
 * @param span - Active span to add event to
 * @param from - Previous TUI state
 * @param to - New TUI state
 *
 * @example
 * ```typescript
 * recordStateChange(span, 'loading', 'welcome');
 * // Adds event: tui.state.change with from/to attributes
 * ```
 */
export function recordStateChange(span: ActiveSpan, from: TuiState, to: TuiState): void {
  span.addEvent('tui.state.change', {
    'tui.state.from': from,
    'tui.state.to': to,
  });
}

/**
 * Record an agent work state transition as a span event.
 *
 * @param span - Active span to add event to
 * @param from - Previous agent work phase
 * @param to - New agent work phase
 *
 * @example
 * ```typescript
 * recordAgentWorkChange(span, 'idle', 'thinking');
 * // Adds event: tui.agent_work.change with from/to attributes
 * ```
 */
export function recordAgentWorkChange(span: ActiveSpan, from: AgentPhase, to: AgentPhase): void {
  span.addEvent('tui.agent_work.change', {
    'tui.agent_work.from': from,
    'tui.agent_work.to': to,
  });
}

/**
 * Record a user question prompt as a span event.
 *
 * @param span - Active span to add event to
 * @param requestId - Unique identifier for the question request
 * @param count - Number of questions asked
 *
 * @example
 * ```typescript
 * recordQuestionAsked(span, 'req-123', 3);
 * // Adds event: tui.question.asked with request_id and count
 * ```
 */
export function recordQuestionAsked(span: ActiveSpan, requestId: string, count: number): void {
  span.addEvent('tui.question.asked', {
    'tui.question.request_id': requestId,
    'tui.question.count': count,
  });
}
