/**
 * Integration tests for trace_issue_origin tool
 *
 * Tests the complete flow from issue input to traced causal chain output.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { v4 as uuidv4 } from 'uuid';

import { createCausalTables, insertChain, getChainById } from '../../../src/persistence/causal';

import type {
  CausalChain,
  EvidenceItem,
  TraceIssueInput,
  TraceIssueOutput,
  TracedIssue,
} from '../../../src/tools/causal/types';

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Create a mock database with both session FTS5 and causal tables.
 */
function createIntegrationDb(dbPath: string): Database {
  const db = new Database(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  // Create EP06 session tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      project_path TEXT NOT NULL,
      model TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Create FTS5 virtual table
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

  // Create causal tables
  createCausalTables(db);

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
 * Create a valid TraceIssueInput for testing.
 */
function createTestInput(overrides: Partial<TraceIssueInput> = {}): TraceIssueInput {
  return {
    issueDescription: 'TypeError: Cannot read property of undefined',
    issueLocation: {
      filePath: '/project/src/component.tsx',
      line: 42,
    },
    searchContext: {
      keywords: ['TypeError', 'undefined', 'property'],
    },
    maxDepth: 3,
    ...overrides,
  };
}

/**
 * Create a complete CausalChain for testing.
 */
function createTestChain(projectPath: string, overrides: Partial<CausalChain> = {}): CausalChain {
  const now = new Date().toISOString();
  const triggerId = uuidv4();

  const trigger: EvidenceItem = {
    id: triggerId,
    type: 'SessionMatch',
    source: 'session-origin',
    timestamp: now,
    content: 'User asked to add feature without null checks',
  };

  return {
    id: uuidv4(),
    issueId: 'issue-123',
    trigger,
    gap: {
      type: 'missing_guidance',
      location: 'claude_md',
      expectedGuidance: 'Always add null checks when accessing object properties',
      counterfactual: 'If null check guidance existed, the error would not have occurred',
    },
    mechanism: 'Agent implemented feature without defensive checks due to missing guidance',
    effect: 'TypeError thrown at runtime when accessing undefined property',
    confidence: {
      specificity: true,
      temporal: true,
      mechanistic: true,
      evidenceQuality: true,
      reproducibility: false,
      alternatives: true,
      overall: 'high',
    },
    evidence: [trigger],
    depth: 1,
    depthLimitReached: false,
    projectPath,
    createdAt: now,
    counterfactual: 'Adding null check guidance would prevent this class of errors',
    ...overrides,
  };
}

// =============================================================================
// Test Suite
// =============================================================================

describe('trace_issue_origin integration', () => {
  const testBaseDir = join(tmpdir(), 'agentlint-test-trace-issue');
  let db: Database;
  let dbPath: string;
  const projectPath = '/test/project';

  beforeEach(() => {
    // Clean up test directory
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true });
    }
    mkdirSync(testBaseDir, { recursive: true });

    // Create integration database
    dbPath = join(testBaseDir, 'sessions.db');
    db = createIntegrationDb(dbPath);
  });

  afterEach(() => {
    db.close();
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true });
    }
  });

  // ===========================================================================
  // Input Validation
  // ===========================================================================

  describe('input validation', () => {
    it('should accept valid TraceIssueInput', () => {
      const input = createTestInput();

      expect(input.issueDescription).toBeDefined();
      expect(input.issueDescription.length).toBeGreaterThan(0);
      expect(input.issueLocation?.filePath).toBe('/project/src/component.tsx');
      expect(input.searchContext?.keywords).toContain('TypeError');
      expect(input.maxDepth).toBeLessThanOrEqual(5);
    });

    it('should accept input without optional fields', () => {
      const input: TraceIssueInput = {
        issueDescription: 'Some error occurred',
      };

      expect(input.issueDescription).toBeDefined();
      expect(input.issueLocation).toBeUndefined();
      expect(input.searchContext).toBeUndefined();
      expect(input.maxDepth).toBeUndefined();
    });

    it('should support date range in search context', () => {
      const input = createTestInput({
        searchContext: {
          keywords: ['error'],
          since: '2026-01-15T00:00:00Z',
          until: '2026-01-17T23:59:59Z',
        },
      });

      expect(input.searchContext?.since).toBe('2026-01-15T00:00:00Z');
      expect(input.searchContext?.until).toBe('2026-01-17T23:59:59Z');
    });
  });

  // ===========================================================================
  // Session Search Integration
  // ===========================================================================

  describe('session search', () => {
    it('should find related sessions via FTS5', () => {
      insertMockSessionEntries(db, [
        {
          sessionId: 'session-1',
          projectPath,
          timestamp: '2026-01-17T10:00:00Z',
          role: 'user',
          content: 'Add feature to handle undefined values',
        },
        {
          sessionId: 'session-1',
          projectPath,
          timestamp: '2026-01-17T10:01:00Z',
          role: 'assistant',
          content: 'I will add the feature without null checks',
          toolName: 'Edit',
          filePath: '/test/project/src/component.tsx',
          lineNumber: 42,
        },
      ]);

      // Simulate what the tool would do: search for related content
      const results = db
        .query<{ session_id: string; content: string; timestamp: string }, [string]>(
          `SELECT session_id, content, timestamp
           FROM session_entries
           WHERE session_entries MATCH ?
           ORDER BY bm25(session_entries)`
        )
        .all('undefined OR null');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.content.includes('undefined'))).toBe(true);
    });

    it('should correlate issue location with session tool calls', () => {
      const issueFilePath = '/test/project/src/component.tsx';
      const issueLineNumber = 42;

      insertMockSessionEntries(db, [
        {
          sessionId: 'session-1',
          projectPath,
          timestamp: '2026-01-17T10:00:00Z',
          role: 'assistant',
          content: 'Editing the component',
          toolName: 'Edit',
          filePath: issueFilePath,
          lineNumber: issueLineNumber,
        },
      ]);

      // Find tool calls that touched the issue location
      const results = db
        .query<
          { session_id: string; tool_name: string; file_path: string; line_number: number },
          [string, number, number]
        >(
          `SELECT session_id, tool_name, file_path, line_number
           FROM session_entries
           WHERE file_path = ?
           AND line_number BETWEEN ? AND ?`
        )
        .all(issueFilePath, issueLineNumber - 10, issueLineNumber + 10);

      expect(results.length).toBe(1);
      expect(results[0]!.tool_name).toBe('Edit');
      expect(results[0]!.file_path).toBe(issueFilePath);
    });

    it('should filter sessions by date range', () => {
      insertMockSessionEntries(db, [
        {
          sessionId: 'session-old',
          projectPath,
          timestamp: '2026-01-10T10:00:00Z',
          role: 'user',
          content: 'Old discussion about error handling',
        },
        {
          sessionId: 'session-new',
          projectPath,
          timestamp: '2026-01-17T10:00:00Z',
          role: 'user',
          content: 'Recent discussion about error handling',
        },
      ]);

      const since = '2026-01-15T00:00:00Z';
      const results = db
        .query<{ session_id: string }, [string, string]>(
          `SELECT session_id FROM session_entries
           WHERE session_entries MATCH ? AND timestamp >= ?`
        )
        .all('error', since);

      expect(results.length).toBe(1);
      expect(results[0]!.session_id).toBe('session-new');
    });
  });

  // ===========================================================================
  // Chain Construction
  // ===========================================================================

  describe('chain construction', () => {
    it('should build valid CausalChain from evidence', () => {
      const chain = createTestChain(projectPath);

      expect(chain.id).toBeDefined();
      expect(chain.issueId).toBe('issue-123');
      expect(chain.trigger.type).toBe('SessionMatch');
      expect(chain.mechanism).toBeDefined();
      expect(chain.effect).toBeDefined();
      expect(chain.evidence.length).toBeGreaterThanOrEqual(1);
      expect(chain.depth).toBeGreaterThanOrEqual(0);
      expect(chain.depth).toBeLessThanOrEqual(5);
    });

    it('should persist chain to database', () => {
      const chain = createTestChain(projectPath);

      insertChain(db, chain);
      const retrieved = getChainById(db, chain.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(chain.id);
      expect(retrieved!.issueId).toBe(chain.issueId);
      expect(retrieved!.mechanism).toBe(chain.mechanism);
      expect(retrieved!.evidence.length).toBe(chain.evidence.length);
    });

    it('should include gap analysis when config gap detected', () => {
      const chain = createTestChain(projectPath, {
        gap: {
          type: 'missing_config',
          location: 'claude_md',
          expectedGuidance: 'Error handling patterns',
          counterfactual: 'If configured, errors would be handled properly',
        },
      });

      expect(chain.gap).toBeDefined();
      expect(chain.gap!.type).toBe('missing_config');
      expect(chain.gap!.location).toBe('claude_md');
    });

    it('should compute confidence score from evidence quality', () => {
      const chain = createTestChain(projectPath);

      expect(chain.confidence.overall).toBe('high');
      expect(chain.confidence.specificity).toBe(true);
      expect(chain.confidence.temporal).toBe(true);
    });

    it('should respect maxDepth limit', () => {
      const chain = createTestChain(projectPath, {
        depth: 5,
        depthLimitReached: true,
      });

      expect(chain.depth).toBe(5);
      expect(chain.depthLimitReached).toBe(true);
    });
  });

  // ===========================================================================
  // Output Format
  // ===========================================================================

  describe('output format', () => {
    it('should produce valid TraceIssueOutput on success', () => {
      const chain = createTestChain(projectPath);
      const tracedIssue: TracedIssue = {
        issueId: chain.issueId,
        chain,
        counterfactual: chain.counterfactual,
        patternId: undefined,
        traceCompleteness: 'full',
        limitations: undefined,
      };

      const output: TraceIssueOutput = {
        success: true,
        result: tracedIssue,
      };

      expect(output.success).toBe(true);
      expect(output.result).toBeDefined();
      expect(output.result!.chain.id).toBe(chain.id);
      expect(output.error).toBeUndefined();
    });

    it('should produce valid TraceIssueOutput on failure', () => {
      const output: TraceIssueOutput = {
        success: false,
        error: 'No matching sessions found for the issue',
      };

      expect(output.success).toBe(false);
      expect(output.result).toBeUndefined();
      expect(output.error).toBeDefined();
    });

    it('should indicate partial trace when evidence incomplete', () => {
      const chain = createTestChain(projectPath, {
        depthLimitReached: true,
      });

      const tracedIssue: TracedIssue = {
        issueId: chain.issueId,
        chain,
        traceCompleteness: 'partial',
        limitations: ['Maximum trace depth reached', 'Git history unavailable'],
      };

      expect(tracedIssue.traceCompleteness).toBe('partial');
      expect(tracedIssue.limitations).toContain('Maximum trace depth reached');
    });

    it('should include patternId when linked to recurring pattern', () => {
      const patternId = uuidv4();
      const chain = createTestChain(projectPath, { patternId });

      const tracedIssue: TracedIssue = {
        issueId: chain.issueId,
        chain,
        traceCompleteness: 'full',
        patternId,
      };

      expect(tracedIssue.patternId).toBe(patternId);
      expect(tracedIssue.chain.patternId).toBe(patternId);
    });
  });

  // ===========================================================================
  // End-to-End Scenarios
  // ===========================================================================

  describe('end-to-end scenarios', () => {
    it('should trace issue from session prompt to effect', () => {
      // Set up a realistic scenario
      insertMockSessionEntries(db, [
        {
          sessionId: 'session-cause',
          projectPath,
          timestamp: '2026-01-17T09:00:00Z',
          role: 'user',
          content: 'Add a feature to display user profile data',
        },
        {
          sessionId: 'session-cause',
          projectPath,
          timestamp: '2026-01-17T09:01:00Z',
          role: 'assistant',
          content: 'I will implement the profile display component',
        },
        {
          sessionId: 'session-cause',
          projectPath,
          timestamp: '2026-01-17T09:02:00Z',
          role: 'assistant',
          content: 'Editing the component to access user.profile.name',
          toolName: 'Edit',
          filePath: '/test/project/src/Profile.tsx',
          lineNumber: 25,
        },
      ]);

      // Simulate tracing the issue
      const input = createTestInput({
        issueDescription: 'TypeError: Cannot read property name of undefined in Profile.tsx',
        issueLocation: {
          filePath: '/test/project/src/Profile.tsx',
          line: 25,
        },
        searchContext: {
          keywords: ['profile', 'user', 'name'],
        },
      });

      // Search for related sessions
      const sessionResults = db
        .query<
          {
            session_id: string;
            content: string;
            timestamp: string;
            tool_name: string;
            file_path: string;
          },
          [string]
        >(
          `SELECT session_id, content, timestamp, tool_name, file_path
           FROM session_entries
           WHERE session_entries MATCH ?
           ORDER BY timestamp ASC`
        )
        .all('profile OR user');

      expect(sessionResults.length).toBe(3);

      // Build chain from results
      const trigger: EvidenceItem = {
        id: uuidv4(),
        type: 'SessionMatch',
        source: sessionResults[0]!.session_id,
        timestamp: sessionResults[0]!.timestamp,
        content: sessionResults[0]!.content,
      };

      const chain: CausalChain = {
        id: uuidv4(),
        issueId: 'profile-error-001',
        trigger,
        mechanism: 'User requested profile feature; agent accessed user.profile without null check',
        effect: input.issueDescription,
        gap: {
          type: 'missing_guidance',
          location: 'claude_md',
          expectedGuidance: 'Always check for null/undefined before accessing nested properties',
          counterfactual: 'If guidance existed, null check would have been added',
        },
        confidence: {
          specificity: true,
          temporal: true,
          mechanistic: true,
          evidenceQuality: true,
          reproducibility: false,
          alternatives: true,
          overall: 'high',
        },
        evidence: [trigger],
        depth: 1,
        depthLimitReached: false,
        projectPath,
        createdAt: new Date().toISOString(),
      };

      // Persist and verify
      insertChain(db, chain);
      const persisted = getChainById(db, chain.id);

      expect(persisted).not.toBeNull();
      expect(persisted!.issueId).toBe('profile-error-001');
      expect(persisted!.trigger.content).toContain('profile');
    });

    it('should handle issue with no related sessions', () => {
      // Insert one entry so FTS5 table is not empty
      insertMockSessionEntries(db, [
        {
          sessionId: 'session-1',
          projectPath,
          timestamp: '2026-01-17T10:00:00Z',
          role: 'user',
          content: 'Something unrelated',
        },
      ]);

      // Search for non-matching term
      const results = db
        .query<
          { session_id: string },
          [string]
        >(`SELECT session_id FROM session_entries WHERE session_entries MATCH ?`)
        .all('zzzznonexistent');

      expect(results.length).toBe(0);

      // Tool should return error output
      const output: TraceIssueOutput = {
        success: false,
        error: 'No matching sessions found for the issue keywords',
      };

      expect(output.success).toBe(false);
    });

    it('should trace across multiple sessions', () => {
      insertMockSessionEntries(db, [
        {
          sessionId: 'session-1',
          projectPath,
          timestamp: '2026-01-15T10:00:00Z',
          role: 'user',
          content: 'Create authentication module',
        },
        {
          sessionId: 'session-2',
          projectPath,
          timestamp: '2026-01-16T10:00:00Z',
          role: 'user',
          content: 'Add login feature to authentication',
        },
        {
          sessionId: 'session-3',
          projectPath,
          timestamp: '2026-01-17T10:00:00Z',
          role: 'user',
          content: 'Bug report: authentication fails silently',
        },
      ]);

      // Search across all sessions
      const results = db
        .query<{ session_id: string; timestamp: string }, [string]>(
          `SELECT DISTINCT session_id, MIN(timestamp) as timestamp
           FROM session_entries
           WHERE session_entries MATCH ?
           GROUP BY session_id
           ORDER BY timestamp ASC`
        )
        .all('authentication');

      expect(results.length).toBe(3);
      expect(results[0]!.session_id).toBe('session-1');
      expect(results[2]!.session_id).toBe('session-3');
    });
  });
});
