/**
 * EP10 Recommendation Advisor - spawn_recommendation_advisor Tool
 *
 * SDK tool definition for spawning the recommendation advisor subagent.
 * Uses the Claude Agent SDK's tool() pattern per ADR-0005.
 *
 * This tool enables the orchestrator to delegate recommendation synthesis
 * tasks to a specialized subagent with domain-specific context.
 *
 * @module recommendations/tools/spawn-advisor
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

import { buildRecommendationAdvisorAgent } from '../subagent/recommendation-advisor';
import type { RecommendationAdvisorContext } from '../subagent/types';

// =============================================================================
// Input Schema
// =============================================================================

/**
 * Interaction modes for the recommendation advisor.
 */
const InteractionModeSchema = z.enum(['ask', 'propose', 'confirm']);

/**
 * Input schema for spawn_recommendation_advisor tool.
 */
const spawnRecommendationAdvisorInputSchema = {
  findings: z
    .array(z.unknown())
    .describe('Analysis findings from EP05/EP06/EP07 to base recommendations on'),

  causalTraces: z
    .array(z.unknown())
    .optional()
    .describe('Causal traces from EP07 linking findings to root causes'),

  includeHistoricRecs: z
    .boolean()
    .optional()
    .default(true)
    .describe('Include historic recommendations for context awareness'),

  interactionMode: InteractionModeSchema.optional()
    .default('propose')
    .describe(
      `
Interaction mode:
- ask: Prioritize asking clarifying questions before generating recommendations
- propose: Generate recommendations, ask only when truly ambiguous
- confirm: Generate recommendations without asking questions
    `.trim()
    ),

  focus: z
    .enum(['config', 'workflow', 'prevention', 'comprehensive'])
    .optional()
    .describe('Analysis focus area (defaults to comprehensive)'),

  projectPath: z.string().optional().describe('Project path for context'),
};

// =============================================================================
// Types
// =============================================================================

type InteractionMode = z.infer<typeof InteractionModeSchema>;

/**
 * Result from spawn_recommendation_advisor tool.
 */
