/**
 * Tests for update command
 */

import { describe, test, expect, mock, afterEach } from 'bun:test';
import {
  parseVersion,
  compareVersions,
  getCurrentPlatform,
  getCurrentArch,
  getBinaryFilename,
  calculateChecksum,
  verifyChecksum,
} from '../../src/commands/update';
import { ChecksumMismatchError } from '../../src/errors';

describe('update command', () => {
  describe('parseVersion', () => {
    test('parses simple version', () => {
      expect(parseVersion('1.2.3')).toEqual([1, 2, 3]);
    });

    test('parses version with v prefix', () => {
      expect(parseVersion('v1.2.3')).toEqual([1, 2, 3]);
    });

    test('handles missing patch version', () => {
      expect(parseVersion('1.2')).toEqual([1, 2, 0]);
    });

    test('handles missing minor and patch', () => {
      expect(parseVersion('1')).toEqual([1, 0, 0]);
    });
  });

  describe('compareVersions', () => {
    test('returns 0 for equal versions', () => {
      expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    });

    test('returns -1 when first is older (major)', () => {
      expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
    });

    test('returns 1 when first is newer (major)', () => {
      expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
    });

    test('compares minor versions correctly', () => {
      expect(compareVersions('1.1.0', '1.2.0')).toBe(-1);
      expect(compareVersions('1.2.0', '1.1.0')).toBe(1);
    });

    test('compares patch versions correctly', () => {
      expect(compareVersions('1.0.1', '1.0.2')).toBe(-1);
      expect(compareVersions('1.0.2', '1.0.1')).toBe(1);
    });

    test('handles v prefix', () => {
      expect(compareVersions('v1.0.0', 'v1.0.1')).toBe(-1);
    });
  });

  describe('platform detection', () => {
    test('getCurrentPlatform returns valid platform', () => {
      const platform = getCurrentPlatform();
      expect(['darwin', 'linux']).toContain(platform);
    });

    test('getCurrentArch returns valid architecture', () => {
      const arch = getCurrentArch();
      expect(['arm64', 'x64']).toContain(arch);
    });

    test('getBinaryFilename returns correct format', () => {
      const filename = getBinaryFilename();
      expect(filename).toMatch(/^agentlint-(darwin|linux)-(arm64|x64)$/);
    });
  });

  describe('checksum verification', () => {
    test('calculateChecksum produces 64 character hex string', async () => {
      const data = new TextEncoder().encode('test data');
      const checksum = await calculateChecksum(data.buffer);

      expect(checksum).toHaveLength(64);
      expect(checksum).toMatch(/^[a-f0-9]{64}$/);
    });

    test('calculateChecksum is deterministic', async () => {
      const data = new TextEncoder().encode('same content');
      const checksum1 = await calculateChecksum(data.buffer);
      const checksum2 = await calculateChecksum(data.buffer);

      expect(checksum1).toBe(checksum2);
    });

    test('calculateChecksum produces different results for different data', async () => {
      const data1 = new TextEncoder().encode('content 1');
      const data2 = new TextEncoder().encode('content 2');
      const checksum1 = await calculateChecksum(data1.buffer);
      const checksum2 = await calculateChecksum(data2.buffer);

      expect(checksum1).not.toBe(checksum2);
    });

    test('verifyChecksum succeeds with matching checksum', async () => {
      const data = new TextEncoder().encode('test data');
      const expectedChecksum = await calculateChecksum(data.buffer);

      // Should not throw
      await verifyChecksum(data.buffer, expectedChecksum);
    });

    test('verifyChecksum throws ChecksumMismatchError on mismatch', async () => {
      const data = new TextEncoder().encode('test data');
      const wrongChecksum = 'a'.repeat(64);

      try {
        await verifyChecksum(data.buffer, wrongChecksum);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(ChecksumMismatchError);
      }
    });
  });
});

describe('update command network operations', () => {
  // These tests use mocked fetch to test network operations

  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('fetchLatestRelease handles 404 error', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: false,
        status: 404,
      } as Response)
    ) as unknown as typeof fetch;

    const { fetchLatestRelease } = await import('../../src/commands/update');

    try {
      await fetchLatestRelease();
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('No releases found');
    }
  });

  test('fetchLatestRelease handles network errors', async () => {
    globalThis.fetch = mock(() => Promise.reject(new Error('Network error'))) as unknown as typeof fetch;

    const { fetchLatestRelease } = await import('../../src/commands/update');

    try {
      await fetchLatestRelease();
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('Failed to fetch release info');
    }
  });

  test('fetchLatestRelease parses valid response', async () => {
    const mockRelease = {
      tag_name: 'v1.0.0',
      assets: [
        { name: 'agentlint-darwin-arm64', browser_download_url: 'https://example.com/binary' },
      ],
    };

    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockRelease),
      } as Response)
    ) as unknown as typeof fetch;

    const { fetchLatestRelease } = await import('../../src/commands/update');
    const release = await fetchLatestRelease();

    expect(release.tag_name).toBe('v1.0.0');
    expect(release.assets).toHaveLength(1);
  });

  test('downloadBinary handles errors', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: false,
        status: 500,
      } as Response)
    ) as unknown as typeof fetch;

    const { downloadBinary } = await import('../../src/commands/update');

    try {
      await downloadBinary('https://example.com/binary');
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('Failed to download binary');
    }
  });
});
