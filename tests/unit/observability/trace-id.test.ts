import { describe, it, expect } from 'bun:test';
import {
  generateTraceId,
  generateSpanId,
  formatTraceparent,
  parseTraceparent,
} from '../../../src/observability/trace-id';

describe('Trace ID Generation', () => {
  describe('generateTraceId', () => {
    it('should generate a 32-character hex string', () => {
      const traceId = generateTraceId();
      expect(traceId).toHaveLength(32);
      expect(traceId).toMatch(/^[0-9a-f]{32}$/);
    });

    it('should generate unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateTraceId()));
      expect(ids.size).toBe(100);
    });
  });

  describe('generateSpanId', () => {
    it('should generate a 16-character hex string', () => {
      const spanId = generateSpanId();
      expect(spanId).toHaveLength(16);
      expect(spanId).toMatch(/^[0-9a-f]{16}$/);
    });
  });

  describe('formatTraceparent', () => {
    it('should format W3C traceparent correctly', () => {
      const traceparent = formatTraceparent(
        '00000000000000000000000000000001',
        '0000000000000002',
        true
      );
      expect(traceparent).toBe('00-00000000000000000000000000000001-0000000000000002-01');
    });

    it('should use 00 for unsampled traces', () => {
      const traceparent = formatTraceparent(
        '00000000000000000000000000000001',
        '0000000000000002',
        false
      );
      expect(traceparent).toMatch(/-00$/);
    });
  });

  describe('parseTraceparent', () => {
    it('should parse valid traceparent', () => {
      const result = parseTraceparent('00-00000000000000000000000000000001-0000000000000002-01');
      expect(result).toEqual({
        version: '00',
        traceId: '00000000000000000000000000000001',
        spanId: '0000000000000002',
        traceFlags: 1,
      });
    });

    it('should return null for invalid format', () => {
      expect(parseTraceparent('invalid')).toBeNull();
      expect(parseTraceparent('00-short-id-01')).toBeNull();
    });
  });
});
