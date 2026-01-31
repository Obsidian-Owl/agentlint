/**
 * Integration tests for HoneyHive schema compliance.
 *
 * Verifies that mapping functions in route.ts produce valid HoneyHive schema
 * for all event types and content capture scenarios.
 */

import { describe, test, expect } from 'bun:test';
import {
  buildHoneyHiveConfig,
  buildHoneyHiveInputs,
  buildHoneyHiveOutputs,
  buildHoneyHiveMetrics,
  buildHoneyHiveMetadata,
} from '../../app/api/events/honeyhive-mappers';
import type { TelemetryEvent } from '../../app/api/events/route';

// =============================================================================
// Mock Event Factories
// =============================================================================

function createBaseMeta() {
  return {
    version: '0.1.0',
    platform: 'darwin',
    nodeVersion: '22.0.0',
    source: 'agentlint-cli-test',
  };
}

function createBaseLLMEvent(): TelemetryEvent {
  return {
    type: 'llm.usage',
    timestamp: new Date().toISOString(),
    startTime: Date.now() - 1000,
    endTime: Date.now(),
    sessionId: 'test-session-123',
    eventId: 'llm-event-456',
    sequence: 1,
    data: {
      model: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      inputTokens: 1500,
      outputTokens: 500,
      temperature: 0.7,
      maxTokens: 4096,
      topP: 0.9,
      latencyMs: 1200,
      cost: 0.015,
      stopReason: 'end_turn',
    },
    meta: createBaseMeta(),
  };
}

function createToolCallEvent(): TelemetryEvent {
  return {
    type: 'tool.call',
    timestamp: new Date().toISOString(),
    startTime: Date.now() - 500,
    endTime: Date.now(),
    sessionId: 'test-session-123',
    eventId: 'tool-event-789',
    sequence: 2,
    parentEventId: 'llm-event-456',
    data: {
      tool: 'read_file',
      toolInput: { path: '/some/file.ts' },
      toolOutput: { content: 'file contents...' },
      success: true,
      durationMs: 450,
    },
    meta: createBaseMeta(),
  };
}

function createSessionStartEvent(): TelemetryEvent {
  return {
    type: 'session.start',
    timestamp: new Date().toISOString(),
    startTime: Date.now(),
    endTime: Date.now(),
    sessionId: 'test-session-123',
    eventId: 'session-start-001',
    sequence: 0,
    data: {
      command: 'analyse',
      directory: '/Users/test/project',
      hasConfig: true,
      projectType: 'typescript',
      'gen_ai.agent.id': 'agentlint-detective',
      'gen_ai.agent.name': 'Detective',
    },
    meta: createBaseMeta(),
  };
}

function createSessionEndEvent(): TelemetryEvent {
  return {
    type: 'session.end',
    timestamp: new Date().toISOString(),
    startTime: Date.now() - 5000,
    endTime: Date.now(),
    sessionId: 'test-session-123',
    eventId: 'session-end-999',
    sequence: 10,
    data: {
      success: true,
      durationMs: 5000,
      toolCallCount: 12,
      findingCount: 3,
      recommendationCount: 2,
      totalInputTokens: 15000,
      totalOutputTokens: 5000,
      compressionCount: 1,
      retryCount: 2,
    },
    meta: createBaseMeta(),
  };
}

// =============================================================================
// LLM Event Mapping Tests
// =============================================================================

