/**
 * EP11 Quality & Security - Outcome Storage Implementation
 *
 * SQLite-based storage for recommendation outcome tracking.
 * Uses Bun's native SQLite support for local-first persistence.
 *
 * @module persistence/outcome-storage
 */

import { Database } from 'bun:sqlite';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import type {
  RecommendationOutcome,
  IOutcomeStorage,
  OutcomeMetricsByType,
  OutcomeMetrics,
  ImplicitTrackingEvent,
  RecommendationType,
} from '../../specs/ep11-quality-security/contracts/outcome';
import {
  FULL_OUTCOMES_SCHEMA,
  INSERT_OUTCOME_SQL,
  UPDATE_OUTCOME_SQL,
  GET_OUTCOME_BY_ID_SQL,
  GET_OUTCOMES_BY_SESSION_SQL,
  GET_OUTCOMES_BY_RECOMMENDATION_SQL,
  GET_PENDING_FOLLOWUPS_SQL,
  GET_ALL_PENDING_FOLLOWUPS_SQL,
  GET_METRICS_SQL,
  GET_OVERALL_METRICS_SQL,
  type OutcomeRow,
  type MetricsRow,
} from './outcomes-schema';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert boolean | null to SQLite integer (0, 1, or null).
 */
function boolToInt(value: boolean | null): number | null {
  if (value === null) return null;
  return value ? 1 : 0;
}

/**
 * Convert SQLite integer (0, 1, or null) to boolean | null.
 */
function intToBool(value: number | null): boolean | null {
  if (value === null) return null;
  return value === 1;
}

/**
 * Convert a database row to a RecommendationOutcome.
 */
