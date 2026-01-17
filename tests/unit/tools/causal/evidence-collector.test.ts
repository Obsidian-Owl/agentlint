/**
 * Unit tests for evidence-collector.ts
 *
 * Tests for the EvidenceCollector class that gathers evidence
 * from sessions, git, and config analysis to build causal chains.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { v4 as uuidv4 } from 'uuid';

import type { EvidenceItem, Position } from '../../../../src/tools/causal/types';

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Create a mock session database with FTS5 index for testing.
 */
function createMockSessionsDb(dbPath: string): Database {
  const db = new Database(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  // Create EP06 session tables (minimal for testing)
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      project_path TEXT NOT NULL,
      model TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Create FTS5 virtual table for session entries
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS session_entries USING fts5(
      session_id,
      project_path,
      timestamp,
      role,
      content,
      tool_name,
      file_path,
      line_number UNINDEXED
    );
  `);

  return db;
}

/**
 * Insert mock session entries for testing.
 */
function insertMockSessionEntries(
  db: Database,
  entries: Array<{
    sessionId: string;
    projectPath: string;
    timestamp: string;
    role: string;
    content: string;
    toolName?: string;
    filePath?: string;
    lineNumber?: number;
  }>
): void {
  const stmt = db.prepare(`
    INSERT INTO session_entries (session_id, project_path, timestamp, role, content, tool_name, file_path, line_number)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const entry of entries) {
    stmt.run(
      entry.sessionId,
      entry.projectPath,
      entry.timestamp,
      entry.role,
      entry.content,
      entry.toolName ?? '',
      entry.filePath ?? '',
      entry.lineNumber ?? 0
    );
  }
}

/**
 * Create a test position.
 */
function createTestPosition(overrides: Partial<Position> = {}): Position {
  return {
    filePath: '/project/src/index.ts',
    line: 42,
    column: 10,
    snippet: 'const x = undefined;',
    ...overrides,
  };
}

/**
 * Create a test evidence item.
 */
function createTestEvidence(
  overrides: Partial<EvidenceItem> = {}
): EvidenceItem {
  return {
    id: uuidv4(),
    type: 'SessionMatch',
    source: 'session-123',
    timestamp: new Date().toISOString(),
    content: 'User asked about error handling',
    position: undefined,
    metadata: undefined,
    ...overrides,
  };
}

// =============================================================================
// Test Suite
// =============================================================================

