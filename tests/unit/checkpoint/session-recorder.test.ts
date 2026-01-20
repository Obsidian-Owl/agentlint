/**
 * EP11 Quality & Security - Session Recorder Unit Tests
 *
 * Unit tests for the SessionRecorder implementation.
 * Tests session recording, checkpoint storage, retrieval, and retention.
 *
 * @module tests/unit/checkpoint/session-recorder
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import type {
  SessionCheckpoint,
  ISessionRecorder,
  AnalysisPhase,
  SessionCheckpointTrigger,
} from '../../../src/orchestration/checkpoint-types';

// =============================================================================
// Test Setup
// =============================================================================

let tempDir: string;
let recorder: ISessionRecorder;

// Mock implementation for testing until the real one is implemented
class MockSessionRecorder implements ISessionRecorder {
  private sessions: Map<string, SessionCheckpoint[]> = new Map();
  private currentSessionId: string | null = null;
  private storageDir: string;

  constructor(storageDir: string) {
    this.storageDir = storageDir;
  }

  startRecording(sessionId: string): void {
    if (this.currentSessionId) {
      throw new Error('Already recording a session');
    }
    this.currentSessionId = sessionId;
    this.sessions.set(sessionId, []);

    // Create session directory
    const sessionDir = join(this.storageDir, sessionId);
    mkdirSync(sessionDir, { recursive: true });
  }

  async recordCheckpoint(checkpoint: SessionCheckpoint): Promise<void> {
    if (!this.currentSessionId) {
      throw new Error('No active recording session');
    }
    if (checkpoint.sessionId !== this.currentSessionId) {
      throw new Error('Checkpoint session ID does not match current session');
    }

    const checkpoints = this.sessions.get(this.currentSessionId) ?? [];
    checkpoints.push(checkpoint);
    this.sessions.set(this.currentSessionId, checkpoints);

    // Write to file
    const filePath = join(
      this.storageDir,
      checkpoint.sessionId,
      `${checkpoint.sequence.toString().padStart(4, '0')}.json`
    );
    const Bun = await import('bun');
    await Bun.write(filePath, JSON.stringify(checkpoint, null, 2));
  }

  async stopRecording(): Promise<void> {
    this.currentSessionId = null;
  }

  async getCheckpoints(sessionId: string): Promise<SessionCheckpoint[]> {
    return this.sessions.get(sessionId) ?? [];
  }

  async getLatestCheckpoint(sessionId: string): Promise<SessionCheckpoint | null> {
    const checkpoints = this.sessions.get(sessionId) ?? [];
    return checkpoints.length > 0 ? checkpoints[checkpoints.length - 1]! : null;
  }

  async listSessions(): Promise<
    Array<{
      sessionId: string;
      startedAt: string;
      lastCheckpointAt: string;
      checkpointCount: number;
      finalPhase: AnalysisPhase;
      sizeBytes: number;
    }>
  > {
    const summaries = [];
    for (const [sessionId, checkpoints] of this.sessions) {
      if (checkpoints.length > 0) {
        summaries.push({
          sessionId,
          startedAt: checkpoints[0]!.timestamp,
          lastCheckpointAt: checkpoints[checkpoints.length - 1]!.timestamp,
          checkpointCount: checkpoints.length,
          finalPhase: checkpoints[checkpoints.length - 1]!.phase,
          sizeBytes: JSON.stringify(checkpoints).length,
        });
      }
    }
    return summaries;
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    const sessionDir = join(this.storageDir, sessionId);
    if (existsSync(sessionDir)) {
      rmSync(sessionDir, { recursive: true, force: true });
    }
  }

  async cleanupOldCheckpoints(retentionDays: number): Promise<number> {
    if (retentionDays === 0) return 0;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    let deletedCount = 0;
    for (const [sessionId, checkpoints] of this.sessions) {
      if (checkpoints.length > 0) {
        const lastCheckpointDate = new Date(checkpoints[checkpoints.length - 1]!.timestamp);
        if (lastCheckpointDate < cutoffDate) {
          await this.deleteSession(sessionId);
          deletedCount++;
        }
      }
    }
    return deletedCount;
  }
}

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestCheckpoint(
  sessionId: string,
  sequence: number,
  phase: AnalysisPhase = 'analyze',
  trigger: SessionCheckpointTrigger = 'tool_complete'
): SessionCheckpoint {
  return {
    version: '1.0',
    sessionId,
    timestamp: new Date().toISOString(),
    sequence,
    phase,
    trigger,
    toolHistory: [
      {
        tool: 'read_file',
        arguments: { path: 'CLAUDE.md' },
        resultSummary: 'File content...',
        timestamp: new Date().toISOString(),
        durationMs: 50,
      },
    ],
    findings: [
      {
        id: 'FND-001',
        type: 'missing-section',
        location: { file: 'CLAUDE.md', line: 1 },
        summary: 'Missing development workflow',
      },
    ],
    metrics: {
      toolCalls: 5,
      llmCalls: 2,
      tokensUsed: 1500,
      elapsedMs: 5000,
    },
  };
}

// =============================================================================
// Test Lifecycle
// =============================================================================

beforeEach(() => {
  tempDir = join(tmpdir(), `session-recorder-test-${randomUUID()}`);
  mkdirSync(tempDir, { recursive: true });
  recorder = new MockSessionRecorder(tempDir);
});

afterEach(() => {
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

// =============================================================================
// Test Suite
// =============================================================================

describe('SessionRecorder', () => {
  describe('startRecording', () => {
    test('starts a new recording session', () => {
      const sessionId = 'test-session-001';

      recorder.startRecording(sessionId);

      // Session directory should be created
      expect(existsSync(join(tempDir, sessionId))).toBe(true);
    });

    test('throws error if already recording', () => {
      recorder.startRecording('session-1');

      expect(() => recorder.startRecording('session-2')).toThrow('Already recording');
    });
  });

  describe('recordCheckpoint', () => {
    test('records a checkpoint to storage', async () => {
      const sessionId = 'test-session-001';
      recorder.startRecording(sessionId);

      const checkpoint = createTestCheckpoint(sessionId, 1);
      await recorder.recordCheckpoint(checkpoint);

      // File should exist
      const filePath = join(tempDir, sessionId, '0001.json');
      expect(existsSync(filePath)).toBe(true);

      // Content should match
      const content = readFileSync(filePath, 'utf-8');
      const saved = JSON.parse(content) as SessionCheckpoint;
      expect(saved.sessionId).toBe(sessionId);
      expect(saved.sequence).toBe(1);
    });

    test('throws error if no active session', async () => {
      const checkpoint = createTestCheckpoint('any-session', 1);

      await expect(recorder.recordCheckpoint(checkpoint)).rejects.toThrow('No active recording session');
    });

    test('throws error if session ID mismatch', async () => {
      recorder.startRecording('session-1');
      const checkpoint = createTestCheckpoint('session-2', 1);

      await expect(recorder.recordCheckpoint(checkpoint)).rejects.toThrow('does not match');
    });

    test('records multiple checkpoints in sequence', async () => {
      const sessionId = 'test-session-001';
      recorder.startRecording(sessionId);

      await recorder.recordCheckpoint(createTestCheckpoint(sessionId, 1, 'init'));
      await recorder.recordCheckpoint(createTestCheckpoint(sessionId, 2, 'scan'));
      await recorder.recordCheckpoint(createTestCheckpoint(sessionId, 3, 'analyze'));

      const checkpoints = await recorder.getCheckpoints(sessionId);
      expect(checkpoints).toHaveLength(3);
      expect(checkpoints[0]!.phase).toBe('init');
      expect(checkpoints[2]!.phase).toBe('analyze');
    });
  });

  describe('stopRecording', () => {
    test('stops the current recording', async () => {
      recorder.startRecording('session-1');
      await recorder.stopRecording();

      // Can now start a new session
      expect(() => recorder.startRecording('session-2')).not.toThrow();
    });
  });

  describe('getCheckpoints', () => {
    test('retrieves all checkpoints for a session', async () => {
      const sessionId = 'test-session-001';
      recorder.startRecording(sessionId);

      await recorder.recordCheckpoint(createTestCheckpoint(sessionId, 1));
      await recorder.recordCheckpoint(createTestCheckpoint(sessionId, 2));

      const checkpoints = await recorder.getCheckpoints(sessionId);

      expect(checkpoints).toHaveLength(2);
      expect(checkpoints[0]!.sequence).toBe(1);
      expect(checkpoints[1]!.sequence).toBe(2);
    });

    test('returns empty array for unknown session', async () => {
      const checkpoints = await recorder.getCheckpoints('unknown-session');
      expect(checkpoints).toEqual([]);
    });
  });

  describe('getLatestCheckpoint', () => {
    test('returns the most recent checkpoint', async () => {
      const sessionId = 'test-session-001';
      recorder.startRecording(sessionId);

      await recorder.recordCheckpoint(createTestCheckpoint(sessionId, 1, 'init'));
      await recorder.recordCheckpoint(createTestCheckpoint(sessionId, 2, 'analyze'));
      await recorder.recordCheckpoint(createTestCheckpoint(sessionId, 3, 'complete'));

      const latest = await recorder.getLatestCheckpoint(sessionId);

      expect(latest).not.toBeNull();
      expect(latest!.sequence).toBe(3);
      expect(latest!.phase).toBe('complete');
    });

    test('returns null for unknown session', async () => {
      const latest = await recorder.getLatestCheckpoint('unknown-session');
      expect(latest).toBeNull();
    });
  });

  describe('listSessions', () => {
    test('lists all recorded sessions', async () => {
      // Record first session
      recorder.startRecording('session-1');
      await recorder.recordCheckpoint(createTestCheckpoint('session-1', 1, 'init'));
      await recorder.recordCheckpoint(createTestCheckpoint('session-1', 2, 'complete'));
      await recorder.stopRecording();

      // Record second session
      recorder.startRecording('session-2');
      await recorder.recordCheckpoint(createTestCheckpoint('session-2', 1, 'analyze'));
      await recorder.stopRecording();

      const sessions = await recorder.listSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions.map((s) => s.sessionId).sort()).toEqual(['session-1', 'session-2']);
    });

    test('includes session metadata', async () => {
      recorder.startRecording('session-1');
      await recorder.recordCheckpoint(createTestCheckpoint('session-1', 1, 'init'));
      await recorder.recordCheckpoint(createTestCheckpoint('session-1', 2, 'analyze'));
      await recorder.recordCheckpoint(createTestCheckpoint('session-1', 3, 'complete'));
      await recorder.stopRecording();

      const sessions = await recorder.listSessions();

      expect(sessions).toHaveLength(1);
      const session = sessions[0]!;
      expect(session.checkpointCount).toBe(3);
      expect(session.finalPhase).toBe('complete');
      expect(session.sizeBytes).toBeGreaterThan(0);
    });

    test('returns empty array when no sessions', async () => {
      const sessions = await recorder.listSessions();
      expect(sessions).toEqual([]);
    });
  });

  describe('deleteSession', () => {
    test('deletes session checkpoints', async () => {
      recorder.startRecording('session-1');
      await recorder.recordCheckpoint(createTestCheckpoint('session-1', 1));
      await recorder.stopRecording();

      await recorder.deleteSession('session-1');

      const checkpoints = await recorder.getCheckpoints('session-1');
      expect(checkpoints).toEqual([]);

      // Directory should be removed
      expect(existsSync(join(tempDir, 'session-1'))).toBe(false);
    });

    test('handles non-existent session gracefully', async () => {
      // Should not throw when deleting non-existent session
      await recorder.deleteSession('unknown-session');
      // If we get here, it didn't throw
      expect(true).toBe(true);
    });
  });

  describe('cleanupOldCheckpoints', () => {
    test('deletes sessions older than retention period', async () => {
      // Create an old session by manipulating the mock
      recorder.startRecording('old-session');
      const oldCheckpoint = createTestCheckpoint('old-session', 1);
      // Set timestamp to 10 days ago
      oldCheckpoint.timestamp = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      await recorder.recordCheckpoint(oldCheckpoint);
      await recorder.stopRecording();

      // Create a recent session
      recorder.startRecording('new-session');
      await recorder.recordCheckpoint(createTestCheckpoint('new-session', 1));
      await recorder.stopRecording();

      // Cleanup with 7-day retention
      const deleted = await recorder.cleanupOldCheckpoints(7);

      expect(deleted).toBe(1);

      const sessions = await recorder.listSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0]!.sessionId).toBe('new-session');
    });

    test('retentionDays=0 disables cleanup', async () => {
      recorder.startRecording('session-1');
      const oldCheckpoint = createTestCheckpoint('session-1', 1);
      oldCheckpoint.timestamp = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
      await recorder.recordCheckpoint(oldCheckpoint);
      await recorder.stopRecording();

      const deleted = await recorder.cleanupOldCheckpoints(0);

      expect(deleted).toBe(0);
      const sessions = await recorder.listSessions();
      expect(sessions).toHaveLength(1);
    });
  });
});

// =============================================================================
// Checkpoint Data Integrity Tests
// =============================================================================

describe('Checkpoint Data Integrity', () => {
  test('preserves all checkpoint fields', async () => {
    const sessionId = 'test-session-001';
    recorder.startRecording(sessionId);

    const original = createTestCheckpoint(sessionId, 1, 'analyze', 'finding');
    original.workspaceState = { currentFile: 'CLAUDE.md', depth: 2 };

    await recorder.recordCheckpoint(original);

    const retrieved = await recorder.getLatestCheckpoint(sessionId);

    expect(retrieved).not.toBeNull();
    expect(retrieved!.version).toBe(original.version);
    expect(retrieved!.sessionId).toBe(original.sessionId);
    expect(retrieved!.sequence).toBe(original.sequence);
    expect(retrieved!.phase).toBe(original.phase);
    expect(retrieved!.trigger).toBe(original.trigger);
    expect(retrieved!.toolHistory).toEqual(original.toolHistory);
    expect(retrieved!.findings).toEqual(original.findings);
    expect(retrieved!.metrics).toEqual(original.metrics);
    expect(retrieved!.workspaceState).toEqual(original.workspaceState);
  });

  test('handles checkpoint with empty arrays', async () => {
    const sessionId = 'test-session-001';
    recorder.startRecording(sessionId);

    const checkpoint: SessionCheckpoint = {
      version: '1.0',
      sessionId,
      timestamp: new Date().toISOString(),
      sequence: 1,
      phase: 'init',
      trigger: 'phase_transition',
      toolHistory: [],
      findings: [],
      metrics: { toolCalls: 0, llmCalls: 0, tokensUsed: 0, elapsedMs: 0 },
    };

    await recorder.recordCheckpoint(checkpoint);

    const retrieved = await recorder.getLatestCheckpoint(sessionId);
    expect(retrieved!.toolHistory).toEqual([]);
    expect(retrieved!.findings).toEqual([]);
  });
});
