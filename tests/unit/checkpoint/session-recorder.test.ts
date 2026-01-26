/**
 * EP11 Quality & Security - Session Recorder Unit Tests
 *
 * Unit tests for the SessionRecorder implementation.
 * Tests session recording, checkpoint storage, retrieval, and retention.
 *
 * NOTE: These tests use the REAL SessionRecorder implementation, not a mock.
 * The real implementation is located in src/orchestration/checkpoint.ts.
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
  AnalysisPhase,
  SessionCheckpointTrigger,
} from '../../../src/orchestration/checkpoint-types';
import {
  SessionRecorder,
  createSessionRecorder,
  createSessionReplayer,
} from '../../../src/orchestration/checkpoint';

// =============================================================================
// Test Setup
// =============================================================================

let tempDir: string;
let recorder: SessionRecorder;

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
      inputTokens: 1000,
      outputTokens: 500,
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
  recorder = createSessionRecorder({ storageDir: tempDir });
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

      await expect(recorder.recordCheckpoint(checkpoint)).rejects.toThrow(
        'No active recording session'
      );
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
      recorder.stopRecording();

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
      recorder.stopRecording();

      // Record second session
      recorder.startRecording('session-2');
      await recorder.recordCheckpoint(createTestCheckpoint('session-2', 1, 'analyze'));
      recorder.stopRecording();

      const sessions = await recorder.listSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions.map((s) => s.sessionId).sort()).toEqual(['session-1', 'session-2']);
    });

    test('includes session metadata', async () => {
      recorder.startRecording('session-1');
      await recorder.recordCheckpoint(createTestCheckpoint('session-1', 1, 'init'));
      await recorder.recordCheckpoint(createTestCheckpoint('session-1', 2, 'analyze'));
      await recorder.recordCheckpoint(createTestCheckpoint('session-1', 3, 'complete'));
      recorder.stopRecording();

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
      recorder.stopRecording();

      recorder.deleteSession('session-1');

      const checkpoints = await recorder.getCheckpoints('session-1');
      expect(checkpoints).toEqual([]);

      // Directory should be removed
      expect(existsSync(join(tempDir, 'session-1'))).toBe(false);
    });

    test('handles non-existent session gracefully', () => {
      // Should not throw when deleting non-existent session
      recorder.deleteSession('unknown-session');
      // If we get here, it didn't throw
      expect(true).toBe(true);
    });
  });

  describe('cleanupOldCheckpoints', () => {
    test('deletes sessions older than retention period', async () => {
      // Create an old session by manipulating the timestamp
      recorder.startRecording('old-session');
      const oldCheckpoint = createTestCheckpoint('old-session', 1);
      // Set timestamp to 10 days ago
      oldCheckpoint.timestamp = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      await recorder.recordCheckpoint(oldCheckpoint);
      recorder.stopRecording();

      // Create a recent session
      recorder.startRecording('new-session');
      await recorder.recordCheckpoint(createTestCheckpoint('new-session', 1));
      recorder.stopRecording();

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
      recorder.stopRecording();

      const deleted = await recorder.cleanupOldCheckpoints(0);

      expect(deleted).toBe(0);
      const sessions = await recorder.listSessions();
      expect(sessions).toHaveLength(1);
    });
  });

  describe('getStorageDir', () => {
    test('returns configured storage directory', () => {
      expect(recorder.getStorageDir()).toBe(tempDir);
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
      metrics: {
        toolCalls: 0,
        llmCalls: 0,
        tokensUsed: 0,
        inputTokens: 0,
        outputTokens: 0,
        elapsedMs: 0,
      },
    };

    await recorder.recordCheckpoint(checkpoint);

    const retrieved = await recorder.getLatestCheckpoint(sessionId);
    expect(retrieved!.toolHistory).toEqual([]);
    expect(retrieved!.findings).toEqual([]);
  });
});

// =============================================================================
// Session Replayer Tests
// =============================================================================

describe('SessionReplayer', () => {
  test('canReplay returns true for session with checkpoints', async () => {
    recorder.startRecording('session-1');
    await recorder.recordCheckpoint(createTestCheckpoint('session-1', 1));
    recorder.stopRecording();

    const replayer = createSessionReplayer(recorder);

    expect(await replayer.canReplay('session-1')).toBe(true);
  });

  test('canReplay returns false for empty session', async () => {
    const replayer = createSessionReplayer(recorder);

    expect(await replayer.canReplay('nonexistent-session')).toBe(false);
  });

  test('loadSession returns all checkpoints', async () => {
    recorder.startRecording('session-1');
    await recorder.recordCheckpoint(createTestCheckpoint('session-1', 1, 'init'));
    await recorder.recordCheckpoint(createTestCheckpoint('session-1', 2, 'analyze'));
    recorder.stopRecording();

    const replayer = createSessionReplayer(recorder);
    const checkpoints = await replayer.loadSession('session-1');

    expect(checkpoints).toHaveLength(2);
    expect(checkpoints[0]!.sequence).toBe(1);
    expect(checkpoints[1]!.sequence).toBe(2);
  });

  test('getStateAt returns specific checkpoint', async () => {
    recorder.startRecording('session-1');
    await recorder.recordCheckpoint(createTestCheckpoint('session-1', 1, 'init'));
    await recorder.recordCheckpoint(createTestCheckpoint('session-1', 2, 'analyze'));
    await recorder.recordCheckpoint(createTestCheckpoint('session-1', 3, 'complete'));
    recorder.stopRecording();

    const replayer = createSessionReplayer(recorder);
    const checkpoint = await replayer.getStateAt('session-1', 2);

    expect(checkpoint).not.toBeNull();
    expect(checkpoint!.sequence).toBe(2);
    expect(checkpoint!.phase).toBe('analyze');
  });

  test('restoreFromCheckpoint extracts replay context', async () => {
    recorder.startRecording('session-1');
    const checkpoint = createTestCheckpoint('session-1', 1, 'analyze');
    checkpoint.workspaceState = { currentFile: 'test.ts' };
    await recorder.recordCheckpoint(checkpoint);
    recorder.stopRecording();

    const replayer = createSessionReplayer(recorder);
    const loaded = await replayer.getStateAt('session-1', 1);
    const context = replayer.restoreFromCheckpoint(loaded!);

    expect(context.sessionId).toBe('session-1');
    expect(context.phase).toBe('analyze');
    expect(context.findings).toEqual(checkpoint.findings);
    expect(context.metrics).toEqual(checkpoint.metrics);
    expect(context.workspaceState).toEqual({ currentFile: 'test.ts' });
  });
});
