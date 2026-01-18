/**
 * EP09 Temporal Analysis - Recommendation Tracking
 *
 * This module provides recommendation implementation evidence extraction and tracking.
 * Per ADR-0019, returns raw evidence for agent interpretation.
 *
 * @module temporal/tracking
 */

export {
  extractMatchEvidence,
  extractAllMatchEvidence,
  createConfigDiff,
  mergeConfigDiffs,
  type Recommendation,
  type ConfigDiff,
} from './detector';

export {
  getEffectivenessData,
  getEffectivenessStats,
  type EffectivenessData,
  type EffectivenessOptions,
} from './effectiveness';

// Re-export evidence types from types.ts
export type { DetectionEvidence, MatchEvidence } from '../types';
