/**
 * EP11 Quality & Security - Token Usage and Latency Tracking
 *
 * Provides metrics collection for LLM calls including token usage,
 * latency measurements, and cache hit rates.
 *
 * @module debug/metrics
 */

import type { IDebugLogger } from './types';
import { DEBUG_NAMESPACES } from './namespaces';

// =============================================================================
// Types
// =============================================================================

/**
 * Token usage for a single LLM call.
 */
export interface TokenUsage {
  /** Number of input tokens */
  inputTokens: number;
  /** Number of output tokens */
  outputTokens: number;
  /** Total tokens (input + output) */
  totalTokens: number;
}

/**
 * Latency metrics for a single operation.
 */
export interface LatencyMetrics {
  /** Duration in milliseconds */
  durationMs: number;
  /** Start time ISO string */
  startTime: string;
  /** End time ISO string */
  endTime: string;
}

/**
 * Combined metrics for an LLM call.
 */
export interface LLMCallMetrics {
  /** Unique call identifier */
  callId: string;
  /** Model identifier */
  model: string;
  /** Token usage */
  tokens: TokenUsage;
  /** Latency metrics */
  latency: LatencyMetrics;
  /** Whether response came from cache */
  cached: boolean;
}

/**
 * Aggregated metrics summary.
 */
export interface MetricsSummary {
  /** Total number of LLM calls */
  totalCalls: number;
  /** Total input tokens across all calls */
  totalInputTokens: number;
  /** Total output tokens across all calls */
  totalOutputTokens: number;
  /** Total tokens (input + output) */
  totalTokens: number;
  /** Total latency in milliseconds */
  totalLatencyMs: number;
  /** Average latency per call in milliseconds */
  averageLatencyMs: number;
  /** Cache hit rate (0-1) */
  cacheHitRate: number;
  /** Call counts by model */
  callsByModel: Record<string, number>;
}

/**
 * Interface for metrics tracking.
 */
export interface ITokenTracker {
  /** Record an LLM call */
  recordCall(metrics: LLMCallMetrics): void;
  /** Get all recorded calls */
  getCalls(): LLMCallMetrics[];
  /** Get a specific call by ID */
  getCallById(callId: string): LLMCallMetrics | undefined;
  /** Get aggregated summary */
  getSummary(): MetricsSummary;
  /** Get token usage aggregated by model */
  getTokensPerModel(): Record<string, TokenUsage>;
  /** Reset all recorded calls */
  reset(): void;
}

// =============================================================================
// TokenTracker Implementation
// =============================================================================

/**
 * Tracks token usage and latency metrics for LLM calls.
 *
 * @example
 * ```typescript
 * const tracker = createTokenTracker();
 *
 * tracker.recordCall({
 *   callId: 'call-123',
 *   model: 'claude-sonnet-4-20250514',
 *   tokens: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
 *   latency: { durationMs: 1500, startTime: '...', endTime: '...' },
 *   cached: false,
 * });
 *
 * const summary = tracker.getSummary();
 * console.log(`Total tokens: ${summary.totalTokens}`);
 * ```
 */
export class TokenTracker implements ITokenTracker {
  private calls: LLMCallMetrics[] = [];
  private logger: IDebugLogger | undefined;

  constructor(logger?: IDebugLogger) {
    this.logger = logger;
  }

  /**
   * Record an LLM call.
   */
  recordCall(metrics: LLMCallMetrics): void {
    this.calls.push(metrics);

    if (this.logger) {
      this.logger.debug(
        DEBUG_NAMESPACES.LLM,
        `LLM call ${metrics.callId}: ${metrics.tokens.totalTokens} tokens, ${metrics.latency.durationMs}ms${metrics.cached ? ' (cached)' : ''}`
      );
    }
  }

  /**
   * Get all recorded calls.
   */
  getCalls(): LLMCallMetrics[] {
    return [...this.calls];
  }

