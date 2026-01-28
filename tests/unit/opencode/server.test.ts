import { describe, expect, it } from 'bun:test';
import { OpencodeServerManager } from '../../../src/opencode/server';

/** Centralizes `as unknown as` casts — a private field rename only breaks this one spot. */
interface ServerInternals {
  config: { port: number; hostname: string; timeout: number };
  server: { url: string; close: () => void } | null;
  running: boolean;
}

function getInternals(server: OpencodeServerManager): ServerInternals {
  return server as unknown as ServerInternals;
}

describe('OpencodeServerManager', () => {
  describe('configuration', () => {
    it('should use default config values', () => {
      const server = new OpencodeServerManager();
      const internals = getInternals(server);
      expect(internals.config.port).toBe(4096);
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
      const server = new OpencodeServerManager({});
      const internals = getInternals(server);
      expect(internals.config.port).toBe(4096);
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

    it('should throw when starting an already-running server', async () => {
      const server = new OpencodeServerManager();
      const internals = getInternals(server);

      // Simulate server already running
      internals.running = true;
      internals.server = { url: 'http://localhost:4096', close: () => {} };

      await expect(server.start()).rejects.toThrow('already running');
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
  });
});
