import { describe, expect, it, mock, beforeEach } from 'bun:test';
import { OpencodeOrchestrator } from '../../../src/opencode/orchestrator';
import type { IToolRegistry } from '../../../src/orchestration/tool-registry';
import type { StreamChunk } from '../../../src/orchestration/types';

function createMockToolRegistry(): IToolRegistry {
  return {
    register: mock(() => {}),
    get: mock(() => undefined),
    getAll: mock(() => []),
    has: mock(() => false),
    remove: mock(() => false),
    clear: mock(() => {}),
    count: 0,
    toSDKTools: mock(() => []),
  } as unknown as IToolRegistry;
}

async function collectChunks(gen: AsyncGenerator<StreamChunk>): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = [];
  for await (const chunk of gen) {
    chunks.push(chunk);
  }
  return chunks;
}

/** Centralises `as unknown as` casts — a private field rename only breaks this one spot. */
interface OrchestratorInternals {
  server: {
    start: () => Promise<void>;
    stop: () => void;
  };
  client: {
    connect: () => Promise<void>;
    prompt: () => Promise<string>;
    subscribe: () => AsyncIterable<unknown>;
  };
  sessionManager: {
    startSession: (task: string) => Promise<{ sessionId: string }>;
  };
  streamAdapter: {
    adaptStream: (events: AsyncIterable<unknown>) => AsyncIterable<StreamChunk>;
  };
  telemetryTracker: unknown;
}

function getInternals(orchestrator: OpencodeOrchestrator): OrchestratorInternals {
  return orchestrator as unknown as OrchestratorInternals;
}

function setupSuccessfulRun(internals: OrchestratorInternals): {
  stopMock: ReturnType<typeof mock>;
} {
  const stopMock = mock(() => {});
  internals.server.start = () => Promise.resolve();
  internals.server.stop = stopMock;
  internals.client.connect = () => Promise.resolve();
  internals.client.prompt = () => Promise.resolve('');
  internals.client.subscribe = async function* () {};
  internals.sessionManager.startSession = () => Promise.resolve({ sessionId: 'ses-1' });
  return { stopMock };
}

describe('OpencodeOrchestrator', () => {
  let registry: IToolRegistry;

  beforeEach(() => {
    registry = createMockToolRegistry();
  });

  describe('run', () => {
    it('should set isActive to false after server.start() throws', async () => {
      const orchestrator = new OpencodeOrchestrator({}, registry);
      const internals = getInternals(orchestrator);

      internals.server.start = () => Promise.reject(new TypeError('Cannot start server'));
      internals.server.stop = mock(() => {});

      await expect(collectChunks(orchestrator.run('test task'))).rejects.toThrow(
        'Cannot start server'
      );
      expect(orchestrator.isActive).toBe(false);
    });

    it('should call server.stop() in finally block on error', async () => {
      const orchestrator = new OpencodeOrchestrator({}, registry);
      const internals = getInternals(orchestrator);

      const stopMock = mock(() => {});
      internals.server.start = () => Promise.reject(new TypeError('fail'));
      internals.server.stop = stopMock;

      await expect(collectChunks(orchestrator.run('test'))).rejects.toThrow();
      expect(stopMock).toHaveBeenCalledTimes(1);
    });

    it('should not throw if server.stop() fails during cleanup', async () => {
      const orchestrator = new OpencodeOrchestrator({}, registry);
      const internals = getInternals(orchestrator);

      internals.server.start = () => Promise.reject(new TypeError('fail'));
      internals.server.stop = () => {
        throw new Error('stop failed');
      };

      await expect(collectChunks(orchestrator.run('test'))).rejects.toThrow('fail');
      expect(orchestrator.isActive).toBe(false);
    });

    it('should set isActive to false after successful run', async () => {
      const orchestrator = new OpencodeOrchestrator({}, registry);
      const internals = getInternals(orchestrator);
      setupSuccessfulRun(internals);

      const chunks = await collectChunks(orchestrator.run('test'));

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks[0]?.content).toBe('Server started');
      expect(orchestrator.isActive).toBe(false);
    });
  });

  describe('telemetry', () => {
    it('should create TelemetryTracker when telemetry client is provided', () => {
      const telemetryClient = {
        isEnabled: () => true,
        trackToolEx: mock(() => {}),
        trackLLMEx: mock(() => {}),
      };

      const orchestrator = new OpencodeOrchestrator(
        { telemetryClient, telemetrySessionId: 'ses-test' },
        registry
      );

      expect(getInternals(orchestrator).telemetryTracker).not.toBeNull();
    });

    it('should not create TelemetryTracker when telemetry client is not provided', () => {
      const orchestrator = new OpencodeOrchestrator({}, registry);
      expect(getInternals(orchestrator).telemetryTracker).toBeNull();
    });

    it('should not create TelemetryTracker when telemetry client is disabled', () => {
      const telemetryClient = {
        isEnabled: () => false,
        trackToolEx: mock(() => {}),
        trackLLMEx: mock(() => {}),
      };

      const orchestrator = new OpencodeOrchestrator({ telemetryClient }, registry);
      expect(getInternals(orchestrator).telemetryTracker).toBeNull();
    });

    it('should forward tool events to tracker during run', async () => {
      const trackToolEx = mock(() => {});
      const telemetryClient = {
        isEnabled: () => true,
        trackToolEx,
        trackLLMEx: mock(() => {}),
      };

      const orchestrator = new OpencodeOrchestrator(
        { telemetryClient, telemetrySessionId: 'ses-test' },
        registry
      );

      const internals = getInternals(orchestrator);
      setupSuccessfulRun(internals);

      internals.streamAdapter.adaptStream = async function* () {
        yield {
          type: 'tool_start' as const,
          level: 'verbose' as const,
          content: 'Calling tool: test_tool',
          timestamp: new Date().toISOString(),
          metadata: { name: 'test_tool', input: { key: 'value' } },
        };
        yield {
          type: 'tool_result' as const,
          level: 'verbose' as const,
          content: 'Tool completed: test_tool',
          timestamp: new Date().toISOString(),
          metadata: { name: 'test_tool', output: { result: 'ok' } },
        };
      };

      const chunks = await collectChunks(orchestrator.run('test'));

      expect(chunks.length).toBeGreaterThanOrEqual(2);
      expect(trackToolEx).toHaveBeenCalledTimes(1);

      const calls = trackToolEx.mock.calls as unknown[][];
      expect(calls.length).toBeGreaterThan(0);
      const opts = calls[0]?.[1] as Record<string, unknown>;
      expect(opts.tool).toBe('test_tool');
      expect(opts.success).toBe(true);
    });
  });
});
