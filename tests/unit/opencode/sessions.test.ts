import { describe, expect, it } from 'bun:test';
import { HybridSessionManager } from '../../../src/opencode/sessions';
import { AgentlintOpencodeClient } from '../../../src/opencode/client';

class MockOpencodeClient extends AgentlintOpencodeClient {
  private sessionCounter = 0;

  async connect(): Promise<void> {
    return Promise.resolve();
  }

  async createSession(_options: { title: string }): Promise<{ id: string }> {
    this.sessionCounter++;
    return { id: `session-${this.sessionCounter}` };
  }

  async prompt(_sessionId: string, _message: string): Promise<string> {
    return '';
  }

  async *subscribe(): AsyncIterable<unknown> {
    yield {};
  }

  isConnected(): boolean {
    return true;
  }
}

describe('HybridSessionManager', () => {
  describe('startSession', () => {
    it('should create Opencode session and local metadata', async () => {
      const client = new MockOpencodeClient();
      const manager = new HybridSessionManager(client);

      const session = await manager.startSession('Test Session');

      expect(session.sessionId).toBe('session-1');
      expect(session.title).toBe('Test Session');
      expect(session.findings).toEqual([]);
      expect(session.phase).toBe('initial');
      expect(session.toolCache).toEqual({});
      expect(session.createdAt).toBeDefined();
      expect(session.updatedAt).toBeDefined();
    });

    it('should store session in local map', async () => {
      const client = new MockOpencodeClient();
      const manager = new HybridSessionManager(client);

      const session = await manager.startSession('Test');
      const retrieved = manager.getSession(session.sessionId);

      expect(retrieved).toEqual(session);
    });
  });

  describe('saveCheckpoint', () => {
    it('should update session metadata', async () => {
      const client = new MockOpencodeClient();
      const manager = new HybridSessionManager(client);

      const session = await manager.startSession('Test');
      await new Promise((resolve) => setTimeout(resolve, 10));
      manager.saveCheckpoint(session.sessionId, {
        findings: ['finding1', 'finding2'],
        phase: 'analysis',
      });

      const updated = manager.getSession(session.sessionId);
      expect(updated?.findings).toEqual(['finding1', 'finding2']);
      expect(updated?.phase).toBe('analysis');
      expect(updated?.updatedAt).not.toBe(session.updatedAt);
    });

    it('should throw error for non-existent session', () => {
      const client = new MockOpencodeClient();
      const manager = new HybridSessionManager(client);

      expect(() => manager.saveCheckpoint('nonexistent', { phase: 'test' })).toThrow(
        'Session nonexistent not found'
      );
    });

    it('should preserve unchanged fields', async () => {
      const client = new MockOpencodeClient();
      const manager = new HybridSessionManager(client);

      const session = await manager.startSession('Test');
      manager.saveCheckpoint(session.sessionId, { phase: 'new-phase' });

      const updated = manager.getSession(session.sessionId);
      expect(updated?.title).toBe('Test');
      expect(updated?.findings).toEqual([]);
      expect(updated?.phase).toBe('new-phase');
    });
  });

  describe('resumeSession', () => {
    it('should return existing session', async () => {
      const client = new MockOpencodeClient();
      const manager = new HybridSessionManager(client);

      const session = await manager.startSession('Test');
      const resumed = manager.resumeSession(session.sessionId);

      expect(resumed).toEqual(session);
    });

    it('should return null for non-existent session', () => {
      const client = new MockOpencodeClient();
      const manager = new HybridSessionManager(client);

      const resumed = manager.resumeSession('nonexistent');
      expect(resumed).toBeNull();
    });
  });

  describe('getSession', () => {
    it('should return session by ID', async () => {
      const client = new MockOpencodeClient();
      const manager = new HybridSessionManager(client);

      const session = await manager.startSession('Test');
      const retrieved = manager.getSession(session.sessionId);

      expect(retrieved).toEqual(session);
    });

    it('should return null for non-existent session', () => {
      const client = new MockOpencodeClient();
      const manager = new HybridSessionManager(client);

      const retrieved = manager.getSession('nonexistent');
      expect(retrieved).toBeNull();
    });
  });
});
