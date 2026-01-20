/**
 * EP10 Recommendation Subagent Module
 *
 * Exports the Recommendation Advisor subagent and builder functions.
 *
 * @module recommendations/subagent
 */

// Subagent exports
export {
  recommendationAdvisorInstructions,
  buildRecommendationAdvisorAgent,
  buildRecommendationSubagents,
} from './recommendation-advisor';

// Type exports
export {
  RECOMMENDATION_ADVISOR_TOOLS,
  toAgentDefinition,
  type RecommendationSubagentInstructions,
  type RecommendationAdvisorContext,
} from './types';

// Question handling exports
export {
  createClarifyingQuestion,
  validateClarifyingQuestion,
  formatClarifyingQuestion,
  formatAdvisorOutput,
  parseClarifyingQuestions,
  parseAssumptions,
} from './questions';
