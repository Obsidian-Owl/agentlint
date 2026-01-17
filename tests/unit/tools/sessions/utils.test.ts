/**
 * T014: Unit tests for session analysis utilities
 *
 * Tests path encoding/decoding, session ID extraction, and tool categorization.
 *
 * @module tests/unit/tools/sessions/utils.test.ts
 */

import { describe, it, expect } from 'bun:test';
import {
  decodeProjectPath,
  encodeProjectPath,
  extractProjectPath,
  extractSessionId,
  isSessionLogFile,
  categorizeToolByName,
  parseTimestamp,
  validateTimestamp,
  isWithinDateRange,
  extractTextFromContent,
  truncateText,
} from '../../../../src/tools/sessions/utils';

describe('Path Encoding/Decoding', () => {
  describe('decodeProjectPath', () => {
    it('should decode a simple path with leading dash', () => {
      const encoded = '-Users-foo-bar';
      const decoded = decodeProjectPath(encoded);
      expect(decoded).toBe('/Users/foo/bar');
    });

    it('should decode a longer path', () => {
      const encoded = '-Users-dmccarthy-Projects-agentlint';
      const decoded = decodeProjectPath(encoded);
      expect(decoded).toBe('/Users/dmccarthy/Projects/agentlint');
    });

    it('should decode a home directory path', () => {
      const encoded = '-home-user-work-project';
      const decoded = decodeProjectPath(encoded);
      expect(decoded).toBe('/home/user/work/project');
    });

    it('should handle empty path after leading dash', () => {
      const encoded = '-';
      const decoded = decodeProjectPath(encoded);
      expect(decoded).toBe('/');
    });

    it('should handle path with no leading dash (unusual case)', () => {
      const encoded = 'Users-foo-bar';
      const decoded = decodeProjectPath(encoded);
      expect(decoded).toBe('Users/foo/bar');
    });
  });

  describe('encodeProjectPath', () => {
    it('should encode a simple absolute path', () => {
      const path = '/Users/foo/bar';
      const encoded = encodeProjectPath(path);
      expect(encoded).toBe('-Users-foo-bar');
    });

    it('should encode a longer path', () => {
      const path = '/Users/dmccarthy/Projects/agentlint';
      const encoded = encodeProjectPath(path);
      expect(encoded).toBe('-Users-dmccarthy-Projects-agentlint');
    });

    it('should encode a Linux home path', () => {
      const path = '/home/user/work/project';
      const encoded = encodeProjectPath(path);
      expect(encoded).toBe('-home-user-work-project');
    });

    it('should handle root path', () => {
      const path = '/';
      const encoded = encodeProjectPath(path);
      expect(encoded).toBe('-');
    });

    it('should handle relative path (unusual case)', () => {
      const path = 'relative/path';
      const encoded = encodeProjectPath(path);
      expect(encoded).toBe('relative-path');
    });
  });

  describe('roundtrip encoding/decoding', () => {
    const testPaths = [
      '/Users/foo/bar',
      '/Users/dmccarthy/Projects/agentlint',
      '/home/user/work/project',
      '/var/www/html',
      '/',
    ];

    for (const path of testPaths) {
      it(`should roundtrip: ${path}`, () => {
        const encoded = encodeProjectPath(path);
        const decoded = decodeProjectPath(encoded);
        expect(decoded).toBe(path);
      });
    }
  });

  describe('extractProjectPath', () => {
    const mockProjectsDir = '/Users/user/.claude/projects';

    it('should extract project info from a session file path', () => {
      const filePath = '/Users/user/.claude/projects/-Users-foo-bar/abc123.jsonl';
      const result = extractProjectPath(filePath, mockProjectsDir);

      expect(result).not.toBeNull();
      expect(result!.encodedPath).toBe('-Users-foo-bar');
      expect(result!.decodedPath).toBe('/Users/foo/bar');
      expect(result!.relativePath).toBe('abc123.jsonl');
    });

    it('should return null for file outside projects directory', () => {
      const filePath = '/some/other/path/file.jsonl';
      const result = extractProjectPath(filePath, mockProjectsDir);

      expect(result).toBeNull();
    });

    it('should return null for file directly in projects directory', () => {
      const filePath = '/Users/user/.claude/projects/somefile.jsonl';
      const result = extractProjectPath(filePath, mockProjectsDir);

      expect(result).toBeNull();
    });

    it('should handle nested relative paths', () => {
      const filePath = '/Users/user/.claude/projects/-home-user-work/subdir/session.jsonl';
      const result = extractProjectPath(filePath, mockProjectsDir);

      expect(result).not.toBeNull();
      expect(result!.encodedPath).toBe('-home-user-work');
      expect(result!.decodedPath).toBe('/home/user/work');
      expect(result!.relativePath).toBe('subdir/session.jsonl');
    });

    it('should normalize Windows-style paths', () => {
      const filePath = '/Users/user/.claude/projects/-Users-foo-bar\\session.jsonl';
      const result = extractProjectPath(filePath, mockProjectsDir);

      expect(result).not.toBeNull();
      expect(result!.relativePath).toBe('session.jsonl');
    });
  });
});

