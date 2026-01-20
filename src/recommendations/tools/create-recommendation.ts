/**
 * EP10 Recommendation Advisor - create_recommendation Tool
 *
 * SDK tool definition for creating new recommendation cases with traced origins.
 * Uses the Claude Agent SDK's tool() pattern per ADR-0005.
 *
 * @module recommendations/tools/create-recommendation
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

import { saveRecommendation } from '../storage';
import { CreateRecommendationInputSchema } from '../schemas';
import type { Recommendation, RecommendationEvent, CreateRecommendationInput } from '../types';

// =============================================================================
// Input Schema
// =============================================================================

/**
 * Input schema for create_recommendation tool.
 */
const createRecommendationInputSchema = {
  type: z
    .enum(['symptomatic', 'preventive', 'systemic'])
    .describe(
      'Type based on causal depth: symptomatic (quick fix), preventive (prevents recurrence), systemic (structural change)'
    ),

  action: z
    .string()
    .min(1)
    .max(1000)
    .describe('SPECIFIC change to make (e.g., "Add error handling section to CLAUDE.md")'),

  target: z
    .string()
    .min(1)
    .max(500)
    .describe('WHERE to make the change (e.g., "CLAUDE.md", "src/config/settings.ts")'),

  rationale: z
    .string()
    .min(1)
    .max(2000)
    .describe('WHY this will help - your reasoning for this recommendation'),

  priority: z
    .enum(['high', 'medium', 'low'])
    .describe(
      'Priority based on compounding impact: high (blocks work/frequent), medium (improves efficiency), low (nice-to-have)'
    ),

  tracedOrigin: z
    .object({
      findingId: z.string().uuid().optional().describe('Finding ID from EP05/EP06/EP07'),
      sessionId: z.string().optional().describe('Session where issue was observed'),
      configGap: z.string().max(500).optional().describe('Description of configuration gap'),
      pattern: z.string().max(500).optional().describe('Recurring pattern identified'),
    })
    .describe('Causal link to source - at least one field required'),

  projectPath: z
    .string()
    .optional()
    .describe('Project path (defaults to current working directory)'),
};

// =============================================================================
// Types
// =============================================================================

interface StorageOptions {
  baseDir?: string;
}

interface CreateRecommendationResult {
  success: boolean;
  recommendation?: Recommendation;
  error?: string;
}

// =============================================================================
// Core Function
// =============================================================================

/**
 * Create a new recommendation case with traced origin.
 * @internal Exported for testing
 */
export async function createRecommendation(
  input: CreateRecommendationInput,
  options: StorageOptions = {}
): Promise<CreateRecommendationResult> {
  try {
    // Validate input using schema
    const validationResult = CreateRecommendationInputSchema.safeParse(input);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
      return {
        success: false,
        error: `Validation failed: ${errors.join(', ')}`,
      };
    }

    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    // Create initial 'created' event
    const createdEvent: RecommendationEvent = {
      id: crypto.randomUUID(),
      timestamp: now,
      type: 'created',
      content: `Recommendation created: ${input.action.slice(0, 150)}${input.action.length > 150 ? '...' : ''}`,
    };

    // Build the recommendation
    const recommendation: Recommendation = {
      id,
      projectPath: process.cwd(),
      createdAt: now,
      type: input.type,
      action: input.action,
      target: input.target,
      rationale: input.rationale,
      priority: input.priority,
      tracedOrigin: input.tracedOrigin,
      status: 'open',
      events: [createdEvent],
    };

    // Save to storage
    const storageOptions = options.baseDir ? { baseDir: options.baseDir } : {};
    await saveRecommendation(recommendation, storageOptions);

    return {
      success: true,
      recommendation,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to create recommendation: ${errorMessage}`,
    };
  }
}

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * Format the tool output for display.
 */
function formatToolOutput(result: CreateRecommendationResult): string {
  if (!result.success || !result.recommendation) {
    return `**Error**: ${result.error ?? 'Unknown error'}`;
  }

  const rec = result.recommendation;
  const lines: string[] = [];

  lines.push(`## Recommendation Created\n`);
  lines.push(`**ID**: ${rec.id}`);
  lines.push(`**Type**: ${rec.type}`);
  lines.push(`**Priority**: ${rec.priority}`);
  lines.push(`**Status**: ${rec.status}`);
  lines.push(`**Created**: ${rec.createdAt}`);

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

  lines.push(`\n---`);
  lines.push(`Recommendation saved. Use \`get_recommendation\` to retrieve full details.`);

  return lines.join('\n');
}

/**
 * create_recommendation tool definition.
 *
 * Creates a new recommendation case with traced origin and initial 'created' event.
 *
 * @example
 * ```typescript
 * import { createRecommendationTool } from './recommendations/tools/create-recommendation';
 * import { ToolRegistry } from './orchestration/tool-registry';
 *
 * const registry = new ToolRegistry();
 * registry.register(createRecommendationTool);
 * ```
 */
export const createRecommendationTool = tool(
  'create_recommendation',
  `
Create a new recommendation case with a traced origin linking it to its source.

Use this tool when you have:
- Analyzed findings and identified an actionable recommendation
- A clear traced origin (finding, session, config gap, or pattern)
- Specific action, target, and rationale

The recommendation will be:
- Assigned a unique UUID
- Given initial status 'open'
- Created with an initial 'created' event
- Persisted to .agentlint/recommendations/

Requirements:
- action: SPECIFIC change to make (not vague)
- target: WHERE to make the change
- rationale: WHY this will help
- tracedOrigin: At least one field (findingId, sessionId, configGap, or pattern)

Priority guide:
- high: Blocks work, frequent issue, compounding impact
- medium: Improves efficiency, prevents future issues
- low: Nice-to-have, minimal impact

Type guide:
- symptomatic: Quick fix for immediate symptoms
- preventive: Prevents recurrence (preferred with causal trace)
- systemic: Structural change for deep-rooted issues
  `.trim(),
  createRecommendationInputSchema,
  async (args) => {
    // Build tracedOrigin without undefined values (exactOptionalPropertyTypes compatibility)
    const tracedOrigin: CreateRecommendationInput['tracedOrigin'] = {};
    if (args.tracedOrigin.findingId !== undefined) {
      tracedOrigin.findingId = args.tracedOrigin.findingId;
    }
    if (args.tracedOrigin.sessionId !== undefined) {
      tracedOrigin.sessionId = args.tracedOrigin.sessionId;
    }
    if (args.tracedOrigin.configGap !== undefined) {
      tracedOrigin.configGap = args.tracedOrigin.configGap;
    }
    if (args.tracedOrigin.pattern !== undefined) {
      tracedOrigin.pattern = args.tracedOrigin.pattern;
    }

    const input: CreateRecommendationInput = {
      type: args.type,
      action: args.action,
      target: args.target,
      rationale: args.rationale,
      priority: args.priority,
      tracedOrigin,
    };

    const result = await createRecommendation(input);

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
