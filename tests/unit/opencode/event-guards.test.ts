import { describe, it, expect } from 'bun:test';
import {
  isToolEventData,
  isMessageEventData,
  isErrorEventData,
  isTextEventData,
  isStatusEventData,
  extractString,
  extractToolName,
  extractText,
  extractStatus,
} from '../../../src/opencode/event-guards';

describe('event-guards', () => {
  describe('isToolEventData', () => {
    it('should return true for data with name field', () => {
      const data = { name: 'test-tool', input: { foo: 'bar' } };
      expect(isToolEventData(data)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isToolEventData(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isToolEventData(undefined)).toBe(false);
    });

    it('should return false for data without name', () => {
      const data = { input: { foo: 'bar' } };
      expect(isToolEventData(data)).toBe(false);
    });

    it('should return false for data with non-string name', () => {
      const data = { name: 123 };
      expect(isToolEventData(data)).toBe(false);
    });

    it('should return true for data with name and additional fields', () => {
      const data = { name: 'tool', output: 'result', isError: false };
      expect(isToolEventData(data)).toBe(true);
    });
  });

  describe('isMessageEventData', () => {
    it('should return true for data with tokens', () => {
      const data = { tokens: { input: 10, output: 20 } };
      expect(isMessageEventData(data)).toBe(true);
    });

    it('should return true for data with cost', () => {
      const data = { cost: 0.05 };
      expect(isMessageEventData(data)).toBe(true);
    });

    it('should return false for empty object (requires tokens, cost, or finish)', () => {
      expect(isMessageEventData({})).toBe(false);
    });

    it('should return false for null', () => {
      expect(isMessageEventData(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isMessageEventData(undefined)).toBe(false);
    });

    it('should return false for primitives', () => {
      expect(isMessageEventData('string')).toBe(false);
      expect(isMessageEventData(123)).toBe(false);
      expect(isMessageEventData(true)).toBe(false);
    });
  });

  describe('isErrorEventData', () => {
    it('should return true for data with message', () => {
      const data = { message: 'Error occurred' };
      expect(isErrorEventData(data)).toBe(true);
    });

    it('should return false for empty object (requires message or error field)', () => {
      expect(isErrorEventData({})).toBe(false);
    });

    it('should return false for null', () => {
      expect(isErrorEventData(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isErrorEventData(undefined)).toBe(false);
    });
  });

  describe('isTextEventData', () => {
    it('should return true for data with text field', () => {
      const data = { text: 'Hello world' };
      expect(isTextEventData(data)).toBe(true);
    });

    it('should return false for empty object (requires text field)', () => {
      expect(isTextEventData({})).toBe(false);
    });

    it('should return false for null', () => {
      expect(isTextEventData(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isTextEventData(undefined)).toBe(false);
    });
  });

  describe('isStatusEventData', () => {
    it('should return true for data with status field', () => {
      const data = { status: 'processing' };
      expect(isStatusEventData(data)).toBe(true);
    });

    it('should return false for empty object (requires status field)', () => {
      expect(isStatusEventData({})).toBe(false);
    });

    it('should return false for null', () => {
      expect(isStatusEventData(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isStatusEventData(undefined)).toBe(false);
    });
  });

  describe('extractString', () => {
    it('should extract string field from object', () => {
      const data = { name: 'test', value: 123 };
      expect(extractString(data, 'name', 'default')).toBe('test');
    });

    it('should return fallback for missing field', () => {
      const data = { name: 'test' };
      expect(extractString(data, 'missing', 'default')).toBe('default');
    });

    it('should return fallback for non-string field', () => {
      const data = { value: 123 };
      expect(extractString(data, 'value', 'default')).toBe('default');
    });

    it('should return fallback for null data', () => {
      expect(extractString(null, 'field', 'default')).toBe('default');
    });

    it('should return fallback for undefined data', () => {
      expect(extractString(undefined, 'field', 'default')).toBe('default');
    });
  });

  describe('extractToolName', () => {
    it('should extract name from tool event data', () => {
      const data = { name: 'my-tool', input: {} };
      expect(extractToolName(data)).toBe('my-tool');
    });

    it('should return "unknown" for data without name', () => {
      const data = { input: {} };
      expect(extractToolName(data)).toBe('unknown');
    });

    it('should return "unknown" for null', () => {
      expect(extractToolName(null)).toBe('unknown');
    });

    it('should return "unknown" for undefined', () => {
      expect(extractToolName(undefined)).toBe('unknown');
    });
  });

  describe('extractText', () => {
    it('should extract text from text event data', () => {
      const data = { text: 'Hello world' };
      expect(extractText(data)).toBe('Hello world');
    });

    it('should return empty string for non-string text', () => {
      const data = { text: 123 };
      expect(extractText(data)).toBe('');
    });

    it('should return empty string for data without text', () => {
      const data = { other: 'field' };
      expect(extractText(data)).toBe('');
    });

    it('should return empty string for null', () => {
      expect(extractText(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(extractText(undefined)).toBe('');
    });
  });

  describe('extractStatus', () => {
    it('should extract status from status event data', () => {
      const data = { status: 'processing' };
      expect(extractStatus(data)).toBe('processing');
    });

    it('should return default for non-string status', () => {
      const data = { status: 200 };
      expect(extractStatus(data)).toBe('status update');
    });

    it('should return default for data without status', () => {
      const data = { other: 'field' };
      expect(extractStatus(data)).toBe('status update');
    });

    it('should return default for null', () => {
      expect(extractStatus(null)).toBe('status update');
    });

    it('should return default for undefined', () => {
      expect(extractStatus(undefined)).toBe('status update');
    });
  });
});
