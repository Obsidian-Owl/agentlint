/**
 * Unit tests for MCP Transport Validation
 *
 * Tests the transport validator for MCP server transport configurations.
 */

import { describe, it, expect } from 'bun:test';
import {
  validateTransport,
  validateUrl,
  detectDockerCommand,
  analyzeTransport,
} from '../../../../../src/tools/config/mcp/validators/transport';
import type { Position } from '../../../../../src/tools/config/mcp/types';

const defaultPosition: Position = {
  start: { line: 1, column: 1 },
  end: { line: 1, column: 1 },
};

describe('validateUrl', () => {
  it('should accept valid http URL', () => {
    const result = validateUrl('http://localhost:3000');
    expect(result.isValid).toBe(true);
    expect(result.protocol).toBe('http:');
  });

  it('should accept valid https URL', () => {
    const result = validateUrl('https://api.example.com/mcp');
    expect(result.isValid).toBe(true);
    expect(result.protocol).toBe('https:');
  });

  it('should reject invalid URL format', () => {
    const result = validateUrl('not-a-valid-url');
    expect(result.isValid).toBe(false);
  });

  it('should reject non-http protocols', () => {
    const result = validateUrl('ftp://files.example.com');
    expect(result.isValid).toBe(false);
  });

  it('should detect localhost URLs', () => {
    const result = validateUrl('http://localhost:8080');
    expect(result.isLocal).toBe(true);
  });

  it('should detect remote URLs', () => {
    const result = validateUrl('https://api.example.com');
    expect(result.isLocal).toBe(false);
  });
});

describe('detectDockerCommand', () => {
  it('should detect docker command', () => {
    const result = detectDockerCommand('docker', ['run', '-i', 'mcp-server']);
    expect(result.isDocker).toBe(true);
  });

  it('should detect docker with -i flag', () => {
    const result = detectDockerCommand('docker', ['run', '-i', 'mcp-server']);
    expect(result.hasInteractiveFlag).toBe(true);
  });

  it('should detect docker with -it flags', () => {
    const result = detectDockerCommand('docker', ['run', '-it', 'mcp-server']);
    expect(result.hasInteractiveFlag).toBe(true);
  });

  it('should detect docker with --interactive flag', () => {
    const result = detectDockerCommand('docker', ['run', '--interactive', 'mcp-server']);
    expect(result.hasInteractiveFlag).toBe(true);
  });

  it('should detect missing -i flag', () => {
    const result = detectDockerCommand('docker', ['run', 'mcp-server']);
    expect(result.hasInteractiveFlag).toBe(false);
  });

  it('should detect docker image name', () => {
    const result = detectDockerCommand('docker', ['run', '-i', 'mcp/filesystem:latest']);
    expect(result.imageName).toBe('mcp/filesystem:latest');
  });

  it('should not flag non-docker commands', () => {
    const result = detectDockerCommand('npx', ['@mcp/server']);
    expect(result.isDocker).toBe(false);
  });
});

describe('analyzeTransport', () => {
  it('should analyze stdio transport', () => {
    const result = analyzeTransport({ command: 'npx', args: ['@mcp/server'] });
    expect(result.type).toBe('stdio');
  });

  it('should analyze SSE transport', () => {
    const result = analyzeTransport({ url: 'http://localhost:3000/sse', transport: 'sse' });
    expect(result.type).toBe('sse');
    expect(result.isDeprecated).toBe(true);
  });

  it('should analyze HTTP transport', () => {
    const result = analyzeTransport({ url: 'http://localhost:3000/mcp' });
    expect(result.type).toBe('http');
  });
});

