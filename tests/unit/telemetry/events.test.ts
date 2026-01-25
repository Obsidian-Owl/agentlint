/**
 * Tests for telemetry event types and utilities.
 */

import { describe, test, expect } from 'bun:test';
import {
  createTelemetryEvent,
  sanitizeEventData,
  getTelemetryMeta,
  generateEventId,
  FORBIDDEN_FIELDS,
} from '../../../src/telemetry/events';

describe('Telemetry Events', () => {
  describe('generateEventId', () => {
    test('generates a valid UUID', () => {
      const id = generateEventId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    test('generates unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateEventId()));
      expect(ids.size).toBe(100);
    });
  });

  describe('getTelemetryMeta', () => {
    test('returns metadata with expected fields', () => {
      const meta = getTelemetryMeta();
      expect(meta).toHaveProperty('version');
      expect(meta).toHaveProperty('platform');
      expect(meta).toHaveProperty('nodeVersion');
    });

    test('platform matches process.platform', () => {
      const meta = getTelemetryMeta();
      expect(meta.platform).toBe(process.platform);
    });
  });

  describe('sanitizeEventData', () => {
    test('passes through safe data', () => {
      const data = {
        tool: 'discover_configs',
        durationMs: 150,
        success: true,
      };
      const sanitized = sanitizeEventData(data);
      expect(sanitized).toEqual(data);
    });

    test('strips forbidden fields', () => {
      const data = {
        tool: 'discover_configs',
        content: 'secret content',
        prompt: 'hidden prompt',
        response: 'AI response',
        path: '/private/path',
        file: 'secret.txt',
        code: 'const x = 1;',
        success: true,
      };
      const sanitized = sanitizeEventData(data);
      expect(sanitized).toEqual({
        tool: 'discover_configs',
        success: true,
      });
    });

    test('strips fields containing forbidden substrings', () => {
      const data = {
        tool: 'test',
        fileContent: 'should be stripped',
        pathName: 'should be stripped',
        promptText: 'should be stripped',
        responseData: 'should be stripped',
        apiKey: 'should be stripped',
        secretValue: 'should be stripped',
        success: true,
      };
      const sanitized = sanitizeEventData(data);
      expect(sanitized).toEqual({
        tool: 'test',
        success: true,
      });
    });

    test('recursively sanitizes nested objects', () => {
      const data = {
        outer: {
          inner: {
            content: 'secret',
            safe: 'visible',
          },
        },
      };
      const sanitized = sanitizeEventData(data);
      expect(sanitized).toEqual({
        outer: {
          inner: {
            safe: 'visible',
          },
        },
      });
    });

    test('sanitizes arrays of objects', () => {
      const data = {
        items: [
          { id: 1, content: 'secret', name: 'visible' },
          { id: 2, path: '/hidden', name: 'also visible' },
        ],
      };
      const sanitized = sanitizeEventData(data);
      expect(sanitized).toEqual({
        items: [
          { id: 1, name: 'visible' },
          { id: 2, name: 'also visible' },
        ],
      });
    });

    test('preserves primitive arrays', () => {
      const data = {
        numbers: [1, 2, 3],
        strings: ['a', 'b', 'c'],
      };
      const sanitized = sanitizeEventData(data);
      expect(sanitized).toEqual(data);
    });
  });

  describe('createTelemetryEvent', () => {
    test('creates event with all required fields', () => {
      const event = createTelemetryEvent('tool.call', 'session-123', 5, {
        tool: 'test_tool',
        durationMs: 100,
      });

      expect(event.type).toBe('tool.call');
      expect(event.sessionId).toBe('session-123');
      expect(event.sequence).toBe(5);
      expect(event.data).toEqual({ tool: 'test_tool', durationMs: 100 });
      expect(event.eventId).toBeTruthy();
      expect(event.timestamp).toBeTruthy();
      expect(event.meta).toBeTruthy();
    });

    test('includes parentEventId when provided', () => {
      const event = createTelemetryEvent(
        'finding.detected',
        'session-123',
        10,
        { findingType: 'missing_config' },
        'parent-event-id'
      );

      expect(event.parentEventId).toBe('parent-event-id');
    });

    test('omits parentEventId when not provided', () => {
      const event = createTelemetryEvent('session.start', 'session-123', 0, {});
      expect(event.parentEventId).toBeUndefined();
    });

    test('sanitizes data automatically', () => {
      const event = createTelemetryEvent('tool.call', 'session-123', 1, {
        tool: 'parse_config',
        content: 'should be stripped',
        durationMs: 50,
      });

      expect(event.data).toEqual({
        tool: 'parse_config',
        durationMs: 50,
      });
    });

    test('generates valid timestamp', () => {
      const event = createTelemetryEvent('session.end', 'session-123', 99, {});
      const timestamp = new Date(event.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).not.toBeNaN();
    });
  });

  describe('FORBIDDEN_FIELDS', () => {
    test('includes critical privacy fields', () => {
      expect(FORBIDDEN_FIELDS).toContain('content');
      expect(FORBIDDEN_FIELDS).toContain('prompt');
      expect(FORBIDDEN_FIELDS).toContain('response');
      expect(FORBIDDEN_FIELDS).toContain('path');
      expect(FORBIDDEN_FIELDS).toContain('file');
      expect(FORBIDDEN_FIELDS).toContain('code');
      expect(FORBIDDEN_FIELDS).toContain('message');
      expect(FORBIDDEN_FIELDS).toContain('stack');
      expect(FORBIDDEN_FIELDS).toContain('secret');
      expect(FORBIDDEN_FIELDS).toContain('key');
      expect(FORBIDDEN_FIELDS).toContain('token');
      expect(FORBIDDEN_FIELDS).toContain('password');
      expect(FORBIDDEN_FIELDS).toContain('credential');
    });
  });
});