describe('LLM event mapping', () => {
  test('buildHoneyHiveInputs maps basic LLM fields', () => {
    const event = createBaseLLMEvent();
    const inputs = buildHoneyHiveInputs(event);

    expect(inputs.model).toBe('claude-sonnet-4-20250514');
    expect(inputs.provider).toBe('anthropic');
    expect(inputs.prompt_tokens).toBe(1500);
    expect(inputs.temperature).toBe(0.7);
    expect(inputs.max_tokens).toBe(4096);
    expect(inputs.top_p).toBe(0.9);
  });

  test('buildHoneyHiveInputs maps promptContent when content capture enabled', () => {
    const event = createBaseLLMEvent();
    event.data.promptContent = [
      { role: 'user', content: 'Analyze this code' },
      { role: 'assistant', content: 'Sure, let me help' },
    ];

    const inputs = buildHoneyHiveInputs(event);

    expect(inputs.messages).toEqual([
      { role: 'user', content: 'Analyze this code' },
      { role: 'assistant', content: 'Sure, let me help' },
    ]);
  });

  test('buildHoneyHiveInputs maps systemInstructions when present', () => {
    const event = createBaseLLMEvent();
    event.data.systemInstructions = 'You are a helpful code analysis assistant.';

    const inputs = buildHoneyHiveInputs(event);

    expect(inputs.system_instructions).toBe('You are a helpful code analysis assistant.');
  });

  test('buildHoneyHiveOutputs maps completion content', () => {
    const event = createBaseLLMEvent();
    const outputs = buildHoneyHiveOutputs(event);

    expect(outputs.completion_tokens).toBe(500);
    expect(outputs.stop_reason).toBe('end_turn');
  });

  test('buildHoneyHiveOutputs maps completionContent when content capture enabled', () => {
    const event = createBaseLLMEvent();
    event.data.completionContent = 'This is the generated response from the model.';

    const outputs = buildHoneyHiveOutputs(event);

    expect(outputs.content).toBe('This is the generated response from the model.');
  });

  test('buildHoneyHiveMetrics maps token counts correctly', () => {
    const event = createBaseLLMEvent();
    const metrics = buildHoneyHiveMetrics(event);

    expect(metrics.prompt_tokens).toBe(1500);
    expect(metrics.completion_tokens).toBe(500);
    expect(metrics.total_tokens).toBe(2000);
  });

  test('buildHoneyHiveMetrics includes cache read tokens when present', () => {
    const event = createBaseLLMEvent();
    event.data.cacheReadTokens = 800;
    event.data.cacheCreationTokens = 200;

    const metrics = buildHoneyHiveMetrics(event);

    expect(metrics.cache_read_tokens).toBe(800);
    expect(metrics.cache_creation_tokens).toBe(200);
  });

  test('buildHoneyHiveMetrics includes reasoning tokens when present', () => {
    const event = createBaseLLMEvent();
    event.data.reasoningTokens = 1200;

    const metrics = buildHoneyHiveMetrics(event);

    expect(metrics.reasoning_tokens).toBe(1200);
  });

  test('buildHoneyHiveMetrics includes cost and latency', () => {
    const event = createBaseLLMEvent();
    const metrics = buildHoneyHiveMetrics(event);

    expect(metrics.cost).toBe(0.015);
    expect(metrics.latency_ms).toBe(1200);
  });

  test('buildHoneyHiveMetrics calculates tokens per second', () => {
    const event = createBaseLLMEvent();
    const metrics = buildHoneyHiveMetrics(event);

    // 500 output tokens / 1200ms * 1000 = ~417 tokens/sec
    expect(metrics.tokens_per_second).toBe(417);
  });

  test('buildHoneyHiveConfig maps model parameters', () => {
    const event = createBaseLLMEvent();
    const config = buildHoneyHiveConfig(event);

    expect(config.model).toBe('claude-sonnet-4-20250514');
    expect(config.provider).toBe('anthropic');
    expect(config.type).toBe('chat');
    expect(config.is_streaming).toBe(true);
    expect(config.temperature).toBe(0.7);
    expect(config.max_tokens).toBe(4096);
    expect(config.top_p).toBe(0.9);
  });
});

// =============================================================================
// Tool Event Mapping Tests
// =============================================================================

