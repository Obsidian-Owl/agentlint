/**
 * HoneyHive Event Mapping Helpers
 *
 * Internal helper functions for mapping agentlint telemetry events to HoneyHive format.
 * Exported from route.ts for testing purposes.
 *
 * @module apps/telemetry-api/api/events/honeyhive-mappers
 */

import type { TelemetryEvent } from './route';

/**
 * Build HoneyHive config object based on event type.
 * Per HoneyHive docs: config contains event-specific settings/parameters
 *
 * Model event config fields per HoneyHive schema:
 * - model, provider, temperature, top_p, top_k, max_tokens
 * - type ("chat" or "completion"), is_streaming
 * - tools, tool_choice, stop_sequences
 */
export function buildHoneyHiveConfig(event: TelemetryEvent): Record<string, unknown> {
  const eventType = event.type;

  if (eventType === 'llm.usage') {
    const config: Record<string, unknown> = {
      model: event.data.model ?? 'claude',
      provider: event.data.provider ?? 'anthropic',
      // Claude uses chat format
      type: 'chat',
      // We always stream from the SDK
      is_streaming: true,
    };
    // Include model parameters if available (undefined values are filtered later)
    if (event.data.temperature !== undefined) config.temperature = event.data.temperature;
    if (event.data.maxTokens !== undefined) config.max_tokens = event.data.maxTokens;
    if (event.data.topP !== undefined) config.top_p = event.data.topP;
    return config;
  }

  if (eventType === 'tool.call') {
    return {
      tool_name: event.data.tool,
      provider: 'agentlint', // Tool provider for categorization
    };
  }

  if (eventType === 'session.start') {
    return {
      command: event.data.command,
      project_type: event.data.projectType,
    };
  }

  if (eventType === 'finding.detected') {
    return {
      finding_type: event.data.findingType,
      severity: event.data.severity,
    };
  }

  if (eventType === 'prompt.used') {
    return {
      prompt_id: event.data.promptId,
      prompt_version: event.data.promptVersion,
    };
  }

  return {};
}

/**
 * Build HoneyHive metrics object for events.
 * Per HoneyHive docs: metrics contains computed KPIs (latency, token counts, scores)
 */
export function buildHoneyHiveMetrics(event: TelemetryEvent): Record<string, unknown> {
  const metrics: Record<string, unknown> = {};

  if (event.type === 'llm.usage') {
    // Token metrics
    const inputTokens = (event.data.inputTokens as number) ?? 0;
    const outputTokens = (event.data.outputTokens as number) ?? 0;
    metrics.prompt_tokens = inputTokens;
    metrics.completion_tokens = outputTokens;
    metrics.total_tokens = inputTokens + outputTokens;

    // Cache token metrics (prompt caching)
    if (typeof event.data.cacheReadTokens === 'number') {
      metrics.cache_read_tokens = event.data.cacheReadTokens;
    }
    if (typeof event.data.cacheCreationTokens === 'number') {
      metrics.cache_creation_tokens = event.data.cacheCreationTokens;
    }

    // Reasoning tokens (extended thinking)
    if (typeof event.data.reasoningTokens === 'number') {
      metrics.reasoning_tokens = event.data.reasoningTokens;
    }

    // Cost metrics
    if (typeof event.data.cost === 'number') {
      metrics.cost = event.data.cost;
    }

    // Latency metrics
    if (typeof event.data.latencyMs === 'number') {
      metrics.latency_ms = event.data.latencyMs;
      // Tokens per second (if latency > 0)
      if (event.data.latencyMs > 0) {
        metrics.tokens_per_second = Math.round((outputTokens / event.data.latencyMs) * 1000);
      }
    }
  }

  if (event.type === 'tool.call') {
    // Duration metrics
    if (typeof event.data.durationMs === 'number') {
      metrics.duration_ms = event.data.durationMs;
    }
    // Success metric (1 or 0 for aggregation)
    metrics.success = event.data.success ? 1 : 0;
  }

  if (event.type === 'session.end') {
    // Session-level aggregates
    if (typeof event.data.durationMs === 'number') {
      metrics.duration_ms = event.data.durationMs;
    }
    if (typeof event.data.toolCallCount === 'number') {
      metrics.tool_calls = event.data.toolCallCount;
    }
    if (typeof event.data.findingCount === 'number') {
      metrics.findings = event.data.findingCount;
    }
    if (typeof event.data.totalInputTokens === 'number') {
      metrics.total_input_tokens = event.data.totalInputTokens;
    }
    if (typeof event.data.totalOutputTokens === 'number') {
      metrics.total_output_tokens = event.data.totalOutputTokens;
    }
    // T036: Include compression_count and retry_count in session.end metrics
    if (typeof event.data.compressionCount === 'number') {
      metrics.compression_count = event.data.compressionCount;
    }
    if (typeof event.data.retryCount === 'number') {
      metrics.retry_count = event.data.retryCount;
    }
  }

  if (event.type === 'prompt.used') {
    if (typeof event.data.messageCount === 'number') {
      metrics.message_count = event.data.messageCount;
    }
    if (typeof event.data.contentLength === 'number') {
      metrics.content_length = event.data.contentLength;
    }
  }

  return metrics;
}

/**
 * Build HoneyHive inputs object based on event type.
 * Includes full tool arguments and context for observability.
 */
