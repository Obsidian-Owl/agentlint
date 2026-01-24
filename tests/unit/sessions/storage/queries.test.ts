/**
 * Unit tests for sessions/storage/queries.ts
 *
 * Tests query helper functions for session intelligence data.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { initializeSessionIntelligenceSchema } from '../../../../src/sessions/storage/schema';

import {
  // Tool calls
  insertToolCall,
  queryToolCalls,
  countToolCalls,
  findToolRepeatPatterns,
  insertToolCallsBatch,
  // File accesses
  insertFileAccess,
  queryFileAccesses,
  countFileAccesses,
  getFileAccessSummary,
  insertFileAccessesBatch,
  // Compression events
  insertCompressionEvent,
  queryCompressionEvents,
  countCompressionEvents,
  // Delegation events
  insertDelegationEvent,
  queryDelegationEvents,
  countDelegationEvents,
  // MCP tool calls
  insertMcpToolCall,
  queryMcpToolCalls,
  getMcpServerUsage,
  // Quality signals
  insertQualitySignal,
  queryQualitySignals,
  countQualitySignalsByType,
} from '../../../../src/sessions/storage/queries';

describe('sessions/storage/queries', () => {
  const testBaseDir = join(tmpdir(), 'agentlint-test-session-intelligence-queries');
  let db: Database;
  let dbPath: string;
  const SESSION_ID = 'test-session-123';
  const SESSION_ID_2 = 'test-session-456';

  beforeEach(() => {
    // Clean up test directory
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true });
    }
    mkdirSync(testBaseDir, { recursive: true });

    // Create a fresh database with sessions table (simulating sessions.db)
    dbPath = join(testBaseDir, 'sessions.db');
    db = new Database(dbPath);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');

    // Create the base sessions table that EP15 tables reference
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        project_path TEXT NOT NULL,
        first_timestamp TEXT,
        last_timestamp TEXT
      );
    `);

    // Initialize EP15 schema
    initializeSessionIntelligenceSchema(db);

    // Insert test sessions
    db.run(`INSERT INTO sessions (session_id, project_path) VALUES (?, '/path')`, [SESSION_ID]);
    db.run(`INSERT INTO sessions (session_id, project_path) VALUES (?, '/path2')`, [SESSION_ID_2]);
  });

  afterEach(() => {
    db.close();
    // Clean up test directory
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true });
    }
  });

  // ==========================================================================
  // Tool Call Sequences
  // ==========================================================================

  describe('insertToolCall', () => {
    it('should insert a tool call record and return the ID', () => {
      const id = insertToolCall(db, {
        sessionId: SESSION_ID,
        toolName: 'Read',
        inputHash: 'abc123',
        timestamp: '2026-01-24T00:00:00Z',
        sequenceIndex: 0,
        isError: false,
      });

      expect(id).toBeGreaterThan(0);
    });

    it('should insert record with optional fields', () => {
      const id = insertToolCall(db, {
        sessionId: SESSION_ID,
        toolName: 'Bash',
        inputHash: 'def456',
        timestamp: '2026-01-24T00:00:01Z',
        sequenceIndex: 1,
        isError: true,
        errorMessage: 'Command failed',
        filePath: '/src/index.ts',
        lineNumber: 42,
      });

      expect(id).toBeGreaterThan(0);

      // Verify data was stored correctly
      const result = queryToolCalls(db, { sessionId: SESSION_ID });
      const record = result.find((r) => r.id === id);

      expect(record).toBeDefined();
      expect(record!.errorMessage).toBe('Command failed');
      expect(record!.filePath).toBe('/src/index.ts');
      expect(record!.lineNumber).toBe(42);
    });
  });

  describe('queryToolCalls', () => {
    beforeEach(() => {
      // Insert test data
      insertToolCall(db, {
        sessionId: SESSION_ID,
        toolName: 'Read',
        inputHash: 'hash1',
        timestamp: '2026-01-24T00:00:00Z',
        sequenceIndex: 0,
        isError: false,
      });
      insertToolCall(db, {
        sessionId: SESSION_ID,
        toolName: 'Write',
        inputHash: 'hash2',
        timestamp: '2026-01-24T00:00:01Z',
        sequenceIndex: 1,
        isError: false,
      });
      insertToolCall(db, {
        sessionId: SESSION_ID,
        toolName: 'Bash',
        inputHash: 'hash3',
        timestamp: '2026-01-24T00:00:02Z',
        sequenceIndex: 2,
        isError: true,
        errorMessage: 'Error occurred',
      });
      insertToolCall(db, {
        sessionId: SESSION_ID_2,
        toolName: 'Read',
        inputHash: 'hash4',
        timestamp: '2026-01-24T00:00:03Z',
        sequenceIndex: 0,
        isError: false,
      });
    });

    it('should return tool calls for a session', () => {
      const results = queryToolCalls(db, { sessionId: SESSION_ID });

      expect(results.length).toBe(3);
      expect(results[0]?.toolName).toBe('Read');
      expect(results[1]?.toolName).toBe('Write');
      expect(results[2]?.toolName).toBe('Bash');
    });

    it('should filter by tool name', () => {
      const results = queryToolCalls(db, { sessionId: SESSION_ID, toolName: 'Read' });

      expect(results.length).toBe(1);
      expect(results[0]?.toolName).toBe('Read');
    });

    it('should filter by errors only', () => {
      const results = queryToolCalls(db, { sessionId: SESSION_ID, errorsOnly: true });

      expect(results.length).toBe(1);
      expect(results[0]?.isError).toBe(true);
      expect(results[0]?.errorMessage).toBe('Error occurred');
    });

    it('should respect limit', () => {
      const results = queryToolCalls(db, { sessionId: SESSION_ID, limit: 2 });

      expect(results.length).toBe(2);
    });

    it('should respect offset', () => {
      const results = queryToolCalls(db, { sessionId: SESSION_ID, limit: 2, offset: 1 });

      expect(results.length).toBe(2);
      expect(results[0]?.toolName).toBe('Write');
    });

    it('should order by sequence_index ASC', () => {
      const results = queryToolCalls(db, { sessionId: SESSION_ID });

      expect(results[0]?.sequenceIndex).toBe(0);
      expect(results[1]?.sequenceIndex).toBe(1);
      expect(results[2]?.sequenceIndex).toBe(2);
    });

    it('should not include optional fields when null', () => {
      const results = queryToolCalls(db, { sessionId: SESSION_ID });
      const readCall = results[0];

      expect(readCall).toBeDefined();
      expect(readCall!.errorMessage).toBeUndefined();
      expect(readCall!.filePath).toBeUndefined();
      expect(readCall!.lineNumber).toBeUndefined();
    });
  });

  describe('countToolCalls', () => {
    beforeEach(() => {
      insertToolCall(db, {
        sessionId: SESSION_ID,
        toolName: 'Read',
        inputHash: 'hash1',
        timestamp: '2026-01-24T00:00:00Z',
        sequenceIndex: 0,
        isError: false,
      });
      insertToolCall(db, {
        sessionId: SESSION_ID,
        toolName: 'Read',
        inputHash: 'hash2',
        timestamp: '2026-01-24T00:00:01Z',
        sequenceIndex: 1,
        isError: true,
      });
      insertToolCall(db, {
        sessionId: SESSION_ID,
        toolName: 'Write',
        inputHash: 'hash3',
        timestamp: '2026-01-24T00:00:02Z',
        sequenceIndex: 2,
        isError: false,
      });
    });

    it('should count all tool calls for session', () => {
      const count = countToolCalls(db, { sessionId: SESSION_ID });
      expect(count).toBe(3);
    });

    it('should count by tool name', () => {
      const count = countToolCalls(db, { sessionId: SESSION_ID, toolName: 'Read' });
      expect(count).toBe(2);
    });

    it('should count errors only', () => {
      const count = countToolCalls(db, { sessionId: SESSION_ID, errorsOnly: true });
      expect(count).toBe(1);
    });

    it('should return 0 for empty session', () => {
      const count = countToolCalls(db, { sessionId: 'non-existent' });
      expect(count).toBe(0);
    });
  });

  describe('findToolRepeatPatterns', () => {
    beforeEach(() => {
      // Insert repeated Read calls with same hash (stuck pattern)
      insertToolCall(db, {
        sessionId: SESSION_ID,
        toolName: 'Read',
        inputHash: 'same-hash',
        timestamp: '2026-01-24T00:00:00Z',
        sequenceIndex: 0,
        isError: false,
      });
      insertToolCall(db, {
        sessionId: SESSION_ID,
        toolName: 'Read',
        inputHash: 'same-hash',
        timestamp: '2026-01-24T00:00:01Z',
        sequenceIndex: 2,
        isError: false,
      });
      insertToolCall(db, {
        sessionId: SESSION_ID,
        toolName: 'Read',
        inputHash: 'same-hash',
        timestamp: '2026-01-24T00:00:02Z',
        sequenceIndex: 5,
        isError: false,
      });
      // Insert unique call
      insertToolCall(db, {
        sessionId: SESSION_ID,
        toolName: 'Write',
        inputHash: 'unique-hash',
        timestamp: '2026-01-24T00:00:03Z',
        sequenceIndex: 1,
        isError: false,
      });
      // Insert another repeated pattern
      insertToolCall(db, {
        sessionId: SESSION_ID,
        toolName: 'Bash',
        inputHash: 'bash-hash',
        timestamp: '2026-01-24T00:00:04Z',
        sequenceIndex: 3,
        isError: false,
      });
      insertToolCall(db, {
        sessionId: SESSION_ID,
        toolName: 'Bash',
        inputHash: 'bash-hash',
        timestamp: '2026-01-24T00:00:05Z',
        sequenceIndex: 4,
        isError: false,
      });
    });

    it('should find patterns with default minRepeats=2', () => {
      const patterns = findToolRepeatPatterns(db, SESSION_ID);

      expect(patterns.length).toBe(2);
      // Sorted by repeat_count DESC
      expect(patterns[0]?.toolName).toBe('Read');
      expect(patterns[0]?.repeatCount).toBe(3);
      expect(patterns[1]?.toolName).toBe('Bash');
      expect(patterns[1]?.repeatCount).toBe(2);
    });

    it('should include first and last occurrence indices', () => {
      const patterns = findToolRepeatPatterns(db, SESSION_ID);
      const readPattern = patterns[0];

      expect(readPattern).toBeDefined();
      expect(readPattern!.firstOccurrence).toBe(0);
      expect(readPattern!.lastOccurrence).toBe(5);
    });

    it('should respect minRepeats parameter', () => {
      const patterns = findToolRepeatPatterns(db, SESSION_ID, 3);

      expect(patterns.length).toBe(1);
      expect(patterns[0]?.toolName).toBe('Read');
    });

    it('should return empty array if no repeats', () => {
      const patterns = findToolRepeatPatterns(db, SESSION_ID_2);
      expect(patterns.length).toBe(0);
    });
  });

  describe('insertToolCallsBatch', () => {
    it('should insert multiple records in a transaction', () => {
      const records = [
        {
          sessionId: SESSION_ID,
          toolName: 'Read',
          inputHash: 'hash1',
          timestamp: '2026-01-24T00:00:00Z',
          sequenceIndex: 0,
          isError: false,
        },
        {
          sessionId: SESSION_ID,
          toolName: 'Write',
          inputHash: 'hash2',
          timestamp: '2026-01-24T00:00:01Z',
          sequenceIndex: 1,
          isError: false,
        },
        {
          sessionId: SESSION_ID,
          toolName: 'Edit',
          inputHash: 'hash3',
          timestamp: '2026-01-24T00:00:02Z',
          sequenceIndex: 2,
          isError: false,
        },
      ];

      const inserted = insertToolCallsBatch(db, records);

      expect(inserted).toBe(3);
      expect(countToolCalls(db, { sessionId: SESSION_ID })).toBe(3);
    });

    it('should handle empty array', () => {
      const inserted = insertToolCallsBatch(db, []);
      expect(inserted).toBe(0);
    });
  });

  // ==========================================================================
  // File Accesses
  // ==========================================================================

  describe('insertFileAccess', () => {
    it('should insert a file access record', () => {
      const id = insertFileAccess(db, {
        sessionId: SESSION_ID,
        filePath: '/src/index.ts',
        operation: 'read',
        timestamp: '2026-01-24T00:00:00Z',
        accessSequence: 0,
      });

      expect(id).toBeGreaterThan(0);
    });
  });

  describe('queryFileAccesses', () => {
    beforeEach(() => {
      insertFileAccess(db, {
        sessionId: SESSION_ID,
        filePath: '/src/index.ts',
        operation: 'read',
        timestamp: '2026-01-24T00:00:00Z',
        accessSequence: 0,
      });
      insertFileAccess(db, {
        sessionId: SESSION_ID,
        filePath: '/src/utils/helpers.ts',
        operation: 'write',
        timestamp: '2026-01-24T00:00:01Z',
        accessSequence: 1,
      });
      insertFileAccess(db, {
        sessionId: SESSION_ID,
        filePath: '/src/index.ts',
        operation: 'edit',
        timestamp: '2026-01-24T00:00:02Z',
        accessSequence: 2,
      });
      insertFileAccess(db, {
        sessionId: SESSION_ID,
        filePath: '/tests/test.ts',
        operation: 'read',
        timestamp: '2026-01-24T00:00:03Z',
        accessSequence: 3,
      });
    });

    it('should return file accesses for a session', () => {
      const results = queryFileAccesses(db, { sessionId: SESSION_ID });

      expect(results.length).toBe(4);
    });

    it('should filter by operation', () => {
      const results = queryFileAccesses(db, { sessionId: SESSION_ID, operation: 'read' });

      expect(results.length).toBe(2);
      expect(results.every((r) => r.operation === 'read')).toBe(true);
    });

    it('should filter by file pattern with glob', () => {
      const results = queryFileAccesses(db, { sessionId: SESSION_ID, filePattern: '/src/**' });

      expect(results.length).toBe(3);
    });

    it('should respect limit and offset', () => {
      const results = queryFileAccesses(db, { sessionId: SESSION_ID }, 2, 1);

      expect(results.length).toBe(2);
      expect(results[0]?.accessSequence).toBe(1);
    });

    it('should order by access_sequence ASC', () => {
      const results = queryFileAccesses(db, { sessionId: SESSION_ID });

      expect(results[0]?.accessSequence).toBe(0);
      expect(results[3]?.accessSequence).toBe(3);
    });
  });

  describe('countFileAccesses', () => {
    beforeEach(() => {
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
        operation: 'write',
        timestamp: '2026-01-24T00:00:01Z',
        accessSequence: 1,
      });
    });

    it('should count all file accesses', () => {
      const count = countFileAccesses(db, { sessionId: SESSION_ID });
      expect(count).toBe(2);
    });

    it('should count by operation', () => {
      const count = countFileAccesses(db, { sessionId: SESSION_ID, operation: 'read' });
      expect(count).toBe(1);
    });
  });

  describe('getFileAccessSummary', () => {
    beforeEach(() => {
      // File 1: 3 reads, 2 writes, 1 edit = 6 total
      insertFileAccess(db, {
        sessionId: SESSION_ID,
        filePath: '/src/main.ts',
        operation: 'read',
        timestamp: '2026-01-24T00:00:00Z',
        accessSequence: 0,
      });
      insertFileAccess(db, {
        sessionId: SESSION_ID,
        filePath: '/src/main.ts',
        operation: 'read',
        timestamp: '2026-01-24T00:00:01Z',
        accessSequence: 1,
      });
      insertFileAccess(db, {
        sessionId: SESSION_ID,
        filePath: '/src/main.ts',
        operation: 'read',
        timestamp: '2026-01-24T00:00:02Z',
        accessSequence: 2,
      });
      insertFileAccess(db, {
        sessionId: SESSION_ID,
        filePath: '/src/main.ts',
        operation: 'write',
        timestamp: '2026-01-24T00:00:03Z',
        accessSequence: 3,
      });
      insertFileAccess(db, {
        sessionId: SESSION_ID,
        filePath: '/src/main.ts',
        operation: 'write',
        timestamp: '2026-01-24T00:00:04Z',
        accessSequence: 4,
      });
      insertFileAccess(db, {
        sessionId: SESSION_ID,
        filePath: '/src/main.ts',
        operation: 'edit',
        timestamp: '2026-01-24T00:00:05Z',
        accessSequence: 5,
      });
      // File 2: 1 read = 1 total
      insertFileAccess(db, {
        sessionId: SESSION_ID,
        filePath: '/src/utils.ts',
        operation: 'read',
        timestamp: '2026-01-24T00:00:06Z',
        accessSequence: 6,
      });
    });

    it('should return summary sorted by total accesses DESC', () => {
      const summary = getFileAccessSummary(db, SESSION_ID);

      expect(summary.length).toBe(2);
      expect(summary[0]?.filePath).toBe('/src/main.ts');
      expect(summary[0]?.totalAccesses).toBe(6);
      expect(summary[1]?.filePath).toBe('/src/utils.ts');
      expect(summary[1]?.totalAccesses).toBe(1);
    });

    it('should include operation breakdown', () => {
      const summary = getFileAccessSummary(db, SESSION_ID);
      const mainFile = summary[0];

      expect(mainFile).toBeDefined();
      expect(mainFile!.operations.read).toBe(3);
      expect(mainFile!.operations.write).toBe(2);
      expect(mainFile!.operations.edit).toBe(1);
    });

    it('should respect limit', () => {
      const summary = getFileAccessSummary(db, SESSION_ID, 1);
      expect(summary.length).toBe(1);
    });

    it('should return empty for session with no accesses', () => {
      const summary = getFileAccessSummary(db, 'non-existent');
      expect(summary.length).toBe(0);
    });
  });

  describe('insertFileAccessesBatch', () => {
    it('should insert multiple records in a transaction', () => {
      const records = [
        {
          sessionId: SESSION_ID,
          filePath: '/src/a.ts',
          operation: 'read' as const,
          timestamp: '2026-01-24T00:00:00Z',
          accessSequence: 0,
        },
        {
          sessionId: SESSION_ID,
          filePath: '/src/b.ts',
          operation: 'write' as const,
          timestamp: '2026-01-24T00:00:01Z',
          accessSequence: 1,
        },
      ];

      const inserted = insertFileAccessesBatch(db, records);

      expect(inserted).toBe(2);
      expect(countFileAccesses(db, { sessionId: SESSION_ID })).toBe(2);
    });
  });

  // ==========================================================================
  // Compression Events
  // ==========================================================================

  describe('insertCompressionEvent', () => {
    it('should insert a compression event', () => {
      const id = insertCompressionEvent(db, {
        sessionId: SESSION_ID,
        timestamp: '2026-01-24T00:00:00Z',
        compressionType: 'compact',
        preTokens: 150000,
        tokensSaved: 50000,
      });

      expect(id).toBeGreaterThan(0);
    });

    it('should insert with optional fields', () => {
      const id = insertCompressionEvent(db, {
        sessionId: SESSION_ID,
        timestamp: '2026-01-24T00:00:00Z',
        compressionType: 'microcompact',
        preTokens: 100000,
        tokensSaved: 30000,
        summaryPreserved: 'User was implementing feature X',
        filePath: '/logs/session.jsonl',
        lineNumber: 1234,
      });

      expect(id).toBeGreaterThan(0);

      const results = queryCompressionEvents(db, { sessionId: SESSION_ID });
      expect(results[0]?.summaryPreserved).toBe('User was implementing feature X');
    });
  });

  describe('queryCompressionEvents', () => {
    beforeEach(() => {
      insertCompressionEvent(db, {
        sessionId: SESSION_ID,
        timestamp: '2026-01-24T00:00:00Z',
        compressionType: 'compact',
        preTokens: 150000,
      });
      insertCompressionEvent(db, {
        sessionId: SESSION_ID,
        timestamp: '2026-01-24T01:00:00Z',
        compressionType: 'microcompact',
        preTokens: 140000,
        tokensSaved: 40000,
      });
    });

    it('should return compression events for a session', () => {
      const results = queryCompressionEvents(db, { sessionId: SESSION_ID });

      expect(results.length).toBe(2);
    });

    it('should order by timestamp ASC', () => {
      const results = queryCompressionEvents(db, { sessionId: SESSION_ID });

      expect(results[0]?.timestamp).toBe('2026-01-24T00:00:00Z');
      expect(results[1]?.timestamp).toBe('2026-01-24T01:00:00Z');
    });

    it('should not include optional fields when null', () => {
      const results = queryCompressionEvents(db, { sessionId: SESSION_ID });

      expect(results[0]?.tokensSaved).toBeUndefined();
      expect(results[1]?.tokensSaved).toBe(40000);
    });
  });

  describe('countCompressionEvents', () => {
    it('should count compression events', () => {
      insertCompressionEvent(db, {
        sessionId: SESSION_ID,
        timestamp: '2026-01-24T00:00:00Z',
        compressionType: 'compact',
      });
      insertCompressionEvent(db, {
        sessionId: SESSION_ID,
        timestamp: '2026-01-24T01:00:00Z',
        compressionType: 'compact',
      });

      const count = countCompressionEvents(db, SESSION_ID);
      expect(count).toBe(2);
    });

    it('should return 0 for no events', () => {
      const count = countCompressionEvents(db, 'non-existent');
      expect(count).toBe(0);
    });
  });

  // ==========================================================================
  // Delegation Events
  // ==========================================================================

  describe('insertDelegationEvent', () => {
    it('should insert a delegation event', () => {
      const id = insertDelegationEvent(db, {
        sessionId: SESSION_ID,
        subagentType: 'Explore',
        taskPrompt: 'Find all test files',
        timestamp: '2026-01-24T00:00:00Z',
        turnIndex: 5,
        success: true,
      });

      expect(id).toBeGreaterThan(0);
    });

    it('should insert with subagent session ID', () => {
      const id = insertDelegationEvent(db, {
        sessionId: SESSION_ID,
        subagentType: 'Bash',
        taskPrompt: 'Run tests',
        timestamp: '2026-01-24T00:00:00Z',
        turnIndex: 10,
        success: false,
        subagentSessionId: 'subagent-abc-123',
      });

      expect(id).toBeGreaterThan(0);

      const results = queryDelegationEvents(db, { sessionId: SESSION_ID });
      expect(results[0]?.subagentSessionId).toBe('subagent-abc-123');
    });
  });

  describe('queryDelegationEvents', () => {
    beforeEach(() => {
      insertDelegationEvent(db, {
        sessionId: SESSION_ID,
        subagentType: 'Explore',
        taskPrompt: 'Find files',
        timestamp: '2026-01-24T00:00:00Z',
        turnIndex: 1,
        success: true,
      });
      insertDelegationEvent(db, {
        sessionId: SESSION_ID,
        subagentType: 'Bash',
        taskPrompt: 'Run build',
        timestamp: '2026-01-24T00:00:01Z',
        turnIndex: 3,
        success: true,
      });
      insertDelegationEvent(db, {
        sessionId: SESSION_ID,
        subagentType: 'Explore',
        taskPrompt: 'Search codebase',
        timestamp: '2026-01-24T00:00:02Z',
        turnIndex: 5,
        success: false,
      });
    });

    it('should return delegation events for a session', () => {
      const results = queryDelegationEvents(db, { sessionId: SESSION_ID });

      expect(results.length).toBe(3);
    });

    it('should filter by subagent type', () => {
      const results = queryDelegationEvents(db, {
        sessionId: SESSION_ID,
        subagentType: 'Explore',
      });

      expect(results.length).toBe(2);
      expect(results.every((r) => r.subagentType === 'Explore')).toBe(true);
    });

    it('should order by turn_index ASC', () => {
      const results = queryDelegationEvents(db, { sessionId: SESSION_ID });

      expect(results[0]?.turnIndex).toBe(1);
      expect(results[1]?.turnIndex).toBe(3);
      expect(results[2]?.turnIndex).toBe(5);
    });

    it('should not include optional fields when null', () => {
      const results = queryDelegationEvents(db, { sessionId: SESSION_ID });

      expect(results[0]?.subagentSessionId).toBeUndefined();
    });
  });

  describe('countDelegationEvents', () => {
    beforeEach(() => {
      insertDelegationEvent(db, {
        sessionId: SESSION_ID,
        subagentType: 'Explore',
        timestamp: '2026-01-24T00:00:00Z',
        turnIndex: 1,
        success: true,
      });
      insertDelegationEvent(db, {
        sessionId: SESSION_ID,
        subagentType: 'Bash',
        timestamp: '2026-01-24T00:00:01Z',
        turnIndex: 2,
        success: true,
      });
      insertDelegationEvent(db, {
        sessionId: SESSION_ID,
        subagentType: 'Explore',
        timestamp: '2026-01-24T00:00:02Z',
        turnIndex: 3,
        success: true,
      });
    });

    it('should count all delegation events', () => {
      const count = countDelegationEvents(db, SESSION_ID);
      expect(count).toBe(3);
    });

    it('should count by subagent type', () => {
      const count = countDelegationEvents(db, SESSION_ID, 'Explore');
      expect(count).toBe(2);
    });

    it('should return 0 for no events', () => {
      const count = countDelegationEvents(db, 'non-existent');
      expect(count).toBe(0);
    });
  });

  // ==========================================================================
  // MCP Tool Calls
  // ==========================================================================

  describe('insertMcpToolCall', () => {
    it('should insert an MCP tool call', () => {
      const id = insertMcpToolCall(db, {
        sessionId: SESSION_ID,
        serverName: 'linear',
        toolName: 'list_issues',
        timestamp: '2026-01-24T00:00:00Z',
        isError: false,
      });

      expect(id).toBeGreaterThan(0);
    });

    it('should insert with error message', () => {
      const id = insertMcpToolCall(db, {
        sessionId: SESSION_ID,
        serverName: 'github',
        toolName: 'create_pr',
        timestamp: '2026-01-24T00:00:00Z',
        isError: true,
        errorMessage: 'Unauthorized',
      });

      expect(id).toBeGreaterThan(0);

      const results = queryMcpToolCalls(db, { sessionId: SESSION_ID });
      expect(results[0]?.errorMessage).toBe('Unauthorized');
    });
  });

  describe('queryMcpToolCalls', () => {
    beforeEach(() => {
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
        isError: false,
      });
      insertMcpToolCall(db, {
        sessionId: SESSION_ID,
        serverName: 'github',
        toolName: 'list_prs',
        timestamp: '2026-01-24T00:00:02Z',
        isError: true,
        errorMessage: 'Rate limit exceeded',
      });
    });

    it('should return MCP tool calls for a session', () => {
      const results = queryMcpToolCalls(db, { sessionId: SESSION_ID });

      expect(results.length).toBe(3);
    });

    it('should filter by server name', () => {
      const results = queryMcpToolCalls(db, { sessionId: SESSION_ID, serverName: 'linear' });

      expect(results.length).toBe(2);
      expect(results.every((r) => r.serverName === 'linear')).toBe(true);
    });

    it('should order by timestamp ASC', () => {
      const results = queryMcpToolCalls(db, { sessionId: SESSION_ID });

      expect(results[0]?.timestamp).toBe('2026-01-24T00:00:00Z');
      expect(results[2]?.timestamp).toBe('2026-01-24T00:00:02Z');
    });
  });

  describe('getMcpServerUsage', () => {
    beforeEach(() => {
      // Linear server: 3 calls, 1 error
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
        isError: false,
      });
      insertMcpToolCall(db, {
        sessionId: SESSION_ID,
        serverName: 'linear',
        toolName: 'create_issue',
        timestamp: '2026-01-24T00:00:02Z',
        isError: true,
        errorMessage: 'Validation error',
      });
      // GitHub server: 2 calls, 2 errors
      insertMcpToolCall(db, {
        sessionId: SESSION_ID,
        serverName: 'github',
        toolName: 'create_pr',
        timestamp: '2026-01-24T00:00:03Z',
        isError: true,
        errorMessage: 'Unauthorized',
      });
      insertMcpToolCall(db, {
        sessionId: SESSION_ID,
        serverName: 'github',
        toolName: 'create_pr',
        timestamp: '2026-01-24T00:00:04Z',
        isError: true,
        errorMessage: 'Rate limit',
      });
    });

    it('should return usage sorted by call count DESC', () => {
      const usage = getMcpServerUsage(db, SESSION_ID);

      expect(usage.length).toBe(2);
      expect(usage[0]?.serverName).toBe('linear');
      expect(usage[0]?.callCount).toBe(3);
      expect(usage[1]?.serverName).toBe('github');
      expect(usage[1]?.callCount).toBe(2);
    });

    it('should include error counts', () => {
      const usage = getMcpServerUsage(db, SESSION_ID);

      expect(usage[0]?.errorCount).toBe(1);
      expect(usage[1]?.errorCount).toBe(2);
    });

    it('should calculate error rate', () => {
      const usage = getMcpServerUsage(db, SESSION_ID);

      expect(usage[0]?.errorRate).toBeCloseTo(1 / 3, 5);
      expect(usage[1]?.errorRate).toBe(1.0);
    });

    it('should include per-tool breakdown', () => {
      const usage = getMcpServerUsage(db, SESSION_ID);
      const linearUsage = usage[0];

      expect(linearUsage).toBeDefined();
      expect(linearUsage!.tools.length).toBe(2);
      // Sorted by call count within server
      expect(linearUsage!.tools[0]?.toolName).toBe('create_issue');
      expect(linearUsage!.tools[0]?.callCount).toBe(2);
      expect(linearUsage!.tools[0]?.errorCount).toBe(1);
      expect(linearUsage!.tools[1]?.toolName).toBe('list_issues');
      expect(linearUsage!.tools[1]?.callCount).toBe(1);
      expect(linearUsage!.tools[1]?.errorCount).toBe(0);
    });

    it('should return empty for session with no MCP calls', () => {
      const usage = getMcpServerUsage(db, 'non-existent');
      expect(usage.length).toBe(0);
    });
  });

  // ==========================================================================
  // Quality Signals
  // ==========================================================================

  describe('insertQualitySignal', () => {
    it('should insert a quality signal with passed=true', () => {
      const id = insertQualitySignal(db, {
        sessionId: SESSION_ID,
        signalType: 'test',
        timestamp: '2026-01-24T00:00:00Z',
        passed: true,
        rawOutput: 'All 42 tests passed',
      });

      expect(id).toBeGreaterThan(0);
    });

    it('should insert a quality signal with passed=false', () => {
      const id = insertQualitySignal(db, {
        sessionId: SESSION_ID,
        signalType: 'build',
        timestamp: '2026-01-24T00:00:00Z',
        passed: false,
        rawOutput: 'Error: Cannot find module',
      });

      expect(id).toBeGreaterThan(0);
    });

    it('should insert a quality signal with passed=null (indeterminate)', () => {
      const id = insertQualitySignal(db, {
        sessionId: SESSION_ID,
        signalType: 'lint',
        timestamp: '2026-01-24T00:00:00Z',
        passed: null,
        rawOutput: 'Partial lint output...',
      });

      expect(id).toBeGreaterThan(0);

      const results = queryQualitySignals(db, { sessionId: SESSION_ID });
      expect(results[0]?.passed).toBeNull();
    });
  });

  describe('queryQualitySignals', () => {
    beforeEach(() => {
      insertQualitySignal(db, {
        sessionId: SESSION_ID,
        signalType: 'test',
        timestamp: '2026-01-24T00:00:00Z',
        passed: true,
        rawOutput: 'Tests passed',
      });
      insertQualitySignal(db, {
        sessionId: SESSION_ID,
        signalType: 'build',
        timestamp: '2026-01-24T00:00:01Z',
        passed: true,
      });
      insertQualitySignal(db, {
        sessionId: SESSION_ID,
        signalType: 'test',
        timestamp: '2026-01-24T00:00:02Z',
        passed: false,
        rawOutput: 'Test failed: expected 1 but got 2',
      });
    });

    it('should return quality signals for a session', () => {
      const results = queryQualitySignals(db, { sessionId: SESSION_ID });

      expect(results.length).toBe(3);
    });

    it('should filter by signal type', () => {
      const results = queryQualitySignals(db, { sessionId: SESSION_ID, signalType: 'test' });

      expect(results.length).toBe(2);
      expect(results.every((r) => r.signalType === 'test')).toBe(true);
    });

    it('should order by timestamp ASC', () => {
      const results = queryQualitySignals(db, { sessionId: SESSION_ID });

      expect(results[0]?.timestamp).toBe('2026-01-24T00:00:00Z');
      expect(results[2]?.timestamp).toBe('2026-01-24T00:00:02Z');
    });

    it('should not include optional rawOutput when null', () => {
      const results = queryQualitySignals(db, { sessionId: SESSION_ID, signalType: 'build' });

      expect(results[0]?.rawOutput).toBeUndefined();
    });
  });

  describe('countQualitySignalsByType', () => {
    beforeEach(() => {
      // Test signals: 2 passed, 1 failed, 1 indeterminate
      insertQualitySignal(db, {
        sessionId: SESSION_ID,
        signalType: 'test',
        timestamp: '2026-01-24T00:00:00Z',
        passed: true,
      });
      insertQualitySignal(db, {
        sessionId: SESSION_ID,
        signalType: 'test',
        timestamp: '2026-01-24T00:00:01Z',
        passed: true,
      });
      insertQualitySignal(db, {
        sessionId: SESSION_ID,
        signalType: 'test',
        timestamp: '2026-01-24T00:00:02Z',
        passed: false,
      });
      insertQualitySignal(db, {
        sessionId: SESSION_ID,
        signalType: 'test',
        timestamp: '2026-01-24T00:00:03Z',
        passed: null,
      });
      // Build signals: 1 passed
      insertQualitySignal(db, {
        sessionId: SESSION_ID,
        signalType: 'build',
        timestamp: '2026-01-24T00:00:04Z',
        passed: true,
      });
      // Lint signals: 1 failed
      insertQualitySignal(db, {
        sessionId: SESSION_ID,
        signalType: 'lint',
        timestamp: '2026-01-24T00:00:05Z',
        passed: false,
      });
    });

    it('should return counts by signal type', () => {
      const counts = countQualitySignalsByType(db, SESSION_ID);

      expect(counts.test.total).toBe(4);
      expect(counts.test.passed).toBe(2);
      expect(counts.test.failed).toBe(1);
      expect(counts.test.indeterminate).toBe(1);

      expect(counts.build.total).toBe(1);
      expect(counts.build.passed).toBe(1);
      expect(counts.build.failed).toBe(0);
      expect(counts.build.indeterminate).toBe(0);

      expect(counts.lint.total).toBe(1);
      expect(counts.lint.passed).toBe(0);
      expect(counts.lint.failed).toBe(1);
      expect(counts.lint.indeterminate).toBe(0);
    });

    it('should return zeros for types with no signals', () => {
      const counts = countQualitySignalsByType(db, 'non-existent');

      expect(counts.test.total).toBe(0);
      expect(counts.build.total).toBe(0);
      expect(counts.lint.total).toBe(0);
    });
  });
});