describe('validateTransport', () => {
  // T037: SSE deprecation warning MCP012
  describe('MCP012 - SSE transport deprecation', () => {
    it('should return MCP012 for explicit SSE transport', () => {
      const serverConfig = {
        url: 'http://localhost:3000/sse',
        transport: 'sse' as const,
      };

      const issues = validateTransport(
        serverConfig,
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      const mcp012 = issues.find((i) => i.code === 'MCP012');
      expect(mcp012).toBeDefined();
      expect(mcp012!.severity).toBe('warning');
      expect(mcp012!.serverName).toBe('test-server');
    });

    it('should return MCP012 for SSE URL pattern without explicit transport', () => {
      const serverConfig = {
        url: 'http://localhost:3000/sse',
      };

      const issues = validateTransport(
        serverConfig,
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      const mcp012 = issues.find((i) => i.code === 'MCP012');
      expect(mcp012).toBeDefined();
    });

    it('should not return MCP012 for stdio transport', () => {
      const serverConfig = {
        command: 'npx',
        args: ['@mcp/server'],
      };

      const issues = validateTransport(
        serverConfig,
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      const mcp012 = issues.filter((i) => i.code === 'MCP012');
      expect(mcp012).toHaveLength(0);
    });

    it('should not return MCP012 for HTTP transport', () => {
      const serverConfig = {
        url: 'http://localhost:3000/mcp',
      };

      const issues = validateTransport(
        serverConfig,
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      const mcp012 = issues.filter((i) => i.code === 'MCP012');
      expect(mcp012).toHaveLength(0);
    });
  });

  // T038: Docker -i flag check MCP005
  describe('MCP005 - Docker missing interactive flag', () => {
    it('should return MCP005 for docker run without -i', () => {
      const serverConfig = {
        command: 'docker',
        args: ['run', 'mcp/filesystem:latest'],
      };

      const issues = validateTransport(
        serverConfig,
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      const mcp005 = issues.find((i) => i.code === 'MCP005');
      expect(mcp005).toBeDefined();
      expect(mcp005!.severity).toBe('error');
      expect(mcp005!.serverName).toBe('test-server');
    });

    it('should not return MCP005 for docker run with -i', () => {
      const serverConfig = {
        command: 'docker',
        args: ['run', '-i', 'mcp/filesystem:latest'],
      };

      const issues = validateTransport(
        serverConfig,
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      const mcp005 = issues.filter((i) => i.code === 'MCP005');
      expect(mcp005).toHaveLength(0);
    });

    it('should not return MCP005 for docker run with -it', () => {
      const serverConfig = {
        command: 'docker',
        args: ['run', '-it', 'mcp/filesystem:latest'],
      };

      const issues = validateTransport(
        serverConfig,
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      const mcp005 = issues.filter((i) => i.code === 'MCP005');
      expect(mcp005).toHaveLength(0);
    });

    it('should not return MCP005 for docker run with --interactive', () => {
      const serverConfig = {
        command: 'docker',
        args: ['run', '--interactive', 'mcp/filesystem:latest'],
      };

      const issues = validateTransport(
        serverConfig,
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      const mcp005 = issues.filter((i) => i.code === 'MCP005');
      expect(mcp005).toHaveLength(0);
    });

    it('should not flag non-docker commands', () => {
      const serverConfig = {
        command: 'npx',
        args: ['@mcp/server'],
      };

      const issues = validateTransport(
        serverConfig,
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      const mcp005 = issues.filter((i) => i.code === 'MCP005');
      expect(mcp005).toHaveLength(0);
    });
  });

  // MCP004: Invalid URL format
  describe('MCP004 - Invalid URL format', () => {
    it('should return MCP004 for invalid URL', () => {
      const serverConfig = {
        url: 'not-a-valid-url',
      };

      const issues = validateTransport(
        serverConfig,
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      const mcp004 = issues.find((i) => i.code === 'MCP004');
      expect(mcp004).toBeDefined();
      expect(mcp004!.severity).toBe('error');
    });

    it('should return MCP004 for non-http URL', () => {
      const serverConfig = {
        url: 'ftp://files.example.com',
      };

      const issues = validateTransport(
        serverConfig,
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      const mcp004 = issues.find((i) => i.code === 'MCP004');
      expect(mcp004).toBeDefined();
    });

    it('should not return MCP004 for valid http URL', () => {
      const serverConfig = {
        url: 'http://localhost:3000',
      };

      const issues = validateTransport(
        serverConfig,
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      const mcp004 = issues.filter((i) => i.code === 'MCP004');
      expect(mcp004).toHaveLength(0);
    });

    it('should not return MCP004 for valid https URL', () => {
      const serverConfig = {
        url: 'https://api.example.com/mcp',
      };

      const issues = validateTransport(
        serverConfig,
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      const mcp004 = issues.filter((i) => i.code === 'MCP004');
      expect(mcp004).toHaveLength(0);
    });

    it('should not check URL for stdio transport', () => {
      const serverConfig = {
        command: 'npx',
        args: ['@mcp/server'],
      };

      const issues = validateTransport(
        serverConfig,
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      const mcp004 = issues.filter((i) => i.code === 'MCP004');
      expect(mcp004).toHaveLength(0);
    });
  });

  describe('combined scenarios', () => {
    it('should handle multiple transport issues', () => {
      const serverConfig = {
        url: 'not-valid',
        transport: 'sse' as const,
      };

      const issues = validateTransport(
        serverConfig,
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      // Should have both MCP004 and MCP012
      expect(issues.find((i) => i.code === 'MCP004')).toBeDefined();
      expect(issues.find((i) => i.code === 'MCP012')).toBeDefined();
    });

    it('should return empty array for valid stdio config', () => {
      const serverConfig = {
        command: 'npx',
        args: ['@mcp/server'],
      };

      const issues = validateTransport(
        serverConfig,
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      expect(issues).toHaveLength(0);
    });

    it('should return empty array for valid HTTP config', () => {
      const serverConfig = {
        url: 'https://api.example.com/mcp',
      };

      const issues = validateTransport(
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
        validateTransport(serverConfig, '/test/.mcp.json', 'test-server', defaultPosition)
      ).not.toThrow();
    });

    it('should handle docker exec without run', () => {
      const serverConfig = {
        command: 'docker',
        args: ['exec', '-it', 'container', 'command'],
      };

      const issues = validateTransport(
        serverConfig,
        '/test/.mcp.json',
        'test-server',
        defaultPosition
      );

      // docker exec needs -i too for MCP
      const mcp005 = issues.find((i) => i.code === 'MCP005');
      // With -it it should pass
      expect(mcp005).toBeUndefined();
    });
  });
});