describe('Session ID Utilities', () => {
  describe('extractSessionId', () => {
    it('should extract UUID from valid session filename', () => {
      const filename = 'd9d9f969-cd10-4814-bdbc-0e366c2c9e65.jsonl';
      const sessionId = extractSessionId(filename);

      expect(sessionId).toBe('d9d9f969-cd10-4814-bdbc-0e366c2c9e65');
    });

    it('should extract UUID with uppercase letters', () => {
      const filename = 'D9D9F969-CD10-4814-BDBC-0E366C2C9E65.jsonl';
      const sessionId = extractSessionId(filename);

      expect(sessionId).toBe('D9D9F969-CD10-4814-BDBC-0E366C2C9E65');
    });

    it('should return null for non-UUID filename', () => {
      const filename = 'not-a-uuid.jsonl';
      const sessionId = extractSessionId(filename);

      expect(sessionId).toBeNull();
    });

    it('should return null for wrong extension', () => {
      const filename = 'd9d9f969-cd10-4814-bdbc-0e366c2c9e65.txt';
      const sessionId = extractSessionId(filename);

      expect(sessionId).toBeNull();
    });

    it('should return null for incomplete UUID', () => {
      const filename = 'd9d9f969-cd10-4814.jsonl';
      const sessionId = extractSessionId(filename);

      expect(sessionId).toBeNull();
    });

    it('should return null for filename with extra content', () => {
      const filename = 'prefix-d9d9f969-cd10-4814-bdbc-0e366c2c9e65.jsonl';
      const sessionId = extractSessionId(filename);

      expect(sessionId).toBeNull();
    });
  });

  describe('isSessionLogFile', () => {
    it('should return true for valid session files', () => {
      expect(isSessionLogFile('d9d9f969-cd10-4814-bdbc-0e366c2c9e65.jsonl')).toBe(true);
      expect(isSessionLogFile('a1b2c3d4-e5f6-7890-abcd-ef1234567890.jsonl')).toBe(true);
    });

    it('should return false for non-session files', () => {
      expect(isSessionLogFile('readme.md')).toBe(false);
      expect(isSessionLogFile('config.json')).toBe(false);
      expect(isSessionLogFile('not-a-uuid.jsonl')).toBe(false);
    });
  });
});

describe('Tool Categorization', () => {
  describe('categorizeToolByName', () => {
    it('should categorize read tools', () => {
      expect(categorizeToolByName('Read')).toBe('read');
      expect(categorizeToolByName('Glob')).toBe('read');
      expect(categorizeToolByName('View')).toBe('read');
    });

    it('should categorize write tools', () => {
      expect(categorizeToolByName('Write')).toBe('write');
      expect(categorizeToolByName('Edit')).toBe('write');
      expect(categorizeToolByName('Delete')).toBe('write');
      expect(categorizeToolByName('NotebookEdit')).toBe('write');
    });

    it('should categorize bash tools', () => {
      expect(categorizeToolByName('Bash')).toBe('bash');
      expect(categorizeToolByName('Shell')).toBe('bash');
      expect(categorizeToolByName('Exec')).toBe('bash');
    });

    it('should categorize search tools', () => {
      expect(categorizeToolByName('WebSearch')).toBe('search');
      expect(categorizeToolByName('WebFetch')).toBe('search');
      expect(categorizeToolByName('Grep')).toBe('search');
    });

    it('should categorize unknown tools as other', () => {
      expect(categorizeToolByName('CustomTool')).toBe('other');
      expect(categorizeToolByName('SomethingNew')).toBe('other');
      expect(categorizeToolByName('Task')).toBe('other');
    });

    it('should handle whitespace in tool names', () => {
      expect(categorizeToolByName('  Read  ')).toBe('read');
      expect(categorizeToolByName('\tBash\t')).toBe('bash');
    });
  });
});

