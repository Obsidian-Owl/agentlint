/**
 * MCP Config Validation Tool
 *
 * SDK tool for validating MCP server configurations.
 * Runs all validators and returns structured issues with positions.
 *
 * @module tools/config/mcp/validate-mcp-config-tool
 */

import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { readFile } from 'fs/promises';
import { parseMcpConfig } from './parser';
import { validateSchema, validateServerSchema } from './validators/schema';
import { validatePath } from './validators/path';
import { validateEnv } from './validators/env';
import { validateTransport } from './validators/transport';
import { validatePatterns } from './validators/patterns';
import type { McpValidationIssue, McpFormat, Position, McpAct } from './types';
import { basename, dirname } from 'path';

// =============================================================================
// Types
// =============================================================================

/**
 * Validation result for a single config file.
 */
export interface ValidationResult {
  /** File path */
  file: string;
  /** Whether validation succeeded (no errors) */
  success: boolean;
  /** All validation issues */
  issues: McpValidationIssue[];
  /** Issue count by severity */
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
  /** Servers that were validated */
  servers: string[];
}

/**
 * Aggregated validation results across multiple files.
 */
export interface AggregatedValidation {
  /** Total files validated */
  totalFiles: number;
  /** Total issues found */
  totalIssues: number;
  /** Issues by severity */
  bySeverity: {
    error: number;
    warning: number;
    info: number;
  };
  /** Issues by code */
  byCode: Record<string, number>;
  /** Files with issues */
  filesWithIssues: number;
  /** Files without issues */
  filesWithoutIssues: number;
}

// =============================================================================
// Validation Logic
// =============================================================================

/**
 * Validate a single MCP config file.
 *
 * @param filePath - Path to the config file
 * @param format - Optional format hint
 * @returns Validation result
 */
export async function validateMcpConfig(
  filePath: string,
  format?: McpFormat
): Promise<ValidationResult> {
  const issues: McpValidationIssue[] = [];
  const servers: string[] = [];

  try {
    // Read and parse the file
    const content = await readFile(filePath, 'utf-8');
    const parseResult = parseMcpConfig(content);

    if (!parseResult.success) {
      // Add parse errors as issues
      for (const error of parseResult.errors) {
        issues.push({
          code: 'MCP015',
          severity: 'error',
          message: `Parse error: ${error.message}`,
          file: filePath,
          line: error.line ?? 1,
          column: error.column ?? 1,
        });
      }

      return {
        file: filePath,
        success: false,
        issues,
        summary: countBySeverity(issues),
        servers: [],
      };
    }

    const config = parseResult.config!;
    const tree = parseResult.tree!;

    // Detect format if not provided
    const detectedFormat = format ?? detectFormat(config);

    // Emit ACT compatibility info (MCP021, MCP022)
    const actIssues = emitActIssues(filePath, detectedFormat);
    issues.push(...actIssues);

    // Run schema validation
    const schemaIssues = validateSchema(config, tree, content, filePath, detectedFormat);
    issues.push(...schemaIssues);

    // Get server configurations
    const serverConfigs = getServerConfigs(config, detectedFormat);

    // Validate each server
    for (const [serverName, serverConfig] of Object.entries(serverConfigs)) {
      servers.push(serverName);

      // Get server position
      const serverPosition = getServerPosition(tree, content, serverName, detectedFormat);

      // Server schema validation
      const serverSchemaIssues = validateServerSchema(
        serverName,
        serverConfig,
        filePath,
        serverPosition,
        detectedFormat,
        content,
        tree
      );
      issues.push(...serverSchemaIssues);

      // Path validation (if command exists)
      if (serverConfig.command) {
        const pathIssues = await validatePath(
          serverConfig.command as string,
          (serverConfig.args as string[]) ?? [],
          filePath,
          serverName,
          serverPosition
        );
        issues.push(...pathIssues);
      }

      // Env validation (if env exists)
      if (serverConfig.env && typeof serverConfig.env === 'object') {
        const envIssues = validateEnv(
          serverConfig.env as Record<string, string>,
          filePath,
          serverName,
          serverPosition
        );
        issues.push(...envIssues);
      }

      // Transport validation
      const transportIssues = validateTransport(
        serverConfig as {
          command?: string;
          args?: string[];
          url?: string;
          transport?: 'stdio' | 'sse';
        },
        filePath,
        serverName,
        serverPosition
      );
      issues.push(...transportIssues);

      // Pattern validation
      const patternIssues = validatePatterns(
        serverConfig as {
          command?: string;
          args?: string[];
          url?: string;
          timeout?: number;
          disabled?: boolean;
        },
        filePath,
        serverName,
        serverPosition
      );
      issues.push(...patternIssues);
    }

    // Check for overall success (no errors)
    const hasErrors = issues.some((i) => i.severity === 'error');

    return {
      file: filePath,
      success: !hasErrors,
      issues,
      summary: countBySeverity(issues),
      servers,
    };
  } catch (error) {
    // File read error or unexpected error
    const errorMessage = error instanceof Error ? error.message : String(error);
    issues.push({
      code: 'MCP015',
      severity: 'error',
      message: `Failed to read config: ${errorMessage}`,
      file: filePath,
      line: 1,
      column: 1,
    });

    return {
      file: filePath,
      success: false,
      issues,
      summary: countBySeverity(issues),
      servers: [],
    };
  }
}

