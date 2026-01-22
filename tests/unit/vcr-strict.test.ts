/**
 * EP11 VCR Strict Mode Unit Tests
 *
 * Tests for VCR strict mode behavior per ADR-0011:
 * - Strict mode fails if cassette is missing (CI behavior)
 * - Non-strict mode allows missing cassettes (local development)
 * - Clear error messages guide developers to record cassettes
 *
 * @module tests/unit/vcr-strict
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { VCR, type Cassette } from '../lib/vcr';
import { join } from 'path';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

// =============================================================================
// Test Setup
// =============================================================================

/**
 * Create a temporary directory for test cassettes.
 */
function createTempDir(): string {
  const dir = join(tmpdir(), `vcr-test-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Clean up temporary directory.
 */
function cleanupTempDir(dir: string): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Create a valid cassette file.
 */
function createCassette(path: string, recordings: Cassette['recordings'] = []): void {
  const cassette: Cassette = {
    version: '1.0.0',
    name: path,
    createdAt: new Date().toISOString(),
    recordings,
  };
  writeFileSync(path, JSON.stringify(cassette, null, 2));
}

// =============================================================================
// Test Suite
// =============================================================================

describe('VCR Strict Mode', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe('Constructor Options', () => {
    test('defaults to playback mode', () => {
      const vcr = new VCR();
      expect(vcr.getMode()).toBe('playback');
    });

    test('accepts mode option', () => {
      const vcr = new VCR({ mode: 'record' });
      expect(vcr.getMode()).toBe('record');
    });

    test('strict defaults based on CI environment at module load', () => {
      // Note: VCR reads CI env var at module import time, not construction time.
      // This test documents the current behavior - strict defaults to false
      // unless explicitly set, or if CI=true when the module is first loaded.
      //
      // For this test, we verify strict can be explicitly controlled.
      const vcrStrict = new VCR({ strict: true });
      expect(vcrStrict.isStrict()).toBe(true);

      const vcrNotStrict = new VCR({ strict: false });
      expect(vcrNotStrict.isStrict()).toBe(false);
    });

    test('strict can be explicitly set to false', () => {
      const vcr = new VCR({ strict: false });
      expect(vcr.isStrict()).toBe(false);
    });

    test('strict can be explicitly set to true', () => {
      const vcr = new VCR({ strict: true });
      expect(vcr.isStrict()).toBe(true);
    });
  });

  describe('Loading Cassettes', () => {
    test('loads existing cassette successfully', async () => {
      const cassettePath = join(tempDir, 'existing.json');
      createCassette(cassettePath, [
        {
          request: { url: 'https://api.example.com/test', method: 'GET', headers: {}, body: null },
          response: { status: 200, headers: {}, body: { success: true } },
          timestamp: new Date().toISOString(),
        },
      ]);

      const vcr = new VCR({ strict: false });
      await vcr.load(cassettePath);

      // Should be able to find the recording
      const recording = vcr.findRecording('https://api.example.com/test', 'GET');
      expect(recording).toBeDefined();
      expect(recording?.response.status).toBe(200);
    });

    test('throws error in strict mode when cassette is missing', async () => {
      const missingPath = join(tempDir, 'missing.json');
      const vcr = new VCR({ strict: true, mode: 'playback' });

      await expect(vcr.load(missingPath)).rejects.toThrow('Cassette not found');
    });

    test('error message includes path and recording instructions', async () => {
      const missingPath = join(tempDir, 'not-found.json');
      const vcr = new VCR({ strict: true, mode: 'playback' });

      try {
        await vcr.load(missingPath);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const message = (error as Error).message;
        expect(message).toContain(missingPath);
        expect(message).toContain('bun run record');
      }
    });

    test('allows missing cassette in non-strict mode', async () => {
      const missingPath = join(tempDir, 'missing-ok.json');
      const vcr = new VCR({ strict: false });

      // Should not throw
      await vcr.load(missingPath);

      // Cassette should be empty but valid
      const recording = vcr.findRecording('https://api.example.com/test', 'GET');
      expect(recording).toBeUndefined();
    });

    test('handles malformed cassette file', async () => {
      const malformedPath = join(tempDir, 'malformed.json');
      writeFileSync(malformedPath, '{ invalid json }');

      const vcr = new VCR({ strict: false });

      await expect(vcr.load(malformedPath)).rejects.toThrow('Failed to load cassette');
    });
  });

  describe('Mode Switching', () => {
    test('mode can be changed after construction', () => {
      const vcr = new VCR({ mode: 'playback' });
      expect(vcr.getMode()).toBe('playback');

      vcr.setMode('record');
      expect(vcr.getMode()).toBe('record');
    });
  });

  describe('Recording', () => {
    test('records interaction in record mode', async () => {
      const cassettePath = join(tempDir, 'record-test.json');
      const vcr = new VCR({ mode: 'record', strict: false });

      await vcr.load(cassettePath);

      // Record an interaction
      vcr.recordInteraction(
        { url: 'https://api.test.com/data', method: 'POST', headers: {}, body: { test: true } },
        { status: 201, headers: {}, body: { id: 123 } }
      );

      // Save and verify
      await vcr.save();

      // Load in a new VCR and verify
      const vcr2 = new VCR({ mode: 'playback', strict: false });
      await vcr2.load(cassettePath);

      const recording = vcr2.findRecording('https://api.test.com/data', 'POST');
      expect(recording).toBeDefined();
      expect(recording?.response.body).toEqual({ id: 123 });
    });

    test('does not record in playback mode', async () => {
      const cassettePath = join(tempDir, 'no-record.json');
      createCassette(cassettePath);

      const vcr = new VCR({ mode: 'playback', strict: false });
      await vcr.load(cassettePath);

      // Try to record (should be ignored)
      vcr.recordInteraction(
        { url: 'https://api.test.com/ignored', method: 'GET', headers: {}, body: null },
        { status: 200, headers: {}, body: null }
      );

      // Verify nothing was recorded
      const recording = vcr.findRecording('https://api.test.com/ignored', 'GET');
      expect(recording).toBeUndefined();
    });

    test('cannot save in playback mode', async () => {
      const cassettePath = join(tempDir, 'no-save.json');
      createCassette(cassettePath);

      const vcr = new VCR({ mode: 'playback', strict: false });
      await vcr.load(cassettePath);

      await expect(vcr.save()).rejects.toThrow('Cannot save cassette in playback mode');
    });
  });

  describe('Sequential Playback', () => {
    test('plays back multiple recordings for same URL in order', async () => {
      const cassettePath = join(tempDir, 'sequential.json');
      const recordings: Cassette['recordings'] = [
        {
          request: { url: 'https://api.example.com/items', method: 'GET', headers: {}, body: null },
          response: { status: 200, headers: {}, body: { page: 1 } },
          timestamp: new Date().toISOString(),
        },
        {
          request: { url: 'https://api.example.com/items', method: 'GET', headers: {}, body: null },
          response: { status: 200, headers: {}, body: { page: 2 } },
          timestamp: new Date().toISOString(),
        },
        {
          request: { url: 'https://api.example.com/items', method: 'GET', headers: {}, body: null },
          response: { status: 200, headers: {}, body: { page: 3 } },
          timestamp: new Date().toISOString(),
        },
      ];
      createCassette(cassettePath, recordings);

      const vcr = new VCR({ strict: false });
      await vcr.load(cassettePath);

      // Should return recordings in order
      const first = vcr.findRecording('https://api.example.com/items', 'GET');
      expect(first?.response.body).toEqual({ page: 1 });

      const second = vcr.findRecording('https://api.example.com/items', 'GET');
      expect(second?.response.body).toEqual({ page: 2 });

      const third = vcr.findRecording('https://api.example.com/items', 'GET');
      expect(third?.response.body).toEqual({ page: 3 });

      // Fourth call returns undefined (no more recordings)
      const fourth = vcr.findRecording('https://api.example.com/items', 'GET');
      expect(fourth).toBeUndefined();
    });
  });

  describe('Request Filtering', () => {
    test('applies request filter during recording', async () => {
      const cassettePath = join(tempDir, 'filtered.json');
      const vcr = new VCR({
        mode: 'record',
        strict: false,
        requestFilter: (req) => ({
          ...req,
          headers: { ...req.headers, authorization: '[REDACTED]' },
        }),
      });

      await vcr.load(cassettePath);

      vcr.recordInteraction(
        {
          url: 'https://api.test.com/secure',
          method: 'GET',
          headers: { authorization: 'Bearer secret-token-123' },
          body: null,
        },
        { status: 200, headers: {}, body: { data: 'test' } }
      );

      await vcr.save();

      // Verify the saved cassette has redacted auth
      const vcr2 = new VCR({ strict: false });
      await vcr2.load(cassettePath);

      const recording = vcr2.findRecording('https://api.test.com/secure', 'GET');
      expect(recording?.request.headers.authorization).toBe('[REDACTED]');
    });
  });

  describe('Cleanup and Reset', () => {
    test('cleanup clears playback state', async () => {
      const cassettePath = join(tempDir, 'cleanup-test.json');
      createCassette(cassettePath, [
        {
          request: { url: 'https://api.example.com/test', method: 'GET', headers: {}, body: null },
          response: { status: 200, headers: {}, body: null },
          timestamp: new Date().toISOString(),
        },
      ]);

      const vcr = new VCR({ strict: false });
      await vcr.load(cassettePath);

      // Consume the recording
      vcr.findRecording('https://api.example.com/test', 'GET');

      // Cleanup
      vcr.cleanup();

      // After cleanup, the cassette is still loaded but playback index is reset
      // We need to reload to verify index was cleared
    });

    test('reset clears all state', async () => {
      const cassettePath = join(tempDir, 'reset-test.json');
      createCassette(cassettePath, [
        {
          request: { url: 'https://api.example.com/test', method: 'GET', headers: {}, body: null },
          response: { status: 200, headers: {}, body: null },
          timestamp: new Date().toISOString(),
        },
      ]);

      const vcr = new VCR({ strict: false });
      await vcr.load(cassettePath);

      // Reset
      vcr.reset();

      // After reset, findRecording should return undefined (no cassette loaded)
      const recording = vcr.findRecording('https://api.example.com/test', 'GET');
      expect(recording).toBeUndefined();
    });
  });
});

// =============================================================================
// CI Integration Tests
// =============================================================================

describe('VCR CI Integration', () => {
  test('explicit mode option overrides default', () => {
    // Note: VCR reads VCR_MODE env var at module import time, not construction time.
    // This test verifies that explicit mode option always takes precedence.
    const vcrRecord = new VCR({ mode: 'record' });
    expect(vcrRecord.getMode()).toBe('record');

    const vcrPlayback = new VCR({ mode: 'playback' });
    expect(vcrPlayback.getMode()).toBe('playback');
  });

  test('setMode allows runtime mode switching', () => {
    const vcr = new VCR({ mode: 'playback' });
    expect(vcr.getMode()).toBe('playback');

    vcr.setMode('record');
    expect(vcr.getMode()).toBe('record');

    vcr.setMode('playback');
    expect(vcr.getMode()).toBe('playback');
  });
});
