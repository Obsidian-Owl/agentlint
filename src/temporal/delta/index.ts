/**
 * EP09 Temporal Analysis - Delta Module
 *
 * Exports delta calculation and summarization utilities.
 *
 * @module temporal/delta
 */

export {
  getDiffPatcher,
  calculateDelta,
  calculateMetricsDelta,
  applyDelta,
  reverseDelta,
} from './calculator';

export type { DeltaCalculatorOptions, RawDelta, MetricsDelta } from './calculator';
