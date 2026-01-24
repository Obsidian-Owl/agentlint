/**
 * MCP Schema Validation
 *
 * Validates MCP server configurations against expected schema.
 * Returns structured issues with file:line:column references.
 *
 * @module tools/config/mcp/validators/schema
 */

import type { Node } from 'jsonc-parser';
import { findNodeAtLocation } from 'jsonc-parser';

import type { McpFormat, McpValidationIssue, Position, McpIssueCode } from '../types';
import { ISSUE_CODE_METADATA } from '../types';
import { getPositionAtPath, getNodePosition } from '../parser';
import { detectUnknownFields } from '../schemas';

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

/**
 * Get position for a server's property.
 */
function getServerPropertyPosition(
  content: string,
  tree: Node,
  serversKey: string,
  serverName: string,
  propertyName: string
): Position | null {
  return getPositionAtPath(content, tree, [serversKey, serverName, propertyName]);
}

/**
 * Detect the servers key based on format.
 */
function getServersKey(format: McpFormat): string {
  switch (format) {
    case 'opencode':
      return 'mcp';
    case 'vscode-copilot':
      return 'servers';
    default:
      return 'mcpServers';
  }
}

/**
 * Check if server is disabled based on format.
 */
function isServerDisabled(serverConfig: Record<string, unknown>, format: McpFormat): boolean {
  if (format === 'opencode') {
    return serverConfig.enabled === false;
  }
  return serverConfig.disabled === true;
}

// =============================================================================
// Server Schema Validation
// =============================================================================

/**
 * Validate a single server configuration.
 */
export function validateServerSchema(
  serverName: string,
  serverConfig: Record<string, unknown>,
  file: string,
  serverPosition: Position,
  format: McpFormat,
  content?: string,
  tree?: Node,
  serversKey?: string
): McpValidationIssue[] {
  const issues: McpValidationIssue[] = [];

  // Helper to get property position
  const getPropertyPos = (propertyName: string): Position => {
    if (content && tree && serversKey) {
      const pos = getServerPropertyPosition(content, tree, serversKey, serverName, propertyName);
      if (pos) return pos;
    }
    return serverPosition;
  };

  // Check for disabled server (MCP020)
  if (isServerDisabled(serverConfig, format)) {
    issues.push(
      createIssue(
        'MCP020',
        `Server '${serverName}' is disabled`,
        file,
        format === 'opencode' ? getPropertyPos('enabled') : getPropertyPos('disabled'),
        serverName,
        format === 'opencode' ? 'enabled' : 'disabled'
      )
    );
  }

  // Validate based on format
  if (format === 'opencode') {
    issues.push(
      ...validateOpenCodeServer(serverName, serverConfig, file, serverPosition, getPropertyPos)
    );
  } else {
    issues.push(
      ...validateStandardServer(serverName, serverConfig, file, serverPosition, getPropertyPos)
    );
  }

  // Check for unknown fields (MCP016)
  const unknownFields = detectUnknownFields(serverConfig, format);
  for (const fieldName of unknownFields) {
    const fieldPos = getPropertyPos(fieldName);
    issues.push(
      createIssue(
        'MCP016',
        `Unknown field '${fieldName}' in server '${serverName}' (may be ACT-specific)`,
        file,
        fieldPos,
        serverName,
        fieldName,
        undefined,
        { format }
      )
    );
  }

  return issues;
}

/**
 * Validate standard format server (Claude Code, VS Code, etc.).
 */
function validateStandardServer(
  serverName: string,
  serverConfig: Record<string, unknown>,
  file: string,
  serverPosition: Position,
  getPropertyPos: (prop: string) => Position
): McpValidationIssue[] {
  const issues: McpValidationIssue[] = [];

  const hasCommand = 'command' in serverConfig;
  const hasUrl = 'url' in serverConfig;

  // MCP001: Missing required field (need either command or url)
  if (!hasCommand && !hasUrl) {
    issues.push(
      createIssue(
        'MCP001',
        `Server '${serverName}' is missing required field: either 'command' (for stdio) or 'url' (for HTTP)`,
        file,
        serverPosition,
        serverName,
        undefined,
        undefined,
        { hasCommand, hasUrl }
      )
    );
  }

  // MCP015: Ambiguous transport (both command and url)
  if (hasCommand && hasUrl) {
    issues.push(
      createIssue(
        'MCP015',
        `Server '${serverName}' has both 'command' and 'url' - transport type is ambiguous`,
        file,
        serverPosition,
        serverName,
        undefined,
        undefined,
        { hasCommand, hasUrl },
        "Remove either 'command' (for HTTP transport) or 'url' (for stdio transport)"
      )
    );
  }

  // MCP002: Type validation for command
  if (hasCommand && typeof serverConfig.command !== 'string') {
    const commandPos = getPropertyPos('command');
    issues.push(
      createIssue(
        'MCP002',
        `Field 'command' in server '${serverName}' must be a string, got ${typeof serverConfig.command}`,
        file,
        commandPos,
        serverName,
        'command',
        String(serverConfig.command)
      )
    );
  }

  // MCP002: Type validation for args
  if ('args' in serverConfig && !Array.isArray(serverConfig.args)) {
    const argsPos = getPropertyPos('args');
    issues.push(
      createIssue(
        'MCP002',
        `Field 'args' in server '${serverName}' must be an array of strings, got ${typeof serverConfig.args}`,
        file,
        argsPos,
        serverName,
        'args',
        String(serverConfig.args)
      )
    );
  }

  // MCP002: Type validation for env
  if (
    'env' in serverConfig &&
    (typeof serverConfig.env !== 'object' ||
      serverConfig.env === null ||
      Array.isArray(serverConfig.env))
  ) {
    const envPos = getPropertyPos('env');
    issues.push(
      createIssue(
        'MCP002',
        `Field 'env' in server '${serverName}' must be an object, got ${Array.isArray(serverConfig.env) ? 'array' : typeof serverConfig.env}`,
        file,
        envPos,
        serverName,
        'env'
      )
    );
  }

  // MCP002: Type validation for url
  if (hasUrl && typeof serverConfig.url !== 'string') {
    const urlPos = getPropertyPos('url');
    issues.push(
      createIssue(
        'MCP002',
        `Field 'url' in server '${serverName}' must be a string, got ${typeof serverConfig.url}`,
        file,
        urlPos,
        serverName,
        'url',
        String(serverConfig.url)
      )
    );
  }

  // MCP002: Type validation for timeout
  if ('timeout' in serverConfig && typeof serverConfig.timeout !== 'number') {
    const timeoutPos = getPropertyPos('timeout');
    issues.push(
      createIssue(
        'MCP002',
        `Field 'timeout' in server '${serverName}' must be a number, got ${typeof serverConfig.timeout}`,
        file,
        timeoutPos,
        serverName,
        'timeout',
        String(serverConfig.timeout)
      )
    );
  }

  // MCP002: Type validation for headers
  if (
    'headers' in serverConfig &&
    (typeof serverConfig.headers !== 'object' ||
      serverConfig.headers === null ||
      Array.isArray(serverConfig.headers))
  ) {
    const headersPos = getPropertyPos('headers');
    issues.push(
      createIssue(
        'MCP002',
        `Field 'headers' in server '${serverName}' must be an object, got ${Array.isArray(serverConfig.headers) ? 'array' : typeof serverConfig.headers}`,
        file,
        headersPos,
        serverName,
        'headers'
      )
    );
  }

  return issues;
}

