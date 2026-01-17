/**
 * EP06 Session Analysis Tools - Session Indexer
 *
 * Indexes session log files into FTS5 database for full-text search.
 * Supports incremental indexing based on file modification time.
 *
 * @module src/tools/sessions/indexer
 */

import { Database } from 'bun:sqlite';
import { stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import type { SessionEntry, IndexedFile, IndexSessionsResult } from './types';
import { parseSessionFile } from './parser';
import { extractMetrics } from './metrics';
import {
  categorizeToolByName,
  extractSessionId,
  extractTextFromContent,
  DEFAULT_SESSIONS_DB_PATH,
} from './utils';
import { openDatabase, closeDatabase } from '../../persistence/sessions/fts';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for indexing a single file.
 */
export interface IndexFileOptions {
  /** Path to the FTS database */
  dbPath?: string;
  /** Force re-index even if file unchanged */
  force?: boolean;
}

/**
 * Result of indexing a single file.
 */
export interface IndexFileResult {
  /** Whether indexing was successful */
  success: boolean;
  /** Whether the file was skipped (already indexed, unchanged) */
  skipped: boolean;
  /** Number of entries indexed */
  entriesIndexed: number;
  /** Session ID extracted from the file */
  sessionId?: string;
  /** Errors encountered */
  errors: Array<{ message: string; line?: number }>;
}

/**
 * Options for batch indexing.
 */
export interface BatchIndexOptions {
  /** Path to the FTS database */
  dbPath?: string;
  /** Force re-index all files */
  force?: boolean;
  /** Maximum concurrent file processing */
  concurrency?: number;
  /** Progress callback */
  onProgress?: (processed: number, total: number) => void;
}

/**
 * Options for clearing the index.
 */
export interface ClearIndexOptions {
  /** Path to the FTS database */
  dbPath?: string;
}

// =============================================================================
// Single File Indexing
// =============================================================================

/**
 * Index a single session file into the FTS database.
 *
 * @param filePath - Path to the JSONL session file
 * @param projectPath - Project path for this session
 * @param options - Indexing options
 * @returns Result of indexing operation
 */
export async function indexSessionFile(
  filePath: string,
  projectPath: string,
  options: IndexFileOptions = {}
): Promise<IndexFileResult> {
  const dbPath = options.dbPath ?? DEFAULT_SESSIONS_DB_PATH;
  const force = options.force ?? false;

  // Check if file exists
  if (!existsSync(filePath)) {
    return {
      success: false,
      skipped: false,
      entriesIndexed: 0,
      errors: [{ message: `File not found: ${filePath}` }],
    };
  }

  // Get file stats for mtime comparison
  const fileStat = await stat(filePath);
  const lastModified = Math.floor(fileStat.mtimeMs);

  const db = openDatabase(dbPath);
  try {
    // Check if file is already indexed and unchanged
    if (!force) {
      const existing = db
        .query<{ last_modified: number }, [string]>(
          'SELECT last_modified FROM indexed_files WHERE file_path = ?'
        )
        .get(filePath);

      if (existing && existing.last_modified >= lastModified) {
        return {
          success: true,
          skipped: true,
          entriesIndexed: 0,
          errors: [],
        };
      }
    }

    // Parse the session file
    const parseResult = await parseSessionFile(filePath);
    const sessionId = parseResult.sessionId ?? extractSessionId(filePath) ?? 'unknown';

    // If re-indexing, clear old entries for this file
    clearFileEntries(db, filePath, sessionId);

    // Index entries in a transaction
    const result = indexEntriesTransaction(db, parseResult.entries, sessionId, projectPath, filePath);

    // Update indexed_files metadata
    updateIndexedFileMetadata(db, filePath, projectPath, lastModified, result.entriesIndexed);

    // Update sessions summary table
    updateSessionSummary(db, sessionId, projectPath, parseResult.entries);

    // Update session_tools table
    updateSessionTools(db, sessionId, parseResult.entries);

    return {
      success: true,
      skipped: false,
      entriesIndexed: result.entriesIndexed,
      sessionId,
      errors: result.errors,
    };
  } catch (error) {
    return {
      success: false,
      skipped: false,
      entriesIndexed: 0,
      errors: [{ message: error instanceof Error ? error.message : String(error) }],
    };
  } finally {
    closeDatabase(db);
  }
}

/**
 * Clear existing entries for a file/session.
 */
function clearFileEntries(db: Database, filePath: string, sessionId: string): void {
  // Delete from FTS table by file_path
  db.run('DELETE FROM session_entries WHERE file_path = ?', [filePath]);

  // Delete from session_tools for this session
  db.run('DELETE FROM session_tools WHERE session_id = ?', [sessionId]);

  // Delete session summary
  db.run('DELETE FROM sessions WHERE session_id = ?', [sessionId]);
}

/**
 * Index entries in a transaction.
 */
function indexEntriesTransaction(
  db: Database,
  entries: SessionEntry[],
  sessionId: string,
  projectPath: string,
  filePath: string
): { entriesIndexed: number; errors: Array<{ message: string; line?: number }> } {
  const errors: Array<{ message: string; line?: number }> = [];
  let entriesIndexed = 0;

  const insertStmt = db.prepare(`
    INSERT INTO session_entries (
      session_id, project_path, timestamp, role, content,
      tool_name, tool_input, tool_result, file_path, line_number
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    for (const entry of entries) {
      try {
        // Extract searchable content
        const content = extractSearchableContent(entry);
        const toolInfo = extractToolInfo(entry);
        const role = entry.message?.role ?? entry.type;

        insertStmt.run(
          sessionId,
          projectPath,
          entry.timestamp ?? '',
          role,
          content,
          toolInfo.name ?? '',
          toolInfo.input ?? '',
          toolInfo.result ?? '',
          filePath,
          entry.lineNumber ?? 0
        );

        entriesIndexed++;
      } catch (error) {
        const errorEntry: { message: string; line?: number } = {
          message: error instanceof Error ? error.message : String(error),
        };
        if (entry.lineNumber !== undefined) {
          errorEntry.line = entry.lineNumber;
        }
        errors.push(errorEntry);
      }
    }
  })();

  return { entriesIndexed, errors };
}

/**
 * Extract searchable content from an entry.
 */
function extractSearchableContent(entry: SessionEntry): string {
  const parts: string[] = [];

  // Add message content
  if (entry.message?.content) {
    const text = extractTextFromContent(entry.message.content);
    if (text) {
      parts.push(text);
    }
  }

  // Add summary content
  if (entry.summary) {
    parts.push(entry.summary);
  }

  // Add tool result content
  if (entry.toolResult?.content) {
    parts.push(entry.toolResult.content);
  }

  return parts.join(' ');
}

/**
 * Extract tool information from an entry.
 */
function extractToolInfo(entry: SessionEntry): {
  name: string | null;
  input: string | null;
  result: string | null;
} {
  let name: string | null = null;
  let input: string | null = null;
  let result: string | null = null;

  // Check for tool_use blocks in message content
  if (entry.message?.content) {
    for (const block of entry.message.content) {
      if (block.type === 'tool_use' && block.name) {
        name = block.name;
        if (block.input) {
          input = JSON.stringify(block.input);
        }
        break; // Take first tool use
      }
    }
  }

  // Check for tool result
  if (entry.toolResult?.content) {
    result = entry.toolResult.content;
  }

  return { name, input, result };
}

/**
 * Update indexed_files metadata table.
 */
function updateIndexedFileMetadata(
  db: Database,
  filePath: string,
  projectPath: string,
  lastModified: number,
  entryCount: number
): void {
  db.run(
    `INSERT OR REPLACE INTO indexed_files
     (file_path, project_path, last_modified, entry_count, indexed_at)
     VALUES (?, ?, ?, ?, ?)`,
    [filePath, projectPath, lastModified, entryCount, new Date().toISOString()]
  );
}

/**
 * Update sessions summary table.
 */
function updateSessionSummary(
  db: Database,
  sessionId: string,
  projectPath: string,
  entries: SessionEntry[]
): void {
  const metrics = extractMetrics(entries, sessionId, projectPath);

  db.run(
    `INSERT OR REPLACE INTO sessions
     (session_id, project_path, first_timestamp, last_timestamp,
      entry_count, input_tokens, output_tokens, cache_tokens, compression_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sessionId,
      projectPath,
      metrics.firstTimestamp,
      metrics.lastTimestamp,
      metrics.turnCount,
      metrics.inputTokens,
      metrics.outputTokens,
      metrics.cacheReadTokens + metrics.cacheCreationTokens,
      metrics.compressionCount,
    ]
  );
}

/**
 * Update session_tools table with tool usage.
 */
function updateSessionTools(db: Database, sessionId: string, entries: SessionEntry[]): void {
  const toolCounts = new Map<string, { category: string; count: number; errors: number }>();

  for (const entry of entries) {
    if (!entry.message?.content) continue;

    for (const block of entry.message.content) {
      if (block.type === 'tool_use' && block.name) {
        const toolName = block.name;
        const category = categorizeToolByName(toolName);
        const existing = toolCounts.get(toolName) ?? { category, count: 0, errors: 0 };
        existing.count++;
        toolCounts.set(toolName, existing);
      }
    }

    // Check for tool errors
    if (entry.toolResult?.isError && entry.message?.content) {
      for (const block of entry.message.content) {
        if (block.type === 'tool_use' && block.name) {
          const existing = toolCounts.get(block.name);
          if (existing) {
            existing.errors++;
          }
        }
      }
    }
  }

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO session_tools
    (session_id, tool_name, category, call_count, error_count)
    VALUES (?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    for (const [toolName, data] of toolCounts) {
      insertStmt.run(sessionId, toolName, data.category, data.count, data.errors);
    }
  })();
}

