/**
 * T021-T022: Unit tests for session JSONL parsing
 *
 * Tests the parseSessionFile() function for parsing Claude Code session logs.
 *
 * @module tests/unit/tools/sessions/parser.test.ts
 */

import { describe, it, expect } from 'bun:test';
import * as path from 'node:path';
import {
  parseSessionFile,
  parseSessionLine,
  createSessionParser,
} from '../../../../src/tools/sessions/parser';

// Test fixture paths
const FIXTURES_DIR = path.join(__dirname, '../../../fixtures/sessions');
const VALID_FILE = path.join(FIXTURES_DIR, 'sample-valid.jsonl');
const WITH_SUMMARY_FILE = path.join(FIXTURES_DIR, 'sample-with-summary.jsonl');
const WITH_TOOLS_FILE = path.join(FIXTURES_DIR, 'sample-with-tools.jsonl');
const MALFORMED_FILE = path.join(FIXTURES_DIR, 'sample-malformed.jsonl');

describe('parseSessionLine', () => {
  it('should parse a valid user message line', () => {
    const line =
      '{"type":"user","uuid":"msg-001","timestamp":"2026-01-15T10:00:00.000Z","message":{"role":"user","content":"Hello"}}';
    const result = parseSessionLine(line, 1);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.entry.type).toBe('user');
      expect(result.entry.uuid).toBe('msg-001');
      expect(result.entry.timestamp).toBe('2026-01-15T10:00:00.000Z');
      expect(result.entry.lineNumber).toBe(1);
    }
  });

  it('should parse a valid assistant message line', () => {
    const line =
      '{"type":"assistant","uuid":"msg-002","timestamp":"2026-01-15T10:00:05.000Z","message":{"role":"assistant","content":[{"type":"text","text":"Hello!"}],"usage":{"input_tokens":10,"output_tokens":5}}}';
    const result = parseSessionLine(line, 2);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.entry.type).toBe('assistant');
      expect(result.entry.message?.usage?.input_tokens).toBe(10);
      expect(result.entry.message?.usage?.output_tokens).toBe(5);
    }
  });

  it('should parse a tool result line', () => {
    const line =
      '{"type":"tool_result","uuid":"msg-003","timestamp":"2026-01-15T10:00:10.000Z","tool_result":{"tool_use_id":"tool-001","content":"result"}}';
    const result = parseSessionLine(line, 3);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.entry.type).toBe('tool_result');
      expect(result.entry.toolResult?.toolUseId).toBe('tool-001');
      expect(result.entry.toolResult?.content).toBe('result');
    }
  });

  it('should parse a summary line', () => {
    const line =
      '{"type":"summary","uuid":"msg-004","timestamp":"2026-01-15T10:30:00.000Z","summary":"Session summary text"}';
    const result = parseSessionLine(line, 4);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.entry.type).toBe('summary');
      expect(result.entry.summary).toBe('Session summary text');
    }
  });

  it('should return error for invalid JSON', () => {
    const line = 'not valid json';
    const result = parseSessionLine(line, 1);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Invalid JSON');
      expect(result.lineNumber).toBe(1);
    }
  });

  it('should return error for empty line', () => {
    const result = parseSessionLine('', 1);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Empty line');
    }
  });

  it('should return error for incomplete JSON', () => {
    const line = '{"type":"user","incomplete":';
    const result = parseSessionLine(line, 1);

    expect(result.success).toBe(false);
  });

  it('should handle lines with unknown types gracefully', () => {
    const line =
      '{"type":"file-history-snapshot","messageId":"abc","snapshot":{"trackedFileBackups":{}}}';
    const result = parseSessionLine(line, 1);

    // Unknown types should still parse, just won't have standard fields
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.entry.type).toBe('file-history-snapshot');
    }
  });
});

