/**
 * Temporal Subagent Module
 *
 * Exports temporal analyzer subagent definitions for SDK registration.
 * Follows EP08 ACT subagent pattern.
 *
 * @module temporal/subagent
 */

// Types
export {
  TEMPORAL_SUBAGENT_TOOLS,
  TEMPORAL_READONLY_TOOLS,
  TemporalSubagentInstructionsSchema,
  toAgentDefinition,
  type AnalysisFocus,
  type TemporalSubagentInstructions,
  type TemporalAnalysisContext,
  type TemporalAnalysisResult,
} from './types';

// Subagent implementations
export {
  temporalAnalyzerInstructions,
  temporalAnalyzerReadonlyInstructions,
  buildTemporalAnalyzerAgent,
  buildTemporalAnalyzerReadonlyAgent,
  buildTemporalSubagents,
} from './temporal-subagent';
