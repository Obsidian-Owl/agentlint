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

// Queries will be exported here as implemented:
// export { insertChain, getChainById, getChainsByProject } from './queries.js';
// export { insertPattern, getPatternsByProject } from './queries.js';
