/**
 * Unit tests for output.ts utility
 *
 * Tests FR-012: Auto-detect output mode based on TTY and flags
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import {
  getOutputMode,
  getOutputFormat,
  supportsStreaming,
} from '../../../../src/cli/utils/output';
import type { GlobalOptions } from '../../../../src/cli/types';

// Store original values to restore after tests
let originalIsTTY: boolean | undefined;
let originalNoColor: string | undefined;

beforeEach(() => {
  originalIsTTY = process.stdout.isTTY;
  originalNoColor = process.env['NO_COLOR'];
});

afterEach(() => {
  // Restore original values - use Object.defineProperty for isTTY
  Object.defineProperty(process.stdout, 'isTTY', {
    value: originalIsTTY,
    configurable: true,
    writable: true,
  });
  if (originalNoColor === undefined) {
    delete process.env['NO_COLOR'];
  } else {
    process.env['NO_COLOR'] = originalNoColor;
  }
});

describe('getOutputMode', () => {
  describe('explicit flags take priority', () => {
    test('returns json when --json flag is set', () => {
      const options: GlobalOptions = { json: true };
      expect(getOutputMode(options)).toBe('json');
    });

    test('returns markdown when --markdown flag is set', () => {
      const options: GlobalOptions = { markdown: true };
      expect(getOutputMode(options)).toBe('markdown');
    });

    test('returns plain when --plain flag is set', () => {
      const options: GlobalOptions = { plain: true };
      expect(getOutputMode(options)).toBe('plain');
    });

    test('json takes priority over markdown', () => {
      const options: GlobalOptions = { json: true, markdown: true };
      expect(getOutputMode(options)).toBe('json');
    });

    test('json takes priority over plain', () => {
      const options: GlobalOptions = { json: true, plain: true };
      expect(getOutputMode(options)).toBe('json');
    });

    test('markdown takes priority over plain', () => {
      const options: GlobalOptions = { markdown: true, plain: true };
      expect(getOutputMode(options)).toBe('markdown');
    });
  });

  describe('non-TTY detection', () => {
    test('returns json when stdout is not TTY', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: false,
        configurable: true,
        writable: true,
      });
      const options: GlobalOptions = {};
      expect(getOutputMode(options)).toBe('json');
    });

    test('explicit flags override non-TTY detection', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: false,
        configurable: true,
        writable: true,
      });
      const options: GlobalOptions = { plain: true };
      expect(getOutputMode(options)).toBe('plain');
    });
  });

  describe('NO_COLOR environment variable', () => {
    test('returns plain when NO_COLOR is set', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        configurable: true,
        writable: true,
      });
      process.env['NO_COLOR'] = '1';
      const options: GlobalOptions = {};
      expect(getOutputMode(options)).toBe('plain');
    });

    test('explicit flags override NO_COLOR', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        configurable: true,
        writable: true,
      });
      process.env['NO_COLOR'] = '1';
      const options: GlobalOptions = { json: true };
      expect(getOutputMode(options)).toBe('json');
    });
  });

  describe('default behavior', () => {
    test('returns terminal when TTY and no flags', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        configurable: true,
        writable: true,
      });
      delete process.env['NO_COLOR'];
      const options: GlobalOptions = {};
      expect(getOutputMode(options)).toBe('terminal');
    });

    test('returns terminal with empty options object', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        configurable: true,
        writable: true,
      });
      delete process.env['NO_COLOR'];
      expect(getOutputMode({})).toBe('terminal');
    });
  });
});

describe('getOutputFormat', () => {
  test('returns complete output format configuration', () => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      configurable: true,
      writable: true,
    });
    delete process.env['NO_COLOR'];

    const options: GlobalOptions = { json: true };
    const format = getOutputFormat(options);

    expect(format.mode).toBe('json');
    expect(format.isTTY).toBe(true);
    expect(typeof format.supportsColor).toBe('boolean');
    expect(typeof format.terminalWidth).toBe('number');
  });

  test('returns isTTY false when not TTY', () => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: false,
      configurable: true,
      writable: true,
    });
    const format = getOutputFormat({});
    expect(format.isTTY).toBe(false);
  });

  test('returns isTTY false when undefined', () => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    const format = getOutputFormat({});
    expect(format.isTTY).toBe(false);
  });

  test('includes terminal width in reasonable range', () => {
    const format = getOutputFormat({});
    expect(format.terminalWidth).toBeGreaterThanOrEqual(40);
    expect(format.terminalWidth).toBeLessThanOrEqual(120);
  });
});

describe('supportsStreaming', () => {
  test('terminal mode supports streaming', () => {
    expect(supportsStreaming('terminal')).toBe(true);
  });

  test('json mode supports streaming (JSON Lines)', () => {
    expect(supportsStreaming('json')).toBe(true);
  });

  test('markdown mode does not support streaming', () => {
    expect(supportsStreaming('markdown')).toBe(false);
  });

  test('plain mode does not support streaming', () => {
    expect(supportsStreaming('plain')).toBe(false);
  });
});
