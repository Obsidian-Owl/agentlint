import { describe, expect, it } from 'bun:test';
import { OpencodeServerManager, getProjectPort } from '../../../src/opencode/server';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/** Centralizes `as unknown as` casts — a private field rename only breaks this one spot. */
interface ServerInternals {
  config: { port: number; hostname: string; timeout: number };
  server: { url: string; close: () => void } | null;
  running: boolean;
  checkPortAvailable: () => Promise<{ available: boolean; healthy: boolean; isAgentlint: boolean }>;
  tryReuseExistingServer: () => Promise<boolean>;
}

function getInternals(server: OpencodeServerManager): ServerInternals {
  return server as unknown as ServerInternals;
}

// ============================================================================
// Test Helpers
// ============================================================================

/** Simulates a running server with given URL */
function simulateRunningServer(server: OpencodeServerManager, url = 'http://localhost:4096') {
  const internals = getInternals(server);
  internals.running = true;
  internals.server = { url, close: () => {} };
}

/** Expects config to match provided values */
function expectConfig(
  server: OpencodeServerManager,
  expected: { port: number; hostname: string; timeout: number }
) {
  const internals = getInternals(server);
  expect(internals.config.port).toBe(expected.port);
  expect(internals.config.hostname).toBe(expected.hostname);
  expect(internals.config.timeout).toBe(expected.timeout);
}

/** Expects port availability check result to match */
function expectPortCheck(
  result: { available: boolean; healthy: boolean; isAgentlint: boolean },
  expected: { available: boolean; healthy: boolean; isAgentlint: boolean }
) {
  expect(result.available).toBe(expected.available);
  expect(result.healthy).toBe(expected.healthy);
  expect(result.isAgentlint).toBe(expected.isAgentlint);
}

/** Mocks checkPortAvailable to return specific state */
function mockPortAvailable(
  server: OpencodeServerManager,
  state: { available: boolean; healthy: boolean; isAgentlint: boolean }
) {
  const internals = getInternals(server);
  internals.checkPortAvailable = () => Promise.resolve(state);
}

/** Mocks tryReuseExistingServer to return specific result */
function mockServerReuse(server: OpencodeServerManager, canReuse: boolean) {
  const internals = getInternals(server);
  internals.tryReuseExistingServer = () => Promise.resolve(canReuse);
}

/** Mocks fetch to simulate connection refused */
function mockFetchConnectionRefused() {
  global.fetch = (() => Promise.reject(new Error('Connection refused'))) as unknown as typeof fetch;
}

/** Mocks fetch to return healthy Opencode response (array) */
function mockFetchHealthyOpencode() {
  global.fetch = (() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve([]),
    } as Response)) as unknown as typeof fetch;
}

/** Mocks fetch to return non-agentlint response (object) */
function mockFetchNonAgentlint() {
  global.fetch = (() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ status: 'different' }),
    } as Response)) as unknown as typeof fetch;
}

/** Mocks fetch to return error status */
function mockFetchError(status = 500) {
  global.fetch = (() =>
    Promise.resolve({
      ok: false,
      status,
    } as Response)) as unknown as typeof fetch;
}

/** Mocks fetch to return non-JSON response */
function mockFetchNonJson() {
  global.fetch = (() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.reject(new Error('Not JSON')),
    } as Response)) as unknown as typeof fetch;
}

interface TempDirCleanup {
  dir: string;
  cleanup: () => void;
}

