/**
 * EP03 Persistence Layer - Directory Utilities
 *
 * Provides directory initialization and path helpers for the persistence layer.
 * All directories are created with restricted permissions (0700) by default.
 *
 * @module persistence/common/directories
 */

import { mkdir } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

import { DirectoryError } from '../../errors/persistence';
import { DEFAULT_PERSISTENCE_CONFIG } from '../types';

// =============================================================================
// Directory Initialization
// =============================================================================

/**
 * Ensure a directory exists, creating it if necessary.
 * Creates parent directories recursively with the specified mode.
 *
 * @param dir - Directory path to ensure exists
 * @param mode - Permission mode (default: 0700 - owner only)
 * @throws {DirectoryError} If directory creation fails
 */
export async function ensureDir(
  dir: string,
  mode: number = DEFAULT_PERSISTENCE_CONFIG.dirMode
): Promise<void> {
  if (existsSync(dir)) {
    return;
  }

  try {
    await mkdir(dir, { recursive: true, mode });
  } catch (error) {
    throw new DirectoryError(
      dir,
      'create',
      `Failed to create directory: ${dir}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Ensure a directory exists synchronously.
 * Use this only when async is not possible (e.g., in constructors).
 *
 * @param dir - Directory path to ensure exists
 * @param mode - Permission mode (default: 0700)
 * @throws {DirectoryError} If directory creation fails
 */
export function ensureDirSync(
  dir: string,
  mode: number = DEFAULT_PERSISTENCE_CONFIG.dirMode
): void {
  if (existsSync(dir)) {
    return;
  }

  try {
    mkdirSync(dir, { recursive: true, mode });
  } catch (error) {
    throw new DirectoryError(
      dir,
      'create',
      `Failed to create directory: ${dir}`,
      error instanceof Error ? error : undefined
    );
  }
}

// =============================================================================
// Path Helpers
// =============================================================================

/**
 * Get the project-local agentlint directory path.
 *
 * @param projectPath - Project root path (default: process.cwd())
 * @returns Path to .agentlint directory
 */
export function getProjectDir(projectPath: string = process.cwd()): string {
  return join(projectPath, DEFAULT_PERSISTENCE_CONFIG.projectDir);
}

/**
 * Get the global agentlint directory path.
 *
 * @returns Path to ~/.agentlint directory
 */
export function getGlobalDir(): string {
  return join(homedir(), '.agentlint');
}

/**
 * Get the baselines directory path.
 *
 * @param projectPath - Project root path (default: process.cwd())
 * @returns Path to .agentlint/baselines directory
 */
export function getBaselinesDir(projectPath: string = process.cwd()): string {
  return join(getProjectDir(projectPath), 'baselines');
}

/**
 * Get the baselines database path.
 *
 * @param projectPath - Project root path (default: process.cwd())
 * @returns Path to .agentlint/baselines.db
 */
export function getBaselinesDbPath(projectPath: string = process.cwd()): string {
  return join(getProjectDir(projectPath), 'baselines.db');
}

/**
 * Get the sessions directory path.
 *
 * @param projectPath - Project root path (default: process.cwd())
 * @returns Path to .agentlint/sessions directory
 */
export function getSessionsDir(projectPath: string = process.cwd()): string {
  return join(getProjectDir(projectPath), 'sessions');
}

/**
 * Get the project-local learnings directory path.
 *
 * @param projectPath - Project root path (default: process.cwd())
 * @returns Path to .agentlint/learnings directory
 */
export function getProjectLearningsDir(projectPath: string = process.cwd()): string {
  return join(getProjectDir(projectPath), 'learnings');
}

/**
 * Get the project-local learnings database path.
 *
 * @param projectPath - Project root path (default: process.cwd())
 * @returns Path to .agentlint/learnings.db
 */
export function getProjectLearningsDbPath(projectPath: string = process.cwd()): string {
  return join(getProjectDir(projectPath), 'learnings.db');
}

/**
 * Get the global learnings directory path.
 *
 * @returns Path to ~/.agentlint/learnings directory
 */
export function getGlobalLearningsDir(): string {
  return join(getGlobalDir(), 'learnings');
}

/**
 * Get the global learnings database path.
 *
 * @returns Path to ~/.agentlint/learnings.db
 */
export function getGlobalLearningsDbPath(): string {
  return join(getGlobalDir(), 'learnings.db');
}

/**
 * Expand tilde (~) in a path to the home directory.
 *
 * @param path - Path that may contain ~
 * @returns Expanded path with home directory
 */
export function expandTilde(path: string): string {
  if (path.startsWith('~/')) {
    return join(homedir(), path.slice(2));
  }
  if (path === '~') {
    return homedir();
  }
  return path;
}
