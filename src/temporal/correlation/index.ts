/**
 * EP09 Temporal Analysis - Git Correlation Module
 *
 * Provides git history correlation for temporal analysis.
 * Per ADR-0019, returns raw metadata for agent interpretation.
 *
 * @module temporal/correlation
 */

export {
  getCommitMetadataBetweenDates,
  getCommitMetadataBetweenHashes,
  getCommitMetadata,
  getCommitRangeSummary,
  filterCommitsByFiles,
  type CommitMetadata,
  type CommitRangeSummary,
} from './git-history';
