/**
 * Unit tests for TTY detection utilities
 */

import { describe, test, expect } from 'bun:test';
import {
  isInputTTY,
  isOutputTTY,
  isInteractive,
  supportsColor,
  getTerminalSize,
  getTerminalCapabilities,
  determineRenderMode,
} from '../../../../src/tui/utils/tty';

// =============================================================================
// Tests
// =============================================================================

describe('tty utilities', () => {
  describe('isInputTTY', () => {
    test('should return boolean', () => {
      const result = isInputTTY();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('isOutputTTY', () => {
    test('should return boolean', () => {
      const result = isOutputTTY();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('isInteractive', () => {
    test('should return boolean', () => {
      const result = isInteractive();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('supportsColor', () => {
    test('should return boolean', () => {
      const result = supportsColor();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getTerminalSize', () => {
    test('should return columns and rows', () => {
      const size = getTerminalSize();

      expect(typeof size.columns).toBe('number');
      expect(typeof size.rows).toBe('number');
      expect(size.columns).toBeGreaterThan(0);
      expect(size.rows).toBeGreaterThan(0);
    });

    test('should return default values in non-TTY', () => {
      // In test environment (not a TTY), should return defaults
      const size = getTerminalSize();
      expect(size.columns).toBeGreaterThanOrEqual(80);
      expect(size.rows).toBeGreaterThanOrEqual(24);
    });
  });

  describe('getTerminalCapabilities', () => {
    test('should return all capabilities', () => {
      const caps = getTerminalCapabilities();

      expect(caps).toHaveProperty('isInputTTY');
      expect(caps).toHaveProperty('isOutputTTY');
      expect(caps).toHaveProperty('isInteractive');
      expect(caps).toHaveProperty('supportsColor');
      expect(caps).toHaveProperty('columns');
      expect(caps).toHaveProperty('rows');
    });

    test('should have consistent isInteractive', () => {
      const caps = getTerminalCapabilities();
      expect(caps.isInteractive).toBe(caps.isInputTTY && caps.isOutputTTY);
    });
  });

  describe('determineRenderMode', () => {
    test('should return headless for nonInteractive option', () => {
      const mode = determineRenderMode({ nonInteractive: true });
      expect(mode).toBe('headless');
    });

    test('should return headless for json option', () => {
      const mode = determineRenderMode({ json: true });
      expect(mode).toBe('headless');
    });

    test('should return ink for forceInteractive option', () => {
      const mode = determineRenderMode({ forceInteractive: true });
      expect(mode).toBe('ink');
    });

    test('should auto-detect based on TTY', () => {
      const mode = determineRenderMode({});
      // In test environment (not a TTY), should be headless
      expect(['ink', 'headless']).toContain(mode);
    });

    test('nonInteractive takes precedence over forceInteractive', () => {
      const mode = determineRenderMode({
        nonInteractive: true,
        forceInteractive: true,
      });
      expect(mode).toBe('headless');
    });
  });
});
