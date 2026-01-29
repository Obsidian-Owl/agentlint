/**
 * EP22: Orchestrator Instrumentation
 *
 * Utilities for capturing LLM span attributes, cache tokens, hyperparameters,
 * and analysis events (findings/recommendations).
 *
 * Tasks: T025a, T025b, T025c, T025f, T025g
 */

import type { ActiveSpan } from '../types';
import { GenAIAttributes } from '../span-factory';

/** Cache token data from Anthropic responses */
export interface CacheTokens {
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
}

/** LLM request hyperparameters */
export interface LLMRequestParams {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
}

/** LLM response details */
export interface LLMResponseDetails {
  responseId?: string;
  actualModel?: string;
  tokensPerSecond?: number;
}

/** Finding event data */
export interface FindingEventData {
  type: string;
  severity: string;
  finding_id: string;
}

/** Recommendation event data */
export interface RecommendationEventData {
  type: string;
  finding_id: string;
}

/**
 * Extract cache tokens from Anthropic response usage object.
 * T025a: Capture cache_creation_input_tokens and cache_read_input_tokens
 */
export function extractCacheTokens(usage: unknown): CacheTokens {
  const result: CacheTokens = {};

  if (typeof usage !== 'object' || usage === null) {
    return result;
  }

  const usageObj = usage as Record<string, unknown>;

  // Anthropic format: cache_creation_input_tokens
  if (typeof usageObj.cache_creation_input_tokens === 'number') {
    result.cacheCreationTokens = usageObj.cache_creation_input_tokens;
  }

  // Anthropic format: cache_read_input_tokens
  if (typeof usageObj.cache_read_input_tokens === 'number') {
    result.cacheReadTokens = usageObj.cache_read_input_tokens;
  }

  return result;
}

/**
 * Extract LLM request hyperparameters from SDK request object.
 * T025b: Capture temperature, max_tokens, top_p, top_k, stop_sequences
 */
export function extractRequestParams(request: unknown): LLMRequestParams {
  const result: LLMRequestParams = {};

  if (typeof request !== 'object' || request === null) {
    return result;
  }

  const reqObj = request as Record<string, unknown>;

  if (typeof reqObj.temperature === 'number') {
    result.temperature = reqObj.temperature;
  }

  if (typeof reqObj.max_tokens === 'number') {
    result.maxTokens = reqObj.max_tokens;
  }

  if (typeof reqObj.top_p === 'number') {
    result.topP = reqObj.top_p;
  }

  if (typeof reqObj.top_k === 'number') {
    result.topK = reqObj.top_k;
  }

  // stop_sequences can be string[] or single string
  if (Array.isArray(reqObj.stop_sequences)) {
    result.stopSequences = reqObj.stop_sequences.filter((s): s is string => typeof s === 'string');
  } else if (typeof reqObj.stop_sequences === 'string') {
    result.stopSequences = [reqObj.stop_sequences];
  }

  // Also check 'stop' field (some SDKs use this)
  if (Array.isArray(reqObj.stop)) {
    result.stopSequences = reqObj.stop.filter((s): s is string => typeof s === 'string');
  } else if (typeof reqObj.stop === 'string') {
    result.stopSequences = [reqObj.stop];
  }

  return result;
}

/**
 * Extract LLM response details from SDK response object.
 * T025c: Extract response.id, response.model, calculate tokens_per_second
 */
export function extractResponseDetails(response: unknown, durationMs: number): LLMResponseDetails {
  const result: LLMResponseDetails = {};

  if (typeof response !== 'object' || response === null) {
    return result;
  }

  const respObj = response as Record<string, unknown>;

  // Extract response ID
  if (typeof respObj.id === 'string') {
    result.responseId = respObj.id;
  }

  // Extract actual model (may differ from requested)
  if (typeof respObj.model === 'string') {
    result.actualModel = respObj.model;
  }

  // Calculate tokens per second if we have usage data
  if (typeof respObj.usage === 'object' && respObj.usage !== null && durationMs > 0) {
    const usage = respObj.usage as Record<string, unknown>;
    const outputTokens = typeof usage.output_tokens === 'number' ? usage.output_tokens : 0;

    if (outputTokens > 0) {
      result.tokensPerSecond = (outputTokens / durationMs) * 1000; // Convert to tokens/second
    }
  }

  return result;
}

/**
 * Emit a finding detection event on the active span.
 * T025f: Add span event agentlint.finding.detected with type, severity, finding_id
 */
export function emitFindingEvent(span: ActiveSpan, finding: FindingEventData): void {
  span.addEvent('agentlint.finding.detected', {
    type: finding.type,
    severity: finding.severity,
    finding_id: finding.finding_id,
  });
}

/**
 * Emit a recommendation generation event on the active span.
 * T025g: Add span event agentlint.recommendation.generated with type, finding_id
 */
export function emitRecommendationEvent(
  span: ActiveSpan,
  recommendation: RecommendationEventData
): void {
  span.addEvent('agentlint.recommendation.generated', {
    type: recommendation.type,
    finding_id: recommendation.finding_id,
  });
}

/**
 * Apply cache token attributes to an active span.
 * Helper for T025a to set span attributes with semantic conventions.
 */
export function applyCacheTokens(span: ActiveSpan, cacheTokens: CacheTokens): void {
  if (cacheTokens.cacheCreationTokens !== undefined) {
    span.setAttribute('gen_ai.cache.creation_tokens', cacheTokens.cacheCreationTokens);
  }
  if (cacheTokens.cacheReadTokens !== undefined) {
    span.setAttribute('gen_ai.cache.read_tokens', cacheTokens.cacheReadTokens);
  }
}

/**
 * Apply request hyperparameters to an active span.
 * Helper for T025b to set span attributes with semantic conventions.
 */
export function applyRequestParams(span: ActiveSpan, params: LLMRequestParams): void {
  if (params.temperature !== undefined) {
    span.setAttribute(GenAIAttributes.REQUEST_TEMPERATURE, params.temperature);
  }
  if (params.maxTokens !== undefined) {
    span.setAttribute(GenAIAttributes.REQUEST_MAX_TOKENS, params.maxTokens);
  }
  if (params.topP !== undefined) {
    span.setAttribute('gen_ai.request.top_p', params.topP);
  }
  if (params.topK !== undefined) {
    span.setAttribute('gen_ai.request.top_k', params.topK);
  }
  if (params.stopSequences && params.stopSequences.length > 0) {
    // Store as JSON string to preserve array
    span.setAttribute('gen_ai.request.stop_sequences', JSON.stringify(params.stopSequences));
  }
}

/**
 * Apply response details to an active span.
 * Helper for T025c to set span attributes with semantic conventions.
 */
export function applyResponseDetails(span: ActiveSpan, details: LLMResponseDetails): void {
  if (details.responseId !== undefined) {
    span.setAttribute(GenAIAttributes.RESPONSE_ID, details.responseId);
  }
  if (details.actualModel !== undefined) {
    span.setAttribute(GenAIAttributes.RESPONSE_MODEL, details.actualModel);
  }
  if (details.tokensPerSecond !== undefined) {
    span.setAttribute('gen_ai.response.tokens_per_second', details.tokensPerSecond);
  }
}
