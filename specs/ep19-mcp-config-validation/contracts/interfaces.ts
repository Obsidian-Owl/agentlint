/**
 * EP19 MCP Config Validation - Type Contracts
 *
 * These interfaces define the data structures for MCP configuration
 * discovery and validation tools. Tools return data for agent reasoning.
 *
 * @module specs/ep19-mcp-config-validation/contracts
 */

// =============================================================================
// Enumerations
// =============================================================================

/**
 * AI Coding Tool that uses this MCP config.
 */
export type McpAct =
  | 'claude-code'
  | 'opencode'
  | 'vscode-copilot'
  | 'cursor'
  | 'windsurf'
  | 'zed'
  | 'cline'
  | 'amazon-q'
  | 'unknown';

/**
 * Configuration scope level.
 */
export type McpScope = 'project' | 'user' | 'enterprise' | 'unknown';

/**
 * Configuration format variant.
 */
export type McpFormat = 'standard' | 'opencode' | 'vscode-copilot' | 'unknown';

/**
 * Transport protocol type.
 */
export type McpTransport =
  | 'stdio'
  | 'http'
  | 'streamable-http'
  | 'sse'
  | 'remote'
  | 'unknown';

/**
 * Classification of command field.
 */
export type CommandType =
  | 'npx'
  | 'bunx'
  | 'node'
  | 'python'
  | 'docker'
  | 'absolute'
  | 'relative'
  | 'shell'
  | 'unknown';

/**
 * Structured issue codes.
 */
export type McpIssueCode =
  // Errors (MCP001-MCP009)
  | 'MCP001' // Missing required field
  | 'MCP002' // Invalid field type
  | 'MCP003' // Executable not found
  | 'MCP004' // Invalid URL format
  | 'MCP005' // Docker missing -i flag
  // Warnings (MCP010-MCP019)
  | 'MCP010' // Relative path in command
  | 'MCP011' // Shell variable may not expand
  | 'MCP012' // Deprecated transport (SSE)
  | 'MCP013' // Deprecated package
  | 'MCP014' // Sensitive data in config
  | 'MCP015' // Ambiguous transport
  | 'MCP016' // Unknown field
  | 'MCP017' // High timeout value
  // Info (MCP020-MCP029)
  | 'MCP020' // Server is disabled
  | 'MCP021' // ACT-specific config location
  | 'MCP022' // Cross-ACT compatibility note
  | 'MCP023' // Variable reference detected
  | 'MCP024'; // Package name extracted

/**
 * Issue severity level.
 */
export type IssueSeverity = 'error' | 'warning' | 'info';

// =============================================================================
// Position Types
// =============================================================================

/**
 * A point in a source file.
 */
export interface Point {
  /** Line number (1-indexed) */
  line: number;
  /** Column number (1-indexed) */
  column: number;
  /** Character offset from start of file */
  offset?: number;
}

/**
 * Position span in source file.
 */
export interface Position {
  start: Point;
  end: Point;
}

// =============================================================================
// Core Entities
// =============================================================================

/**
 * Parse error details.
 */
export interface ParseError {
  message: string;
  line: number;
  column: number;
  offset: number;
}

/**
 * A discovered MCP configuration file.
 */
export interface McpConfigFile {
  /** Absolute path to the file */
  path: string;
  /** Path relative to project root */
  relativePath: string;
  /** Which ACT uses this config location */
  act: McpAct;
  /** Configuration scope level */
  scope: McpScope;
  /** Whether the file actually exists */
  exists: boolean;
  /** Parse error if JSON/JSONC invalid */
  parseError?: ParseError;
  /** Configuration format variant */
  format: McpFormat;
}

/**
 * Path analysis context.
 */
export interface PathInfo {
  /** Original command value */
  original: string;
  /** Is absolute path */
  isAbsolute: boolean;
  /** Is relative path (starts with ./) */
  isRelative: boolean;
  /** Contains ~ or $VAR */
  hasShellVar: boolean;
  /** Detected shell variables */
  shellVars: string[];
  /** null if can't check (not absolute) */
  exists: boolean | null;
  /** null if not a known executable */
  inPath: boolean | null;
  /** Contains Windows backslashes */
  windowsBackslash: boolean;
}

/**
 * Environment variable analysis.
 */
