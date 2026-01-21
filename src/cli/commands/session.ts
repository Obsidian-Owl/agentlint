/**
 * EP11 Quality & Security - Session Management Commands
 *
 * CLI commands for managing session recordings:
 * - list: List recorded sessions
 * - replay: Replay a session for debugging
 * - delete: Delete a recorded session
 * - cleanup: Remove old sessions based on retention policy
 *
 * @module cli/commands/session
 */

import type { GlobalOptions } from '../types';
import { createSessionRecorder, createSessionReplayer } from '../../orchestration/checkpoint';
import type { SessionSummary, ReplayContext } from '../../orchestration/checkpoint-types';

// =============================================================================
// Types
// =============================================================================

export type SessionListOptions = GlobalOptions;

export interface SessionReplayOptions extends GlobalOptions {
  sessionId: string;
  sequence?: number;
}

export interface SessionDeleteOptions extends GlobalOptions {
  sessionId: string;
  force?: boolean;
}

export interface SessionCleanupOptions extends GlobalOptions {
  days: number;
  dryRun?: boolean;
}

// =============================================================================
// Formatters
// =============================================================================

function formatPhase(phase: string): string {
  const phaseColors: Record<string, string> = {
    init: '\x1b[36m', // cyan
    scan: '\x1b[33m', // yellow
    analyze: '\x1b[34m', // blue
    recommend: '\x1b[35m', // magenta
    complete: '\x1b[32m', // green
  };
  const reset = '\x1b[0m';
  const color = phaseColors[phase] ?? '';
  return `${color}${phase}${reset}`;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatSessionSummary(session: SessionSummary, index: number): string {
  const lines = [
    `${index + 1}. Session: ${session.sessionId}`,
    `   Started: ${formatTimestamp(session.startedAt)}`,
    `   Last checkpoint: ${formatTimestamp(session.lastCheckpointAt)}`,
    `   Checkpoints: ${session.checkpointCount}`,
    `   Final phase: ${formatPhase(session.finalPhase)}`,
    `   Size: ${formatBytes(session.sizeBytes)}`,
  ];
  return lines.join('\n');
}

function formatReplayContext(context: ReplayContext): string {
  const lines = [
    `Session: ${context.sessionId}`,
    `Phase: ${formatPhase(context.phase)}`,
    `Findings: ${context.findings.length}`,
    `Metrics:`,
    `  Tool calls: ${context.metrics.toolCalls}`,
    `  LLM calls: ${context.metrics.llmCalls}`,
    `  Tokens used: ${context.metrics.tokensUsed}`,
    `  Elapsed: ${context.metrics.elapsedMs}ms`,
  ];

  if (context.workspaceState) {
    lines.push(`Workspace state: ${JSON.stringify(context.workspaceState, null, 2)}`);
  }

  return lines.join('\n');
}

// =============================================================================
// Commands
// =============================================================================

/**
 * List recorded sessions.
 */
export async function runSessionList(options: SessionListOptions): Promise<number> {
  const recorder = createSessionRecorder();

  try {
    const sessions = await recorder.listSessions();

    if (options.json) {
      console.log(JSON.stringify(sessions, null, 2));
      return 0;
    }

    if (sessions.length === 0) {
      console.log('No recorded sessions found.');
      return 0;
    }

    console.log(`Found ${sessions.length} recorded session(s):\n`);

    // Sort by last checkpoint (most recent first)
    const sorted = [...sessions].sort(
      (a, b) => new Date(b.lastCheckpointAt).getTime() - new Date(a.lastCheckpointAt).getTime()
    );

    for (let i = 0; i < sorted.length; i++) {
      console.log(formatSessionSummary(sorted[i]!, i));
      if (i < sorted.length - 1) {
        console.log('');
      }
    }

    return 0;
  } catch (error) {
    console.error(`Error listing sessions: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

/**
 * Replay a recorded session.
 */
export async function runSessionReplay(options: SessionReplayOptions): Promise<number> {
  const recorder = createSessionRecorder();
  const replayer = createSessionReplayer(recorder);

  try {
    // Check if session exists
    const canReplay = await replayer.canReplay(options.sessionId);
    if (!canReplay) {
      console.error(`Session not found: ${options.sessionId}`);
      return 1;
    }

    // Get checkpoint to replay from
    let checkpoint;
    if (options.sequence !== undefined) {
      checkpoint = await replayer.getStateAt(options.sessionId, options.sequence);
      if (!checkpoint) {
        console.error(`Checkpoint sequence ${options.sequence} not found in session ${options.sessionId}`);
        return 1;
      }
    } else {
      // Get latest checkpoint
      checkpoint = await recorder.getLatestCheckpoint(options.sessionId);
      if (!checkpoint) {
        console.error(`No checkpoints found in session ${options.sessionId}`);
        return 1;
      }
    }

    // Restore context
    const context = replayer.restoreFromCheckpoint(checkpoint);

    if (options.json) {
      console.log(JSON.stringify(context, null, 2));
      return 0;
    }

    console.log('Replay Context:');
    console.log('===============\n');
    console.log(formatReplayContext(context));

    if (context.findings.length > 0) {
      console.log('\nFindings at checkpoint:');
      for (const finding of context.findings) {
        console.log(`  - ${finding.id}: ${finding.type} at ${finding.location.file}:${finding.location.line}`);
      }
    }

    console.log('\n✓ Session context restored. Analysis can resume from this state.');

    return 0;
  } catch (error) {
    console.error(`Error replaying session: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

/**
 * Delete a recorded session.
 */
export async function runSessionDelete(options: SessionDeleteOptions): Promise<number> {
  const recorder = createSessionRecorder();
  const replayer = createSessionReplayer(recorder);

  try {
    // Check if session exists
    const canReplay = await replayer.canReplay(options.sessionId);
    if (!canReplay) {
      console.error(`Session not found: ${options.sessionId}`);
      return 1;
    }

    // Confirm unless force flag
    if (!options.force) {
      const sessions = await recorder.listSessions();
      const session = sessions.find((s) => s.sessionId === options.sessionId);

      if (session) {
        console.log(`About to delete session:`);
        console.log(`  ID: ${session.sessionId}`);
        console.log(`  Checkpoints: ${session.checkpointCount}`);
        console.log(`  Size: ${formatBytes(session.sizeBytes)}`);
        console.log('');

        // In a real CLI, we'd prompt for confirmation
        // For now, just note that force is required
        console.log('Use --force to confirm deletion.');
        return 1;
      }
    }

    recorder.deleteSession(options.sessionId);

    if (!options.json) {
      console.log(`✓ Session ${options.sessionId} deleted.`);
    } else {
      console.log(JSON.stringify({ deleted: options.sessionId }));
    }

    return 0;
  } catch (error) {
    console.error(`Error deleting session: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

/**
 * Clean up old sessions.
 */
export async function runSessionCleanup(options: SessionCleanupOptions): Promise<number> {
  const recorder = createSessionRecorder();

  try {
    if (options.dryRun) {
      // Show what would be deleted
      const sessions = await recorder.listSessions();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - options.days);

      const toDelete = sessions.filter((s) => new Date(s.lastCheckpointAt) < cutoffDate);

      if (toDelete.length === 0) {
        console.log(`No sessions older than ${options.days} days found.`);
        return 0;
      }

      if (options.json) {
        console.log(
          JSON.stringify(
            {
              dryRun: true,
              sessionsToDelete: toDelete.map((s) => s.sessionId),
              count: toDelete.length,
            },
            null,
            2
          )
        );
        return 0;
      }

      console.log(`Would delete ${toDelete.length} session(s) older than ${options.days} days:\n`);
      for (const session of toDelete) {
        console.log(`  - ${session.sessionId} (last checkpoint: ${formatTimestamp(session.lastCheckpointAt)})`);
      }

      return 0;
    }

    // Actually clean up
    const deletedCount = await recorder.cleanupOldCheckpoints(options.days);

    if (options.json) {
      console.log(JSON.stringify({ deletedCount }));
      return 0;
    }

    if (deletedCount === 0) {
      console.log(`No sessions older than ${options.days} days found.`);
    } else {
      console.log(`✓ Deleted ${deletedCount} session(s) older than ${options.days} days.`);
    }

    return 0;
  } catch (error) {
    console.error(`Error cleaning up sessions: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
