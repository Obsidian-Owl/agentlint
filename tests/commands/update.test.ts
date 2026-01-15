/**
 * Tests for update command
 */

import { describe, test, expect, mock, afterEach, beforeEach } from 'bun:test';
import { mkdtemp, rm, stat, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseVersion,
  compareVersions,
  getCurrentPlatform,
  getCurrentArch,
  getBinaryFilename,
  calculateChecksum,
  verifyChecksum,
  fetchChecksums,
  getExecutablePath,
  replaceBinary,
  downloadBinary,
  update,
  runUpdate,
} from '../../src/commands/update';
import { ChecksumMismatchError, NetworkError, ExitCode } from '../../src/errors';

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

describe('fetchChecksums', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('parses checksums file correctly', async () => {
    // SHA-256 checksums are exactly 64 hex characters (0-9, a-f only)
    const darwinChecksum = 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd';
    const linuxChecksum = 'f1e2d3c4b5a6789012345678901234567890123456789012345678901234ef01';
    const checksumContent = `${darwinChecksum}  agentlint-darwin-arm64
${linuxChecksum}  agentlint-linux-x64`;

    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(checksumContent),
      } as Response)
    ) as unknown as typeof fetch;

    const checksums = await fetchChecksums('v1.0.0');

    expect(checksums.size).toBe(2);
    expect(checksums.get('agentlint-darwin-arm64')).toBe(darwinChecksum);
    expect(checksums.get('agentlint-linux-x64')).toBe(linuxChecksum);
  });

  test('handles empty lines in checksums file', async () => {
    const checksum1 = 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd';
    const checksum2 = 'f1e2d3c4b5a6789012345678901234567890123456789012345678901234ef01';
    const checksumContent = `${checksum1}  agentlint-darwin-arm64

${checksum2}  agentlint-linux-x64
`;

    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve(checksumContent),
      } as Response)
    ) as unknown as typeof fetch;

    const checksums = await fetchChecksums('v1.0.0');
    expect(checksums.size).toBe(2);
  });

  test('throws NetworkError on HTTP error', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: false,
        status: 404,
      } as Response)
    ) as unknown as typeof fetch;

    try {
      await fetchChecksums('v1.0.0');
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(NetworkError);
      expect((error as NetworkError).message).toContain('Failed to fetch checksums');
    }
  });

  test('throws NetworkError on network failure', async () => {
    globalThis.fetch = mock(() => Promise.reject(new Error('Network unreachable'))) as unknown as typeof fetch;

    try {
      await fetchChecksums('v1.0.0');
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(NetworkError);
      expect((error as NetworkError).message).toContain('Failed to fetch checksums');
    }
  });
});

describe('getExecutablePath', () => {
  test('returns process.execPath', () => {
    const path = getExecutablePath();
    expect(typeof path).toBe('string');
    expect(path.length).toBeGreaterThan(0);
    // In test environment, should return the bun executable path
    expect(path).toContain('bun');
  });
});

describe('update function', () => {
  const originalFetch = globalThis.fetch;
  const originalConsoleLog = console.log;

  beforeEach(() => {
    // Suppress console output during tests
    console.log = mock(() => {}) as unknown as typeof console.log;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    console.log = originalConsoleLog;
  });

  test('returns already up to date when on latest version', async () => {
    const mockRelease = {
      tag_name: 'v0.1.0', // Same as current version
      assets: [{ name: 'agentlint-darwin-arm64', browser_download_url: 'https://example.com/binary' }],
    };

    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockRelease),
      } as Response)
    ) as unknown as typeof fetch;

    const result = await update();

    expect(result.updated).toBe(false);
    expect(result.message).toContain('Already up to date');
    expect(result.currentVersion).toBe('0.1.0');
    expect(result.latestVersion).toBe('0.1.0');
  });

  test('returns already up to date when current is newer', async () => {
    const mockRelease = {
      tag_name: 'v0.0.9', // Older than current
      assets: [],
    };

    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockRelease),
      } as Response)
    ) as unknown as typeof fetch;

    const result = await update();

    expect(result.updated).toBe(false);
    expect(result.message).toContain('Already up to date');
  });

  test('throws NetworkError when no binary found for platform', async () => {
    const mockRelease = {
      tag_name: 'v1.0.0',
      assets: [
        // Missing the binary for current platform
        { name: 'agentlint-windows-x64', browser_download_url: 'https://example.com/windows' },
      ],
    };

    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockRelease),
      } as Response)
    ) as unknown as typeof fetch;

    try {
      await update({ force: true });
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(NetworkError);
      expect((error as NetworkError).message).toContain('No binary found');
    }
  });

  test('throws NetworkError when no checksum found', async () => {
    const binaryFilename = getBinaryFilename();
    const mockRelease = {
      tag_name: 'v1.0.0',
      assets: [{ name: binaryFilename, browser_download_url: 'https://example.com/binary' }],
    };

    let callCount = 0;
    globalThis.fetch = mock(() => {
      callCount++;
      if (callCount === 1) {
        // Release info
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockRelease),
        } as Response);
      } else {
        // Checksums - return empty
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(''),
        } as Response);
      }
    }) as unknown as typeof fetch;

    try {
      await update({ force: true });
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(NetworkError);
      expect((error as NetworkError).message).toContain('No checksum found');
    }
  });
});

