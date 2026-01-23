/**
 * T030: Integration test for session summaries
 *
 * Tests that session summaries include skills invoked by verifying
 * the full data flow from session entries to summaries.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { querySessionSummaries } from '../../../src/skills/storage/queries';
import { initializeSkillsSchema } from '../../../src/skills/storage/schema';

// =============================================================================
// Test Setup
// =============================================================================

const TEST_DIR = join(tmpdir(), 'agentlint-integration-skills-' + Date.now());
let db: Database;

function setupTestDatabase(): Database {
  // Create a test database
  mkdirSync(TEST_DIR, { recursive: true });
  const dbPath = join(TEST_DIR, 'sessions.db');
  const database = new Database(dbPath);

  // Create sessions table
  database.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      first_timestamp TEXT NOT NULL,
      last_timestamp TEXT,
      entry_count INTEGER DEFAULT 0,
      project_path TEXT
    );
  `);

  // Create session_entries table
  database.exec(`
    CREATE TABLE IF NOT EXISTS session_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      content TEXT,
      tool_name TEXT,
      tool_input TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
    );
  `);

  // Initialize skills schema
  initializeSkillsSchema(database);

  return database;
}

function cleanupTestDir() {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

function insertSession(
  database: Database,
  sessionId: string,
  timestamp: string,
  projectPath: string,
  entryCount: number
) {
  database.prepare(`
    INSERT INTO sessions (session_id, first_timestamp, last_timestamp, entry_count, project_path)
    VALUES (?, ?, ?, ?, ?)
  `).run(sessionId, timestamp, timestamp, entryCount, projectPath);
}

function insertEntry(
  database: Database,
  sessionId: string,
  role: string,
  timestamp: string,
  content: string | null,
  toolName: string | null,
  toolInput: string | null
) {
  database.prepare(`
    INSERT INTO session_entries (session_id, role, timestamp, content, tool_name, tool_input)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(sessionId, role, timestamp, content, toolName, toolInput);
}

function insertSkillInvocation(
  database: Database,
  sessionId: string,
  skillName: string,
  timestamp: string
) {
  database.prepare(`
    INSERT INTO skill_invocations (session_id, skill_name, timestamp)
    VALUES (?, ?, ?)
  `).run(sessionId, skillName, timestamp);
}

// =============================================================================
// Tests
// =============================================================================

describe('Session Summaries Integration', () => {
  beforeEach(() => {
    cleanupTestDir();
    db = setupTestDatabase();
  });

  afterEach(() => {
    db.close();
    cleanupTestDir();
  });

  it('session summaries include skills invoked', () => {
    // Create a session
    const sessionId = 'integration-test-session';
    const timestamp = '2026-01-24T10:00:00Z';
    insertSession(db, sessionId, timestamp, '/test/project', 20);

    // Add user prompt
    insertEntry(
      db,
      sessionId,
      'user',
      '2026-01-24T10:00:00Z',
      'Please help me commit my changes',
      null,
      null
    );

    // Add file operations
    insertEntry(
      db,
      sessionId,
      'assistant',
      '2026-01-24T10:00:01Z',
      null,
      'Read',
      JSON.stringify({ file_path: '/src/main.ts' })
    );

    insertEntry(
      db,
      sessionId,
      'assistant',
      '2026-01-24T10:00:02Z',
      null,
      'Edit',
      JSON.stringify({ file_path: '/src/utils.ts', old_string: 'a', new_string: 'b' })
    );

    // Add skill invocations
    insertSkillInvocation(db, sessionId, 'commit', '2026-01-24T10:01:00Z');
    insertSkillInvocation(db, sessionId, 'test', '2026-01-24T10:02:00Z');

    // Query session summaries
    const summaries = querySessionSummaries(db, {});

    // Verify
    expect(summaries).toHaveLength(1);

    const summary = summaries[0];
    expect(summary).toBeDefined();
    expect(summary?.sessionId).toBe(sessionId);
    expect(summary?.timestamp).toBe(timestamp);
    expect(summary?.turnCount).toBe(20);

    // First user prompt
    expect(summary?.firstUserPrompt).toContain('commit my changes');

    // Files operated
    expect(summary?.filesOperated).toContain('/src/main.ts');
    expect(summary?.filesOperated).toContain('/src/utils.ts');

    // Skills invoked - this is the key assertion for T030
    expect(summary?.skillsInvoked).toHaveLength(2);
    expect(summary?.skillsInvoked).toContain('commit');
    expect(summary?.skillsInvoked).toContain('test');
  });

  it('session without skills shows empty skillsInvoked array', () => {
    const sessionId = 'no-skills-session';
    insertSession(db, sessionId, '2026-01-24T10:00:00Z', '/test/project', 5);

    insertEntry(
      db,
      sessionId,
      'user',
      '2026-01-24T10:00:00Z',
      'Help me understand this code',
      null,
      null
    );

    insertEntry(
      db,
      sessionId,
      'assistant',
      '2026-01-24T10:00:01Z',
      null,
      'Read',
      JSON.stringify({ file_path: '/src/code.ts' })
    );

    const summaries = querySessionSummaries(db, {});

    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.skillsInvoked).toEqual([]);
  });

  it('multiple sessions with different skill patterns', () => {
    // Session 1: Uses commit skill
    insertSession(db, 'session-1', '2026-01-24T10:00:00Z', '/project-a', 10);
    insertEntry(db, 'session-1', 'user', '2026-01-24T10:00:00Z', 'Commit changes', null, null);
    insertSkillInvocation(db, 'session-1', 'commit', '2026-01-24T10:01:00Z');

    // Session 2: Uses test skill
    insertSession(db, 'session-2', '2026-01-24T11:00:00Z', '/project-a', 15);
    insertEntry(db, 'session-2', 'user', '2026-01-24T11:00:00Z', 'Run tests', null, null);
    insertSkillInvocation(db, 'session-2', 'test', '2026-01-24T11:01:00Z');

    // Session 3: No skills
    insertSession(db, 'session-3', '2026-01-24T12:00:00Z', '/project-b', 5);
    insertEntry(db, 'session-3', 'user', '2026-01-24T12:00:00Z', 'Explain code', null, null);

    const summaries = querySessionSummaries(db, {});

    expect(summaries).toHaveLength(3);

    // Find each session by ID
    const s1 = summaries.find((s) => s.sessionId === 'session-1');
    const s2 = summaries.find((s) => s.sessionId === 'session-2');
    const s3 = summaries.find((s) => s.sessionId === 'session-3');

    expect(s1?.skillsInvoked).toEqual(['commit']);
    expect(s2?.skillsInvoked).toEqual(['test']);
    expect(s3?.skillsInvoked).toEqual([]);
  });

  it('filters sessions by project path', () => {
    insertSession(db, 'session-a', '2026-01-24T10:00:00Z', '/project-a', 10);
    insertSkillInvocation(db, 'session-a', 'commit', '2026-01-24T10:01:00Z');

    insertSession(db, 'session-b', '2026-01-24T11:00:00Z', '/project-b', 10);
    insertSkillInvocation(db, 'session-b', 'test', '2026-01-24T11:01:00Z');

    const summaries = querySessionSummaries(db, { projectPath: '/project-a' });

    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.sessionId).toBe('session-a');
    expect(summaries[0]?.skillsInvoked).toContain('commit');
  });

  it('filters sessions by date range', () => {
    insertSession(db, 'old-session', '2026-01-20T10:00:00Z', '/project', 10);
    insertSkillInvocation(db, 'old-session', 'old-skill', '2026-01-20T10:01:00Z');

    insertSession(db, 'recent-session', '2026-01-24T10:00:00Z', '/project', 10);
    insertSkillInvocation(db, 'recent-session', 'new-skill', '2026-01-24T10:01:00Z');

    const summaries = querySessionSummaries(db, {
      since: '2026-01-23T00:00:00Z',
      until: '2026-01-25T00:00:00Z',
    });

    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.sessionId).toBe('recent-session');
    expect(summaries[0]?.skillsInvoked).toContain('new-skill');
  });
});
