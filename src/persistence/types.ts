/**
 * EP03 Persistence Layer - Type Definitions
 *
 * This file defines the public interfaces for the persistence layer.
 * These types are used by the storage modules and consumers (EP02, EP04, etc.)
 *
 * @module persistence/types
 */

import type { Finding, SessionState } from '../orchestration/types';

// =============================================================================
// Baseline Types
// =============================================================================

/**
 * Aggregated metrics from analysis findings.
 * Stored in SQLite for fast querying.
 *
 * Extended in EP09 with session and config metrics (optional fields).
 */
export interface BaselineMetrics {
  /** Total number of findings */
  findingsCount: number;
  /** Count of critical severity findings */
  criticalCount: number;
  /** Count of high severity findings */
  highCount: number;
  /** Count of medium severity findings */
  mediumCount: number;
  /** Count of low severity findings */
  lowCount: number;
  /** Count of info severity findings */
  infoCount: number;

  // --- EP09 Extended Metrics (optional for backward compatibility) ---

  /** Average tokens per session (from EP06) */
  avgTokensPerSession?: number;
  /** Average iterations per session (from EP06) */
  avgIterationsPerSession?: number;
  /** Number of sessions analyzed */
  sessionCount?: number;
  /** Error rate across sessions (0-1) */
  errorRate?: number;
  /** Token count in ACT config */
  configTokens?: number;
  /** Line count in ACT config */
  configLines?: number;
  /** Config analysis warnings */
  warningCount?: number;
  /** Distinct sections in config */
  sectionCount?: number;
  /** Config coverage score (0-100) */
  coverageScore?: number;
}

/**
 * A point-in-time snapshot of analysis results.
 * Enables temporal comparison and trend analysis.
 */
export interface Baseline {
  /** UUID v4 identifier */
  id: string;
  /** Schema version (e.g., "1.0.0") */
  version: string;
  /** ISO-8601 creation timestamp */
  createdAt: string;
  /** Absolute path to project root */
  projectPath: string;
  /** ACT adapter type (e.g., "claude-code") */
  actType: string;
  /** Path to analyzed configuration file */
  configPath: string | null;
  /** Git HEAD commit hash at baseline time */
  gitCommit: string | null;
  /** Aggregated finding counts */
  metrics: BaselineMetrics;
  /** Full findings snapshot */
  findings: Finding[];
  /** User-assigned label (e.g., "before-refactor") */
  label: string | null;
  /** User notes about this baseline */
  notes: string | null;
}

/**
 * File format for persisted baselines.
 */
export interface BaselineFile {
  /** File format version */
  version: string;
  /** The baseline data */
  baseline: Baseline;
}

/**
 * Query options for listing baselines.
 */
export interface BaselineQueryOptions {
  /** Filter by label */
  label?: string;
  /** Filter by date range start (ISO-8601) */
  after?: string;
  /** Filter by date range end (ISO-8601) */
  before?: string;
  /** Filter by git commit */
  gitCommit?: string;
  /** Maximum results to return */
  limit?: number;
  /** Order by field */
  orderBy?: 'createdAt' | 'findingsCount';
  /** Sort direction */
  order?: 'asc' | 'desc';
}

/**
 * Summary returned from baseline queries (without full findings).
 */
export interface BaselineSummary {
  id: string;
  createdAt: string;
  projectPath: string;
  actType: string;
  gitCommit: string | null;
  metrics: BaselineMetrics;
  label: string | null;
}

// =============================================================================
// Learning Types
// =============================================================================

/**
 * Categories for classifying learnings.
 */
export type LearningCategory = 'patterns' | 'anti-patterns' | 'tools' | 'workflows';

/**
 * Scope of a learning (where it applies).
 */
export type LearningScope = 'project' | 'global';

/**
 * Origin information for a learning.
 */
export interface LearningOrigin {
  /** Source project path */
  project?: string;
  /** Source session ID */
  sessionId?: string;
  /** When promoted from project to global */
  promotedAt?: string;
}

/**
 * An insight captured for future reference.
 * Stored as Markdown with YAML frontmatter.
 */
export interface Learning {
  /** UUID v4 identifier */
  id: string;
  /** Schema version */
  version: string;
  /** ISO-8601 creation timestamp */
  createdAt: string;
  /** ISO-8601 last update timestamp */
  updatedAt: string;
  /** Learning title */
  title: string;
  /** Markdown body content */
  content: string;
  /** Classification tags */
  tags: string[];
  /** Category classification */
  category: LearningCategory;
  /** Where this learning applies */
  scope: LearningScope;
  /** Where this learning came from */
  origin?: LearningOrigin;
}

