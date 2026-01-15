/**
 * Version module tests
 */

import { describe, test, expect } from 'bun:test';
import { getVersion, formatVersion, type VersionInfo } from '../src/version';

describe('version', () => {
  describe('getVersion', () => {
    test('returns version from package.json', () => {
      const info = getVersion();
      expect(info.version).toBe('0.1.0');
    });

    test('includes platform', () => {
      const info = getVersion();
      expect(['darwin', 'linux', 'win32']).toContain(info.platform);
    });

    test('includes architecture', () => {
      const info = getVersion();
      expect(['arm64', 'x64', 'arm', 'ia32']).toContain(info.arch);
    });

    test('detects Bun runtime', () => {
      const info = getVersion();
      // In Bun test environment, bunVersion should be defined
      expect(info.bunVersion).toBeDefined();
      expect(info.nodeVersion).toBeUndefined();
    });
  });

  describe('formatVersion', () => {
    test('formats version info for display', () => {
      const info: VersionInfo = {
        version: '1.2.3',
        platform: 'darwin',
        arch: 'arm64',
        bunVersion: '1.0.0',
      };

      const output = formatVersion(info);
      expect(output).toContain('agentlint v1.2.3');
      expect(output).toContain('Bun 1.0.0');
      expect(output).toContain('darwin-arm64');
    });

    test('formats Node.js version when bunVersion is undefined', () => {
      const info: VersionInfo = {
        version: '1.2.3',
        platform: 'linux',
        arch: 'x64',
        nodeVersion: '22.0.0',
      };

      const output = formatVersion(info);
      expect(output).toContain('agentlint v1.2.3');
      expect(output).toContain('Node.js 22.0.0');
      expect(output).toContain('linux-x64');
    });

    test('handles missing runtime version', () => {
      const info: VersionInfo = {
        version: '1.2.3',
        platform: 'darwin',
        arch: 'arm64',
      };

      const output = formatVersion(info);
      expect(output).toContain('agentlint v1.2.3');
      expect(output).toContain('darwin-arm64');
      expect(output).not.toContain('Bun');
      expect(output).not.toContain('Node.js');
    });
  });
});
