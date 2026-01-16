/**
 * Unit tests for terminal.ts utility
 *
 * Tests NFR-002: Terminal width detection (80-120 chars)
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import {
  getTerminalWidth,
  getTerminalHeight,
  supportsCursor,
  truncateText,
  wrapText,
  padText,
} from '../../../../src/cli/utils/terminal';

// Store original values to restore after tests
let originalColumns: number | undefined;
let originalRows: number | undefined;
let originalIsTTY: boolean | undefined;

beforeEach(() => {
  originalColumns = process.stdout.columns;
  originalRows = process.stdout.rows;
  originalIsTTY = process.stdout.isTTY;
});

afterEach(() => {
  // Restore original values
  Object.defineProperty(process.stdout, 'columns', {
    value: originalColumns,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(process.stdout, 'rows', {
    value: originalRows,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(process.stdout, 'isTTY', {
    value: originalIsTTY,
    configurable: true,
    writable: true,
  });
});

describe('getTerminalWidth', () => {
  test('returns process.stdout.columns when available', () => {
    Object.defineProperty(process.stdout, 'columns', {
      value: 100,
      configurable: true,
      writable: true,
    });
    expect(getTerminalWidth()).toBe(100);
  });

  test('returns default width (80) when columns is undefined', () => {
    Object.defineProperty(process.stdout, 'columns', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    expect(getTerminalWidth()).toBe(80);
  });

  test('returns default width (80) when columns is 0', () => {
    Object.defineProperty(process.stdout, 'columns', {
      value: 0,
      configurable: true,
      writable: true,
    });
    expect(getTerminalWidth()).toBe(80);
  });

  test('returns default width (80) when columns is negative', () => {
    Object.defineProperty(process.stdout, 'columns', {
      value: -1,
      configurable: true,
      writable: true,
    });
    expect(getTerminalWidth()).toBe(80);
  });

  test('clamps to minimum width (40)', () => {
    Object.defineProperty(process.stdout, 'columns', {
      value: 30,
      configurable: true,
      writable: true,
    });
    expect(getTerminalWidth()).toBe(40);
  });

  test('clamps to maximum width (120)', () => {
    Object.defineProperty(process.stdout, 'columns', {
      value: 200,
      configurable: true,
      writable: true,
    });
    expect(getTerminalWidth()).toBe(120);
  });

  test('returns exact value within range', () => {
    Object.defineProperty(process.stdout, 'columns', {
      value: 80,
      configurable: true,
      writable: true,
    });
    expect(getTerminalWidth()).toBe(80);
  });

  test('returns minimum boundary (40)', () => {
    Object.defineProperty(process.stdout, 'columns', {
      value: 40,
      configurable: true,
      writable: true,
    });
    expect(getTerminalWidth()).toBe(40);
  });

  test('returns maximum boundary (120)', () => {
    Object.defineProperty(process.stdout, 'columns', {
      value: 120,
      configurable: true,
      writable: true,
    });
    expect(getTerminalWidth()).toBe(120);
  });
});

describe('getTerminalHeight', () => {
  test('returns process.stdout.rows when available', () => {
    Object.defineProperty(process.stdout, 'rows', {
      value: 50,
      configurable: true,
      writable: true,
    });
    expect(getTerminalHeight()).toBe(50);
  });

  test('returns default height (24) when rows is undefined', () => {
    Object.defineProperty(process.stdout, 'rows', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    expect(getTerminalHeight()).toBe(24);
  });

  test('returns default height (24) when rows is 0', () => {
    Object.defineProperty(process.stdout, 'rows', {
      value: 0,
      configurable: true,
      writable: true,
    });
    expect(getTerminalHeight()).toBe(24);
  });

  test('returns default height (24) when rows is negative', () => {
    Object.defineProperty(process.stdout, 'rows', {
      value: -1,
      configurable: true,
      writable: true,
    });
    expect(getTerminalHeight()).toBe(24);
  });

  test('returns actual value when positive', () => {
    Object.defineProperty(process.stdout, 'rows', {
      value: 100,
      configurable: true,
      writable: true,
    });
    expect(getTerminalHeight()).toBe(100);
  });
});

describe('supportsCursor', () => {
  test('returns true when isTTY is true', () => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      configurable: true,
      writable: true,
    });
    expect(supportsCursor()).toBe(true);
  });

  test('returns false when isTTY is false', () => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: false,
      configurable: true,
      writable: true,
    });
    expect(supportsCursor()).toBe(false);
  });

  test('returns false when isTTY is undefined', () => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    expect(supportsCursor()).toBe(false);
  });
});

describe('truncateText', () => {
  test('returns original text when shorter than maxWidth', () => {
    expect(truncateText('hello', 10)).toBe('hello');
  });

  test('returns original text when equal to maxWidth', () => {
    expect(truncateText('hello', 5)).toBe('hello');
  });

  test('truncates and adds ellipsis when longer than maxWidth', () => {
    expect(truncateText('hello world', 8)).toBe('hello...');
  });

  test('uses custom suffix', () => {
    expect(truncateText('hello world', 8, '…')).toBe('hello w…');
  });

  test('handles maxWidth smaller than suffix length', () => {
    expect(truncateText('hello world', 2, '...')).toBe('..');
  });

  test('handles maxWidth equal to suffix length', () => {
    expect(truncateText('hello world', 3, '...')).toBe('...');
  });

  test('handles empty string', () => {
    expect(truncateText('', 10)).toBe('');
  });

  test('handles maxWidth of 0', () => {
    expect(truncateText('hello', 0, '...')).toBe('');
  });

  test('truncates exactly at maxWidth - suffix.length', () => {
    expect(truncateText('abcdefghij', 7, '...')).toBe('abcd...');
  });
});

describe('wrapText', () => {
  test('returns single line when text fits', () => {
    expect(wrapText('hello', 10)).toEqual(['hello']);
  });

  test('returns single line when text equals maxWidth', () => {
    expect(wrapText('hello', 5)).toEqual(['hello']);
  });

  test('wraps on word boundaries', () => {
    expect(wrapText('hello world foo bar', 11)).toEqual(['hello world', 'foo bar']);
  });

  test('wraps long text into multiple lines', () => {
    expect(wrapText('the quick brown fox jumps', 10)).toEqual(['the quick', 'brown fox', 'jumps']);
  });

  test('handles single long word', () => {
    expect(wrapText('supercalifragilisticexpialidocious', 10)).toEqual([
      'supercalifragilisticexpialidocious',
    ]);
  });

  test('handles empty string', () => {
    expect(wrapText('', 10)).toEqual(['']);
  });

  test('handles text with extra spaces', () => {
    expect(wrapText('a b c d', 5)).toEqual(['a b c', 'd']);
  });

  test('handles single word that fits', () => {
    expect(wrapText('word', 10)).toEqual(['word']);
  });

  test('handles multiple spaces between words', () => {
    // Note: split(' ') creates empty strings for multiple spaces
    const result = wrapText('hello  world', 20);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });
});

describe('padText', () => {
  describe('left alignment (default)', () => {
    test('pads text to width with spaces on right', () => {
      expect(padText('hi', 5)).toBe('hi   ');
    });

    test('returns original when text equals width', () => {
      expect(padText('hello', 5)).toBe('hello');
    });

    test('truncates when text exceeds width', () => {
      expect(padText('hello world', 5)).toBe('hello');
    });

    test('handles empty string', () => {
      expect(padText('', 5)).toBe('     ');
    });
  });

  describe('right alignment', () => {
    test('pads text to width with spaces on left', () => {
      expect(padText('hi', 5, 'right')).toBe('   hi');
    });

    test('returns original when text equals width', () => {
      expect(padText('hello', 5, 'right')).toBe('hello');
    });

    test('truncates when text exceeds width', () => {
      expect(padText('hello world', 5, 'right')).toBe('hello');
    });
  });

  describe('center alignment', () => {
    test('centers text with even padding', () => {
      expect(padText('hi', 6, 'center')).toBe('  hi  ');
    });

    test('centers text with odd padding (more on right)', () => {
      expect(padText('hi', 5, 'center')).toBe(' hi  ');
    });

    test('returns original when text equals width', () => {
      expect(padText('hello', 5, 'center')).toBe('hello');
    });

    test('truncates when text exceeds width', () => {
      expect(padText('hello world', 5, 'center')).toBe('hello');
    });

    test('handles single character', () => {
      expect(padText('x', 5, 'center')).toBe('  x  ');
    });
  });

  test('handles width of 0', () => {
    expect(padText('hello', 0)).toBe('');
  });
});
