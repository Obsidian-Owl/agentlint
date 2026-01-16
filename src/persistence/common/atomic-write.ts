/**
 * EP03 Persistence Layer - Atomic Write Utilities
 *
 * Provides crash-safe file writing using the temp file + rename pattern.
 * This ensures that files are never partially written on disk.
 *
 * @module persistence/common/atomic-write
 */

import { rename, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';

import { AtomicWriteError, PermissionError } from '../../errors/persistence';
import type { AtomicWriteResult } from '../types';
import { ensureDir } from './directories';

// =============================================================================
// Error Code Detection
// =============================================================================

/**
 * Detect if an error is a disk full error.
 * Checks for ENOSPC (No space left on device) and EDQUOT (Disk quota exceeded).
 */
function isDiskFullError(error: unknown): boolean {
  if (error instanceof Error) {
    const nodeError = error as NodeJS.ErrnoException;
    return nodeError.code === 'ENOSPC' || nodeError.code === 'EDQUOT';
  }
  return false;
}

/**
 * Detect if an error is a permission error.
 * Checks for EACCES (Permission denied) and EPERM (Operation not permitted).
 */
function isPermissionDeniedError(error: unknown): boolean {
  if (error instanceof Error) {
    const nodeError = error as NodeJS.ErrnoException;
    return nodeError.code === 'EACCES' || nodeError.code === 'EPERM';
  }
  return false;
}

/**
 * Detect if an error is a read-only filesystem error.
 */
function isReadOnlyFilesystemError(error: unknown): boolean {
  if (error instanceof Error) {
    const nodeError = error as NodeJS.ErrnoException;
    return nodeError.code === 'EROFS';
  }
  return false;
}

/**
 * Get a user-friendly error message based on the error type.
 */
function getErrorMessage(error: unknown, path: string, operation: string): string {
  if (isDiskFullError(error)) {
    return `Disk full: Cannot ${operation} to ${path}. Free up disk space and try again.`;
  }
  if (isPermissionDeniedError(error)) {
    return `Permission denied: Cannot ${operation} to ${path}. Check file permissions.`;
  }
  if (isReadOnlyFilesystemError(error)) {
    return `Read-only filesystem: Cannot ${operation} to ${path}.`;
  }
  if (error instanceof Error) {
    return `Failed to ${operation}: ${path} - ${error.message}`;
  }
  return `Failed to ${operation}: ${path}`;
}

// =============================================================================
// Atomic Write Implementation
// =============================================================================

/**
 * Options for atomic write operations.
 */
export interface AtomicWriteOptions {
  /** Create parent directories if needed (default: true) */
  ensureDir?: boolean;
  /** File permission mode (default: 0o600) */
  mode?: number;
  /** Whether to fsync after write (default: false, WAL handles durability) */
  fsync?: boolean;
}

/**
 * Write content to a file atomically using temp file + rename.
 * This ensures the file is never partially written on disk.
 *
 * Pattern:
 * 1. Write content to temporary file
 * 2. Rename temp file to target path (atomic on POSIX)
 * 3. Clean up temp file on failure
 *
 * @param path - Target file path
 * @param content - Content to write (string or Buffer)
 * @param options - Write options
 * @throws {AtomicWriteError} If write fails at any stage
 */
export async function atomicWrite(
  path: string,
  content: string | Buffer,
  options: AtomicWriteOptions = {}
): Promise<void> {
  const { ensureDir: createDir = true, mode = 0o600 } = options;

  // Generate unique temp file path
  const tmpPath = generateTempPath(path);

  try {
    // Ensure parent directory exists
    if (createDir) {
      await ensureDir(dirname(path));
    }

    // Write to temp file
    try {
      await Bun.write(tmpPath, content, { mode });
    } catch (error) {
      // Check for specific error types and provide helpful messages
      if (isPermissionDeniedError(error)) {
        throw new PermissionError(
          path,
          'write',
          getErrorMessage(error, path, 'write'),
          error instanceof Error ? error : undefined
        );
      }
      throw new AtomicWriteError(
        path,
        'write',
        getErrorMessage(error, tmpPath, 'write'),
        error instanceof Error ? error : undefined
      );
    }

    // Atomic rename to target path
    try {
      await rename(tmpPath, path);
    } catch (error) {
      // Check for specific error types
      if (isPermissionDeniedError(error)) {
        throw new PermissionError(
          path,
          'write',
          getErrorMessage(error, path, 'rename'),
          error instanceof Error ? error : undefined
        );
      }
      throw new AtomicWriteError(
        path,
        'rename',
        getErrorMessage(error, path, 'rename'),
        error instanceof Error ? error : undefined
      );
    }
  } catch (error) {
    // Clean up temp file on failure
    await cleanupTempFile(tmpPath);

    // Re-throw if already an AtomicWriteError or PermissionError
    if (error instanceof AtomicWriteError || error instanceof PermissionError) {
      throw error;
    }

    throw new AtomicWriteError(
      path,
      'unknown',
      getErrorMessage(error, path, 'write'),
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Extended result type with error categorization.
 */
export interface AtomicWriteResultExtended extends AtomicWriteResult {
  /** Error category if applicable */
  errorCategory?: 'permission' | 'disk_full' | 'readonly_fs' | 'other';
}

/**
 * Write content to a file atomically and return a result object.
 * This is a non-throwing version that returns success/failure.
 *
 * @param path - Target file path
 * @param content - Content to write
 * @param options - Write options
 * @returns Result object with success status and error categorization
 */
export async function atomicWriteSafe(
  path: string,
  content: string | Buffer,
  options: AtomicWriteOptions = {}
): Promise<AtomicWriteResultExtended> {
  try {
    await atomicWrite(path, content, options);
    return { success: true, path };
  } catch (error) {
    const result: AtomicWriteResultExtended = {
      success: false,
      path,
      error: error instanceof Error ? error.message : String(error),
    };

    // Categorize the error for better handling
    if (error instanceof PermissionError || isPermissionDeniedError(error)) {
      result.errorCategory = 'permission';
    } else if (isDiskFullError(error)) {
      result.errorCategory = 'disk_full';
    } else if (isReadOnlyFilesystemError(error)) {
      result.errorCategory = 'readonly_fs';
    } else {
      result.errorCategory = 'other';
    }

    return result;
  }
}

/**
 * Write JSON content to a file atomically.
 * Automatically stringifies the object with pretty formatting.
 *
 * @param path - Target file path
 * @param data - Object to serialize as JSON
 * @param options - Write options
 * @throws {AtomicWriteError} If write fails
 */
export async function atomicWriteJson<T>(
  path: string,
  data: T,
  options: AtomicWriteOptions = {}
): Promise<void> {
  const content = JSON.stringify(data, null, 2);
  await atomicWrite(path, content, options);
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate a unique temporary file path.
 * Uses timestamp and random suffix to avoid collisions.
 *
 * @param targetPath - The target file path
 * @returns Unique temp file path
 */
function generateTempPath(targetPath: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `${targetPath}.tmp.${timestamp}.${random}`;
}

/**
 * Clean up a temp file if it exists.
 * Silently ignores errors (file may not exist).
 *
 * @param tmpPath - Path to temp file
 */
async function cleanupTempFile(tmpPath: string): Promise<void> {
  try {
    if (existsSync(tmpPath)) {
      await unlink(tmpPath);
    }
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Clean up orphaned temp files in a directory.
 * Call this periodically to remove failed write artifacts.
 *
 * @param dir - Directory to clean
 * @param maxAgeMs - Maximum age in milliseconds (default: 1 hour)
 * @returns Number of files cleaned
 */
export async function cleanupOrphanedTempFiles(
  dir: string,
  maxAgeMs: number = 60 * 60 * 1000
): Promise<number> {
  const glob = new Bun.Glob('*.tmp.*');
  let cleaned = 0;

  try {
    for await (const file of glob.scan({ cwd: dir, absolute: true })) {
      // Extract timestamp from filename
      const match = file.match(/\.tmp\.(\d+)\./);
      if (match && match[1]) {
        const fileTimestamp = parseInt(match[1], 10);
        const age = Date.now() - fileTimestamp;

        if (age > maxAgeMs) {
          try {
            await unlink(file);
            cleaned++;
          } catch {
            // Ignore individual file errors
          }
        }
      }
    }
  } catch {
    // Ignore glob errors (directory may not exist)
  }

  return cleaned;
}