// =============================================================================
// Get Indexed File Info
// =============================================================================

/**
 * Get metadata about an indexed file.
 *
 * @param filePath - Path to the session file
 * @param options - Options including database path
 * @returns File metadata or null if not indexed
 */
export function getIndexedFileInfo(
  filePath: string,
  options: { dbPath?: string } = {}
): IndexedFile | null {
  const dbPath = options.dbPath ?? DEFAULT_SESSIONS_DB_PATH;

  const db = openDatabase(dbPath);
  try {
    const row = db
      .query<
        {
          file_path: string;
          project_path: string;
          last_modified: number;
          entry_count: number;
          indexed_at: string;
        },
        [string]
      >('SELECT * FROM indexed_files WHERE file_path = ?')
      .get(filePath);

    if (!row) {
      return null;
    }

    return {
      filePath: row.file_path,
      projectPath: row.project_path,
      lastModified: row.last_modified,
      entryCount: row.entry_count,
      indexedAt: row.indexed_at,
    };
  } finally {
    closeDatabase(db);
  }
}

// =============================================================================
// Batch Indexing
// =============================================================================

/**
 * Index multiple session files.
 *
 * @param files - Array of {path, projectPath} objects
 * @param options - Batch indexing options
 * @returns Result of batch indexing
 */
