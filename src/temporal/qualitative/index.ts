/**
 * EP09 Temporal Analysis - Qualitative Analysis Module
 *
 * Exports qualitative review analysis functions including:
 * - Sentiment calculation (from dimensions)
 * - Sentiment trends (statistical measures)
 * - Review dimensions
 *
 * @module temporal/qualitative
 */

// Dimensions
export {
  REVIEW_DIMENSIONS,
  DIMENSION_BY_NAME,
  getDimension,
  getDimensionNames,
  getDimensionsBySignalType,
  getPromptText,
  getProbeText,
  type DimensionDefinition,
  type SignalType,
} from './dimensions';

// Sentiment calculation
export {
  calculateOverallSentiment,
  isValidSentiment,
  clampSentiment,
  calculateSentimentTrend as calculateSentimentTrendFromReviews,
  compareSentiment,
  createEmptyDimension,
  aggregateSentimentStats,
  type SentimentValue,
  type SentimentOptions,
} from './sentiment';

// Trend analysis
export {
  calculateSentimentTrend,
  calculateAllDimensionTrends,
  calculateOverallTrend,
  summarizeTrends,
  type TrendCalculationOptions,
  type ExtendedQualitativeTrend,
} from './trend';