export interface EnvVarInfo {
  name: string;
  value: string;
  /** Matches secret patterns */
  isSensitive: boolean;
  /** Value contains ${...} */
  hasVariableRef: boolean;
  position: Position;
}

/**
 * Detected variable reference pattern.
 */
export interface VariableRef {
  /** Full pattern: ${VAR}, ${env:VAR}, etc. */
  pattern: string;
  /** Extracted variable name */
  varName: string;
  location: 'command' | 'args' | 'env' | 'url';
  position: Position;
  /** Which ACTs support this pattern */
  actSupport: McpAct[];
}

/**
 * Rich context for agent reasoning about a server.
 */
export interface McpServerContext {
  transport: McpTransport;
  commandType?: CommandType;
  /** Extracted npm package name (for npx) */
  packageName?: string;
  pathInfo?: PathInfo;
  envVars: EnvVarInfo[];
  variableRefs: VariableRef[];
  unknownFields: string[];
  isDisabled: boolean;
}

/**
 * A single MCP server definition.
 */
export interface McpServerConfig {
  /** Server name (key in mcpServers object) */
  name: string;
  /** Parent config file path */
  sourceFile: string;
  /** Location in source file */
  position: Position;
  /** Inferred transport type */
  transport: McpTransport;
  /** Command for stdio transport */
  command?: string;
  /** Arguments for command */
  args?: string[];
  /** URL for HTTP transport */
  url?: string;
  /** HTTP headers */
  headers?: Record<string, string>;
  /** Environment variables */
  env?: Record<string, string>;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Whether server is disabled */
  disabled?: boolean;
  /** Original config object */
  rawConfig: Record<string, unknown>;
  /** Fields not in standard schema */
  unknownFields: string[];
}

/**
 * A single validation finding.
 */
export interface McpValidationIssue {
  code: McpIssueCode;
  severity: IssueSeverity;
  message: string;
  /** Absolute file path */
  file: string;
  /** Line number (1-indexed) */
  line: number;
  /** Column number (1-indexed) */
  column: number;
  /** Related server name */
  serverName?: string;
  /** Related field name */
  field?: string;
  /** The problematic value */
  value?: string;
  /** Additional context for agent */
  context?: Record<string, unknown>;
  /** Suggested fix (if deterministic) */
  fix?: string;
}

/**
 * Validation outcome for a single server.
 */
export interface McpValidationResult {
  serverName: string;
  configFile: string;
  issues: McpValidationIssue[];
  context: McpServerContext;
}

// =============================================================================
// Tool Input/Output Types
// =============================================================================

/**
 * Input for get_mcp_configs tool.
 */
export interface GetMcpConfigsInput {
  /** Project directory */
  cwd: string;
  /** Include user-level configs (default: true) */
  includeUser?: boolean;
  /** Filter to specific ACTs (default: all supported) */
  acts?: McpAct[];
}

/**
 * Result from get_mcp_configs tool.
 */
export interface GetMcpConfigsResult {
  files: McpConfigFile[];
  summary: {
    totalFiles: number;
    existingFiles: number;
    byAct: Partial<Record<McpAct, number>>;
    byScope: Partial<Record<McpScope, number>>;
  };
  /** Helpful context if no/few configs found */
  guidance: string[];
}

/**
 * Input for validate_mcp_config tool.
 */
export interface ValidateMcpConfigInput {
  /** Absolute path to config file */
  filePath: string;
  /** Override ACT detection */
  act?: McpAct;
}

/**
 * Result from validate_mcp_config tool.
 */
export interface ValidateMcpConfigResult {
  file: McpConfigFile;
  servers: McpValidationResult[];
  issues: McpValidationIssue[];
  summary: {
    serverCount: number;
    errorCount: number;
    warningCount: number;
    infoCount: number;
  };
}

/**
 * Aggregate statistics.
 */
export interface InventorySummary {
  totalFiles: number;
  totalServers: number;
  totalIssues: number;
  issuesByCode: Partial<Record<McpIssueCode, number>>;
  issuesBySeverity: Partial<Record<IssueSeverity, number>>;
  serversByAct: Partial<Record<McpAct, number>>;
  serversByTransport: Partial<Record<McpTransport, number>>;
}

/**
 * Aggregated view of all MCP configs.
 */
export interface McpConfigInventory {
  files: McpConfigFile[];
  servers: McpServerConfig[];
  issues: McpValidationIssue[];
  summary: InventorySummary;
}