export async function indexSessions(
  files: Array<{ path: string; projectPath: string }>,
  options: BatchIndexOptions = {}
): Promise<IndexSessionsResult> {
  const { concurrency = 4, onProgress, dbPath, force } = options;

  const result: IndexSessionsResult = {
    filesIndexed: 0,
    filesSkipped: 0,
    entriesIndexed: 0,
    durationMs: 0,
    errors: [],
  };

  const startTime = Date.now();
  let processed = 0;

  // Process in batches for memory efficiency
  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    const indexOptions: IndexFileOptions = {};
    if (dbPath !== undefined) {
      indexOptions.dbPath = dbPath;
    }
    if (force !== undefined) {
      indexOptions.force = force;
    }

    const batchResults = await Promise.all(
      batch.map((file) => indexSessionFile(file.path, file.projectPath, indexOptions))
    );

    for (let j = 0; j < batchResults.length; j++) {
      const fileResult = batchResults[j]!;
      const file = batch[j]!;

      if (fileResult.success) {
        if (fileResult.skipped) {
          result.filesSkipped++;
        } else {
          result.filesIndexed++;
          result.entriesIndexed += fileResult.entriesIndexed;
        }
      } else {
        result.errors.push({
          filePath: file.path,
          error: fileResult.errors[0]?.message ?? 'Unknown error',
        });
      }

      processed++;
    }

    if (onProgress) {
      onProgress(processed, files.length);
    }
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

// =============================================================================
// Clear Index
// =============================================================================

/**
 * Clear all indexed data.
 *
 * @param options - Options including database path
 */
export function clearIndex(options: ClearIndexOptions = {}): void {
  const dbPath = options.dbPath ?? DEFAULT_SESSIONS_DB_PATH;

  const db = openDatabase(dbPath);
  try {
    db.transaction(() => {
      db.run('DELETE FROM session_entries');
      db.run('DELETE FROM session_tools');
      db.run('DELETE FROM sessions');
      db.run('DELETE FROM indexed_files');
    })();
  } finally {
    closeDatabase(db);
  }
}
