/**
 * Telemetry Utils Tests
 *
 * Tests for shared telemetry utility functions:
 * - truncateToolOutput: Truncate tool output for telemetry
 * - truncateToolInput: Truncate tool input for telemetry
 * - extractErrorMessage: Extract error messages from various formats
 */

import { describe, test, expect } from 'bun:test';
import {
  truncateToolOutput,
  truncateToolInput,
  extractErrorMessage,
} from '../../../src/orchestration/telemetry-utils';

// =============================================================================
// truncateToolOutput Tests
// =============================================================================

describe('truncateToolOutput', () => {
  test('should return null as-is', () => {
    const result = truncateToolOutput(null);
    expect(result).toBe(null);
  });

  test('should return undefined as-is', () => {
    const result = truncateToolOutput(undefined);
    expect(result).toBe(undefined);
  });

  test('should return short strings unchanged', () => {
    const input = 'short string';
    const result = truncateToolOutput(input);
    expect(result).toBe(input);
  });

  test('should truncate long strings with marker', () => {
    const longString = 'a'.repeat(6000);
    const result = truncateToolOutput(longString, 5000);
    expect(typeof result).toBe('string');
    expect((result as string).length).toBeLessThan(longString.length);
    expect((result as string).endsWith('... [truncated]')).toBe(true);
  });

  test('should return small arrays unchanged', () => {
    const input = [1, 2, 3];
    const result = truncateToolOutput(input);
    expect(result).toEqual(input);
  });

  test('should truncate large arrays to first 3 items', () => {
    const input = Array.from({ length: 100 }, (_, i) => 'x'.repeat(100) + i);
    const result = truncateToolOutput(input);
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    const obj = result as Record<string, unknown>;
    expect(Array.isArray(obj.items)).toBe(true);
    expect((obj.items as unknown[]).length).toBe(3);
    expect(obj._truncated).toBe(true);
    expect(obj._totalItems).toBe(100);
  });

  test('should return small objects unchanged', () => {
    const input = { key: 'value', num: 42 };
    const result = truncateToolOutput(input);
    expect(result).toEqual(input);
  });

  test('should truncate large objects with summary', () => {
    const input = {
      data: 'x'.repeat(6000),
      nested: { deep: 'y'.repeat(1000) },
    };
    const result = truncateToolOutput(input, 5000);
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    const obj = result as Record<string, unknown>;
    expect(obj._truncated).toBe(true);
    expect(typeof obj._summary).toBe('string');
    expect((obj._summary as string).endsWith('... [truncated]')).toBe(true);
  });

  test('should return primitives as-is', () => {
    expect(truncateToolOutput(42)).toBe(42);
    expect(truncateToolOutput(true)).toBe(true);
    expect(truncateToolOutput(false)).toBe(false);
  });

  test('should respect custom maxLength parameter', () => {
    const input = 'a'.repeat(1000);
    const result = truncateToolOutput(input, 100);
    expect((result as string).length).toBeLessThanOrEqual(115); // 100 + marker
  });
});

// =============================================================================
// truncateToolInput Tests
// =============================================================================

describe('truncateToolInput', () => {
  test('should return small inputs unchanged', () => {
    const input = { path: '/test/file.ts', content: 'short' };
    const result = truncateToolInput(input);
    expect(result).toEqual(input);
  });

  test('should truncate large inputs field-by-field', () => {
    const input = {
      field1: 'a'.repeat(3000),
      field2: 'b'.repeat(3000),
    };
    const result = truncateToolInput(input, 5000);
    expect(result._inputTruncated).toBe(true);
    expect(typeof result._originalSize).toBe('number');
    expect((result._originalSize as number) > 5000).toBe(true);
  });

  test('should truncate large string values to 100 chars', () => {
    const input = {
      shortField: 'short',
      longField: 'x'.repeat(200),
    };
    const result = truncateToolInput(input, 100);
    expect(typeof result.longField).toBe('string');
    expect((result.longField as string).length).toBeLessThanOrEqual(115); // 100 + marker
  });

  test('should mark non-string values as [truncated]', () => {
    const input = {
      array: Array.from({ length: 100 }, (_, i) => 'x'.repeat(50) + i),
      object: { nested: { deep: 'y'.repeat(100) } },
    };
    const result = truncateToolInput(input, 100);
    expect(result.array).toBe('[truncated]');
    expect(result.object).toBe('[truncated]');
  });

  test('should add _inputTruncated and _originalSize markers', () => {
    const input = { data: 'x'.repeat(6000) };
    const result = truncateToolInput(input, 5000);
    expect(result._inputTruncated).toBe(true);
    expect(typeof result._originalSize).toBe('number');
    expect((result._originalSize as number) > 5000).toBe(true);
  });

  test('should respect custom maxLength parameter', () => {
    const input = { field: 'a'.repeat(500) };
    const result = truncateToolInput(input, 100);
    expect(result._inputTruncated).toBe(true);
  });

  test('should preserve small fields when truncating', () => {
    const input = {
      small: 'keep',
      large: 'x'.repeat(6000),
    };
    const result = truncateToolInput(input, 5000);
    expect(result.small).toBe('keep');
    expect(result._inputTruncated).toBe(true);
  });
});

// =============================================================================
// extractErrorMessage Tests
// =============================================================================

describe('extractErrorMessage', () => {
  test('should extract from string', () => {
    const result = extractErrorMessage('Error: Something went wrong');
    expect(result).toBe('Error: Something went wrong');
  });

  test('should limit string to 500 chars', () => {
    const longError = 'x'.repeat(600);
    const result = extractErrorMessage(longError);
    expect((result as string).length).toBe(500);
  });

  test('should extract from array with text block', () => {
    const output = [{ type: 'text', text: 'Error message' }];
    const result = extractErrorMessage(output);
    expect(result).toBe('Error message');
  });

  test('should extract from array with string element', () => {
    const output = ['Error message'];
    const result = extractErrorMessage(output);
    expect(result).toBe('Error message');
  });

  test('should extract from object with message field', () => {
    const output = { message: 'Error occurred' };
    const result = extractErrorMessage(output);
    expect(result).toBe('Error occurred');
  });

  test('should extract from object with error field', () => {
    const output = { error: 'Something failed' };
    const result = extractErrorMessage(output);
    expect(result).toBe('Something failed');
  });

  test('should extract from object with text field', () => {
    const output = { text: 'Text error' };
    const result = extractErrorMessage(output);
    expect(result).toBe('Text error');
  });

  test('should return undefined for unrecognized formats', () => {
    expect(extractErrorMessage({})).toBe(undefined);
    expect(extractErrorMessage([])).toBe(undefined);
    expect(extractErrorMessage(42)).toBe(undefined);
  });

  test('should handle empty arrays', () => {
    const result = extractErrorMessage([]);
    expect(result).toBe(undefined);
  });

  test('should limit extracted message to 500 chars', () => {
    const longMessage = 'x'.repeat(600);
    const output = { message: longMessage };
    const result = extractErrorMessage(output);
    expect((result as string).length).toBe(500);
  });

  test('should prioritize message field over others', () => {
    const output = {
      message: 'Primary message',
      error: 'Secondary error',
      text: 'Tertiary text',
    };
    const result = extractErrorMessage(output);
    expect(result).toBe('Primary message');
  });

  test('should handle text block with non-string text field', () => {
    const output = [{ type: 'text', text: 123 }];
    const result = extractErrorMessage(output);
    expect(result).toBe('123');
  });
});
