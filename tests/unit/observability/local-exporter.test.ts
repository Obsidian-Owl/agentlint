import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, readFileSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { LocalSpanExporter } from '../../../src/observability/exporters/local-exporter';
import type { ExportableSpan } from '../../../src/observability/exporters/local-exporter';

/**
 * T031: Test that LocalSpanExporter writes valid JSONL files,
 * file rotation works when size exceeds limit, and export() handles empty array gracefully.
 */

describe('LocalSpanExporter', () => {
  let testDir: string;

  beforeEach(() => {
    // Create unique test directory for each test
    testDir = join(tmpdir(), `agentlint-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  /**
   * Helper: Create a sample span
   */
  function createSpan(name: string, overrides?: Partial<ExportableSpan>): ExportableSpan {
    return {
      traceId: '0123456789abcdef0123456789abcdef',
      spanId: '0123456789abcdef',
      name,
      kind: 'internal',
      startTime: Date.now(),
      endTime: Date.now() + 100,
      durationMs: 100,
      status: { code: 'ok' },
      attributes: {},
      events: [],
      ...overrides,
    };
  }

  /**
   * Helper: Read NDJSON file and parse all lines
   */
  function readNDJSON(filePath: string): ExportableSpan[] {
    const content = readFileSync(filePath, 'utf-8');
    return content
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as ExportableSpan);
  }

  describe('Basic Writing', () => {
    it('should write valid JSONL files', () => {
      const exporter = new LocalSpanExporter({
        outputDir: testDir,
        filePrefix: 'test-traces',
      });

      const spans: ExportableSpan[] = [
        createSpan('span-1'),
        createSpan('span-2'),
        createSpan('span-3'),
      ];

      exporter.export(spans);

      const filePath = exporter.getCurrentFilePath();
      expect(existsSync(filePath)).toBe(true);

      // Read and validate NDJSON
      const writtenSpans = readNDJSON(filePath);
      expect(writtenSpans).toHaveLength(3);
      expect(writtenSpans[0]!.name).toBe('span-1');
      expect(writtenSpans[1]!.name).toBe('span-2');
      expect(writtenSpans[2]!.name).toBe('span-3');
    });

    it('should append to existing file', () => {
      const exporter = new LocalSpanExporter({
        outputDir: testDir,
        filePrefix: 'test-traces',
      });

      // First export
      exporter.export([createSpan('span-1')]);

      // Second export
      exporter.export([createSpan('span-2')]);

      const filePath = exporter.getCurrentFilePath();
      const writtenSpans = readNDJSON(filePath);
      expect(writtenSpans).toHaveLength(2);
    });

    it('should create output directory if it does not exist', () => {
      const nestedDir = join(testDir, 'nested', 'deep', 'logs');
      expect(existsSync(nestedDir)).toBe(false);

      const exporter = new LocalSpanExporter({
        outputDir: nestedDir,
        filePrefix: 'test-traces',
      });

      exporter.export([createSpan('span-1')]);

      expect(existsSync(nestedDir)).toBe(true);
      expect(existsSync(exporter.getCurrentFilePath())).toBe(true);
    });

    it('should use default configuration', () => {
      // Create exporter with no config (uses defaults)
      const exporter = new LocalSpanExporter();

      // Should not throw
      expect(() => {
        exporter.export([createSpan('span-1')]);
      }).not.toThrow();

      // File should exist in default location
      const filePath = exporter.getCurrentFilePath();
      expect(existsSync(filePath)).toBe(true);
      expect(filePath).toContain('.agentlint/logs');
      expect(filePath).toContain('traces-');

      // Clean up default location
      rmSync(filePath, { force: true });
    });
  });

  describe('Empty Array Handling', () => {
    it('should handle empty array gracefully', () => {
      const exporter = new LocalSpanExporter({
        outputDir: testDir,
        filePrefix: 'test-traces',
      });

      // Should not throw or create file
      expect(() => {
        exporter.export([]);
      }).not.toThrow();

      // File should not be created
      const filePath = exporter.getCurrentFilePath();
      expect(existsSync(filePath)).toBe(false);
    });

    it('should not write to file for empty array', () => {
      const exporter = new LocalSpanExporter({
        outputDir: testDir,
        filePrefix: 'test-traces',
      });

      // Write some spans first
      exporter.export([createSpan('span-1')]);

      const filePath = exporter.getCurrentFilePath();
      const initialContent = readFileSync(filePath, 'utf-8');

      // Export empty array
      exporter.export([]);

      // File content should be unchanged
      const finalContent = readFileSync(filePath, 'utf-8');
      expect(finalContent).toBe(initialContent);
    });
  });

  describe('File Rotation', () => {
    it('should rotate file when size exceeds limit', () => {
      const exporter = new LocalSpanExporter({
        outputDir: testDir,
        filePrefix: 'test-traces',
        maxFileSizeMB: 0.001, // 1KB limit for testing
      });

      // Create large span data to exceed limit
      const largeSpan = createSpan('large-span', {
        attributes: {
          // Add large data to exceed 1KB
          largeData: 'x'.repeat(2000),
        },
      });

      // Export first span
      exporter.export([largeSpan]);
      const firstFile = exporter.getCurrentFilePath();
      expect(existsSync(firstFile)).toBe(true);

      // Export second span (should trigger rotation)
      exporter.export([createSpan('span-after-rotation')]);
      const secondFile = exporter.getCurrentFilePath();

      // Should have rotated to new file
      expect(secondFile).not.toBe(firstFile);
      expect(existsSync(secondFile)).toBe(true);

      // Both files should exist
      expect(existsSync(firstFile)).toBe(true);
      expect(existsSync(secondFile)).toBe(true);

      // Verify rotation suffix
      expect(secondFile).toMatch(/\.1\.ndjson$/);
    });

    it('should increment rotation index for multiple rotations', () => {
      const exporter = new LocalSpanExporter({
        outputDir: testDir,
        filePrefix: 'test-traces',
        maxFileSizeMB: 0.001, // 1KB limit
      });

      const largeSpan = createSpan('large-span', {
        attributes: { largeData: 'x'.repeat(2000) },
      });

      // First file
      exporter.export([largeSpan]);
      const file1 = exporter.getCurrentFilePath();

      // Second file (rotation 1)
      exporter.export([largeSpan]);
      const file2 = exporter.getCurrentFilePath();

      // Third file (rotation 2)
      exporter.export([largeSpan]);
      const file3 = exporter.getCurrentFilePath();

      // Verify all files exist
      expect(existsSync(file1)).toBe(true);
      expect(existsSync(file2)).toBe(true);
      expect(existsSync(file3)).toBe(true);

      // Verify rotation suffixes
      expect(file1).toMatch(/\.ndjson$/);
      expect(file1).not.toMatch(/\.\d+\.ndjson$/);
      expect(file2).toMatch(/\.1\.ndjson$/);
      expect(file3).toMatch(/\.2\.ndjson$/);
    });

    it('should not rotate if file is below size limit', () => {
      const exporter = new LocalSpanExporter({
        outputDir: testDir,
        filePrefix: 'test-traces',
        maxFileSizeMB: 10, // Large limit
      });

      // Export multiple small spans
      for (let i = 0; i < 5; i++) {
        exporter.export([createSpan(`span-${i}`)]);
      }

      const filePath = exporter.getCurrentFilePath();

      // Should all be in same file
      const writtenSpans = readNDJSON(filePath);
      expect(writtenSpans).toHaveLength(5);

      // No rotation files should exist
      const rotatedPath = filePath.replace('.ndjson', '.1.ndjson');
      expect(existsSync(rotatedPath)).toBe(false);
    });

    it('should handle rotation when file does not exist yet', () => {
      const exporter = new LocalSpanExporter({
        outputDir: testDir,
        filePrefix: 'test-traces',
        maxFileSizeMB: 0.001, // 1KB limit
      });

      // First export creates the file
      exporter.export([createSpan('span-1')]);

      const filePath = exporter.getCurrentFilePath();
      expect(existsSync(filePath)).toBe(true);

      // Should not throw on maybeRotate check
      expect(() => {
        exporter.export([createSpan('span-2')]);
      }).not.toThrow();
    });
  });

  describe('File Naming', () => {
    it('should use current date in filename', () => {
      const exporter = new LocalSpanExporter({
        outputDir: testDir,
        filePrefix: 'test-traces',
      });

      exporter.export([createSpan('span-1')]);

      const filePath = exporter.getCurrentFilePath();
      const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      expect(filePath).toContain(`test-traces-${date}.ndjson`);
    });

    it('should use custom file prefix', () => {
      const exporter = new LocalSpanExporter({
        outputDir: testDir,
        filePrefix: 'custom-prefix',
      });

      exporter.export([createSpan('span-1')]);

      const filePath = exporter.getCurrentFilePath();
      expect(filePath).toContain('custom-prefix-');
    });
  });

  describe('Lifecycle Methods', () => {
    it('should not throw on flush()', () => {
      const exporter = new LocalSpanExporter({
        outputDir: testDir,
        filePrefix: 'test-traces',
      });

      expect(() => {
        exporter.flush();
      }).not.toThrow();
    });

    it('should not throw on shutdown()', () => {
      const exporter = new LocalSpanExporter({
        outputDir: testDir,
        filePrefix: 'test-traces',
      });

      exporter.export([createSpan('span-1')]);

      expect(() => {
        exporter.shutdown();
      }).not.toThrow();

      // Should still be able to export after shutdown
      // (no persistent handles to close)
      expect(() => {
        exporter.export([createSpan('span-2')]);
      }).not.toThrow();
    });
  });

  describe('Data Integrity', () => {
    it('should preserve all span fields', () => {
      const exporter = new LocalSpanExporter({
        outputDir: testDir,
        filePrefix: 'test-traces',
      });

      const span: ExportableSpan = {
        traceId: 'abc123def456',
        spanId: 'span789',
        parentSpanId: 'parent123',
        name: 'test-span',
        kind: 'client',
        startTime: 1234567890,
        endTime: 1234567990,
        durationMs: 100,
        status: { code: 'error', message: 'Test error' },
        attributes: {
          'http.method': 'GET',
          'http.status_code': 500,
          'custom.flag': true,
        },
        events: [
          {
            name: 'event-1',
            timestamp: 1234567900,
            attributes: { detail: 'test' },
          },
        ],
      };

      exporter.export([span]);

      const writtenSpans = readNDJSON(exporter.getCurrentFilePath());
      expect(writtenSpans).toHaveLength(1);

      const written = writtenSpans[0]!;
      expect(written.traceId).toBe(span.traceId);
      expect(written.spanId).toBe(span.spanId);
      expect(written.parentSpanId).toBe(span.parentSpanId);
      expect(written.name).toBe(span.name);
      expect(written.kind).toBe(span.kind);
      expect(written.startTime).toBe(span.startTime);
      expect(written.endTime).toBe(span.endTime);
      expect(written.durationMs).toBe(span.durationMs);
      expect(written.status).toEqual(span.status);
      expect(written.attributes).toEqual(span.attributes);
      expect(written.events).toEqual(span.events);
    });

    it('should handle special characters in span data', () => {
      const exporter = new LocalSpanExporter({
        outputDir: testDir,
        filePrefix: 'test-traces',
      });

      const span = createSpan('test-span', {
        attributes: {
          'special.chars': 'Hello "world" \n\t\r',
          unicode: '你好 🚀',
        },
      });

      exporter.export([span]);

      const writtenSpans = readNDJSON(exporter.getCurrentFilePath());
      expect(writtenSpans[0]!.attributes).toEqual(span.attributes);
    });
  });
});
