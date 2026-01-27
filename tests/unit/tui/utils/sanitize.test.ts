/**
 * Tests for terminal output sanitization utilities
 *
 * @module tests/unit/tui/utils/sanitize
 */

import { describe, expect, it } from 'bun:test';
import {
  sanitizeForTerminal,
  containsTerminalSequences,
  truncateForDisplay,
  MAX_INPUT_LENGTH,
  MAX_DISPLAY_LENGTH,
} from '../../../../src/tui/utils/sanitize';

describe('sanitizeForTerminal', () => {
  it('returns clean text unchanged', () => {
    expect(sanitizeForTerminal('feat/my-feature')).toBe('feat/my-feature');
    expect(sanitizeForTerminal('main')).toBe('main');
    expect(sanitizeForTerminal('ep01-core-foundation')).toBe('ep01-core-foundation');
  });

  it('strips ANSI color codes', () => {
    expect(sanitizeForTerminal('\x1b[31mred text\x1b[0m')).toBe('red text');
    expect(sanitizeForTerminal('\x1b[1;32mbold green\x1b[0m')).toBe('bold green');
  });

  it('strips ANSI cursor movement codes', () => {
    expect(sanitizeForTerminal('before\x1b[2Aafter')).toBe('beforeafter');
    expect(sanitizeForTerminal('line\x1b[Krest')).toBe('linerest');
  });

  it('strips OSC sequences (terminal title changes)', () => {
    expect(sanitizeForTerminal('\x1b]0;malicious title\x07normal')).toBe('normal');
  });

  it('strips dangerous control characters', () => {
    expect(sanitizeForTerminal('hello\x00world')).toBe('helloworld');
    expect(sanitizeForTerminal('test\x08\x08ing')).toBe('testing');
  });

  it('preserves newlines and tabs', () => {
    // \n (0x0A) and \t (0x09) are allowed
    expect(sanitizeForTerminal('line1\nline2')).toBe('line1\nline2');
    expect(sanitizeForTerminal('col1\tcol2')).toBe('col1\tcol2');
  });

  it('handles complex malicious input', () => {
    const malicious = '\x1b]0;pwned\x07\x1b[2J\x1b[H\x1b[31mYou have been hacked\x1b[0m';
    expect(sanitizeForTerminal(malicious)).toBe('You have been hacked');
  });
});

describe('containsTerminalSequences', () => {
  it('returns false for clean text', () => {
    expect(containsTerminalSequences('feat/my-feature')).toBe(false);
    expect(containsTerminalSequences('normal branch name')).toBe(false);
  });

  it('returns true for ANSI escape sequences', () => {
    expect(containsTerminalSequences('\x1b[31mred\x1b[0m')).toBe(true);
  });

  it('returns true for OSC sequences', () => {
    expect(containsTerminalSequences('\x1b]0;title\x07')).toBe(true);
  });

  it('returns true for control characters', () => {
    expect(containsTerminalSequences('test\x00null')).toBe(true);
  });
});

describe('truncateForDisplay', () => {
  it('returns short text unchanged', () => {
    expect(truncateForDisplay('short')).toBe('short');
  });

  it('truncates text exceeding max length', () => {
    const long = 'a'.repeat(MAX_DISPLAY_LENGTH + 100);
    const result = truncateForDisplay(long);
    expect(result.length).toBe(MAX_DISPLAY_LENGTH);
    expect(result.endsWith('...')).toBe(true);
  });

  it('respects custom max length', () => {
    const result = truncateForDisplay('hello world', 8);
    expect(result).toBe('hello...');
  });
});

describe('constants', () => {
  it('exports expected limits', () => {
    expect(MAX_INPUT_LENGTH).toBe(10_000);
    expect(MAX_DISPLAY_LENGTH).toBe(5_000);
  });
});
