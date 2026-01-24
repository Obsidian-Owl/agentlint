/**
 * MCP Path Validation
 *
 * Validates executable paths in MCP server configurations.
 * Returns structured issues with file:line:column references.
 *
 * @module tools/config/mcp/validators/path
 */

import { access } from 'fs/promises';
import { constants } from 'fs';
import { isAbsolute } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

import type { McpValidationIssue, PathInfo, Position, McpIssueCode } from '../types';
import { ISSUE_CODE_METADATA, KNOWN_EXECUTABLES } from '../types';

const execAsync = promisify(exec);

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
// Path Analysis
// =============================================================================

/**
 * Regular expression patterns for shell variable detection.
 */
const SHELL_VAR_PATTERNS = [
  /\$\{([A-Z_][A-Z0-9_]*)\}/g, // ${VAR}
  /\$([A-Z_][A-Z0-9_]*)/g, // $VAR
  /^~/g, // ~ at start (home directory)
];

/**
 * Analyze a command path for potential issues.
 */
export function analyzePath(command: string): PathInfo {
  const shellVars: string[] = [];

  // Check for shell variables
  for (const pattern of SHELL_VAR_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(command)) !== null) {
      shellVars.push(match[0]);
    }
  }

  // Check for tilde at start
  if (command.startsWith('~')) {
    if (!shellVars.includes('~')) {
      shellVars.push('~');
    }
  }

  return {
    original: command,
    isAbsolute: isAbsolute(command),
    isRelative: command.startsWith('./') || command.startsWith('../'),
    hasShellVar: shellVars.length > 0,
    shellVars,
    exists: null, // Will be set by existence check
    inPath: null, // Will be set by PATH check
    windowsBackslash: command.includes('\\'),
  };
}

/**
 * Check if a command is a known executable (npx, node, python, etc.).
 */
export function isKnownExecutable(command: string): boolean {
  // Get just the executable name (last part of path)
  const execName = command.split('/').pop() || command;
  return (KNOWN_EXECUTABLES as readonly string[]).includes(execName);
}

/**
 * Extract package name from npx/bunx args.
 *
 * @param command - The command (npx or bunx)
 * @param args - Command arguments
 * @returns Package name or undefined
 */
export function extractPackageName(command: string, args: string[]): string | undefined {
  const execName = command.split('/').pop() || command;

  if (execName !== 'npx' && execName !== 'bunx') {
    return undefined;
  }

  // Flags to skip
  const flagsToSkip = new Set(['-y', '--yes', '-q', '--quiet']);
  const flagsWithValue = new Set(['-p', '--package', '-c', '--call']);

  let skipNext = false;

  for (const arg of args) {
    if (skipNext) {
      // This is the value for a flag, could be the package
      skipNext = false;
      if (!arg.startsWith('-')) {
        return arg;
      }
      continue;
    }

    if (flagsToSkip.has(arg)) {
      continue;
    }

    if (flagsWithValue.has(arg)) {
      skipNext = true;
      continue;
    }

    // Skip any remaining flags
    if (arg.startsWith('-')) {
      continue;
    }

    // First non-flag argument is the package/command
    return arg;
  }

  return undefined;
}

/**
 * Check if an executable exists in PATH.
 */
export async function checkExecutableInPath(executable: string): Promise<boolean> {
  try {
    // Use 'which' on Unix, 'where' on Windows
    const cmd = process.platform === 'win32' ? `where ${executable}` : `which ${executable}`;
    await execAsync(cmd);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if an absolute path exists and is accessible.
 */
async function checkPathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// Path Validation
// =============================================================================

/**
 * Validate a command path in an MCP server configuration.
 *
 * @param command - The command to validate
 * @param args - Command arguments (for package name extraction)
 * @param file - Source file path
 * @param serverName - Server name
 * @param position - Position in source file
 * @returns Array of validation issues
 */
export async function validatePath(
  command: string,
  args: string[],
  file: string,
  serverName: string,
  position: Position
): Promise<McpValidationIssue[]> {
  const issues: McpValidationIssue[] = [];
  const pathInfo = analyzePath(command);

  // MCP010: Relative path warning
  if (pathInfo.isRelative) {
    issues.push(
      createIssue(
        'MCP010',
        `Server '${serverName}' uses relative path '${command}' which may not resolve correctly`,
        file,
        position,
        serverName,
        'command',
        command,
        { pathInfo },
        'Use absolute path or a known executable like npx'
      )
    );
  }

  // MCP011: Shell variable warning
  if (pathInfo.hasShellVar) {
    const varsStr = pathInfo.shellVars.join(', ');
    issues.push(
      createIssue(
        'MCP011',
        `Server '${serverName}' command contains shell variables (${varsStr}) that may not expand correctly`,
        file,
        position,
        serverName,
        'command',
        command,
        { shellVars: pathInfo.shellVars, pathInfo },
        'Use absolute path or environment variables in the env field'
      )
    );
  }

  // MCP003: Executable not found (for absolute paths)
  if (pathInfo.isAbsolute) {
    const exists = await checkPathExists(command);
    pathInfo.exists = exists;

    if (!exists) {
      issues.push(
        createIssue(
          'MCP003',
          `Server '${serverName}' executable not found at '${command}'`,
          file,
          position,
          serverName,
          'command',
          command,
          { pathInfo }
        )
      );
    }
  }

  // MCP003: Check known executables in PATH
  if (!pathInfo.isAbsolute && !pathInfo.isRelative && !pathInfo.hasShellVar) {
    if (isKnownExecutable(command)) {
      const inPath = await checkExecutableInPath(command);
      pathInfo.inPath = inPath;

      if (!inPath) {
        issues.push(
          createIssue(
            'MCP003',
            `Server '${serverName}' executable '${command}' not found in PATH`,
            file,
            position,
            serverName,
            'command',
            command,
            { pathInfo },
            `Ensure ${command} is installed and in your PATH`
          )
        );
      }
    }
  }

  // MCP024: Extract and report package name for npx/bunx
  const packageName = extractPackageName(command, args);
  if (packageName) {
    issues.push(
      createIssue(
        'MCP024',
        `Server '${serverName}' uses package '${packageName}'`,
        file,
        position,
        serverName,
        'command',
        command,
        { packageName, pathInfo }
      )
    );
  }

  return issues;
}
