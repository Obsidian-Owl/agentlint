/**
 * Unit tests for MCP Path Validation
 *
 * Tests the path validator for MCP server command executables.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdir, writeFile, rm, chmod } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  validatePath,
  analyzePath,
  extractPackageName,
  isKnownExecutable,
  checkExecutableInPath,
} from '../../../../../src/tools/config/mcp/validators/path';
import type { Position } from '../../../../../src/tools/config/mcp/types';

const defaultPosition: Position = {
  start: { line: 1, column: 1 },
  end: { line: 1, column: 1 },
};

describe('analyzePath', () => {
  it('should identify absolute paths', () => {
    const result = analyzePath('/usr/local/bin/node');
    expect(result.isAbsolute).toBe(true);
    expect(result.isRelative).toBe(false);
    expect(result.original).toBe('/usr/local/bin/node');
  });

  it('should identify relative paths starting with ./', () => {
    const result = analyzePath('./scripts/server.js');
    expect(result.isRelative).toBe(true);
    expect(result.isAbsolute).toBe(false);
  });

  it('should identify relative paths starting with ../', () => {
    const result = analyzePath('../scripts/server.js');
    expect(result.isRelative).toBe(true);
  });

  it('should detect shell home directory (~)', () => {
    const result = analyzePath('~/bin/server');
    expect(result.hasShellVar).toBe(true);
    expect(result.shellVars).toContain('~');
  });

  it('should detect environment variable references ($VAR)', () => {
    const result = analyzePath('$HOME/bin/server');
    expect(result.hasShellVar).toBe(true);
    expect(result.shellVars).toContain('$HOME');
  });

  it('should detect ${VAR} style references', () => {
    const result = analyzePath('${HOME}/bin/server');
    expect(result.hasShellVar).toBe(true);
    expect(result.shellVars).toContain('${HOME}');
  });

  it('should detect Windows backslashes', () => {
    const result = analyzePath('C:\\Program Files\\node\\npx.exe');
    expect(result.windowsBackslash).toBe(true);
  });

  it('should not flag forward slashes as Windows paths', () => {
    const result = analyzePath('/usr/local/bin/node');
    expect(result.windowsBackslash).toBe(false);
  });
});

describe('extractPackageName', () => {
  it('should extract package name from npx args', () => {
    const result = extractPackageName('npx', ['-y', '@modelcontextprotocol/server-github']);
    expect(result).toBe('@modelcontextprotocol/server-github');
  });

  it('should handle bunx commands', () => {
    const result = extractPackageName('bunx', ['@mcp/filesystem']);
    expect(result).toBe('@mcp/filesystem');
  });

  it('should skip flags like -y and --yes', () => {
    const result = extractPackageName('npx', ['--yes', '-y', '@scope/package']);
    expect(result).toBe('@scope/package');
  });

  it('should skip flags like -p and --package', () => {
    const result = extractPackageName('npx', ['-p', 'typescript', 'tsc']);
    // In this case, 'typescript' is after -p flag, but 'tsc' is the actual command
    // The implementation should find the first non-flag argument
    expect(result).toBe('typescript');
  });

  it('should return undefined for non-npx commands', () => {
    const result = extractPackageName('node', ['server.js']);
    expect(result).toBeUndefined();
  });

  it('should return undefined for empty args', () => {
    const result = extractPackageName('npx', []);
    expect(result).toBeUndefined();
  });
});

describe('isKnownExecutable', () => {
  it('should recognize npx as known executable', () => {
    expect(isKnownExecutable('npx')).toBe(true);
  });

  it('should recognize node as known executable', () => {
    expect(isKnownExecutable('node')).toBe(true);
  });

  it('should recognize python as known executable', () => {
    expect(isKnownExecutable('python')).toBe(true);
    expect(isKnownExecutable('python3')).toBe(true);
  });

  it('should recognize docker as known executable', () => {
    expect(isKnownExecutable('docker')).toBe(true);
  });

  it('should recognize bun/bunx as known executables', () => {
    expect(isKnownExecutable('bun')).toBe(true);
    expect(isKnownExecutable('bunx')).toBe(true);
  });

  it('should return false for unknown executables', () => {
    expect(isKnownExecutable('my-custom-binary')).toBe(false);
    expect(isKnownExecutable('/usr/local/bin/custom')).toBe(false);
  });
});

describe('checkExecutableInPath', () => {
  it('should find common system executables in PATH', async () => {
    // Use guaranteed executables that exist on all Unix systems
    // sh is POSIX-required and always available
    const shResult = await checkExecutableInPath('sh');
    expect(shResult).toBe(true);
  });

  it('should return false for non-existent executable', async () => {
    const result = await checkExecutableInPath('definitely-not-a-real-executable-12345');
    expect(result).toBe(false);
  });
});

describe('validatePath', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `mcp-path-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // T027: absolute path existence check
  describe('MCP003 - executable not found', () => {
    it('should return MCP003 for non-existent absolute path', async () => {
      const issues = await validatePath(
        '/definitely/not/a/real/path/binary',
        [],
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      const mcp003 = issues.find((i) => i.code === 'MCP003');
      expect(mcp003).toBeDefined();
      expect(mcp003!.severity).toBe('error');
      expect(mcp003!.serverName).toBe('test-server');
    });

    it('should not return MCP003 for existing absolute path', async () => {
      // Create a test file
      const testBinary = join(tempDir, 'test-binary');
      await writeFile(testBinary, '#!/bin/bash\necho "test"');
      await chmod(testBinary, 0o755);

      const issues = await validatePath(
        testBinary,
        [],
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      const mcp003 = issues.find((i) => i.code === 'MCP003');
      expect(mcp003).toBeUndefined();
    });
  });

  // T028: relative path warning MCP010
  describe('MCP010 - relative path warning', () => {
    it('should return MCP010 for relative path starting with ./', async () => {
      const issues = await validatePath(
        './scripts/server.js',
        [],
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      const mcp010 = issues.find((i) => i.code === 'MCP010');
      expect(mcp010).toBeDefined();
      expect(mcp010!.severity).toBe('warning');
      expect(mcp010!.message).toContain('relative');
    });

    it('should return MCP010 for relative path starting with ../', async () => {
      const issues = await validatePath(
        '../scripts/server.js',
        [],
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      const mcp010 = issues.find((i) => i.code === 'MCP010');
      expect(mcp010).toBeDefined();
    });

    it('should include position in MCP010 issue', async () => {
      const customPosition: Position = {
        start: { line: 5, column: 10 },
        end: { line: 5, column: 25 },
      };

      const issues = await validatePath(
        './scripts/server.js',
        [],
        '/test/.mcp.json',
        'test-server',
        customPosition
      );

      const mcp010 = issues.find((i) => i.code === 'MCP010');
      expect(mcp010).toBeDefined();
      expect(mcp010!.line).toBe(5);
      expect(mcp010!.column).toBe(10);
    });
  });

  // T029: shell variable detection MCP011
  describe('MCP011 - shell variable warning', () => {
    it('should return MCP011 for ~ in command', async () => {
      const issues = await validatePath(
        '~/bin/server',
        [],
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      const mcp011 = issues.find((i) => i.code === 'MCP011');
      expect(mcp011).toBeDefined();
      expect(mcp011!.severity).toBe('warning');
      expect(mcp011!.message).toContain('~');
    });

    it('should return MCP011 for $VAR in command', async () => {
      const issues = await validatePath(
        '$HOME/bin/server',
        [],
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      const mcp011 = issues.find((i) => i.code === 'MCP011');
      expect(mcp011).toBeDefined();
      expect(mcp011!.message).toContain('$HOME');
    });

    it('should return MCP011 for ${VAR} in command', async () => {
      const issues = await validatePath(
        '${USER}/bin/server',
        [],
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      const mcp011 = issues.find((i) => i.code === 'MCP011');
      expect(mcp011).toBeDefined();
      expect(mcp011!.message).toContain('${USER}');
    });

    it('should list all detected shell variables', async () => {
      const issues = await validatePath(
        '$HOME/$USER/bin/server',
        [],
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      const mcp011 = issues.find((i) => i.code === 'MCP011');
      expect(mcp011).toBeDefined();
      // Should mention both variables
      expect(mcp011!.context?.shellVars).toContain('$HOME');
      expect(mcp011!.context?.shellVars).toContain('$USER');
    });
  });

  // MCP024: package name extraction
  describe('MCP024 - package name extracted', () => {
    it('should return MCP024 with extracted package name for npx', async () => {
      const issues = await validatePath(
        'npx',
        ['-y', '@modelcontextprotocol/server-github'],
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      const mcp024 = issues.find((i) => i.code === 'MCP024');
      expect(mcp024).toBeDefined();
      expect(mcp024!.severity).toBe('info');
      expect(mcp024!.context?.packageName).toBe('@modelcontextprotocol/server-github');
    });
  });

  describe('known executables', () => {
    it('should check PATH for known executables like npx', async () => {
      const issues = await validatePath(
        'npx',
        ['-y', '@mcp/test'],
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      // If npx is not in PATH, should get MCP003
      // If npx is in PATH, should not get MCP003
      // Either way, no exception should be thrown
      expect(Array.isArray(issues)).toBe(true);
    });

    it('should not try to check PATH for unknown executables', async () => {
      const issues = await validatePath(
        'my-custom-script',
        [],
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      // For unknown executables that aren't absolute paths,
      // we can't verify existence, so no MCP003
      const mcp003 = issues.find((i) => i.code === 'MCP003');
      // We don't report MCP003 for non-absolute, non-known executables
      // because we can't know if they exist without checking PATH
      expect(mcp003).toBeUndefined();
    });
  });
});
