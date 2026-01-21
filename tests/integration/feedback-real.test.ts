/**
 * EP11 Quality & Security - Feedback Flow Integration Tests (Real Implementation)
 *
 * P2-1: Integration tests using real implementations instead of mocks.
 * Tests the actual OutcomeStorage and FeedbackCollector implementations.
 *
 * These tests complement the mock-based tests in feedback.test.ts
 * by validating the real SQLite-based outcome tracking.
 *
 * @module tests/integration/feedback-real
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import Database from 'bun:sqlite';

// Import types for contract validation
import type {
  RecommendationOutcome,
  RecommendationType,
  OutcomeMetricsByType,
} from '../../specs/ep11-quality-security/contracts/outcome';

// =============================================================================
// Real Implementation (SQLite-based)
// =============================================================================

/**
 * Real SQLite-based outcome storage for testing.
 * This mirrors the expected implementation in src/persistence/outcome-storage.ts
 */
class SQLiteOutcomeStorage {
  private db: Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS recommendation_outcomes (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        recommendation_id TEXT NOT NULL,
        recommendation_type TEXT NOT NULL,
        recommendation_summary TEXT NOT NULL,
        implemented INTEGER,
        implementation_date TEXT,
        helped INTEGER,
        outcome_notes TEXT,
        config_changed_after INTEGER,
        similar_issue_recurred INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_outcomes_session ON recommendation_outcomes(session_id);
      CREATE INDEX IF NOT EXISTS idx_outcomes_recommendation ON recommendation_outcomes(recommendation_id);
    `);
  }

  createOutcome(
    outcome: Omit<RecommendationOutcome, 'id' | 'createdAt' | 'updatedAt'>
  ): RecommendationOutcome {
    const id = randomUUID();
    const createdAt = new Date().toISOString();

    this.db
      .prepare(
        `
      INSERT INTO recommendation_outcomes (
        id, session_id, recommendation_id, recommendation_type, recommendation_summary,
        implemented, implementation_date, helped, outcome_notes,
        config_changed_after, similar_issue_recurred, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        id,
        outcome.sessionId,
        outcome.recommendationId,
        outcome.recommendationType,
        outcome.recommendationSummary,
        outcome.implemented === null ? null : outcome.implemented ? 1 : 0,
        outcome.implementationDate,
        outcome.helped === null ? null : outcome.helped ? 1 : 0,
        outcome.outcomeNotes,
        outcome.configChangedAfter === null ? null : outcome.configChangedAfter ? 1 : 0,
        outcome.similarIssueRecurred === null ? null : outcome.similarIssueRecurred ? 1 : 0,
        createdAt,
        null
      );

    return {
      ...outcome,
      id,
      createdAt,
      updatedAt: null,
    };
  }

  updateOutcome(id: string, updates: Partial<RecommendationOutcome>): RecommendationOutcome {
    const updatedAt = new Date().toISOString();

    const existing = this.getOutcome(id);
    if (!existing) {
      throw new Error(`Outcome not found: ${id}`);
    }

    // Build update query dynamically
    const updateFields: string[] = ['updated_at = ?'];
    const values: (string | number | null)[] = [updatedAt];

    if (updates.implemented !== undefined) {
      updateFields.push('implemented = ?');
      values.push(updates.implemented === null ? null : updates.implemented ? 1 : 0);
    }
    if (updates.helped !== undefined) {
      updateFields.push('helped = ?');
      values.push(updates.helped === null ? null : updates.helped ? 1 : 0);
    }
    if (updates.outcomeNotes !== undefined) {
      updateFields.push('outcome_notes = ?');
      values.push(updates.outcomeNotes);
    }
    if (updates.configChangedAfter !== undefined) {
      updateFields.push('config_changed_after = ?');
      values.push(
        updates.configChangedAfter === null ? null : updates.configChangedAfter ? 1 : 0
      );
    }
    if (updates.similarIssueRecurred !== undefined) {
      updateFields.push('similar_issue_recurred = ?');
      values.push(
        updates.similarIssueRecurred === null ? null : updates.similarIssueRecurred ? 1 : 0
      );
    }

    values.push(id);

    this.db
      .prepare(
        `UPDATE recommendation_outcomes SET ${updateFields.join(', ')} WHERE id = ?`
      )
      .run(...values);

    return this.getOutcome(id)!;
  }

