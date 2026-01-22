/**
 * EP11 Persistence Layer - Centralized Database Initialization
 *
 * Provides a single entry point to initialize all persistence databases.
 * This ensures tools don't fail silently due to missing databases/tables.
 *
 * Issue 4 fix: Tools were failing because databases weren't created.
 * This module auto-initializes all required persistence infrastructure.
 *
 * @module persistence/init
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { ensureDir, getProjectDir, getGlobalDir } from './common/directories';
import { initBaselineSchema } from './baselines/indexer';
import { initLearningsIndex } from './learnings/indexer';
import { initDatabase as initSessionsDatabase } from './sessions/fts';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for database initialization.
 */
export interface InitDatabasesOptions {
  /** Project path to initialize databases for */
  projectPath: string;
  /** Whether to also initialize global databases */
  includeGlobal?: boolean;
}

/**
 * Result of database initialization.
 */
export interface InitDatabasesResult {
  /** Whether initialization succeeded */
  success: boolean;
  /** Directories that were created */
  directoriesCreated: string[];
  /** Databases that were initialized */
  databasesInitialized: string[];
  /** Any errors encountered (non-fatal) */
  warnings: string[];
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Initialize all persistence databases for a project.
 *
 * Creates required directories and initializes SQLite databases:
 * - Project baselines database
 * - Project learnings database
 * - Recommendations directory (JSON storage)
 * - Sessions directory (JSON storage)
 *
 * Safe to call multiple times (idempotent).
 *
 * @param options - Initialization options
 * @returns Initialization result
 */
export async function initializeDatabases(
  options: InitDatabasesOptions
): Promise<InitDatabasesResult> {
  const { projectPath, includeGlobal = false } = options;
  const result: InitDatabasesResult = {
    success: true,
    directoriesCreated: [],
    databasesInitialized: [],
    warnings: [],
  };

  const globalDir = getGlobalDir();
  const projectDir = getProjectDir(projectPath);

  // Create project directories
  const projectDirs = [
    projectDir,
    join(projectDir, 'baselines'),
    join(projectDir, 'recommendations'),
    join(projectDir, 'sessions'),
    join(projectDir, 'learnings'),
  ];

  for (const dir of projectDirs) {
    try {
      await ensureDir(dir);
      result.directoriesCreated.push(dir);
    } catch (error) {
      result.warnings.push(`Failed to create directory ${dir}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Initialize project databases
  try {
    await initBaselineSchema({ baseDir: join(projectDir, 'baselines') });
    result.databasesInitialized.push('baselines');
  } catch (error) {
    result.warnings.push(`Failed to initialize baselines database: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    await initLearningsIndex({ baseDir: join(projectDir, 'learnings') });
    result.databasesInitialized.push('learnings');
  } catch (error) {
    result.warnings.push(`Failed to initialize learnings database: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Initialize global databases (sessions FTS5 is always global)
  try {
    await ensureDir(globalDir);
    result.directoriesCreated.push(globalDir);
  } catch (error) {
    result.warnings.push(`Failed to create global directory ${globalDir}: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Initialize sessions FTS5 database (global, always needed)
  try {
    await initSessionsDatabase({ dbPath: join(globalDir, 'sessions.db') });
    result.databasesInitialized.push('sessions');
  } catch (error) {
    result.warnings.push(`Failed to initialize sessions database: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Initialize additional global databases if requested
  if (includeGlobal) {
    const globalLearningsDir = join(globalDir, 'learnings');

    try {
      await ensureDir(globalLearningsDir);
      result.directoriesCreated.push(globalLearningsDir);
    } catch (error) {
      result.warnings.push(`Failed to create global learnings directory: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      await initLearningsIndex({ baseDir: globalLearningsDir });
      result.databasesInitialized.push('global-learnings');
    } catch (error) {
      result.warnings.push(`Failed to initialize global learnings database: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Set overall success based on whether core databases initialized
  result.success =
    result.databasesInitialized.includes('baselines') ||
    result.databasesInitialized.includes('learnings');

  return result;
}

/**
 * Quick check if databases are initialized for a project.
 *
 * @param projectPath - Project path to check
 * @returns Whether databases appear to be initialized
 */
export function areDatabasesInitialized(projectPath: string): boolean {
  const projectDir = getProjectDir(projectPath);
  const baselinesDb = join(projectDir, 'baselines', 'baselines.db');
  const learningsDb = join(projectDir, 'learnings', 'learnings.db');

  // Check if either database file exists
  try {
    return existsSync(baselinesDb) || existsSync(learningsDb);
  } catch {
    return false;
  }
}
