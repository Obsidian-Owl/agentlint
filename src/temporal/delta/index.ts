/**
 * EP09 Temporal Analysis - Delta Module
 *
 * Exports delta calculation and summarization utilities.
 *
 * @module temporal/delta
 */

// Calculator
export {
  getDiffPatcher,
  calculateDelta,
  calculateMetricsDelta,
  applyDelta,
  reverseDelta,
} from './calculator';

export type { DeltaCalculatorOptions, RawDelta, MetricsDelta } from './calculator';

// Summarizer
export { createDeltaSummary, formatDeltaSummary } from './summarizer';

export type { SummarizerOptions } from './summarizer';
