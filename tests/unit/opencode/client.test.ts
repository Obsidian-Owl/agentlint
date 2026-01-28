import { describe, expect, it } from 'bun:test';
import { AgentlintOpencodeClient } from '../../../src/opencode/client';

/** Centralizes `as unknown as` casts — a private field rename only breaks this one spot. */
interface ClientInternals {
  config: { baseUrl: string };
  client: unknown;
  connected: boolean;
}

function getInternals(client: AgentlintOpencodeClient): ClientInternals {
  return client as unknown as ClientInternals;
}

describe('AgentlintOpencodeClient', () => {
  describe('configuration', () => {
    it('should use default baseUrl when none provided', () => {
      const client = new AgentlintOpencodeClient();
      const internals = getInternals(client);
      expect(internals.config.baseUrl).toBe('http://localhost:4096');
    });

    it('should use provided baseUrl', () => {
      const client = new AgentlintOpencodeClient({ baseUrl: 'http://custom:9999' });
      const internals = getInternals(client);
      expect(internals.config.baseUrl).toBe('http://custom:9999');
    });

    it('should accept empty config object', () => {
      const client = new AgentlintOpencodeClient({});
      const internals = getInternals(client);
      expect(internals.config.baseUrl).toBe('http://localhost:4096');
    });
  });

  describe('lifecycle', () => {
    it('should not be connected initially', () => {
      const client = new AgentlintOpencodeClient();
      expect(client.isConnected()).toBe(false);
    });

    it('should throw when calling createSession before connect', async () => {
      const client = new AgentlintOpencodeClient();
      await expect(client.createSession({ title: 'test' })).rejects.toThrow('not connected');
    });

    it('should throw when calling prompt before connect', async () => {
      const client = new AgentlintOpencodeClient();
      await expect(client.prompt('ses-1', 'hello')).rejects.toThrow('not connected');
    });

    it('should throw when calling subscribe before connect', async () => {
      const client = new AgentlintOpencodeClient();
      const gen = client.subscribe();
      const iterator = gen[Symbol.asyncIterator]();
      await expect(iterator.next()).rejects.toThrow('not connected');
    });

    it('should return true for isConnected after manually setting connected flag', () => {
      const client = new AgentlintOpencodeClient();
      const internals = getInternals(client);

      // Simulate connection
      internals.connected = true;

      expect(client.isConnected()).toBe(true);
    });

    it('should be idempotent when connect is called multiple times', async () => {
      const client = new AgentlintOpencodeClient();
      const internals = getInternals(client);

      // Mock successful connection
      internals.connected = true;
      internals.client = { session: {} };

      // Second connect should return immediately
      await expect(client.connect()).resolves.toBeUndefined();
      expect(client.isConnected()).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should include session context in createSession error', async () => {
      const client = new AgentlintOpencodeClient();
      const internals = getInternals(client);

      internals.connected = true;
      internals.client = {
        session: {
          create: async () => ({ error: { message: 'Network timeout' } }),
        },
      };

      await expect(client.createSession({ title: 'test' })).rejects.toThrow(
        'Failed to create session'
      );
    });

    it('should include error context in prompt failure', async () => {
      const client = new AgentlintOpencodeClient();
      const internals = getInternals(client);

      internals.connected = true;
      internals.client = {
        session: {
          prompt: async () => ({ error: { message: 'Invalid session' } }),
        },
      };

      await expect(client.prompt('ses-1', 'hello')).rejects.toThrow('Prompt failed');
    });

    it('should handle SDK errors in subscribe', async () => {
      const client = new AgentlintOpencodeClient();
      const internals = getInternals(client);

      internals.connected = true;
      internals.client = {
        event: {
          subscribe: async () => {
            throw new Error('Connection lost');
          },
        },
      };

      const gen = client.subscribe();
      const iterator = gen[Symbol.asyncIterator]();
      await expect(iterator.next()).rejects.toThrow('Connection lost');
    });
  });
});