describe('parseSessionFile', () => {
  describe('valid files', () => {
    it('should parse all entries from a valid session file', async () => {
      const result = await parseSessionFile(VALID_FILE);

      expect(result.entries.length).toBe(6);
      expect(result.errorCount).toBe(0);
      expect(result.filePath).toBe(VALID_FILE);
    });

    it('should preserve line numbers in parsed entries', async () => {
      const result = await parseSessionFile(VALID_FILE);

      expect(result.entries[0]?.lineNumber).toBe(1);
      expect(result.entries[1]?.lineNumber).toBe(2);
      expect(result.entries[5]?.lineNumber).toBe(6);
    });

    it('should extract session metadata', async () => {
      const result = await parseSessionFile(VALID_FILE);

      expect(result.sessionId).toBe('d9d9f969-cd10-4814-bdbc-0e366c2c9e65');
      expect(result.firstTimestamp).toBe('2026-01-15T10:00:00.000Z');
      expect(result.lastTimestamp).toBe('2026-01-15T10:01:15.000Z');
    });

    it('should calculate token usage totals', async () => {
      const result = await parseSessionFile(VALID_FILE);

      // Sum of all input_tokens: 15 + 25 + 50 = 90
      expect(result.totalInputTokens).toBe(90);
      // Sum of all output_tokens: 20 + 30 + 25 = 75
      expect(result.totalOutputTokens).toBe(75);
    });

    it('should count compression events (summaries)', async () => {
      const result = await parseSessionFile(WITH_SUMMARY_FILE);

      expect(result.compressionCount).toBe(1);
    });

    it('should parse tool usage from entries', async () => {
      const result = await parseSessionFile(WITH_TOOLS_FILE);

      // Count tool_use content blocks
      let toolUseCount = 0;
      for (const entry of result.entries) {
        if (entry.message?.content && Array.isArray(entry.message.content)) {
          for (const block of entry.message.content) {
            if (block.type === 'tool_use') {
              toolUseCount++;
            }
          }
        }
      }
      expect(toolUseCount).toBe(4); // Glob, Bash, Write, WebSearch
    });
  });

  describe('malformed files', () => {
    it('should handle files with some invalid lines', async () => {
      const result = await parseSessionFile(MALFORMED_FILE);

      // Should parse valid lines and count errors
      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.errorCount).toBeGreaterThan(0);
    });

    it('should skip empty lines', async () => {
      const result = await parseSessionFile(MALFORMED_FILE);

      // Empty lines should be skipped, not counted as errors
      for (const entry of result.entries) {
        expect(entry.type).toBeDefined();
      }
    });

    it('should continue parsing after encountering errors', async () => {
      const result = await parseSessionFile(MALFORMED_FILE);

      // Should have parsed the valid lines (4 valid lines)
      expect(result.entries.length).toBe(4);
    });

    it('should record line numbers of errors', async () => {
      const result = await parseSessionFile(MALFORMED_FILE);

      expect(result.errors.length).toBeGreaterThan(0);
      for (const error of result.errors) {
        expect(error.lineNumber).toBeGreaterThan(0);
        expect(error.message).toBeDefined();
      }
    });
  });

  describe('edge cases', () => {
    it('should handle non-existent file', async () => {
      const result = await parseSessionFile('/nonexistent/path/file.jsonl');

      expect(result.entries).toEqual([]);
      expect(result.errorCount).toBe(1);
      expect(result.errors[0]?.message).toContain('ENOENT');
    });

    it('should handle file with only invalid lines', async () => {
      // Create inline test
      const tempFile = path.join(FIXTURES_DIR, 'temp-invalid.jsonl');
      await Bun.write(tempFile, 'invalid line 1\ninvalid line 2\n');

      try {
        const result = await parseSessionFile(tempFile);
        expect(result.entries).toEqual([]);
        expect(result.errorCount).toBe(2);
      } finally {
        await Bun.write(tempFile, '').catch(() => {});
        const fs = await import('node:fs/promises');
        await fs.unlink(tempFile).catch(() => {});
      }
    });
  });
});

describe('createSessionParser (streaming)', () => {
  it('should create a parser that processes lines one at a time', () => {
    const parser = createSessionParser();

    const result1 = parser.parseLine(
      '{"type":"user","uuid":"msg-001","timestamp":"2026-01-15T10:00:00.000Z","message":{"role":"user","content":"Hello"}}'
    );
    expect(result1.success).toBe(true);

    const result2 = parser.parseLine(
      '{"type":"assistant","uuid":"msg-002","timestamp":"2026-01-15T10:00:05.000Z","message":{"role":"assistant","content":[{"type":"text","text":"Hi!"}]}}'
    );
    expect(result2.success).toBe(true);
  });

  it('should track line numbers correctly', () => {
    const parser = createSessionParser();

    parser.parseLine('{"type":"user","uuid":"1","timestamp":"2026-01-15T10:00:00.000Z"}');
    parser.parseLine('invalid line');
    parser.parseLine('{"type":"user","uuid":"2","timestamp":"2026-01-15T10:00:01.000Z"}');

    const stats = parser.getStats();
    expect(stats.totalLines).toBe(3);
    expect(stats.validLines).toBe(2);
    expect(stats.errorLines).toBe(1);
  });

  it('should accumulate token usage', () => {
    const parser = createSessionParser();

    parser.parseLine(
      '{"type":"assistant","uuid":"1","timestamp":"2026-01-15T10:00:00.000Z","message":{"role":"assistant","content":[],"usage":{"input_tokens":10,"output_tokens":5}}}'
    );
    parser.parseLine(
      '{"type":"assistant","uuid":"2","timestamp":"2026-01-15T10:00:01.000Z","message":{"role":"assistant","content":[],"usage":{"input_tokens":20,"output_tokens":10}}}'
    );

    const stats = parser.getStats();
    expect(stats.totalInputTokens).toBe(30);
    expect(stats.totalOutputTokens).toBe(15);
  });
});
