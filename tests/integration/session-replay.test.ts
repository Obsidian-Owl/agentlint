/**
 * EP11 Quality & Security - Session Replay Integration Tests
 *
 * Integration tests for session recording and replay functionality.
 * Tests the full workflow of recording, persisting, and replaying sessions.
 *
 * @module tests/integration/session-replay
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, rmSync, existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import type {
  SessionCheckpoint,
  SessionSummary,
  ReplayContext,
  ISessionRecorder,
  ISessionReplayer,
  AnalysisPhase,
} from '../../src/orchestration/checkpoint-types';

// =============================================================================
// Mock Implementations
// =============================================================================

/**
 * Mock session recorder for integration testing.
 */
class MockSessionRecorder implements ISessionRecorder {
  private sessions: Map<string, SessionCheckpoint[]> = new Map();
  private currentSessionId: string | null = null;
  private storageDir: string;

  constructor(storageDir: string) {
    this.storageDir = storageDir;
    mkdirSync(storageDir, { recursive: true });
  }

  startRecording(sessionId: string): void {
    if (this.currentSessionId) {
      throw new Error('Already recording a session');
    }
    this.currentSessionId = sessionId;
    this.sessions.set(sessionId, []);
    mkdirSync(join(this.storageDir, sessionId), { recursive: true });
  }

  async recordCheckpoint(checkpoint: SessionCheckpoint): Promise<void> {
    if (!this.currentSessionId) {
      throw new Error('No active recording session');
    }
    const checkpoints = this.sessions.get(this.currentSessionId) ?? [];
    checkpoints.push(checkpoint);
    this.sessions.set(this.currentSessionId, checkpoints);

    const filePath = join(
      this.storageDir,
      checkpoint.sessionId,
      `${checkpoint.sequence.toString().padStart(4, '0')}.json`
    );
    await Bun.write(filePath, JSON.stringify(checkpoint, null, 2));
  }

  stopRecording(): void {
    this.currentSessionId = null;
  }

  async getCheckpoints(sessionId: string): Promise<SessionCheckpoint[]> {
    // Try to load from disk if not in memory
    if (!this.sessions.has(sessionId)) {
      const sessionDir = join(this.storageDir, sessionId);
      if (existsSync(sessionDir)) {
        const files = readdirSync(sessionDir)
          .filter((f) => f.endsWith('.json'))
          .sort();
        const checkpoints: SessionCheckpoint[] = [];
        for (const file of files) {
          const content = readFileSync(join(sessionDir, file), 'utf-8');
          checkpoints.push(JSON.parse(content) as SessionCheckpoint);
        }
        this.sessions.set(sessionId, checkpoints);
      }
    }
    return this.sessions.get(sessionId) ?? [];
  }

  async getLatestCheckpoint(sessionId: string): Promise<SessionCheckpoint | null> {
    const checkpoints = await this.getCheckpoints(sessionId);
    return checkpoints.length > 0 ? checkpoints[checkpoints.length - 1]! : null;
  }