/**
 * Validate OpenCode format server.
 */
function validateOpenCodeServer(
  serverName: string,
  serverConfig: Record<string, unknown>,
  file: string,
  serverPosition: Position,
  getPropertyPos: (prop: string) => Position
): McpValidationIssue[] {
  const issues: McpValidationIssue[] = [];

  const hasCommand = 'command' in serverConfig;
  const hasUrl = 'url' in serverConfig;

  // MCP001: Missing required field
  if (!hasCommand && !hasUrl) {
    issues.push(
      createIssue(
        'MCP001',
        `Server '${serverName}' is missing required field: either 'command' (for local) or 'url' (for remote)`,
        file,
        serverPosition,
        serverName
      )
    );
  }

  // MCP002: In OpenCode, command should be an array
  if (hasCommand && !Array.isArray(serverConfig.command)) {
    const commandPos = getPropertyPos('command');
    issues.push(
      createIssue(
        'MCP002',
        `Field 'command' in OpenCode server '${serverName}' must be an array, got ${typeof serverConfig.command}`,
        file,
        commandPos,
        serverName,
        'command',
        String(serverConfig.command),
        undefined,
        'Change to array format: ["npx", "-y", "package-name"]'
      )
    );
  }

  // MCP002: Type validation for environment
  if (
    'environment' in serverConfig &&
    (typeof serverConfig.environment !== 'object' ||
      serverConfig.environment === null ||
      Array.isArray(serverConfig.environment))
  ) {
    const envPos = getPropertyPos('environment');
    issues.push(
      createIssue(
        'MCP002',
        `Field 'environment' in server '${serverName}' must be an object, got ${Array.isArray(serverConfig.environment) ? 'array' : typeof serverConfig.environment}`,
        file,
        envPos,
        serverName,
        'environment'
      )
    );
  }

  // MCP002: Type validation for url
  if (hasUrl && typeof serverConfig.url !== 'string') {
    const urlPos = getPropertyPos('url');
    issues.push(
      createIssue(
        'MCP002',
        `Field 'url' in server '${serverName}' must be a string, got ${typeof serverConfig.url}`,
        file,
        urlPos,
        serverName,
        'url',
        String(serverConfig.url)
      )
    );
  }

  return issues;
}

// =============================================================================
// Full Config Validation
// =============================================================================

/**
 * Validate an entire MCP configuration.
 *
 * @param config - Parsed config object
 * @param tree - JSONC AST tree for position lookup
 * @param content - Raw file content for position calculation
 * @param file - Absolute file path
 * @param format - Config format (standard, opencode, vscode-copilot)
 * @returns Array of validation issues
 */
export function validateSchema(
  config: Record<string, unknown>,
  tree: Node,
  content: string,
  file: string,
  format: McpFormat
): McpValidationIssue[] {
  const issues: McpValidationIssue[] = [];

  // Determine the servers key based on format
  const serversKey = getServersKey(format);
  const servers = config[serversKey];

  // If no servers object, nothing to validate
  if (!servers || typeof servers !== 'object' || Array.isArray(servers)) {
    return issues;
  }

  const serversObj = servers as Record<string, unknown>;

  // Validate each server
  for (const [serverName, serverConfig] of Object.entries(serversObj)) {
    if (typeof serverConfig !== 'object' || serverConfig === null) {
      continue;
    }

    // Get position for this server in the source
    const serverNode = findNodeAtLocation(tree, [serversKey, serverName]);
    const serverPosition: Position = serverNode
      ? getNodePosition(content, serverNode)
      : { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } };

    // Validate server schema
    const serverIssues = validateServerSchema(
      serverName,
      serverConfig as Record<string, unknown>,
      file,
      serverPosition,
      format,
      content,
      tree,
      serversKey
    );

    issues.push(...serverIssues);
  }

  return issues;
}
