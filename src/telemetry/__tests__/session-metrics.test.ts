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

/**
 * Creates a test client with event recording capability.
 * Extracted to reduce duplication across test suites.
 */
function createTestClient(): { client: AlphaTelemetryClient; recordedEvents: TelemetryEvent[] } {
  const client = new AlphaTelemetryClient();
  const recordedEvents: TelemetryEvent[] = [];

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

  return { client, recordedEvents };
}

/**
 * Helper to start a session with default parameters
 */
function startSession(client: AlphaTelemetryClient, sessionId: string): void {
  client.sessionStart(sessionId, {
    command: 'analyse',
    hasConfig: true,
  });
}

/**
 * Helper to end a session with default parameters, allowing overrides
 */
function endSession(
  client: AlphaTelemetryClient,
  sessionId: string,
  overrides: Partial<Parameters<AlphaTelemetryClient['sessionEnd']>[1]> = {}
): void {
  client.sessionEnd(sessionId, {
    durationMs: 5000,
    toolCallCount: 3,
    findingCount: 2,
    recommendationCount: 1,
    totalInputTokens: 1000,
    totalOutputTokens: 500,
    success: true,
    interrupted: false,
    ...overrides,
  });
}

/**
 * Helper to track a tool call with error, allowing overrides
 */
function trackToolError(
  client: AlphaTelemetryClient,
  sessionId: string,
  overrides: Partial<Parameters<AlphaTelemetryClient['trackToolEx']>[1]> = {}
): void {
  client.trackToolEx(sessionId, {
    tool: 'read_file',
    durationMs: 100,
    success: false,
    errorMessage: 'File not found',
    ...overrides,
  });
}

/**
 * Helper to get the first event of a specific type
 */
function getFirstEvent(events: TelemetryEvent[], type: string): TelemetryEvent | undefined {
  return events.find((e) => e.type === type);
}

/**
 * Helper to get event data for assertion
 */
function getEventData(events: TelemetryEvent[], type: string): Record<string, unknown> {
  const event = getFirstEvent(events, type);
  expect(event).toBeDefined();
  return event!.data;
}

describe('Agent Identity (T030)', () => {
  let client: AlphaTelemetryClient;
  let recordedEvents: TelemetryEvent[];

  beforeEach(() => {
    ({ client, recordedEvents } = createTestClient());
  });

  it('should include gen_ai.agent.id in session.start event', () => {
    const sessionId = 'test-session-agent-id';
    startSession(client, sessionId);

    const eventData = getEventData(recordedEvents, 'session.start');
    expect(eventData['gen_ai.agent.id']).toBe('agentlint-cli');
  });

  it('should include gen_ai.agent.name in session.start event', () => {
    const sessionId = 'test-session-agent-name';
    startSession(client, sessionId);

    const eventData = getEventData(recordedEvents, 'session.start');
    expect(eventData['gen_ai.agent.name']).toBe('agentlint');
  });

  it('should include both agent identity attributes in session.start event', () => {
    const sessionId = 'test-session-agent-both';
    startSession(client, sessionId);

    const eventData = getEventData(recordedEvents, 'session.start');
    expect(eventData['gen_ai.agent.id']).toBe('agentlint-cli');
    expect(eventData['gen_ai.agent.name']).toBe('agentlint');
  });
});

describe('Session-End Metrics (T031)', () => {
  let client: AlphaTelemetryClient;
  let recordedEvents: TelemetryEvent[];

  beforeEach(() => {
    ({ client, recordedEvents } = createTestClient());
  });

  it('should include compression_count in session.end event', () => {
    const sessionId = 'test-session-compression-count';
    startSession(client, sessionId);
    endSession(client, sessionId, { compressionCount: 2 });

    const eventData = getEventData(recordedEvents, 'session.end');
    expect(eventData.compressionCount).toBe(2);
  });

  it('should include retry_count in session.end event', () => {
    const sessionId = 'test-session-retry-count';
    startSession(client, sessionId);
    endSession(client, sessionId, { retryCount: 3 });

    const eventData = getEventData(recordedEvents, 'session.end');
    expect(eventData.retryCount).toBe(3);
  });

  it('should include both compression_count and retry_count in session.end event', () => {
    const sessionId = 'test-session-both-counts';
    startSession(client, sessionId);
    endSession(client, sessionId, { compressionCount: 2, retryCount: 3 });

    const eventData = getEventData(recordedEvents, 'session.end');
    expect(eventData.compressionCount).toBe(2);
    expect(eventData.retryCount).toBe(3);
  });

  it('should handle zero compression and retry counts', () => {
    const sessionId = 'test-session-zero-counts';
    startSession(client, sessionId);
    endSession(client, sessionId, { compressionCount: 0, retryCount: 0 });

    const eventData = getEventData(recordedEvents, 'session.end');
    expect(eventData.compressionCount).toBe(0);
    expect(eventData.retryCount).toBe(0);
  });

  it('should not include compression_count when not provided', () => {
    const sessionId = 'test-session-no-compression';
    startSession(client, sessionId);
    endSession(client, sessionId);

    const eventData = getEventData(recordedEvents, 'session.end');
    expect(eventData.compressionCount).toBeUndefined();
  });

  it('should not include retry_count when not provided', () => {
    const sessionId = 'test-session-no-retry';
    startSession(client, sessionId);
    endSession(client, sessionId);

    const eventData = getEventData(recordedEvents, 'session.end');
    expect(eventData.retryCount).toBeUndefined();
  });
});