describe('runUpdate function', () => {
  const originalFetch = globalThis.fetch;
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  beforeEach(() => {
    console.log = mock(() => {}) as unknown as typeof console.log;
    console.error = mock(() => {}) as unknown as typeof console.error;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  test('returns Success when already up to date', async () => {
    const mockRelease = {
      tag_name: 'v0.1.0',
      assets: [],
    };

    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockRelease),
      } as Response)
    ) as unknown as typeof fetch;

    const exitCode = await runUpdate([]);
    expect(exitCode).toBe(ExitCode.Success);
  });

  test('parses --force flag', async () => {
    const mockRelease = {
      tag_name: 'v0.1.0',
      assets: [],
    };

    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockRelease),
      } as Response)
    ) as unknown as typeof fetch;

    // With force, it should try to update even if same version
    // but will fail because no binary for platform
    const exitCode = await runUpdate(['--force']);
    expect(exitCode).toBe(ExitCode.NetworkError);
  });

  test('parses -f flag as force', async () => {
    const mockRelease = {
      tag_name: 'v0.1.0',
      assets: [],
    };

    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockRelease),
      } as Response)
    ) as unknown as typeof fetch;

    const exitCode = await runUpdate(['-f']);
    expect(exitCode).toBe(ExitCode.NetworkError);
  });

  test('returns NetworkError on fetch failure', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: false,
        status: 500,
      } as Response)
    ) as unknown as typeof fetch;

    const exitCode = await runUpdate([]);
    expect(exitCode).toBe(ExitCode.NetworkError);
  });

  test('handles non-Error exceptions', async () => {
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    globalThis.fetch = mock(() => Promise.reject('string error')) as unknown as typeof fetch;

    const exitCode = await runUpdate([]);
    expect(exitCode).toBe(ExitCode.NetworkError);
  });
});

describe('replaceBinary', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'agentlint-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test('writes new binary to target path', async () => {
    const targetPath = join(tempDir, 'agentlint');
    const binaryContent = new TextEncoder().encode('#!/bin/bash\necho "test binary"');

    await replaceBinary(binaryContent.buffer, targetPath);

    // Verify file was written
    const content = await readFile(targetPath);
    expect(content.toString()).toBe('#!/bin/bash\necho "test binary"');
  });

  test('makes binary executable', async () => {
    const targetPath = join(tempDir, 'agentlint');
    const binaryContent = new TextEncoder().encode('test');

    await replaceBinary(binaryContent.buffer, targetPath);

    // Verify file is executable (mode includes execute bit)
    const stats = await stat(targetPath);
    expect(stats.mode & 0o111).toBeGreaterThan(0);
  });

  test('replaces existing binary', async () => {
    const targetPath = join(tempDir, 'agentlint');

    // Create initial binary
    const oldContent = new TextEncoder().encode('old version');
    await Bun.write(targetPath, oldContent);

    // Replace with new binary
    const newContent = new TextEncoder().encode('new version');
    await replaceBinary(newContent.buffer, targetPath);

    // Verify new content
    const content = await readFile(targetPath);
    expect(content.toString()).toBe('new version');
  });

  test('cleans up temp file on success', async () => {
    const targetPath = join(tempDir, 'agentlint');
    const binaryContent = new TextEncoder().encode('test');

    await replaceBinary(binaryContent.buffer, targetPath);

    // Verify no .new or .bak files left behind
    const tempFile = `${targetPath}.new`;
    const backupFile = `${targetPath}.bak`;

    try {
      await stat(tempFile);
      expect(true).toBe(false); // Should not exist
    } catch {
      // Expected - file should not exist
    }

    try {
      await stat(backupFile);
      expect(true).toBe(false); // Should not exist
    } catch {
      // Expected - file should not exist
    }
  });
});

describe('downloadBinary', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('returns ArrayBuffer on success', async () => {
    const testData = new TextEncoder().encode('binary data');

    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(testData.buffer),
      } as Response)
    ) as unknown as typeof fetch;

    const result = await downloadBinary('https://example.com/binary');

    expect(result.byteLength).toBe(testData.length);
  });

  test('throws NetworkError on non-ok response', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: false,
        status: 403,
      } as Response)
    ) as unknown as typeof fetch;

    try {
      await downloadBinary('https://example.com/binary');
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(NetworkError);
      expect((error as NetworkError).message).toContain('Failed to download binary');
      expect((error as NetworkError).message).toContain('403');
    }
  });

  test('throws NetworkError on network failure', async () => {
    globalThis.fetch = mock(() =>
      Promise.reject(new Error('Connection reset'))
    ) as unknown as typeof fetch;

    try {
      await downloadBinary('https://example.com/binary');
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(NetworkError);
      expect((error as NetworkError).message).toContain('Download failed');
    }
  });
});

describe('full update flow', () => {
  const originalFetch = globalThis.fetch;
  const originalConsoleLog = console.log;

  beforeEach(() => {
    console.log = mock(() => {}) as unknown as typeof console.log;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    console.log = originalConsoleLog;
  });

  test('complete update with checksum verification failure', async () => {
    const binaryFilename = getBinaryFilename();
    const validChecksum = 'a'.repeat(64);
    const mockRelease = {
      tag_name: 'v1.0.0',
      assets: [{ name: binaryFilename, browser_download_url: 'https://example.com/binary' }],
    };

    globalThis.fetch = mock((url: string) => {
      if (url.includes('/releases/latest')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockRelease),
        } as Response);
      } else if (url.includes('checksums.txt')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(`${validChecksum}  ${binaryFilename}`),
        } as Response);
      } else {
        // Binary download - return data that won't match checksum
        return Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(new TextEncoder().encode('wrong data').buffer),
        } as Response);
      }
    }) as unknown as typeof fetch;

    try {
      await update({ force: true });
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(ChecksumMismatchError);
    }
  });
});
