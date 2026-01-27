/**
 * Agent Work State Machine
 *
 * Defines explicit phases for agent work with valid transitions.
 * Used for UI feedback during analysis.
 *
 * @module tui/state/agent-state
 */

// =============================================================================
// State Types
// =============================================================================

export type AgentWorkState =
  | { phase: 'idle' }
  | { phase: 'thinking'; startedAt: number }
  | { phase: 'calling_tool'; tool: string; startedAt: number }
  | { phase: 'waiting_response'; tool: string; startedAt: number }
  | { phase: 'streaming'; startedAt: number }
  | { phase: 'error'; message: string }
  | { phase: 'complete'; durationMs: number };

export type AgentPhase = AgentWorkState['phase'];

// =============================================================================
// Transition Validation
// =============================================================================

export const VALID_TRANSITIONS: Record<AgentPhase, AgentPhase[]> = {
  idle: ['thinking'],
  thinking: ['calling_tool', 'streaming', 'error', 'complete'],
  calling_tool: ['waiting_response', 'error'],
  waiting_response: ['thinking', 'streaming', 'error'],
  streaming: ['thinking', 'calling_tool', 'complete', 'error'],
  error: ['idle'],
  complete: ['idle'],
};

export function isValidTransition(from: AgentPhase, to: AgentPhase): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// =============================================================================
// State Factories
// =============================================================================

export function createIdleState(): AgentWorkState {
  return { phase: 'idle' };
}

export function createThinkingState(): AgentWorkState {
  return { phase: 'thinking', startedAt: Date.now() };
}

export function createCallingToolState(tool: string): AgentWorkState {
  return { phase: 'calling_tool', tool, startedAt: Date.now() };
}

export function createWaitingResponseState(tool: string): AgentWorkState {
  return { phase: 'waiting_response', tool, startedAt: Date.now() };
}

export function createStreamingState(): AgentWorkState {
  return { phase: 'streaming', startedAt: Date.now() };
}

export function createErrorState(message: string): AgentWorkState {
  return { phase: 'error', message };
}

export function createCompleteState(durationMs: number): AgentWorkState {
  return { phase: 'complete', durationMs };
}

// =============================================================================
// Utilities
// =============================================================================

export function getElapsedMs(state: AgentWorkState): number | null {
  if ('startedAt' in state) {
    return Date.now() - state.startedAt;
  }
  return null;
}

export function getToolName(state: AgentWorkState): string | null {
  if ('tool' in state) {
    return state.tool;
  }
  return null;
}
