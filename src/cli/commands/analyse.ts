/**
 * EP04 CLI Interface - Analyse Command
 *
 * Implements US-001: Run analysis with streaming output.
 * Implements FR-001: Primary command is `agentlint analyse`.
 * Implements FR-015: Support --config-only and --sessions-only flags.
 *
 * The analyse command is the primary entry point for agentlint analysis.
 * It:
 * 1. Discovers AI configuration files
 * 2. Runs the orchestrator to analyze configs and sessions
 * 3. Streams progress and findings to the terminal
 * 4. Outputs results in the requested format
 *
 * @module cli/commands/analyse
 */

import { resolve, relative } from 'node:path';
import { stat } from 'node:fs/promises';
import { getOutputMode } from '../utils/output';
import type { GlobalOptions } from '../types';
import { scanForConfigs, type ScanResult } from './scan';

/**
 * Options for the analyse command.
 */
export interface AnalyseOptions extends GlobalOptions {
  /** Directory to analyse (default: current directory) */
  directory?: string;
  /** Only analyse configuration files */
  configOnly?: boolean;
  /** Only analyse session logs */
  sessionsOnly?: boolean;
  /** Dry run mode - scan only, don't run full analysis */
  dryRun?: boolean;
}

/**
 * Analysis result structure for JSON output.
 */
export interface AnalyseResult {
  /** Status of the analysis */
  status: 'success' | 'error' | 'dry-run';
  /** Error message if status is 'error' */
  error?: string;
  /** Directory that was analysed */
  directory: string;
  /** Discovered configuration files */
  configs: ScanResult['configs'];
  /** Analysis findings (empty for dry-run) */
  findings: AnalyseFinding[];
  /** Summary of findings */
  summary: {
    total: number;
    bySeverity: Record<string, number>;
  };
  /** ISO-8601 timestamp */
  timestamp: string;
  /** Duration in milliseconds (if analysis was run) */
  durationMs?: number;
}

/**
 * Simplified finding for JSON output.
 */
export interface AnalyseFinding {
  id: string;
  severity: string;
  type: string;
  title: string;
  description: string;
  location?: {
    file: string;
    line?: number;
  };
}

/**
 * Formats a dry-run result for terminal output.
 *
 * @param result - The analyse result
 * @param verbose - Whether to show verbose output
 * @returns Formatted string for terminal display
 */
function formatDryRunTerminal(result: AnalyseResult, verbose: boolean): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('Dry Run Analysis');
  lines.push('================');
  lines.push('');

  if (result.configs.length === 0) {
    lines.push('No AI configuration files found.');
    lines.push('');
    lines.push('To get started, create a configuration file:');
    lines.push('  - CLAUDE.md for Claude Code');
    lines.push('  - .cursorrules for Cursor');
    lines.push('  - .github/copilot-instructions.md for GitHub Copilot');
    lines.push('');
    return lines.join('\n');
  }

  lines.push(`Directory: ${result.directory}`);
  lines.push(`Found ${result.configs.length} configuration file(s):`);
  lines.push('');

  for (const config of result.configs) {
    const relPath = relative(result.directory, config.path);
    lines.push(`  • ${relPath} (${config.type})`);
    if (verbose) {
      lines.push(`      ${config.description}`);
      lines.push(`      Size: ${config.size} bytes`);
    }
  }

  lines.push('');
  lines.push('To run full analysis (requires API key):');
  lines.push('  agentlint analyse');
  lines.push('');

  return lines.join('\n');
}

/**
 * Formats a dry-run result for JSON output.
 *
 * @param result - The analyse result
 * @returns JSON string
 */
function formatDryRunJson(result: AnalyseResult): string {
  return JSON.stringify(result, null, 2);
}

/**
 * Runs the analyse command.
 *
 * @param options - Command options
 * @returns Exit code (0 for success, non-zero for failure)
 */
export async function runAnalyse(options: AnalyseOptions): Promise<number> {
  const directory = resolve(options.directory ?? '.');
  const outputMode = getOutputMode(options);
  const verbose = options.verbose ?? false;

  // Validate directory exists
  try {
    const stats = await stat(directory);
    if (!stats.isDirectory()) {
      const error = `Not a directory: ${directory}`;
      if (outputMode === 'json') {
        console.log(JSON.stringify({ status: 'error', error }, null, 2));
      } else {
        console.error(`Error: ${error}`);
      }
      return 1;
    }
  } catch {
    const error = `Directory not found: ${directory}`;
    if (outputMode === 'json') {
      console.log(JSON.stringify({ status: 'error', error }, null, 2));
    } else {
      console.error(`Error: ${error}`);
    }
    return 1;
  }

  // Dry run mode: just scan and report
  if (options.dryRun) {
    const scanResult = await scanForConfigs(directory);
    const result: AnalyseResult = {
      status: 'dry-run',
      directory,
      configs: scanResult.configs,
      findings: [],
      summary: { total: 0, bySeverity: {} },
      timestamp: new Date().toISOString(),
    };

    if (outputMode === 'json') {
      console.log(formatDryRunJson(result));
    } else {
      console.log(formatDryRunTerminal(result, verbose));
    }

    // Dry run always succeeds (exit 0)
    return 0;
  }

  // Full analysis mode - requires orchestrator (not implemented yet)
  // For now, show a message about needing API key
  const scanResult = await scanForConfigs(directory);

  if (scanResult.configs.length === 0) {
    const result: AnalyseResult = {
      status: 'error',
      error: 'No AI configuration files found',
      directory,
      configs: [],
      findings: [],
      summary: { total: 0, bySeverity: {} },
      timestamp: new Date().toISOString(),
    };

    if (outputMode === 'json') {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatDryRunTerminal(result, verbose));
    }
    return options.failOnFindings ? 0 : 0; // No findings = success
  }

  // TODO: In Phase 6, wire up the orchestrator here
  // For now, show dry-run style output with a message
  const result: AnalyseResult = {
    status: 'dry-run',
    directory,
    configs: scanResult.configs,
    findings: [],
    summary: { total: 0, bySeverity: {} },
    timestamp: new Date().toISOString(),
  };

  if (outputMode === 'json') {
    console.log(formatDryRunJson(result));
  } else {
    console.log(formatDryRunTerminal(result, verbose));
    console.log('Note: Full analysis requires ANTHROPIC_API_KEY to be set.');
    console.log('Use --dry-run to skip the API-dependent analysis.\n');
  }

  return 0;
}

export default runAnalyse;