function rowToOutcome(row: OutcomeRow): RecommendationOutcome {
  return {
    id: row.id,
    sessionId: row.session_id,
    recommendationId: row.recommendation_id,
    recommendationType: row.recommendation_type,
    recommendationSummary: row.recommendation_summary,
    implemented: intToBool(row.implemented),
    implementationDate: row.implementation_date,
    helped: intToBool(row.helped),
    outcomeNotes: row.outcome_notes,
    configChangedAfter: intToBool(row.config_changed_after),
    similarIssueRecurred: intToBool(row.similar_issue_recurred),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert MetricsRow to OutcomeMetrics.
 */
function rowToMetrics(row: MetricsRow): OutcomeMetrics {
  return {
    totalRecommendations: row.total_recommendations,
    implementedCount: row.implemented_count,
    helpedCount: row.helped_count,
    implementationRate: row.implementation_rate ?? 0,
    successRate: row.success_rate ?? 0,
  };
}

/**
 * Create empty metrics for a type with no data.
 */
function emptyMetrics(): OutcomeMetrics {
  return {
    totalRecommendations: 0,
    implementedCount: 0,
    helpedCount: 0,
    implementationRate: 0,
    successRate: 0,
  };
}

// =============================================================================
// OutcomeStorage Implementation
// =============================================================================

/**
 * SQLite-based implementation of IOutcomeStorage.
 *
 * Provides persistent storage for recommendation outcomes with
 * efficient querying by session, recommendation, and type.
 */
export class OutcomeStorage implements IOutcomeStorage {
  private db: Database;

  /**
   * Create a new OutcomeStorage instance.
   *
   * @param dbPath - Path to SQLite database file. Use ':memory:' for in-memory.
   */
  constructor(dbPath: string = ':memory:') {
    // Ensure directory exists for file-based database
    if (dbPath !== ':memory:') {
      const dir = dirname(dbPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }

    this.db = new Database(dbPath);
    this.initializeSchema();
  }

  /**
   * Initialize the database schema.
   */
  private initializeSchema(): void {
    this.db.exec(FULL_OUTCOMES_SCHEMA);
  }

  /**
   * Create a new outcome record.
   */
  createOutcome(
    outcome: Omit<RecommendationOutcome, 'id' | 'createdAt' | 'updatedAt'>
  ): RecommendationOutcome {
    const id = randomUUID();
    const createdAt = new Date().toISOString();

    const stmt = this.db.prepare(INSERT_OUTCOME_SQL);
    stmt.run(
      id,
      outcome.sessionId,
      outcome.recommendationId,
      outcome.recommendationType,
      outcome.recommendationSummary,
      boolToInt(outcome.implemented),
      outcome.implementationDate,
      boolToInt(outcome.helped),
      outcome.outcomeNotes,
      boolToInt(outcome.configChangedAfter),
      boolToInt(outcome.similarIssueRecurred),
      createdAt,
      null // updatedAt
    );

    return {
      ...outcome,
      id,
      createdAt,
      updatedAt: null,
    };
  }

  /**
   * Update an existing outcome.
   */
  updateOutcome(id: string, updates: Partial<RecommendationOutcome>): RecommendationOutcome {
    const existing = this.getOutcome(id);
    if (!existing) {
      throw new Error(`Outcome not found: ${id}`);
    }

    const updatedAt = new Date().toISOString();

    const stmt = this.db.prepare(UPDATE_OUTCOME_SQL);
    stmt.run(
      updates.implemented !== undefined ? boolToInt(updates.implemented) : null,
      updates.implementationDate !== undefined ? updates.implementationDate : null,
      updates.helped !== undefined ? boolToInt(updates.helped) : null,
      updates.outcomeNotes !== undefined ? updates.outcomeNotes : null,
      updates.configChangedAfter !== undefined ? boolToInt(updates.configChangedAfter) : null,
      updates.similarIssueRecurred !== undefined ? boolToInt(updates.similarIssueRecurred) : null,
      updatedAt,
      id
    );

    // Re-fetch to get the merged result
    const updated = this.getOutcome(id);
    if (!updated) {
      throw new Error(`Failed to retrieve updated outcome: ${id}`);
    }

    return updated;
  }

  /**
   * Get outcome by ID.
   */
  getOutcome(id: string): RecommendationOutcome | null {
    const stmt = this.db.prepare(GET_OUTCOME_BY_ID_SQL);
    const row = stmt.get(id) as OutcomeRow | null;

    if (!row) return null;
    return rowToOutcome(row);
  }

  /**
   * Get outcomes for a session.
   */
  getOutcomesBySession(sessionId: string): RecommendationOutcome[] {
    const stmt = this.db.prepare(GET_OUTCOMES_BY_SESSION_SQL);
    const rows = stmt.all(sessionId) as OutcomeRow[];

    return rows.map(rowToOutcome);
  }

  /**
   * Get outcomes for a recommendation.
   */
  getOutcomesByRecommendation(recommendationId: string): RecommendationOutcome[] {
    const stmt = this.db.prepare(GET_OUTCOMES_BY_RECOMMENDATION_SQL);
    const rows = stmt.all(recommendationId) as OutcomeRow[];

    return rows.map(rowToOutcome);
  }

  /**
   * Get outcomes pending follow-up.
   *
   * Returns outcomes that are marked as implemented but have not yet
   * received helped feedback, and are older than the specified days.
   */
  getPendingFollowUps(olderThanDays: number): RecommendationOutcome[] {
    // Use special query for 0 days to return all pending regardless of age
    // This is useful for testing
    if (olderThanDays === 0) {
      const stmt = this.db.prepare(GET_ALL_PENDING_FOLLOWUPS_SQL);
      const rows = stmt.all() as OutcomeRow[];
      return rows.map(rowToOutcome);
    }

    const stmt = this.db.prepare(GET_PENDING_FOLLOWUPS_SQL);
    const rows = stmt.all(olderThanDays) as OutcomeRow[];

    return rows.map(rowToOutcome);
  }

  /**
   * Get aggregated metrics by recommendation type.
   */
  getMetrics(): OutcomeMetricsByType {
    // Get metrics by type
    const byTypeStmt = this.db.prepare(GET_METRICS_SQL);
    const byTypeRows = byTypeStmt.all() as MetricsRow[];

    // Get overall metrics
    const overallStmt = this.db.prepare(GET_OVERALL_METRICS_SQL);
    const overallRow = overallStmt.get() as MetricsRow;

    // Build result with defaults for missing types
    const result: OutcomeMetricsByType = {
      symptomatic: emptyMetrics(),
      preventive: emptyMetrics(),
      systemic: emptyMetrics(),
      all: rowToMetrics(overallRow),
    };

    // Populate from query results
    for (const row of byTypeRows) {
      const type = row.recommendation_type as RecommendationType;
      result[type] = rowToMetrics(row);
    }

    return result;
  }

  /**
   * Record an implicit tracking event.
   *
   * Updates all outcomes for the given recommendation based on the event type.
   */
  recordImplicitEvent(event: ImplicitTrackingEvent): void {
    const outcomes = this.getOutcomesByRecommendation(event.recommendationId);

    for (const outcome of outcomes) {
      if (event.type === 'config_changed') {
        this.updateOutcome(outcome.id, { configChangedAfter: true });
      } else if (event.type === 'issue_recurred') {
        this.updateOutcome(outcome.id, { similarIssueRecurred: true });
      }
    }
  }

  /**
   * Close the database connection.
   */
  close(): void {
    this.db.close();
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new OutcomeStorage instance.
 *
 * @param dbPath - Path to SQLite database file. Defaults to in-memory.
 * @returns An IOutcomeStorage implementation.
 *
 * @example
 * ```typescript
 * // In-memory storage for testing
 * const storage = createOutcomeStorage();
 *
 * // File-based storage for production
 * const storage = createOutcomeStorage('~/.agentlint/outcomes.db');
 * ```
 */
export function createOutcomeStorage(dbPath: string = ':memory:'): IOutcomeStorage {
  return new OutcomeStorage(dbPath);
}

/**
 * Get the default database path for outcome storage.
 */
export function getDefaultOutcomeDbPath(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '.';
  return `${home}/.agentlint/outcomes.db`;
}
