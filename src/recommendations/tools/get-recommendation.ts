/**
 * EP10 Recommendation Advisor - get_recommendation Tool
 *
 * SDK tool definition for retrieving full recommendation cases with all events.
 * Uses the Claude Agent SDK's tool() pattern per ADR-0005.
 *
 * @module recommendations/tools/get-recommendation
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

import { loadRecommendation as loadFromStorage } from '../storage';
import type { Recommendation } from '../types';

// =============================================================================
// Input Schema
// =============================================================================

/**
 * Input schema for get_recommendation tool.
 */
const getRecommendationInputSchema = {
  id: z.string().describe('The UUID of the recommendation to retrieve'),
};

// =============================================================================
// Types
// =============================================================================

interface StorageOptions {
  baseDir?: string;
}

interface GetRecommendationResult {
  success: boolean;
  recommendation?: Recommendation;
  error?: string;
}

// =============================================================================
// Core Function
// =============================================================================

/**
 * Retrieve a recommendation by ID.
 * @internal Exported for testing
 */
export async function getRecommendation(
  id: string,
  options: StorageOptions = {}
): Promise<GetRecommendationResult> {
  try {
    const storageOptions = options.baseDir ? { baseDir: options.baseDir } : {};
    const recommendation = await loadFromStorage(id, storageOptions);

    if (!recommendation) {
      return {
        success: false,
        error: `Recommendation with ID '${id}' not found`,
      };
    }

    return {
      success: true,
      recommendation,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to retrieve recommendation: ${errorMessage}`,
    };
  }
}

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * Format the tool output for display.
 */
function formatToolOutput(result: GetRecommendationResult): string {
  if (!result.success || !result.recommendation) {
    return `**Error**: ${result.error ?? 'Unknown error'}`;
  }

  const rec = result.recommendation;
  const lines: string[] = [];

  lines.push(`## Recommendation: ${rec.id}\n`);
  lines.push(`**Type**: ${rec.type}`);
  lines.push(`**Priority**: ${rec.priority}`);
  lines.push(`**Status**: ${rec.status}`);
  lines.push(`**Created**: ${rec.createdAt}`);

  if (rec.completedAt) {
    lines.push(`**Completed**: ${rec.completedAt}`);
    lines.push(`**Reason**: ${rec.completionReason ?? 'N/A'}`);
  }

  if (rec.supersededBy) {
    lines.push(`**Superseded By**: ${rec.supersededBy}`);
  }

  lines.push(`\n### Details\n`);
  lines.push(`**Action**: ${rec.action}`);
  lines.push(`**Target**: ${rec.target}`);
  lines.push(`**Rationale**: ${rec.rationale}`);

  lines.push(`\n### Traced Origin\n`);
  if (rec.tracedOrigin.findingId) {
    lines.push(`- Finding ID: ${rec.tracedOrigin.findingId}`);
  }
  if (rec.tracedOrigin.sessionId) {
    lines.push(`- Session ID: ${rec.tracedOrigin.sessionId}`);
  }
  if (rec.tracedOrigin.configGap) {
    lines.push(`- Config Gap: ${rec.tracedOrigin.configGap}`);
  }
  if (rec.tracedOrigin.pattern) {
    lines.push(`- Pattern: ${rec.tracedOrigin.pattern}`);
  }

  lines.push(`\n### Events (${rec.events.length})\n`);
  for (const event of rec.events) {
    let eventLine = `- **[${event.type}]** ${event.timestamp.slice(0, 10)}: ${event.content}`;

    const contextParts: string[] = [];
    if (event.baselineId) contextParts.push(`baseline: ${event.baselineId.slice(0, 8)}...`);
    if (event.sessionId) contextParts.push(`session: ${event.sessionId}`);
    if (event.commitHash) contextParts.push(`commit: ${event.commitHash.slice(0, 7)}`);

    if (contextParts.length > 0) {
      eventLine += ` (${contextParts.join(', ')})`;
    }

    lines.push(eventLine);
  }

  return lines.join('\n');
}

/**
 * get_recommendation tool definition.
 *
 * Retrieves a full recommendation case with all events and traced origin.
 *
 * @example
 * ```typescript
 * import { getRecommendationTool } from './recommendations/tools/get-recommendation';
 * import { ToolRegistry } from './orchestration/tool-registry';
 *
 * const registry = new ToolRegistry();
 * registry.register(getRecommendationTool);
 * ```
 */
export const getRecommendationTool = tool(
  'get_recommendation',
  `
Retrieve a full recommendation case by ID, including all events and traced origin.

Use this tool when you need:
- Full details of a specific recommendation
- Complete event history for a case
- Traced origin information
- Status and completion details

Returns:
- Core fields: type, action, target, rationale, priority, status
- Traced origin: findingId, sessionId, configGap, pattern
- Events: Full append-only event history
- Completion: completedAt, completionReason, supersededBy (if applicable)

Use get_recommendation_summary for a compressed view, or list_recommendations
to query multiple recommendations with filters.
  `.trim(),
  getRecommendationInputSchema,
  async (args) => {
    const result = await getRecommendation(args.id);

    return {
      content: [
        {
          type: 'text' as const,
          text: formatToolOutput(result),
        },
      ],
      isError: !result.success,
      _rawData: result,
    };
  }
);
