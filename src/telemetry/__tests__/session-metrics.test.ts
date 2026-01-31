/**
 * EP23: Rich Telemetry Unification - P2 Polish Unit Tests
 *
 * Tests for T030, T031, T032
 *
 * T030: session.start includes agent identity
 * T031: session.end includes compression_count
 * T032: error events include category and stack
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { AlphaTelemetryClient } from '../alpha-client';
import type { TelemetryEvent } from '../events';
import type { TelemetryConfig } from '../../persistence/types';

describe('Agent Identity (T030)', () => {
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

  it('should include gen_ai.agent.id in session.start event', () => {
    const sessionId = 'test-session-agent-id';

    client.sessionStart(sessionId, {
      command: 'analyse',
      hasConfig: true,
    });

    const sessionEvents = recordedEvents.filter((e) => e.type === 'session.start');
    expect(sessionEvents).toHaveLength(1);

    const eventData = sessionEvents[0]!.data;
    // Verify agent identity attributes are present
    expect(eventData['gen_ai.agent.id']).toBe('agentlint-cli');
  });

  it('should include gen_ai.agent.name in session.start event', () => {
    const sessionId = 'test-session-agent-name';

    client.sessionStart(sessionId, {
      command: 'analyse',
      hasConfig: true,
    });

    const sessionEvents = recordedEvents.filter((e) => e.type === 'session.start');
    expect(sessionEvents).toHaveLength(1);

    const eventData = sessionEvents[0]!.data;
    // Verify agent name attribute is present
    expect(eventData['gen_ai.agent.name']).toBe('agentlint');
  });

  it('should include both agent identity attributes in session.start event', () => {
    const sessionId = 'test-session-agent-both';

    client.sessionStart(sessionId, {
      command: 'analyse',
      hasConfig: true,
    });

    const sessionEvents = recordedEvents.filter((e) => e.type === 'session.start');
    expect(sessionEvents).toHaveLength(1);

    const eventData = sessionEvents[0]!.data;
    // Verify both attributes are present together
    expect(eventData['gen_ai.agent.id']).toBe('agentlint-cli');
    expect(eventData['gen_ai.agent.name']).toBe('agentlint');
  });
});

describe('Session-End Metrics (T031)', () => {
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

  it('should include compression_count in session.end event', () => {
    const sessionId = 'test-session-compression-count';

    // Start session
    client.sessionStart(sessionId, {
      command: 'analyse',
      hasConfig: true,
    });

    // End session with compression count
    client.sessionEnd(sessionId, {
      durationMs: 5000,
      toolCallCount: 3,
      findingCount: 2,
      recommendationCount: 1,
      totalInputTokens: 1000,
      totalOutputTokens: 500,
      success: true,
      interrupted: false,
      compressionCount: 2, // EP23 new metric
    });

    const sessionEndEvents = recordedEvents.filter((e) => e.type === 'session.end');
    expect(sessionEndEvents).toHaveLength(1);

    const eventData = sessionEndEvents[0]!.data;
    expect(eventData.compressionCount).toBe(2);
  });

  it('should include retry_count in session.end event', () => {
    const sessionId = 'test-session-retry-count';

    // Start session
    client.sessionStart(sessionId, {
      command: 'analyse',
      hasConfig: true,
    });

    // End session with retry count
    client.sessionEnd(sessionId, {
      durationMs: 5000,
      toolCallCount: 3,
      findingCount: 2,
      recommendationCount: 1,
      totalInputTokens: 1000,
      totalOutputTokens: 500,
      success: true,
      interrupted: false,
      retryCount: 3, // EP23 new metric
    });

    const sessionEndEvents = recordedEvents.filter((e) => e.type === 'session.end');
    expect(sessionEndEvents).toHaveLength(1);

    const eventData = sessionEndEvents[0]!.data;
    expect(eventData.retryCount).toBe(3);
  });

  it('should include both compression_count and retry_count in session.end event', () => {
    const sessionId = 'test-session-both-counts';

    // Start session
    client.sessionStart(sessionId, {
      command: 'analyse',
      hasConfig: true,
    });

    // End session with both counts
    client.sessionEnd(sessionId, {
      durationMs: 5000,
      toolCallCount: 3,
      findingCount: 2,
      recommendationCount: 1,
      totalInputTokens: 1000,
      totalOutputTokens: 500,
      success: true,
      interrupted: false,
      compressionCount: 2,
      retryCount: 3,
    });

    const sessionEndEvents = recordedEvents.filter((e) => e.type === 'session.end');
    expect(sessionEndEvents).toHaveLength(1);

    const eventData = sessionEndEvents[0]!.data;
    expect(eventData.compressionCount).toBe(2);
    expect(eventData.retryCount).toBe(3);
  });

  it('should handle zero compression and retry counts', () => {
    const sessionId = 'test-session-zero-counts';

    // Start session
    client.sessionStart(sessionId, {
      command: 'analyse',
      hasConfig: true,
    });

    // End session with zero counts
    client.sessionEnd(sessionId, {
      durationMs: 5000,
      toolCallCount: 3,
      findingCount: 2,
      recommendationCount: 1,
      totalInputTokens: 1000,
      totalOutputTokens: 500,
      success: true,
      interrupted: false,
      compressionCount: 0,
      retryCount: 0,
    });

    const sessionEndEvents = recordedEvents.filter((e) => e.type === 'session.end');
    expect(sessionEndEvents).toHaveLength(1);

    const eventData = sessionEndEvents[0]!.data;
    // Zero values should be included (not undefined)
    expect(eventData.compressionCount).toBe(0);
    expect(eventData.retryCount).toBe(0);
  });

  it('should not include compression_count when not provided', () => {
    const sessionId = 'test-session-no-compression';

    // Start session
    client.sessionStart(sessionId, {
      command: 'analyse',
      hasConfig: true,
    });

    // End session without compression count
    client.sessionEnd(sessionId, {
      durationMs: 5000,
      toolCallCount: 3,
      findingCount: 2,
      recommendationCount: 1,
      totalInputTokens: 1000,
      totalOutputTokens: 500,
      success: true,
      interrupted: false,
      // No compressionCount provided
    });

    const sessionEndEvents = recordedEvents.filter((e) => e.type === 'session.end');
    expect(sessionEndEvents).toHaveLength(1);

    const eventData = sessionEndEvents[0]!.data;
    expect(eventData.compressionCount).toBeUndefined();
  });

  it('should not include retry_count when not provided', () => {
    const sessionId = 'test-session-no-retry';

    // Start session
    client.sessionStart(sessionId, {
      command: 'analyse',
      hasConfig: true,
    });

    // End session without retry count
    client.sessionEnd(sessionId, {
      durationMs: 5000,
      toolCallCount: 3,
      findingCount: 2,
      recommendationCount: 1,
      totalInputTokens: 1000,
      totalOutputTokens: 500,
      success: true,
      interrupted: false,
      // No retryCount provided
    });

    const sessionEndEvents = recordedEvents.filter((e) => e.type === 'session.end');
    expect(sessionEndEvents).toHaveLength(1);

    const eventData = sessionEndEvents[0]!.data;
    expect(eventData.retryCount).toBeUndefined();
  });
});

describe('Error Enrichment (T032)', () => {
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

  it('should include errorCategory in tool error events', () => {
    const sessionId = 'test-session-error-category';

    // Start session
    client.sessionStart(sessionId, {
      command: 'analyse',
      hasConfig: true,
    });

    // Track a failed tool call with error category
    client.trackToolEx(sessionId, {
      tool: 'read_file',
      durationMs: 100,
      success: false,
      errorMessage: 'File not found',
      errorCategory: 'unknown', // EP23 new field - uses valid category
    });

    const toolEvents = recordedEvents.filter((e) => e.type === 'tool.call');
    expect(toolEvents).toHaveLength(1);

    const eventData = toolEvents[0]!.data;
    expect(eventData.success).toBe(false);
    expect(eventData.errorMessage).toBe('File not found');
    expect(eventData.errorCategory).toBe('unknown');
  });

  it('should include sanitized errorStack in tool error events', () => {
    const sessionId = 'test-session-error-stack';

    // Start session
    client.sessionStart(sessionId, {
      command: 'analyse',
      hasConfig: true,
    });

    // Create a realistic stack trace with potential secrets
    const errorStack = `Error: Authentication failed
    at authenticate (/Users/dev/agentlint/src/auth.ts:42:15)
    at readFile (/Users/dev/agentlint/src/tools/read.ts:10:20)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)`;

    // Track a failed tool call with stack trace
    client.trackToolEx(sessionId, {
      tool: 'read_file',
      durationMs: 100,
      success: false,
      errorMessage: 'Authentication failed',
      errorStack, // EP23 new field
    });

    const toolEvents = recordedEvents.filter((e) => e.type === 'tool.call');
    expect(toolEvents).toHaveLength(1);

    const eventData = toolEvents[0]!.data;
    expect(eventData.success).toBe(false);
    expect(eventData.errorStack).toBeDefined();
    expect(typeof eventData.errorStack).toBe('string');
    // Stack should be sanitized (redacted patterns applied)
    expect(eventData.errorStack).toContain('Error: Authentication failed');
  });

  it('should include both errorCategory and errorStack in tool error events', () => {
    const sessionId = 'test-session-error-both';

    // Start session
    client.sessionStart(sessionId, {
      command: 'analyse',
      hasConfig: true,
    });

    const errorStack = `Error: Network timeout
    at fetch (/Users/dev/agentlint/src/client.ts:100:10)`;

    // Track a failed tool call with both category and stack
    client.trackToolEx(sessionId, {
      tool: 'api_call',
      durationMs: 5000,
      success: false,
      errorMessage: 'Network timeout',
      errorCategory: 'timeout',
      errorStack,
    });

    const toolEvents = recordedEvents.filter((e) => e.type === 'tool.call');
    expect(toolEvents).toHaveLength(1);

    const eventData = toolEvents[0]!.data;
    expect(eventData.success).toBe(false);
    expect(eventData.errorMessage).toBe('Network timeout');
    expect(eventData.errorCategory).toBe('timeout');
    expect(eventData.errorStack).toBeDefined();
    expect(eventData.errorStack).toContain('Error: Network timeout');
  });

  it('should sanitize API keys in error stack traces', () => {
    const sessionId = 'test-session-error-sanitize';

    // Start session
    client.sessionStart(sessionId, {
      command: 'analyse',
      hasConfig: true,
    });

    // Stack trace with a leaked API key
    const errorStack = `Error: API call failed with key sk-ant-leaked-secret-123
    at callAPI (/Users/dev/agentlint/src/api.ts:50:10)`;

    // Track a failed tool call
    client.trackToolEx(sessionId, {
      tool: 'api_call',
      durationMs: 100,
      success: false,
      errorMessage: 'API call failed',
      errorStack,
    });

    const toolEvents = recordedEvents.filter((e) => e.type === 'tool.call');
    expect(toolEvents).toHaveLength(1);

    const eventData = toolEvents[0]!.data;
    // Error stack should NOT contain the leaked secret
    expect(eventData.errorStack).not.toContain('sk-ant-leaked-secret-123');
    // Should contain redaction marker
    expect(eventData.errorStack).toContain('[REDACTED:ANTHROPIC_KEY]');
  });

  it('should not include errorCategory when not provided', () => {
    const sessionId = 'test-session-no-category';

    // Start session
    client.sessionStart(sessionId, {
      command: 'analyse',
      hasConfig: true,
    });

    // Track a failed tool call without error category
    client.trackToolEx(sessionId, {
      tool: 'read_file',
      durationMs: 100,
      success: false,
      errorMessage: 'File not found',
      // No errorCategory provided
    });

    const toolEvents = recordedEvents.filter((e) => e.type === 'tool.call');
    expect(toolEvents).toHaveLength(1);

    const eventData = toolEvents[0]!.data;
    expect(eventData.success).toBe(false);
    expect(eventData.errorMessage).toBe('File not found');
    expect(eventData.errorCategory).toBeUndefined();
  });

  it('should not include errorStack when not provided', () => {
    const sessionId = 'test-session-no-stack';

    // Start session
    client.sessionStart(sessionId, {
      command: 'analyse',
      hasConfig: true,
    });

    // Track a failed tool call without error stack
    client.trackToolEx(sessionId, {
      tool: 'read_file',
      durationMs: 100,
      success: false,
      errorMessage: 'File not found',
      // No errorStack provided
    });

    const toolEvents = recordedEvents.filter((e) => e.type === 'tool.call');
    expect(toolEvents).toHaveLength(1);

    const eventData = toolEvents[0]!.data;
    expect(eventData.success).toBe(false);
    expect(eventData.errorMessage).toBe('File not found');
    expect(eventData.errorStack).toBeUndefined();
  });

  it('should handle successful tool calls without error fields', () => {
    const sessionId = 'test-session-success';

    // Start session
    client.sessionStart(sessionId, {
      command: 'analyse',
      hasConfig: true,
    });

    // Track a successful tool call
    client.trackToolEx(sessionId, {
      tool: 'read_file',
      durationMs: 100,
      success: true,
    });

    const toolEvents = recordedEvents.filter((e) => e.type === 'tool.call');
    expect(toolEvents).toHaveLength(1);

    const eventData = toolEvents[0]!.data;
    expect(eventData.success).toBe(true);
    // Error fields should not be present
    expect(eventData.errorMessage).toBeUndefined();
    expect(eventData.errorCategory).toBeUndefined();
    expect(eventData.errorStack).toBeUndefined();
  });
});
