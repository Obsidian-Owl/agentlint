/**
 * Qualitative Review Dimensions
 *
 * Defines the 6 structured dimensions for qualitative reviews per spec.md §4.2.
 * Each dimension captures a specific aspect of AI-assisted workflow effectiveness
 * that quantitative metrics alone cannot reveal.
 *
 * Research basis:
 * - DX AI Measurement Framework
 * - LinearB AI Measurement Framework
 * - Martin Fowler: Measuring Developer Productivity via Humans
 *
 * @module temporal/qualitative/dimensions
 */

import type { ReviewDimensionName } from '../types';

/**
 * Signal type classification for each dimension.
 * Helps understand what kind of insight the dimension provides.
 */
export type SignalType = 'leading' | 'lagging' | 'qualitative' | 'causal';

/**
 * Definition of a review dimension with its prompt and metadata.
 *
 * Note: Per ADR-0019, positiveIndicators and negativeIndicators were removed.
 * Sentiment analysis is a judgment call that the agent performs based on
 * semantic understanding of responses, not keyword matching in tool code.
 */
export interface DimensionDefinition {
  /** Dimension identifier matching ReviewDimensionName */
  name: ReviewDimensionName;
  /** Human-readable display name */
  displayName: string;
  /** Question presented to the user */
  promptText: string;
  /** Follow-up probing question if response is sparse */
  probeText: string;
  /** What signal this dimension provides */
  signalType: SignalType;
  /** Brief description of what this dimension measures */
  description: string;
}

/**
 * The 6 core review dimensions for qualitative assessment.
 * Order reflects a logical flow from friction → satisfaction.
 *
 * Note: Per ADR-0019, positiveIndicators and negativeIndicators were removed.
 * The agent analyzes response sentiment through semantic understanding,
 * not keyword matching.
 */
export const REVIEW_DIMENSIONS: readonly DimensionDefinition[] = [
  {
    name: 'perceivedFriction',
    displayName: 'Perceived Friction',
    promptText:
      'Where do you experience friction in your AI-assisted development workflow? What slows you down or feels awkward?',
    probeText: 'Can you give a specific example of a recent situation where you felt friction?',
    signalType: 'leading',
    description:
      'Identifies pain points and friction in the AI-assisted workflow that may predict future issues or improvement opportunities.',
  },
  {
    name: 'trustCalibration',
    displayName: 'Trust Calibration',
    promptText:
      'How often do you verify AI suggestions before accepting them? Has your trust level changed over time?',
    probeText: 'What determines whether you trust a particular AI suggestion?',
    signalType: 'qualitative',
    description:
      'Measures the calibration of trust in AI outputs - both over-trust (blind acceptance) and under-trust (excessive verification) indicate suboptimal workflows.',
  },
  {
    name: 'taskFit',
    displayName: 'Task Fit',
    promptText:
      'What types of tasks work well with AI assistance? What types work poorly or feel forced?',
    probeText: 'What patterns have you noticed about when AI assistance is most or least helpful?',
    signalType: 'causal',
    description:
      'Identifies which task categories benefit from AI assistance and which do not, enabling causal understanding of workflow effectiveness.',
  },
  {
    name: 'configurationConfidence',
    displayName: 'Configuration Confidence',
    promptText:
      'How confident are you in your current CLAUDE.md or AI configuration? Do you feel it captures your project well?',
    probeText: 'What would make you more confident in your configuration?',
    signalType: 'leading',
    description:
      'Measures confidence in AI configuration quality - low confidence predicts suboptimal AI assistance and potential improvement opportunities.',
  },
  {
    name: 'improvementAttribution',
    displayName: 'Improvement Attribution',
    promptText:
      'What changes have made the biggest difference in your AI workflow recently? What do you attribute improvements (or regressions) to?',
    probeText: 'Can you point to a specific change that had a noticeable impact on your workflow?',
    signalType: 'causal',
    description:
      'Captures user attribution of workflow changes - enables causal tracing between actions and outcomes.',
  },
  {
    name: 'workflowSatisfaction',
    displayName: 'Workflow Satisfaction',
    promptText:
      'Overall, how satisfied are you with your AI-assisted development workflow? What would make it better?',
    probeText:
      'On a scale from very unsatisfied to very satisfied, where would you place yourself?',
    signalType: 'lagging',
    description:
      'Overall satisfaction metric - lagging indicator that reflects cumulative workflow effectiveness.',
  },
] as const;

/**
 * Map for quick lookup of dimension by name.
 */
export const DIMENSION_BY_NAME: ReadonlyMap<ReviewDimensionName, DimensionDefinition> = new Map(
  REVIEW_DIMENSIONS.map((d) => [d.name, d])
);

/**
 * Get a dimension definition by name.
 *
 * @param name - The dimension name to look up
 * @returns The dimension definition or undefined if not found
 */
export function getDimension(name: ReviewDimensionName): DimensionDefinition | undefined {
  return DIMENSION_BY_NAME.get(name);
}

/**
 * Get all dimension names in review order.
 *
 * @returns Array of dimension names
 */
export function getDimensionNames(): readonly ReviewDimensionName[] {
  return REVIEW_DIMENSIONS.map((d) => d.name);
}

/**
 * Get dimensions filtered by signal type.
 *
 * @param signalType - The signal type to filter by
 * @returns Array of dimensions matching the signal type
 */
export function getDimensionsBySignalType(signalType: SignalType): readonly DimensionDefinition[] {
  return REVIEW_DIMENSIONS.filter((d) => d.signalType === signalType);
}

/**
 * Get the prompt text for a specific dimension.
 *
 * @param name - The dimension name
 * @returns The prompt text or undefined if dimension not found
 */
export function getPromptText(name: ReviewDimensionName): string | undefined {
  return getDimension(name)?.promptText;
}

/**
 * Get the probe text for a specific dimension.
 * Used when the initial response is sparse and needs elaboration.
 *
 * @param name - The dimension name
 * @returns The probe text or undefined if dimension not found
 */
export function getProbeText(name: ReviewDimensionName): string | undefined {
  return getDimension(name)?.probeText;
}
