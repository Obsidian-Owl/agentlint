/**
 * T028: discover_configs tool definition
 *
 * SDK tool definition for discovering AI configuration files in a project.
 * Uses the Claude Agent SDK's tool() pattern for MCP integration.
 *
 * @module tools/config/discover-configs-tool
 */

import { z } from 'zod';
import { adaptTool } from '../../opencode/tool-adapter';
import { discoverConfigs } from './discovery';
import type { DiscoverConfigsResult } from './types';

/**
 * Input schema for discover_configs tool.
 */
const discoverConfigsInputSchema = {
  cwd: z.string().describe('Project root directory to search for config files'),
  includeGlobal: z
    .boolean()
    .optional()
    .describe('Include global configs from ~/.claude/ (default: false)'),
  exclude: z
    .array(z.string())
    .optional()
    .describe('Additional directory patterns to exclude from search'),
  maxDepth: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Maximum directory depth to search (default: 20)'),
};

/**
 * Format discovery results for tool output.
 */
function formatToolOutput(result: DiscoverConfigsResult): string {
  const lines: string[] = [];

  lines.push(`## Config Discovery Results\n`);
  lines.push(`**Files found**: ${result.files.length}`);
  lines.push(`**Skills found**: ${result.skills.length}`);
  lines.push(`**Files scanned**: ${result.filesScanned}`);
  lines.push(`**Directories excluded**: ${result.directoriesExcluded}`);
  lines.push(`**Duration**: ${result.durationMs}ms\n`);

  if (result.files.length > 0) {
    lines.push(`### Configuration Files\n`);
    for (const file of result.files) {
      const typeLabel = getTypeLabel(file.type);
      const levelLabel = getLevelLabel(file.level);
      lines.push(`- **${file.relativePath}** (${typeLabel}, ${levelLabel})`);
      lines.push(`  - Size: ${formatSize(file.size)}`);
      lines.push(`  - Modified: ${file.lastModified.toISOString()}`);
    }
  }

  if (result.skills.length > 0) {
    lines.push(`\n### Skills\n`);
    for (const skill of result.skills) {
      lines.push(`- ${skill.path}`);
    }
  }

  if (result.files.length === 0 && result.skills.length === 0) {
    lines.push(`\nNo configuration files found in the specified directory.`);
  }

  return lines.join('\n');
}

/**
 * Get human-readable label for config type.
 */
function getTypeLabel(type: string): string {
  switch (type) {
    case 'claude-md':
      return 'CLAUDE.md';
    case 'agents-md':
      return 'AGENTS.md';
    case 'claude-settings':
      return 'settings.json';
    case 'skill-md':
      return 'SKILL.md';
    default:
      return type;
  }
}

/**
 * Get human-readable label for hierarchy level.
 */
function getLevelLabel(level: string): string {
  switch (level) {
    case 'global':
      return 'Global';
    case 'project':
      return 'Project Root';
    case 'local':
      return 'Nested';
    default:
      return level;
  }
}

/**
 * Format file size in human-readable format.
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} bytes`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * discover_configs tool definition.
 *
 * Discovers all AI configuration files (CLAUDE.md, AGENTS.md, settings.json, SKILL.md)
 * in a project directory, with support for hierarchy detection and exclusion patterns.
 *
 * @example
 * ```typescript
 * import { discoverConfigsTool } from './tools/config/discover-configs-tool';
 * import { ToolRegistry } from './orchestration/tool-registry';
 *
 * const registry = new ToolRegistry();
 * registry.register(discoverConfigsTool);
 * ```
 */
export const discoverConfigsTool = adaptTool({
  name: 'discover_configs',
  description: `Discover AI configuration files in a project.

Searches for:
- CLAUDE.md files (Claude Code configuration)
- AGENTS.md files (Multi-agent configuration)
- .claude/settings.json (Claude settings)
- SKILL.md files (Custom skills)

Automatically excludes common non-config directories (node_modules, .git, dist, etc.).
Returns structured information about discovered files including type, hierarchy level, and metadata.`,
  schema: discoverConfigsInputSchema,
  handler: async (args: unknown) => {
    try {
      const typedArgs = args as {
        cwd: string;
        includeGlobal?: boolean;
        exclude?: string[];
        maxDepth?: number;
      };
      const input: Parameters<typeof discoverConfigs>[0] = {
        cwd: typedArgs.cwd,
      };
      if (typedArgs.includeGlobal !== undefined) {
        input.includeGlobal = typedArgs.includeGlobal;
      }
      if (typedArgs.exclude !== undefined) {
        input.exclude = typedArgs.exclude;
      }
      if (typedArgs.maxDepth !== undefined) {
        input.maxDepth = typedArgs.maxDepth;
      }
      const result = await discoverConfigs(input);

      return {
        content: [
          {
            type: 'text' as const,
            text: formatToolOutput(result),
          },
        ],
        // Include raw data for programmatic access
        _rawData: result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error discovering configs: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  },
});
