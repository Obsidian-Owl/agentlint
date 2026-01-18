/**
 * EP09 Temporal Analysis - Utilities Module
 *
 * Exports utility functions for temporal analysis.
 *
 * @module temporal/utils
 */

export {
  getCurrentCommit,
  getCommitInfo,
  isGitRepository,
  getRepositoryRoot,
  getCurrentBranch,
  getCommitsBetweenDates,
  getCommitsBetweenHashes,
  getCommitDetailsBetweenHashes,
} from './git';

export type { GitCommitInfo, GitOptions } from './git';
