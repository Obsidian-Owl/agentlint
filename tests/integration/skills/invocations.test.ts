/**
 * T037: Integration test for skill invocations
 *
 * Tests that query returns correct data after indexing.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  querySkillInvocations,
  insertSkillInvocationsBatch,
  countSkillInvocations,
  countUniqueSkills,
  countUniqueSessions,
} from '../../../src/skills/storage/queries';
import { initializeSkillsSchema } from '../../../src/skills/storage/schema';

// =============================================================================
// Test Setup
// =============================================================================

const TEST_DIR = join(tmpdir(), 'agentlint-integration-invocations-' + Date.now());
let db: Database;

function setupTestDatabase(): Database {
  mkdirSync(TEST_DIR, { recursive: true });
  const dbPath = join(TEST_DIR, 'sessions.db');
  const database = new Database(dbPath);
  initializeSkillsSchema(database);
  return database;
}

function cleanupTestDir() {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('Skill Invocations Integration', () => {
  beforeEach(() => {
    cleanupTestDir();
    db = setupTestDatabase();
  });

  afterEach(() => {
    db.close();
    cleanupTestDir();
  });

  it('query returns correct data after indexing', () => {
    // Simulate indexing by batch inserting invocations
    const invocations = [
      {
        session_id: 'session-1',
        skill_name: 'commit',
        timestamp: '2026-01-24T10:00:00Z',
        user_prompt_snippet: 'Please commit my changes',
        file_path: '/path/to/session.jsonl',
        line_number: 100,
      },
      {
        session_id: 'session-1',
        skill_name: 'test',
        timestamp: '2026-01-24T10:05:00Z',
        user_prompt_snippet: 'Run the tests',
        file_path: '/path/to/session.jsonl',
        line_number: 150,
      },
      {
        session_id: 'session-2',
        skill_name: 'commit',
        timestamp: '2026-01-24T11:00:00Z',
        user_prompt_snippet: 'Commit the bug fix',
        file_path: '/path/to/session2.jsonl',
        line_number: 50,
      },
    ];

    // Index the invocations
    const inserted = insertSkillInvocationsBatch(db, invocations);
    expect(inserted).toBe(3);

    // Query all invocations
    const all = querySkillInvocations(db, {});
    expect(all).toHaveLength(3);

    // Verify data integrity
    const commitInSession1 = all.find(
      (inv) => inv.skillName === 'commit' && inv.sessionId === 'session-1'
    );
    expect(commitInSession1).toBeDefined();
    expect(commitInSession1?.userPromptSnippet).toBe('Please commit my changes');
    expect(commitInSession1?.timestamp).toBe('2026-01-24T10:00:00Z');

    // Query with skill filter
    const commitOnly = querySkillInvocations(db, { skillName: 'commit' });
    expect(commitOnly).toHaveLength(2);
    expect(commitOnly.every((inv) => inv.skillName === 'commit')).toBe(true);

    // Query with session filter
    const session1Only = querySkillInvocations(db, { sessionId: 'session-1' });
    expect(session1Only).toHaveLength(2);
    expect(session1Only.every((inv) => inv.sessionId === 'session-1')).toBe(true);

    // Query with date range
    const recentOnly = querySkillInvocations(db, { since: '2026-01-24T10:30:00Z' });
    expect(recentOnly).toHaveLength(1);
    expect(recentOnly[0]?.sessionId).toBe('session-2');

    // Verify counts
    expect(countSkillInvocations(db, {})).toBe(3);
    expect(countUniqueSkills(db, {})).toBe(2); // commit, test
    expect(countUniqueSessions(db, {})).toBe(2); // session-1, session-2
  });

  it('handles re-indexing with force', () => {
    // Initial index
    const initialInvocations = [
      {
        session_id: 'session-1',
        skill_name: 'commit',
        timestamp: '2026-01-24T10:00:00Z',
        user_prompt_snippet: 'Initial commit',
        file_path: null,
        line_number: null,
      },
    ];
    insertSkillInvocationsBatch(db, initialInvocations);
    expect(countSkillInvocations(db, {})).toBe(1);

    // Simulate force re-index by adding more
    const moreInvocations = [
      {
        session_id: 'session-2',
        skill_name: 'test',
        timestamp: '2026-01-24T11:00:00Z',
        user_prompt_snippet: 'Run tests',
        file_path: null,
        line_number: null,
      },
    ];
    insertSkillInvocationsBatch(db, moreInvocations);

    // Should have both
    expect(countSkillInvocations(db, {})).toBe(2);
  });

  it('pagination works correctly', () => {
    // Insert many invocations
    const invocations = [];
    for (let i = 0; i < 10; i++) {
      invocations.push({
        session_id: `session-${i}`,
        skill_name: 'commit',
        timestamp: `2026-01-24T${String(10 + i).padStart(2, '0')}:00:00Z`,
        user_prompt_snippet: `Commit ${i}`,
        file_path: null,
        line_number: null,
      });
    }
    insertSkillInvocationsBatch(db, invocations);

    // Page 1
    const page1 = querySkillInvocations(db, { limit: 3, offset: 0 });
    expect(page1).toHaveLength(3);

    // Page 2
    const page2 = querySkillInvocations(db, { limit: 3, offset: 3 });
    expect(page2).toHaveLength(3);

    // Pages should have different data
    expect(page1[0]?.sessionId).not.toBe(page2[0]?.sessionId);

    // Total count unchanged by pagination
    expect(countSkillInvocations(db, {})).toBe(10);
  });

  it('combined filters work correctly', () => {
    const invocations = [
      {
        session_id: 'session-1',
        skill_name: 'commit',
        timestamp: '2026-01-20T10:00:00Z',
        user_prompt_snippet: 'Old commit',
        file_path: null,
        line_number: null,
      },
      {
        session_id: 'session-1',
        skill_name: 'commit',
        timestamp: '2026-01-24T10:00:00Z',
        user_prompt_snippet: 'Recent commit',
        file_path: null,
        line_number: null,
      },
      {
        session_id: 'session-1',
        skill_name: 'test',
        timestamp: '2026-01-24T10:00:00Z',
        user_prompt_snippet: 'Recent test',
        file_path: null,
        line_number: null,
      },
      {
        session_id: 'session-2',
        skill_name: 'commit',
        timestamp: '2026-01-24T10:00:00Z',
        user_prompt_snippet: 'Other session commit',
        file_path: null,
        line_number: null,
      },
    ];
    insertSkillInvocationsBatch(db, invocations);

    // Combine skill name + session + date range
    const result = querySkillInvocations(db, {
      skillName: 'commit',
      sessionId: 'session-1',
      since: '2026-01-23T00:00:00Z',
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.userPromptSnippet).toBe('Recent commit');
  });
});
