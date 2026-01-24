/**
 * EP15 Session Intelligence - Schema Validation Tests
 *
 * Unit tests for Zod validation schemas.
 */

import { describe, expect, it } from 'bun:test';
import {
  FileOperationSchema,
  CompressionTypeSchema,
  QualitySignalTypeSchema,
  AnalysisFocusSchema,
  IntentSchema,
  SessionOutcomeSchema,
  SessionTimelineSchema,
  ToolCallRecordSchema,
  FileAccessRecordSchema,
  CompressionEventRecordSchema,
  DelegationEventRecordSchema,
  McpToolCallRecordSchema,
  QualitySignalRecordSchema,
  GetSessionTimelineInputSchema,
  GetToolSequencesInputSchema,
  GetFileAccessesInputSchema,
  GetCompressionEventsInputSchema,
  GetDelegationEventsInputSchema,
  GetMcpUsageInputSchema,
  GetQualitySignalsInputSchema,
  SpawnSessionAnalystInputSchema,
} from '../../../src/sessions/schemas';

describe('EP15 Session Intelligence Schemas', () => {
  describe('Core Type Schemas', () => {
    it('validates FileOperationSchema', () => {
      expect(FileOperationSchema.parse('read')).toBe('read');
      expect(FileOperationSchema.parse('write')).toBe('write');
      expect(FileOperationSchema.parse('edit')).toBe('edit');
      expect(() => FileOperationSchema.parse('delete')).toThrow();
    });

    it('validates CompressionTypeSchema', () => {
      expect(CompressionTypeSchema.parse('compact')).toBe('compact');
      expect(CompressionTypeSchema.parse('microcompact')).toBe('microcompact');
      expect(() => CompressionTypeSchema.parse('full')).toThrow();
    });

    it('validates QualitySignalTypeSchema', () => {
      expect(QualitySignalTypeSchema.parse('test')).toBe('test');
      expect(QualitySignalTypeSchema.parse('build')).toBe('build');
      expect(QualitySignalTypeSchema.parse('lint')).toBe('lint');
      expect(() => QualitySignalTypeSchema.parse('format')).toThrow();
    });

    it('validates AnalysisFocusSchema', () => {
      expect(AnalysisFocusSchema.parse('narrative')).toBe('narrative');
      expect(AnalysisFocusSchema.parse('flow')).toBe('flow');
      expect(AnalysisFocusSchema.parse('quality')).toBe('quality');
      expect(AnalysisFocusSchema.parse('comprehensive')).toBe('comprehensive');
      expect(() => AnalysisFocusSchema.parse('detailed')).toThrow();
    });
  });

  describe('Intent and Outcome Schemas', () => {
    it('validates IntentSchema', () => {
      const validIntent = {
        firstUserPrompt: 'Help me implement authentication',
        timestamp: '2026-01-24T00:00:00Z',
        promptLength: 35,
      };
      expect(IntentSchema.parse(validIntent)).toEqual(validIntent);
    });

    it('rejects IntentSchema with negative promptLength', () => {
      const invalidIntent = {
        firstUserPrompt: 'Help',
        timestamp: '2026-01-24T00:00:00Z',
        promptLength: -1,
      };
      expect(() => IntentSchema.parse(invalidIntent)).toThrow();
    });

    it('validates SessionOutcomeSchema', () => {
      const validOutcome = {
        lastUserPrompt: 'Thanks!',
        lastToolCall: { name: 'Bash', success: true },
        hasCommitActivity: true,
        turnCount: 25,
        signals: {
          containsThanks: true,
          containsDone: false,
          endsWithError: false,
          hasUnresolvedError: false,
        },
      };
      expect(SessionOutcomeSchema.parse(validOutcome)).toEqual(validOutcome);
    });

    it('accepts null values in SessionOutcomeSchema', () => {
      const outcomeWithNulls = {
        lastUserPrompt: null,
        lastToolCall: null,
        hasCommitActivity: false,
        turnCount: 1,
        signals: {
          containsThanks: false,
          containsDone: false,
          endsWithError: true,
          hasUnresolvedError: true,
        },
      };
      expect(SessionOutcomeSchema.parse(outcomeWithNulls)).toEqual(outcomeWithNulls);
    });
  });

  describe('SessionTimelineSchema', () => {
    const validTimeline = {
      sessionId: 'abc123-def456',
      projectPath: '/Users/test/project',
      startTime: '2026-01-24T00:00:00Z',
      endTime: '2026-01-24T01:00:00Z',
      duration: 3600000,
      turnCount: 50,
      intent: {
        firstUserPrompt: 'Help me',
        timestamp: '2026-01-24T00:00:00Z',
        promptLength: 7,
      },
      outcome: {
        lastUserPrompt: 'Done',
        lastToolCall: null,
        hasCommitActivity: true,
        turnCount: 50,
        signals: {
          containsThanks: false,
          containsDone: true,
          endsWithError: false,
          hasUnresolvedError: false,
        },
      },
      metrics: {
        inputTokens: 50000,
        outputTokens: 25000,
        cacheTokens: 10000,
        compressionCount: 2,
      },
    };

    it('validates complete SessionTimeline', () => {
      expect(SessionTimelineSchema.parse(validTimeline)).toEqual(validTimeline);
    });

    it('rejects empty sessionId', () => {
      const invalid = { ...validTimeline, sessionId: '' };
      expect(() => SessionTimelineSchema.parse(invalid)).toThrow();
    });
  });

  describe('Record Schemas', () => {
    it('validates ToolCallRecordSchema', () => {
      const validRecord = {
        sessionId: 'session-123',
        toolName: 'Read',
        inputHash: 'a'.repeat(64), // SHA-256 is 64 hex chars
        timestamp: '2026-01-24T00:00:00Z',
        sequenceIndex: 0,
        isError: false,
      };
      expect(ToolCallRecordSchema.parse(validRecord)).toEqual(validRecord);
    });

    it('validates ToolCallRecordSchema with error', () => {
      const recordWithError = {
        sessionId: 'session-123',
        toolName: 'Bash',
        inputHash: 'b'.repeat(64),
        timestamp: '2026-01-24T00:00:00Z',
        sequenceIndex: 5,
        isError: true,
        errorMessage: 'Command failed',
        filePath: '/path/to/log.jsonl',
        lineNumber: 42,
      };
      expect(ToolCallRecordSchema.parse(recordWithError)).toEqual(recordWithError);
    });

    it('rejects invalid inputHash length', () => {
      const invalidRecord = {
        sessionId: 'session-123',
        toolName: 'Read',
        inputHash: 'tooshort',
        timestamp: '2026-01-24T00:00:00Z',
        sequenceIndex: 0,
        isError: false,
      };
      expect(() => ToolCallRecordSchema.parse(invalidRecord)).toThrow();
    });

    it('validates FileAccessRecordSchema', () => {
      const validRecord = {
        sessionId: 'session-123',
        filePath: '/src/index.ts',
        operation: 'read' as const,
        timestamp: '2026-01-24T00:00:00Z',
        accessSequence: 0,
      };
      expect(FileAccessRecordSchema.parse(validRecord)).toEqual(validRecord);
    });

    it('validates CompressionEventRecordSchema', () => {
      const validRecord = {
        sessionId: 'session-123',
        timestamp: '2026-01-24T00:00:00Z',
        compressionType: 'compact' as const,
        preTokens: 150000,
        tokensSaved: 50000,
        summaryPreserved: 'Session summary...',
      };
      expect(CompressionEventRecordSchema.parse(validRecord)).toEqual(validRecord);
    });

    it('validates DelegationEventRecordSchema', () => {
      const validRecord = {
        sessionId: 'session-123',
        subagentType: 'Explore',
        taskPrompt: 'Find all test files',
        timestamp: '2026-01-24T00:00:00Z',
        turnIndex: 10,
        success: true,
        subagentSessionId: 'subagent-456',
      };
      expect(DelegationEventRecordSchema.parse(validRecord)).toEqual(validRecord);
    });

    it('validates McpToolCallRecordSchema', () => {
      const validRecord = {
        sessionId: 'session-123',
        serverName: 'linear',
        toolName: 'list_issues',
        timestamp: '2026-01-24T00:00:00Z',
        isError: false,
      };
      expect(McpToolCallRecordSchema.parse(validRecord)).toEqual(validRecord);
    });

    it('validates QualitySignalRecordSchema with null passed', () => {
      const validRecord = {
        sessionId: 'session-123',
        signalType: 'test' as const,
        timestamp: '2026-01-24T00:00:00Z',
        passed: null, // indeterminate
        rawOutput: 'Test output...',
      };
      expect(QualitySignalRecordSchema.parse(validRecord)).toEqual(validRecord);
    });
  });

  describe('Tool Input Schemas', () => {
    it('validates GetSessionTimelineInputSchema', () => {
      const input = { sessionId: 'abc123' };
      expect(GetSessionTimelineInputSchema.parse(input)).toEqual(input);
    });

    it('rejects empty sessionId in GetSessionTimelineInputSchema', () => {
      expect(() => GetSessionTimelineInputSchema.parse({ sessionId: '' })).toThrow();
    });

    it('validates GetToolSequencesInputSchema with defaults', () => {
      const input = { sessionId: 'abc123' };
      const parsed = GetToolSequencesInputSchema.parse(input);
      expect(parsed.sessionId).toBe('abc123');
      expect(parsed.limit).toBe(100);
      expect(parsed.offset).toBe(0);
      expect(parsed.errorsOnly).toBe(false);
    });

    it('validates GetToolSequencesInputSchema with custom values', () => {
      const input = {
        sessionId: 'abc123',
        limit: 50,
        offset: 100,
        toolName: 'Read',
        errorsOnly: true,
      };
      expect(GetToolSequencesInputSchema.parse(input)).toEqual(input);
    });

    it('rejects limit > 500 in GetToolSequencesInputSchema', () => {
      const input = { sessionId: 'abc123', limit: 1000 };
      expect(() => GetToolSequencesInputSchema.parse(input)).toThrow();
    });

    it('validates GetFileAccessesInputSchema', () => {
      const input = {
        sessionId: 'abc123',
        filePattern: '**/*.ts',
        operation: 'edit' as const,
      };
      expect(GetFileAccessesInputSchema.parse(input)).toEqual(input);
    });

    it('validates GetCompressionEventsInputSchema', () => {
      const input = { sessionId: 'abc123' };
      expect(GetCompressionEventsInputSchema.parse(input)).toEqual(input);
    });

    it('validates GetDelegationEventsInputSchema', () => {
      const input = { sessionId: 'abc123', subagentType: 'Explore' };
      expect(GetDelegationEventsInputSchema.parse(input)).toEqual(input);
    });

    it('validates GetMcpUsageInputSchema', () => {
      const input = { sessionId: 'abc123', serverName: 'linear' };
      expect(GetMcpUsageInputSchema.parse(input)).toEqual(input);
    });

    it('validates GetQualitySignalsInputSchema', () => {
      const input = { sessionId: 'abc123', signalType: 'test' as const };
      expect(GetQualitySignalsInputSchema.parse(input)).toEqual(input);
    });

    it('validates SpawnSessionAnalystInputSchema with defaults', () => {
      const input = { sessionId: 'abc123' };
      const parsed = SpawnSessionAnalystInputSchema.parse(input);
      expect(parsed.sessionId).toBe('abc123');
      expect(parsed.focus).toBe('comprehensive');
    });

    it('validates SpawnSessionAnalystInputSchema with all options', () => {
      const input = {
        sessionId: 'abc123',
        compareToSessionId: 'def456',
        query: 'Why was this session slow?',
        focus: 'flow' as const,
      };
      expect(SpawnSessionAnalystInputSchema.parse(input)).toEqual(input);
    });
  });
});
