/**
 * Integration tests for session intelligence storage
 *
 * Tests database initialization, schema creation, and query operations
 * using a real SQLite database (not mocked).
 *
 * @module tests/integration/sessions/storage.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { existsSync } from 'node:fs';

import {
  // Schema functions
  initSessionIntelligenceSchema,
  sessionIntelligenceSchemaExists,
  getSessionIntelligenceSchemaVersion,
  dropSessionIntelligenceSchema,
  SESSION_INTELLIGENCE_SCHEMA_VERSION,
  SESSION_INTELLIGENCE_TABLES,
  deleteSessionIntelligenceData,
  // Query functions
  insertToolCall,
  queryToolCalls,
  countToolCalls,
  findToolRepeatPatterns,
  insertFileAccess,
  queryFileAccesses,
  getFileAccessSummary,
  insertCompressionEvent,
  queryCompressionEvents,
  insertDelegationEvent,
  queryDelegationEvents,
  insertMcpToolCall,
  queryMcpToolCalls,
  getMcpServerUsage,
  insertQualitySignal,
  queryQualitySignals,
  countQualitySignalsByType,
} from '../../../src/sessions/storage';

// Test paths
const TEST_DB_DIR = path.join(__dirname, '../.temp');
const TEST_DB_PATH = path.join(TEST_DB_DIR, 'session-intelligence-integration.db');

describe('Session Intelligence Storage Integration', () => {
  let db: Database;

  beforeAll(async () => {
    // Ensure temp directory exists
    await fs.mkdir(TEST_DB_DIR, { recursive: true });

    // Clean up old test database files
    for (const suffix of ['', '-wal', '-shm']) {
      const dbFile = `${TEST_DB_PATH}${suffix}`;
      if (existsSync(dbFile)) {
        await fs.unlink(dbFile);
      }
    }
  });

  afterAll(async () => {
    // Close database connection
    if (db) {
      db.close();
    }

    // Clean up test database files
    for (const suffix of ['', '-wal', '-shm']) {
      const dbFile = `${TEST_DB_PATH}${suffix}`;
      if (existsSync(dbFile)) {
        await fs.unlink(dbFile);
      }
    }
  });

  describe('Database Initialization', () => {
    beforeEach(() => {
      // Create fresh database for each test
      if (db) {
        db.close();
      }

      // Remove existing database files
      for (const suffix of ['', '-wal', '-shm']) {
        const dbFile = `${TEST_DB_PATH}${suffix}`;
        if (existsSync(dbFile)) {
          require('node:fs').unlinkSync(dbFile);
        }
      }

      db = new Database(TEST_DB_PATH);
      db.exec('PRAGMA journal_mode = WAL;');
      db.exec('PRAGMA foreign_keys = ON;');

      // Create base sessions table (simulating existing sessions.db)
      db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          session_id TEXT PRIMARY KEY,
          project_path TEXT NOT NULL,
          first_timestamp TEXT,
          last_timestamp TEXT
        );
      `);
    });

    it('should initialize schema on fresh database', () => {
      expect(sessionIntelligenceSchemaExists(db)).toBe(false);

      const result = initSessionIntelligenceSchema(db);

      expect(result.created).toBe(true);
      expect(result.migrated).toBe(false);
      expect(result.version).toBe(SESSION_INTELLIGENCE_SCHEMA_VERSION);
      expect(sessionIntelligenceSchemaExists(db)).toBe(true);
    });

    it('should create all required tables', () => {
      initSessionIntelligenceSchema(db);

      const tables = db
        .query<{ name: string }, []>(
          "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        .all()
        .map((r) => r.name);

      for (const expectedTable of SESSION_INTELLIGENCE_TABLES) {
        expect(tables).toContain(expectedTable);
      }
    });

    it('should be idempotent - calling twice is safe', () => {
      const result1 = initSessionIntelligenceSchema(db);
      expect(result1.created).toBe(true);

      const result2 = initSessionIntelligenceSchema(db);
      expect(result2.created).toBe(false);
      expect(result2.migrated).toBe(false);
      expect(result2.version).toBe(SESSION_INTELLIGENCE_SCHEMA_VERSION);
    });

    it('should track schema version correctly', () => {
      expect(getSessionIntelligenceSchemaVersion(db)).toBe(0);

      initSessionIntelligenceSchema(db);

      expect(getSessionIntelligenceSchemaVersion(db)).toBe(SESSION_INTELLIGENCE_SCHEMA_VERSION);
    });

    it('should support drop and recreate', () => {
      initSessionIntelligenceSchema(db);
      expect(sessionIntelligenceSchemaExists(db)).toBe(true);

      dropSessionIntelligenceSchema(db);
      expect(sessionIntelligenceSchemaExists(db)).toBe(false);

      const result = initSessionIntelligenceSchema(db);
      expect(result.created).toBe(true);
      expect(sessionIntelligenceSchemaExists(db)).toBe(true);
    });
  });

  describe('Query Operations Workflow', () => {
    const SESSION_ID = 'integration-test-session-001';

    beforeEach(() => {
      // Create fresh database
      if (db) {
        db.close();
      }

      for (const suffix of ['', '-wal', '-shm']) {
        const dbFile = `${TEST_DB_PATH}${suffix}`;
        if (existsSync(dbFile)) {
          require('node:fs').unlinkSync(dbFile);
        }
      }

      db = new Database(TEST_DB_PATH);
      db.exec('PRAGMA journal_mode = WAL;');
      db.exec('PRAGMA foreign_keys = ON;');

      // Create base sessions table and initialize schema
      db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          session_id TEXT PRIMARY KEY,
          project_path TEXT NOT NULL,
          first_timestamp TEXT,
          last_timestamp TEXT
        );
      `);

      initSessionIntelligenceSchema(db);

      // Insert test session
      db.run(`INSERT INTO sessions (session_id, project_path) VALUES (?, '/test/project')`, [
        SESSION_ID,
      ]);
    });

    it('should support full tool call workflow', () => {
      // Insert tool calls
      const id1 = insertToolCall(db, {
        sessionId: SESSION_ID,
        toolName: 'Read',
        inputHash: 'hash-abc',
        timestamp: '2026-01-24T00:00:00Z',
        sequenceIndex: 0,
        isError: false,
      });

      const id2 = insertToolCall(db, {
        sessionId: SESSION_ID,
        toolName: 'Read',
        inputHash: 'hash-abc', // Same hash - repeat pattern
        timestamp: '2026-01-24T00:00:01Z',
        sequenceIndex: 1,
        isError: false,
      });

      const id3 = insertToolCall(db, {
        sessionId: SESSION_ID,
        toolName: 'Write',
        inputHash: 'hash-xyz',
        timestamp: '2026-01-24T00:00:02Z',
        sequenceIndex: 2,
        isError: true,
        errorMessage: 'Permission denied',
      });

      expect(id1).toBeGreaterThan(0);
      expect(id2).toBeGreaterThan(0);
      expect(id3).toBeGreaterThan(0);

      // Query all
      const allCalls = queryToolCalls(db, { sessionId: SESSION_ID });
      expect(allCalls.length).toBe(3);

      // Count
      expect(countToolCalls(db, { sessionId: SESSION_ID })).toBe(3);
      expect(countToolCalls(db, { sessionId: SESSION_ID, errorsOnly: true })).toBe(1);

      // Find repeat patterns
      const patterns = findToolRepeatPatterns(db, SESSION_ID);
      expect(patterns.length).toBe(1);
      expect(patterns[0]?.toolName).toBe('Read');
      expect(patterns[0]?.repeatCount).toBe(2);
    });

    it('should support full file access workflow', () => {
      // Insert file accesses
      insertFileAccess(db, {
        sessionId: SESSION_ID,
        filePath: '/src/index.ts',
        operation: 'read',
        timestamp: '2026-01-24T00:00:00Z',
        accessSequence: 0,
      });

      insertFileAccess(db, {
        sessionId: SESSION_ID,
        filePath: '/src/index.ts',
        operation: 'edit',
        timestamp: '2026-01-24T00:00:01Z',
        accessSequence: 1,
      });

      insertFileAccess(db, {
        sessionId: SESSION_ID,
        filePath: '/src/utils.ts',
        operation: 'read',
        timestamp: '2026-01-24T00:00:02Z',
        accessSequence: 2,
      });

      // Query
      const accesses = queryFileAccesses(db, { sessionId: SESSION_ID });
      expect(accesses.length).toBe(3);

      // Summary
      const summary = getFileAccessSummary(db, SESSION_ID);
      expect(summary.length).toBe(2);
      expect(summary[0]?.filePath).toBe('/src/index.ts');
      expect(summary[0]?.totalAccesses).toBe(2);
    });

    it('should support compression event tracking', () => {
      insertCompressionEvent(db, {
        sessionId: SESSION_ID,
        timestamp: '2026-01-24T00:30:00Z',
        compressionType: 'compact',
        preTokens: 150000,
        tokensSaved: 50000,
      });

      insertCompressionEvent(db, {
        sessionId: SESSION_ID,
        timestamp: '2026-01-24T01:00:00Z',
        compressionType: 'microcompact',
        preTokens: 120000,
        tokensSaved: 20000,
      });

      const events = queryCompressionEvents(db, { sessionId: SESSION_ID });
      expect(events.length).toBe(2);
      expect(events[0]?.compressionType).toBe('compact');
      expect(events[1]?.compressionType).toBe('microcompact');
    });

    it('should support delegation event tracking', () => {
      insertDelegationEvent(db, {
        sessionId: SESSION_ID,
        subagentType: 'Explore',
        taskPrompt: 'Find all TypeScript files',
        timestamp: '2026-01-24T00:10:00Z',
        turnIndex: 5,
        success: true,
      });

      insertDelegationEvent(db, {
        sessionId: SESSION_ID,
        subagentType: 'Bash',
        taskPrompt: 'Run tests',
        timestamp: '2026-01-24T00:20:00Z',
        turnIndex: 10,
        success: false,
      });

      const delegations = queryDelegationEvents(db, { sessionId: SESSION_ID });
      expect(delegations.length).toBe(2);

      const exploreDelegations = queryDelegationEvents(db, {
        sessionId: SESSION_ID,
        subagentType: 'Explore',
      });
      expect(exploreDelegations.length).toBe(1);
    });

    it('should support MCP tool call tracking with usage summary', () => {
      // Insert MCP calls for multiple servers
      insertMcpToolCall(db, {
        sessionId: SESSION_ID,
        serverName: 'linear',
        toolName: 'list_issues',
        timestamp: '2026-01-24T00:00:00Z',
        isError: false,
      });

      insertMcpToolCall(db, {
        sessionId: SESSION_ID,
        serverName: 'linear',
        toolName: 'create_issue',
        timestamp: '2026-01-24T00:00:01Z',
        isError: true,
        errorMessage: 'Validation error',
      });

      insertMcpToolCall(db, {
        sessionId: SESSION_ID,
        serverName: 'github',
        toolName: 'create_pr',
        timestamp: '2026-01-24T00:00:02Z',
        isError: false,
      });

      // Query
      const calls = queryMcpToolCalls(db, { sessionId: SESSION_ID });
      expect(calls.length).toBe(3);

      // Usage summary
      const usage = getMcpServerUsage(db, SESSION_ID);
      expect(usage.length).toBe(2);

      const linearUsage = usage.find((u) => u.serverName === 'linear');
      expect(linearUsage?.callCount).toBe(2);
      expect(linearUsage?.errorCount).toBe(1);
      expect(linearUsage?.errorRate).toBeCloseTo(0.5, 2);
    });

    it('should support quality signal tracking', () => {
      insertQualitySignal(db, {
        sessionId: SESSION_ID,
        signalType: 'test',
        timestamp: '2026-01-24T00:00:00Z',
        passed: true,
        rawOutput: 'All 42 tests passed',
      });

      insertQualitySignal(db, {
        sessionId: SESSION_ID,
        signalType: 'test',
        timestamp: '2026-01-24T00:01:00Z',
        passed: false,
        rawOutput: 'Error: expected 1 but got 2',
      });

      insertQualitySignal(db, {
        sessionId: SESSION_ID,
        signalType: 'build',
        timestamp: '2026-01-24T00:02:00Z',
        passed: true,
      });

      // Query
      const signals = queryQualitySignals(db, { sessionId: SESSION_ID });
      expect(signals.length).toBe(3);

      // Count by type
      const counts = countQualitySignalsByType(db, SESSION_ID);
      expect(counts.test.total).toBe(2);
      expect(counts.test.passed).toBe(1);
      expect(counts.test.failed).toBe(1);
      expect(counts.build.total).toBe(1);
      expect(counts.build.passed).toBe(1);
    });
  });

  describe('Data Isolation', () => {
    const SESSION_1 = 'session-isolation-001';
    const SESSION_2 = 'session-isolation-002';

    beforeEach(() => {
      // Create fresh database
      if (db) {
        db.close();
      }

      for (const suffix of ['', '-wal', '-shm']) {
        const dbFile = `${TEST_DB_PATH}${suffix}`;
        if (existsSync(dbFile)) {
          require('node:fs').unlinkSync(dbFile);
        }
      }

      db = new Database(TEST_DB_PATH);
      db.exec('PRAGMA journal_mode = WAL;');
      db.exec('PRAGMA foreign_keys = ON;');

      db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          session_id TEXT PRIMARY KEY,
          project_path TEXT NOT NULL,
          first_timestamp TEXT,
          last_timestamp TEXT
        );
      `);

      initSessionIntelligenceSchema(db);

      // Insert two test sessions
      db.run(`INSERT INTO sessions (session_id, project_path) VALUES (?, '/path1')`, [SESSION_1]);
      db.run(`INSERT INTO sessions (session_id, project_path) VALUES (?, '/path2')`, [SESSION_2]);
    });

    it('should isolate data between sessions', () => {
      // Insert data for session 1
      insertToolCall(db, {
        sessionId: SESSION_1,
        toolName: 'Read',
        inputHash: 'hash1',
        timestamp: '2026-01-24T00:00:00Z',
        sequenceIndex: 0,
        isError: false,
      });

      insertToolCall(db, {
        sessionId: SESSION_1,
        toolName: 'Write',
        inputHash: 'hash2',
        timestamp: '2026-01-24T00:00:01Z',
        sequenceIndex: 1,
        isError: false,
      });

      // Insert data for session 2
      insertToolCall(db, {
        sessionId: SESSION_2,
        toolName: 'Bash',
        inputHash: 'hash3',
        timestamp: '2026-01-24T00:00:02Z',
        sequenceIndex: 0,
        isError: false,
      });

      // Verify isolation
      const session1Calls = queryToolCalls(db, { sessionId: SESSION_1 });
      expect(session1Calls.length).toBe(2);
      expect(session1Calls.every((c) => c.sessionId === SESSION_1)).toBe(true);

      const session2Calls = queryToolCalls(db, { sessionId: SESSION_2 });
      expect(session2Calls.length).toBe(1);
      expect(session2Calls[0]?.toolName).toBe('Bash');
    });

    it('should delete only specified session data', () => {
      // Insert data for both sessions
      insertToolCall(db, {
        sessionId: SESSION_1,
        toolName: 'Read',
        inputHash: 'hash1',
        timestamp: '2026-01-24T00:00:00Z',
        sequenceIndex: 0,
        isError: false,
      });

      insertToolCall(db, {
        sessionId: SESSION_2,
        toolName: 'Write',
        inputHash: 'hash2',
        timestamp: '2026-01-24T00:00:01Z',
        sequenceIndex: 0,
        isError: false,
      });

      // Delete session 1 data
      deleteSessionIntelligenceData(db, SESSION_1);

      // Verify
      expect(countToolCalls(db, { sessionId: SESSION_1 })).toBe(0);
      expect(countToolCalls(db, { sessionId: SESSION_2 })).toBe(1);
    });
  });

  describe('Foreign Key Constraints', () => {
    const SESSION_ID = 'fk-test-session';

    beforeEach(() => {
      // Create fresh database
      if (db) {
        db.close();
      }

      for (const suffix of ['', '-wal', '-shm']) {
        const dbFile = `${TEST_DB_PATH}${suffix}`;
        if (existsSync(dbFile)) {
          require('node:fs').unlinkSync(dbFile);
        }
      }

      db = new Database(TEST_DB_PATH);
      db.exec('PRAGMA journal_mode = WAL;');
      db.exec('PRAGMA foreign_keys = ON;');

      db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          session_id TEXT PRIMARY KEY,
          project_path TEXT NOT NULL,
          first_timestamp TEXT,
          last_timestamp TEXT
        );
      `);

      initSessionIntelligenceSchema(db);

      db.run(`INSERT INTO sessions (session_id, project_path) VALUES (?, '/path')`, [SESSION_ID]);
    });

    it('should cascade delete when parent session is deleted', () => {
      // Insert data
      insertToolCall(db, {
        sessionId: SESSION_ID,
        toolName: 'Read',
        inputHash: 'hash1',
        timestamp: '2026-01-24T00:00:00Z',
        sequenceIndex: 0,
        isError: false,
      });

      insertFileAccess(db, {
        sessionId: SESSION_ID,
        filePath: '/src/index.ts',
        operation: 'read',
        timestamp: '2026-01-24T00:00:00Z',
        accessSequence: 0,
      });

      insertQualitySignal(db, {
        sessionId: SESSION_ID,
        signalType: 'test',
        timestamp: '2026-01-24T00:00:00Z',
        passed: true,
      });

      // Verify data exists
      expect(countToolCalls(db, { sessionId: SESSION_ID })).toBe(1);

      // Delete parent session
      db.run(`DELETE FROM sessions WHERE session_id = ?`, [SESSION_ID]);

      // Verify cascade delete
      expect(countToolCalls(db, { sessionId: SESSION_ID })).toBe(0);
      expect(queryFileAccesses(db, { sessionId: SESSION_ID }).length).toBe(0);
      expect(queryQualitySignals(db, { sessionId: SESSION_ID }).length).toBe(0);
    });
  });
});