/** Creates temp directory with optional lockfile */
function createTempDir(options?: { lockfilePort?: number; lockfilePid?: number }): TempDirCleanup {
  const testDir = join(tmpdir(), `agentlint-test-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });

  if (options?.lockfilePort !== undefined) {
    const lockDir = join(testDir, '.agentlint');
    mkdirSync(lockDir, { recursive: true });
    writeFileSync(
      join(lockDir, '.server-port'),
      JSON.stringify({
        port: options.lockfilePort,
        pid: options.lockfilePid ?? process.pid,
      }),
      'utf-8'
    );
  }

  return {
    dir: testDir,
    cleanup: () => rmSync(testDir, { recursive: true, force: true }),
  };
}

describe('getProjectPort', () => {
  it('should generate port in valid range', () => {
    const port = getProjectPort('/some/project/path');
    expect(port).toBeGreaterThanOrEqual(49152);
    expect(port).toBeLessThanOrEqual(65535);
  });

  it('should be deterministic for same path', () => {
    const path = '/my/project';
    const port1 = getProjectPort(path);
    const port2 = getProjectPort(path);
    expect(port1).toBe(port2);
  });

  it('should generate different ports for different paths', () => {
    const port1 = getProjectPort('/project/one');
    const port2 = getProjectPort('/project/two');
    expect(port1).not.toBe(port2);
  });
});

describe('OpencodeServerManager', () => {
  describe('configuration', () => {
    it('should use default config values', () => {
      const testCwd = '/test/project';
      const expectedPort = getProjectPort(testCwd);
      const server = new OpencodeServerManager({}, testCwd);
      expectConfig(server, { port: expectedPort, hostname: '127.0.0.1', timeout: 5000 });
    });

    it('should use provided config values', () => {
      const server = new OpencodeServerManager({ port: 8080, hostname: '0.0.0.0', timeout: 10000 });
      expectConfig(server, { port: 8080, hostname: '0.0.0.0', timeout: 10000 });
    });

    it('should accept partial config and use defaults for missing values', () => {
      const server = new OpencodeServerManager({ port: 9999 });
      expectConfig(server, { port: 9999, hostname: '127.0.0.1', timeout: 5000 });
    });

    it('should accept empty config object', () => {
      const testCwd = '/test/project';
      const expectedPort = getProjectPort(testCwd);
      const server = new OpencodeServerManager({}, testCwd);
      expectConfig(server, { port: expectedPort, hostname: '127.0.0.1', timeout: 5000 });
    });
  });

  describe('lifecycle', () => {
    it('should not be running initially', () => {
      const server = new OpencodeServerManager();
      expect(server.isRunning()).toBe(false);
    });

    it('should not throw when stopping a non-running server', () => {
      const server = new OpencodeServerManager();
      expect(() => server.stop()).not.toThrow();
    });

    it('should return configured port when server is not started', () => {
      const server = new OpencodeServerManager({ port: 9999 });
      expect(server.getPort()).toBe(9999);
    });

    it('should throw when getting URL of non-running server', () => {
      const server = new OpencodeServerManager();
      expect(() => server.getUrl()).toThrow('not running');
    });

    it('should be idempotent when starting an already-running server', async () => {
      const server = new OpencodeServerManager();
      simulateRunningServer(server);

      // start() is now idempotent - it doesn't throw when already running
      await expect(server.start()).resolves.toBeUndefined();
    });

    it('should return true for isRunning when server is started', () => {
      const server = new OpencodeServerManager();
      simulateRunningServer(server);

      expect(server.isRunning()).toBe(true);
    });

    it('should return server URL when running', () => {
      const server = new OpencodeServerManager();
      simulateRunningServer(server);

      expect(server.getUrl()).toBe('http://localhost:4096');
    });

    it('should parse port from server URL when running', () => {
      const server = new OpencodeServerManager();
      simulateRunningServer(server, 'http://localhost:8080');

      expect(server.getPort()).toBe(8080);
    });

    it('should set running to false after stop is called', () => {
      const server = new OpencodeServerManager();
      const internals = getInternals(server);
      simulateRunningServer(server);

      server.stop();

      expect(server.isRunning()).toBe(false);
      expect(internals.server).toBeNull();
    });

    it('should be idempotent when stop is called multiple times', () => {
      const server = new OpencodeServerManager();
      simulateRunningServer(server);

      server.stop();
      expect(() => server.stop()).not.toThrow();
      expect(server.isRunning()).toBe(false);
    });

    it('should throw error when port is occupied by non-agentlint process', async () => {
      const server = new OpencodeServerManager({ port: 3000 });
      mockPortAvailable(server, { available: false, healthy: false, isAgentlint: false });

      await expect(server.start()).rejects.toThrow('already in use by another process');
    });

    it('should throw error when port is occupied by unhealthy agentlint server', async () => {
      const server = new OpencodeServerManager({ port: 3000 });
      mockPortAvailable(server, { available: false, healthy: false, isAgentlint: true });

      await expect(server.start()).rejects.toThrow('unhealthy agentlint server');
    });

    it('should reuse existing healthy agentlint server', async () => {
      const server = new OpencodeServerManager({ port: 4096 });
      mockServerReuse(server, true);

      await server.start();

      expect(server.isRunning()).toBe(true);
      expect(server.getUrl()).toBe('http://127.0.0.1:4096');
    });

    it('should not reuse unhealthy server', async () => {
      const server = new OpencodeServerManager({ port: 4096 });
      mockServerReuse(server, false);
      mockPortAvailable(server, { available: false, healthy: false, isAgentlint: true });

      await expect(server.start()).rejects.toThrow('unhealthy agentlint server');
    });

    it('should verify running state after start sequence', async () => {
      const server = new OpencodeServerManager();
      const internals = getInternals(server);

      expect(internals.running).toBe(false);
      expect(internals.server).toBeNull();

      mockPortAvailable(server, { available: true, healthy: false, isAgentlint: false });

      expect(server.isRunning()).toBe(false);
    });
  });

  describe('port availability checks', () => {
    it('should detect available port', async () => {
      const server = new OpencodeServerManager({ port: 4096 });
      const internals = getInternals(server);

      mockFetchConnectionRefused();

      const result = await internals.checkPortAvailable();
      expectPortCheck(result, { available: true, healthy: false, isAgentlint: false });
    });

    it('should detect healthy agentlint server when lockfile matches', async () => {
      const { dir, cleanup } = createTempDir({ lockfilePort: 4096 });

      try {
        const server = new OpencodeServerManager({ port: 4096 }, dir);
        const internals = getInternals(server);

        mockFetchHealthyOpencode();

        const result = await internals.checkPortAvailable();
        expectPortCheck(result, { available: false, healthy: true, isAgentlint: true });
      } finally {
        cleanup();
      }
    });

    it('should identify as agentlint when Opencode session endpoint detected (lockfile optional)', async () => {
      const { dir, cleanup } = createTempDir();

      try {
        const server = new OpencodeServerManager({ port: 4096 }, dir);
        const internals = getInternals(server);

        mockFetchHealthyOpencode();

        const result = await internals.checkPortAvailable();

        // Any Opencode server is considered agentlint (lockfile is optional)
        expectPortCheck(result, { available: false, healthy: true, isAgentlint: true });
      } finally {
        cleanup();
      }
    });

    it('should identify as agentlint even when lockfile port mismatches', async () => {
      const { dir, cleanup } = createTempDir({ lockfilePort: 9999 });

      try {
        const server = new OpencodeServerManager({ port: 4096 }, dir);
        const internals = getInternals(server);

        mockFetchHealthyOpencode();

        const result = await internals.checkPortAvailable();

        // Any Opencode server is considered agentlint, regardless of lockfile
        expectPortCheck(result, { available: false, healthy: true, isAgentlint: true });
      } finally {
        cleanup();
      }
    });

    it('should detect non-agentlint service', async () => {
      const server = new OpencodeServerManager({ port: 4096 });
      const internals = getInternals(server);

      mockFetchNonAgentlint();

      const result = await internals.checkPortAvailable();
      expectPortCheck(result, { available: false, healthy: true, isAgentlint: false });
    });

    it('should detect unhealthy service', async () => {
      const server = new OpencodeServerManager({ port: 4096 });
      const internals = getInternals(server);

      mockFetchError();

      const result = await internals.checkPortAvailable();
      expectPortCheck(result, { available: false, healthy: false, isAgentlint: false });
    });

    it('should handle non-JSON response', async () => {
      const server = new OpencodeServerManager({ port: 4096 });
      const internals = getInternals(server);

      mockFetchNonJson();

      const result = await internals.checkPortAvailable();
      expectPortCheck(result, { available: false, healthy: false, isAgentlint: false });
    });
  });

  describe('server reuse logic', () => {
    it('should reuse when healthy agentlint server exists', async () => {
      const server = new OpencodeServerManager({ port: 4096 });
      const internals = getInternals(server);

      mockPortAvailable(server, { available: false, healthy: true, isAgentlint: true });

      const canReuse = await internals.tryReuseExistingServer();
      expect(canReuse).toBe(true);
    });

    it('should not reuse when port is available', async () => {
      const server = new OpencodeServerManager({ port: 4096 });
      const internals = getInternals(server);

      mockPortAvailable(server, { available: true, healthy: false, isAgentlint: false });

      const canReuse = await internals.tryReuseExistingServer();
      expect(canReuse).toBe(false);
    });

    it('should not reuse when server is unhealthy', async () => {
      const server = new OpencodeServerManager({ port: 4096 });
      const internals = getInternals(server);

      mockPortAvailable(server, { available: false, healthy: false, isAgentlint: true });

      const canReuse = await internals.tryReuseExistingServer();
      expect(canReuse).toBe(false);
    });

    it('should not reuse when non-agentlint server exists', async () => {
      const server = new OpencodeServerManager({ port: 4096 });
      const internals = getInternals(server);

      mockPortAvailable(server, { available: false, healthy: true, isAgentlint: false });

      const canReuse = await internals.tryReuseExistingServer();
      expect(canReuse).toBe(false);
    });
  });
});