export function buildHoneyHiveInputs(event: TelemetryEvent): Record<string, unknown> {
  const eventType = event.type;

  if (eventType === 'tool.call') {
    return {
      tool: event.data.tool,
      // EP23: Prefer toolInputJson (captured content) over toolInput
      arguments: event.data.toolInputJson ?? event.data.toolInput ?? {},
    };
  }

  if (eventType === 'llm.usage') {
    const inputs: Record<string, unknown> = {
      model: event.data.model,
      provider: event.data.provider ?? 'anthropic',
      prompt_tokens: event.data.inputTokens ?? 0,
    };
    // Include model parameters if available
    if (event.data.temperature !== undefined) inputs.temperature = event.data.temperature;
    if (event.data.maxTokens !== undefined) inputs.max_tokens = event.data.maxTokens;
    if (event.data.topP !== undefined) inputs.top_p = event.data.topP;
    // EP23: Map promptContent to inputs.messages when content capture is enabled
    if (event.data.promptContent) {
      inputs.messages = event.data.promptContent;
    }
    // EP23: Map systemInstructions to inputs.system_instructions
    if (event.data.systemInstructions) {
      inputs.system_instructions = event.data.systemInstructions;
    }
    return inputs;
  }

  if (eventType === 'session.start') {
    return {
      command: event.data.command,
      directory: event.data.directory,
      hasConfig: event.data.hasConfig,
      projectType: event.data.projectType,
    };
  }

  if (eventType === 'finding.detected') {
    return {
      findingType: event.data.findingType,
      severity: event.data.severity,
    };
  }

  if (eventType === 'prompt.used') {
    return {
      prompt_id: event.data.promptId,
      prompt_version: event.data.promptVersion,
      prompt_key: event.data.promptKey,
      usage_context: event.data.usageContext,
    };
  }

  // Return all data fields as inputs for unknown types
  return event.data;
}

/**
 * Build HoneyHive outputs object based on event type.
 * Includes full tool results for observability.
 */
export function buildHoneyHiveOutputs(event: TelemetryEvent): Record<string, unknown> {
  const eventType = event.type;

  if (eventType === 'tool.call') {
    const outputs: Record<string, unknown> = {
      success: event.data.success ?? false,
    };
    // EP23: Prefer toolOutputJson (captured content) over toolOutput
    if (event.data.toolOutputJson !== undefined) {
      outputs.result = event.data.toolOutputJson;
    } else if (event.data.toolOutput !== undefined) {
      outputs.result = event.data.toolOutput;
    }
    // Include error message if failed
    if (event.data.errorMessage) {
      outputs.error = event.data.errorMessage;
    }
    return outputs;
  }

  if (eventType === 'llm.usage') {
    const outputs: Record<string, unknown> = {
      completion_tokens: event.data.outputTokens ?? 0,
    };
    // Include stop reason if available
    if (event.data.stopReason) outputs.stop_reason = event.data.stopReason;
    // EP23: Map completionContent to outputs.content when content capture is enabled
    if (event.data.completionContent) {
      outputs.content = event.data.completionContent;
    }
    return outputs;
  }

  if (eventType === 'session.end') {
    return {
      success: event.data.success ?? false,
      duration_ms: event.data.durationMs,
      tool_count: event.data.toolCallCount ?? 0,
      finding_count: event.data.findingCount ?? 0,
      recommendation_count: event.data.recommendationCount ?? 0,
    };
  }

  if (eventType === 'session.error') {
    return {
      error_type: event.data.errorType,
      error_code: event.data.errorCode,
    };
  }

  if (eventType === 'finding.detected') {
    return {
      findingType: event.data.findingType,
      severity: event.data.severity,
    };
  }

  if (eventType === 'prompt.used') {
    return {
      message_count: event.data.messageCount,
      content_length: event.data.contentLength,
    };
  }

  return {};
}

/**
 * Build HoneyHive metadata object based on event type.
 */
export function buildHoneyHiveMetadata(event: TelemetryEvent): Record<string, unknown> {
  const base: Record<string, unknown> = {
    agentlint_version: event.meta.version,
    platform: event.meta.platform,
    sequence: event.sequence,
  };
  // EP23: Add trace_id for correlation
  if (event.data.traceId) {
    base.trace_id = event.data.traceId;
  }

  if (event.type === 'llm.usage') {
    return {
      ...base,
      total_tokens:
        ((event.data.inputTokens as number) ?? 0) + ((event.data.outputTokens as number) ?? 0),
      prompt_tokens: event.data.inputTokens ?? 0,
      completion_tokens: event.data.outputTokens ?? 0,
      cost: event.data.cost,
      latency_ms: event.data.latencyMs,
    };
  }

  if (event.type === 'tool.call') {
    const toolMeta: Record<string, unknown> = {
      ...base,
      success: event.data.success,
      duration_ms: event.data.durationMs,
    };
    // EP23: Error enrichment fields
    if (event.data.errorCategory) {
      toolMeta.error_category = event.data.errorCategory;
    }
    if (event.data.errorStack) {
      toolMeta.error_stack = event.data.errorStack;
    }
    return toolMeta;
  }

  if (event.type === 'session.end') {
    return {
      ...base,
      total_input_tokens: event.data.totalInputTokens,
      total_output_tokens: event.data.totalOutputTokens,
      recommendation_count: event.data.recommendationCount,
    };
  }

  if (event.type === 'prompt.used') {
    return {
      ...base,
      prompt_id: event.data.promptId,
      prompt_version: event.data.promptVersion,
      usage_context: event.data.usageContext,
    };
  }

  return base;
}
