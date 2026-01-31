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

    it('should not contain hyphens', () => {
      const traceId = generateTraceId();
      expect(traceId).not.toContain('-');
    });

    it('should be lowercase hex', () => {
      const traceId = generateTraceId();
      expect(traceId).toBe(traceId.toLowerCase());
      expect(traceId).toMatch(/^[0-9a-f]+$/);
    });

    it('should generate time-sortable IDs (UUID v7)', () => {
      const id1 = generateTraceId();
      // Small delay to ensure different timestamp
      const start = Date.now();
      while (Date.now() - start < 2) {
        // Busy wait for 2ms
      }
      const id2 = generateTraceId();

      // UUID v7 is time-sortable, so id2 should be > id1 lexicographically
      expect(id2 > id1).toBe(true);
    });
  });

  describe('generateSpanId', () => {
    it('should generate a 16-character hex string', () => {
      const spanId = generateSpanId();
      expect(spanId).toHaveLength(16);
      expect(spanId).toMatch(/^[0-9a-f]{16}$/);
    });

    it('should generate unique IDs', () => {
      const id1 = generateSpanId();
      const id2 = generateSpanId();
      const id3 = generateSpanId();

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });

    it('should not contain hyphens', () => {
      const spanId = generateSpanId();
      expect(spanId).not.toContain('-');
    });

    it('should be lowercase hex', () => {
      const spanId = generateSpanId();
      expect(spanId).toBe(spanId.toLowerCase());
      expect(spanId).toMatch(/^[0-9a-f]+$/);
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

    it('should default to sampled', () => {
      const traceId = '0123456789abcdef0123456789abcdef';
      const spanId = '0123456789abcdef';

      const traceparent = formatTraceparent(traceId, spanId);

      expect(traceparent).toContain('-01');
    });

    it('should preserve trace and span IDs', () => {
      const traceId = 'abcdefabcdefabcdefabcdefabcdefab';
      const spanId = '1234567890abcdef';

      const traceparent = formatTraceparent(traceId, spanId);

      expect(traceparent).toContain(traceId);
      expect(traceparent).toContain(spanId);
    });

    it('should always use version 00', () => {
      const traceId = '0123456789abcdef0123456789abcdef';
      const spanId = '0123456789abcdef';

      const traceparent = formatTraceparent(traceId, spanId);

      expect(traceparent).toStartWith('00-');
    });

    it('should match W3C traceparent format', () => {
      const traceId = generateTraceId();
      const spanId = generateSpanId();

      const traceparent = formatTraceparent(traceId, spanId);

      // Format: {version}-{trace-id}-{span-id}-{trace-flags}
      expect(traceparent).toMatch(/^[0-9a-f]{2}-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/);
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

    it('should parse unsampled traceparent', () => {
      const traceparent = '00-0123456789abcdef0123456789abcdef-0123456789abcdef-00';

      const result = parseTraceparent(traceparent);

      expect(result).not.toBeNull();
      expect(result?.traceFlags).toBe(0);
    });

    it('should normalize to lowercase', () => {
      const traceparent = '00-ABCDEFABCDEFABCDEFABCDEFABCDEFAB-1234567890ABCDEF-01';

      const result = parseTraceparent(traceparent);

      expect(result).not.toBeNull();
      expect(result?.traceId).toBe('abcdefabcdefabcdefabcdefabcdefab');
      expect(result?.spanId).toBe('1234567890abcdef');
    });

    it('should roundtrip format and parse', () => {
      const traceId = generateTraceId();
      const spanId = generateSpanId();
      const sampled = true;

      const traceparent = formatTraceparent(traceId, spanId, sampled);
      const result = parseTraceparent(traceparent);

      expect(result).not.toBeNull();
      expect(result?.traceId).toBe(traceId);
      expect(result?.spanId).toBe(spanId);
      expect(result?.traceFlags).toBe(1);
    });

    describe('invalid input', () => {
      it('should return null for empty string', () => {
        const result = parseTraceparent('');
        expect(result).toBeNull();
      });

      it('should return null for missing version', () => {
        const result = parseTraceparent('0123456789abcdef0123456789abcdef-0123456789abcdef-01');
        expect(result).toBeNull();
      });

      it('should return null for wrong trace ID length', () => {
        const result = parseTraceparent('00-0123456789abcdef-0123456789abcdef-01');
        expect(result).toBeNull();
      });

      it('should return null for wrong span ID length', () => {
        const result = parseTraceparent('00-0123456789abcdef0123456789abcdef-0123456789-01');
        expect(result).toBeNull();
      });

      it('should return null for non-hex characters', () => {
        const result = parseTraceparent('00-0123456789abcdefghij0123456789ab-0123456789abcdef-01');
        expect(result).toBeNull();
      });

      it('should return null for missing parts', () => {
        const result = parseTraceparent('00-0123456789abcdef0123456789abcdef');
        expect(result).toBeNull();
      });
    });

    describe('edge cases', () => {
      it('should handle all zeros', () => {
        const traceparent = '00-00000000000000000000000000000000-0000000000000000-00';

        const result = parseTraceparent(traceparent);

        expect(result).not.toBeNull();
        expect(result?.traceId).toBe('00000000000000000000000000000000');
        expect(result?.spanId).toBe('0000000000000000');
        expect(result?.traceFlags).toBe(0);
      });

      it('should handle all f characters', () => {
        const traceparent = '00-ffffffffffffffffffffffffffffffff-ffffffffffffffff-ff';

        const result = parseTraceparent(traceparent);

        expect(result).not.toBeNull();
        expect(result?.traceId).toBe('ffffffffffffffffffffffffffffffff');
        expect(result?.spanId).toBe('ffffffffffffffff');
        expect(result?.traceFlags).toBe(255);
      });

      it('should handle future version numbers', () => {
        const traceparent = 'ff-0123456789abcdef0123456789abcdef-0123456789abcdef-01';

        const result = parseTraceparent(traceparent);

        expect(result).not.toBeNull();
        expect(result?.version).toBe('ff');
      });
    });
  });
});
