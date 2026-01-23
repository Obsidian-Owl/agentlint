/**
 * T025-T026: Unit tests for get_session_summaries queries
 *
 * Tests session summary extraction including first user prompt,
 * files operated, and skills invoked.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import {
  querySessionSummaries,
  getFirstUserPrompt,
  getFilesOperated,
  getSkillsInvoked,
} from '../../../src/skills/storage/queries';
import { initializeSkillsSchema } from '../../../src/skills/storage/schema';

// =============================================================================
// Test Setup
// =============================================================================

let db: Database;

function createTestDatabase(): Database {
  const database = new Database(':memory:');

  // Create sessions table (minimal schema for testing)
  database.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      first_timestamp TEXT NOT NULL,
      last_timestamp TEXT,
      entry_count INTEGER DEFAULT 0,
      project_path TEXT
    );
  `);

  // Create session_entries table for storing entry data
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

  // Initialize skills schema (skill_invocations table)
  initializeSkillsSchema(database);

  return database;
}

function insertTestSession(
  database: Database,
  sessionId: string,
  timestamp: string,
  projectPath: string = '/test/project',
  entryCount: number = 10
) {
  database.prepare(`
    INSERT INTO sessions (session_id, first_timestamp, last_timestamp, entry_count, project_path)
    VALUES ($sessionId, $timestamp, $timestamp, $entryCount, $projectPath)
  `).run({
    $sessionId: sessionId,
    $timestamp: timestamp,
    $entryCount: entryCount,
    $projectPath: projectPath,
  });
}

function insertTestEntry(
  database: Database,
  sessionId: string,
  role: string,
  timestamp: string,
  content: string | null = null,
  toolName: string | null = null,
  toolInput: string | null = null
) {
  database.prepare(`
    INSERT INTO session_entries (session_id, role, timestamp, content, tool_name, tool_input)
    VALUES ($sessionId, $role, $timestamp, $content, $toolName, $toolInput)
  `).run({
    $sessionId: sessionId,
    $role: role,
    $timestamp: timestamp,
    $content: content,
    $toolName: toolName,
    $toolInput: toolInput,
  });
}

function insertTestSkillInvocation(
  database: Database,
  sessionId: string,
  skillName: string,
  timestamp: string
) {
  database.prepare(`
    INSERT INTO skill_invocations (session_id, skill_name, timestamp)
    VALUES ($sessionId, $skillName, $timestamp)
  `).run({
    $sessionId: sessionId,
    $skillName: skillName,
    $timestamp: timestamp,
  });
}

// =============================================================================
// Tests
// =============================================================================

describe('getFirstUserPrompt', () => {
  beforeEach(() => {
    db = createTestDatabase();
  });

  afterEach(() => {
    db.close();
  });

  // T025: get_session_summaries returns first user prompt
  it('returns first user prompt from session', () => {
    const sessionId = 'session-1';
    insertTestSession(db, sessionId, '2026-01-24T10:00:00Z');

    // Insert entries in order - first user message should be returned
    insertTestEntry(db, sessionId, 'user', '2026-01-24T10:00:00Z', 'Please help me fix the bug');
    insertTestEntry(db, sessionId, 'assistant', '2026-01-24T10:00:01Z', 'I can help with that');
    insertTestEntry(db, sessionId, 'user', '2026-01-24T10:00:02Z', 'This is the second message');

    const result = getFirstUserPrompt(db, sessionId);

    expect(result).toBe('Please help me fix the bug');
  });

  it('returns empty string when no user entries exist', () => {
    const sessionId = 'session-1';
    insertTestSession(db, sessionId, '2026-01-24T10:00:00Z');

    // Only assistant entry, no user
    insertTestEntry(db, sessionId, 'assistant', '2026-01-24T10:00:00Z', 'Hello');

    const result = getFirstUserPrompt(db, sessionId);

    expect(result).toBe('');
  });

  it('returns empty string for non-existent session', () => {
    const result = getFirstUserPrompt(db, 'nonexistent-session');
    expect(result).toBe('');
  });

  it('truncates long prompts to 500 characters', () => {
    const sessionId = 'session-1';
    insertTestSession(db, sessionId, '2026-01-24T10:00:00Z');

    const longPrompt = 'A'.repeat(600);
    insertTestEntry(db, sessionId, 'user', '2026-01-24T10:00:00Z', longPrompt);

    const result = getFirstUserPrompt(db, sessionId);

    expect(result.length).toBe(503); // 500 + '...'
    expect(result.endsWith('...')).toBe(true);
  });

  it('does not truncate prompts under 500 characters', () => {
    const sessionId = 'session-1';
    insertTestSession(db, sessionId, '2026-01-24T10:00:00Z');

    const shortPrompt = 'A'.repeat(400);
    insertTestEntry(db, sessionId, 'user', '2026-01-24T10:00:00Z', shortPrompt);

    const result = getFirstUserPrompt(db, sessionId);

    expect(result.length).toBe(400);
    expect(result.endsWith('...')).toBe(false);
  });
});

describe('getFilesOperated', () => {
  beforeEach(() => {
    db = createTestDatabase();
  });

  afterEach(() => {
    db.close();
  });

  // T026: get_session_summaries returns files operated
  it('returns files from Read/Write/Edit tools', () => {
    const sessionId = 'session-1';
    insertTestSession(db, sessionId, '2026-01-24T10:00:00Z');

    // Read tool with file_path
    insertTestEntry(
      db,
      sessionId,
      'assistant',
      '2026-01-24T10:00:01Z',
      null,
      'Read',
      JSON.stringify({ file_path: '/src/index.ts' })
    );

    // Write tool with file_path
    insertTestEntry(
      db,
      sessionId,
      'assistant',
      '2026-01-24T10:00:02Z',
      null,
      'Write',
      JSON.stringify({ file_path: '/src/utils.ts', content: 'code' })
    );

    // Edit tool with file_path
    insertTestEntry(
      db,
      sessionId,
      'assistant',
      '2026-01-24T10:00:03Z',
      null,
      'Edit',
      JSON.stringify({ file_path: '/src/config.ts', old_string: 'a', new_string: 'b' })
    );

    const result = getFilesOperated(db, sessionId);

    expect(result).toHaveLength(3);
    expect(result).toContain('/src/index.ts');
    expect(result).toContain('/src/utils.ts');
    expect(result).toContain('/src/config.ts');
  });

  it('returns files using path field (Read tool variant)', () => {
    const sessionId = 'session-1';
    insertTestSession(db, sessionId, '2026-01-24T10:00:00Z');

    // Some tools use 'path' instead of 'file_path'
    insertTestEntry(
      db,
      sessionId,
      'assistant',
      '2026-01-24T10:00:01Z',
      null,
      'Read',
      JSON.stringify({ path: '/src/module.ts' })
    );

    const result = getFilesOperated(db, sessionId);

    expect(result).toContain('/src/module.ts');
  });

  it('returns unique file paths (no duplicates)', () => {
    const sessionId = 'session-1';
    insertTestSession(db, sessionId, '2026-01-24T10:00:00Z');

    // Same file read twice
    insertTestEntry(
      db,
      sessionId,
      'assistant',
      '2026-01-24T10:00:01Z',
      null,
      'Read',
      JSON.stringify({ file_path: '/src/index.ts' })
    );
    insertTestEntry(
      db,
      sessionId,
      'assistant',
      '2026-01-24T10:00:02Z',
      null,
      'Read',
      JSON.stringify({ file_path: '/src/index.ts' })
    );

    const result = getFilesOperated(db, sessionId);

    expect(result).toHaveLength(1);
    expect(result).toContain('/src/index.ts');
  });

  it('ignores non-file tools', () => {
    const sessionId = 'session-1';
    insertTestSession(db, sessionId, '2026-01-24T10:00:00Z');

    // Bash tool - should be ignored
    insertTestEntry(
      db,
      sessionId,
      'assistant',
      '2026-01-24T10:00:01Z',
      null,
      'Bash',
      JSON.stringify({ command: 'ls -la' })
    );

    const result = getFilesOperated(db, sessionId);

    expect(result).toHaveLength(0);
  });

  it('returns empty array when no file operations', () => {
    const sessionId = 'session-1';
    insertTestSession(db, sessionId, '2026-01-24T10:00:00Z');

    const result = getFilesOperated(db, sessionId);

    expect(result).toEqual([]);
  });
});

describe('getSkillsInvoked', () => {
  beforeEach(() => {
    db = createTestDatabase();
  });

  afterEach(() => {
    db.close();
  });

  it('returns skills invoked in session', () => {
    const sessionId = 'session-1';
    insertTestSession(db, sessionId, '2026-01-24T10:00:00Z');

    insertTestSkillInvocation(db, sessionId, 'commit', '2026-01-24T10:01:00Z');
    insertTestSkillInvocation(db, sessionId, 'test', '2026-01-24T10:02:00Z');

    const result = getSkillsInvoked(db, sessionId);

    expect(result).toHaveLength(2);
    expect(result).toContain('commit');
    expect(result).toContain('test');
  });

  it('returns unique skill names (no duplicates)', () => {
    const sessionId = 'session-1';
    insertTestSession(db, sessionId, '2026-01-24T10:00:00Z');

    // Same skill invoked twice
    insertTestSkillInvocation(db, sessionId, 'commit', '2026-01-24T10:01:00Z');
    insertTestSkillInvocation(db, sessionId, 'commit', '2026-01-24T10:02:00Z');

    const result = getSkillsInvoked(db, sessionId);

    expect(result).toHaveLength(1);
    expect(result).toContain('commit');
  });

  it('returns empty array when no skills invoked', () => {
    const sessionId = 'session-1';
    insertTestSession(db, sessionId, '2026-01-24T10:00:00Z');

    const result = getSkillsInvoked(db, sessionId);

    expect(result).toEqual([]);
  });

  it('returns skills sorted alphabetically', () => {
    const sessionId = 'session-1';
    insertTestSession(db, sessionId, '2026-01-24T10:00:00Z');

    insertTestSkillInvocation(db, sessionId, 'zeta', '2026-01-24T10:01:00Z');
    insertTestSkillInvocation(db, sessionId, 'alpha', '2026-01-24T10:02:00Z');
    insertTestSkillInvocation(db, sessionId, 'beta', '2026-01-24T10:03:00Z');

    const result = getSkillsInvoked(db, sessionId);

    expect(result).toEqual(['alpha', 'beta', 'zeta']);
  });
});

describe('querySessionSummaries', () => {
  beforeEach(() => {
    db = createTestDatabase();
  });

  afterEach(() => {
    db.close();
  });

  it('returns session summaries with all fields populated', () => {
    const sessionId = 'session-1';
    insertTestSession(db, sessionId, '2026-01-24T10:00:00Z', '/my/project', 15);

    // User prompt
    insertTestEntry(db, sessionId, 'user', '2026-01-24T10:00:00Z', 'Help me refactor this code');

    // File operations
    insertTestEntry(
      db,
      sessionId,
      'assistant',
      '2026-01-24T10:00:01Z',
      null,
      'Read',
      JSON.stringify({ file_path: '/src/main.ts' })
    );

    // Skill invocation
    insertTestSkillInvocation(db, sessionId, 'commit', '2026-01-24T10:01:00Z');

    const result = querySessionSummaries(db, {});

    expect(result).toHaveLength(1);
    expect(result[0]?.sessionId).toBe(sessionId);
    expect(result[0]?.timestamp).toBe('2026-01-24T10:00:00Z');
    expect(result[0]?.firstUserPrompt).toBe('Help me refactor this code');
    expect(result[0]?.filesOperated).toContain('/src/main.ts');
    expect(result[0]?.skillsInvoked).toContain('commit');
    expect(result[0]?.turnCount).toBe(15);
  });

  it('filters by since date', () => {
    insertTestSession(db, 'old-session', '2026-01-20T10:00:00Z');
    insertTestSession(db, 'new-session', '2026-01-24T10:00:00Z');

    const result = querySessionSummaries(db, { since: '2026-01-23T00:00:00Z' });

    expect(result).toHaveLength(1);
    expect(result[0]?.sessionId).toBe('new-session');
  });

  it('filters by until date', () => {
    insertTestSession(db, 'old-session', '2026-01-20T10:00:00Z');
    insertTestSession(db, 'new-session', '2026-01-24T10:00:00Z');

    const result = querySessionSummaries(db, { until: '2026-01-22T00:00:00Z' });

    expect(result).toHaveLength(1);
    expect(result[0]?.sessionId).toBe('old-session');
  });

  it('filters by project path', () => {
    insertTestSession(db, 'session-a', '2026-01-24T10:00:00Z', '/project-a');
    insertTestSession(db, 'session-b', '2026-01-24T11:00:00Z', '/project-b');

    const result = querySessionSummaries(db, { projectPath: '/project-a' });

    expect(result).toHaveLength(1);
    expect(result[0]?.sessionId).toBe('session-a');
  });

  it('respects limit parameter', () => {
    insertTestSession(db, 'session-1', '2026-01-24T10:00:00Z');
    insertTestSession(db, 'session-2', '2026-01-24T11:00:00Z');
    insertTestSession(db, 'session-3', '2026-01-24T12:00:00Z');

    const result = querySessionSummaries(db, { limit: 2 });

    expect(result).toHaveLength(2);
  });

  it('orders by timestamp descending (newest first)', () => {
    insertTestSession(db, 'oldest', '2026-01-24T08:00:00Z');
    insertTestSession(db, 'middle', '2026-01-24T10:00:00Z');
    insertTestSession(db, 'newest', '2026-01-24T12:00:00Z');

    const result = querySessionSummaries(db, {});

    expect(result[0]?.sessionId).toBe('newest');
    expect(result[1]?.sessionId).toBe('middle');
    expect(result[2]?.sessionId).toBe('oldest');
  });

  it('returns empty array when no sessions match', () => {
    const result = querySessionSummaries(db, { projectPath: '/nonexistent' });
    expect(result).toEqual([]);
  });
});