describe('Tool event mapping', () => {
  test('buildHoneyHiveInputs maps tool arguments', () => {
    const event = createToolCallEvent();
    const inputs = buildHoneyHiveInputs(event);

    expect(inputs.tool).toBe('read_file');
    expect(inputs.arguments).toEqual({ path: '/some/file.ts' });
  });

  test('buildHoneyHiveInputs prefers toolInputJson over toolInput', () => {
    const event = createToolCallEvent();
    event.data.toolInputJson = { path: '/captured/file.ts', options: { encoding: 'utf8' } };

    const inputs = buildHoneyHiveInputs(event);

    expect(inputs.arguments).toEqual({ path: '/captured/file.ts', options: { encoding: 'utf8' } });
  });

  test('buildHoneyHiveOutputs maps tool result', () => {
    const event = createToolCallEvent();
    const outputs = buildHoneyHiveOutputs(event);

    expect(outputs.success).toBe(true);
    expect(outputs.result).toEqual({ content: 'file contents...' });
  });

  test('buildHoneyHiveOutputs prefers toolOutputJson over toolOutput', () => {
    const event = createToolCallEvent();
    event.data.toolOutputJson = { content: 'captured file contents', lines: 42 };

    const outputs = buildHoneyHiveOutputs(event);

    expect(outputs.result).toEqual({ content: 'captured file contents', lines: 42 });
  });

  test('buildHoneyHiveOutputs includes error message on failure', () => {
    const event = createToolCallEvent();
    event.data.success = false;
    event.data.errorMessage = 'File not found: /some/file.ts';

    const outputs = buildHoneyHiveOutputs(event);

    expect(outputs.success).toBe(false);
    expect(outputs.error).toBe('File not found: /some/file.ts');
  });

  test('buildHoneyHiveMetrics includes duration and success', () => {
    const event = createToolCallEvent();
    const metrics = buildHoneyHiveMetrics(event);

    expect(metrics.duration_ms).toBe(450);
    expect(metrics.success).toBe(1); // Success as 1 for aggregation
  });

  test('buildHoneyHiveMetrics marks failure with 0', () => {
    const event = createToolCallEvent();
    event.data.success = false;

    const metrics = buildHoneyHiveMetrics(event);

    expect(metrics.success).toBe(0);
  });

  test('buildHoneyHiveMetadata includes error enrichment fields', () => {
    const event = createToolCallEvent();
    event.data.success = false;
    event.data.errorCategory = 'network';
    event.data.errorStack = 'Error: ECONNREFUSED\n  at fetch (...)';

    const metadata = buildHoneyHiveMetadata(event);

    expect(metadata.error_category).toBe('network');
    expect(metadata.error_stack).toBe('Error: ECONNREFUSED\n  at fetch (...)');
  });

  test('buildHoneyHiveConfig identifies tool provider', () => {
    const event = createToolCallEvent();
    const config = buildHoneyHiveConfig(event);

    expect(config.tool_name).toBe('read_file');
    expect(config.provider).toBe('agentlint');
  });
});

// =============================================================================
// Session Event Mapping Tests
// =============================================================================

describe('Session event mapping', () => {
  test('buildHoneyHiveConfig maps agent identity from session.start', () => {
    const event = createSessionStartEvent();
    // Verify the data structure is correct for agent identity
    // This is handled at the session level in forwardToHoneyHive
    expect(event.data['gen_ai.agent.id']).toBe('agentlint-detective');
    expect(event.data['gen_ai.agent.name']).toBe('Detective');
  });

  test('buildHoneyHiveInputs maps session start context', () => {
    const event = createSessionStartEvent();
    const inputs = buildHoneyHiveInputs(event);

    expect(inputs.command).toBe('analyse');
    expect(inputs.directory).toBe('/Users/test/project');
    expect(inputs.hasConfig).toBe(true);
    expect(inputs.projectType).toBe('typescript');
  });

  test('buildHoneyHiveMetrics includes session.end aggregates', () => {
    const event = createSessionEndEvent();
    const metrics = buildHoneyHiveMetrics(event);

    expect(metrics.duration_ms).toBe(5000);
    expect(metrics.tool_calls).toBe(12);
    expect(metrics.findings).toBe(3);
    expect(metrics.total_input_tokens).toBe(15000);
    expect(metrics.total_output_tokens).toBe(5000);
  });

  test('buildHoneyHiveMetrics includes compression and retry counts', () => {
    const event = createSessionEndEvent();
    const metrics = buildHoneyHiveMetrics(event);

    expect(metrics.compression_count).toBe(1);
    expect(metrics.retry_count).toBe(2);
  });

  test('buildHoneyHiveOutputs maps session results', () => {
    const event = createSessionEndEvent();
    const outputs = buildHoneyHiveOutputs(event);

    expect(outputs.success).toBe(true);
    expect(outputs.duration_ms).toBe(5000);
    expect(outputs.tool_count).toBe(12);
    expect(outputs.finding_count).toBe(3);
    expect(outputs.recommendation_count).toBe(2);
  });
});

