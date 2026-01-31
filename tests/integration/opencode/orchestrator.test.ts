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

interface OrchestratorInternals {
  server: {
    start: () => Promise<void>;
    stop: () => void;
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
  streamAdapter: { adaptStream: (events: AsyncIterable<unknown>) => AsyncIterable<StreamChunk> };
}

function getInternals(o: OpencodeOrchestrator): OrchestratorInternals {
  return o as unknown as OrchestratorInternals;
}

async function collectChunks(gen: AsyncGenerator<StreamChunk>): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = [];
  for await (const chunk of gen) {
    chunks.push(chunk);
  }
  return chunks;
}

/** Create a StreamChunk with default values */
function createChunk(
  type: StreamChunk['type'],
  content: string,
  metadata?: Record<string, unknown>
): StreamChunk {
  return {
    type,
    level: 'normal' as const,
    content,
    timestamp: new Date().toISOString(),
    ...(metadata && { metadata }),
  };
}

/** Set up mocks for a successful run, initializing client and sessionManager since they start as null */
function setupMocks(
  internals: OrchestratorInternals,
  sessionId = 'ses-1',
  options?: { stopMock?: ReturnType<typeof mock> }
): void {
  internals.server.start = () => Promise.resolve();
  internals.server.stop = options?.stopMock || (() => {});
  internals.server.getUrl = () => 'http://127.0.0.1:50000';
  internals.server.getPort = () => 50000;

  internals.client = {
    connect: () => Promise.resolve(),
    prompt: () => Promise.resolve(''),
    promptAsync: () => Promise.resolve(),
    subscribe: async function* () {},
    subscribeEager: () => Promise.resolve((async function* () {})()),
  };
  internals.sessionManager = {
    startSession: () => Promise.resolve({ sessionId }),
    clearSession: () => {},
    clearAll: () => {},
  };
}

describe('OpencodeOrchestrator integration', () => {
  let registry: IToolRegistry;

  beforeEach(() => {
    registry = createMockToolRegistry();
  });

  it('should complete full lifecycle: start → connect → session → stream → cleanup', async () => {
    const orchestrator = new OpencodeOrchestrator({}, registry);
    const internals = getInternals(orchestrator);

    const stopMock = mock(() => {});
    setupMocks(internals, 'ses-integ-1', { stopMock });

    internals.streamAdapter.adaptStream = async function* () {
      yield createChunk('text', 'Analysis beginning');
      yield {
        ...createChunk('tool_start', 'Calling tool: discover_configs'),
        level: 'verbose' as const,
        metadata: { name: 'discover_configs' },
      };
      yield {
        ...createChunk('tool_result', 'Tool completed: discover_configs'),
        level: 'verbose' as const,
        metadata: { name: 'discover_configs', output: { configs: 3 } },
      };
      yield createChunk('text', 'Analysis complete');
    };

    expect(orchestrator.isActive).toBe(false);
    const chunks = await collectChunks(orchestrator.run('Analyze my configs'));
    expect(orchestrator.isActive).toBe(false);

    // Verify streamed chunks
    expect(chunks[0]?.type).toBe('text');
    expect(chunks[0]?.content).toBe('Analysis beginning');
    expect(chunks[1]?.type).toBe('tool_start');
    expect(chunks[2]?.type).toBe('tool_result');
    expect(chunks[3]?.type).toBe('text');
    expect(chunks[3]?.content).toBe('Analysis complete');

    expect(chunks.length).toBe(4);
    // Server is NOT stopped after successful run - it persists for subsequent runs
    expect(stopMock).toHaveBeenCalledTimes(0);
  });

  it('should set session state during run', async () => {
    const orchestrator = new OpencodeOrchestrator({}, registry);
    const internals = getInternals(orchestrator);

    setupMocks(internals, 'ses-state-1');
    internals.streamAdapter.adaptStream = async function* () {};

    expect(orchestrator.sessionState).toBeNull();
    await collectChunks(orchestrator.run('test'));
    expect(orchestrator.sessionState).not.toBeNull();
    expect(orchestrator.sessionState?.id).toBe('ses-state-1');
  });

  it('should clean up on error during streaming', async () => {
    const orchestrator = new OpencodeOrchestrator({}, registry);
    const internals = getInternals(orchestrator);

    const stopMock = mock(() => {});
    setupMocks(internals, 'ses-err-1', { stopMock });

    internals.streamAdapter.adaptStream = async function* () {
      yield createChunk('text', 'start');
      throw new Error('Stream interrupted');
    };

    await expect(collectChunks(orchestrator.run('test'))).rejects.toThrow('Stream interrupted');
    expect(orchestrator.isActive).toBe(false);
    // Server is NOT stopped on error - it persists for subsequent runs
    expect(stopMock).toHaveBeenCalledTimes(0);
  });

  it('should handle interrupt during active run', async () => {
    const orchestrator = new OpencodeOrchestrator({}, registry);
    const internals = getInternals(orchestrator);

    setupMocks(internals, 'ses-int-1');

    // Create a stream that yields one chunk then waits forever
    let resolveWait: (() => void) | undefined;
    internals.streamAdapter.adaptStream = async function* () {
      yield createChunk('text', 'started');
      await new Promise<void>((resolve) => {
        resolveWait = resolve;
      });
    };

    const gen = orchestrator.run('test');
    const first = await gen.next(); // First yielded chunk: "started"
    expect(first.value?.content).toBe('started');

    expect(orchestrator.isActive).toBe(true);
    await orchestrator.interrupt();
    expect(orchestrator.isActive).toBe(false);

    // Clean up the hanging promise
    if (resolveWait) resolveWait();
  });
});
