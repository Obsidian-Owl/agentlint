/**
 * MCP Config Discovery
 *
 * Discovers MCP configuration files across multiple AI Coding Tools (ACTs).
 * Each ACT has specific config file locations at project and user levels.
 *
 * @module tools/config/mcp/discovery
 */

import { readFile, access } from 'fs/promises';
import { join, basename, dirname, isAbsolute } from 'path';
import { homedir } from 'os';
import { constants } from 'fs';

import type {
  McpAct,
  McpScope,
  McpFormat,
  McpConfigFile,
  GetMcpConfigsInput,
  GetMcpConfigsResult,
} from './types';
import { parseMcpConfig } from './parser';
import { detectConfigFormat } from './schemas';

// =============================================================================
// Config Location Registry
// =============================================================================

/**
 * A known configuration file location for an ACT.
 */
export interface ConfigLocation {
  /** Relative path from project root or absolute path pattern */
  pathPattern: string;
  /** Whether this is a user-level config */
  scope: McpScope;
  /** Configuration format used at this location */
  format: McpFormat;
  /** Other ACTs that may recognize this location */
  compatibleActs?: McpAct[];
}

/**
 * Registry of known MCP config file locations by ACT.
 *
 * Sources:
 * - Claude Code: https://code.claude.com/docs/en/mcp
 * - OpenCode: https://opencode.ai/docs/mcp-servers/
 * - VS Code: https://code.visualstudio.com/docs/copilot/customization/mcp-servers
 * - Cursor: https://docs.cursor.com/context/model-context-protocol
 * - Windsurf: https://docs.codeium.com/windsurf/mcp
 * - Amazon Q: https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/mcp-servers.html
 */
export const ACT_CONFIG_LOCATIONS: Record<McpAct, ConfigLocation[]> = {
  'claude-code': [
    {
      pathPattern: '.mcp.json',
      scope: 'project',
      format: 'standard',
      compatibleActs: ['cursor'], // Cursor also reads .mcp.json
    },
    {
      pathPattern: '~/.claude.json',
      scope: 'user',
      format: 'standard',
    },
  ],
  opencode: [
    {
      pathPattern: 'opencode.json',
      scope: 'project',
      format: 'opencode',
    },
    {
      pathPattern: '~/.config/opencode/opencode.json',
      scope: 'user',
      format: 'opencode',
    },
  ],
  'vscode-copilot': [
    {
      pathPattern: '.vscode/mcp.json',
      scope: 'project',
      format: 'vscode-copilot',
    },
  ],
  cursor: [
    {
      pathPattern: 'mcp.json',
      scope: 'project',
      format: 'standard',
    },
    {
      pathPattern: '.cursor/mcp.json',
      scope: 'project',
      format: 'standard',
    },
  ],
  windsurf: [
    {
      pathPattern: '~/.codeium/windsurf/mcp_config.json',
      scope: 'user',
      format: 'standard',
    },
  ],
  zed: [
    {
      pathPattern: '~/.config/zed/settings.json',
      scope: 'user',
      format: 'standard',
    },
  ],
  cline: [
    {
      pathPattern:
        '~/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json',
      scope: 'user',
      format: 'standard',
    },
  ],
  'amazon-q': [
    {
      pathPattern: '.amazonq/mcp.json',
      scope: 'project',
      format: 'standard',
    },
    {
      pathPattern: '~/.aws/amazonq/mcp.json',
      scope: 'user',
      format: 'standard',
    },
  ],
  unknown: [],
};

/**
 * Get config locations for a specific ACT.
 */
export function getConfigLocationsForAct(act: McpAct): ConfigLocation[] {
  return ACT_CONFIG_LOCATIONS[act] ?? [];
}

/**
 * Detect which ACT owns a config path based on filename and path patterns.
 */
export function detectActFromPath(filePath: string): McpAct {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const filename = basename(normalizedPath);
  const dirPath = dirname(normalizedPath);

  // Check specific patterns in order of specificity

  // Claude Code
  if (filename === '.mcp.json') {
    return 'claude-code';
  }
  if (filename === '.claude.json' || normalizedPath.includes('/.claude.json')) {
    return 'claude-code';
  }

  // OpenCode
  if (filename === 'opencode.json') {
    return 'opencode';
  }
  if (normalizedPath.includes('.config/opencode/')) {
    return 'opencode';
  }

  // VS Code Copilot
  if (normalizedPath.includes('.vscode/mcp.json')) {
    return 'vscode-copilot';
  }

  // Windsurf
  if (normalizedPath.includes('.codeium/windsurf/')) {
    return 'windsurf';
  }

  // Amazon Q
  if (normalizedPath.includes('.amazonq/')) {
    return 'amazon-q';
  }
  if (normalizedPath.includes('/.aws/amazonq/')) {
    return 'amazon-q';
  }

  // Cline
  if (normalizedPath.includes('claude-dev') || normalizedPath.includes('cline_mcp_settings')) {
    return 'cline';
  }

  // Zed (settings.json in zed config)
  if (normalizedPath.includes('.config/zed/')) {
    return 'zed';
  }

  // Cursor - check for mcp.json at project root or .cursor directory
  if (filename === 'mcp.json' && !normalizedPath.includes('.vscode/')) {
    // Could be cursor's mcp.json at project root
    if (dirPath.endsWith('.cursor') || !normalizedPath.includes('/')) {
      return 'cursor';
    }
    // Generic mcp.json at project root is often Cursor
    return 'cursor';
  }

  return 'unknown';
}

