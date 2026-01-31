/**
 * EP23: Cache Token and Reasoning Token Mapping Tests
 *
 * Tests for P1 Metrics & Hierarchy - T019, T020, T021
 *
 * T019: cache_read_tokens mapped to HoneyHive
 * T020: reasoning_tokens included in LLM metrics
 * T021: tool events have LLM turn as parent_id
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { AlphaTelemetryClient } from '../alpha-client';
import type { TelemetryEvent } from '../events';
import type { TelemetryConfig } from '../../persistence/types';

describe('Cache Token Mapping (T019)', () => {
  let client: AlphaTelemetryClient;
  let recordedEvents: TelemetryEvent[];

  beforeEach(() => {
    client = new AlphaTelemetryClient();
    recordedEvents = [];

    // Mock the record method to capture events
    const originalRecord = client.record.bind(client);
    client.record = (event: TelemetryEvent): void => {
      recordedEvents.push(event);
      originalRecord(event);
    };

    // Initialize with alpha mode enabled
    const config: TelemetryConfig = {
      enabled: true,
      mode: 'alpha',
      redactContent: true,
    };
    void client.init(config);
  });

  it('should include cacheReadTokens in LLM event data when provided', () => {
    const sessionId = 'test-session-cache-read';

    client.trackLLMEx(sessionId, {
      model: 'claude-sonnet-4-20250514',
      inputTokens: 1000,
      outputTokens: 500,
      cacheReadTokens: 750, // From prompt cache
    });

    const llmEvents = recordedEvents.filter((e) => e.type === 'llm.usage');
    expect(llmEvents).toHaveLength(1);

    const eventData = llmEvents[0]!.data;
    expect(eventData.cacheReadTokens).toBe(750);
    expect(eventData.inputTokens).toBe(1000);
    expect(eventData.outputTokens).toBe(500);
  });

  it('should include cacheCreationTokens in LLM event data when provided', () => {
    const sessionId = 'test-session-cache-creation';

    client.trackLLMEx(sessionId, {
      model: 'claude-sonnet-4-20250514',
      inputTokens: 2000,
      outputTokens: 800,
      cacheCreationTokens: 1500, // Tokens cached for future use
    });

    const llmEvents = recordedEvents.filter((e) => e.type === 'llm.usage');
    expect(llmEvents).toHaveLength(1);

    const eventData = llmEvents[0]!.data;
    expect(eventData.cacheCreationTokens).toBe(1500);
    expect(eventData.inputTokens).toBe(2000);
    expect(eventData.outputTokens).toBe(800);
  });

  it('should include both cache read and creation tokens when provided', () => {
    const sessionId = 'test-session-both-cache-tokens';

    client.trackLLMEx(sessionId, {
      model: 'claude-sonnet-4-20250514',
      inputTokens: 1500,
      outputTokens: 600,
      cacheReadTokens: 500, // Read from cache
      cacheCreationTokens: 1000, // New tokens cached
    });

    const llmEvents = recordedEvents.filter((e) => e.type === 'llm.usage');
    expect(llmEvents).toHaveLength(1);

    const eventData = llmEvents[0]!.data;
    expect(eventData.cacheReadTokens).toBe(500);
    expect(eventData.cacheCreationTokens).toBe(1000);
    expect(eventData.inputTokens).toBe(1500);
    expect(eventData.outputTokens).toBe(600);
  });

  it('should not include cacheReadTokens when not provided', () => {
    const sessionId = 'test-session-no-cache-read';

    client.trackLLMEx(sessionId, {
      model: 'claude-sonnet-4-20250514',
      inputTokens: 1000,
      outputTokens: 500,
      // No cacheReadTokens provided
    });

    const llmEvents = recordedEvents.filter((e) => e.type === 'llm.usage');
    expect(llmEvents).toHaveLength(1);

    const eventData = llmEvents[0]!.data;
    expect(eventData.cacheReadTokens).toBeUndefined();
    expect(eventData.inputTokens).toBe(1000);
    expect(eventData.outputTokens).toBe(500);
  });

  it('should not include cacheCreationTokens when not provided', () => {
    const sessionId = 'test-session-no-cache-creation';

    client.trackLLMEx(sessionId, {
      model: 'claude-sonnet-4-20250514',
      inputTokens: 1000,
      outputTokens: 500,
      // No cacheCreationTokens provided
    });

    const llmEvents = recordedEvents.filter((e) => e.type === 'llm.usage');
    expect(llmEvents).toHaveLength(1);

    const eventData = llmEvents[0]!.data;
    expect(eventData.cacheCreationTokens).toBeUndefined();
    expect(eventData.inputTokens).toBe(1000);
    expect(eventData.outputTokens).toBe(500);
  });

  it('should handle zero cache tokens correctly', () => {
    const sessionId = 'test-session-zero-cache';

    client.trackLLMEx(sessionId, {
      model: 'claude-sonnet-4-20250514',
      inputTokens: 1000,
      outputTokens: 500,
      cacheReadTokens: 0, // No cache hit
      cacheCreationTokens: 0, // No new cache
    });

    const llmEvents = recordedEvents.filter((e) => e.type === 'llm.usage');
    expect(llmEvents).toHaveLength(1);

    const eventData = llmEvents[0]!.data;
    // Zero values should be included (not undefined)
    expect(eventData.cacheReadTokens).toBe(0);
    expect(eventData.cacheCreationTokens).toBe(0);
  });
});

describe('Reasoning Token Mapping (T020)', () => {
  let client: AlphaTelemetryClient;
  let recordedEvents: TelemetryEvent[];

  beforeEach(() => {
    client = new AlphaTelemetryClient();
    recordedEvents = [];

    // Mock the record method to capture events
    const originalRecord = client.record.bind(client);
    client.record = (event: TelemetryEvent): void => {
      recordedEvents.push(event);
      originalRecord(event);
    };

    // Initialize with alpha mode enabled
    const config: TelemetryConfig = {
      enabled: true,
      mode: 'alpha',
      redactContent: true,
    };
    void client.init(config);
  });

  it('should include reasoningTokens in LLM event data when provided', () => {
    const sessionId = 'test-session-reasoning';

    client.trackLLMEx(sessionId, {
      model: 'claude-sonnet-4-20250514',
      inputTokens: 1000,
      outputTokens: 500,
      reasoningTokens: 250, // Extended thinking tokens
    });

    const llmEvents = recordedEvents.filter((e) => e.type === 'llm.usage');
    expect(llmEvents).toHaveLength(1);

    const eventData = llmEvents[0]!.data;
    expect(eventData.reasoningTokens).toBe(250);
    expect(eventData.inputTokens).toBe(1000);
    expect(eventData.outputTokens).toBe(500);
  });

  it('should not include reasoningTokens when not provided', () => {
    const sessionId = 'test-session-no-reasoning';

    client.trackLLMEx(sessionId, {
      model: 'claude-sonnet-4-20250514',
      inputTokens: 1000,
      outputTokens: 500,
      // No reasoningTokens provided
    });

    const llmEvents = recordedEvents.filter((e) => e.type === 'llm.usage');
    expect(llmEvents).toHaveLength(1);

    const eventData = llmEvents[0]!.data;
    expect(eventData.reasoningTokens).toBeUndefined();
    expect(eventData.inputTokens).toBe(1000);
    expect(eventData.outputTokens).toBe(500);
  });

  it('should handle zero reasoning tokens correctly', () => {
    const sessionId = 'test-session-zero-reasoning';

    client.trackLLMEx(sessionId, {
      model: 'claude-sonnet-4-20250514',
      inputTokens: 1000,
      outputTokens: 500,
      reasoningTokens: 0, // No extended thinking
    });

    const llmEvents = recordedEvents.filter((e) => e.type === 'llm.usage');
    expect(llmEvents).toHaveLength(1);

    const eventData = llmEvents[0]!.data;
    // Zero should be included (not undefined)
    expect(eventData.reasoningTokens).toBe(0);
  });

  it('should include reasoningTokens alongside cache tokens', () => {
    const sessionId = 'test-session-reasoning-and-cache';

    client.trackLLMEx(sessionId, {
      model: 'claude-sonnet-4-20250514',
      inputTokens: 2000,
      outputTokens: 800,
      reasoningTokens: 300,
      cacheReadTokens: 500,
      cacheCreationTokens: 1000,
    });

    const llmEvents = recordedEvents.filter((e) => e.type === 'llm.usage');
    expect(llmEvents).toHaveLength(1);

    const eventData = llmEvents[0]!.data;
    expect(eventData.reasoningTokens).toBe(300);
    expect(eventData.cacheReadTokens).toBe(500);
    expect(eventData.cacheCreationTokens).toBe(1000);
    expect(eventData.inputTokens).toBe(2000);
    expect(eventData.outputTokens).toBe(800);
  });

  it('should handle large reasoning token counts', () => {
    const sessionId = 'test-session-large-reasoning';

    client.trackLLMEx(sessionId, {
      model: 'claude-sonnet-4-20250514',
      inputTokens: 5000,
      outputTokens: 2000,
      reasoningTokens: 10000, // Large extended thinking
    });

    const llmEvents = recordedEvents.filter((e) => e.type === 'llm.usage');
    expect(llmEvents).toHaveLength(1);

    const eventData = llmEvents[0]!.data;
    expect(eventData.reasoningTokens).toBe(10000);
  });

  it('should support reasoning tokens in backward-compatible trackLLM method', () => {
    const sessionId = 'test-session-compat';

    // The old method doesn't support reasoningTokens directly
    // But trackLLMEx should handle it
    client.trackLLM(sessionId, 'claude-sonnet-4-20250514', 1000, 500);

    const llmEvents = recordedEvents.filter((e) => e.type === 'llm.usage');
    expect(llmEvents).toHaveLength(1);

    const eventData = llmEvents[0]!.data;
    expect(eventData.reasoningTokens).toBeUndefined();
    expect(eventData.inputTokens).toBe(1000);
    expect(eventData.outputTokens).toBe(500);
  });
});

describe('Tool Event Hierarchy (T021)', () => {
  let client: AlphaTelemetryClient;
  let recordedEvents: TelemetryEvent[];

  beforeEach(() => {
    client = new AlphaTelemetryClient();
    recordedEvents = [];

    // Mock the record method to capture events
    const originalRecord = client.record.bind(client);
    client.record = (event: TelemetryEvent): void => {
      recordedEvents.push(event);
      originalRecord(event);
    };

    // Initialize with alpha mode enabled
    const config: TelemetryConfig = {
      enabled: true,
      mode: 'alpha',
      redactContent: true,
    };
    void client.init(config);
  });

  it('should use session event ID as parent for events when no explicit parent', () => {
    const sessionId = 'test-session-default-parent';

    // Start session - this creates a session.start event with an eventId
    client.sessionStart(sessionId, {
      command: 'analyse',
      hasConfig: true,
    });

    // Track a tool without explicit parentEventId
    client.trackToolEx(sessionId, {
      tool: 'read_file',
      durationMs: 100,
      success: true,
    });

    const sessionEvents = recordedEvents.filter((e) => e.type === 'session.start');
    const toolEvents = recordedEvents.filter((e) => e.type === 'tool.call');

    expect(sessionEvents).toHaveLength(1);
    expect(toolEvents).toHaveLength(1);

    const sessionEventId = sessionEvents[0]!.eventId;
    const toolParentId = toolEvents[0]!.parentEventId;

    // Tool should use session event ID as parent
    expect(toolParentId).toBe(sessionEventId);
  });

  it('should use LLM event ID as parent when provided explicitly', () => {
    const sessionId = 'test-session-llm-parent';

    // Start session
    client.sessionStart(sessionId, {
      command: 'analyse',
      hasConfig: true,
    });

    // Track an LLM call
    client.trackLLMEx(sessionId, {
      model: 'claude-sonnet-4-20250514',
      inputTokens: 1000,
      outputTokens: 500,
    });

    const llmEvents = recordedEvents.filter((e) => e.type === 'llm.usage');
    expect(llmEvents).toHaveLength(1);
    const llmEventId = llmEvents[0]!.eventId;

    // Track a tool with LLM event as explicit parent
    client.trackToolEx(sessionId, {
      tool: 'read_file',
      durationMs: 100,
      success: true,
      parentEventId: llmEventId, // Explicitly set LLM as parent
    });

    const toolEvents = recordedEvents.filter((e) => e.type === 'tool.call');
    expect(toolEvents).toHaveLength(1);

    const toolParentId = toolEvents[0]!.parentEventId;

    // Tool should use LLM event ID as parent
    expect(toolParentId).toBe(llmEventId);
  });

  it('should support tool hierarchy within an LLM turn', () => {
    const sessionId = 'test-session-turn-hierarchy';

    // Start session
    client.sessionStart(sessionId, {
      command: 'analyse',
      hasConfig: true,
    });

    const sessionEventId = client.getSessionEventId(sessionId);
    expect(sessionEventId).toBeDefined();

    // Track first LLM call (turn 1)
    const llmOptions1: Parameters<NonNullable<typeof client.trackLLMEx>>[1] = {
      model: 'claude-sonnet-4-20250514',
      inputTokens: 1000,
      outputTokens: 500,
    };
    if (sessionEventId !== undefined) {
      llmOptions1.parentEventId = sessionEventId;
    }
    client.trackLLMEx(sessionId, llmOptions1);

    const llmEvents1 = recordedEvents.filter((e) => e.type === 'llm.usage');
    expect(llmEvents1).toHaveLength(1);
    const llmEventId1 = llmEvents1[0]!.eventId;

    // Track tool calls during turn 1 - should use LLM event as parent
    client.trackToolEx(sessionId, {
      tool: 'read_file',
      durationMs: 50,
      success: true,
      parentEventId: llmEventId1,
    });

    client.trackToolEx(sessionId, {
      tool: 'grep',
      durationMs: 75,
      success: true,
      parentEventId: llmEventId1,
    });

    // Track second LLM call (turn 2)
    const llmOptions2: Parameters<NonNullable<typeof client.trackLLMEx>>[1] = {
      model: 'claude-sonnet-4-20250514',
      inputTokens: 1200,
      outputTokens: 600,
    };
    if (sessionEventId !== undefined) {
      llmOptions2.parentEventId = sessionEventId;
    }
    client.trackLLMEx(sessionId, llmOptions2);

    const llmEvents2 = recordedEvents.filter((e) => e.type === 'llm.usage');
    expect(llmEvents2).toHaveLength(2);
    const llmEventId2 = llmEvents2[1]!.eventId;

    // Track tool call during turn 2 - should use second LLM event as parent
    client.trackToolEx(sessionId, {
      tool: 'write_file',
      durationMs: 100,
      success: true,
      parentEventId: llmEventId2,
    });

    const toolEvents = recordedEvents.filter((e) => e.type === 'tool.call');
    expect(toolEvents).toHaveLength(3);

    // Verify hierarchy
    expect(toolEvents[0]!.parentEventId).toBe(llmEventId1);
    expect(toolEvents[1]!.parentEventId).toBe(llmEventId1);
    expect(toolEvents[2]!.parentEventId).toBe(llmEventId2);

    // Verify LLM events have session as parent
    expect(llmEvents1[0]!.parentEventId).toBe(sessionEventId);
    expect(llmEvents2[1]!.parentEventId).toBe(sessionEventId);
  });

  it('should maintain hierarchy across session lifecycle', () => {
    const sessionId = 'test-session-lifecycle';

    // Start session
    client.sessionStart(sessionId, {
      command: 'analyse',
      hasConfig: true,
    });

    const sessionEventId = client.getSessionEventId(sessionId);
    expect(sessionEventId).toBeDefined();

    // Track LLM call
    client.trackLLMEx(sessionId, {
      model: 'claude-sonnet-4-20250514',
      inputTokens: 1000,
      outputTokens: 500,
    });

    // Track tool call
    client.trackToolEx(sessionId, {
      tool: 'read_file',
      durationMs: 100,
      success: true,
    });

    // Track finding
    client.trackFinding(sessionId, 'high_token_usage', 'warning');

    // End session
    client.sessionEnd(sessionId, {
      durationMs: 5000,
      toolCallCount: 1,
      findingCount: 1,
      recommendationCount: 0,
      totalInputTokens: 1000,
      totalOutputTokens: 500,
      success: true,
      interrupted: false,
    });

    const sessionStartEvents = recordedEvents.filter((e) => e.type === 'session.start');
    const sessionEndEvents = recordedEvents.filter((e) => e.type === 'session.end');
    const llmEvents = recordedEvents.filter((e) => e.type === 'llm.usage');
    const toolEvents = recordedEvents.filter((e) => e.type === 'tool.call');
    const findingEvents = recordedEvents.filter((e) => e.type === 'finding.detected');

    expect(sessionStartEvents).toHaveLength(1);
    expect(sessionEndEvents).toHaveLength(1);
    expect(llmEvents).toHaveLength(1);
    expect(toolEvents).toHaveLength(1);
    expect(findingEvents).toHaveLength(1);

    // All non-session events should have session as parent
    expect(llmEvents[0]!.parentEventId).toBe(sessionEventId);
    expect(toolEvents[0]!.parentEventId).toBe(sessionEventId);
    expect(findingEvents[0]!.parentEventId).toBe(sessionEventId);
  });

  it('should handle tools with no parent when session not started', () => {
    const sessionId = 'test-session-no-start';

    // Track tool without starting session first
    client.trackToolEx(sessionId, {
      tool: 'read_file',
      durationMs: 100,
      success: true,
    });

    const toolEvents = recordedEvents.filter((e) => e.type === 'tool.call');
    expect(toolEvents).toHaveLength(1);

    // parentEventId should be undefined since session wasn't started
    expect(toolEvents[0]!.parentEventId).toBeUndefined();
  });

  it('should preserve explicit parent override', () => {
    const sessionId = 'test-session-explicit-override';

    // Start session
    client.sessionStart(sessionId, {
      command: 'analyse',
      hasConfig: true,
    });

    const customParentId = 'custom-parent-event-id';

    // Track tool with explicit custom parent
    client.trackToolEx(sessionId, {
      tool: 'read_file',
      durationMs: 100,
      success: true,
      parentEventId: customParentId,
    });

    const toolEvents = recordedEvents.filter((e) => e.type === 'tool.call');
    expect(toolEvents).toHaveLength(1);

    // Should use the explicit parent, not session
    expect(toolEvents[0]!.parentEventId).toBe(customParentId);
  });
});