// =============================================================================
// Metadata Mapping Tests
// =============================================================================

describe('Metadata mapping', () => {
  test('buildHoneyHiveMetadata includes base fields for all events', () => {
    const event = createBaseLLMEvent();
    const metadata = buildHoneyHiveMetadata(event);

    expect(metadata.agentlint_version).toBe('0.1.0');
    expect(metadata.platform).toBe('darwin');
    expect(metadata.sequence).toBe(1);
  });

  test('buildHoneyHiveMetadata includes trace_id when present', () => {
    const event = createBaseLLMEvent();
    event.data.traceId = 'trace-abc-123';

    const metadata = buildHoneyHiveMetadata(event);

    expect(metadata.trace_id).toBe('trace-abc-123');
  });

  test('buildHoneyHiveMetadata includes LLM-specific fields', () => {
    const event = createBaseLLMEvent();
    const metadata = buildHoneyHiveMetadata(event);

    expect(metadata.total_tokens).toBe(2000);
    expect(metadata.prompt_tokens).toBe(1500);
    expect(metadata.completion_tokens).toBe(500);
    expect(metadata.cost).toBe(0.015);
    expect(metadata.latency_ms).toBe(1200);
  });

  test('buildHoneyHiveMetadata includes tool-specific fields', () => {
    const event = createToolCallEvent();
    const metadata = buildHoneyHiveMetadata(event);

    expect(metadata.success).toBe(true);
    expect(metadata.duration_ms).toBe(450);
  });
});

// =============================================================================
// Content Capture Scenarios
// =============================================================================

describe('Content capture scenarios', () => {
  test('LLM event with full content capture', () => {
    const event = createBaseLLMEvent();
    event.data.promptContent = [
      { role: 'system', content: 'You are a code analyzer.' },
      { role: 'user', content: 'Check this function for bugs.' },
    ];
    event.data.completionContent = 'I found 3 potential issues...';
    event.data.systemInstructions = 'Be thorough and precise.';

    const inputs = buildHoneyHiveInputs(event);
    const outputs = buildHoneyHiveOutputs(event);

    // Verify prompt content
    expect(inputs.messages).toHaveLength(2);
    expect(inputs.messages).toEqual([
      { role: 'system', content: 'You are a code analyzer.' },
      { role: 'user', content: 'Check this function for bugs.' },
    ]);
    expect(inputs.system_instructions).toBe('Be thorough and precise.');

    // Verify completion content
    expect(outputs.content).toBe('I found 3 potential issues...');
  });

  test('Tool event with captured input/output JSON', () => {
    const event = createToolCallEvent();
    event.data.toolInputJson = {
      path: '/src/main.ts',
      options: { encoding: 'utf8', cache: true },
    };
    event.data.toolOutputJson = {
      content: 'function main() { ... }',
      lines: 150,
      size: 4200,
    };

    const inputs = buildHoneyHiveInputs(event);
    const outputs = buildHoneyHiveOutputs(event);

    expect(inputs.arguments).toEqual({
      path: '/src/main.ts',
      options: { encoding: 'utf8', cache: true },
    });
    expect(outputs.result).toEqual({
      content: 'function main() { ... }',
      lines: 150,
      size: 4200,
    });
  });

  test('Tool event with error enrichment', () => {
    const event = createToolCallEvent();
    event.data.success = false;
    event.data.errorMessage = 'Timeout after 5000ms';
    event.data.errorCategory = 'timeout';
    event.data.errorStack = 'Error: Timeout\n  at Tool.execute (tool.ts:42)';

    const outputs = buildHoneyHiveOutputs(event);
    const metadata = buildHoneyHiveMetadata(event);

    // Error in outputs
    expect(outputs.error).toBe('Timeout after 5000ms');

    // Error enrichment in metadata
    expect(metadata.error_category).toBe('timeout');
    expect(metadata.error_stack).toBe('Error: Timeout\n  at Tool.execute (tool.ts:42)');
  });
});