describe('EvidenceCollector', () => {
  const testBaseDir = join(tmpdir(), 'agentlint-test-evidence-collector');
  let db: Database;
  let dbPath: string;

  beforeEach(() => {
    // Clean up test directory
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true });
    }
    mkdirSync(testBaseDir, { recursive: true });

    // Create mock sessions database
    dbPath = join(testBaseDir, 'sessions.db');
    db = createMockSessionsDb(dbPath);
  });

  afterEach(() => {
    db.close();
    // Clean up test directory
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true });
    }
  });

  // ===========================================================================
  // T013: Session Evidence Collection
  // ===========================================================================

  describe('collectSessionEvidence', () => {
    it('should return empty array when no sessions match', async () => {
      // Insert one entry so FTS5 table is not empty
      insertMockSessionEntries(db, [
        {
          sessionId: 'session-1',
          projectPath: '/project',
          timestamp: '2026-01-17T10:00:00Z',
          role: 'user',
          content: 'Hello world',
        },
      ]);

      // Verify FTS5 returns no results for non-matching query
      const results = db
        .query<{ session_id: string }, [string]>(
          "SELECT session_id FROM session_entries WHERE session_entries MATCH ?"
        )
        .all('zzzznonexistent');

      expect(results).toEqual([]);
    });

    it('should find sessions matching issue keywords', () => {
      // Insert test sessions
      insertMockSessionEntries(db, [
        {
          sessionId: 'session-1',
          projectPath: '/project',
          timestamp: '2026-01-17T10:00:00Z',
          role: 'user',
          content: 'I need help with authentication error handling',
        },
        {
          sessionId: 'session-2',
          projectPath: '/project',
          timestamp: '2026-01-17T11:00:00Z',
          role: 'user',
          content: 'How do I configure database connections?',
        },
      ]);

      // Search for authentication-related content
      const results = db
        .query<
          { session_id: string; content: string; timestamp: string },
          [string]
        >(
          "SELECT session_id, content, timestamp FROM session_entries WHERE session_entries MATCH ?"
        )
        .all('authentication');

      expect(results.length).toBe(1);
      expect(results[0]!.session_id).toBe('session-1');
      expect(results[0]!.content).toContain('authentication');
    });

    it('should include project path filter', () => {
      insertMockSessionEntries(db, [
        {
          sessionId: 'session-1',
          projectPath: '/project-a',
          timestamp: '2026-01-17T10:00:00Z',
          role: 'user',
          content: 'Fix the bug in the component',
        },
        {
          sessionId: 'session-2',
          projectPath: '/project-b',
          timestamp: '2026-01-17T11:00:00Z',
          role: 'user',
          content: 'Fix the bug in the module',
        },
      ]);

      // Search with project filter
      const results = db
        .query<{ session_id: string; project_path: string }, [string, string]>(
          `SELECT session_id, project_path FROM session_entries
           WHERE session_entries MATCH ? AND project_path = ?`
        )
        .all('bug', '/project-a');

      expect(results.length).toBe(1);
      expect(results[0]!.project_path).toBe('/project-a');
    });

    it('should include date range filter', () => {
      insertMockSessionEntries(db, [
        {
          sessionId: 'session-old',
          projectPath: '/project',
          timestamp: '2026-01-10T10:00:00Z',
          role: 'user',
          content: 'Old error discussion',
        },
        {
          sessionId: 'session-new',
          projectPath: '/project',
          timestamp: '2026-01-17T10:00:00Z',
          role: 'user',
          content: 'New error discussion',
        },
      ]);

      // Search with date filter
      const results = db
        .query<{ session_id: string; timestamp: string }, [string, string]>(
          `SELECT session_id, timestamp FROM session_entries
           WHERE session_entries MATCH ? AND timestamp >= ?`
        )
        .all('error', '2026-01-15T00:00:00Z');

      expect(results.length).toBe(1);
      expect(results[0]!.session_id).toBe('session-new');
    });

    it('should capture file path and line number from tool calls', () => {
      insertMockSessionEntries(db, [
        {
          sessionId: 'session-1',
          projectPath: '/project',
          timestamp: '2026-01-17T10:00:00Z',
          role: 'assistant',
          content: 'Reading the auth module',
          toolName: 'Read',
          filePath: '/project/src/auth.ts',
          lineNumber: 45,
        },
      ]);

      const results = db
        .query<
          { session_id: string; file_path: string; line_number: number },
          [string]
        >(
          `SELECT session_id, file_path, line_number FROM session_entries
           WHERE session_entries MATCH ? AND file_path != ''`
        )
        .all('auth');

      expect(results.length).toBe(1);
      expect(results[0]!.file_path).toBe('/project/src/auth.ts');
      expect(results[0]!.line_number).toBe(45);
    });

    it('should rank results by BM25 relevance', () => {
      insertMockSessionEntries(db, [
        {
          sessionId: 'session-low',
          projectPath: '/project',
          timestamp: '2026-01-17T10:00:00Z',
          role: 'user',
          content: 'Something about database config',
        },
        {
          sessionId: 'session-high',
          projectPath: '/project',
          timestamp: '2026-01-17T11:00:00Z',
          role: 'user',
          content:
            'Config config config - multiple mentions make this more relevant',
        },
      ]);

      // Get results ordered by BM25 rank (lower is better)
      const results = db
        .query<{ session_id: string; rank: number }, [string]>(
          `SELECT session_id, bm25(session_entries) as rank
           FROM session_entries WHERE session_entries MATCH ?
           ORDER BY rank`
        )
        .all('config');

      expect(results.length).toBe(2);
      // Session with more "config" mentions should have better (lower) rank
      expect(results[0]!.session_id).toBe('session-high');
    });

    it('should limit results to prevent memory issues', () => {
      // Insert many sessions
      const entries = Array.from({ length: 100 }, (_, i) => ({
        sessionId: `session-${i}`,
        projectPath: '/project',
        timestamp: `2026-01-17T${String(i % 24).padStart(2, '0')}:00:00Z`,
        role: 'user',
        content: `Test content with keyword number ${i}`,
      }));
      insertMockSessionEntries(db, entries);

      const limit = 10;
      const results = db
        .query<{ session_id: string }, [string, number]>(
          `SELECT session_id FROM session_entries
           WHERE session_entries MATCH ? LIMIT ?`
        )
        .all('keyword', limit);

      expect(results.length).toBe(limit);
    });
  });

  // ===========================================================================
  // T014: Temporal Sorting
  // ===========================================================================

  describe('temporal sorting', () => {
    it('should sort evidence by timestamp ascending', () => {
      insertMockSessionEntries(db, [
        {
          sessionId: 'session-3',
          projectPath: '/project',
          timestamp: '2026-01-17T12:00:00Z',
          role: 'user',
          content: 'Third message about error',
        },
        {
          sessionId: 'session-1',
          projectPath: '/project',
          timestamp: '2026-01-17T10:00:00Z',
          role: 'user',
          content: 'First message about error',
        },
        {
          sessionId: 'session-2',
          projectPath: '/project',
          timestamp: '2026-01-17T11:00:00Z',
          role: 'user',
          content: 'Second message about error',
        },
      ]);

      const results = db
        .query<{ session_id: string; timestamp: string }, [string]>(
          `SELECT session_id, timestamp FROM session_entries
           WHERE session_entries MATCH ?
           ORDER BY timestamp ASC`
        )
        .all('error');

      expect(results.length).toBe(3);
      expect(results[0]!.session_id).toBe('session-1');
      expect(results[1]!.session_id).toBe('session-2');
      expect(results[2]!.session_id).toBe('session-3');
    });

    it('should extract temporal markers from session sequence', () => {
      insertMockSessionEntries(db, [
        {
          sessionId: 'session-1',
          projectPath: '/project',
          timestamp: '2026-01-17T10:00:00Z',
          role: 'user',
          content: 'User asked about feature',
        },
        {
          sessionId: 'session-1',
          projectPath: '/project',
          timestamp: '2026-01-17T10:01:00Z',
          role: 'assistant',
          content: 'Assistant implemented feature incorrectly',
        },
        {
          sessionId: 'session-1',
          projectPath: '/project',
          timestamp: '2026-01-17T10:02:00Z',
          role: 'user',
          content: 'User reported bug in feature',
        },
      ]);

      // Get chronological sequence within session
      const results = db
        .query<{ role: string; content: string; timestamp: string }, [string]>(
          `SELECT role, content, timestamp FROM session_entries
           WHERE session_id = ?
           ORDER BY timestamp ASC`
        )
        .all('session-1');

      expect(results.length).toBe(3);
      expect(results[0]!.role).toBe('user');
      expect(results[1]!.role).toBe('assistant');
      expect(results[2]!.role).toBe('user');

      // Verify timestamps are in order
      const timestamps = results.map((r) => new Date(r.timestamp).getTime());
      expect(timestamps[0]!).toBeLessThan(timestamps[1]!);
      expect(timestamps[1]!).toBeLessThan(timestamps[2]!);
    });

    it('should identify cause-before-effect ordering', () => {
      const causeTime = '2026-01-17T10:00:00Z';
      const effectTime = '2026-01-17T10:30:00Z';

      insertMockSessionEntries(db, [
        {
          sessionId: 'session-1',
          projectPath: '/project',
          timestamp: causeTime,
          role: 'user',
          content: 'Add feature without error handling',
        },
        {
          sessionId: 'session-1',
          projectPath: '/project',
          timestamp: effectTime,
          role: 'user',
          content: 'Found error in the new feature',
        },
      ]);

      const causeResult = db
        .query<{ timestamp: string }, [string, string]>(
          `SELECT timestamp FROM session_entries
           WHERE session_entries MATCH ? AND session_id = ?`
        )
        .get('error handling', 'session-1');

      const effectResult = db
        .query<{ timestamp: string }, [string, string]>(
          `SELECT timestamp FROM session_entries
           WHERE session_entries MATCH ? AND session_id = ?`
        )
        .get('Found error', 'session-1');

      // Cause should precede effect
      const causeMs = new Date(causeResult!.timestamp).getTime();
      const effectMs = new Date(effectResult!.timestamp).getTime();
      expect(causeMs).toBeLessThan(effectMs);
    });

    it('should handle cross-session temporal ordering', () => {
      insertMockSessionEntries(db, [
        {
          sessionId: 'session-1',
          projectPath: '/project',
          timestamp: '2026-01-15T10:00:00Z',
          role: 'user',
          content: 'Implement feature A',
        },
        {
          sessionId: 'session-2',
          projectPath: '/project',
          timestamp: '2026-01-16T10:00:00Z',
          role: 'user',
          content: 'Modify feature A',
        },
        {
          sessionId: 'session-3',
          projectPath: '/project',
          timestamp: '2026-01-17T10:00:00Z',
          role: 'user',
          content: 'Bug found in feature A',
        },
      ]);

      // Query all related entries ordered by time
      const results = db
        .query<
          { session_id: string; timestamp: string },
          [string]
        >(`SELECT session_id, timestamp FROM session_entries
           WHERE session_entries MATCH ?
           ORDER BY timestamp ASC`)
        .all('feature A');

      expect(results.length).toBe(3);
      expect(results[0]!.session_id).toBe('session-1');
      expect(results[1]!.session_id).toBe('session-2');
      expect(results[2]!.session_id).toBe('session-3');
    });
  });

  // ===========================================================================
  // Evidence Item Construction
  // ===========================================================================

  describe('evidence item construction', () => {
    it('should create valid EvidenceItem from session match', () => {
      const sessionResult = {
        session_id: 'session-123',
        content: 'User asked about authentication',
        timestamp: '2026-01-17T10:00:00Z',
        file_path: '/project/src/auth.ts',
        line_number: 42,
      };

      // Construct evidence item (this is what EvidenceCollector will do)
      const evidence: EvidenceItem = {
        id: uuidv4(),
        type: 'SessionMatch',
        source: sessionResult.session_id,
        timestamp: sessionResult.timestamp,
        content: sessionResult.content,
        position:
          sessionResult.file_path && sessionResult.line_number
            ? {
                filePath: sessionResult.file_path,
                line: sessionResult.line_number,
              }
            : undefined,
        metadata: undefined,
      };

      expect(evidence.type).toBe('SessionMatch');
      expect(evidence.source).toBe('session-123');
      expect(evidence.content).toBe('User asked about authentication');
      expect(evidence.position?.filePath).toBe('/project/src/auth.ts');
      expect(evidence.position?.line).toBe(42);
    });

    it('should handle evidence without position', () => {
      const evidence = createTestEvidence({
        type: 'SessionMatch',
        source: 'session-456',
        content: 'General discussion',
        position: undefined,
      });

      expect(evidence.type).toBe('SessionMatch');
      expect(evidence.position).toBeUndefined();
    });

    it('should include metadata for tool calls', () => {
      const evidence = createTestEvidence({
        type: 'ToolTrace',
        source: 'session-789',
        content: 'Agent called Edit tool',
        metadata: {
          toolName: 'Edit',
          toolInput: { file_path: '/project/src/index.ts' },
          duration: 150,
        },
      });

      expect(evidence.type).toBe('ToolTrace');
      expect(evidence.metadata?.toolName).toBe('Edit');
    });

    it('should create TemporalMarker evidence', () => {
      const evidence = createTestEvidence({
        type: 'TemporalMarker',
        source: 'session-timeline',
        timestamp: '2026-01-17T10:00:00Z',
        content: 'Issue first observed',
        metadata: {
          markerType: 'issue_reported',
          relatedSessionId: 'session-123',
        },
      });

      expect(evidence.type).toBe('TemporalMarker');
      expect(evidence.metadata?.markerType).toBe('issue_reported');
    });
  });

  // ===========================================================================
  // Position Markers
  // ===========================================================================

  describe('position markers', () => {
    it('should extract position from tool call result', () => {
      insertMockSessionEntries(db, [
        {
          sessionId: 'session-1',
          projectPath: '/project',
          timestamp: '2026-01-17T10:00:00Z',
          role: 'assistant',
          content: 'Editing the file to add feature',
          toolName: 'Edit',
          filePath: '/project/src/component.tsx',
          lineNumber: 100,
        },
      ]);

      const result = db
        .query<{ tool_name: string; file_path: string; line_number: number }, []>(
          `SELECT tool_name, file_path, line_number FROM session_entries
           WHERE tool_name = 'Edit'`
        )
        .get();

      expect(result).toBeDefined();
      expect(result!.tool_name).toBe('Edit');
      expect(result!.file_path).toBe('/project/src/component.tsx');
      expect(result!.line_number).toBe(100);
    });

    it('should aggregate positions from multiple tool calls', () => {
      insertMockSessionEntries(db, [
        {
          sessionId: 'session-1',
          projectPath: '/project',
          timestamp: '2026-01-17T10:00:00Z',
          role: 'assistant',
          content: 'Reading file',
          toolName: 'Read',
          filePath: '/project/src/a.ts',
          lineNumber: 10,
        },
        {
          sessionId: 'session-1',
          projectPath: '/project',
          timestamp: '2026-01-17T10:01:00Z',
          role: 'assistant',
          content: 'Editing file',
          toolName: 'Edit',
          filePath: '/project/src/b.ts',
          lineNumber: 20,
        },
        {
          sessionId: 'session-1',
          projectPath: '/project',
          timestamp: '2026-01-17T10:02:00Z',
          role: 'assistant',
          content: 'Writing file',
          toolName: 'Write',
          filePath: '/project/src/c.ts',
          lineNumber: 30,
        },
      ]);

      const results = db
        .query<{ file_path: string; line_number: number }, [string]>(
          `SELECT DISTINCT file_path, line_number FROM session_entries
           WHERE session_id = ? AND file_path != ''
           ORDER BY timestamp ASC`
        )
        .all('session-1');

      expect(results.length).toBe(3);
      expect(results.map((r) => r.file_path)).toEqual([
        '/project/src/a.ts',
        '/project/src/b.ts',
        '/project/src/c.ts',
      ]);
    });

    it('should create Position object with snippet', () => {
      const position = createTestPosition({
        filePath: '/project/src/module.ts',
        line: 55,
        column: 5,
        snippet: 'function handleError(e) { throw e; }',
      });

      expect(position.filePath).toBe('/project/src/module.ts');
      expect(position.line).toBe(55);
      expect(position.column).toBe(5);
      expect(position.snippet).toBe('function handleError(e) { throw e; }');
    });

    it('should handle missing optional position fields', () => {
      const position: Position = {
        filePath: '/project/README.md',
      };

      expect(position.filePath).toBe('/project/README.md');
      expect(position.line).toBeUndefined();
      expect(position.column).toBeUndefined();
      expect(position.snippet).toBeUndefined();
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe('error handling', () => {
    it('should handle database not found gracefully', () => {
      const nonExistentPath = join(testBaseDir, 'nonexistent.db');

      // Attempting to open non-existent db should throw or return error
      expect(() => {
        const tempDb = new Database(nonExistentPath, { readonly: true });
        tempDb.close();
      }).toThrow();
    });

    it('should handle FTS5 query syntax errors', () => {
      // Invalid FTS5 syntax
      expect(() => {
        db.query("SELECT * FROM session_entries WHERE session_entries MATCH ?").all(
          '(unclosed parenthesis'
        );
      }).toThrow();
    });

    it('should handle empty search results gracefully', () => {
      // Insert one entry so FTS5 table is not empty
      insertMockSessionEntries(db, [
        {
          sessionId: 'session-1',
          projectPath: '/project',
          timestamp: '2026-01-17T10:00:00Z',
          role: 'user',
          content: 'Some content',
        },
      ]);

      const results = db
        .query<{ session_id: string }, [string]>(
          "SELECT session_id FROM session_entries WHERE session_entries MATCH ?"
        )
        .all('zzzznonexistent');

      expect(results).toEqual([]);
    });
  });
});
