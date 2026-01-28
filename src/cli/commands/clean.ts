/**
 * Clean Command
 *
 * Removes .agentlint state directory with optional backup.
 * By default, shows a preview. Use --force to actually clean.
 *
 * @module cli/commands/clean
 */

import { existsSync, readdirSync, statSync, rmSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

import type { CleanOptions } from '../types';
import { getProjectDir, getGlobalDir, getBackupsDir } from '../../persistence/common/directories';
import { runBackup } from './backup';
import { redact } from '../../debug/redaction';

// =============================================================================
// Types
// =============================================================================

export interface CleanTarget {
  path: string;
  type: 'project' | 'global';
  exists: boolean;
  size: number;
  fileCount: number;
  directories: string[];
  files: string[];
}

export interface CleanPreview {
  targets: CleanTarget[];
  totalSize: number;
  totalFiles: number;
  wouldBackup: boolean;
  backupPath?: string;
}

export interface CleanResult {
  status: 'success' | 'preview' | 'error' | 'nothing-to-clean';
  preview?: CleanPreview;
  cleaned?: CleanTarget[];
  backupPath?: string;
  error?: string;
}

// =============================================================================
// Helpers
// =============================================================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getDirectoryStats(dirPath: string): {
  size: number;
  fileCount: number;
  directories: string[];
  files: string[];
} {
  let size = 0;
  let fileCount = 0;
  const directories: string[] = [];
  const files: string[] = [];

  function walk(dir: string, relBase: string): void {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const relPath = join(relBase, entry.name);

        if (entry.isDirectory()) {
          directories.push(relPath + '/');
          walk(fullPath, relPath);
        } else if (entry.isFile()) {
          try {
            const stat = statSync(fullPath);
            size += stat.size;
            fileCount++;
            files.push(relPath);
          } catch {
            // Skip files we can't stat
          }
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  walk(dirPath, '');
  return { size, fileCount, directories, files };
}

function analyzeTarget(path: string, type: 'project' | 'global'): CleanTarget {
  const exists = existsSync(path);
  if (!exists) {
    return { path, type, exists, size: 0, fileCount: 0, directories: [], files: [] };
  }

  const stats = getDirectoryStats(path);
  return {
    path,
    type,
    exists,
    size: stats.size,
    fileCount: stats.fileCount,
    directories: stats.directories,
    files: stats.files,
  };
}

// =============================================================================
// Core Functions
// =============================================================================

export function previewClean(options: CleanOptions): CleanPreview {
  const directory = resolve(options.directory ?? '.');
  const projectDir = getProjectDir(directory);
  const globalDir = getGlobalDir();

  const targets: CleanTarget[] = [];

  // Always analyze project directory
  targets.push(analyzeTarget(projectDir, 'project'));

  // Optionally analyze global directory
  if (options.global) {
    targets.push(analyzeTarget(globalDir, 'global'));
  }

  const existingTargets = targets.filter((t) => t.exists);
  const totalSize = existingTargets.reduce((sum, t) => sum + t.size, 0);
  const totalFiles = existingTargets.reduce((sum, t) => sum + t.fileCount, 0);

  const wouldBackup =
    !options.noBackup && existingTargets.some((t) => t.type === 'project' && t.exists);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  const result: CleanPreview = {
    targets,
    totalSize,
    totalFiles,
    wouldBackup,
  };

  if (wouldBackup) {
    result.backupPath = join(getBackupsDir(), `backup-${timestamp}.tar.gz`);
  }

  return result;
}

export async function executeClean(options: CleanOptions): Promise<CleanResult> {
  const preview = previewClean(options);
  const existingTargets = preview.targets.filter((t) => t.exists);

  if (existingTargets.length === 0) {
    return { status: 'nothing-to-clean', preview };
  }

  // Create backup if needed (project only, not global)
  let backupPath: string | undefined;
  if (preview.wouldBackup) {
    const projectTarget = existingTargets.find((t) => t.type === 'project');
    if (projectTarget) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupsDir = getBackupsDir();
      try {
        mkdirSync(backupsDir, { recursive: true });
      } catch {
        // Directory may already exist or be created by backup command
      }
      backupPath = join(backupsDir, `backup-${timestamp}.tar.gz`);

      const backupOpts: Parameters<typeof runBackup>[0] = {
        directory: options.directory ?? '.',
        output: backupPath,
        quiet: true,
      };
      if (options.json !== undefined) {
        backupOpts.json = options.json;
      }
      const backupResult = await runBackup(backupOpts);

      if (backupResult !== 0) {
        return {
          status: 'error',
          error: `Failed to create backup at ${backupPath}`,
          preview,
        };
      }
    }
  }

  // Remove directories
  const cleaned: CleanTarget[] = [];
  for (const target of existingTargets) {
    try {
      rmSync(target.path, { recursive: true, force: true });
      cleaned.push(target);
    } catch (error) {
      const result: CleanResult = {
        status: 'error',
        error: `Failed to remove ${target.path}: ${error instanceof Error ? error.message : String(error)}`,
        preview,
      };
      if (backupPath !== undefined) {
        result.backupPath = backupPath;
      }
      return result;
    }
  }

  const result: CleanResult = {
    status: 'success',
    cleaned,
    preview,
  };
  if (backupPath !== undefined) {
    result.backupPath = backupPath;
  }
  return result;
}

// =============================================================================
// CLI Runner
// =============================================================================

export async function runClean(options: CleanOptions): Promise<number> {
  const preview = previewClean(options);
  const existingTargets = preview.targets.filter((t) => t.exists);

  // Nothing to clean
  if (existingTargets.length === 0) {
    if (options.json) {
      console.log(
        JSON.stringify({ status: 'nothing-to-clean', message: 'No .agentlint directories found' })
      );
    } else if (!options.quiet) {
      console.log('Nothing to clean - no .agentlint directories found.');
    }
    return 0;
  }

  // Preview mode (default without --force)
  if (!options.force) {
    if (options.json) {
      console.log(
        JSON.stringify({
          status: 'preview',
          message: 'Use --force to actually clean',
          targets: preview.targets
            .filter((t) => t.exists)
            .map((t) => ({
              path: t.path,
              type: t.type,
              size: t.size,
              fileCount: t.fileCount,
            })),
          totalSize: preview.totalSize,
          totalFiles: preview.totalFiles,
          wouldBackup: preview.wouldBackup,
          backupPath: preview.backupPath,
        })
      );
    } else {
      console.log('Would remove:');
      for (const target of existingTargets) {
        const label = target.type === 'global' ? '~/.agentlint/' : '.agentlint/';
        console.log(`  ${label}`);
        console.log(`    Path: ${target.path}`);
        console.log(`    Files: ${target.fileCount}`);
        console.log(`    Size: ${formatBytes(target.size)}`);

        if (options.verbose && target.directories.length > 0) {
          console.log('    Directories:');
          for (const dir of target.directories.slice(0, 10)) {
            console.log(`      - ${dir}`);
          }
          if (target.directories.length > 10) {
            console.log(`      ... and ${target.directories.length - 10} more`);
          }
        }
      }

      console.log('');
      console.log(`Total: ${preview.totalFiles} files, ${formatBytes(preview.totalSize)}`);

      if (preview.wouldBackup) {
        console.log(`\nBackup will be created: ${preview.backupPath}`);
        console.log('Use --no-backup to skip backup.');
      }

      console.log('\nRun with --force to actually clean.');
    }
    return 0;
  }

  // Execute clean
  const result = await executeClean(options);

  if (result.status === 'error') {
    if (options.json) {
      console.log(
        JSON.stringify({
          status: 'error',
          error: result.error ? redact(result.error) : 'unknown error',
        })
      );
    } else {
      console.error(`Error: ${result.error}`);
    }
    return 1;
  }

  // Success
  if (options.json) {
    console.log(
      JSON.stringify({
        status: 'success',
        cleaned: result.cleaned?.map((t) => ({
          path: t.path,
          type: t.type,
          size: t.size,
          fileCount: t.fileCount,
        })),
        backupPath: result.backupPath,
        totalSize: preview.totalSize,
        totalFiles: preview.totalFiles,
      })
    );
  } else if (!options.quiet) {
    if (result.backupPath) {
      console.log(`Backup created: ${result.backupPath}`);
    }

    for (const target of result.cleaned ?? []) {
      const label = target.type === 'global' ? '~/.agentlint/' : '.agentlint/';
      console.log(`Removed ${label} (${target.fileCount} files, ${formatBytes(target.size)})`);
    }

    console.log(`\nTotal cleaned: ${preview.totalFiles} files, ${formatBytes(preview.totalSize)}`);
  }

  return 0;
}
