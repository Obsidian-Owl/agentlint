/**
 * Unit tests for MCP Anti-Pattern Detection
 *
 * Tests the patterns validator for detecting common configuration anti-patterns.
 */

import { describe, it, expect } from 'bun:test';
import {
  validatePatterns,
  isDeprecatedPackage,
  analyzeTimeout,
  DEPRECATED_PACKAGES,
} from '../../../../../src/tools/config/mcp/validators/patterns';
import type { Position } from '../../../../../src/tools/config/mcp/types';

const defaultPosition: Position = {
  start: { line: 1, column: 1 },
  end: { line: 1, column: 1 },
};

describe('DEPRECATED_PACKAGES', () => {
  it('should have deprecated packages defined', () => {
    expect(Object.keys(DEPRECATED_PACKAGES).length).toBeGreaterThan(0);
  });

  it('should include known deprecated packages', () => {
    // These are example deprecated packages - the actual list may vary
    expect(DEPRECATED_PACKAGES).toHaveProperty('@anthropic-ai/claude-mcp');
  });

  it('should have replacement suggestions', () => {
    const deprecatedPkg = Object.keys(DEPRECATED_PACKAGES)[0];
    if (deprecatedPkg) {
      expect(DEPRECATED_PACKAGES[deprecatedPkg]).toHaveProperty('replacement');
      expect(DEPRECATED_PACKAGES[deprecatedPkg]).toHaveProperty('reason');
    }
  });
});

describe('isDeprecatedPackage', () => {
  it('should detect deprecated packages', () => {
    const result = isDeprecatedPackage('@anthropic-ai/claude-mcp');
    expect(result.isDeprecated).toBe(true);
    expect(result.replacement).toBeDefined();
  });

  it('should not flag current packages', () => {
    const result = isDeprecatedPackage('@modelcontextprotocol/server-filesystem');
    expect(result.isDeprecated).toBe(false);
  });

  it('should handle scoped packages', () => {
    const result = isDeprecatedPackage('@some-org/some-package');
    expect(result.isDeprecated).toBe(false);
  });

  it('should handle unscoped packages', () => {
    const result = isDeprecatedPackage('some-package');
    expect(result.isDeprecated).toBe(false);
  });
});

describe('analyzeTimeout', () => {
  it('should flag high timeout values', () => {
    const result = analyzeTimeout(300000); // 5 minutes
    expect(result.isHigh).toBe(true);
  });

  it('should not flag reasonable timeout values', () => {
    const result = analyzeTimeout(30000); // 30 seconds
    expect(result.isHigh).toBe(false);
  });

  it('should not flag default timeout values', () => {
    const result = analyzeTimeout(60000); // 1 minute
    expect(result.isHigh).toBe(false);
  });

  it('should provide threshold info', () => {
    const result = analyzeTimeout(300000);
    expect(result.threshold).toBeDefined();
    expect(result.value).toBe(300000);
  });
});

