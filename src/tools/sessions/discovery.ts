/**
 * EP06 Session Analysis Tools - Session Discovery
 *
 * Discovers Claude Code session log files at ~/.claude/projects/.
 * Handles path encoding/decoding, edge cases, and permission errors.
 *
 * @module src/tools/sessions/discovery
 */

import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { SessionFile, DiscoverSessionsOptions, DiscoverSessionsResult } from './types';
import { DEFAULT_CLAUDE_PROJECTS_DIR, decodeProjectPath, isSessionLogFile } from './utils';

// =============================================================================
// Session Discovery
// =============================================================================

/**
 * Discover Claude Code session log files.
 *
 * Scans the Claude projects directory for JSONL session files,
 * decodes project paths, and returns file metadata.
 *
 * @param options - Discovery options
 * @returns Discovered session files with metadata
 *
 * @example
 * ```typescript
 * // Discover all sessions
 * const result = await discoverSessions();
 *
 * // Discover sessions for a specific project
 * const result = await discoverSessions({
 *   projectPath: '/Users/me/Projects/myapp'
 * });
 * ```
 */
export async function discoverSessions(
  options: DiscoverSessionsOptions = {}
): Promise<DiscoverSessionsResult> {
  const projectsDir = options.projectsDir ?? DEFAULT_CLAUDE_PROJECTS_DIR;
  const filterProjectPath = options.projectPath;

  const files: SessionFile[] = [];
  const projectSet = new Set<string>();

  try {
    // Read project directories
    const projectDirs = await readProjectDirectories(projectsDir);

    for (const encodedPath of projectDirs) {
      const decodedPath = decodeProjectPath(encodedPath);

      // Filter by project path if specified
      if (filterProjectPath && decodedPath !== filterProjectPath) {
        continue;
      }

      // Scan project directory for session files
      const projectDir = join(projectsDir, encodedPath);
      const sessionFiles = await discoverSessionsInProject(projectDir, encodedPath, decodedPath);

      if (sessionFiles.length > 0) {
        files.push(...sessionFiles);
        projectSet.add(decodedPath);
      }
    }
  } catch (error) {
    // Handle directory not found or permission denied
    if (isNodeError(error) && (error.code === 'ENOENT' || error.code === 'EACCES')) {
      // Return empty result for non-existent or inaccessible directories
      return {
        files: [],
        totalFiles: 0,
        totalSize: 0,
        projects: [],
      };
    }
    throw error;
  }

  // Sort by lastModified descending (newest first)
  files.sort((a, b) => b.lastModified - a.lastModified);

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const projects = Array.from(projectSet).sort();

  return {
    files,
    totalFiles: files.length,
    totalSize,
    projects,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Read project directories from the Claude projects directory.
 *
 * @param projectsDir - Path to Claude projects directory
 * @returns Array of encoded project directory names
 */
async function readProjectDirectories(projectsDir: string): Promise<string[]> {
  try {
    const entries = await readdir(projectsDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('-'))
      .map((entry) => entry.name);
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * Discover session files within a project directory.
 *
 * @param projectDir - Absolute path to project directory
 * @param encodedPath - Encoded project path (directory name)
 * @param decodedPath - Decoded project path
 * @returns Array of session files
 */
async function discoverSessionsInProject(
  projectDir: string,
  encodedPath: string,
  decodedPath: string
): Promise<SessionFile[]> {
  const sessionFiles: SessionFile[] = [];

  try {
    const entries = await readdir(projectDir, { withFileTypes: true });

    for (const entry of entries) {
      // Only process files with valid session log names
      if (!entry.isFile() || !isSessionLogFile(entry.name)) {
        continue;
      }

      const filePath = join(projectDir, entry.name);

      try {
        const fileStat = await stat(filePath);

        sessionFiles.push({
          path: filePath,
          projectPath: decodedPath,
          encodedPath,
          size: fileStat.size,
          lastModified: Math.floor(fileStat.mtimeMs),
          entryCount: null, // Set after indexing
        });
      } catch (error) {
        // Skip files we can't stat (permission denied, etc.)
        if (isNodeError(error) && (error.code === 'EACCES' || error.code === 'ENOENT')) {
          continue;
        }
        throw error;
      }
    }
  } catch (error) {
    // Handle permission denied for project directory
    if (isNodeError(error) && error.code === 'EACCES') {
      return [];
    }
    throw error;
  }

  return sessionFiles;
}

/**
 * Type guard for Node.js errors with code property.
 */
function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

/**
 * Get the default Claude projects directory path.
 *
 * @returns Path to ~/.claude/projects/
 */
export function getDefaultProjectsDir(): string {
  return DEFAULT_CLAUDE_PROJECTS_DIR;
}

/**
 * Check if a directory is a valid Claude projects directory.
 *
 * @param dirPath - Path to check
 * @returns True if the directory exists and is accessible
 */
export async function isValidProjectsDir(dirPath: string): Promise<boolean> {
  try {
    const stats = await stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}