// =============================================================================
// File Operations
// =============================================================================

/**
 * Expand ~ to home directory in path.
 */
function expandPath(pathPattern: string): string {
  if (pathPattern.startsWith('~/')) {
    return join(homedir(), pathPattern.slice(2));
  }
  return pathPattern;
}

/**
 * Check if a file exists.
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve a path pattern to an absolute path.
 */
function resolvePath(pathPattern: string, cwd: string): string {
  const expanded = expandPath(pathPattern);
  if (isAbsolute(expanded)) {
    return expanded;
  }
  return join(cwd, expanded);
}

// =============================================================================
// Discovery Implementation
// =============================================================================

/**
 * Discover MCP configuration files across ACT-specific locations.
 *
 * @param input - Discovery options
 * @returns Discovered config files with metadata
 */
export async function discoverMcpConfigs(input: GetMcpConfigsInput): Promise<GetMcpConfigsResult> {
  const { cwd, includeUser = true, acts } = input;

  // Determine which ACTs to check
  const actsToCheck: McpAct[] =
    acts ??
    (['claude-code', 'opencode', 'vscode-copilot', 'cursor', 'windsurf', 'amazon-q'] as McpAct[]);

  const files: McpConfigFile[] = [];
  const checkedPaths = new Set<string>();

  // Check each ACT's config locations
  for (const act of actsToCheck) {
    const locations = getConfigLocationsForAct(act);

    for (const location of locations) {
      // Skip user-level configs if not requested
      if (location.scope === 'user' && !includeUser) {
        continue;
      }

      const absolutePath = resolvePath(location.pathPattern, cwd);

      // Avoid checking the same path multiple times
      if (checkedPaths.has(absolutePath)) {
        continue;
      }
      checkedPaths.add(absolutePath);

      const exists = await fileExists(absolutePath);
      const relativePath = isAbsolute(location.pathPattern)
        ? location.pathPattern
        : location.pathPattern;

      const configFile: McpConfigFile = {
        path: absolutePath,
        relativePath,
        act,
        scope: location.scope,
        exists,
        format: location.format,
        compatibleActs: location.compatibleActs ? [act, ...location.compatibleActs] : [act],
      };

      // If file exists, try to parse it for format detection and parse errors
      if (exists) {
        try {
          const content = await readFile(absolutePath, 'utf-8');
          const parseResult = parseMcpConfig(content);

          if (!parseResult.success && parseResult.errors.length > 0) {
            const firstError = parseResult.errors[0];
            if (firstError) {
              configFile.parseError = firstError;
            }
          }

          // Detect actual format from content
          if (parseResult.config) {
            const detectedFormat = detectConfigFormat(parseResult.config);
            if (detectedFormat !== 'unknown') {
              configFile.format = detectedFormat;
            }
          }
        } catch (error) {
          // File read error - treat as parse error
          configFile.parseError = {
            message: error instanceof Error ? error.message : 'Failed to read file',
            line: 1,
            column: 1,
            offset: 0,
          };
        }
      }

      files.push(configFile);
    }
  }

  // Build summary statistics
  const existingFiles = files.filter((f) => f.exists);
  const byAct: Partial<Record<McpAct, number>> = {};
  const byScope: Partial<Record<McpScope, number>> = {};

  for (const file of existingFiles) {
    byAct[file.act] = (byAct[file.act] ?? 0) + 1;
    byScope[file.scope] = (byScope[file.scope] ?? 0) + 1;
  }

  // Generate guidance messages
  const guidance: string[] = [];

  if (existingFiles.length === 0) {
    guidance.push('No MCP configuration files found.');
    guidance.push(
      'Common locations: .mcp.json (Claude Code), opencode.json (OpenCode), .vscode/mcp.json (VS Code)'
    );
    guidance.push('Create a config file to define MCP servers for your AI coding tool.');
  } else if (existingFiles.length === 1) {
    const file = existingFiles[0];
    if (file) {
      guidance.push(`Found 1 config: ${file.relativePath} (${file.act})`);
    }
  }

  // Warn about parse errors
  const parseErrorFiles = files.filter((f) => f.parseError);
  if (parseErrorFiles.length > 0) {
    guidance.push(`${parseErrorFiles.length} file(s) have parse errors - check JSON syntax`);
  }

  return {
    files,
    summary: {
      totalFiles: files.length,
      existingFiles: existingFiles.length,
      byAct,
      byScope,
    },
    guidance,
  };
}