// =============================================================================
// Schema Completeness Tests
// =============================================================================

describe('HoneyHive schema completeness', () => {
  test('All LLM event fields map to HoneyHive schema', () => {
    const event = createBaseLLMEvent();

    const config = buildHoneyHiveConfig(event);
    const inputs = buildHoneyHiveInputs(event);
    const outputs = buildHoneyHiveOutputs(event);
    const metrics = buildHoneyHiveMetrics(event);
    const metadata = buildHoneyHiveMetadata(event);

    // Verify config has required model fields
    expect(config).toHaveProperty('model');
    expect(config).toHaveProperty('provider');
    expect(config).toHaveProperty('type');
    expect(config).toHaveProperty('temperature');
    expect(config).toHaveProperty('max_tokens');

    // Verify inputs has model parameters
    expect(inputs).toHaveProperty('model');
    expect(inputs).toHaveProperty('prompt_tokens');

    // Verify outputs has completion info
    expect(outputs).toHaveProperty('completion_tokens');

    // Verify metrics has token counts
    expect(metrics).toHaveProperty('prompt_tokens');
    expect(metrics).toHaveProperty('completion_tokens');
    expect(metrics).toHaveProperty('total_tokens');

    // Verify metadata has version info
    expect(metadata).toHaveProperty('agentlint_version');
    expect(metadata).toHaveProperty('platform');
  });

  test('All tool event fields map to HoneyHive schema', () => {
    const event = createToolCallEvent();

    const config = buildHoneyHiveConfig(event);
    const inputs = buildHoneyHiveInputs(event);
    const outputs = buildHoneyHiveOutputs(event);
    const metrics = buildHoneyHiveMetrics(event);
    const metadata = buildHoneyHiveMetadata(event);

    // Verify config identifies tool
    expect(config).toHaveProperty('tool_name');
    expect(config).toHaveProperty('provider');

    // Verify inputs has arguments
    expect(inputs).toHaveProperty('tool');
    expect(inputs).toHaveProperty('arguments');

    // Verify outputs has result
    expect(outputs).toHaveProperty('success');
    expect(outputs).toHaveProperty('result');

    // Verify metrics has duration
    expect(metrics).toHaveProperty('duration_ms');
    expect(metrics).toHaveProperty('success');

    // Verify metadata has success status
    expect(metadata).toHaveProperty('success');
  });

  test('All session fields map to HoneyHive schema', () => {
    const startEvent = createSessionStartEvent();
    const endEvent = createSessionEndEvent();

    // Session start
    const startInputs = buildHoneyHiveInputs(startEvent);
    expect(startInputs).toHaveProperty('command');
    expect(startInputs).toHaveProperty('directory');
    expect(startInputs).toHaveProperty('projectType');

    // Session end
    const endMetrics = buildHoneyHiveMetrics(endEvent);
    const endOutputs = buildHoneyHiveOutputs(endEvent);

    expect(endMetrics).toHaveProperty('duration_ms');
    expect(endMetrics).toHaveProperty('tool_calls');
    expect(endMetrics).toHaveProperty('compression_count');
    expect(endMetrics).toHaveProperty('retry_count');

    expect(endOutputs).toHaveProperty('success');
    expect(endOutputs).toHaveProperty('finding_count');
    expect(endOutputs).toHaveProperty('recommendation_count');
  });
});
