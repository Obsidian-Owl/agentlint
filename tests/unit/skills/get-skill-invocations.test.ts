/**
 * T031-T033: Unit tests for get_skill_invocations queries
 *
 * Tests skill invocation filtering by name, date range, and session ID.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import {
  querySkillInvocations,
  countSkillInvocations,
  countUniqueSkills,
  countUniqueSessions,
} from '../../../src/skills/storage/queries';
import { initializeSkillsSchema } from '../../../src/skills/storage/schema';

// =============================================================================
// Test Setup
// =============================================================================

let db: Database;

function createTestDatabase(): Database {
  const database = new Database(':memory:');
  initializeSkillsSchema(database);
  return database;
}

function insertInvocation(
  database: Database,
  skillName: string,
  sessionId: string,
  timestamp: string,
  userPromptSnippet: string = ''
) {
  database
    .prepare(
      `
    INSERT INTO skill_invocations (skill_name, session_id, timestamp, user_prompt_snippet)
    VALUES (?, ?, ?, ?)
  `
    )
    .run(skillName, sessionId, timestamp, userPromptSnippet);
}

// =============================================================================
// Tests
// =============================================================================

describe('querySkillInvocations', () => {
  beforeEach(() => {
    db = createTestDatabase();
  });

  afterEach(() => {
    db.close();
  });

  // T031: filters by skill name
  it('filters by skill name', () => {
    insertInvocation(db, 'commit', 'session-1', '2026-01-24T10:00:00Z');
    insertInvocation(db, 'test', 'session-1', '2026-01-24T10:01:00Z');
    insertInvocation(db, 'commit', 'session-2', '2026-01-24T10:02:00Z');

    const result = querySkillInvocations(db, { skillName: 'commit' });

    expect(result).toHaveLength(2);
    expect(result.every((r) => r.skillName === 'commit')).toBe(true);
  });

  it('returns all invocations when no skill name filter', () => {
    insertInvocation(db, 'commit', 'session-1', '2026-01-24T10:00:00Z');
    insertInvocation(db, 'test', 'session-1', '2026-01-24T10:01:00Z');

    const result = querySkillInvocations(db, {});

    expect(result).toHaveLength(2);
  });

  // T032: filters by date range (since/until)
  it('filters by since date', () => {
    insertInvocation(db, 'commit', 'session-1', '2026-01-20T10:00:00Z');
    insertInvocation(db, 'commit', 'session-2', '2026-01-24T10:00:00Z');
    insertInvocation(db, 'commit', 'session-3', '2026-01-25T10:00:00Z');

    const result = querySkillInvocations(db, { since: '2026-01-23T00:00:00Z' });

    expect(result).toHaveLength(2);
    expect(result.some((r) => r.sessionId === 'session-2')).toBe(true);
    expect(result.some((r) => r.sessionId === 'session-3')).toBe(true);
  });

  it('filters by until date', () => {
    insertInvocation(db, 'commit', 'session-1', '2026-01-20T10:00:00Z');
    insertInvocation(db, 'commit', 'session-2', '2026-01-24T10:00:00Z');
    insertInvocation(db, 'commit', 'session-3', '2026-01-25T10:00:00Z');

    const result = querySkillInvocations(db, { until: '2026-01-22T00:00:00Z' });

    expect(result).toHaveLength(1);
    expect(result[0]?.sessionId).toBe('session-1');
  });

  it('filters by date range (since AND until)', () => {
    insertInvocation(db, 'commit', 'session-1', '2026-01-20T10:00:00Z');
    insertInvocation(db, 'commit', 'session-2', '2026-01-24T10:00:00Z');
    insertInvocation(db, 'commit', 'session-3', '2026-01-28T10:00:00Z');

    const result = querySkillInvocations(db, {
      since: '2026-01-22T00:00:00Z',
      until: '2026-01-26T00:00:00Z',
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.sessionId).toBe('session-2');
  });

  // T033: filters by session ID
  it('filters by session ID', () => {
    insertInvocation(db, 'commit', 'session-1', '2026-01-24T10:00:00Z');
    insertInvocation(db, 'test', 'session-1', '2026-01-24T10:01:00Z');
    insertInvocation(db, 'commit', 'session-2', '2026-01-24T10:02:00Z');

    const result = querySkillInvocations(db, { sessionId: 'session-1' });

    expect(result).toHaveLength(2);
    expect(result.every((r) => r.sessionId === 'session-1')).toBe(true);
  });

  it('combines multiple filters', () => {
    insertInvocation(db, 'commit', 'session-1', '2026-01-20T10:00:00Z');
    insertInvocation(db, 'commit', 'session-1', '2026-01-24T10:00:00Z');
    insertInvocation(db, 'test', 'session-1', '2026-01-24T10:01:00Z');
    insertInvocation(db, 'commit', 'session-2', '2026-01-24T10:02:00Z');

    const result = querySkillInvocations(db, {
      skillName: 'commit',
      sessionId: 'session-1',
      since: '2026-01-23T00:00:00Z',
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.skillName).toBe('commit');
    expect(result[0]?.sessionId).toBe('session-1');
  });

  it('respects limit parameter', () => {
    insertInvocation(db, 'commit', 'session-1', '2026-01-24T10:00:00Z');
    insertInvocation(db, 'commit', 'session-2', '2026-01-24T10:01:00Z');
    insertInvocation(db, 'commit', 'session-3', '2026-01-24T10:02:00Z');

    const result = querySkillInvocations(db, { limit: 2 });

    expect(result).toHaveLength(2);
  });

  it('respects offset parameter', () => {
    insertInvocation(db, 'commit', 'session-1', '2026-01-24T10:00:00Z');
    insertInvocation(db, 'commit', 'session-2', '2026-01-24T10:01:00Z');
    insertInvocation(db, 'commit', 'session-3', '2026-01-24T10:02:00Z');

    const result = querySkillInvocations(db, { limit: 2, offset: 1 });

    expect(result).toHaveLength(2);
    // Ordered by timestamp DESC, so offset 1 skips the newest
    expect(result[0]?.sessionId).toBe('session-2');
  });

  it('orders by timestamp descending', () => {
    insertInvocation(db, 'commit', 'session-1', '2026-01-24T08:00:00Z');
    insertInvocation(db, 'commit', 'session-2', '2026-01-24T12:00:00Z');
    insertInvocation(db, 'commit', 'session-3', '2026-01-24T10:00:00Z');

    const result = querySkillInvocations(db, {});

    expect(result[0]?.sessionId).toBe('session-2'); // 12:00
    expect(result[1]?.sessionId).toBe('session-3'); // 10:00
    expect(result[2]?.sessionId).toBe('session-1'); // 08:00
  });

  it('includes user prompt snippet', () => {
    insertInvocation(db, 'commit', 'session-1', '2026-01-24T10:00:00Z', 'Please commit my changes');

    const result = querySkillInvocations(db, {});

    expect(result[0]?.userPromptSnippet).toBe('Please commit my changes');
  });

  it('returns empty array when no matches', () => {
    insertInvocation(db, 'commit', 'session-1', '2026-01-24T10:00:00Z');

    const result = querySkillInvocations(db, { skillName: 'nonexistent' });

    expect(result).toEqual([]);
  });
});

describe('countSkillInvocations', () => {
  beforeEach(() => {
    db = createTestDatabase();
  });

  afterEach(() => {
    db.close();
  });

  it('counts total invocations', () => {
    insertInvocation(db, 'commit', 'session-1', '2026-01-24T10:00:00Z');
    insertInvocation(db, 'test', 'session-1', '2026-01-24T10:01:00Z');
    insertInvocation(db, 'commit', 'session-2', '2026-01-24T10:02:00Z');

    const count = countSkillInvocations(db, {});

    expect(count).toBe(3);
  });

  it('counts with skill name filter', () => {
    insertInvocation(db, 'commit', 'session-1', '2026-01-24T10:00:00Z');
    insertInvocation(db, 'test', 'session-1', '2026-01-24T10:01:00Z');

    const count = countSkillInvocations(db, { skillName: 'commit' });

    expect(count).toBe(1);
  });

  it('returns 0 when no matches', () => {
    const count = countSkillInvocations(db, {});
    expect(count).toBe(0);
  });
});

describe('countUniqueSkills', () => {
  beforeEach(() => {
    db = createTestDatabase();
  });

  afterEach(() => {
    db.close();
  });

  it('counts unique skill names', () => {
    insertInvocation(db, 'commit', 'session-1', '2026-01-24T10:00:00Z');
    insertInvocation(db, 'commit', 'session-2', '2026-01-24T10:01:00Z');
    insertInvocation(db, 'test', 'session-1', '2026-01-24T10:02:00Z');
    insertInvocation(db, 'review', 'session-1', '2026-01-24T10:03:00Z');

    const count = countUniqueSkills(db, {});

    expect(count).toBe(3); // commit, test, review
  });

  it('counts with filters', () => {
    insertInvocation(db, 'commit', 'session-1', '2026-01-24T10:00:00Z');
    insertInvocation(db, 'test', 'session-1', '2026-01-24T10:01:00Z');
    insertInvocation(db, 'review', 'session-2', '2026-01-24T10:02:00Z');

    const count = countUniqueSkills(db, { sessionId: 'session-1' });

    expect(count).toBe(2); // commit, test
  });
});

describe('countUniqueSessions', () => {
  beforeEach(() => {
    db = createTestDatabase();
  });

  afterEach(() => {
    db.close();
  });

  it('counts unique sessions', () => {
    insertInvocation(db, 'commit', 'session-1', '2026-01-24T10:00:00Z');
    insertInvocation(db, 'test', 'session-1', '2026-01-24T10:01:00Z');
    insertInvocation(db, 'commit', 'session-2', '2026-01-24T10:02:00Z');
    insertInvocation(db, 'review', 'session-3', '2026-01-24T10:03:00Z');

    const count = countUniqueSessions(db, {});

    expect(count).toBe(3);
  });

  it('counts with skill filter', () => {
    insertInvocation(db, 'commit', 'session-1', '2026-01-24T10:00:00Z');
    insertInvocation(db, 'commit', 'session-2', '2026-01-24T10:01:00Z');
    insertInvocation(db, 'test', 'session-3', '2026-01-24T10:02:00Z');

    const count = countUniqueSessions(db, { skillName: 'commit' });

    expect(count).toBe(2); // session-1, session-2
  });
});
