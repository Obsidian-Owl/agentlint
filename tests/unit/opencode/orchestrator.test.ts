import { describe, expect, it, mock, beforeEach } from 'bun:test';
import { OpencodeOrchestrator } from '../../../src/opencode/orchestrator';
import type { IToolRegistry } from '../../../src/orchestration/tool-registry';
import type { StreamChunk } from '../../../src/orchestration/types';
import { SessionResumeError, OrchestrationError } from '../../../src/errors/orchestration';

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
    isRunning: () => boolean;
    getUrl: () => string;
    getPort: () => number;
  };
  client: {
    connect: () => Promise<void>;
    prompt: () => Promise<string>;
    promptAsync: () => Promise<void>;
    subscribe: () => AsyncIterable<unknown>;
    subscribeEager: () => Promise<AsyncIterable<unknown>>;
  } | null;
  sessionManager: {
    startSession: (task: string) => Promise<{ sessionId: string }>;
    clearSession: (sessionId: string) => void;
    clearAll: () => void;
  } | null;
  streamAdapter: {
    adaptStream: (events: AsyncIterable<unknown>) => AsyncIterable<StreamChunk>;
  };
  telemetryTracker: unknown;
  _isActive: boolean;
  _sessionState: unknown;
  _currentSessionId: string | null;
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
  internals.server.getUrl = () => 'http://127.0.0.1:50000';
  internals.server.getPort = () => 50000;

  // Client and sessionManager are lazily initialized after server.start()
  // We pre-initialize them for tests since we're mocking
  internals.client = {
    connect: () => Promise.resolve(),
    prompt: () => Promise.resolve(''),
    promptAsync: () => Promise.resolve(),
    subscribe: async function* () {},
    subscribeEager: () => Promise.resolve((async function* () {})()),
  };
  internals.sessionManager = {
    startSession: () => Promise.resolve({ sessionId: 'ses-1' }),
    clearSession: () => {},
    clearAll: () => {},
  };
  return { stopMock };
}

function createMockSessionManager(
  clearAllMock = mock(() => {})
): OrchestratorInternals['sessionManager'] {
  return {
    startSession: () => Promise.resolve({ sessionId: 'ses-1' }),
    clearSession: () => {},
    clearAll: clearAllMock,
  };
}

function createMockTelemetryClient(enabled = true) {
  return {
    isEnabled: () => enabled,
    trackToolEx: mock(() => {}),
    trackLLMEx: mock(() => {}),
  };
}