describe('validatePatterns', () => {
  // T042: deprecated package detection MCP013
  describe('MCP013 - deprecated package detection', () => {
    it('should return MCP013 for deprecated npx package', () => {
      const serverConfig = {
        command: 'npx',
        args: ['-y', '@anthropic-ai/claude-mcp'],
      };

      const issues = validatePatterns(
        serverConfig,
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      const mcp013 = issues.find((i) => i.code === 'MCP013');
      expect(mcp013).toBeDefined();
      expect(mcp013!.severity).toBe('warning');
      expect(mcp013!.serverName).toBe('test-server');
    });

    it('should return MCP013 for deprecated package in command', () => {
      const serverConfig = {
        command: '@anthropic-ai/claude-mcp',
        args: [],
      };

      const issues = validatePatterns(
        serverConfig,
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      const mcp013 = issues.find((i) => i.code === 'MCP013');
      expect(mcp013).toBeDefined();
    });

    it('should not return MCP013 for current packages', () => {
      const serverConfig = {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem'],
      };

      const issues = validatePatterns(
        serverConfig,
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      const mcp013 = issues.filter((i) => i.code === 'MCP013');
      expect(mcp013).toHaveLength(0);
    });

    it('should include replacement suggestion in fix', () => {
      const serverConfig = {
        command: 'npx',
        args: ['@anthropic-ai/claude-mcp'],
      };

      const issues = validatePatterns(
        serverConfig,
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      const mcp013 = issues.find((i) => i.code === 'MCP013');
      expect(mcp013?.fix).toContain('Replace');
    });
  });

  // T043: high timeout warning MCP017
  describe('MCP017 - high timeout warning', () => {
    it('should return MCP017 for high timeout value', () => {
      const serverConfig = {
        command: 'npx',
        args: ['@mcp/server'],
        timeout: 300000, // 5 minutes
      };

      const issues = validatePatterns(
        serverConfig,
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      const mcp017 = issues.find((i) => i.code === 'MCP017');
      expect(mcp017).toBeDefined();
      expect(mcp017!.severity).toBe('warning');
    });

    it('should not return MCP017 for reasonable timeout', () => {
      const serverConfig = {
        command: 'npx',
        args: ['@mcp/server'],
        timeout: 60000, // 1 minute
      };

      const issues = validatePatterns(
        serverConfig,
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      const mcp017 = issues.filter((i) => i.code === 'MCP017');
      expect(mcp017).toHaveLength(0);
    });

    it('should not return MCP017 when no timeout specified', () => {
      const serverConfig = {
        command: 'npx',
        args: ['@mcp/server'],
      };

      const issues = validatePatterns(
        serverConfig,
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      const mcp017 = issues.filter((i) => i.code === 'MCP017');
      expect(mcp017).toHaveLength(0);
    });

    it('should suggest reasonable timeout in fix', () => {
      const serverConfig = {
        command: 'npx',
        args: ['@mcp/server'],
        timeout: 600000, // 10 minutes
      };

      const issues = validatePatterns(
        serverConfig,
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      const mcp017 = issues.find((i) => i.code === 'MCP017');
      expect(mcp017?.fix).toBeDefined();
    });
  });

  // MCP020: Server is disabled
  describe('MCP020 - server disabled', () => {
    it('should return MCP020 for disabled server', () => {
      const serverConfig = {
        command: 'npx',
        args: ['@mcp/server'],
        disabled: true,
      };

      const issues = validatePatterns(
        serverConfig,
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      const mcp020 = issues.find((i) => i.code === 'MCP020');
      expect(mcp020).toBeDefined();
      expect(mcp020!.severity).toBe('info');
    });

    it('should not return MCP020 for enabled server', () => {
      const serverConfig = {
        command: 'npx',
        args: ['@mcp/server'],
        disabled: false,
      };

      const issues = validatePatterns(
        serverConfig,
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      const mcp020 = issues.filter((i) => i.code === 'MCP020');
      expect(mcp020).toHaveLength(0);
    });

    it('should not return MCP020 when disabled not specified', () => {
      const serverConfig = {
        command: 'npx',
        args: ['@mcp/server'],
      };

      const issues = validatePatterns(
        serverConfig,
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      const mcp020 = issues.filter((i) => i.code === 'MCP020');
      expect(mcp020).toHaveLength(0);
    });
  });

  describe('combined scenarios', () => {
    it('should detect multiple pattern issues', () => {
      const serverConfig = {
        command: 'npx',
        args: ['@anthropic-ai/claude-mcp'],
        timeout: 300000,
        disabled: true,
      };

      const issues = validatePatterns(
        serverConfig,
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      // Should have MCP013, MCP017, and MCP020
      expect(issues.find((i) => i.code === 'MCP013')).toBeDefined();
      expect(issues.find((i) => i.code === 'MCP017')).toBeDefined();
      expect(issues.find((i) => i.code === 'MCP020')).toBeDefined();
    });

    it('should return empty array for valid config', () => {
      const serverConfig = {
        command: 'npx',
        args: ['@modelcontextprotocol/server-filesystem'],
        timeout: 60000,
      };

      const issues = validatePatterns(
        serverConfig,
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      expect(issues).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty config', () => {
      const serverConfig = {};

      // Should not throw
      expect(() =>
        validatePatterns(serverConfig, '/test/.mcp.json', 'test-server', defaultPosition)
      ).not.toThrow();
    });

    it('should handle URL-based config', () => {
      const serverConfig = {
        url: 'http://localhost:3000/mcp',
        timeout: 300000,
      };

      const issues = validatePatterns(
        serverConfig,
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      // Should still detect high timeout
      const mcp017 = issues.find((i) => i.code === 'MCP017');
      expect(mcp017).toBeDefined();
    });

    it('should handle missing args array', () => {
      const serverConfig = {
        command: 'npx',
      };

      // Should not throw
      expect(() =>
        validatePatterns(serverConfig, '/test/.mcp.json', 'test-server', defaultPosition)
      ).not.toThrow();
    });
  });
});
