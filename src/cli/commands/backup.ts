/**
 * Backup and Restore Commands
 *
 * Provides commands to backup and restore .agentlint state for debugging.
 *
 * @module cli/commands/backup
 */

import { existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import * as tar from 'tar';

import type { GlobalOptions } from '../types';
import { getProjectDir, ensureDir } from '../../persistence/common/directories';

// =============================================================================
// Types
// =============================================================================

export interface BackupOptions extends GlobalOptions {
  /** Project directory to backup (default: .) */
  directory?: string;
  /** Output file path (default: .agentlint-backup-{timestamp}.tar.gz) */
  output?: string;
  /** Include ~/.agentlint global data */
  includeGlobal?: boolean;
}

export interface RestoreOptions extends GlobalOptions {
  /** Target project directory (default: .) */
  directory?: string;
  /** Overwrite existing data without confirmation */
  force?: boolean;
  /** Show what would be restored without doing it */
  dryRun?: boolean;
}

// =============================================================================
// Backup Command
// =============================================================================

/**
 * Run the backup command to archive .agentlint state.
 *
 * @param options - Backup options
 * @returns Exit code (0 for success, non-zero for failure)
 */
export async function runBackup(options: BackupOptions): Promise<number> {
  const directory = resolve(options.directory ?? '.');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = options.output ?? `.agentlint-backup-${timestamp}.tar.gz`;

  const agentlintDir = getProjectDir(directory);

  // Check if .agentlint exists
  if (!existsSync(agentlintDir)) {
    if (options.json) {
      console.log(JSON.stringify({ status: 'error', error: 'No .agentlint directory found' }));
    } else {
      console.error('Error: No .agentlint directory found');
    }
    return 1;
  }

  // Determine which subdirectories to backup
  const subdirs = ['baselines', 'recommendations', 'learnings', 'sessions'];
  const existingSubdirs = subdirs.filter((subdir) => existsSync(join(agentlintDir, subdir)));

  // Also include any .db files at the root of .agentlint
  const dbFiles: string[] = [];
  try {
    const files = readdirSync(agentlintDir);
    for (const file of files) {
      if (file.endsWith('.db')) {
        dbFiles.push(file);
      }
    }
  } catch {
    // Ignore errors reading directory
  }

  const filesToBackup = [...existingSubdirs, ...dbFiles];

  if (filesToBackup.length === 0) {
    if (options.json) {
      console.log(JSON.stringify({ status: 'error', error: 'No data to backup in .agentlint' }));
    } else {
      console.error('Error: No data to backup in .agentlint');
    }
    return 1;
  }

  try {
    // Create tar.gz archive
    await tar.create(
      {
        gzip: true,
        file: outputPath,
        cwd: agentlintDir,
      },
      filesToBackup
    );

    if (options.json) {
      console.log(
        JSON.stringify({
          status: 'success',
          output: outputPath,
          files: filesToBackup,
          directory: agentlintDir,
        })
      );
    } else if (!options.quiet) {
      console.log(`Backup created: ${outputPath}`);
      if (options.verbose) {
        console.log(`  Source: ${agentlintDir}`);
        console.log(`  Contents: ${filesToBackup.join(', ')}`);
      }
    }

    return 0;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (options.json) {
      console.log(JSON.stringify({ status: 'error', error: errorMessage }));
    } else {
      console.error(`Error creating backup: ${errorMessage}`);
    }
    return 1;
  }
}

// =============================================================================
// Restore Command
// =============================================================================

/**
 * Run the restore command to extract a backup archive.
 *
 * @param backupFile - Path to the backup .tar.gz file
 * @param options - Restore options
 * @returns Exit code (0 for success, non-zero for failure)
 */
export async function runRestore(backupFile: string, options: RestoreOptions): Promise<number> {
  const directory = resolve(options.directory ?? '.');
  const agentlintDir = getProjectDir(directory);

  // Validate backup file exists
  if (!existsSync(backupFile)) {
    if (options.json) {
      console.log(
        JSON.stringify({ status: 'error', error: `Backup file not found: ${backupFile}` })
      );
    } else {
      console.error(`Error: Backup file not found: ${backupFile}`);
    }
    return 1;
  }

  // Handle dry-run: list contents
  if (options.dryRun) {
    try {
      const contents: string[] = [];
      await tar.list({
        file: backupFile,
        onReadEntry: (entry) => {
          contents.push(entry.path);
        },
      });

      if (options.json) {
        console.log(
          JSON.stringify({
            status: 'dry-run',
            wouldRestoreTo: agentlintDir,
            contents,
          })
        );
      } else {
        console.log('Would restore to:', agentlintDir);
        console.log('Contents:');
        for (const item of contents) {
          console.log(`  ${item}`);
        }
      }
      return 0;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (options.json) {
        console.log(JSON.stringify({ status: 'error', error: errorMessage }));
      } else {
        console.error(`Error reading backup: ${errorMessage}`);
      }
      return 1;
    }
  }

  // Check for existing data
  const hasExisting = existsSync(agentlintDir) && readdirSync(agentlintDir).length > 0;

  if (hasExisting && !options.force) {
    if (options.json) {
      console.log(
        JSON.stringify({
          status: 'error',
          error: 'Existing .agentlint data found. Use --force to overwrite.',
        })
      );
    } else {
      console.error('Error: Existing .agentlint data found. Use --force to overwrite.');
    }
    return 1;
  }

  try {
    // Ensure the target directory exists
    await ensureDir(agentlintDir);

    // Extract backup
    await tar.extract({
      file: backupFile,
      cwd: agentlintDir,
    });

    if (options.json) {
      console.log(
        JSON.stringify({
          status: 'success',
          restoredFrom: backupFile,
          restoredTo: agentlintDir,
        })
      );
    } else if (!options.quiet) {
      console.log(`Restored from: ${backupFile}`);
      if (options.verbose) {
        console.log(`  Target: ${agentlintDir}`);
      }
    }

    return 0;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (options.json) {
      console.log(JSON.stringify({ status: 'error', error: errorMessage }));
    } else {
      console.error(`Error restoring backup: ${errorMessage}`);
    }
    return 1;
  }
}
