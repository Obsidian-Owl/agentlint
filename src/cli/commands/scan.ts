/**
 * EP04 CLI Interface - Scan Command
 *
 * Implements US-004: Scan for AI Configurations
 * Discovers AI configuration files in the project directory.
 *
 * @module cli/commands/scan
 */

import { stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { GlobalOptions } from '../types';
import { getOutputMode } from '../utils/output';
import { colorByStatus, bold } from '../utils/colors';

/**
 * Supported AI configuration file patterns.
 * Extended for AGE-666 to include more Claude config types.
 */
export const CONFIG_PATTERNS = [
  {
    type: 'claude-code' as const,
    pattern: 'CLAUDE.md',
    description: 'Claude Code project instructions',
  },
  {
    type: 'claude-code' as const,
    pattern: '.mcp.json',
    description: 'MCP server configuration',
  },
  {
    type: 'claude-code' as const,
    pattern: '.claude/settings.json',
    description: 'Claude Code project settings',
  },
  {
    type: 'claude-code' as const,
    pattern: '.claude/settings.local.json',
    description: 'Claude Code local settings',
  },
  {
    type: 'cursor' as const,
    pattern: '.cursorrules',
    description: 'Cursor AI rules',
  },
  {
    type: 'github-copilot' as const,
    pattern: '.github/copilot-instructions.md',
    description: 'GitHub Copilot instructions',
  },
  {
    type: 'continue' as const,
    pattern: '.continue/config.json',
    description: 'Continue.dev configuration',
  },
  {
    type: 'continue' as const,
    pattern: '.continue/config.ts',
    description: 'Continue.dev TypeScript configuration',
  },
  {
    type: 'aider' as const,
    pattern: '.aider.conf.yml',
    description: 'Aider configuration',
  },
  {
    type: 'codeium' as const,
    pattern: '.codeium/config.json',
    description: 'Codeium configuration',
  },
] as const;

/**
 * Configuration types.
 */
export type ConfigType =
  | 'claude-code'
  | 'cursor'
  | 'github-copilot'
  | 'continue'
  | 'aider'
  | 'codeium'
  | 'unknown';

/**
 * A discovered configuration file.
 */
export interface ConfigFile {
  /** Absolute path to the file */
  path: string;
  /** Path relative to scan directory */
  relativePath: string;
  /** Configuration type */
  type: ConfigType;
  /** Human-readable description */
  description: string;
  /** File size in bytes */
  size: number;
}

/**
 * Result of a scan operation.
 */
export interface ScanResult {
  /** Directory that was scanned */
  directory: string;
  /** Discovered configuration files */
  configs: ConfigFile[];
  /** Timestamp of scan */
  scannedAt: string;
}

/**
 * Determines the configuration type from a file path.
 *
 * @param filePath - Path to check
 * @returns Configuration type
 */
export function getConfigType(filePath: string): ConfigType {
  const normalizedPath = filePath.replace(/\\/g, '/');

  for (const config of CONFIG_PATTERNS) {
    if (normalizedPath.endsWith(config.pattern) || normalizedPath === config.pattern) {
      return config.type;
    }
  }

  return 'unknown';
}

/**
 * Type-friendly display names for config types.
 */
const CONFIG_TYPE_NAMES: Record<ConfigType, string> = {
  'claude-code': 'Claude Code',
  cursor: 'Cursor',
  'github-copilot': 'GitHub Copilot',
  continue: 'Continue.dev',
  aider: 'Aider',
  codeium: 'Codeium',
  unknown: 'Unknown',
};

/**
 * Scans a directory for AI configuration files.
 *
 * @param directory - Directory to scan
 * @returns Scan result with discovered configs
 */
export async function scanForConfigs(directory: string): Promise<ScanResult> {
  const absoluteDir = resolve(directory);
  const configs: ConfigFile[] = [];

  // Check each known pattern
  for (const pattern of CONFIG_PATTERNS) {
    const fullPath = join(absoluteDir, pattern.pattern);

    try {
      const stats = await stat(fullPath);
      if (stats.isFile()) {
        configs.push({
          path: fullPath,
          relativePath: pattern.pattern,
          type: pattern.type,
          description: pattern.description,
          size: stats.size,
        });
      }
    } catch {
      // File doesn't exist, continue
    }
  }

  return {
    directory: absoluteDir,
    configs,
    scannedAt: new Date().toISOString(),
  };
}

/**
 * Formats scan result for terminal output.
 *
 * @param result - Scan result
 * @returns Formatted string
 */
function formatTerminalOutput(result: ScanResult): string {
  const lines: string[] = [];

  if (result.configs.length === 0) {
    lines.push(colorByStatus('No AI configuration files found in:', 'warning'));
    lines.push(`  ${result.directory}`);
    lines.push('');
    lines.push('To get started, create one of these files:');
    lines.push(`  ${bold('CLAUDE.md')}           - Claude Code project instructions`);
    lines.push(`  ${bold('.cursorrules')}        - Cursor AI rules`);
    lines.push(`  ${bold('.github/copilot-instructions.md')} - GitHub Copilot`);
    return lines.join('\n');
  }

  lines.push(
    colorByStatus(
      `Found ${result.configs.length} AI configuration file${result.configs.length === 1 ? '' : 's'}:`,
      'success'
    )
  );
  lines.push('');

  for (const config of result.configs) {
    const typeName = CONFIG_TYPE_NAMES[config.type];
    const size = formatSize(config.size);
    lines.push(`  ${bold(config.relativePath)}`);
    lines.push(`    Type: ${typeName}`);
    lines.push(`    Size: ${size}`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Formats a file size for display.
 *
 * @param bytes - Size in bytes
 * @returns Formatted size string
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Formats scan result as Markdown.
 *
 * @param result - Scan result
 * @returns Markdown formatted string
 */
function formatMarkdownOutput(result: ScanResult): string {
  const lines: string[] = [];

  lines.push('# AI Configuration Scan Results');
  lines.push('');
  lines.push(`**Directory:** ${result.directory}`);
  lines.push(`**Scanned:** ${result.scannedAt}`);
  lines.push('');

  if (result.configs.length === 0) {
    lines.push('No AI configuration files found.');
    lines.push('');
    lines.push('## Getting Started');
    lines.push('');
    lines.push('Create one of these configuration files:');
    lines.push('');
    lines.push('| File | Description |');
    lines.push('|------|-------------|');
    lines.push('| `CLAUDE.md` | Claude Code project instructions |');
    lines.push('| `.cursorrules` | Cursor AI rules |');
    lines.push('| `.github/copilot-instructions.md` | GitHub Copilot |');
    return lines.join('\n');
  }

  lines.push(
    `## Found ${result.configs.length} Configuration File${result.configs.length === 1 ? '' : 's'}`
  );
  lines.push('');
  lines.push('| File | Type | Size |');
  lines.push('|------|------|------|');

  for (const config of result.configs) {
    const typeName = CONFIG_TYPE_NAMES[config.type];
    const size = formatSize(config.size);
    lines.push(`| \`${config.relativePath}\` | ${typeName} | ${size} |`);
  }

  return lines.join('\n');
}

/**
 * Scan command options.
 */
export interface ScanOptions extends GlobalOptions {
  directory?: string;
}

/**
 * Executes the scan command.
 *
 * @param options - Command options
 * @returns Exit code
 */
export async function runScan(options: ScanOptions): Promise<number> {
  const directory = options.directory ?? '.';
  const outputMode = getOutputMode(options);

  // Verify directory exists
  try {
    const stats = await stat(directory);
    if (!stats.isDirectory()) {
      console.error(`Error: ${directory} is not a directory`);
      return 1;
    }
  } catch {
    console.error(`Error: Directory not found: ${directory}`);
    return 1;
  }

  // Run scan
  const result = await scanForConfigs(directory);

  // Output based on mode
  if (outputMode === 'json') {
    console.log(JSON.stringify(result, null, 2));
  } else if (outputMode === 'markdown') {
    console.log(formatMarkdownOutput(result));
  } else {
    // 'terminal' and 'plain' modes use the same format
    // (colors will be stripped automatically for 'plain' by chalk)
    console.log(formatTerminalOutput(result));
  }

  return 0;
}