describe('Timestamp Utilities', () => {
  describe('parseTimestamp', () => {
    it('should parse valid ISO-8601 timestamp', () => {
      const timestamp = '2026-01-15T10:00:00.000Z';
      const date = parseTimestamp(timestamp);

      expect(date).toBeInstanceOf(Date);
      expect(date!.getUTCFullYear()).toBe(2026);
      expect(date!.getUTCMonth()).toBe(0); // January
      expect(date!.getUTCDate()).toBe(15);
    });

    it('should return null for invalid timestamp', () => {
      expect(parseTimestamp('not-a-date')).toBeNull();
      expect(parseTimestamp('')).toBeNull();
      expect(parseTimestamp('2026-13-45')).toBeNull();
    });

    it('should handle timestamps without milliseconds', () => {
      const date = parseTimestamp('2026-01-15T10:00:00Z');
      expect(date).not.toBeNull();
    });
  });

  describe('isWithinDateRange', () => {
    const testTimestamp = '2026-01-15T10:00:00.000Z';

    it('should return true when no range specified', () => {
      expect(isWithinDateRange(testTimestamp)).toBe(true);
    });

    it('should return true when within since range', () => {
      expect(isWithinDateRange(testTimestamp, '2026-01-01T00:00:00.000Z')).toBe(true);
    });

    it('should return false when before since date', () => {
      expect(isWithinDateRange(testTimestamp, '2026-01-20T00:00:00.000Z')).toBe(false);
    });

    it('should return true when within until range', () => {
      expect(isWithinDateRange(testTimestamp, undefined, '2026-01-20T00:00:00.000Z')).toBe(true);
    });

    it('should return false when after until date', () => {
      expect(isWithinDateRange(testTimestamp, undefined, '2026-01-10T00:00:00.000Z')).toBe(false);
    });

    it('should return true when within both since and until', () => {
      expect(
        isWithinDateRange(testTimestamp, '2026-01-10T00:00:00.000Z', '2026-01-20T00:00:00.000Z')
      ).toBe(true);
    });

    it('should return false for invalid timestamp', () => {
      expect(isWithinDateRange('invalid')).toBe(false);
    });
  });

  describe('validateTimestamp', () => {
    it('should return valid for valid ISO-8601 timestamp', () => {
      const result = validateTimestamp('2026-01-15T10:00:00.000Z', 'since');
      expect(result.valid).toBe(true);
    });

    it('should return valid for date-only format', () => {
      const result = validateTimestamp('2026-01-15', 'since');
      expect(result.valid).toBe(true);
    });

    it('should return valid for timestamp without milliseconds', () => {
      const result = validateTimestamp('2026-01-15T10:00:00Z', 'until');
      expect(result.valid).toBe(true);
    });

    it('should return error for invalid timestamp string', () => {
      const result = validateTimestamp('not-a-date', 'since');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('Invalid since timestamp');
        expect(result.error).toContain('not-a-date');
        expect(result.error).toContain('ISO-8601');
      }
    });

    it('should return error for empty string', () => {
      const result = validateTimestamp('', 'until');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('cannot be empty');
      }
    });

    it('should return error for whitespace-only string', () => {
      const result = validateTimestamp('   ', 'since');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('cannot be empty');
      }
    });

    it('should return error for invalid date values', () => {
      const result = validateTimestamp('2026-13-45', 'since');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('Invalid since timestamp');
      }
    });

    it('should include field name in error message', () => {
      const sinceResult = validateTimestamp('invalid', 'since');
      const untilResult = validateTimestamp('invalid', 'until');

      expect(sinceResult.valid).toBe(false);
      expect(untilResult.valid).toBe(false);

      if (!sinceResult.valid) {
        expect(sinceResult.error).toContain('since');
      }
      if (!untilResult.valid) {
        expect(untilResult.error).toContain('until');
      }
    });
  });
});

describe('Content Extraction', () => {
  describe('extractTextFromContent', () => {
    it('should extract text from content blocks', () => {
      const content = [
        { type: 'text', text: 'Hello' },
        { type: 'text', text: 'World' },
      ];

      const result = extractTextFromContent(content);
      expect(result).toBe('Hello\nWorld');
    });

    it('should skip non-text blocks', () => {
      const content = [
        { type: 'text', text: 'Hello' },
        { type: 'tool_use', id: 'tool-1', name: 'Read' },
        { type: 'text', text: 'World' },
      ];

      const result = extractTextFromContent(content as Array<{ type: string; text?: string }>);
      expect(result).toBe('Hello\nWorld');
    });

    it('should return empty string for empty array', () => {
      expect(extractTextFromContent([])).toBe('');
    });

    it('should handle blocks without text property', () => {
      const content = [{ type: 'text' }, { type: 'text', text: 'Hello' }];

      const result = extractTextFromContent(content as Array<{ type: string; text?: string }>);
      expect(result).toBe('Hello');
    });
  });

  describe('truncateText', () => {
    it('should not truncate text shorter than maxLength', () => {
      expect(truncateText('Hello', 10)).toBe('Hello');
    });

    it('should truncate text longer than maxLength', () => {
      expect(truncateText('Hello World', 8)).toBe('Hello...');
    });

    it('should handle exact length', () => {
      expect(truncateText('Hello', 5)).toBe('Hello');
    });

    it('should handle very short maxLength', () => {
      expect(truncateText('Hello World', 5)).toBe('He...');
    });

    it('should handle empty string', () => {
      expect(truncateText('', 10)).toBe('');
    });
  });
});
