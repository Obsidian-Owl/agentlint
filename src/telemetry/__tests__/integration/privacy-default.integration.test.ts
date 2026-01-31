/**
 * EP23 T046: Privacy Default Integration Test
 *
 * CRITICAL: This test verifies that no content is sent when capture is disabled (the default).
 * This is a core privacy guarantee per Constitution Principle I (Local-First).
 *
 * Tests verify that even if content fields are passed to tracking methods,
 * they are excluded from telemetry events when AGENTLINT_CAPTURE_CONTENT is not set.
 *
 * IMPLEMENTATION NOTE:
 * - TelemetryTracker (src/opencode/telemetry-tracker.ts) checks isContentCaptureEnabled()
 *   before capturing content in onToolStart/onLLMUsage
 * - AlphaTelemetryClient should ALSO filter as defense-in-depth (currently missing - these tests document the requirement)
 * - This provides defense against accidental leakage if tracker layer is bypassed
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { AlphaTelemetryClient } from '../../alpha-client';
import type { TelemetryEvent } from '../../events';
import type { SessionMetrics } from '../../types';

describe('Privacy Default Integration (T046)', () => {
  let client: AlphaTelemetryClient;
  let originalEnv: string | undefined;
  let capturedEvents: TelemetryEvent[] = [];

  beforeEach(() => {
    // Save and clear environment
    originalEnv = process.env.AGENTLINT_CAPTURE_CONTENT;
    delete process.env.AGENTLINT_CAPTURE_CONTENT;

    // Create client and initialize
    client = new AlphaTelemetryClient();
    void client.init({ enabled: true, mode: 'alpha', redactContent: true });

    // Capture events by overriding record method
    capturedEvents = [];
    const originalRecord = client.record.bind(client);
    client.record = (event: TelemetryEvent): void => {
      capturedEvents.push(event);
      originalRecord(event);
    };
  });

  afterEach(() => {
    // Restore environment
    if (originalEnv === undefined) {
      delete process.env.AGENTLINT_CAPTURE_CONTENT;
    } else {
      process.env.AGENTLINT_CAPTURE_CONTENT = originalEnv;
    }

    // Cleanup client
    void client.shutdown();
    capturedEvents = [];
  });

  /**
   * T046.1: LLM events exclude content by default
   */
  describe('LLM events exclude content by default', () => {
    it('should exclude promptContent from LLM events when capture is disabled', () => {
      const sessionId = 'test-session-llm-1';
      client.sessionStart(sessionId);

      // Track LLM with content fields (simulating what code might pass)
      client.trackLLMEx(sessionId, {
        model: 'claude-sonnet-4-20250514',
        inputTokens: 100,
        outputTokens: 50,
        latencyMs: 1000,
        promptContent: 'SECRET PROMPT CONTENT THAT SHOULD NOT BE SENT',
        completionContent: 'SECRET COMPLETION CONTENT THAT SHOULD NOT BE SENT',
        systemInstructions: 'SECRET SYSTEM INSTRUCTIONS THAT SHOULD NOT BE SENT',
      });

      // Find the LLM event
      const llmEvent = capturedEvents.find((e) => e.type === 'llm.usage');
      expect(llmEvent).toBeDefined();

      // CRITICAL: Content fields must NOT be present in event data
      expect(llmEvent?.data.promptContent).toBeUndefined();
      expect(llmEvent?.data.completionContent).toBeUndefined();
      expect(llmEvent?.data.systemInstructions).toBeUndefined();

      // Verify other fields are still present
      expect(llmEvent?.data.model).toBe('claude-sonnet-4-20250514');
      expect(llmEvent?.data.inputTokens).toBe(100);
      expect(llmEvent?.data.outputTokens).toBe(50);
    });

    it('should exclude reasoning tokens content when capture is disabled', () => {
      const sessionId = 'test-session-llm-2';
      client.sessionStart(sessionId);

      client.trackLLMEx(sessionId, {
        model: 'claude-sonnet-4-20250514',
        inputTokens: 100,
        outputTokens: 50,
        reasoningTokens: 200,
        promptContent: 'SECRET REASONING PROMPT',
      });

      const llmEvent = capturedEvents.find((e) => e.type === 'llm.usage');
      expect(llmEvent).toBeDefined();

      // Reasoning tokens count is OK (metadata), but not content
      expect(llmEvent?.data.reasoningTokens).toBe(200);
      expect(llmEvent?.data.promptContent).toBeUndefined();
    });

    it('should exclude cache-related content when capture is disabled', () => {
      const sessionId = 'test-session-llm-3';
      client.sessionStart(sessionId);

      client.trackLLMEx(sessionId, {
        model: 'claude-sonnet-4-20250514',
        inputTokens: 100,
        outputTokens: 50,
        cacheReadTokens: 500,
        cacheCreationTokens: 100,
        promptContent: 'CACHED PROMPT CONTENT',
      });

      const llmEvent = capturedEvents.find((e) => e.type === 'llm.usage');
      expect(llmEvent).toBeDefined();

      // Cache token counts are OK (metadata), but not content
      expect(llmEvent?.data.cacheReadTokens).toBe(500);
      expect(llmEvent?.data.cacheCreationTokens).toBe(100);
      expect(llmEvent?.data.promptContent).toBeUndefined();
    });
  });

  /**
   * T046.2: Tool events exclude content by default
   */
  describe('Tool events exclude content by default', () => {
    it('should exclude toolInputJson from tool events when capture is disabled', () => {
      const sessionId = 'test-session-tool-1';
      client.sessionStart(sessionId);

      // Track tool with content fields
      client.trackToolEx(sessionId, {
        tool: 'read_file',
        durationMs: 100,
        success: true,
        toolInputJson: '{"file_path": "/secret/path.ts", "secret_key": "sk-ant-secret"}',
        toolOutputJson: '{"content": "SECRET FILE CONTENTS", "lines": 100}',
      });

      const toolEvent = capturedEvents.find((e) => e.type === 'tool.call');
      expect(toolEvent).toBeDefined();

      // CRITICAL: Content fields must NOT be present
      expect(toolEvent?.data.toolInputJson).toBeUndefined();
      expect(toolEvent?.data.toolOutputJson).toBeUndefined();

      // Verify other fields are still present
      expect(toolEvent?.data.tool).toBe('read_file');
      expect(toolEvent?.data.durationMs).toBe(100);
      expect(toolEvent?.data.success).toBe(true);
    });

    it('should include sanitized error stack (always sent for debugging)', () => {
      const sessionId = 'test-session-tool-2';
      client.sessionStart(sessionId);

      client.trackToolEx(sessionId, {
        tool: 'write_file',
        durationMs: 50,
        success: false,
        errorMessage: 'Failed to write',
        errorStack: 'STACK TRACE WITH SECRETS: sk-ant-leaked-key',
        errorCategory: 'unknown',
      });

      const toolEvent = capturedEvents.find((e) => e.type === 'tool.call');
      expect(toolEvent).toBeDefined();

      // Error metadata including stack is ALWAYS sent (critical for debugging)
      expect(toolEvent?.data.errorMessage).toBe('Failed to write');
      expect(toolEvent?.data.errorCategory).toBe('unknown');
      expect(toolEvent?.data.errorStack).toBeDefined();
      // But secrets should be redacted
      expect(toolEvent?.data.errorStack).toContain('[REDACTED:ANTHROPIC_KEY]');
      expect(toolEvent?.data.errorStack).not.toContain('sk-ant-leaked-key');
    });

    it('should exclude callId and other rich telemetry when capture is disabled', () => {
      const sessionId = 'test-session-tool-3';
      client.sessionStart(sessionId);

      client.trackToolEx(sessionId, {
        tool: 'execute_command',
        durationMs: 2000,
        success: true,
        callId: 'unique-call-id-12345',
        toolInputJson: '{"command": "secret-command"}',
        toolOutputJson: '{"stdout": "secret output"}',
      });

      const toolEvent = capturedEvents.find((e) => e.type === 'tool.call');
      expect(toolEvent).toBeDefined();

      // Basic metadata is OK
      expect(toolEvent?.data.tool).toBe('execute_command');
      expect(toolEvent?.data.durationMs).toBe(2000);
      expect(toolEvent?.data.success).toBe(true);

      // Rich telemetry fields should be excluded
      expect(toolEvent?.data.callId).toBeUndefined();
      expect(toolEvent?.data.toolInputJson).toBeUndefined();
      expect(toolEvent?.data.toolOutputJson).toBeUndefined();
    });
  });

  /**
   * T046.3: Privacy preserved across session lifecycle
   */
  describe('Privacy preserved across session lifecycle', () => {
    it('should exclude all content fields across multiple events in a session', () => {
      const sessionId = 'test-session-lifecycle';

      // Start session
      client.sessionStart(sessionId, {
        command: 'analyse',
        hasConfig: true,
        directory: '/test/project',
      });

      // Track multiple LLM calls with content
      for (let i = 0; i < 3; i++) {
        client.trackLLMEx(sessionId, {
          model: 'claude-sonnet-4-20250514',
          inputTokens: 100 + i,
          outputTokens: 50 + i,
          promptContent: `SECRET PROMPT ${i}`,
          completionContent: `SECRET COMPLETION ${i}`,
        });
      }

      // Track multiple tool calls with content
      for (let i = 0; i < 3; i++) {
        client.trackToolEx(sessionId, {
          tool: `tool_${i}`,
          durationMs: 100 * i,
          success: true,
          toolInputJson: `{"secret": "data-${i}"}`,
          toolOutputJson: `{"secret": "result-${i}"}`,
        });
      }

      // Track findings (no content expected, but verify)
      client.trackFinding(sessionId, 'test-finding', 'warning');

      // End session
      const metrics: SessionMetrics = {
        durationMs: 5000,
        toolCallCount: 3,
        findingCount: 1,
        totalInputTokens: 303,
        totalOutputTokens: 153,
        success: true,
        compressionCount: 0,
        retryCount: 0,
      };
      client.sessionEnd(sessionId, metrics);

      // Verify NO content in ANY event
      const llmEvents = capturedEvents.filter((e) => e.type === 'llm.usage');
      expect(llmEvents).toHaveLength(3);
      for (const event of llmEvents) {
        expect(event.data.promptContent).toBeUndefined();
        expect(event.data.completionContent).toBeUndefined();
        expect(event.data.systemInstructions).toBeUndefined();
      }

      const toolEvents = capturedEvents.filter((e) => e.type === 'tool.call');
      expect(toolEvents).toHaveLength(3);
      for (const event of toolEvents) {
        expect(event.data.toolInputJson).toBeUndefined();
        expect(event.data.toolOutputJson).toBeUndefined();
        expect(event.data.errorStack).toBeUndefined();
        expect(event.data.callId).toBeUndefined();
      }

      // Session events should NOT have content either
      const sessionStart = capturedEvents.find((e) => e.type === 'session.start');
      const sessionEnd = capturedEvents.find((e) => e.type === 'session.end');

      expect(sessionStart).toBeDefined();
      expect(sessionEnd).toBeDefined();

      // Directory is OK (metadata), but no content fields
      expect(sessionStart?.data.directory).toBe('/test/project');
      expect(sessionStart?.data.promptContent).toBeUndefined();
      expect(sessionEnd?.data.toolInputJson).toBeUndefined();
    });

    it('should maintain privacy even with interrupted session', () => {
      const sessionId = 'test-session-interrupted';

      client.sessionStart(sessionId, {
        command: 'analyse',
        hasConfig: false,
      });

      // Track some events with content
      client.trackLLMEx(sessionId, {
        model: 'claude-sonnet-4-20250514',
        inputTokens: 100,
        outputTokens: 50,
        promptContent: 'SECRET BEFORE INTERRUPTION',
      });

      client.trackToolEx(sessionId, {
        tool: 'analyze_code',
        durationMs: 1000,
        success: false,
        toolInputJson: '{"code": "secret code"}',
        errorMessage: 'Interrupted',
      });

      // End session with interrupted flag
      const metrics: SessionMetrics = {
        durationMs: 2000,
        toolCallCount: 1,
        findingCount: 0,
        totalInputTokens: 100,
        totalOutputTokens: 50,
        success: false,
        interrupted: true,
      };
      client.sessionEnd(sessionId, metrics);

      // Verify content excluded even in interrupted session
      const allEvents = capturedEvents;
      for (const event of allEvents) {
        expect(event.data.promptContent).toBeUndefined();
        expect(event.data.completionContent).toBeUndefined();
        expect(event.data.toolInputJson).toBeUndefined();
        expect(event.data.toolOutputJson).toBeUndefined();
        expect(event.data.errorStack).toBeUndefined();
      }

      // Interrupted flag is OK (metadata)
      const sessionEnd = capturedEvents.find((e) => e.type === 'session.end');
      expect(sessionEnd?.data.interrupted).toBe(true);
    });

    it('should exclude content from error tracking events', () => {
      const sessionId = 'test-session-errors';

      client.sessionStart(sessionId);

      // Track errors (no content fields expected in errors anyway)
      client.trackError(sessionId, 'network_error', 'ECONNREFUSED');
      client.trackError(sessionId, 'auth_error');

      const errorEvents = capturedEvents.filter((e) => e.type === 'session.error');
      expect(errorEvents).toHaveLength(2);

      for (const event of errorEvents) {
        // Error metadata is OK
        expect(event.data.errorType).toBeDefined();

        // But no content fields
        expect(event.data.errorStack).toBeUndefined();
        expect(event.data.promptContent).toBeUndefined();
        expect(event.data.toolInputJson).toBeUndefined();
      }
    });
  });

  /**
   * T046.4: Verify environment variable check
   */
  describe('Environment variable controls content capture', () => {
    it('should confirm AGENTLINT_CAPTURE_CONTENT is NOT set', () => {
      expect(process.env.AGENTLINT_CAPTURE_CONTENT).toBeUndefined();
    });

    it('should exclude content even if set to false explicitly', () => {
      process.env.AGENTLINT_CAPTURE_CONTENT = 'false';

      const sessionId = 'test-session-false';
      client.sessionStart(sessionId);

      client.trackLLMEx(sessionId, {
        model: 'claude-sonnet-4-20250514',
        inputTokens: 100,
        outputTokens: 50,
        promptContent: 'SECRET WHEN FALSE',
      });

      const llmEvent = capturedEvents.find((e) => e.type === 'llm.usage');
      expect(llmEvent?.data.promptContent).toBeUndefined();

      delete process.env.AGENTLINT_CAPTURE_CONTENT;
    });

    it('should exclude content for any non-true value', () => {
      const testValues = ['0', '1', 'yes', 'no', 'enabled', ''];

      for (const value of testValues) {
        // Reset
        capturedEvents = [];
        process.env.AGENTLINT_CAPTURE_CONTENT = value;

        const sessionId = `test-session-${value}`;
        client.sessionStart(sessionId);

        client.trackLLMEx(sessionId, {
          model: 'claude-sonnet-4-20250514',
          inputTokens: 100,
          outputTokens: 50,
          promptContent: `SECRET WITH VALUE: ${value}`,
        });

        const llmEvent = capturedEvents.find((e) => e.type === 'llm.usage');
        expect(llmEvent?.data.promptContent).toBeUndefined();
      }

      delete process.env.AGENTLINT_CAPTURE_CONTENT;
    });
  });
});
