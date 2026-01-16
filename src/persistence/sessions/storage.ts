/**
 * EP03 Persistence Layer - Session Storage
 *
 * Provides atomic file operations for session state persistence:
 * save, load, findIncomplete (crash recovery), cleanup (retention).
 *
 * Uses atomic writes (temp file + rename) for crash safety.
 *
 * @module persistence/sessions/storage
 */

import { existsSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

import type { SessionState } from '../../orchestration/types';
import type { IncompleteSessionInfo, SaveStateOptions, LoadStateOptions } from '../types';
import { ensureDir, atomicWriteJson } from '../common';
import { parseSessionStateFile } from '../schemas';

// =============================================================================
// Constants
// =============================================================================

/** Current session state file format version */
export const SESSION_STATE_VERSION = '1.0.0';

/** Default directory for session storage */
const DEFAULT_SESSIONS_DIR = join(homedir(), '.agentlint', 'sessions');

/** Default retention period in days for cleanup */
const DEFAULT_RETENTION_DAYS = 30;

/** Phases that are considered complete (won't be returned by findIncomplete) */
const COMPLETE_PHASES = ['complete', 'completed', 'done'];

// =============================================================================
// Types
// =============================================================================

/**
 * File format for persisted session state.
 */
interface SessionStateFile {
  /** File format version */
  version: string;
  /** The session state */
  sessionState: SessionState;
}

/**
 * Extended options for save operations.
 */
interface SaveSessionOptions extends SaveStateOptions {
  /** Update lastCheckpointAt timestamp (default: false) */
  updateCheckpointTime?: boolean;
}

/**
 * Options for finding incomplete sessions.
 */
interface FindIncompleteOptions {
  /** Base directory for sessions */
  baseDir?: string;
}

/**
 * Options for cleanup operation.
 */
interface CleanupOptions {
  /** Base directory for sessions */
  baseDir?: string;
  /** Retention period in days (default: 30) */
  retentionDays?: number;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Get the sessions directory path.
 *
 * @param baseDir - Custom base directory (optional)
 * @returns Path to sessions directory
 */
export function getSessionsDir(baseDir?: string): string {
  return baseDir ?? DEFAULT_SESSIONS_DIR;
}

/**
 * Save session state to disk with atomic write.
 *
 * Creates the session JSON file using atomic write pattern
 * (temp file + rename) for crash safety.
 *
 * @param state - The session state to save
 * @param options - Storage options
 * @returns Path to the saved session file
 */
export async function saveSessionState(
  state: SessionState,
  options: SaveSessionOptions = {}
): Promise<string> {
  const baseDir = options.baseDir ?? DEFAULT_SESSIONS_DIR;

  // Update lastCheckpointAt if requested
  const stateToSave: SessionState = options.updateCheckpointTime
    ? { ...state, lastCheckpointAt: new Date().toISOString() }
    : state;

  // Ensure directory exists
  await ensureDir(baseDir);

  // Create file format wrapper
  const fileContent: SessionStateFile = {
    version: SESSION_STATE_VERSION,
    sessionState: stateToSave,
  };

  // Write session file atomically
  const filePath = join(baseDir, `${state.id}.json`);
  await atomicWriteJson(filePath, fileContent);

  return filePath;
}

/**
 * Load session state by ID.
 *
 * @param sessionId - The session UUID
 * @param options - Storage options
 * @returns The session state, or null if not found or invalid
 */
export async function loadSessionState(
  sessionId: string,
  options: LoadStateOptions = {}
): Promise<SessionState | null> {
  const baseDir = options.baseDir ?? DEFAULT_SESSIONS_DIR;
  const filePath = join(baseDir, `${sessionId}.json`);

  if (!existsSync(baseDir) || !existsSync(filePath)) {
    return null;
  }

  try {
    const content = await Bun.file(filePath).text();
    const data = JSON.parse(content);
    const parsed = parseSessionStateFile(data);

    if (!parsed) {
      return null;
    }

    // Log version mismatch warning but still return data (best-effort parsing)
    if (parsed.version !== SESSION_STATE_VERSION) {
      console.warn(
        `Session file version mismatch: expected ${SESSION_STATE_VERSION}, got ${parsed.version}`
      );
    }

    // Cast from Zod inferred type to our SessionState type
    return parsed.sessionState as unknown as SessionState;
  } catch {
    // Invalid JSON or parse error
    return null;
  }
}

/**
 * List all session IDs in the storage directory.
 *
 * @param options - Storage options
 * @returns Array of session UUIDs
 */
export async function listSessionIds(options: LoadStateOptions = {}): Promise<string[]> {
  const baseDir = options.baseDir ?? DEFAULT_SESSIONS_DIR;

  if (!existsSync(baseDir)) {
    return [];
  }

  const files = readdirSync(baseDir);
  return files.filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
}

/**
 * Delete a session state file.
 *
 * @param sessionId - The session UUID
 * @param options - Storage options
 * @returns True if deleted, false if not found
 */
export async function deleteSessionState(
  sessionId: string,
  options: LoadStateOptions = {}
): Promise<boolean> {
  const baseDir = options.baseDir ?? DEFAULT_SESSIONS_DIR;
  const filePath = join(baseDir, `${sessionId}.json`);

  if (!existsSync(filePath)) {
    return false;
  }

  unlinkSync(filePath);
  return true;
}

/**
 * Find incomplete sessions for crash recovery.
 *
 * Returns sessions that are not in a "complete" phase, ordered by
 * lastCheckpointAt (most recent first).
 *
 * @param options - Options for finding incomplete sessions
 * @returns Array of incomplete session info, sorted by most recent first
 */
export async function findIncomplete(
  options: FindIncompleteOptions = {}
): Promise<IncompleteSessionInfo[]> {
  const baseDir = options.baseDir ?? DEFAULT_SESSIONS_DIR;

  if (!existsSync(baseDir)) {
    return [];
  }

  const sessionIds = await listSessionIds({ baseDir });
  const incomplete: IncompleteSessionInfo[] = [];

  for (const sessionId of sessionIds) {
    const state = await loadSessionState(sessionId, { baseDir });

    if (!state) {
      // Skip corrupted files
      continue;
    }

    // Check if session is incomplete (not in complete phase)
    if (!isComplete(state.phase)) {
      incomplete.push({
        sessionId: state.id,
        state,
        filePath: join(baseDir, `${sessionId}.json`),
        lastCheckpointAt: state.lastCheckpointAt,
      });
    }
  }

  // Sort by lastCheckpointAt descending (most recent first)
  incomplete.sort((a, b) => {
    const aTime = a.lastCheckpointAt ? new Date(a.lastCheckpointAt).getTime() : 0;
    const bTime = b.lastCheckpointAt ? new Date(b.lastCheckpointAt).getTime() : 0;
    return bTime - aTime;
  });

  return incomplete;
}

/**
 * Clean up old completed sessions.
 *
 * Deletes sessions that:
 * 1. Are in a "complete" phase (incomplete sessions are preserved)
 * 2. Are older than the retention period
 *
 * @param options - Cleanup options
 * @returns Number of sessions deleted
 */
export async function cleanup(options: CleanupOptions = {}): Promise<number> {
  const baseDir = options.baseDir ?? DEFAULT_SESSIONS_DIR;
  const retentionDays = options.retentionDays ?? DEFAULT_RETENTION_DAYS;

  if (!existsSync(baseDir)) {
    return 0;
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  const cutoffTime = cutoffDate.getTime();

  const sessionIds = await listSessionIds({ baseDir });
  let deleted = 0;

  for (const sessionId of sessionIds) {
    const state = await loadSessionState(sessionId, { baseDir });

    if (!state) {
      // Skip corrupted files - don't delete them
      continue;
    }

    // Only delete complete sessions
    if (!isComplete(state.phase)) {
      continue;
    }

    // Check age based on lastCheckpointAt or startedAt
    const sessionTime = new Date(state.lastCheckpointAt ?? state.startedAt).getTime();

    if (sessionTime < cutoffTime) {
      const filePath = join(baseDir, `${sessionId}.json`);
      unlinkSync(filePath);
      deleted++;
    }
  }

  return deleted;
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Check if a phase is considered complete.
 */
function isComplete(phase: string): boolean {
  return COMPLETE_PHASES.includes(phase.toLowerCase());
}