/**
 * Input for creating a new learning.
 */
export interface CreateLearningInput {
  /** Learning title */
  title: string;
  /** Markdown body content */
  content: string;
  /** Classification tags */
  tags?: string[];
  /** Category classification */
  category: LearningCategory;
  /** Where this learning applies */
  scope: LearningScope;
  /** Origin metadata */
  origin?: LearningOrigin;
}

/**
 * Query options for listing learnings.
 */
export interface LearningQueryOptions {
  /** Filter by category */
  category?: LearningCategory;
  /** Filter by scope */
  scope?: LearningScope;
  /** Filter by tag (any match) */
  tag?: string;
  /** Maximum results to return */
  limit?: number;
  /** Order by field */
  orderBy?: 'createdAt' | 'updatedAt';
  /** Sort direction */
  order?: 'asc' | 'desc';
}

/**
 * Summary returned from learning queries (without full content).
 */
export interface LearningSummary {
  id: string;
  title: string;
  category: LearningCategory;
  scope: LearningScope;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// Session Storage Types
// =============================================================================

/**
 * Options for saving session state.
 */
export interface SaveStateOptions {
  /** Base directory for sessions (default: ~/.agentlint/sessions) */
  baseDir?: string;
  /** Use atomic write (default: true) */
  atomic?: boolean;
}

/**
 * Options for loading session state.
 */
export interface LoadStateOptions {
  /** Base directory for sessions */
  baseDir?: string;
}

/**
 * Result of checking for incomplete sessions.
 */
export interface IncompleteSessionInfo {
  /** Session ID */
  sessionId: string;
  /** Session state */
  state: SessionState;
  /** Path to the session file */
  filePath: string;
  /** Last checkpoint time */
  lastCheckpointAt: string | null;
}

// =============================================================================
// Storage Service Interfaces
// =============================================================================

/**
 * Baseline storage operations.
 */
export interface BaselineStorage {
  /** Save a baseline and index it */
  save(baseline: Baseline): Promise<string>;
  /** Load a baseline by ID */
  load(id: string): Promise<Baseline | null>;
  /** Query baselines (returns summaries) */
  query(options?: BaselineQueryOptions): Promise<BaselineSummary[]>;
  /** Get the latest baseline */
  getLatest(): Promise<Baseline | null>;
  /** Update baseline label or notes */
  update(id: string, updates: { label?: string; notes?: string }): Promise<boolean>;
  /** Delete a baseline */
  delete(id: string): Promise<boolean>;
}

/**
 * Learning storage operations.
 */
export interface LearningStorage {
  /** Save a new learning */
  save(input: CreateLearningInput): Promise<string>;
  /** Load a learning by ID */
  load(id: string): Promise<Learning | null>;
  /** Query learnings (returns summaries) */
  query(options?: LearningQueryOptions): Promise<LearningSummary[]>;
  /** List all learnings (project + global merged) */
  listAll(options?: LearningQueryOptions): Promise<LearningSummary[]>;
  /** Delete a learning */
  delete(id: string): Promise<boolean>;
}

/**
 * Session state storage operations.
 * Note: Extends existing EP02 save/load with additional capabilities.
 */
export interface SessionStorage {
  /** Save session state (atomic write) */
  save(state: SessionState, options?: SaveStateOptions): Promise<string>;
  /** Load session state by ID */
  load(sessionId: string, options?: LoadStateOptions): Promise<SessionState | null>;
  /** List all session IDs */
  list(baseDir?: string): Promise<string[]>;
  /** Check for incomplete sessions (crash recovery) */
  findIncomplete(baseDir?: string): Promise<IncompleteSessionInfo[]>;
  /** Delete a session */
  delete(sessionId: string, baseDir?: string): Promise<boolean>;
  /** Clean up old completed sessions */
  cleanup(retentionDays?: number, baseDir?: string): Promise<number>;
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Result of an atomic write operation.
 */
export interface AtomicWriteResult {
  /** Whether the write succeeded */
  success: boolean;
  /** Path to the written file */
  path: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Configuration for persistence layer.
 */
export interface PersistenceConfig {
  /** Project-local storage directory */
  projectDir: string;
  /** Global storage directory */
  globalDir: string;
  /** File permissions for new files */
  fileMode: number;
  /** Directory permissions for new directories */
  dirMode: number;
}

/**
 * Default configuration values.
 */
export const DEFAULT_PERSISTENCE_CONFIG: PersistenceConfig = {
  projectDir: '.agentlint',
  globalDir: '~/.agentlint',
  fileMode: 0o600,
  dirMode: 0o700,
};
