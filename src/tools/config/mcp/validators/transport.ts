/**
 * MCP Transport Validation
 *
 * Validates transport configuration in MCP server configurations.
 * Detects deprecated transports, invalid URLs, and Docker issues.
 *
 * @module tools/config/mcp/validators/transport
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
// URL Validation
// =============================================================================

/**
 * URL validation result.
 */
export interface UrlValidationResult {
  /** Whether the URL is syntactically valid */
  isValid: boolean;
  /** The protocol (e.g., 'http:', 'https:') */
  protocol?: string;
  /** The hostname */
  hostname?: string;
  /** The port number */
  port?: number;
  /** Whether this is a localhost URL */
  isLocal?: boolean;
  /** Error message if invalid */
  error?: string;
}

/**
 * Validate a URL for MCP transport.
 *
 * @param url - URL string to validate
 * @returns Validation result with parsed components
 */
export function validateUrl(url: string): UrlValidationResult {
  try {
    const parsed = new URL(url);

    // Only allow http and https protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        isValid: false,
        error: `Invalid protocol '${parsed.protocol}'. Only http: and https: are allowed.`,
      };
    }

    const isLocal =
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '::1';

    const result: UrlValidationResult = {
      isValid: true,
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      isLocal,
    };
    if (parsed.port) {
      result.port = parseInt(parsed.port, 10);
    }
    return result;
  } catch {
    return {
      isValid: false,
      error: 'Invalid URL format',
    };
  }
}

// =============================================================================
// Docker Command Detection
// =============================================================================

/**
 * Docker command analysis result.
 */
export interface DockerCommandInfo {
  /** Whether this is a docker command */
  isDocker: boolean;
  /** The docker subcommand (run, exec, etc.) */
  subcommand?: string;
  /** Whether the -i/--interactive flag is present */
  hasInteractiveFlag: boolean;
  /** The docker image name */
  imageName?: string;
}

/**
 * Detect and analyze a docker command.
 *
 * @param command - The command executable
 * @param args - Command arguments
 * @returns Docker command analysis
 */
export function detectDockerCommand(command: string, args: string[]): DockerCommandInfo {
  // Normalize command - handle paths like /usr/bin/docker
  const cmdName = command.split('/').pop() ?? command;

  if (cmdName !== 'docker') {
    return {
      isDocker: false,
      hasInteractiveFlag: false,
    };
  }

  // Find docker subcommand
  const subcommand = args.find((arg) => !arg.startsWith('-'));

  // Check for interactive flag
  const hasInteractiveFlag = args.some(
    (arg) =>
      arg === '-i' ||
      arg === '--interactive' ||
      arg === '-it' ||
      arg === '-ti' ||
      (arg.startsWith('-') && !arg.startsWith('--') && arg.includes('i'))
  );

  // Find image name (typically last non-flag argument before any command to run)
  let imageName: string | undefined;
  if (subcommand === 'run') {
    // For docker run, find the image after all flags
    let foundImage = false;
    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      if (!arg) continue;
      if (arg.startsWith('-')) {
        // Skip flags and their values
        if (
          (arg === '-e' ||
            arg === '-v' ||
            arg === '-p' ||
            arg === '--env' ||
            arg === '--volume' ||
            arg === '--publish') &&
          i + 1 < args.length
        ) {
          i++; // Skip the value
        }
        continue;
      }
      if (!foundImage) {
        imageName = arg;
        foundImage = true;
      }
    }
  }

  const result: DockerCommandInfo = {
    isDocker: true,
    hasInteractiveFlag,
  };
  if (subcommand !== undefined) result.subcommand = subcommand;
  if (imageName !== undefined) result.imageName = imageName;
  return result;
}

// =============================================================================
// Transport Analysis
// =============================================================================

/**
 * Transport type.
 */
export type TransportType = 'stdio' | 'sse' | 'http' | 'unknown';

/**
 * Transport analysis result.
 */
