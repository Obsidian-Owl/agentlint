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
      expect(meta).toHaveProperty('source');
    });

    test('platform matches process.platform', () => {
      const meta = getTelemetryMeta();
      expect(meta.platform).toBe(process.platform);
    });

    test('source is set correctly for test environment', () => {
      const meta = getTelemetryMeta();
      // In test environment, should be 'agentlint-cli-test'
      expect(meta.source).toBe('agentlint-cli-test');
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

    test('strips secret-related fields only', () => {
      // New behavior: only secret-related fields are stripped
      // Debugging info (content, path, etc.) is preserved for alpha telemetry
      const data = {
        tool: 'discover_configs',
        content: 'debugging content preserved',
        prompt: 'prompt preserved for debugging',
        path: '/path/preserved',
        password: 'should be stripped',
        secret: 'should be stripped',
        apikey: 'should be stripped',
        success: true,
      };
      const sanitized = sanitizeEventData(data);
      expect(sanitized).toEqual({
        tool: 'discover_configs',
        content: 'debugging content preserved',
        prompt: 'prompt preserved for debugging',
        path: '/path/preserved',
        success: true,
      });
    });

    test('strips fields containing secret-related substrings', () => {
      // Only secret-related field names are stripped
      const data = {
        tool: 'test',
        filePath: 'preserved for debugging',
        pathName: 'preserved for debugging',
        apiKey: 'should be stripped',
        myPassword: 'should be stripped',
        secretValue: 'should be stripped',
        privateKey: 'should be stripped',
        success: true,
      };
      const sanitized = sanitizeEventData(data);
      expect(sanitized).toEqual({
        tool: 'test',
        filePath: 'preserved for debugging',
        pathName: 'preserved for debugging',
        success: true,
      });
    });

    test('recursively sanitizes nested objects', () => {
      const data = {
        outer: {
          inner: {
            content: 'preserved for debugging',
            password: 'should be stripped',
            safe: 'visible',
          },
        },
      };
      const sanitized = sanitizeEventData(data);
      expect(sanitized).toEqual({
        outer: {
          inner: {
            content: 'preserved for debugging',
            safe: 'visible',
          },
        },
      });
    });

    test('sanitizes arrays of objects', () => {
      const data = {
        items: [
          { id: 1, content: 'preserved', name: 'visible' },
          { id: 2, path: '/preserved', name: 'also visible', secret: 'stripped' },
        ],
      };
      const sanitized = sanitizeEventData(data);
      expect(sanitized).toEqual({
        items: [
          { id: 1, content: 'preserved', name: 'visible' },
          { id: 2, path: '/preserved', name: 'also visible' },
        ],
      });
    });

    test('redacts secret patterns in string values', () => {
      const data = {
        tool: 'test',
        message: 'API key is sk-ant-abc123xyz456 and token is ghp_a1b2c3d4',
        path: '/safe/path',
      };
      const sanitized = sanitizeEventData(data);
      // Secrets in values are redacted by pattern matching
      expect(sanitized.message).toContain('[REDACTED');
      expect(sanitized.path).toBe('/safe/path');
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
      // Only secret-related fields are stripped, debugging content is preserved
      const event = createTelemetryEvent('tool.call', 'session-123', 1, {
        tool: 'parse_config',
        content: 'preserved for debugging',
        password: 'should be stripped',
        durationMs: 50,
      });

      expect(event.data).toEqual({
        tool: 'parse_config',
        content: 'preserved for debugging',
        durationMs: 50,
      });
    });

    test('generates valid timestamp', () => {
      const event = createTelemetryEvent('session.end', 'session-123', 99, {});
      const timestamp = new Date(event.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).not.toBeNaN();
    });

    test('includes startTime and endTime', () => {
      const before = Date.now();
      const event = createTelemetryEvent('tool.call', 'session-123', 1, {
        tool: 'test',
      });
      const after = Date.now();

      expect(event.startTime).toBeGreaterThanOrEqual(before);
      expect(event.startTime).toBeLessThanOrEqual(after);
      expect(event.endTime).toBeGreaterThanOrEqual(before);
      expect(event.endTime).toBeLessThanOrEqual(after);
    });

    test('uses provided startTime and endTime', () => {
      const startTime = 1700000000000;
      const endTime = 1700000001000;

      const event = createTelemetryEvent(
        'tool.call',
        'session-123',
        1,
        { tool: 'test' },
        { startTime, endTime }
      );

      expect(event.startTime).toBe(startTime);
      expect(event.endTime).toBe(endTime);
    });

    test('accepts options object with parentEventId', () => {
      const event = createTelemetryEvent(
        'finding.detected',
        'session-123',
        10,
        { findingType: 'test' },
        { parentEventId: 'parent-123', startTime: 1000, endTime: 2000 }
      );

      expect(event.parentEventId).toBe('parent-123');
      expect(event.startTime).toBe(1000);
      expect(event.endTime).toBe(2000);
    });
  });

  describe('FORBIDDEN_FIELDS', () => {
    test('includes secret-related fields only (not debugging info)', () => {
      // These MUST be in FORBIDDEN_FIELDS (actual secrets)
      expect(FORBIDDEN_FIELDS).toContain('secret');
      expect(FORBIDDEN_FIELDS).toContain('apikey');
      expect(FORBIDDEN_FIELDS).toContain('api_key');
      expect(FORBIDDEN_FIELDS).toContain('password');
      expect(FORBIDDEN_FIELDS).toContain('credential');
      expect(FORBIDDEN_FIELDS).toContain('bearer');
      expect(FORBIDDEN_FIELDS).toContain('authorization');
      expect(FORBIDDEN_FIELDS).toContain('private_key');
      expect(FORBIDDEN_FIELDS).toContain('privatekey');
    });

    test('does NOT include debugging info fields (alpha telemetry sends these)', () => {
      // These should NOT be in FORBIDDEN_FIELDS anymore
      // Alpha telemetry needs this info for debugging
      const debuggingFields = [
        'content',
        'prompt',
        'response',
        'path',
        'file',
        'code',
        'message',
        'stack',
      ];
      for (const field of debuggingFields) {
        expect(FORBIDDEN_FIELDS).not.toContain(field);
      }
    });
  });
});
