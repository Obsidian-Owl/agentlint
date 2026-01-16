/**
 * EP03 Persistence Layer - Learnings Module
 *
 * Public exports for learning storage and indexing operations.
 *
 * @module persistence/learnings
 */

// Storage exports
export {
  saveLearning,
  loadLearning,
  listLearnings,
  deleteLearning,
  getLearningsDir,
  LEARNING_VERSION,
} from './storage';

// Indexer exports
export {
  initLearningsIndex,
  indexLearning,
  queryLearnings,
  getLearningById,
  removeLearningFromIndex,
  listAllLearnings,
  closeLearningsIndex,
} from './indexer';
