/**
 * EP10 Recommendation Advisor - add_recommendation_event Tool
 *
 * SDK tool definition for appending events to recommendation cases.
 * Uses the Claude Agent SDK's tool() pattern per ADR-0005.
 *
 * @module recommendations/tools/add-event
 */

import { z } from 'zod';

import { adaptTool } from '../../opencode/tool-adapter';

import { loadRecommendation as loadFromStorage, saveRecommendation } from '../storage';
import type { Recommendation, RecommendationEvent, AddEventInput } from '../types';

// =============================================================================
// Constants
// =============================================================================

/**
 * Event types that can only be created by the system.
 * Users cannot manually add these event types.
 */
const SYSTEM_GENERATED_TYPES = ['created', 'completed'] as const;

/**
 * Maximum content length per NFR-003.
 */
const MAX_CONTENT_LENGTH = 200;

// =============================================================================
// Input Schema
// =============================================================================

/**
 * Input schema for add_recommendation_event tool.
 */
const addRecommendationEventInputSchema = {
  recommendationId: z.string().describe('The UUID of the recommendation to add the event to'),

  type: z
    .enum([
      'observation',
      'refinement',
      'user_feedback',
      'evidence',
      'implementation_signal',
      'status_change',
    ])
    .describe(
      `Event type:
- observation: Agent notices related change or pattern
- refinement: Recommendation details updated
- user_feedback: Developer provides input
- evidence: Supporting data added
- implementation_signal: Signs of implementation detected
- status_change: Status transition`
    ),

  content: z
    .string()
    .max(MAX_CONTENT_LENGTH)
    .describe(`Succinct event description (max ${MAX_CONTENT_LENGTH} chars)`),

  baselineId: z.string().uuid().optional().describe('Related baseline ID'),
  sessionId: z.string().optional().describe('Related session ID'),
  commitHash: z.string().optional().describe('Related git commit hash'),
};

// =============================================================================
// Types
// =============================================================================

interface StorageOptions {
  baseDir?: string;
}

interface AddEventResult {
  success: boolean;
  recommendation?: Recommendation;
  event?: RecommendationEvent;
  error?: string;
}

// =============================================================================
// Core Function
// =============================================================================

/**
 * Add an event to an existing recommendation.
 * @internal Exported for testing
 */
export async function addRecommendationEvent(
  input: AddEventInput,
  options: StorageOptions = {}
): Promise<AddEventResult> {
  try {
    // Check for system-generated types
    if (SYSTEM_GENERATED_TYPES.includes(input.type as (typeof SYSTEM_GENERATED_TYPES)[number])) {
      return {
        success: false,
        error: `Event type '${input.type}' is system-generated only and cannot be added manually`,
      };
    }

    // Validate content length
    if (input.content.length > MAX_CONTENT_LENGTH) {
      return {
        success: false,
        error: `Event content exceeds ${MAX_CONTENT_LENGTH} character limit (${input.content.length} chars)`,
      };
    }

    // Load existing recommendation
    const storageOptions = options.baseDir ? { baseDir: options.baseDir } : {};
    const recommendation = await loadFromStorage(input.recommendationId, storageOptions);

    if (!recommendation) {
      return {
        success: false,
        error: `Recommendation with ID '${input.recommendationId}' not found`,
      };
    }

    // Create new event
    const newEvent: RecommendationEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: input.type,
      content: input.content,
    };

    // Add optional context fields
    if (input.baselineId !== undefined) {
      newEvent.baselineId = input.baselineId;
    }
    if (input.sessionId !== undefined) {
      newEvent.sessionId = input.sessionId;
    }
    if (input.commitHash !== undefined) {
      newEvent.commitHash = input.commitHash;
    }

    // Append event to recommendation
    const updatedRecommendation: Recommendation = {
      ...recommendation,
      events: [...recommendation.events, newEvent],
    };

    // Save updated recommendation
    await saveRecommendation(updatedRecommendation, storageOptions);

    return {
      success: true,
      recommendation: updatedRecommendation,
      event: newEvent,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to add event: ${errorMessage}`,
    };
  }
}

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * Format the tool output for display.
 */
function formatToolOutput(result: AddEventResult): string {
  if (!result.success || !result.event) {
    return `**Error**: ${result.error ?? 'Unknown error'}`;
  }

  const event = result.event;
  const lines: string[] = [];

  lines.push(`## Event Added\n`);
  lines.push(`**Event ID**: ${event.id}`);
  lines.push(`**Type**: ${event.type}`);
  lines.push(`**Timestamp**: ${event.timestamp}`);
  lines.push(`**Content**: ${event.content}`);

  if (event.baselineId || event.sessionId || event.commitHash) {
    lines.push(`\n### Context`);
    if (event.baselineId) lines.push(`- Baseline ID: ${event.baselineId}`);
    if (event.sessionId) lines.push(`- Session ID: ${event.sessionId}`);
    if (event.commitHash) lines.push(`- Commit Hash: ${event.commitHash}`);
  }

  lines.push(`\n---`);
  lines.push(`Event appended to recommendation ${result.recommendation?.id}`);
  lines.push(`Total events: ${result.recommendation?.events.length}`);

  return lines.join('\n');
}

/**
 * add_recommendation_event tool definition.
 *
 * Appends an event to a recommendation's event log.
 *
 * @example
 * ```typescript
 * import { addRecommendationEventTool } from './recommendations/tools/add-event';
 * import { ToolRegistry } from './orchestration/tool-registry';
 *
 * const registry = new ToolRegistry();
 * registry.register(addRecommendationEventTool);
 * ```
 */
export const addRecommendationEventTool = adaptTool({
  name: 'add_recommendation_event',
  description: `
Append an event to a recommendation's event log.

Use this tool to record:
- Observations: Related changes or patterns noticed
- Refinements: Updates to recommendation details
- User feedback: Developer input or comments
- Evidence: Supporting data (link to baseline, session, commit)
- Implementation signals: Signs that recommendation is being implemented
- Status changes: Transitions in recommendation lifecycle

Constraints:
- Content must be ≤ ${MAX_CONTENT_LENGTH} characters (be succinct)
- 'created' and 'completed' events are system-generated only
- Events are append-only (cannot be modified or deleted)

Optional context fields help link events to other agentlint data:
- baselineId: Related baseline for evidence/comparison
- sessionId: Session where observation was made
- commitHash: Git commit related to the event
  `.trim(),
  schema: addRecommendationEventInputSchema,
  handler: async (args: unknown) => {
    const typedArgs = args as {
      recommendationId: string;
      type: string;
      content: string;
      baselineId?: string;
      sessionId?: string;
      commitHash?: string;
    };

    const input: AddEventInput = {
      recommendationId: typedArgs.recommendationId,
      type: typedArgs.type as AddEventInput['type'],
      content: typedArgs.content,
    };

    // Add optional fields only if defined
    if (typedArgs.baselineId !== undefined) {
      input.baselineId = typedArgs.baselineId;
    }
    if (typedArgs.sessionId !== undefined) {
      input.sessionId = typedArgs.sessionId;
    }
    if (typedArgs.commitHash !== undefined) {
      input.commitHash = typedArgs.commitHash;
    }

    const result = await addRecommendationEvent(input);

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
  },
});
