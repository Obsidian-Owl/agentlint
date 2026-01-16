/**
 * EP02 Orchestration Core - Session State Management
 *
 * Handles persistence and restoration of session state for crash recovery
 * and session resume functionality.
 *
 * Implementation tasks:
 * - T044: Create session-state.ts with save/load functions
 * - T046: buildStateSummary() for resume injection
 *
 * @module orchestration/session-state
 */

import { readdir, readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type {
  SessionState,
  SessionStateFile,
  FindingSummary,
} from './types';

// =============================================================================
// Constants
// =============================================================================

/**
 * Current version of the session state file format.
 */
export const SESSION_STATE_VERSION = '1.0.0' as const;

/**
 * Default directory for session storage.
 */
const DEFAULT_SESSIONS_DIR = join(homedir(), '.agentlint', 'sessions');

// =============================================================================
// Types
// =============================================================================

/**
 * Summary of session state for resume injection.
 */
export interface SessionSummary {
  /** Original task goal */
  taskGoal: string;
  /** Current analysis phase */
  currentPhase: string;
  /** Number of findings detected */
  findingsCount: number;
  /** Current checkpoint sequence */
  checkpointSequence: number;
  /** Elapsed time since session start */
  elapsedTime: string;
  /** Compressed finding summaries */
  findingSummaries: FindingSummary[];
  /** Formatted summary string for system prompt */
  formattedSummary: string;
}

// =============================================================================
// Directory Helpers
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
 * Get the file path for a session.
 *
 * @param sessionId - Session ID
 * @param baseDir - Base directory for sessions
 * @returns Full file path
 */
export function getSessionFilePath(sessionId: string, baseDir: string): string {
  return join(baseDir, `${sessionId}.json`);
}

/**
 * Ensure the sessions directory exists.
 *
 * @param dir - Directory path
 */
async function ensureDir(dir: string): Promise<void> {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

// =============================================================================
// Save / Load Functions (T044)
// =============================================================================

/**
 * Save session state to a JSON file.
 *
 * Creates a versioned file format for forward compatibility.
 *
 * @param state - Session state to save
 * @param baseDir - Base directory for sessions (default: ~/.agentlint/sessions)
 * @returns Path to saved file
 *
 * @example
 * ```typescript
 * const state = orchestrator.sessionState;
 * const path = await saveState(state);
 * console.log(`Session saved to ${path}`);
 * ```
 */
export async function saveState(
  state: SessionState,
  baseDir: string = DEFAULT_SESSIONS_DIR
): Promise<string> {
  await ensureDir(baseDir);

  const file: SessionStateFile = {
    version: SESSION_STATE_VERSION,
    sessionState: state,
  };

  const filePath = getSessionFilePath(state.id, baseDir);
  await writeFile(filePath, JSON.stringify(file, null, 2), 'utf-8');

  return filePath;
}

/**
 * Load session state from a JSON file.
 *
 * @param sessionId - Session ID to load
 * @param baseDir - Base directory for sessions (default: ~/.agentlint/sessions)
 * @returns Session state or null if not found
 *
 * @throws Error if file exists but is corrupted
 *
 * @example
 * ```typescript
 * const state = await loadState('session-abc-123');
 * if (state) {
 *   console.log(`Resuming from phase: ${state.phase}`);
 * }
 * ```
 */
export async function loadState(
  sessionId: string,
  baseDir: string = DEFAULT_SESSIONS_DIR
): Promise<SessionState | null> {
  const filePath = getSessionFilePath(sessionId, baseDir);

  if (!existsSync(filePath)) {
    return null;
  }

  const content = await readFile(filePath, 'utf-8');
  // Parse as unknown first for version validation
  const parsed = JSON.parse(content) as { version?: string; sessionState?: unknown };

  // Validate version (for future migrations)
  if (parsed.version !== SESSION_STATE_VERSION) {
    // Future: Add migration logic for older versions
    console.warn(
      `Session file version mismatch: expected ${SESSION_STATE_VERSION}, got ${String(parsed.version)}`
    );
  }

  // Cast to full type after validation
  const file = parsed as SessionStateFile;
  return file.sessionState;
}

/**
 * List all saved session IDs.
 *
 * @param baseDir - Base directory for sessions
 * @returns Array of session IDs
 */
export async function listSessions(
  baseDir: string = DEFAULT_SESSIONS_DIR
): Promise<string[]> {
  if (!existsSync(baseDir)) {
    return [];
  }

  const files = await readdir(baseDir);
  return files
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace('.json', ''));
}

/**
 * Delete a session file.
 *
 * @param sessionId - Session ID to delete
 * @param baseDir - Base directory for sessions
 * @returns True if deleted, false if not found
 */
export async function deleteSession(
  sessionId: string,
  baseDir: string = DEFAULT_SESSIONS_DIR
): Promise<boolean> {
  const filePath = getSessionFilePath(sessionId, baseDir);

  if (!existsSync(filePath)) {
    return false;
  }

  await unlink(filePath);
  return true;
}

// =============================================================================
// State Summary for Resume (T046)
// =============================================================================

/**
 * Build a summary of session state for injection on resume.
 *
 * The summary is used to restore agent context after resuming a session.
 * It provides essential information about the previous session state.
 *
 * @param state - Session state to summarize
 * @returns Session summary with formatted string
 *
 * @example
 * ```typescript
 * const summary = buildStateSummary(state);
 * console.log(summary.formattedSummary);
 * // [Session Resume Context]
 * // Task Goal: Analyze project configuration
 * // Current Phase: analysis
 * // Findings: 2
 * // Checkpoint: 5
 * // ...
 * ```
 */
export function buildStateSummary(state: SessionState): SessionSummary {
  // Calculate elapsed time
  const startTime = new Date(state.startedAt).getTime();
  const now = Date.now();
  const elapsedMs = now - startTime;
  const elapsedTime = formatElapsedTime(elapsedMs);

  // Build finding summaries
  const findingSummaries: FindingSummary[] = state.findings.map((f) => ({
    id: f.id,
    type: f.type,
    severity: f.severity,
    title: f.title,
  }));

  // Build formatted summary for system prompt
  const findingsList =
    findingSummaries.length > 0
      ? findingSummaries
          .map((f) => `  - [${f.severity.toUpperCase()}] ${f.title}`)
          .join('\n')
      : '  (none)';

  const formattedSummary = `[Session Resume Context]
Task Goal: ${state.taskGoal}
Current Phase: ${state.phase}
Findings: ${state.findings.length}
Checkpoint: ${state.checkpointSequence}
Elapsed: ${elapsedTime}

Previous Findings:
${findingsList}

Continue from where you left off. The session state has been restored.
[End Session Resume Context]`;

  return {
    taskGoal: state.taskGoal,
    currentPhase: state.phase,
    findingsCount: state.findings.length,
    checkpointSequence: state.checkpointSequence,
    elapsedTime,
    findingSummaries,
    formattedSummary,
  };
}

/**
 * Format elapsed time in a human-readable format.
 *
 * @param ms - Milliseconds elapsed
 * @returns Formatted time string
 */
function formatElapsedTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}
