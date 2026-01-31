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
      const internals = getInternals(server);
      expect(internals.config.port).toBe(expectedPort);
      expect(internals.config.hostname).toBe('127.0.0.1');
      expect(internals.config.timeout).toBe(5000);
    });

    it('should use provided config values', () => {
      const server = new OpencodeServerManager({ port: 8080, hostname: '0.0.0.0', timeout: 10000 });
      const internals = getInternals(server);
      expect(internals.config.port).toBe(8080);
      expect(internals.config.hostname).toBe('0.0.0.0');
      expect(internals.config.timeout).toBe(10000);
    });

    it('should accept partial config and use defaults for missing values', () => {
      const server = new OpencodeServerManager({ port: 9999 });
      const internals = getInternals(server);
      expect(internals.config.port).toBe(9999);
      expect(internals.config.hostname).toBe('127.0.0.1');
      expect(internals.config.timeout).toBe(5000);
    });

    it('should accept empty config object', () => {
      const testCwd = '/test/project';
      const expectedPort = getProjectPort(testCwd);
      const server = new OpencodeServerManager({}, testCwd);
      const internals = getInternals(server);
      expect(internals.config.port).toBe(expectedPort);
      expect(internals.config.hostname).toBe('127.0.0.1');
      expect(internals.config.timeout).toBe(5000);
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
      const internals = getInternals(server);

      // Simulate server already running
      internals.running = true;
      internals.server = { url: 'http://localhost:4096', close: () => {} };

      // start() is now idempotent - it doesn't throw when already running
      await expect(server.start()).resolves.toBeUndefined();
    });

    it('should return true for isRunning when server is started', () => {
      const server = new OpencodeServerManager();
      const internals = getInternals(server);

      // Simulate server started
      internals.running = true;
      internals.server = { url: 'http://localhost:4096', close: () => {} };

      expect(server.isRunning()).toBe(true);
    });

    it('should return server URL when running', () => {
      const server = new OpencodeServerManager();
      const internals = getInternals(server);

      // Simulate server started
      internals.running = true;
      internals.server = { url: 'http://localhost:4096', close: () => {} };

      expect(server.getUrl()).toBe('http://localhost:4096');
    });

    it('should parse port from server URL when running', () => {
      const server = new OpencodeServerManager();
      const internals = getInternals(server);

      // Simulate server started with custom port
      internals.running = true;
      internals.server = { url: 'http://localhost:8080', close: () => {} };

      expect(server.getPort()).toBe(8080);
    });

    it('should set running to false after stop is called', () => {
      const server = new OpencodeServerManager();
      const internals = getInternals(server);

      // Simulate server started
      internals.running = true;
      internals.server = { url: 'http://localhost:4096', close: () => {} };

      server.stop();

      expect(server.isRunning()).toBe(false);
      expect(internals.server).toBeNull();
    });

    it('should be idempotent when stop is called multiple times', () => {
      const server = new OpencodeServerManager();
      const internals = getInternals(server);

      // Simulate server started
      internals.running = true;
      internals.server = { url: 'http://localhost:4096', close: () => {} };

      server.stop();
      expect(() => server.stop()).not.toThrow();
      expect(server.isRunning()).toBe(false);
    });

    it('should throw error when port is occupied by non-agentlint process', async () => {
      const server = new OpencodeServerManager({ port: 3000 });
      const internals = getInternals(server);

      internals.checkPortAvailable = () =>
        Promise.resolve({ available: false, healthy: false, isAgentlint: false });

      await expect(server.start()).rejects.toThrow('already in use by another process');
    });

    it('should throw error when port is occupied by unhealthy agentlint server', async () => {
      const server = new OpencodeServerManager({ port: 3000 });
      const internals = getInternals(server);

      internals.checkPortAvailable = () =>
        Promise.resolve({ available: false, healthy: false, isAgentlint: true });

      await expect(server.start()).rejects.toThrow('unhealthy agentlint server');
    });

    it('should reuse existing healthy agentlint server', async () => {
      const server = new OpencodeServerManager({ port: 4096 });
      const internals = getInternals(server);

      // Mock tryReuseExistingServer to return true
      internals.tryReuseExistingServer = () => Promise.resolve(true);

      await server.start();

      expect(server.isRunning()).toBe(true);
      expect(server.getUrl()).toBe('http://127.0.0.1:4096');
    });

    it('should not reuse unhealthy server', async () => {
      const server = new OpencodeServerManager({ port: 4096 });
      const internals = getInternals(server);

      // Mock to simulate unhealthy server on port
      internals.tryReuseExistingServer = () => Promise.resolve(false);
      internals.checkPortAvailable = () =>
        Promise.resolve({ available: false, healthy: false, isAgentlint: true });

      await expect(server.start()).rejects.toThrow('unhealthy agentlint server');
    });

    it('should verify running state after start sequence', async () => {
      const server = new OpencodeServerManager();
      const internals = getInternals(server);

      expect(internals.running).toBe(false);
      expect(internals.server).toBeNull();

      internals.checkPortAvailable = () =>
        Promise.resolve({ available: true, healthy: false, isAgentlint: false });

      expect(server.isRunning()).toBe(false);
    });
  });

  describe('port availability checks', () => {
    it('should detect available port', async () => {
      const server = new OpencodeServerManager({ port: 4096 });
      const internals = getInternals(server);

      // Mock fetch to throw (connection refused)
      global.fetch = (() =>
        Promise.reject(new Error('Connection refused'))) as unknown as typeof fetch;

      const result = await internals.checkPortAvailable();

      expect(result.available).toBe(true);
      expect(result.healthy).toBe(false);
      expect(result.isAgentlint).toBe(false);
    });

    it('should detect healthy agentlint server when lockfile matches', async () => {
      // Create a temp directory with a lockfile
      const testDir = join(tmpdir(), `agentlint-test-${Date.now()}`);
      const lockDir = join(testDir, '.agentlint');
      mkdirSync(lockDir, { recursive: true });
      writeFileSync(
        join(lockDir, '.server-port'),
        JSON.stringify({ port: 4096, pid: process.pid }),
        'utf-8'
      );

      try {
        const server = new OpencodeServerManager({ port: 4096 }, testDir);
        const internals = getInternals(server);

        // Mock fetch to return healthy agentlint response (array of sessions)
        global.fetch = (() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve([]),
          } as Response)) as unknown as typeof fetch;

        const result = await internals.checkPortAvailable();

        expect(result.available).toBe(false);
        expect(result.healthy).toBe(true);
        expect(result.isAgentlint).toBe(true);
      } finally {
        // Cleanup
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it('should identify as agentlint when Opencode session endpoint detected (lockfile optional)', async () => {
      // Use temp directory without lockfile
      const testDir = join(tmpdir(), `agentlint-test-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });

      try {
        const server = new OpencodeServerManager({ port: 4096 }, testDir);
        const internals = getInternals(server);

        // Mock fetch to return healthy opencode response (array of sessions)
        global.fetch = (() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve([]),
          } as Response)) as unknown as typeof fetch;

        const result = await internals.checkPortAvailable();

        expect(result.available).toBe(false);
        expect(result.healthy).toBe(true);
        // Any Opencode server is considered agentlint (lockfile is optional)
        expect(result.isAgentlint).toBe(true);
      } finally {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it('should identify as agentlint even when lockfile port mismatches', async () => {
      // Create a temp directory with a lockfile for a different port
      const testDir = join(tmpdir(), `agentlint-test-${Date.now()}`);
      const lockDir = join(testDir, '.agentlint');
      mkdirSync(lockDir, { recursive: true });
      writeFileSync(
        join(lockDir, '.server-port'),
        JSON.stringify({ port: 9999, pid: process.pid }),
        'utf-8'
      ); // Different port

      try {
        const server = new OpencodeServerManager({ port: 4096 }, testDir);
        const internals = getInternals(server);

        // Mock fetch to return healthy opencode response
        global.fetch = (() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve([]),
          } as Response)) as unknown as typeof fetch;

        const result = await internals.checkPortAvailable();

        expect(result.available).toBe(false);
        expect(result.healthy).toBe(true);
        // Any Opencode server is considered agentlint, regardless of lockfile
        expect(result.isAgentlint).toBe(true);
      } finally {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it('should detect non-agentlint service', async () => {
      const server = new OpencodeServerManager({ port: 4096 });
      const internals = getInternals(server);

      // Mock fetch to return non-agentlint response (not an array)
      global.fetch = (() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'different' }),
        } as Response)) as unknown as typeof fetch;

      const result = await internals.checkPortAvailable();

      expect(result.available).toBe(false);
      expect(result.healthy).toBe(true);
      expect(result.isAgentlint).toBe(false);
    });

    it('should detect unhealthy service', async () => {
      const server = new OpencodeServerManager({ port: 4096 });
      const internals = getInternals(server);

      // Mock fetch to return error status
      global.fetch = (() =>
        Promise.resolve({
          ok: false,
          status: 500,
        } as Response)) as unknown as typeof fetch;

      const result = await internals.checkPortAvailable();

      expect(result.available).toBe(false);
      expect(result.healthy).toBe(false);
      expect(result.isAgentlint).toBe(false);
    });

    it('should handle non-JSON response', async () => {
      const server = new OpencodeServerManager({ port: 4096 });
      const internals = getInternals(server);

      // Mock fetch to return non-JSON response
      global.fetch = (() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.reject(new Error('Not JSON')),
        } as Response)) as unknown as typeof fetch;

      const result = await internals.checkPortAvailable();

      expect(result.available).toBe(false);
      expect(result.healthy).toBe(false);
      expect(result.isAgentlint).toBe(false);
    });
  });

  describe('server reuse logic', () => {
    it('should reuse when healthy agentlint server exists', async () => {
      const server = new OpencodeServerManager({ port: 4096 });
      const internals = getInternals(server);

      // Mock healthy agentlint server
      internals.checkPortAvailable = () =>
        Promise.resolve({ available: false, healthy: true, isAgentlint: true });

      const canReuse = await internals.tryReuseExistingServer();

      expect(canReuse).toBe(true);
    });

    it('should not reuse when port is available', async () => {
      const server = new OpencodeServerManager({ port: 4096 });
      const internals = getInternals(server);

      // Mock available port
      internals.checkPortAvailable = () =>
        Promise.resolve({ available: true, healthy: false, isAgentlint: false });

      const canReuse = await internals.tryReuseExistingServer();

      expect(canReuse).toBe(false);
    });

    it('should not reuse when server is unhealthy', async () => {
      const server = new OpencodeServerManager({ port: 4096 });
      const internals = getInternals(server);

      // Mock unhealthy server
      internals.checkPortAvailable = () =>
        Promise.resolve({ available: false, healthy: false, isAgentlint: true });

      const canReuse = await internals.tryReuseExistingServer();

      expect(canReuse).toBe(false);
    });

    it('should not reuse when non-agentlint server exists', async () => {
      const server = new OpencodeServerManager({ port: 4096 });
      const internals = getInternals(server);

      // Mock non-agentlint server
      internals.checkPortAvailable = () =>
        Promise.resolve({ available: false, healthy: true, isAgentlint: false });

      const canReuse = await internals.tryReuseExistingServer();

      expect(canReuse).toBe(false);
    });
  });
});