interface SpawnRecommendationAdvisorResult {
  success: boolean;
  interactionMode: InteractionMode;
  context: RecommendationAdvisorContext;
  agentDefinition: {
    description: string;
    toolCount: number;
    tools: string[];
  };
  queryPrompt: string;
  message: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Build the advisor context for the subagent.
 * @internal Exported for testing
 */
export function buildAdvisorContext(args: {
  findings: unknown[];
  causalTraces?: unknown[];
  includeHistoricRecs?: boolean;
  interactionMode?: InteractionMode;
  focus?: 'config' | 'workflow' | 'prevention' | 'comprehensive';
  projectPath?: string;
}): RecommendationAdvisorContext {
  // Build context with required fields
  const context: RecommendationAdvisorContext = {
    findingCount: args.findings.length,
    causalTraceCount: args.causalTraces?.length ?? 0,
    historicRecCount: 0, // Will be populated by subagent via list_recommendations
    interactionMode: args.interactionMode ?? 'propose',
  };

  // Add optional fields only if defined
  if (args.focus !== undefined) {
    context.focus = args.focus;
  }
  if (args.projectPath !== undefined) {
    context.projectPath = args.projectPath;
  }

  return context;
}

/**
 * Build the query prompt for the subagent based on context.
 * @internal Exported for testing
 */
export function buildQueryPrompt(context: RecommendationAdvisorContext): string {
  const parts: string[] = [];

  // Opening context
  parts.push('Analyze the provided findings and synthesize actionable recommendations.');
  parts.push('');

  // Finding count
  parts.push(`**Findings to analyze**: ${context.findingCount}`);

  // Causal traces
  if (context.causalTraceCount > 0) {
    parts.push(`**Causal traces available**: ${context.causalTraceCount}`);
    parts.push('Use causal traces to identify root causes and generate preventive recommendations.');
  }

  // Historic recommendations
  if (context.historicRecCount > 0) {
    parts.push(`**Historic recommendations**: ${context.historicRecCount}`);
    parts.push('Check for duplicates or related recommendations before creating new ones.');
  }

  parts.push('');

  // Interaction mode guidance
  switch (context.interactionMode) {
    case 'ask':
      parts.push('**Mode**: Ask first');
      parts.push(
        'Prioritize asking clarifying questions when multiple valid approaches exist.'
      );
      parts.push('Return questions before generating recommendations if context is ambiguous.');
      break;

    case 'propose':
      parts.push('**Mode**: Propose');
      parts.push('Generate recommendations, only ask questions when truly ambiguous.');
      parts.push('Use your judgment for most decisions, but clarify major tradeoffs.');
      break;

    case 'confirm':
      parts.push('**Mode**: Confirm');
      parts.push('Generate recommendations without asking questions.');
      parts.push('Document any assumptions made in the output.');
      break;
  }

  parts.push('');

  // Focus area guidance
  if (context.focus) {
    switch (context.focus) {
      case 'config':
        parts.push('**Focus**: Configuration improvements');
        parts.push('Prioritize recommendations for CLAUDE.md and project configuration.');
        break;

      case 'workflow':
        parts.push('**Focus**: Workflow optimization');
        parts.push('Prioritize recommendations for development workflow and process.');
        break;

      case 'prevention':
        parts.push('**Focus**: Prevention');
        parts.push('Prioritize preventive recommendations that avoid future issues.');
        break;

      case 'comprehensive':
        parts.push('**Focus**: Comprehensive analysis');
        parts.push('Consider all aspects: configuration, workflow, and prevention.');
        break;
    }
  }

  parts.push('');

  // Recommendation type guidance
  parts.push('## Recommendation Types');
  parts.push('- **symptomatic**: Quick fix for immediate symptoms');
  parts.push('- **preventive**: Prevents recurrence (preferred when causal trace available)');
  parts.push('- **systemic**: Addresses underlying structural issues');
  parts.push('');
  parts.push('Default to **preventive** when a clear cause is identified.');

  return parts.join('\n');
}

/**
 * Format the tool output for display.
 */
function formatToolOutput(result: SpawnRecommendationAdvisorResult): string {
  const lines: string[] = [];

  lines.push(`## Recommendation Advisor Spawned\n`);
  lines.push(`**Interaction Mode**: ${result.interactionMode}`);
  lines.push(`**Findings to Analyze**: ${result.context.findingCount}`);
  lines.push(`**Causal Traces**: ${result.context.causalTraceCount}`);
  lines.push(`**Tools Available**: ${result.agentDefinition.toolCount}`);

  lines.push(`\n### Analysis Context\n`);

  if (result.context.focus) {
    lines.push(`**Focus**: ${result.context.focus}`);
  }

  if (result.context.projectPath) {
    lines.push(`**Project Path**: ${result.context.projectPath}`);
  }

  lines.push(`\n### Subagent Prompt\n`);
  lines.push('```');
  lines.push(result.queryPrompt);
  lines.push('```');

  lines.push(`\n### Available Tools\n`);
  for (const tool of result.agentDefinition.tools) {
    lines.push(`- ${tool}`);
  }

  lines.push(`\n---`);
  lines.push(result.message);

  return lines.join('\n');
}

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * spawn_recommendation_advisor tool definition.
 *
 * Spawns the recommendation advisor subagent with configurable context.
 * Returns the agent definition and context for orchestrator delegation.
 *
 * Per Constitution Principle C8 (single subagent depth), this tool
 * does NOT execute the subagent directly. Instead, it returns the
 * agent definition for the orchestrator to invoke via SDK.
 *
 * @example
 * ```typescript
 * import { spawnRecommendationAdvisorTool } from './recommendations/tools/spawn-advisor';
 * import { ToolRegistry } from './orchestration/tool-registry';
 *
 * const registry = new ToolRegistry();
 * registry.register(spawnRecommendationAdvisorTool);
 * ```
 */
export const spawnRecommendationAdvisorTool = tool(
  'spawn_recommendation_advisor',
  `
Spawn a recommendation advisor subagent to synthesize actionable recommendations from findings.

Use this tool when you need to:
- Synthesize recommendations from analysis findings (EP05/EP06/EP07)
- Generate prioritized, causal-traced recommendations
- Determine appropriate recommendation types (symptomatic/preventive/systemic)
- Collaborate with the developer via clarifying questions

The subagent has deep domain knowledge about:
- Recommendation prioritization by compounding impact
- Causal analysis and root cause identification
- Configuration improvement strategies
- Workflow optimization patterns

Interaction modes:
- ask: Prioritize clarifying questions before generating recommendations
- propose: Generate recommendations, ask only when truly ambiguous (default)
- confirm: Generate recommendations without asking questions

Returns the subagent definition and context for orchestrator delegation.
The orchestrator should invoke the subagent using the SDK agents option.
  `.trim(),
  spawnRecommendationAdvisorInputSchema,
  async (args) => {
    try {
      // Build the agent
      const agent = buildRecommendationAdvisorAgent();

      // Build advisor context
      const contextArgs: Parameters<typeof buildAdvisorContext>[0] = {
        findings: args.findings,
        interactionMode: args.interactionMode,
      };
      if (args.causalTraces !== undefined) {
        contextArgs.causalTraces = args.causalTraces;
      }
      if (args.includeHistoricRecs !== undefined) {
        contextArgs.includeHistoricRecs = args.includeHistoricRecs;
      }
      if (args.focus !== undefined) {
        contextArgs.focus = args.focus;
      }
      if (args.projectPath !== undefined) {
        contextArgs.projectPath = args.projectPath;
      }
      const context = buildAdvisorContext(contextArgs);

      // Build query prompt for the subagent
      const queryPrompt = buildQueryPrompt(context);

      // Get tools from agent
      const agentTools = agent.tools ?? [];

      const result: SpawnRecommendationAdvisorResult = {
        success: true,
        interactionMode: args.interactionMode,
        context,
        agentDefinition: {
          description: agent.description,
          toolCount: agentTools.length,
          tools: agentTools,
        },
        queryPrompt,
        message:
          'Recommendation advisor ready. Use SDK agents option to invoke with the provided prompt and context.',
      };

      // Simulate async operation for SDK compatibility
      await Promise.resolve();

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
            text: `Error spawning recommendation advisor: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);
