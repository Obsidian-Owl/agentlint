/**
 * T018: Unit tests for --version output
 *
 * Tests FR-003: Version information display
 */

import { describe, test, expect } from 'bun:test';
import { createProgram, extractGlobalOptions } from '../../../src/cli/program';
import { getVersion } from '../../../src/version';

describe('CLI Version', () => {
  describe('version configuration', () => {
    test('program has version configured', () => {
      const program = createProgram();
      // Commander stores version in _version property
      expect(program.version()).toBeDefined();
    });

    test('version matches package.json', () => {
      const program = createProgram();
      const { version } = getVersion();
      expect(program.version()).toBe(version);
    });

    test('version option has -v short flag', () => {
      const program = createProgram();
      const versionOption = program.options.find((opt) => opt.long === '--version');
      expect(versionOption?.short).toBe('-v');
    });

    test('version option has custom description', () => {
      const program = createProgram();
      const versionOption = program.options.find((opt) => opt.long === '--version');
      expect(versionOption?.description).toBe('Show version information');
    });
  });

  describe('version format', () => {
    test('version is semver format', () => {
      const { version } = getVersion();
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    test('getVersion returns platform info', () => {
      const info = getVersion();
      expect(info.platform).toBeDefined();
      expect(['darwin', 'linux', 'win32']).toContain(info.platform);
    });

    test('getVersion returns architecture info', () => {
      const info = getVersion();
      expect(info.arch).toBeDefined();
      expect(['x64', 'arm64']).toContain(info.arch);
    });

    test('getVersion returns bun version in Bun runtime', () => {
      const info = getVersion();
      // When running in Bun, bunVersion should be defined
      expect(info.bunVersion).toBeDefined();
      expect(info.bunVersion).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('extractGlobalOptions', () => {
    test('extracts json option', () => {
      const result = extractGlobalOptions({ json: true });
      expect(result.json).toBe(true);
    });

    test('extracts markdown option', () => {
      const result = extractGlobalOptions({ markdown: true });
      expect(result.markdown).toBe(true);
    });

    test('extracts plain option', () => {
      const result = extractGlobalOptions({ plain: true });
      expect(result.plain).toBe(true);
    });

    test('extracts verbose option', () => {
      const result = extractGlobalOptions({ verbose: true });
      expect(result.verbose).toBe(true);
    });

    test('extracts failOnFindings option', () => {
      const result = extractGlobalOptions({ failOnFindings: true });
      expect(result.failOnFindings).toBe(true);
    });

    test('ignores non-global options', () => {
      const result = extractGlobalOptions({ someOtherOption: 'value' });
      expect(result).toEqual({});
    });

    test('handles multiple options', () => {
      const result = extractGlobalOptions({
        json: true,
        verbose: true,
        failOnFindings: false,
      });
      expect(result.json).toBe(true);
      expect(result.verbose).toBe(true);
      expect(result.failOnFindings).toBe(false);
    });

    test('ignores non-boolean values', () => {
      const result = extractGlobalOptions({
        json: 'true', // string, not boolean
        markdown: 1, // number, not boolean
      });
      expect(result).toEqual({});
    });
  });
});
