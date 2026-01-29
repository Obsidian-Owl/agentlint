/**
 * EP22: Trace Context Provider
 *
 * Provides automatic trace context propagation using Node.js AsyncLocalStorage.
 * This enables trace context to flow through async operations without explicit passing.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type { TraceContext, SpanOptions, ActiveSpan, SpanEvent } from './types';
import { generateTraceId, generateSpanId } from './trace-id';

// Global storage for trace context
const traceStorage = new AsyncLocalStorage<TraceContext>();

/**
 * TraceContextProvider manages trace context propagation.
 *
 * Usage:
 * ```typescript
 * const provider = new TraceContextProvider();
 *
 * await provider.run(async () => {
 *   const ctx = provider.getContext();
 *   console.log('Trace ID:', ctx?.traceId);
 *
 *   // Nested spans automatically get parent context
 *   await provider.withSpan({ name: 'child-op' }, async (span) => {
 *     span.setAttribute('key', 'value');
 *     span.addEvent('milestone');
 *   });
 * });
 * ```
 */
export class TraceContextProvider {
  /**
   * Run a function with a new trace context.
   * Creates a new trace ID and root span.
   *
   * @param fn - Function to run within trace context
   * @returns Result of the function
   */
  async run<T>(fn: () => T | Promise<T>): Promise<T> {
    const context: TraceContext = {
      traceId: generateTraceId(),
      spanId: generateSpanId(),
      traceFlags: 1, // sampled
    };

    return traceStorage.run(context, fn);
  }

  /**
   * Get the current trace context, if any.
   *
   * @returns Current trace context or undefined if not in a trace
   */
  getContext(): TraceContext | undefined {
    return traceStorage.getStore();
  }

  /**
   * Run a function within a child span.
   *
   * @param options - Span configuration
   * @param fn - Function to run within the span
   * @returns Result of the function
   */
  async withSpan<T>(options: SpanOptions, fn: (span: ActiveSpan) => T | Promise<T>): Promise<T> {
    const parentContext = this.getContext();

    const newSpanId = generateSpanId();
    const startTime = Date.now();
    const events: SpanEvent[] = [];
    const attributes: Record<string, string | number | boolean> = {
      ...options.attributes,
    };

    // Create child context
    const parentSpanId = parentContext?.spanId ?? options.parentSpanId;
    const childContext: TraceContext = {
      traceId: parentContext?.traceId ?? generateTraceId(),
      spanId: newSpanId,
      ...(parentSpanId ? { parentSpanId } : {}),
      traceFlags: parentContext?.traceFlags ?? 1,
    };

    // Create active span handle
    const span: ActiveSpan = {
      spanId: newSpanId,
      name: options.name,
      startTime,
      attributes,
      events,
      end: () => {
        // Span ending is handled by the provider
        // This is a no-op in the basic implementation
        // Full OTel integration would record the span here
      },
      addEvent: (name: string, attrs?: Record<string, unknown>) => {
        const event: SpanEvent = {
          name,
          timestamp: Date.now(),
          ...(attrs && { attributes: attrs }),
        };
        events.push(event);
      },
      setAttribute: (key: string, value: string | number | boolean) => {
        attributes[key] = value;
      },
    };

    // Run function with child context
    return traceStorage.run(childContext, () => fn(span));
  }

  /**
   * Create a child context from the current context.
   * Useful for manual context management.
   *
   * @returns New child context or new root context if no parent
   */
  createChildContext(): TraceContext {
    const parent = this.getContext();
    return {
      traceId: parent?.traceId ?? generateTraceId(),
      spanId: generateSpanId(),
      ...(parent?.spanId ? { parentSpanId: parent.spanId } : {}),
      traceFlags: parent?.traceFlags ?? 1,
    };
  }
}

// Export singleton instance for convenience
export const traceContextProvider = new TraceContextProvider();

// Export storage for advanced use cases
export { traceStorage };
