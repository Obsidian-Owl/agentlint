/**
 * Backup and Restore Commands
 *
 * Provides commands to backup and restore .agentlint state for debugging.
 *
 * @module cli/commands/backup
 */

import { existsSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
import * as tar from 'tar';

import type { GlobalOptions } from '../types';
import { getProjectDir, getBackupsDir, ensureDir } from '../../persistence/common/directories';
import { redact } from '../../debug/redaction';

const MAX_BACKUPS_TO_KEEP = 5;

function pruneOldBackups(backupsDir: string, maxToKeep: number): number {
  if (!existsSync(backupsDir)) return 0;

  const backupFiles = readdirSync(backupsDir)
    .filter((f) => f.startsWith('backup-') && f.endsWith('.tar.gz'))
    .map((f) => ({
      name: f,
      path: join(backupsDir, f),
      mtime: statSync(join(backupsDir, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.mtime - a.mtime);

  let deleted = 0;
  for (const file of backupFiles.slice(maxToKeep)) {
    try {
      unlinkSync(file.path);
      deleted++;
    } catch {
      // Non-critical: old backup cleanup failure doesn't affect new backup
    }
  }
  return deleted;
}

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
  const backupFilename = `backup-${timestamp}.tar.gz`;

  let outputPath: string;
  if (options.output) {
    outputPath = options.output;
  } else {
    const backupsDir = getBackupsDir();
    await ensureDir(backupsDir);
    outputPath = join(backupsDir, backupFilename);
  }

  const agentlintDir = getProjectDir(directory);

  // Check if .agentlint exists
  if (!existsSync(agentlintDir)) {
    if (options.json) {
      console.log(
        JSON.stringify({ status: 'error', error: redact('No .agentlint directory found') })
      );
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
      console.log(
        JSON.stringify({ status: 'error', error: redact('No data to backup in .agentlint') })
      );
    } else {
      console.error('Error: No data to backup in .agentlint');
    }
    return 1;
  }

  try {
    await tar.create(
      {
        gzip: true,
        file: outputPath,
        cwd: agentlintDir,
      },
      filesToBackup
    );

    const pruned = pruneOldBackups(getBackupsDir(), MAX_BACKUPS_TO_KEEP);

    if (options.json) {
      console.log(
        JSON.stringify({
          status: 'success',
          output: outputPath,
          files: filesToBackup,
          directory: agentlintDir,
          prunedBackups: pruned,
        })
      );
    } else if (!options.quiet) {
      console.log(`Backup created: ${outputPath}`);
      if (options.verbose) {
        console.log(`  Source: ${agentlintDir}`);
        console.log(`  Contents: ${filesToBackup.join(', ')}`);
        if (pruned > 0) {
          console.log(`  Pruned ${pruned} old backup(s)`);
        }
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
        JSON.stringify({ status: 'error', error: redact(`Backup file not found: ${backupFile}`) })
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
        console.log(JSON.stringify({ status: 'error', error: redact(errorMessage) }));
      } else {
        console.error(`Error reading backup: ${redact(errorMessage)}`);
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
          error: redact('Existing .agentlint data found. Use --force to overwrite.'),
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
      console.log(JSON.stringify({ status: 'error', error: redact(errorMessage) }));
    } else {
      console.error(`Error restoring backup: ${redact(errorMessage)}`);
    }
    return 1;
  }
}