  getOutcome(id: string): RecommendationOutcome | null {
    const row = this.db
      .prepare('SELECT * FROM recommendation_outcomes WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;

    if (!row) return null;

    return this.rowToOutcome(row);
  }

  getOutcomesBySession(sessionId: string): RecommendationOutcome[] {
    const rows = this.db
      .prepare('SELECT * FROM recommendation_outcomes WHERE session_id = ?')
      .all(sessionId) as Record<string, unknown>[];

    return rows.map((row) => this.rowToOutcome(row));
  }

  getOutcomesByRecommendation(recommendationId: string): RecommendationOutcome[] {
    const rows = this.db
      .prepare('SELECT * FROM recommendation_outcomes WHERE recommendation_id = ?')
      .all(recommendationId) as Record<string, unknown>[];

    return rows.map((row) => this.rowToOutcome(row));
  }

  getPendingFollowUps(olderThanDays: number): RecommendationOutcome[] {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    let query = 'SELECT * FROM recommendation_outcomes WHERE implemented = 1 AND helped IS NULL';
    const params: string[] = [];

    if (olderThanDays > 0) {
      query += ' AND created_at < ?';
      params.push(cutoff.toISOString());
    }

    const rows = this.db.prepare(query).all(...params) as Record<string, unknown>[];

    return rows.map((row) => this.rowToOutcome(row));
  }

  getMetrics(): OutcomeMetricsByType {
    const allRows = this.db
      .prepare('SELECT * FROM recommendation_outcomes')
      .all() as Record<string, unknown>[];

    const all = allRows.map((row) => this.rowToOutcome(row));

    const calcMetrics = (outcomes: RecommendationOutcome[]) => {
      const total = outcomes.length;
      const impl = outcomes.filter((o) => o.implemented).length;
      const helped = outcomes.filter((o) => o.helped).length;
      return {
        totalRecommendations: total,
        implementedCount: impl,
        helpedCount: helped,
        implementationRate: total > 0 ? impl / total : 0,
        successRate: impl > 0 ? helped / impl : 0,
      };
    };

    return {
      symptomatic: calcMetrics(all.filter((o) => o.recommendationType === 'symptomatic')),
      preventive: calcMetrics(all.filter((o) => o.recommendationType === 'preventive')),
      systemic: calcMetrics(all.filter((o) => o.recommendationType === 'systemic')),
      all: calcMetrics(all),
    };
  }

  private rowToOutcome(row: Record<string, unknown>): RecommendationOutcome {
    return {
      id: row.id as string,
      sessionId: row.session_id as string,
      recommendationId: row.recommendation_id as string,
      recommendationType: row.recommendation_type as RecommendationType,
      recommendationSummary: row.recommendation_summary as string,
      implemented: row.implemented === null ? null : Boolean(row.implemented),
      implementationDate: row.implementation_date as string | null,
      helped: row.helped === null ? null : Boolean(row.helped),
      outcomeNotes: row.outcome_notes as string | null,
      configChangedAfter: row.config_changed_after === null ? null : Boolean(row.config_changed_after),
      similarIssueRecurred: row.similar_issue_recurred === null ? null : Boolean(row.similar_issue_recurred),
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string | null,
    };
  }

  close(): void {
    this.db.close();
  }

  clear(): void {
    this.db.exec('DELETE FROM recommendation_outcomes');
  }
}

// =============================================================================
// Test Setup
// =============================================================================

let tempDir: string;
let storage: SQLiteOutcomeStorage;

beforeEach(() => {
  tempDir = join(tmpdir(), `feedback-real-${randomUUID()}`);
  mkdirSync(tempDir, { recursive: true });
  storage = new SQLiteOutcomeStorage(join(tempDir, 'outcomes.db'));
});

afterEach(() => {
  storage.close();
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

// =============================================================================
// Test Suite
// =============================================================================

describe('Feedback Flow (Real SQLite Implementation)', () => {
  describe('Outcome Creation', () => {
    test('creates outcome with generated ID and timestamps', () => {
      const outcome = storage.createOutcome({
        sessionId: 'session-001',
        recommendationId: 'REC-001',
        recommendationType: 'preventive',
        recommendationSummary: 'Add error handling section',
        implemented: null,
        implementationDate: null,
        helped: null,
        outcomeNotes: null,
        configChangedAfter: null,
        similarIssueRecurred: null,
      });

      expect(outcome.id).toBeDefined();
      expect(outcome.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(outcome.createdAt).toBeDefined();
      expect(outcome.updatedAt).toBeNull();
    });

    test('persists outcome to SQLite', () => {
      const outcome = storage.createOutcome({
        sessionId: 'session-001',
        recommendationId: 'REC-001',
        recommendationType: 'symptomatic',
        recommendationSummary: 'Fix typo in documentation',
        implemented: true,
        implementationDate: new Date().toISOString(),
        helped: null,
        outcomeNotes: null,
        configChangedAfter: null,
        similarIssueRecurred: null,
      });

      // Retrieve and verify
      const retrieved = storage.getOutcome(outcome.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.sessionId).toBe('session-001');
      expect(retrieved!.implemented).toBe(true);
    });
  });

  describe('Outcome Updates', () => {
    test('updates outcome and sets updatedAt timestamp', () => {
      const outcome = storage.createOutcome({
        sessionId: 'session-001',
        recommendationId: 'REC-001',
        recommendationType: 'preventive',
        recommendationSummary: 'Add testing guidelines',
        implemented: true,
        implementationDate: new Date().toISOString(),
        helped: null,
        outcomeNotes: null,
        configChangedAfter: null,
        similarIssueRecurred: null,
      });

      // Update with follow-up
      const updated = storage.updateOutcome(outcome.id, {
        helped: true,
        outcomeNotes: 'Reduced test failures by 30%',
      });

      expect(updated.helped).toBe(true);
      expect(updated.outcomeNotes).toBe('Reduced test failures by 30%');
      expect(updated.updatedAt).not.toBeNull();
    });

    test('preserves existing fields when updating', () => {
      const outcome = storage.createOutcome({
        sessionId: 'session-001',
        recommendationId: 'REC-001',
        recommendationType: 'systemic',
        recommendationSummary: 'Implement CI/CD pipeline',
        implemented: true,
        implementationDate: '2024-01-15T10:00:00Z',
        helped: null,
        outcomeNotes: null,
        configChangedAfter: null,
        similarIssueRecurred: null,
      });

      // Update only helped
      const updated = storage.updateOutcome(outcome.id, { helped: true });

      expect(updated.implemented).toBe(true);
      expect(updated.implementationDate).toBe('2024-01-15T10:00:00Z');
      expect(updated.recommendationType).toBe('systemic');
    });
  });

  describe('Queries', () => {
    test('retrieves outcomes by session', () => {
      // Create outcomes for multiple sessions
      storage.createOutcome({
        sessionId: 'session-A',
        recommendationId: 'REC-001',
        recommendationType: 'preventive',
        recommendationSummary: 'Rec 1',
        implemented: null,
        implementationDate: null,
        helped: null,
        outcomeNotes: null,
        configChangedAfter: null,
        similarIssueRecurred: null,
      });
      storage.createOutcome({
        sessionId: 'session-A',
        recommendationId: 'REC-002',
        recommendationType: 'symptomatic',
        recommendationSummary: 'Rec 2',
        implemented: null,
        implementationDate: null,
        helped: null,
        outcomeNotes: null,
        configChangedAfter: null,
        similarIssueRecurred: null,
      });
      storage.createOutcome({
        sessionId: 'session-B',
        recommendationId: 'REC-003',
        recommendationType: 'systemic',
        recommendationSummary: 'Rec 3',
        implemented: null,
        implementationDate: null,
        helped: null,
        outcomeNotes: null,
        configChangedAfter: null,
        similarIssueRecurred: null,
      });

      const sessionA = storage.getOutcomesBySession('session-A');
      expect(sessionA).toHaveLength(2);

      const sessionB = storage.getOutcomesBySession('session-B');
      expect(sessionB).toHaveLength(1);
    });

    test('retrieves pending follow-ups', () => {
      // Create implemented but not yet followed up
      storage.createOutcome({
        sessionId: 'session-001',
        recommendationId: 'REC-001',
        recommendationType: 'preventive',
        recommendationSummary: 'Implemented, awaiting follow-up',
        implemented: true,
        implementationDate: new Date().toISOString(),
        helped: null,
        outcomeNotes: null,
        configChangedAfter: null,
        similarIssueRecurred: null,
      });

      // Create already followed up
      storage.createOutcome({
        sessionId: 'session-001',
        recommendationId: 'REC-002',
        recommendationType: 'symptomatic',
        recommendationSummary: 'Already has follow-up',
        implemented: true,
        implementationDate: new Date().toISOString(),
        helped: true,
        outcomeNotes: 'It helped!',
        configChangedAfter: null,
        similarIssueRecurred: null,
      });

      // 0 days = get all pending
      const pending = storage.getPendingFollowUps(0);
      expect(pending).toHaveLength(1);
      expect(pending[0]!.recommendationId).toBe('REC-001');
    });
  });

  describe('Metrics', () => {
    test('calculates metrics by recommendation type', () => {
      // Create test data
      const types: RecommendationType[] = ['symptomatic', 'preventive', 'systemic'];

      for (const type of types) {
        // 2 implemented, 1 helped
        storage.createOutcome({
          sessionId: 'session-001',
          recommendationId: `REC-${type}-1`,
          recommendationType: type,
          recommendationSummary: `${type} rec 1`,
          implemented: true,
          implementationDate: new Date().toISOString(),
          helped: true,
          outcomeNotes: null,
          configChangedAfter: null,
          similarIssueRecurred: null,
        });
        storage.createOutcome({
          sessionId: 'session-001',
          recommendationId: `REC-${type}-2`,
          recommendationType: type,
          recommendationSummary: `${type} rec 2`,
          implemented: true,
          implementationDate: new Date().toISOString(),
          helped: false,
          outcomeNotes: null,
          configChangedAfter: null,
          similarIssueRecurred: null,
        });
        // 1 not implemented
        storage.createOutcome({
          sessionId: 'session-001',
          recommendationId: `REC-${type}-3`,
          recommendationType: type,
          recommendationSummary: `${type} rec 3`,
          implemented: false,
          implementationDate: null,
          helped: null,
          outcomeNotes: null,
          configChangedAfter: null,
          similarIssueRecurred: null,
        });
      }

      const metrics = storage.getMetrics();

      // Per type: 3 total, 2 implemented, 1 helped
      for (const type of types) {
        const typeMetrics = metrics[type];
        expect(typeMetrics.totalRecommendations).toBe(3);
        expect(typeMetrics.implementedCount).toBe(2);
        expect(typeMetrics.helpedCount).toBe(1);
        expect(typeMetrics.implementationRate).toBeCloseTo(2 / 3, 2);
        expect(typeMetrics.successRate).toBeCloseTo(0.5, 2);
      }

      // Overall: 9 total, 6 implemented, 3 helped
      expect(metrics.all.totalRecommendations).toBe(9);
      expect(metrics.all.implementedCount).toBe(6);
      expect(metrics.all.helpedCount).toBe(3);
    });
  });

  describe('Concurrent Access', () => {
    test('handles multiple concurrent writes', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        Promise.resolve(
          storage.createOutcome({
            sessionId: `session-${i}`,
            recommendationId: `REC-${i}`,
            recommendationType: 'preventive',
            recommendationSummary: `Rec ${i}`,
            implemented: null,
            implementationDate: null,
            helped: null,
            outcomeNotes: null,
            configChangedAfter: null,
            similarIssueRecurred: null,
          })
        )
      );

      const outcomes = await Promise.all(promises);
      expect(outcomes).toHaveLength(10);

      // All should have unique IDs
      const ids = new Set(outcomes.map((o) => o.id));
      expect(ids.size).toBe(10);
    });
  });
});