  /**
   * Get a specific call by ID.
   */
  getCallById(callId: string): LLMCallMetrics | undefined {
    return this.calls.find((c) => c.callId === callId);
  }

  /**
   * Get aggregated summary of all calls.
   */
  getSummary(): MetricsSummary {
    const totalCalls = this.calls.length;

    if (totalCalls === 0) {
      return {
        totalCalls: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        totalLatencyMs: 0,
        averageLatencyMs: 0,
        cacheHitRate: 0,
        callsByModel: {},
      };
    }

    const totalInputTokens = this.calls.reduce((sum, c) => sum + c.tokens.inputTokens, 0);
    const totalOutputTokens = this.calls.reduce((sum, c) => sum + c.tokens.outputTokens, 0);
    const totalTokens = this.calls.reduce((sum, c) => sum + c.tokens.totalTokens, 0);
    const totalLatencyMs = this.calls.reduce((sum, c) => sum + c.latency.durationMs, 0);
    const cacheHits = this.calls.filter((c) => c.cached).length;

    const callsByModel: Record<string, number> = {};
    for (const call of this.calls) {
      callsByModel[call.model] = (callsByModel[call.model] ?? 0) + 1;
    }

    return {
      totalCalls,
      totalInputTokens,
      totalOutputTokens,
      totalTokens,
      totalLatencyMs,
      averageLatencyMs: totalLatencyMs / totalCalls,
      cacheHitRate: cacheHits / totalCalls,
      callsByModel,
    };
  }

  /**
   * Get token usage aggregated by model.
   */
  getTokensPerModel(): Record<string, TokenUsage> {
    const result: Record<string, TokenUsage> = {};

    for (const call of this.calls) {
      const existing = result[call.model] ?? { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
      result[call.model] = {
        inputTokens: existing.inputTokens + call.tokens.inputTokens,
        outputTokens: existing.outputTokens + call.tokens.outputTokens,
        totalTokens: existing.totalTokens + call.tokens.totalTokens,
      };
    }

    return result;
  }

  /**
   * Reset all recorded calls.
   */
  reset(): void {
    this.calls = [];

    if (this.logger) {
      this.logger.debug(DEBUG_NAMESPACES.LLM, 'Token tracker reset');
    }
  }
}

// =============================================================================
// Timing Utilities
// =============================================================================

/**
 * Timer for measuring operation latency.
 *
 * @example
 * ```typescript
 * const timer = createLatencyTimer();
 *
 * // ... do operation ...
 *
 * const metrics = timer.stop();
 * console.log(`Operation took ${metrics.durationMs}ms`);
 * ```
 */
export interface ILatencyTimer {
  /** Stop the timer and get metrics */
  stop(): LatencyMetrics;
}

class LatencyTimer implements ILatencyTimer {
  private startTime: Date;

  constructor() {
    this.startTime = new Date();
  }

  stop(): LatencyMetrics {
    const endTime = new Date();
    return {
      durationMs: endTime.getTime() - this.startTime.getTime(),
      startTime: this.startTime.toISOString(),
      endTime: endTime.toISOString(),
    };
  }
}

/**
 * Create a new latency timer.
 */
export function createLatencyTimer(): ILatencyTimer {
  return new LatencyTimer();
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new TokenTracker instance.
 */
export function createTokenTracker(logger?: IDebugLogger): ITokenTracker {
  return new TokenTracker(logger);
}

// =============================================================================
// Global Instance
// =============================================================================

let defaultTracker: ITokenTracker | null = null;

/**
 * Get the default global token tracker.
 */
export function getDefaultTokenTracker(): ITokenTracker {
  if (!defaultTracker) {
    defaultTracker = createTokenTracker();
  }
  return defaultTracker;
}

/**
 * Set the default global token tracker.
 */
export function setDefaultTokenTracker(tracker: ITokenTracker): void {
  defaultTracker = tracker;
}

/**
 * Reset the default global token tracker.
 */
export function resetDefaultTokenTracker(): void {
  if (defaultTracker) {
    defaultTracker.reset();
  }
}
