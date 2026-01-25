/**
 * MCP Config JSONC Parser
 *
 * Parses MCP configuration files with position tracking for accurate
 * error reporting with file:line:column references.
 *
 * Uses jsonc-parser for JSONC (JSON with comments) support.
 *
 * @module tools/config/mcp/parser
 */

import {
  parseTree,
  findNodeAtLocation,
  getNodeValue,
  type Node,
  type ParseError as JsoncParseError,
  type ParseErrorCode,
} from 'jsonc-parser';

import type { Point, Position, ParseError } from './types';

// =============================================================================
// Position Utilities
// =============================================================================

/**
 * Convert a character offset to line:column position.
 *
 * @param content - The source content
 * @param offset - Character offset from start of file
 * @returns Point with line (1-indexed) and column (1-indexed)
 */
export function offsetToPosition(content: string, offset: number): Point {
  let line = 1;
  let column = 1;

  for (let i = 0; i < offset && i < content.length; i++) {
    if (content[i] === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }
  }

  return { line, column, offset };
}

/**
 * Get position span for a node in the source content.
 *
 * @param content - The source content
 * @param node - The JSONC AST node
 * @returns Position with start and end points
 */
export function getNodePosition(content: string, node: Node): Position {
  const start = offsetToPosition(content, node.offset);
  const end = offsetToPosition(content, node.offset + node.length);
  return { start, end };
}

// =============================================================================
// Parse Error Conversion
// =============================================================================

/**
 * Convert jsonc-parser error code to human-readable message.
 */
function getErrorMessage(errorCode: ParseErrorCode): string {
  const messages: Record<number, string> = {
    1: 'Invalid symbol',
    2: 'Invalid number format',
    3: 'Property name expected',
    4: 'Value expected',
    5: 'Colon expected',
    6: 'Comma expected',
    7: 'Closing brace expected',
    8: 'Closing bracket expected',
    9: 'End of file expected',
    10: 'Invalid comment token',
    11: 'Unexpected end of comment',
    12: 'Unexpected end of string',
    13: 'Unexpected end of number',
    14: 'Invalid unicode',
    15: 'Invalid escape character',
    16: 'Invalid character',
  };
  return messages[errorCode] || `Parse error (code ${errorCode})`;
}

/**
 * Convert jsonc-parser errors to our ParseError format.
 */
export function convertParseErrors(content: string, errors: JsoncParseError[]): ParseError[] {
  return errors.map((error) => {
    const position = offsetToPosition(content, error.offset);
    return {
      message: getErrorMessage(error.error),
      line: position.line,
      column: position.column,
      offset: error.offset,
    };
  });
}

// =============================================================================
// MCP Config Parsing
// =============================================================================

/**
 * Result of parsing an MCP config file.
 */
export interface McpParseResult {
  /** Whether parsing succeeded (may still have warnings) */
  success: boolean;
  /** The parsed config object (or null if parsing failed) */
  config: Record<string, unknown> | null;
  /** The AST root node (or null if parsing failed) */
  tree: Node | null;
  /** Parse errors that prevented full parsing */
  errors: ParseError[];
  /** The original source content */
  content: string;
}

/**
 * Parse an MCP configuration file with JSONC support.
 *
 * @param content - The raw file content
 * @returns Parse result with config, AST tree, and any errors
 */
export function parseMcpConfig(content: string): McpParseResult {
  const errors: JsoncParseError[] = [];

  // Parse to AST with position information
  const tree = parseTree(content, errors, {
    disallowComments: false,
    allowTrailingComma: true,
    allowEmptyContent: true,
  });

  // Convert errors
  const parseErrors = convertParseErrors(content, errors);

  // If we have critical errors or no tree, return failure
  if (!tree || errors.length > 0) {
    // Try to get partial value if tree exists
    const config = tree ? (getNodeValue(tree) as Record<string, unknown>) : null;

    return {
      success: errors.length === 0,
      config,
      tree: tree ?? null,
      errors: parseErrors,
      content,
    };
  }

  // Get the parsed value
  const config = getNodeValue(tree) as Record<string, unknown>;

  return {
    success: true,
    config,
    tree,
    errors: [],
    content,
  };
}

// =============================================================================
// Position Map Builder
// =============================================================================

/**
 * A map of JSON paths to their positions in the source.
 */
export type PositionMap = Map<string, Position>;

