/**
 * EP09 Temporal Analysis - Recommendation Tracking
 *
 * This module provides recommendation implementation detection and tracking.
 *
 * @module temporal/tracking
 */

export {
  detectImplementation,
  detectImplementations,
  createConfigDiff,
  mergeConfigDiffs,
  type Recommendation,
  type ConfigDiff,
  type DetectionResult,
  type DetectionEvidence,
} from './detector';