/**
 * Aggregate validation results from multiple files.
 *
 * @param results - Array of validation results
 * @returns Aggregated validation summary
 */
export function aggregateValidation(results: ValidationResult[]): AggregatedValidation {
  const bySeverity = { error: 0, warning: 0, info: 0 };
  const byCode: Record<string, number> = {};
  let totalIssues = 0;
  let filesWithIssues = 0;
  let filesWithoutIssues = 0;

  for (const result of results) {
    // Count issues
    totalIssues += result.issues.length;

    // Count by severity
    bySeverity.error += result.summary.errors;
    bySeverity.warning += result.summary.warnings;
    bySeverity.info += result.summary.info;

    // Count by code
    for (const issue of result.issues) {
      byCode[issue.code] = (byCode[issue.code] ?? 0) + 1;
    }

    // Count files with/without issues
    if (result.issues.length > 0) {
      filesWithIssues++;
    } else {
      filesWithoutIssues++;
    }
  }

  return {
    totalFiles: results.length,
    totalIssues,
    bySeverity,
    byCode,
    filesWithIssues,
    filesWithoutIssues,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Count issues by severity.
 */
function countBySeverity(issues: McpValidationIssue[]): {
  errors: number;
  warnings: number;
  info: number;
} {
  let errors = 0;
  let warnings = 0;
  let info = 0;

  for (const issue of issues) {
    switch (issue.severity) {
      case 'error':
        errors++;
        break;
      case 'warning':
        warnings++;
        break;
      case 'info':
        info++;
        break;
    }
  }

  return { errors, warnings, info };
}

/**
 * Detect config format from content.
 */
function detectFormat(config: Record<string, unknown>): McpFormat {
  if ('mcpServers' in config) return 'standard';
  if ('servers' in config) return 'opencode';
  return 'standard';
}

/**
 * Get server configurations from config based on format.
 */
function getServerConfigs(
  config: Record<string, unknown>,
  format: McpFormat
): Record<string, Record<string, unknown>> {
  if (format === 'opencode' && 'servers' in config) {
    return (config.servers as Record<string, Record<string, unknown>>) ?? {};
  }
  if ('mcpServers' in config) {
    return (config.mcpServers as Record<string, Record<string, unknown>>) ?? {};
  }
  return {};
}

/**
 * Get position for a server in the config tree.
 */
function getServerPosition(
  _tree: unknown,
  _content: string,
  _serverName: string,
  _format: McpFormat
): Position {
  // TODO: Implement actual position lookup from tree
  // For now, return default position
  return {
    start: { line: 1, column: 1 },
    end: { line: 1, column: 1 },
  };
}

/**
 * Detect ACT from file path based on known config locations.
 */
function detectActFromPath(filePath: string): McpAct | null {
  const fileName = basename(filePath);
  const parentDir = basename(dirname(filePath));

  // VS Code specific location
  if (parentDir === '.vscode' && fileName === 'mcp.json') {
    return 'vscode-copilot';
  }

  // Cursor specific location
  if (parentDir === '.cursor' && fileName === 'mcp.json') {
    return 'cursor';
  }

  // OpenCode specific locations
  if (filePath.includes('.config/opencode') || filePath.includes('opencode/config')) {
    return 'opencode';
  }

  // Claude Code standard locations (project or user level)
  if (fileName === '.mcp.json' || fileName === 'claude.json' || fileName === '.claude.json') {
    return 'claude-code';
  }

  // Windsurf specific
  if (filePath.includes('.windsurf') || filePath.includes('windsurf')) {
    return 'windsurf';
  }

  // Zed specific
  if (filePath.includes('.zed') || filePath.includes('zed/settings')) {
    return 'zed';
  }

  // Cline specific
  if (filePath.includes('.cline') || filePath.includes('cline')) {
    return 'cline';
  }

  return null;
}

/**
 * Get ACTs compatible with a given format.
 */
function getCompatibleActs(format: McpFormat): McpAct[] {
  switch (format) {
    case 'standard':
      // Standard mcpServers format is widely supported
      return ['claude-code', 'cursor', 'windsurf', 'cline', 'amazon-q'];
    case 'opencode':
      // OpenCode has its own format
      return ['opencode'];
    case 'vscode-copilot':
      // VS Code specific servers format
      return ['vscode-copilot'];
    default:
      return ['claude-code'];
  }
}

/**
 * Emit MCP021 and MCP022 issues for ACT compatibility info.
 */
function emitActIssues(filePath: string, format: McpFormat): McpValidationIssue[] {
  const issues: McpValidationIssue[] = [];
  const defaultPosition: Position = {
    start: { line: 1, column: 1 },
    end: { line: 1, column: 1 },
  };

  // MCP021: ACT-specific config location
  const detectedAct = detectActFromPath(filePath);
  if (detectedAct && detectedAct !== 'claude-code') {
    issues.push({
      code: 'MCP021',
      severity: 'info',
      message: `Config at ACT-specific location for ${detectedAct}`,
      file: filePath,
      line: defaultPosition.start.line,
      column: defaultPosition.start.column,
      context: {
        act: detectedAct,
        location: filePath,
      },
    });
  }

  // MCP022: Cross-ACT compatibility note
  const compatibleActs = getCompatibleActs(format);
  if (compatibleActs.length > 1) {
    issues.push({
      code: 'MCP022',
      severity: 'info',
      message: `Config format compatible with: ${compatibleActs.join(', ')}`,
      file: filePath,
      line: defaultPosition.start.line,
      column: defaultPosition.start.column,
      context: {
        format,
        compatibleActs,
      },
    });
  }

  return issues;
}

// =============================================================================
// SDK Tool Definition
// =============================================================================

/**
 * Input schema for validate_mcp_config tool.
 */
const ValidateMcpConfigInputSchema = {
  file: z.string().describe('Path to the MCP config file to validate'),
  format: z
    .enum(['standard', 'opencode'])
    .optional()
    .describe('Config format (auto-detected if not specified)'),
};

/**
 * SDK tool definition for validate_mcp_config.
 */
export const validateMcpConfigTool = tool(
  'validate_mcp_config',
  `Validate an MCP server configuration file.

Runs comprehensive validation including:
- Schema validation (required fields, types)
- Path validation (executables exist, accessible)
- Environment variable validation (secrets, variable references)
- Transport validation (URLs, Docker flags)
- Anti-pattern detection (deprecated packages, high timeouts)

Returns structured issues with file:line:column positions for precise reporting.`,
  ValidateMcpConfigInputSchema,
  async (input) => {
    const result = await validateMcpConfig(input.file, input.format);

    // Format output for agent consumption
    const lines: string[] = [
      `Validation ${result.success ? 'passed' : 'failed'} for ${result.file}`,
      '',
      `Servers: ${result.servers.join(', ') || 'none'}`,
      `Issues: ${result.issues.length} (${result.summary.errors} errors, ${result.summary.warnings} warnings, ${result.summary.info} info)`,
    ];

    if (result.issues.length > 0) {
      lines.push('', 'Issues:');
      for (const issue of result.issues) {
        const location = `${issue.file}:${issue.line}:${issue.column}`;
        const prefix =
          issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
        lines.push(`  ${prefix} [${issue.code}] ${issue.message}`);
        lines.push(`     at ${location}`);
        if (issue.fix) {
          lines.push(`     Fix: ${issue.fix}`);
        }
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: lines.join('\n'),
        },
      ],
      _rawData: result,
    };
  }
);