describe('Error Enrichment (T032)', () => {
  let client: AlphaTelemetryClient;
  let recordedEvents: TelemetryEvent[];

  beforeEach(() => {
    ({ client, recordedEvents } = createTestClient());
  });

  it('should include errorCategory in tool error events', () => {
    const sessionId = 'test-session-error-category';
    startSession(client, sessionId);
    trackToolError(client, sessionId, { errorCategory: 'unknown' });

    const eventData = getEventData(recordedEvents, 'tool.call');
    expect(eventData.success).toBe(false);
    expect(eventData.errorMessage).toBe('File not found');
    expect(eventData.errorCategory).toBe('unknown');
  });

  it('should include sanitized errorStack in tool error events', () => {
    const sessionId = 'test-session-error-stack';
    startSession(client, sessionId);

    const errorStack = `Error: Authentication failed
    at authenticate (/Users/dev/agentlint/src/auth.ts:42:15)
    at readFile (/Users/dev/agentlint/src/tools/read.ts:10:20)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)`;

    trackToolError(client, sessionId, {
      errorMessage: 'Authentication failed',
      errorStack,
    });

    const eventData = getEventData(recordedEvents, 'tool.call');
    expect(eventData.success).toBe(false);
    expect(eventData.errorStack).toBeDefined();
    expect(typeof eventData.errorStack).toBe('string');
    expect(eventData.errorStack).toContain('Error: Authentication failed');
  });

  it('should include both errorCategory and errorStack in tool error events', () => {
    const sessionId = 'test-session-error-both';
    startSession(client, sessionId);

    const errorStack = `Error: Network timeout
    at fetch (/Users/dev/agentlint/src/client.ts:100:10)`;

    trackToolError(client, sessionId, {
      tool: 'api_call',
      durationMs: 5000,
      errorMessage: 'Network timeout',
      errorCategory: 'timeout',
      errorStack,
    });

    const eventData = getEventData(recordedEvents, 'tool.call');
    expect(eventData.success).toBe(false);
    expect(eventData.errorMessage).toBe('Network timeout');
    expect(eventData.errorCategory).toBe('timeout');
    expect(eventData.errorStack).toBeDefined();
    expect(eventData.errorStack).toContain('Error: Network timeout');
  });

  it('should sanitize API keys in error stack traces', () => {
    const sessionId = 'test-session-error-sanitize';
    startSession(client, sessionId);

    const errorStack = `Error: API call failed with key sk-ant-leaked-secret-123
    at callAPI (/Users/dev/agentlint/src/api.ts:50:10)`;

    trackToolError(client, sessionId, {
      tool: 'api_call',
      errorMessage: 'API call failed',
      errorStack,
    });

    const eventData = getEventData(recordedEvents, 'tool.call');
    expect(eventData.errorStack).not.toContain('sk-ant-leaked-secret-123');
    expect(eventData.errorStack).toContain('[REDACTED:ANTHROPIC_KEY]');
  });

  it('should not include errorCategory when not provided', () => {
    const sessionId = 'test-session-no-category';
    startSession(client, sessionId);
    trackToolError(client, sessionId);

    const eventData = getEventData(recordedEvents, 'tool.call');
    expect(eventData.success).toBe(false);
    expect(eventData.errorMessage).toBe('File not found');
    expect(eventData.errorCategory).toBeUndefined();
  });

  it('should not include errorStack when not provided', () => {
    const sessionId = 'test-session-no-stack';
    startSession(client, sessionId);
    trackToolError(client, sessionId);

    const eventData = getEventData(recordedEvents, 'tool.call');
    expect(eventData.success).toBe(false);
    expect(eventData.errorMessage).toBe('File not found');
    expect(eventData.errorStack).toBeUndefined();
  });

  it('should handle successful tool calls without error fields', () => {
    const sessionId = 'test-session-success';
    startSession(client, sessionId);

    client.trackToolEx(sessionId, {
      tool: 'read_file',
      durationMs: 100,
      success: true,
    });

    const eventData = getEventData(recordedEvents, 'tool.call');
    expect(eventData.success).toBe(true);
    expect(eventData.errorMessage).toBeUndefined();
    expect(eventData.errorCategory).toBeUndefined();
    expect(eventData.errorStack).toBeUndefined();
  });
});
