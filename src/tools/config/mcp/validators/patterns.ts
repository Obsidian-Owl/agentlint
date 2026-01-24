/**
 * MCP Anti-Pattern Detection
 *
 * Detects common configuration anti-patterns in MCP server configurations.
 * Includes deprecated packages, high timeouts, and disabled servers.
 *
 * @module tools/config/mcp/validators/patterns
 */

import type { McpValidationIssue, Position, McpIssueCode } from '../types';
import { ISSUE_CODE_METADATA } from '../types';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a validation issue with standard fields populated.
 */
function createIssue(
  code: McpIssueCode,
  message: string,
  file: string,
  position: Position,
  serverName?: string,
  field?: string,
  value?: string,
  context?: Record<string, unknown>,
  fix?: string
): McpValidationIssue {
  const metadata = ISSUE_CODE_METADATA[code];
  const issue: McpValidationIssue = {
    code,
    severity: metadata.severity,
    message,
    file,
    line: position.start.line,
    column: position.start.column,
  };
  if (serverName !== undefined) issue.serverName = serverName;
  if (field !== undefined) issue.field = field;
  if (value !== undefined) issue.value = value;
  if (context !== undefined) issue.context = context;
  if (fix !== undefined) issue.fix = fix;
  return issue;
}

// =============================================================================
// Deprecated Packages
// =============================================================================

/**
 * Information about a deprecated package.
 */
export interface DeprecatedPackageInfo {
  /** Replacement package name */
  replacement: string;
  /** Reason for deprecation */
  reason: string;
}

/**
 * Registry of deprecated MCP packages and their replacements.
 */
export const DEPRECATED_PACKAGES: Record<string, DeprecatedPackageInfo> = {
  // Example deprecated packages - update as needed
  '@anthropic-ai/claude-mcp': {
    replacement: '@modelcontextprotocol/server-*',
    reason: 'Package renamed to @modelcontextprotocol organization',
  },
  'mcp-server-old': {
    replacement: '@modelcontextprotocol/server-*',
    reason: 'Legacy package, use official MCP packages',
  },
  // Real deprecated package (April 2025)
  '@modelcontextprotocol/server-github': {
    replacement: 'ghcr.io/github/github-mcp-server',
    reason: 'NPM package deprecated after April 2025',
  },
};

/**
 * Deprecated package check result.
 */
export interface DeprecatedPackageResult {
  /** Whether the package is deprecated */
  isDeprecated: boolean;
  /** Package name checked */
  packageName: string;
  /** Replacement package if deprecated */
  replacement?: string;
  /** Reason for deprecation */
  reason?: string;
}

/**
 * Check if a package is deprecated.
 *
 * @param packageName - Package name to check
 * @returns Deprecation check result
 */
export function isDeprecatedPackage(packageName: string): DeprecatedPackageResult {
  const info = DEPRECATED_PACKAGES[packageName];

  if (info) {
    return {
      isDeprecated: true,
      packageName,
      replacement: info.replacement,
      reason: info.reason,
    };
  }

  return {
    isDeprecated: false,
    packageName,
  };
}

// =============================================================================
// Timeout Analysis
// =============================================================================

/**
 * Default timeout threshold in milliseconds (2 minutes).
 */
const DEFAULT_TIMEOUT_THRESHOLD = 120000;

/**
 * Timeout analysis result.
 */
export interface TimeoutAnalysisResult {
  /** The timeout value */
  value: number;
  /** Whether the timeout is considered high */
  isHigh: boolean;
  /** The threshold used for comparison */
  threshold: number;
}

/**
 * Analyze a timeout value for potential issues.
 *
 * @param timeout - Timeout value in milliseconds
 * @param threshold - Optional custom threshold (default: 2 minutes)
 * @returns Timeout analysis result
 */
export function analyzeTimeout(
  timeout: number,
  threshold: number = DEFAULT_TIMEOUT_THRESHOLD
): TimeoutAnalysisResult {
  return {
    value: timeout,
    isHigh: timeout > threshold,
    threshold,
  };
}

// =============================================================================
// Pattern Validation
// =============================================================================

/**
 * Server configuration for pattern validation.
 */
export interface ServerPatternConfig {
  command?: string;
  args?: string[];
  url?: string;
  timeout?: number;
  disabled?: boolean;
}

/**
 * Extract package names from command and args.
 *
 * @param command - Command string
 * @param args - Command arguments
 * @returns Array of potential package names
 */
function extractPackageNames(command?: string, args?: string[]): string[] {
  const packages: string[] = [];

  // Check if command itself is a package name (scoped or unscoped)
  if (command && (command.startsWith('@') || !command.includes('/'))) {
    // Skip known executables
    const executables = ['npx', 'node', 'python', 'python3', 'docker', 'uvx', 'bunx'];
    if (!executables.includes(command)) {
      packages.push(command);
    }
  }

  // Extract packages from args
  if (args) {
    for (const arg of args) {
      // Skip flags
      if (arg.startsWith('-')) continue;

      // Match scoped packages (@org/package) or unscoped packages
      if (arg.startsWith('@') || /^[a-z][a-z0-9-]*$/i.test(arg)) {
        // Skip common flag values
        if (['y', 'yes', 'no', 'true', 'false'].includes(arg.toLowerCase())) continue;
        packages.push(arg);
      }
    }
  }

  return packages;
}

/**
 * Validate configuration patterns in an MCP server.
 *
 * @param config - Server configuration
 * @param file - Source file path
 * @param serverName - Server name
 * @param position - Position in source file
 * @returns Array of validation issues
 */
export function validatePatterns(
  config: ServerPatternConfig,
  file: string,
  serverName: string,
  position: Position
): McpValidationIssue[] {
  const issues: McpValidationIssue[] = [];

  // MCP013: Deprecated package detection
  const packageNames = extractPackageNames(config.command, config.args);
  for (const packageName of packageNames) {
    const deprecationInfo = isDeprecatedPackage(packageName);
    if (deprecationInfo.isDeprecated) {
      issues.push(
        createIssue(
          'MCP013',
          `Server '${serverName}' uses deprecated package '${packageName}'`,
          file,
          position,
          serverName,
          'command',
          packageName,
          { deprecationInfo },
          `Replace '${packageName}' with '${deprecationInfo.replacement}' - ${deprecationInfo.reason}`
        )
      );
    }
  }

  // MCP017: High timeout warning
  if (config.timeout !== undefined) {
    const timeoutInfo = analyzeTimeout(config.timeout);
    if (timeoutInfo.isHigh) {
      issues.push(
        createIssue(
          'MCP017',
          `Server '${serverName}' has high timeout value (${config.timeout}ms)`,
          file,
          position,
          serverName,
          'timeout',
          String(config.timeout),
          { timeoutInfo },
          `Consider reducing timeout to ${timeoutInfo.threshold}ms or less unless server requires long operations`
        )
      );
    }
  }

  // MCP020: Server is disabled
  if (config.disabled === true) {
    issues.push(
      createIssue(
        'MCP020',
        `Server '${serverName}' is disabled`,
        file,
        position,
        serverName,
        'disabled',
        'true',
        undefined,
        'Remove the disabled flag to enable this server, or remove the server configuration if not needed'
      )
    );
  }

  return issues;
}
