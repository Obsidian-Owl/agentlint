/**
 * EP07 Causal Tracing Engine - Persistence
 *
 * Public exports for causal chain persistence layer.
 *
 * @module src/persistence/causal
 */

// Schema exports
export {
  CAUSAL_SCHEMA_VERSION,
  causalTablesExist,
  getCausalSchemaVersion,
  createCausalTables,
  dropCausalTables,
  migrateCausalSchema,
  initCausalSchema,
} from './schema.js';

// Query exports
export {
  // Chain operations
  insertChain,
  getChainById,
  getChainsByProject,
  countChainsByProject,
  deleteChain,
  // Pattern operations
  insertPattern,
  getPatternById,
  getPatternsByProject,
  addChainToPattern,
  deletePattern,
} from './queries.js';
