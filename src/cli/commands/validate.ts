/**
 * CLI Validate Command - Static ACT format validation
 *
 * Fast static check for ACT (AI Coding Tool) artifact format requirements.
 * Validates frontmatter presence and required fields for agents and skills.
 *
 * @module cli/commands/validate
 */

import { resolve } from 'node:path';
import { stat } from 'node:fs/promises';
import type { GlobalOptions } from '../types';
import { getOutputMode } from '../utils/output';
import { colorByStatus, bold, dim } from '../utils/colors';
import { discoverConfigs, parseConfigSync, assessQuality } from '../../tools/config';
import type { QualityIssue, ConfigFile } from '../../tools/config/types';

/**
 * Options for the validate command.
 */
export interface ValidateOptions extends GlobalOptions {
  /** Directory to validate (default: current directory) */
  directory?: string;
}

/**
 * Result of validation for a single file.
 */
interface FileValidationResult {
  /** Path to the file (relative) */
  path: string;
  /** Issues found */
  issues: QualityIssue[];
  /** Whether validation passed */
  valid: boolean;
}

/**
 * Result of the validate command.
 */
interface ValidateResult {
  /** Directory that was validated */
  directory: string;
  /** Total files checked */
  filesChecked: number;
  /** Files with issues */
  filesWithIssues: number;
  /** Total issues found */
  totalIssues: number;
  /** Per-file results */
  files: FileValidationResult[];
  /** Timestamp */
  validatedAt: string;
  /** Duration in ms */
  durationMs: number;
}

/**
 * Severity icons for display.
 */
const SEVERITY_ICONS: Record<string, string> = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🟢',
  info: 'ℹ️',
};

/**
 * Config types that we validate for format requirements.
 */
const VALIDATABLE_TYPES = new Set(['claude-agent', 'skill-md']);

/**
 * Validates a single config file for ACT format requirements.
 *
 * @param file - Config file to validate
 * @returns Validation result with any issues found
 */
function validateFile(file: ConfigFile): FileValidationResult {
  try {
    // Parse the config file
    const parsed = parseConfigSync(file.path);

    // Run quality assessment with format validation enabled
    const quality = assessQuality(parsed, { validateFormat: true });

    // Filter to only format-related issues
    const formatIssues = quality.issues.filter((issue) =>
      [
        'missing-frontmatter',
        'invalid-frontmatter',
        'missing-required-field',
        'invalid-field-value',
      ].includes(issue.type)
    );

    return {
      path: file.relativePath,
      issues: formatIssues,
      valid: formatIssues.length === 0,
    };
  } catch (error) {
    // Create an error issue for files that couldn't be parsed
    return {
      path: file.relativePath,
      issues: [
        {
          id: `parse-error-${file.relativePath}`,
          type: 'invalid-frontmatter',
          severity: 'high',
          message: `Failed to parse file: ${error instanceof Error ? error.message : String(error)}`,
          suggestion: 'Check that the file is valid markdown with proper syntax.',
        },
      ],
      valid: false,
    };
  }
}

/**
 * Formats validation result for terminal output.
 */
function formatTerminalOutput(result: ValidateResult): string {
  const lines: string[] = [];

  // Header
  if (result.totalIssues === 0) {
    lines.push(colorByStatus(`✓ All ${result.filesChecked} files passed validation`, 'success'));
  } else {
    lines.push(
      colorByStatus(
        `✗ Found ${result.totalIssues} issue${result.totalIssues === 1 ? '' : 's'} in ${result.filesWithIssues} file${result.filesWithIssues === 1 ? '' : 's'}`,
        'error'
      )
    );
  }
  lines.push('');

  // Per-file results (only show files with issues)
  for (const file of result.files) {
    if (!file.valid) {
      lines.push(bold(file.path));
      for (const issue of file.issues) {
        const icon = SEVERITY_ICONS[issue.severity] ?? 'ℹ️';
        lines.push(`  ${icon} ${issue.message}`);
        if (issue.suggestion) {
          lines.push(`     ${dim(issue.suggestion)}`);
        }
      }
      lines.push('');
    }
  }

  // Summary
  lines.push(dim(`Validated ${result.filesChecked} files in ${result.durationMs}ms`));

  return lines.join('\n');
}

/**
 * Formats validation result as Markdown.
 */
function formatMarkdownOutput(result: ValidateResult): string {
  const lines: string[] = [];

  lines.push('# ACT Format Validation Results');
  lines.push('');
  lines.push(`**Directory:** ${result.directory}`);
  lines.push(`**Validated:** ${result.validatedAt}`);
  lines.push(`**Duration:** ${result.durationMs}ms`);
  lines.push('');

  if (result.totalIssues === 0) {
    lines.push(`✅ **All ${result.filesChecked} files passed validation**`);
  } else {
    lines.push(`❌ **Found ${result.totalIssues} issue(s) in ${result.filesWithIssues} file(s)**`);
    lines.push('');
    lines.push('## Issues');
    lines.push('');

    for (const file of result.files) {
      if (!file.valid) {
        lines.push(`### ${file.path}`);
        lines.push('');
        lines.push('| Severity | Issue | Suggestion |');
        lines.push('|----------|-------|------------|');
        for (const issue of file.issues) {
          const suggestion = issue.suggestion ?? '-';
          lines.push(`| ${issue.severity} | ${issue.message} | ${suggestion} |`);
        }
        lines.push('');
      }
    }
  }

  lines.push('## Summary');
  lines.push('');
  lines.push(`- Files checked: ${result.filesChecked}`);
  lines.push(`- Files with issues: ${result.filesWithIssues}`);
  lines.push(`- Total issues: ${result.totalIssues}`);

  return lines.join('\n');
}

/**
 * Executes the validate command.
 *
 * @param options - Command options
 * @returns Exit code (0 = success, 1 = issues found)
 */
export async function runValidate(options: ValidateOptions): Promise<number> {
  const directory = options.directory ?? '.';
  const outputMode = getOutputMode(options);
  const startTime = Date.now();

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

  const absoluteDir = resolve(directory);

  // Discover config files
  const discovery = await discoverConfigs({
    cwd: absoluteDir,
    includeGlobal: false,
  });

  // Filter to only validatable file types (agents, skills)
  const filesToValidate = discovery.files.filter((f) => VALIDATABLE_TYPES.has(f.type));

  // Validate each file
  const fileResults: FileValidationResult[] = [];
  for (const file of filesToValidate) {
    const result = validateFile(file);
    fileResults.push(result);
  }

  // Calculate summary
  const filesWithIssues = fileResults.filter((f) => !f.valid).length;
  const totalIssues = fileResults.reduce((sum, f) => sum + f.issues.length, 0);
  const durationMs = Date.now() - startTime;

  const result: ValidateResult = {
    directory: absoluteDir,
    filesChecked: filesToValidate.length,
    filesWithIssues,
    totalIssues,
    files: fileResults,
    validatedAt: new Date().toISOString(),
    durationMs,
  };

  // Output based on mode
  if (outputMode === 'json') {
    console.log(JSON.stringify(result, null, 2));
  } else if (outputMode === 'markdown') {
    console.log(formatMarkdownOutput(result));
  } else {
    console.log(formatTerminalOutput(result));
  }

  // Return exit code based on --fail-on-findings flag
  if (options.failOnFindings && totalIssues > 0) {
    return 1;
  }

  return 0;
}
