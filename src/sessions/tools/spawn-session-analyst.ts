/**
 * EP15 Session Intelligence - spawn_session_analyst Tool
 *
 * SDK tool definition for spawning the session analyst subagent.
 * Uses the Claude Agent SDK's tool() pattern per ADR-0005.
 *
 * This tool enables the orchestrator to delegate session analysis
 * tasks to a specialized subagent with domain-specific context.
 *
 * @module sessions/tools/spawn-session-analyst
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';

import { buildSessionAnalystAgent } from '../subagent/session-analyst';
import type { SessionAnalysisContext } from '../subagent/types';
import type { AnalysisFocus, SpawnSessionAnalystOutput } from '../types';

// =============================================================================
// Input Schema
// =============================================================================

/**
 * Focus areas for session analysis.
 * Each focus area guides the subagent's analysis priority.
 */
const AnalysisFocusSchema = z.enum(['narrative', 'flow', 'quality', 'comprehensive']);

/**
 * Input schema for spawn_session_analyst tool.
 */
const spawnSessionAnalystInputSchema = {
  sessionId: z.string().describe('Session UUID to analyze'),

  filePath: z
    .string()
    .optional()
    .describe('Direct path to session JSONL file (alternative to sessionId lookup)'),

  compareToSessionId: z.string().optional().describe('Optional second session ID for comparison'),

  compareToFilePath: z.string().optional().describe('Direct path to comparison session file'),

  query: z.string().optional().describe('Specific question or analysis request for the subagent'),

  focus: AnalysisFocusSchema.default('comprehensive').describe(
    `
Analysis focus area:
- narrative: Reconstruct what happened, tell the story
- flow: Analyze tool sequences, phases, patterns
- quality: Assess test/build/lint outcomes, MCP health
- comprehensive: Full analysis combining all dimensions
  `.trim()
  ),
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Build the analysis context for the subagent.
 * @internal Exported for testing
 */
export async function buildAnalysisContext(args: {
  sessionId: string;
  filePath?: string;
  compareToSessionId?: string;
  compareToFilePath?: string;
  query?: string;
  focus: AnalysisFocus;
}): Promise<SessionAnalysisContext> {
  // Check if primary session file exists
  let sessionFileExists = false;
  let sessionFilePath: string | undefined;

  if (args.filePath) {
    try {
      await access(args.filePath, constants.R_OK);
      sessionFileExists = true;
      sessionFilePath = args.filePath;
    } catch {
      sessionFileExists = false;
    }
  }

  // Build context with required properties
  const context: SessionAnalysisContext = {
    sessionId: args.sessionId,
    focus: args.focus,
    sessionFileExists,
  };

  // Add optional properties only if defined
  if (sessionFilePath !== undefined) {
    context.sessionFilePath = sessionFilePath;
  }
  if (args.compareToSessionId !== undefined) {
    context.compareToSessionId = args.compareToSessionId;
  }
  if (args.compareToFilePath !== undefined) {
    context.comparisonFilePath = args.compareToFilePath;
  }
  if (args.query !== undefined) {
    context.query = args.query;
  }

  return context;
}

/**
 * Build the query prompt for the subagent based on focus and context.
 * @internal Exported for testing
 */
export function buildQueryPrompt(focus: AnalysisFocus, context: SessionAnalysisContext): string {
  const parts: string[] = [];

  // Session identification
  parts.push(`Analyze session: ${context.sessionId}`);

  if (context.sessionFilePath) {
    parts.push(`Session file: ${context.sessionFilePath}`);
  }

  // Comparison context
  if (context.compareToSessionId) {
    parts.push('');
    parts.push(`Compare to session: ${context.compareToSessionId}`);
    if (context.comparisonFilePath) {
      parts.push(`Comparison file: ${context.comparisonFilePath}`);
    }
  }

  parts.push('');

  // Focus-specific instructions
  switch (focus) {
    case 'narrative':
      parts.push('Focus: NARRATIVE ANALYSIS');
      parts.push('- Reconstruct the session story from start to finish');
      parts.push('- Identify the developer intent and whether it was achieved');
      parts.push('- Note key decisions and turning points');
      parts.push('- Use get_session_timeline first, then get_tool_sequences');
      break;

    case 'flow':
      parts.push('Focus: FLOW ANALYSIS');
      parts.push('- Analyze tool sequence patterns');
      parts.push('- Identify phases (exploration → implementation → debugging)');
      parts.push('- Find repeat patterns that may indicate struggles');
      parts.push('- Map file access patterns');
      parts.push('- Use get_tool_sequences and get_file_accesses');
      break;

    case 'quality':
      parts.push('Focus: QUALITY ANALYSIS');
      parts.push('- Check test, build, and lint outcomes');
      parts.push('- Assess MCP server health and error rates');
      parts.push('- Evaluate delegation success rates');
      parts.push('- Identify quality issues and their resolution');
      parts.push('- Use get_quality_signals and get_mcp_usage');
      break;

    case 'comprehensive':
      parts.push('Focus: COMPREHENSIVE ANALYSIS');
      parts.push('- Combine narrative, flow, and quality analysis');
      parts.push('- Look for patterns that emerge from cross-referencing');
      parts.push('- Provide actionable insights');
      parts.push('- Use all available tools');
      break;
  }

  // Add user query if provided
  if (context.query) {
    parts.push('');
    parts.push(`User question: ${context.query}`);
    parts.push('Address this question directly in your analysis.');
  }

  return parts.join('\n');
}

/**
 * Format the tool output for display.
 */
function formatToolOutput(result: SpawnSessionAnalystOutput): string {
  const lines: string[] = [];

  lines.push(`## Session Analyst Spawned\n`);
  lines.push(`**Session**: ${result.context.sessionId}`);
  lines.push(`**Focus**: ${result.focus}`);
  lines.push(`**Tools Available**: ${result.agentDefinition.toolCount}`);

  if (result.context.compareToSessionId) {
    lines.push(`**Comparing To**: ${result.context.compareToSessionId}`);
  }

  lines.push(`\n### Analysis Context\n`);

  if (result.context.query) {
    lines.push(`**Query**: ${result.context.query}`);
  }

  lines.push(`\n### Subagent Prompt\n`);
  lines.push('```');
  lines.push(result.queryPrompt);
  lines.push('```');

  lines.push(`\n### Available Tools\n`);
  for (const toolName of result.agentDefinition.tools) {
    lines.push(`- ${toolName}`);
  }

  lines.push(`\n---`);
  lines.push(result.message);

  return lines.join('\n');
}

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * spawn_session_analyst tool definition.
 *
 * Spawns the session analyst subagent with configurable focus.
 * Returns the agent definition and context for orchestrator delegation.
 *
 * Per Constitution Principle C8 (single subagent depth), this tool
 * does NOT execute the subagent directly. Instead, it returns the
 * agent definition for the orchestrator to invoke via SDK.
 *
 * @example
 * ```typescript
 * import { spawnSessionAnalystTool } from './sessions/tools/spawn-session-analyst';
 * import { ToolRegistry } from './orchestration/tool-registry';
 *
 * const registry = new ToolRegistry();
 * registry.register(spawnSessionAnalystTool);
 * ```
 */
export const spawnSessionAnalystTool = tool(
  'spawn_session_analyst',
  `
Spawn a session analyst subagent to understand a Claude Code session.

Use this tool when you need to:
- Understand what happened in a session
- Compare two sessions
- Identify workflow patterns or issues
- Generate session narratives for reporting

The subagent has deep domain knowledge about:
- Session JSONL structure and entry types
- Tool categories and their meanings
- Phase detection (exploration → implementation → debugging)
- Quality signal interpretation
- MCP integration health assessment

Focus options:
- narrative: Tell the session story, identify intent and outcome
- flow: Analyze tool sequences, phases, repeat patterns
- quality: Assess test/build/lint, MCP health, delegation success
- comprehensive: Full multi-dimensional analysis

Returns the subagent definition and context for orchestrator delegation.
The orchestrator should invoke the subagent using the SDK agents option.
  `.trim(),
  spawnSessionAnalystInputSchema,
  async (args) => {
    try {
      // Build agent definition
      const agent = buildSessionAnalystAgent();

      // Build context args - only pass defined optional properties
      const contextArgs: Parameters<typeof buildAnalysisContext>[0] = {
        sessionId: args.sessionId,
        focus: args.focus,
      };
      if (args.filePath !== undefined) {
        contextArgs.filePath = args.filePath;
      }
      if (args.compareToSessionId !== undefined) {
        contextArgs.compareToSessionId = args.compareToSessionId;
      }
      if (args.compareToFilePath !== undefined) {
        contextArgs.compareToFilePath = args.compareToFilePath;
      }
      if (args.query !== undefined) {
        contextArgs.query = args.query;
      }

      // Build analysis context
      const context = await buildAnalysisContext(contextArgs);

      // Build query prompt for the subagent
      const queryPrompt = buildQueryPrompt(args.focus, context);

      // Get tools from agent
      const agentTools = agent.tools ?? [];

      // Build output context with only defined properties
      const outputContext: SpawnSessionAnalystOutput['context'] = {
        sessionId: args.sessionId,
      };
      if (args.compareToSessionId !== undefined) {
        outputContext.compareToSessionId = args.compareToSessionId;
      }
      if (args.query !== undefined) {
        outputContext.query = args.query;
      }

      const result: SpawnSessionAnalystOutput = {
        success: true,
        focus: args.focus,
        agentType: 'session-analyst',
        context: outputContext,
        agentDefinition: {
          description: agent.description,
          toolCount: agentTools.length,
          tools: agentTools,
        },
        queryPrompt,
        message:
          'Session analyst ready. Use SDK agents option to invoke with the provided prompt and context.',
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: formatToolOutput(result),
          },
        ],
        _rawData: result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error spawning session analyst: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);
