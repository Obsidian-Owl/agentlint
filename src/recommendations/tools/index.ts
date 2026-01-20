/**
 * EP10 Recommendation Tools Module
 *
 * Exports all recommendation-related SDK tools.
 *
 * @module recommendations/tools
 */

// Spawn advisor tool
export {
  spawnRecommendationAdvisorTool,
  buildAdvisorContext,
  buildQueryPrompt,
} from './spawn-advisor';

// Recommendation CRUD tools
export {
  createRecommendationTool,
  createRecommendation,
} from './create-recommendation';

export {
  getRecommendationTool,
  getRecommendation,
} from './get-recommendation';

// Event management tools
export {
  addRecommendationEventTool,
  addRecommendationEvent,
} from './add-event';

// Query tools
export {
  listRecommendationsTool,
  listRecommendations,
} from './list-recommendations';

export {
  getRecommendationSummaryTool,
  getRecommendationSummary,
} from './get-recommendation-summary';

// Refinement tools
export {
  refineRecommendationTool,
  refineRecommendation,
} from './refine-recommendation';

// Status management tools
export {
  updateRecommendationStatusTool,
  updateRecommendationStatus,
} from './update-status';

export {
  completeRecommendationTool,
  completeRecommendation,
} from './complete-recommendation';
