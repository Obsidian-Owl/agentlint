/**
 * Session ID Resolution Helper
 *
 * Resolves session IDs or numeric IDs to file paths for session tools.
 * Allows users to specify either a direct file path OR a session ID.
 *
 * @module sessions/tools/session-resolver
 */

import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { getSessionsDir } from '../../persistence/common/directories';

/**
 * Result of session resolution.
 */
export interface SessionResolveResult {
  /** Whether resolution succeeded */
  success: boolean;
  /** Resolved file path (if success) */
  filePath?: string;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Resolve a session identifier to a file path.
 *
 * Supports three input formats:
 * 1. Direct file path (e.g., "/path/to/session.jsonl")
 * 2. Session UUID (e.g., "session-abc123...")
 * 3. Numeric session ID from database (e.g., "12345")
 *
 * @param identifier - Session identifier (file path, UUID, or numeric ID)
 * @param dbPath - Optional path to sessions database
 * @returns Resolution result with file path or error
 */
export function resolveSessionIdentifier(
  identifier: string,
  dbPath?: string
): SessionResolveResult {
  // If the identifier exists as a file path, use it directly
  if (existsSync(identifier)) {
    return {
      success: true,
      filePath: identifier,
    };
  }

  // Try to resolve as session ID via database lookup
  const resolvedPath = lookupSessionInDatabase(identifier, dbPath);
  if (resolvedPath) {
    return {
      success: true,
      filePath: resolvedPath,
    };
  }

  // Fallback: try to construct path from session ID
  // Assume format: session-{uuid}.jsonl in sessions directory
  if (identifier.startsWith('session-')) {
    const sessionsDir = getSessionsDir();
    const candidatePath = join(sessionsDir, `${identifier}.jsonl`);
    if (existsSync(candidatePath)) {
      return {
        success: true,
        filePath: candidatePath,
      };
    }
  }

  // All resolution methods failed
  return {
    success: false,
    error: `Could not resolve session identifier: ${identifier}. Not found as file path, database entry, or session directory file.`,
  };
}

/**
 * Look up session file path in the database.
 *
 * @param sessionId - Session UUID or numeric ID
 * @param dbPath - Optional path to sessions database
 * @returns File path if found, undefined otherwise
 */
function lookupSessionInDatabase(sessionId: string, dbPath?: string): string | undefined {
  try {
    // Default database path
    const resolvedDbPath = dbPath ?? join(getSessionsDir(), '..', 'sessions.db');

    if (!existsSync(resolvedDbPath)) {
      return undefined;
    }

    const db = new Database(resolvedDbPath, { readonly: true });

    try {
      // Try to find file path via indexed_files table
      // The file_path column stores the original session file path
      const result = db
        .prepare(
          `
          SELECT DISTINCT if.file_path
          FROM indexed_files if
          JOIN sessions s ON s.session_id = if.file_path
          WHERE s.session_id = ? OR s.session_id LIKE ?
          LIMIT 1
        `
        )
        .get(sessionId, `%${sessionId}%`) as { file_path: string } | undefined;

      return result?.file_path;
    } finally {
      db.close();
    }
  } catch {
    // Database lookup failed - return undefined to try other methods
    return undefined;
  }
}
