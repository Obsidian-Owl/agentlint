/**
 * EP22: Tracing Span Factory
 *
 * Factory for creating spans with OpenTelemetry GenAI semantic conventions.
 * Ensures consistent attribute naming across all agentlint spans.
 */

import type { SpanOptions, ActiveSpan, GenAIProvider } from './types';
import { traceContextProvider } from './trace-context';

/**
 * GenAI semantic convention attribute names.
 * @see https://opentelemetry.io/docs/specs/semconv/gen-ai/
 */
export const GenAIAttributes = {
  // Operation
  OPERATION_NAME: 'gen_ai.operation.name',

  // Provider
  PROVIDER_NAME: 'gen_ai.provider.name',

  // Agent
  AGENT_ID: 'gen_ai.agent.id',
  AGENT_NAME: 'gen_ai.agent.name',
  CONVERSATION_ID: 'gen_ai.conversation.id',

  // Request
  REQUEST_MODEL: 'gen_ai.request.model',
  REQUEST_TEMPERATURE: 'gen_ai.request.temperature',
  REQUEST_MAX_TOKENS: 'gen_ai.request.max_tokens',

  // Response
  RESPONSE_MODEL: 'gen_ai.response.model',
  RESPONSE_ID: 'gen_ai.response.id',
  RESPONSE_FINISH_REASONS: 'gen_ai.response.finish_reasons',

  // Usage
  USAGE_INPUT_TOKENS: 'gen_ai.usage.input_tokens',
  USAGE_OUTPUT_TOKENS: 'gen_ai.usage.output_tokens',
  USAGE_REASONING_TOKENS: 'gen_ai.usage.reasoning_tokens',

  // Tool
  TOOL_NAME: 'gen_ai.tool.name',
  TOOL_CALL_ID: 'gen_ai.tool.call.id',
  TOOL_SUCCESS: 'gen_ai.tool.success',
} as const;

/**
 * Agentlint-specific attribute names.
 */
export const AgentlintAttributes = {
  SESSION_TARGET: 'agentlint.session.target',
  SESSION_COMMAND: 'agentlint.session.command',
  SESSION_CWD: 'agentlint.session.cwd',
  SESSION_ROOT: 'agentlint.session.root',
  TOOL_DURATION_MS: 'agentlint.tool.duration_ms',
  LLM_LATENCY_MS: 'agentlint.llm.latency_ms',
  LLM_COST_USD: 'agentlint.llm.cost_usd',
  STREAM_CHUNK_COUNT: 'agentlint.stream.chunk_count',
  STREAM_DURATION_MS: 'agentlint.stream.duration_ms',
  STREAM_FIRST_TOKEN_MS: 'agentlint.stream.first_token_ms',
} as const;

export interface SessionSpanOptions {
  sessionId: string;
  target?: string;
  command?: string;
  provider?: GenAIProvider;
}

export interface ToolSpanOptions {
  toolName: string;
  callId?: string;
  input?: Record<string, unknown>;
}

export interface LLMSpanOptions {
  model: string;
  provider?: GenAIProvider;
  temperature?: number;
  maxTokens?: number;
}

export interface StreamSpanOptions {
  streamId: string;
}

/**
 * Factory for creating spans with GenAI semantic conventions.
 */
export class TracingSpanFactory {
  /**
   * Create a session span (root span for an agentlint session).
   */
  async createSessionSpan<T>(
    options: SessionSpanOptions,
    fn: (span: ActiveSpan) => T | Promise<T>
  ): Promise<T> {
    const spanOptions: SpanOptions = {
      name: 'session',
      kind: 'internal',
      attributes: {
        [GenAIAttributes.OPERATION_NAME]: 'invoke_agent',
        [GenAIAttributes.CONVERSATION_ID]: options.sessionId,
        [GenAIAttributes.AGENT_ID]: 'agentlint-cli',
        [GenAIAttributes.AGENT_NAME]: 'agentlint',
        ...(options.provider && { [GenAIAttributes.PROVIDER_NAME]: options.provider }),
        ...(options.target && { [AgentlintAttributes.SESSION_TARGET]: options.target }),
        ...(options.command && { [AgentlintAttributes.SESSION_COMMAND]: options.command }),
      },
    };

    return traceContextProvider.withSpan(spanOptions, fn);
  }

  /**
   * Create a tool span (child span for tool execution).
   */
  async createToolSpan<T>(
    options: ToolSpanOptions,
    fn: (span: ActiveSpan) => T | Promise<T>
  ): Promise<T> {
    const spanOptions: SpanOptions = {
      name: `tool:${options.toolName}`,
      kind: 'internal',
      attributes: {
        [GenAIAttributes.OPERATION_NAME]: 'execute_tool',
        [GenAIAttributes.TOOL_NAME]: options.toolName,
        ...(options.callId && { [GenAIAttributes.TOOL_CALL_ID]: options.callId }),
      },
    };

    return traceContextProvider.withSpan(spanOptions, fn);
  }

  /**
   * Create an LLM span (child span for LLM API call).
   */
  async createLLMSpan<T>(
    options: LLMSpanOptions,
    fn: (span: ActiveSpan) => T | Promise<T>
  ): Promise<T> {
    const spanOptions: SpanOptions = {
      name: 'llm',
      kind: 'client',
      attributes: {
        [GenAIAttributes.OPERATION_NAME]: 'chat',
        [GenAIAttributes.REQUEST_MODEL]: options.model,
        ...(options.provider && { [GenAIAttributes.PROVIDER_NAME]: options.provider }),
        ...(options.temperature !== undefined && {
          [GenAIAttributes.REQUEST_TEMPERATURE]: options.temperature,
        }),
        ...(options.maxTokens !== undefined && {
          [GenAIAttributes.REQUEST_MAX_TOKENS]: options.maxTokens,
        }),
      },
    };

    return traceContextProvider.withSpan(spanOptions, fn);
  }

  /**
   * Create a stream span (child span for SSE streaming).
   */
  async createStreamSpan<T>(
    _options: StreamSpanOptions,
    fn: (span: ActiveSpan) => T | Promise<T>
  ): Promise<T> {
    const spanOptions: SpanOptions = {
      name: 'stream',
      kind: 'internal',
      attributes: {
        [GenAIAttributes.OPERATION_NAME]: 'sse_streaming',
      },
    };

    return traceContextProvider.withSpan(spanOptions, fn);
  }
}

// Export singleton instance
export const spanFactory = new TracingSpanFactory();
