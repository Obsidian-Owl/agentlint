import { describe, expect, it, mock, beforeEach } from 'bun:test';
import { TelemetryTracker, type LLMUsageData } from '../../../src/opencode/telemetry-tracker';
import type { IOrchestratorTelemetryClient } from '../../../src/orchestration/types';
import type { INamespacedLogger } from '../../../src/debug/types';

function createMockTelemetryClient(): IOrchestratorTelemetryClient {
  return {
    isEnabled: () => true,
    trackToolEx: mock(() => {}),
    trackLLMEx: mock(() => {}),
  };
}

function createMockLogger(): INamespacedLogger {
  return {
    trace: mock(() => {}),
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
    time: async <T>(_msg: string, fn: () => Promise<T>): Promise<T> => fn(),
    isEnabled: () => true,
  };
}

describe('TelemetryTracker', () => {
  let client: IOrchestratorTelemetryClient;
  let logger: INamespacedLogger;
  let tracker: TelemetryTracker;

  beforeEach(() => {
    client = createMockTelemetryClient();
    logger = createMockLogger();
    tracker = new TelemetryTracker({
      telemetryClient: client,
      sessionId: 'ses-test-123',
      parentEventId: 'evt-parent',
      model: 'claude-sonnet-4-20250514',
      logger,
    });
  });

  describe('tool tracking', () => {
    it('should track tool start and complete with correct args', () => {
      const input = { filePath: '/test/file.ts' };
      tracker.onToolStart('parse_config', input);
      tracker.onToolComplete('parse_config', { result: 'ok' }, false);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(client.trackToolEx).toHaveBeenCalledTimes(1);
      const calls = (client.trackToolEx as ReturnType<typeof mock>).mock.calls as unknown[][];
      expect(calls[0]?.[0]).toBe('ses-test-123');
      const opts = calls[0]?.[1] as Record<string, unknown>;
      expect(opts?.tool).toBe('parse_config');
      expect(opts?.success).toBe(true);
      expect(typeof opts?.durationMs).toBe('number');
      expect(opts?.parentEventId).toBe('evt-parent');
      expect(opts?.toolInput).toEqual({ filePath: '/test/file.ts' });
      expect(opts?.toolOutput).toEqual({ result: 'ok' });
    });

    it('should handle tool complete without matching start', () => {
      tracker.onToolComplete('unknown_tool', { result: 'ok' });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(client.trackToolEx).not.toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    it('should extract error message on failed tools', () => {
      tracker.onToolStart('fail_tool');
      tracker.onToolComplete('fail_tool', { message: 'Something broke' }, true);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(client.trackToolEx).toHaveBeenCalledTimes(1);
      const calls = (client.trackToolEx as ReturnType<typeof mock>).mock.calls as unknown[][];
      const opts = calls[0]?.[1] as Record<string, unknown>;
      expect(opts?.success).toBe(false);
      expect(opts?.errorMessage).toBe('Something broke');
    });

    it('should handle multiple concurrent tools with same name (FIFO)', () => {
      tracker.onToolStart('search', { query: 'first' });
      tracker.onToolStart('search', { query: 'second' });

      tracker.onToolComplete('search', { result: 'result1' });
      const calls = (client.trackToolEx as ReturnType<typeof mock>).mock.calls as unknown[][];
      let opts = calls[0]?.[1] as Record<string, unknown>;
      expect(opts?.toolInput).toEqual({ query: 'first' });

      tracker.onToolComplete('search', { result: 'result2' });
      opts = calls[1]?.[1] as Record<string, unknown>;
      expect(opts?.toolInput).toEqual({ query: 'second' });
    });

    it('should evict oldest entry when exceeding MAX_PENDING_TOOLS', () => {
      for (let i = 0; i < 100; i++) {
        tracker.onToolStart(`tool_${i}`);
      }

      tracker.onToolStart('tool_overflow');

      tracker.onToolComplete('tool_0', { result: 'late' });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should redact secrets in tool input and output strings', () => {
      tracker.onToolStart('secret_tool', { apiKey: 'sk-ant-fake1234567890abcdef' });
      tracker.onToolComplete('secret_tool', 'Output with sk-ant-fake1234567890abcdef secret');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(client.trackToolEx).toHaveBeenCalledTimes(1);
      const calls = (client.trackToolEx as ReturnType<typeof mock>).mock.calls as unknown[][];
      const opts = calls[0]?.[1] as Record<string, unknown>;

      const toolInput = opts?.toolInput as Record<string, unknown> | undefined;
      expect(toolInput).toBeDefined();
      const apiKeyValue = toolInput?.apiKey as string | undefined;
      expect(apiKeyValue).toBeDefined();
      expect(apiKeyValue).not.toContain('sk-ant-fake1234567890abcdef');
      expect(apiKeyValue).toContain('[REDACTED');

      const toolOutput = opts?.toolOutput as string | undefined;
      expect(toolOutput).toBeDefined();
      expect(toolOutput).not.toContain('sk-ant-fake1234567890abcdef');
    });
  });

  describe('LLM usage tracking', () => {
    it('should track LLM usage with all fields', () => {
      tracker.onTurnStart();

      const data: LLMUsageData = {
        inputTokens: 1000,
        outputTokens: 500,
        cacheReadTokens: 200,
        cacheWriteTokens: 50,
        cost: 0.003,
        finishReason: 'end_turn',
      };
      tracker.onLLMUsage(data);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(client.trackLLMEx).toHaveBeenCalledTimes(1);
      const calls = (client.trackLLMEx as ReturnType<typeof mock>).mock.calls as unknown[][];
      const opts = calls[0]?.[1] as Record<string, unknown>;
      expect(opts?.model).toBe('claude-sonnet-4-20250514');
      expect(opts?.inputTokens).toBe(1000);
      expect(opts?.outputTokens).toBe(500);
      expect(opts?.cacheReadTokens).toBe(200);
      expect(opts?.cacheCreationTokens).toBe(50);
      expect(opts?.cost).toBe(0.003);
      expect(opts?.stopReason).toBe('end_turn');
      expect(opts?.provider).toBe('anthropic');
      expect(typeof opts?.latencyMs).toBe('number');
    });

    it('should track LLM usage with minimal fields (exactOptionalPropertyTypes)', () => {
      const data: LLMUsageData = {
        inputTokens: 100,
        outputTokens: 50,
      };
      tracker.onLLMUsage(data);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(client.trackLLMEx).toHaveBeenCalledTimes(1);
      const calls = (client.trackLLMEx as ReturnType<typeof mock>).mock.calls as unknown[][];
      const opts = calls[0]?.[1] as Record<string, unknown>;
      expect(opts?.model).toBe('claude-sonnet-4-20250514');
      expect(opts?.inputTokens).toBe(100);
      expect(opts?.outputTokens).toBe(50);
      expect(opts?.provider).toBe('anthropic');
      expect(opts).toBeDefined();
      expect('cacheReadTokens' in opts).toBe(false);
      expect('cacheCreationTokens' in opts).toBe(false);
      expect('cost' in opts).toBe(false);
      expect('stopReason' in opts).toBe(false);
    });
  });

  describe('turn tracking', () => {
    it('should increment turn count', () => {
      tracker.onTurnStart();
      tracker.onTurnStart();

      const debugCalls = (logger.debug as ReturnType<typeof mock>).mock.calls as unknown[][];
      expect(debugCalls[0]).toEqual(['Turn started', { turnCount: 1 }]);
      expect(debugCalls[1]).toEqual(['Turn started', { turnCount: 2 }]);
    });
  });
});
