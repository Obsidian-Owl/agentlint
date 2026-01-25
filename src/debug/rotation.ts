/**
 * Log Rotation
 *
 * Implements log rotation following the OpenCode pattern:
 * - Keep last N log files (default: 10)
 * - Optional total size cap
 * - Clean up on startup
 *
 * @module debug/rotation
 */

import { existsSync, readdirSync, rmSync, lstatSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getDefaultLogDir } from './logger';

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration for log rotation.
 */
export interface LogRotationConfig {
  /** Maximum number of log files to keep (default: 10) */
  maxFiles: number;
  /** Maximum total size in bytes (optional, default: 500MB) */
  maxSizeBytes?: number;
  /** Log directory (default: ~/.agentlint/logs) */
  logDir?: string;
}

/**
 * Result of a rotation operation.
 */
export interface RotationResult {
  /** Number of files deleted */
  deletedCount: number;
  /** Total bytes freed */
  bytesFreed: number;
  /** Remaining file count */
  remainingCount: number;
  /** Remaining total size in bytes */
  remainingBytes: number;
}

/**
 * Information about a log file.
 */
interface LogFileInfo {
  name: string;
  path: string;
  size: number;
  mtime: Date;
}

// =============================================================================
// Constants
// =============================================================================

/** Default maximum number of log files to keep */
export const DEFAULT_MAX_FILES = 10;

/** Default maximum total size in bytes (500MB) */
export const DEFAULT_MAX_SIZE_BYTES = 500 * 1024 * 1024;

/** Log file extension pattern */
const LOG_FILE_PATTERN = /\.ndjson$/;

// =============================================================================
// Implementation
// =============================================================================

/**
 * Get information about all log files in the directory.
 * Sorted by modification time (oldest first).
 */
function getLogFiles(logDir: string): LogFileInfo[] {
  if (!existsSync(logDir)) {
    return [];
  }

  const files: LogFileInfo[] = [];

  for (const name of readdirSync(logDir)) {
    if (!LOG_FILE_PATTERN.test(name)) {
      continue;
    }

    const path = join(logDir, name);
    try {
      // Use lstatSync first to detect symlinks (defense-in-depth)
      const lstats = lstatSync(path);
      if (lstats.isSymbolicLink()) {
        // Skip symlinks entirely - don't follow them
        continue;
      }
      if (lstats.isFile()) {
        files.push({
          name,
          path,
          size: lstats.size,
          mtime: lstats.mtime,
        });
      }
    } catch {
      // Skip files we can't stat
    }
  }

  // Sort by modification time (oldest first)
  files.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());

  return files;
}

/**
 * Delete log files that exceed the retention policy.
 *
 * Follows OpenCode pattern:
 * - Keep last N files (default: 10)
 * - If total size exceeds maxSizeBytes, delete oldest files until under limit
 *
 * @param config - Rotation configuration
 * @returns Result of the rotation operation
 */
export function rotateLogFiles(config: Partial<LogRotationConfig> = {}): RotationResult {
  const logDir = config.logDir ?? getDefaultLogDir();
  const maxFiles = config.maxFiles ?? DEFAULT_MAX_FILES;
  const maxSizeBytes = config.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;

  // Ensure directory exists with owner-only permissions (defense-in-depth)
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true, mode: 0o700 });
    return {
      deletedCount: 0,
      bytesFreed: 0,
      remainingCount: 0,
      remainingBytes: 0,
    };
  }

  const files = getLogFiles(logDir);
  let deletedCount = 0;
  let bytesFreed = 0;

  // Calculate total size
  let totalSize = files.reduce((sum, f) => sum + f.size, 0);

  // Delete oldest files until we're under the file count limit
  while (files.length > maxFiles) {
    const oldest = files.shift();
    if (oldest) {
      try {
        rmSync(oldest.path);
        deletedCount++;
        bytesFreed += oldest.size;
        totalSize -= oldest.size;
      } catch {
        // Skip files we can't delete
      }
    }
  }

  // Delete oldest files until we're under the size limit
  while (totalSize > maxSizeBytes && files.length > 1) {
    const oldest = files.shift();
    if (oldest) {
      try {
        rmSync(oldest.path);
        deletedCount++;
        bytesFreed += oldest.size;
        totalSize -= oldest.size;
      } catch {
        // Skip files we can't delete
      }
    }
  }

  return {
    deletedCount,
    bytesFreed,
    remainingCount: files.length,
    remainingBytes: totalSize,
  };
}

/**
 * Log statistics result type.
 */
export interface LogStats {
  fileCount: number;
  totalBytes: number;
  oldestFile?: string;
  newestFile?: string;
}

/**
 * Get statistics about the current log files.
 */
export function getLogStats(logDir?: string): LogStats {
  const dir = logDir ?? getDefaultLogDir();
  const files = getLogFiles(dir);

  if (files.length === 0) {
    return {
      fileCount: 0,
      totalBytes: 0,
    };
  }

  const result: LogStats = {
    fileCount: files.length,
    totalBytes: files.reduce((sum, f) => sum + f.size, 0),
  };

  const oldest = files[0];
  const newest = files[files.length - 1];

  if (oldest) {
    result.oldestFile = oldest.name;
  }
  if (newest) {
    result.newestFile = newest.name;
  }

  return result;
}

/**
 * Clean up old log files on startup.
 * This is called automatically when the logger is initialized.
 *
 * @param config - Rotation configuration
 * @returns Result of the rotation operation
 */
export function cleanupLogsOnStartup(config?: Partial<LogRotationConfig>): RotationResult {
  return rotateLogFiles(config);
}