export interface TransportInfo {
  /** The transport type */
  type: TransportType;
  /** Whether this transport is deprecated */
  isDeprecated: boolean;
  /** URL validation result if applicable */
  urlInfo?: UrlValidationResult;
  /** Docker command info if applicable */
  dockerInfo?: DockerCommandInfo;
}

/**
 * Server configuration for transport analysis.
 */
export interface ServerTransportConfig {
  command?: string;
  args?: string[];
  url?: string;
  transport?: 'stdio' | 'sse';
}

/**
 * Analyze the transport configuration of an MCP server.
 *
 * @param config - Server configuration
 * @returns Transport analysis
 */
export function analyzeTransport(config: ServerTransportConfig): TransportInfo {
  // Check for explicit transport type
  if (config.transport === 'sse') {
    const result: TransportInfo = {
      type: 'sse',
      isDeprecated: true,
    };
    if (config.url) {
      result.urlInfo = validateUrl(config.url);
    }
    return result;
  }

  // Check for stdio transport (has command)
  if (config.command) {
    const dockerInfo = detectDockerCommand(config.command, config.args ?? []);
    const result: TransportInfo = {
      type: 'stdio',
      isDeprecated: false,
    };
    if (dockerInfo.isDocker) {
      result.dockerInfo = dockerInfo;
    }
    return result;
  }

  // Check for URL-based transport
  if (config.url) {
    const urlInfo = validateUrl(config.url);

    // Detect SSE from URL pattern
    if (config.url.endsWith('/sse') || config.url.includes('/sse?')) {
      const result: TransportInfo = {
        type: 'sse',
        isDeprecated: true,
        urlInfo,
      };
      return result;
    }

    const result: TransportInfo = {
      type: 'http',
      isDeprecated: false,
      urlInfo,
    };
    return result;
  }

  return {
    type: 'unknown',
    isDeprecated: false,
  };
}

// =============================================================================
// Transport Validation
// =============================================================================

/**
 * Validate transport configuration in an MCP server.
 *
 * @param config - Server configuration
 * @param file - Source file path
 * @param serverName - Server name
 * @param position - Position in source file
 * @returns Array of validation issues
 */
export function validateTransport(
  config: ServerTransportConfig,
  file: string,
  serverName: string,
  position: Position
): McpValidationIssue[] {
  const issues: McpValidationIssue[] = [];
  const transportInfo = analyzeTransport(config);

  // MCP012: Deprecated SSE transport
  if (transportInfo.type === 'sse' && transportInfo.isDeprecated) {
    issues.push(
      createIssue(
        'MCP012',
        `Server '${serverName}' uses deprecated SSE transport`,
        file,
        position,
        serverName,
        'transport',
        config.transport ?? 'sse',
        { transportInfo },
        'Consider migrating to HTTP transport (streamable HTTP is the modern replacement for SSE)'
      )
    );
  }

  // MCP004: Invalid URL format
  if (config.url && transportInfo.urlInfo && !transportInfo.urlInfo.isValid) {
    issues.push(
      createIssue(
        'MCP004',
        `Server '${serverName}' has invalid URL: ${transportInfo.urlInfo.error}`,
        file,
        position,
        serverName,
        'url',
        config.url,
        { urlInfo: transportInfo.urlInfo }
      )
    );
  }

  // MCP005: Docker missing -i flag
  if (transportInfo.dockerInfo?.isDocker && !transportInfo.dockerInfo.hasInteractiveFlag) {
    const subcommand = transportInfo.dockerInfo.subcommand ?? 'run';
    issues.push(
      createIssue(
        'MCP005',
        `Server '${serverName}' docker ${subcommand} missing -i flag for stdio`,
        file,
        position,
        serverName,
        'args',
        config.args?.join(' '),
        { dockerInfo: transportInfo.dockerInfo },
        `Add -i flag to docker ${subcommand} command for MCP stdio communication`
      )
    );
  }

  return issues;
}
