/**
 * get_mcp_configs Tool Definition
 *
 * SDK tool definition for discovering MCP configuration files across
 * multiple AI Coding Tools (ACTs). Returns structured data for agent reasoning.
 *
 * @module tools/config/mcp/get-mcp-configs-tool
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { discoverMcpConfigs } from './discovery';
import type { McpAct, GetMcpConfigsResult } from './types';

/**
 * Input schema for get_mcp_configs tool.
 */
const getMcpConfigsInputSchema = {
  cwd: z.string().describe('Project directory to search for MCP config files'),
  includeUser: z
    .boolean()
    .optional()
    .describe('Include user-level configs like ~/.claude.json (default: true)'),
  acts: z
    .array(
      z.enum([
        'claude-code',
        'opencode',
        'vscode-copilot',
        'cursor',
        'windsurf',
        'zed',
        'cline',
        'amazon-q',
      ])
    )
    .optional()
    .describe('Filter to specific AI Coding Tools (default: all supported)'),
};

/**
 * Format discovery results for tool output.
 */
function formatToolOutput(result: GetMcpConfigsResult): string {
  const lines: string[] = [];

  lines.push(`## MCP Config Discovery Results\n`);
  lines.push(`**Total locations checked**: ${result.summary.totalFiles}`);
  lines.push(`**Existing files found**: ${result.summary.existingFiles}\n`);

  // Group by existence
  const existingFiles = result.files.filter((f) => f.exists);
  const missingFiles = result.files.filter((f) => !f.exists);

  if (existingFiles.length > 0) {
    lines.push(`### Found Configuration Files\n`);
    for (const file of existingFiles) {
      const scopeLabel = file.scope === 'user' ? '(user)' : '(project)';
      lines.push(`- **${file.relativePath}** ${scopeLabel}`);
      lines.push(`  - ACT: ${file.act}`);
      lines.push(`  - Format: ${file.format}`);
      if (file.parseError) {
        lines.push(
          `  - ⚠️ Parse error: ${file.parseError.message} at line ${file.parseError.line}`
        );
      }
      if (file.compatibleActs && file.compatibleActs.length > 1) {
        lines.push(
          `  - Also recognized by: ${file.compatibleActs.filter((a) => a !== file.act).join(', ')}`
        );
      }
    }
  }

  if (missingFiles.length > 0 && existingFiles.length > 0) {
    lines.push(`\n### Checked Locations (not found)\n`);
    for (const file of missingFiles) {
      lines.push(`- ${file.relativePath} (${file.act})`);
    }
  }

  // Summary by ACT
  if (Object.keys(result.summary.byAct).length > 0) {
    lines.push(`\n### Summary by ACT\n`);
    for (const [act, count] of Object.entries(result.summary.byAct)) {
      lines.push(`- ${act}: ${count} file(s)`);
    }
  }

  // Guidance
  if (result.guidance.length > 0) {
    lines.push(`\n### Guidance\n`);
    for (const guidance of result.guidance) {
      lines.push(`- ${guidance}`);
    }
  }

  return lines.join('\n');
}

/**
 * get_mcp_configs tool definition.
 *
 * Discovers MCP configuration files across AI Coding Tools (ACTs) including
 * Claude Code, OpenCode, VS Code Copilot, Cursor, Windsurf, and Amazon Q.
 *
 * @example
 * ```typescript
 * import { getMcpConfigsTool } from './tools/config/mcp/get-mcp-configs-tool';
 * import { ToolRegistry } from './orchestration/tool-registry';
 *
 * const registry = new ToolRegistry();
 * registry.register(getMcpConfigsTool);
 * ```
 */
export const getMcpConfigsTool = tool(
  'get_mcp_configs',
  `Discover MCP configuration files in a project.

Searches for MCP server configurations across multiple AI Coding Tools:
- Claude Code: .mcp.json (project), ~/.claude.json (user)
- OpenCode: opencode.json (project), ~/.config/opencode/opencode.json (user)
- VS Code Copilot: .vscode/mcp.json
- Cursor: mcp.json, .cursor/mcp.json
- Windsurf: ~/.codeium/windsurf/mcp_config.json
- Amazon Q: .amazonq/mcp.json (project), ~/.aws/amazonq/mcp.json (user)

Returns structured information including:
- Which files exist and their locations
- Parse errors if JSON is invalid
- Configuration format (standard, opencode, vscode-copilot)
- Cross-ACT compatibility information

Use this tool to understand what MCP configurations exist before validating them.`,
  getMcpConfigsInputSchema,
  async (args) => {
    try {
      const input: Parameters<typeof discoverMcpConfigs>[0] = {
        cwd: args.cwd,
      };
      if (args.includeUser !== undefined) {
        input.includeUser = args.includeUser;
      }
      if (args.acts !== undefined) {
        input.acts = args.acts as McpAct[];
      }
      const result = await discoverMcpConfigs(input);

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
            text: `Error discovering MCP configs: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);
