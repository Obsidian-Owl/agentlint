/**
 * EP22: Streaming Instrumentation (US-003)
 *
 * Utilities for capturing SSE streaming observability.
 * Records first_token latency, chunk counts (aggregated), and stream completion stats.
 *
 * Tasks: T045, T046, T047
 */

import type { ActiveSpan } from '../types';
import { AgentlintAttributes } from '../span-factory';

/** Stream aggregation statistics */
export interface StreamStats {
  chunkCount: number;
  durationMs: number;
  inputTokens?: number;
  outputTokens?: number;
  tokensPerSecond?: number;
}

/**
 * Instrument a stream span - creates span and returns handle.
 * The caller manages the span lifecycle via traceContextProvider.withSpan().
 *
 * This is a placeholder for future stream-specific initialization if needed.
 * Currently, spans are created via spanFactory.createStreamSpan().
 *
 * @param streamId - Unique stream identifier
 * @returns Stream instrumentation handle (currently unused but reserved for future)
 */
export function instrumentStream(_streamId: string): Record<string, never> {
  // Reserved for future stream-specific initialization
  // Currently spans are created via spanFactory.createStreamSpan()
  return {};
}

/**
 * Record first token event with latency.
 * T045: Capture first_token latency as both event and attribute.
 *
 * @param span - Active span
 * @param latencyMs - Time from stream start to first token
 */
export function recordFirstToken(span: ActiveSpan, latencyMs: number): void {
  // Add event for milestone tracking
  span.addEvent('first_token', { latency_ms: latencyMs });

  // Add attribute for aggregation and query
  span.setAttribute(AgentlintAttributes.STREAM_FIRST_TOKEN_MS, latencyMs);
}

/**
 * Record stream completion with aggregate statistics.
 * T046: Set aggregate stats as attributes, not individual events.
 *
 * @param span - Active span
 * @param stats - Aggregate stream statistics
 */
export function recordStreamComplete(span: ActiveSpan, stats: StreamStats): void {
  // Add completion event (milestone)
  span.addEvent('stream_complete', {});

  // Set aggregate attributes (not individual chunk events)
  span.setAttribute(AgentlintAttributes.STREAM_CHUNK_COUNT, stats.chunkCount);
  span.setAttribute(AgentlintAttributes.STREAM_DURATION_MS, stats.durationMs);

  if (stats.inputTokens !== undefined) {
    span.setAttribute('gen_ai.usage.input_tokens', stats.inputTokens);
  }

  if (stats.outputTokens !== undefined) {
    span.setAttribute('gen_ai.usage.output_tokens', stats.outputTokens);
  }

  if (stats.tokensPerSecond !== undefined) {
    span.setAttribute('gen_ai.response.tokens_per_second', stats.tokensPerSecond);
  }
}
