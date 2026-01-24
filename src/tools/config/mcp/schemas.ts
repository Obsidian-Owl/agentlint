/**
 * MCP Config Validation Schemas
 *
 * Zod schemas for validating MCP configuration structures.
 * Uses .passthrough() to allow unknown fields for forward compatibility.
 *
 * @module tools/config/mcp/schemas
 */

import { z } from 'zod';

// =============================================================================
// Standard MCP Schemas (Claude Code, VS Code Copilot)
// =============================================================================

/**
 * Schema for a single MCP server configuration (standard format).
 *
 * Used by: Claude Code, VS Code Copilot, Cursor
 */
export const McpServerConfigSchema = z
  .object({
    // Stdio transport
    command: z.string().optional(),
    args: z.array(z.string()).optional(),

    // HTTP transport
    type: z.enum(['stdio', 'http', 'sse', 'streamable-http', 'remote']).optional(),
    url: z.string().optional(),
    headers: z.record(z.string()).optional(),

    // Common
    env: z.record(z.string()).optional(),
    timeout: z.number().int().positive().optional(),
    disabled: z.boolean().optional(),
  })
  .passthrough(); // Allow unknown fields for ACT-specific extensions

/**
 * Schema for the root MCP configuration object (standard format).
 */
export const McpConfigSchema = z.object({
  mcpServers: z.record(McpServerConfigSchema).optional(),
});

/**
 * Full config file schema including mcpServers at root.
 */
export const McpConfigFileSchema = McpConfigSchema.passthrough();

// =============================================================================
// OpenCode Schemas
// =============================================================================

/**
 * Schema for OpenCode's MCP server configuration.
 *
 * OpenCode differences:
 * - Uses `mcp` instead of `mcpServers`
 * - Uses `command: string[]` (array) instead of `command: string` + `args`
 * - Uses `environment` instead of `env`
 * - Uses `enabled` instead of `disabled`
 */
export const OpenCodeMcpServerSchema = z
  .object({
    type: z.enum(['local', 'remote']).optional(),
    command: z.array(z.string()).optional(), // Note: array in OpenCode
    enabled: z.boolean().optional(),
    environment: z.record(z.string()).optional(),
    url: z.string().optional(),
  })
  .passthrough();

/**
 * Schema for OpenCode's root configuration.
 */
export const OpenCodeConfigSchema = z
  .object({
    mcp: z.record(OpenCodeMcpServerSchema).optional(),
  })
  .passthrough();

// =============================================================================
// VS Code Copilot Schemas
// =============================================================================

/**
 * Schema for VS Code Copilot's MCP configuration.
 * Located in .vscode/mcp.json
 *
 * Format is similar to standard but may have VS Code specific extensions.
 */
export const VsCodeMcpConfigSchema = z
  .object({
    servers: z.record(McpServerConfigSchema).optional(),
    // Also accept mcpServers for compatibility
    mcpServers: z.record(McpServerConfigSchema).optional(),
  })
  .passthrough();

// =============================================================================
// Schema Detection
// =============================================================================

/**
 * Detect which schema format a config uses.
 */
export function detectConfigFormat(
  config: unknown
): 'standard' | 'opencode' | 'vscode-copilot' | 'unknown' {
  if (typeof config !== 'object' || config === null) {
    return 'unknown';
  }

  const obj = config as Record<string, unknown>;

  // OpenCode uses 'mcp' key
  if ('mcp' in obj && typeof obj.mcp === 'object') {
    return 'opencode';
  }

  // Standard uses 'mcpServers' key
  if ('mcpServers' in obj && typeof obj.mcpServers === 'object') {
    return 'standard';
  }

  // VS Code uses 'servers' key
  if ('servers' in obj && typeof obj.servers === 'object') {
    return 'vscode-copilot';
  }

  return 'unknown';
}

/**
 * Get the appropriate schema for a config format.
 */
export function getSchemaForFormat(
  format: 'standard' | 'opencode' | 'vscode-copilot' | 'unknown'
): z.ZodType {
  switch (format) {
    case 'standard':
      return McpConfigFileSchema;
    case 'opencode':
      return OpenCodeConfigSchema;
    case 'vscode-copilot':
      return VsCodeMcpConfigSchema;
    default:
      // For unknown, try standard format
      return McpConfigFileSchema;
  }
}

// =============================================================================
// Standard Fields Definition
// =============================================================================

/**
 * Standard fields that are recognized in MCP server configs.
 * Used for detecting unknown/ACT-specific fields.
 */
export const STANDARD_SERVER_FIELDS = new Set([
  'command',
  'args',
  'type',
  'url',
  'headers',
  'env',
  'timeout',
  'disabled',
]);

/**
 * OpenCode-specific fields.
 */
export const OPENCODE_SERVER_FIELDS = new Set(['type', 'command', 'enabled', 'environment', 'url']);

/**
 * Detect unknown fields in a server config.
 */
export function detectUnknownFields(
  config: Record<string, unknown>,
  format: 'standard' | 'opencode' | 'vscode-copilot' | 'unknown'
): string[] {
  const knownFields = format === 'opencode' ? OPENCODE_SERVER_FIELDS : STANDARD_SERVER_FIELDS;

  return Object.keys(config).filter((key) => !knownFields.has(key));
}