function setupServerFailure(
  internals: OrchestratorInternals,
  error: Error
): ReturnType<typeof mock> {
  const stopMock = mock(() => {});
  internals.server.start = () => Promise.reject(error);
  internals.server.stop = stopMock;
  return stopMock;
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

      setupServerFailure(internals, new TypeError('Cannot start server'));

      await expect(collectChunks(orchestrator.run('test task'))).rejects.toThrow(
        'Cannot start server'
      );
      expect(orchestrator.isActive).toBe(false);
    });

    it('should not call server.stop() in finally block on error (server persists)', async () => {
      const orchestrator = new OpencodeOrchestrator({}, registry);
      const internals = getInternals(orchestrator);

      const stopMock = setupServerFailure(internals, new TypeError('fail'));

      await expect(collectChunks(orchestrator.run('test'))).rejects.toThrow();
      // Server is NOT stopped in finally block - it persists for subsequent runs
      expect(stopMock).toHaveBeenCalledTimes(0);
    });

    it('should not throw if server.stop() fails during cleanup', async () => {
      const orchestrator = new OpencodeOrchestrator({}, registry);
      const internals = getInternals(orchestrator);

      setupServerFailure(internals, new TypeError('fail'));
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

      await collectChunks(orchestrator.run('test'));

      // Server started chunk was removed - verify run completes successfully
      expect(orchestrator.isActive).toBe(false);
    });

    it('should throw OrchestrationError when run() called while already active', async () => {
      const orchestrator = new OpencodeOrchestrator({}, registry);
      const internals = getInternals(orchestrator);
      setupSuccessfulRun(internals);

      internals.streamAdapter.adaptStream = async function* () {
        yield {
          type: 'text' as const,
          level: 'normal' as const,
          content: 'First chunk',
          timestamp: new Date().toISOString(),
        };
        await new Promise(() => {});
      };

      const gen = orchestrator.run('first task');
      const firstChunk = await gen.next();
      expect(firstChunk.done).toBe(false);
      expect(orchestrator.isActive).toBe(true);

      const secondGen = orchestrator.run('second task');
      await expect(secondGen.next()).rejects.toThrow(OrchestrationError);

      await gen.return();
      expect(orchestrator.isActive).toBe(false);
    });
  });

  describe('telemetry', () => {
    it('should create TelemetryTracker when telemetry client is provided', () => {
      const telemetryClient = createMockTelemetryClient();

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
      const telemetryClient = createMockTelemetryClient(false);

      const orchestrator = new OpencodeOrchestrator({ telemetryClient }, registry);
      expect(getInternals(orchestrator).telemetryTracker).toBeNull();
    });

    it('should forward tool events to tracker during run', async () => {
      const telemetryClient = createMockTelemetryClient();

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
      expect(telemetryClient.trackToolEx).toHaveBeenCalledTimes(1);

      const calls = telemetryClient.trackToolEx.mock.calls as unknown[][];
      expect(calls.length).toBeGreaterThan(0);
      const opts = calls[0]?.[1] as Record<string, unknown>;
      expect(opts.tool).toBe('test_tool');
      expect(opts.success).toBe(true);
    });
  });

  describe('contract methods', () => {
    it('should set isActive to false on interrupt', async () => {
      const orchestrator = new OpencodeOrchestrator({}, registry);
      const internals = getInternals(orchestrator);
      setupSuccessfulRun(internals);

      // Inject a chunk to ensure the stream isn't immediately empty
      internals.streamAdapter.adaptStream = async function* () {
        yield {
          type: 'text' as const,
          level: 'normal' as const,
          content: 'Processing',
          timestamp: new Date().toISOString(),
        };
        await new Promise(() => {});
      };

      // Start a run to set isActive = true
      const gen = orchestrator.run('test');
      await gen.next(); // consume first chunk
      expect(orchestrator.isActive).toBe(true);

      await orchestrator.interrupt();
      expect(orchestrator.isActive).toBe(false);
    });

    it('should throw SessionResumeError on resume with session ID', async () => {
      const orchestrator = new OpencodeOrchestrator({}, registry);
      const gen = orchestrator.resume('ses-resume-123');

      await expect(gen.next()).rejects.toThrow(SessionResumeError);
    });

    it('should throw OrchestrationError on getSubagentConfig', () => {
      const orchestrator = new OpencodeOrchestrator({}, registry);
      expect(() => orchestrator.getSubagentConfig()).toThrow(OrchestrationError);
    });

    it('should call sessionManager.clearAll() on interrupt', async () => {
      const orchestrator = new OpencodeOrchestrator({}, registry);
      const internals = getInternals(orchestrator);
      const clearAllMock = mock(() => {});
      internals.sessionManager = createMockSessionManager(clearAllMock);

      await orchestrator.interrupt();

      expect(clearAllMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('dispose', () => {
    it('should clear all sessions', () => {
      const orchestrator = new OpencodeOrchestrator({}, registry);
      const internals = getInternals(orchestrator);
      const clearAllMock = mock(() => {});
      internals.sessionManager = createMockSessionManager(clearAllMock);
      internals.server.isRunning = () => false;

      orchestrator.dispose();

      expect(clearAllMock).toHaveBeenCalledTimes(1);
    });

    it('should stop server if running', () => {
      const orchestrator = new OpencodeOrchestrator({}, registry);
      const internals = getInternals(orchestrator);
      const stopMock = mock(() => {});
      internals.sessionManager = createMockSessionManager();
      internals.server.isRunning = () => true;
      internals.server.stop = stopMock;

      orchestrator.dispose();

      expect(stopMock).toHaveBeenCalledTimes(1);
    });

    it('should not stop server if not running', () => {
      const orchestrator = new OpencodeOrchestrator({}, registry);
      const internals = getInternals(orchestrator);
      const stopMock = mock(() => {});
      internals.sessionManager = createMockSessionManager();
      internals.server.isRunning = () => false;
      internals.server.stop = stopMock;

      orchestrator.dispose();

      expect(stopMock).not.toHaveBeenCalled();
    });

    it('should reset state', () => {
      const orchestrator = new OpencodeOrchestrator({}, registry);
      const internals = getInternals(orchestrator);
      internals.sessionManager = createMockSessionManager();
      internals.server.isRunning = () => false;
      internals._isActive = true;
      internals._sessionState = { id: 'test' };
      internals._currentSessionId = 'ses-123';

      orchestrator.dispose();

      expect(orchestrator.isActive).toBe(false);
      expect(orchestrator.sessionState).toBeNull();
      expect(internals._currentSessionId).toBeNull();
    });

    it('should be idempotent (safe to call multiple times)', () => {
      const orchestrator = new OpencodeOrchestrator({}, registry);
      const internals = getInternals(orchestrator);
      const clearAllMock = mock(() => {});
      internals.sessionManager = createMockSessionManager(clearAllMock);
      internals.server.isRunning = () => false;

      orchestrator.dispose();
      orchestrator.dispose();
      orchestrator.dispose();

      expect(clearAllMock).toHaveBeenCalledTimes(3);
    });

    it('should not throw if server.stop() fails', () => {
      const orchestrator = new OpencodeOrchestrator({}, registry);
      const internals = getInternals(orchestrator);
      internals.sessionManager = createMockSessionManager();
      internals.server.isRunning = () => true;
      internals.server.stop = () => {
        throw new Error('stop failed');
      };

      expect(() => orchestrator.dispose()).not.toThrow();
    });
  });
});