  async listSessions(): Promise<SessionSummary[]> {
    const summaries: SessionSummary[] = [];

    // Scan storage directory
    if (existsSync(this.storageDir)) {
      const dirs = readdirSync(this.storageDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

      for (const sessionId of dirs) {
        const checkpoints = await this.getCheckpoints(sessionId);
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
    }

    return summaries;
  }

  deleteSession(sessionId: string): void {
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
    const sessions = await this.listSessions();

    for (const session of sessions) {
      const lastCheckpointDate = new Date(session.lastCheckpointAt);
      if (lastCheckpointDate < cutoffDate) {
        await this.deleteSession(session.sessionId);
        deletedCount++;
      }
    }

    return deletedCount;
  }
}

/**
 * Mock session replayer for integration testing.
 */
class MockSessionReplayer implements ISessionReplayer {
  private recorder: MockSessionRecorder;

  constructor(recorder: MockSessionRecorder) {
    this.recorder = recorder;
  }

  async canReplay(sessionId: string): Promise<boolean> {
    const checkpoints = await this.recorder.getCheckpoints(sessionId);
    return checkpoints.length > 0;
  }

  async loadSession(sessionId: string): Promise<SessionCheckpoint[]> {
    return this.recorder.getCheckpoints(sessionId);
  }

  async getStateAt(sessionId: string, sequence: number): Promise<SessionCheckpoint | null> {
    const checkpoints = await this.recorder.getCheckpoints(sessionId);
    return checkpoints.find((c) => c.sequence === sequence) ?? null;
  }

  restoreFromCheckpoint(checkpoint: SessionCheckpoint): ReplayContext {
    const context: ReplayContext = {
      sessionId: checkpoint.sessionId,
      phase: checkpoint.phase,
      findings: checkpoint.findings,
      metrics: checkpoint.metrics,
    };
    if (checkpoint.workspaceState !== undefined) {
      context.workspaceState = checkpoint.workspaceState;
    }
    return context;
  }
}

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestCheckpoint(
  sessionId: string,
  sequence: number,
  phase: AnalysisPhase,
  findingsCount: number = 0
): SessionCheckpoint {
  return {
    version: '1.0',
    sessionId,
    timestamp: new Date().toISOString(),
    sequence,
    phase,
    trigger: sequence === 1 ? 'phase_transition' : 'tool_complete',
    toolHistory:
      sequence > 1
        ? [
            {
              tool: 'read_file',
              arguments: { path: 'CLAUDE.md' },
              resultSummary: 'File read successfully',
              timestamp: new Date().toISOString(),
              durationMs: 50,
            },
          ]
        : [],
    findings: Array.from({ length: findingsCount }, (_, i) => ({
      id: `FND-${(i + 1).toString().padStart(3, '0')}`,
      type: 'missing-section',
      location: { file: 'CLAUDE.md', line: i + 1 },
      summary: `Finding ${i + 1}`,
    })),
    metrics: {
      toolCalls: sequence * 2,
      llmCalls: sequence,
      tokensUsed: sequence * 500,
      inputTokens: sequence * 300,
      outputTokens: sequence * 200,
      elapsedMs: sequence * 1000,
    },
    workspaceState: {
      currentFile: 'CLAUDE.md',
      depth: 1,
    },
  };
}

// =============================================================================
// Test Setup
// =============================================================================

let tempDir: string;
let recorder: MockSessionRecorder;
let replayer: MockSessionReplayer;

beforeEach(() => {
  tempDir = join(tmpdir(), `session-replay-test-${randomUUID()}`);
  mkdirSync(tempDir, { recursive: true });
  recorder = new MockSessionRecorder(tempDir);
  replayer = new MockSessionReplayer(recorder);
});

afterEach(() => {
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

// =============================================================================
// Test Suite
// =============================================================================

describe('Session Replay Integration', () => {
  describe('Recording and Persistence', () => {
    test('records checkpoints to disk', async () => {
      const sessionId = 'test-session-001';
      recorder.startRecording(sessionId);

      await recorder.recordCheckpoint(createTestCheckpoint(sessionId, 1, 'init'));
      await recorder.recordCheckpoint(createTestCheckpoint(sessionId, 2, 'scan'));
      await recorder.recordCheckpoint(createTestCheckpoint(sessionId, 3, 'analyze', 2));

      // Check files exist
      const sessionDir = join(tempDir, sessionId);
      expect(existsSync(join(sessionDir, '0001.json'))).toBe(true);
      expect(existsSync(join(sessionDir, '0002.json'))).toBe(true);
      expect(existsSync(join(sessionDir, '0003.json'))).toBe(true);
    });

    test('persists across recorder instances', async () => {
      const sessionId = 'persistent-session';

      // Record with first instance
      recorder.startRecording(sessionId);
      await recorder.recordCheckpoint(createTestCheckpoint(sessionId, 1, 'init'));
      await recorder.recordCheckpoint(createTestCheckpoint(sessionId, 2, 'analyze', 1));
      await recorder.stopRecording();

      // Create new instance
      const newRecorder = new MockSessionRecorder(tempDir);
      const checkpoints = await newRecorder.getCheckpoints(sessionId);

      expect(checkpoints).toHaveLength(2);
      expect(checkpoints[0]!.phase).toBe('init');
      expect(checkpoints[1]!.phase).toBe('analyze');
    });
  });

  describe('Replay Functionality', () => {
    test('canReplay returns true for existing sessions', async () => {
      const sessionId = 'replayable-session';
      recorder.startRecording(sessionId);
      await recorder.recordCheckpoint(createTestCheckpoint(sessionId, 1, 'init'));
      await recorder.stopRecording();

      expect(await replayer.canReplay(sessionId)).toBe(true);
    });

    test('canReplay returns false for non-existent sessions', async () => {
      expect(await replayer.canReplay('non-existent')).toBe(false);
    });

    test('loadSession retrieves all checkpoints in order', async () => {
      const sessionId = 'ordered-session';
      recorder.startRecording(sessionId);
      await recorder.recordCheckpoint(createTestCheckpoint(sessionId, 1, 'init'));
      await recorder.recordCheckpoint(createTestCheckpoint(sessionId, 2, 'scan'));
      await recorder.recordCheckpoint(createTestCheckpoint(sessionId, 3, 'analyze'));
      await recorder.recordCheckpoint(createTestCheckpoint(sessionId, 4, 'recommend'));
      await recorder.recordCheckpoint(createTestCheckpoint(sessionId, 5, 'complete'));
      await recorder.stopRecording();

      const checkpoints = await replayer.loadSession(sessionId);

      expect(checkpoints).toHaveLength(5);
      expect(checkpoints.map((c) => c.sequence)).toEqual([1, 2, 3, 4, 5]);
      expect(checkpoints.map((c) => c.phase)).toEqual([
        'init',
        'scan',
        'analyze',
        'recommend',
        'complete',
      ]);
    });

    test('getStateAt retrieves specific checkpoint', async () => {
      const sessionId = 'state-session';
      recorder.startRecording(sessionId);
      await recorder.recordCheckpoint(createTestCheckpoint(sessionId, 1, 'init'));
      await recorder.recordCheckpoint(createTestCheckpoint(sessionId, 2, 'scan'));
      await recorder.recordCheckpoint(createTestCheckpoint(sessionId, 3, 'analyze', 3));
      await recorder.stopRecording();

      const state = await replayer.getStateAt(sessionId, 3);

      expect(state).not.toBeNull();
      expect(state!.sequence).toBe(3);
      expect(state!.phase).toBe('analyze');
      expect(state!.findings).toHaveLength(3);
    });

    test('getStateAt returns null for invalid sequence', async () => {
      const sessionId = 'invalid-seq-session';
      recorder.startRecording(sessionId);
      await recorder.recordCheckpoint(createTestCheckpoint(sessionId, 1, 'init'));
      await recorder.stopRecording();

      const state = await replayer.getStateAt(sessionId, 999);
      expect(state).toBeNull();
    });

    test('restoreFromCheckpoint creates valid replay context', async () => {
      const sessionId = 'restore-session';
      recorder.startRecording(sessionId);
      await recorder.recordCheckpoint(createTestCheckpoint(sessionId, 1, 'init'));
      await recorder.recordCheckpoint(createTestCheckpoint(sessionId, 2, 'scan'));
      const checkpoint = createTestCheckpoint(sessionId, 3, 'analyze', 2);
      await recorder.recordCheckpoint(checkpoint);
      await recorder.stopRecording();

      const context = await replayer.restoreFromCheckpoint(checkpoint);

      expect(context.sessionId).toBe(sessionId);
      expect(context.phase).toBe('analyze');
      expect(context.findings).toHaveLength(2);
      expect(context.metrics.toolCalls).toBe(6); // sequence * 2
      expect(context.workspaceState).toEqual({ currentFile: 'CLAUDE.md', depth: 1 });
    });
  });

  describe('Session Management', () => {
    test('listSessions returns all recorded sessions', async () => {
      // Record multiple sessions
      recorder.startRecording('session-1');
      await recorder.recordCheckpoint(createTestCheckpoint('session-1', 1, 'init'));
      await recorder.recordCheckpoint(createTestCheckpoint('session-1', 2, 'complete'));
      await recorder.stopRecording();

      recorder.startRecording('session-2');
      await recorder.recordCheckpoint(createTestCheckpoint('session-2', 1, 'init'));
      await recorder.stopRecording();

      recorder.startRecording('session-3');
      await recorder.recordCheckpoint(createTestCheckpoint('session-3', 1, 'init'));
      await recorder.recordCheckpoint(createTestCheckpoint('session-3', 2, 'scan'));
      await recorder.recordCheckpoint(createTestCheckpoint('session-3', 3, 'analyze'));
      await recorder.stopRecording();

      const sessions = await recorder.listSessions();

      expect(sessions).toHaveLength(3);
      expect(sessions.map((s) => s.sessionId).sort()).toEqual([
        'session-1',
        'session-2',
        'session-3',
      ]);
    });

    test('deleteSession removes session from disk', async () => {
      const sessionId = 'deletable-session';
      recorder.startRecording(sessionId);
      await recorder.recordCheckpoint(createTestCheckpoint(sessionId, 1, 'init'));
      await recorder.stopRecording();

      // Verify exists
      expect(existsSync(join(tempDir, sessionId))).toBe(true);

      await recorder.deleteSession(sessionId);

      // Verify deleted
      expect(existsSync(join(tempDir, sessionId))).toBe(false);
      expect(await replayer.canReplay(sessionId)).toBe(false);
    });
  });

  describe('End-to-End Workflow', () => {
    test('complete recording → stop → new instance → replay workflow', async () => {
      const sessionId = 'e2e-session';

      // 1. Start recording
      recorder.startRecording(sessionId);

      // 2. Simulate analysis progress
      await recorder.recordCheckpoint(createTestCheckpoint(sessionId, 1, 'init'));
      await recorder.recordCheckpoint(createTestCheckpoint(sessionId, 2, 'scan'));
      await recorder.recordCheckpoint(createTestCheckpoint(sessionId, 3, 'analyze', 2));
      await recorder.recordCheckpoint(createTestCheckpoint(sessionId, 4, 'recommend', 2));
      await recorder.recordCheckpoint(createTestCheckpoint(sessionId, 5, 'complete', 2));

      // 3. Stop recording
      await recorder.stopRecording();

      // 4. Create new recorder/replayer instances (simulates restart)
      const newRecorder = new MockSessionRecorder(tempDir);
      const newReplayer = new MockSessionReplayer(newRecorder);

      // 5. Check replay availability
      expect(await newReplayer.canReplay(sessionId)).toBe(true);

      // 6. Load session
      const checkpoints = await newReplayer.loadSession(sessionId);
      expect(checkpoints).toHaveLength(5);

      // 7. Get state at specific point
      const midpoint = await newReplayer.getStateAt(sessionId, 3);
      expect(midpoint!.phase).toBe('analyze');

      // 8. Restore from checkpoint
      const context = await newReplayer.restoreFromCheckpoint(midpoint!);
      expect(context.phase).toBe('analyze');
      expect(context.findings).toHaveLength(2);

      // 9. Verify session summary
      const sessions = await newRecorder.listSessions();
      const summary = sessions.find((s) => s.sessionId === sessionId)!;
      expect(summary.checkpointCount).toBe(5);
      expect(summary.finalPhase).toBe('complete');
    });

    test('crash recovery workflow - resume from last checkpoint', async () => {
      const sessionId = 'crash-recovery-session';

      // 1. Start recording
      recorder.startRecording(sessionId);

      // 2. Record progress
      await recorder.recordCheckpoint(createTestCheckpoint(sessionId, 1, 'init'));
      await recorder.recordCheckpoint(createTestCheckpoint(sessionId, 2, 'scan'));
      await recorder.recordCheckpoint(createTestCheckpoint(sessionId, 3, 'analyze', 1));

      // 3. Simulate crash (no stopRecording called)
      // recorder left dangling...

      // 4. New instance discovers incomplete session
      const recoveryRecorder = new MockSessionRecorder(tempDir);
      const recoveryReplayer = new MockSessionReplayer(recoveryRecorder);

      // 5. Find sessions that can be recovered
      const sessions = await recoveryRecorder.listSessions();
      const incompleteSession = sessions.find((s) => s.finalPhase !== 'complete');

      expect(incompleteSession).toBeDefined();
      expect(incompleteSession!.sessionId).toBe(sessionId);
      expect(incompleteSession!.finalPhase).toBe('analyze');

      // 6. Load latest checkpoint
      const latest = await recoveryRecorder.getLatestCheckpoint(sessionId);
      expect(latest!.sequence).toBe(3);
      expect(latest!.phase).toBe('analyze');

      // 7. Restore context
      const context = await recoveryReplayer.restoreFromCheckpoint(latest!);
      expect(context.phase).toBe('analyze');
      expect(context.findings).toHaveLength(1);
      expect(context.metrics.toolCalls).toBe(6);

      // 8. Can resume from here
      expect(context.sessionId).toBe(sessionId);
    });
  });
});