/**
 * Build a map of JSON paths to source positions.
 *
 * @param content - The source content
 * @param tree - The AST root node
 * @returns Map from JSON path (e.g., "mcpServers.github.command") to position
 */
export function buildPositionMap(content: string, tree: Node): PositionMap {
  const positions = new Map<string, Position>();

  function traverse(node: Node, path: string[]): void {
    const currentPath = path.join('.');

    if (currentPath) {
      positions.set(currentPath, getNodePosition(content, node));
    }

    if (node.type === 'object' && node.children) {
      for (const child of node.children) {
        if (child.type === 'property' && child.children) {
          const [keyNode, valueNode] = child.children;
          if (keyNode && valueNode) {
            const key = getNodeValue(keyNode) as string;
            traverse(valueNode, [...path, key]);
          }
        }
      }
    } else if (node.type === 'array' && node.children) {
      for (let i = 0; i < node.children.length; i++) {
        const childNode = node.children[i];
        if (childNode) {
          traverse(childNode, [...path, String(i)]);
        }
      }
    }
  }

  traverse(tree, []);
  return positions;
}

/**
 * Get position for a specific path in the config.
 *
 * @param content - The source content
 * @param tree - The AST root node
 * @param path - Array of path segments (e.g., ["mcpServers", "github", "command"])
 * @returns Position or null if path not found
 */
export function getPositionAtPath(content: string, tree: Node, path: string[]): Position | null {
  const node = findNodeAtLocation(tree, path);
  if (!node) {
    return null;
  }
  return getNodePosition(content, node);
}

// =============================================================================
// Server Extraction
// =============================================================================

/**
 * Information about an extracted server from the config.
 */
export interface ExtractedServer {
  name: string;
  config: Record<string, unknown>;
  position: Position;
}

/**
 * Extract server configurations from a parsed MCP config.
 *
 * Handles both standard (mcpServers) and OpenCode (mcp) formats.
 *
 * @param content - The source content
 * @param tree - The AST root node
 * @param config - The parsed config object
 * @returns Array of extracted servers with positions
 */
export function extractServers(
  content: string,
  tree: Node,
  config: Record<string, unknown>
): ExtractedServer[] {
  const servers: ExtractedServer[] = [];

  // Standard format: mcpServers
  if (config.mcpServers && typeof config.mcpServers === 'object') {
    const mcpServers = config.mcpServers as Record<string, unknown>;
    const serversNode = findNodeAtLocation(tree, ['mcpServers']) ?? null;

    for (const [name, serverConfig] of Object.entries(mcpServers)) {
      if (typeof serverConfig === 'object' && serverConfig !== null) {
        const serverNode = serversNode ? (findNodeAtLocation(serversNode, [name]) ?? null) : null;
        const position = serverNode
          ? getNodePosition(content, serverNode)
          : { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } };

        servers.push({
          name,
          config: serverConfig as Record<string, unknown>,
          position,
        });
      }
    }
  }

  // OpenCode format: mcp
  if (config.mcp && typeof config.mcp === 'object') {
    const mcp = config.mcp as Record<string, unknown>;
    const mcpNode = findNodeAtLocation(tree, ['mcp']) ?? null;

    for (const [name, serverConfig] of Object.entries(mcp)) {
      if (typeof serverConfig === 'object' && serverConfig !== null) {
        const serverNode = mcpNode ? (findNodeAtLocation(mcpNode, [name]) ?? null) : null;
        const position = serverNode
          ? getNodePosition(content, serverNode)
          : { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } };

        servers.push({
          name,
          config: serverConfig as Record<string, unknown>,
          position,
        });
      }
    }
  }

  // VS Code format: servers (in .vscode/mcp.json)
  if (config.servers && typeof config.servers === 'object') {
    const vsServers = config.servers as Record<string, unknown>;
    const serversNode = findNodeAtLocation(tree, ['servers']) ?? null;

    for (const [name, serverConfig] of Object.entries(vsServers)) {
      if (typeof serverConfig === 'object' && serverConfig !== null) {
        const serverNode = serversNode ? (findNodeAtLocation(serversNode, [name]) ?? null) : null;
        const position = serverNode
          ? getNodePosition(content, serverNode)
          : { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } };

        servers.push({
          name,
          config: serverConfig as Record<string, unknown>,
          position,
        });
      }
    }
  }

  return servers;
}
