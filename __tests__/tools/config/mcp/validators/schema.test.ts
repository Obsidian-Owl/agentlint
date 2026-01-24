/**
 * Unit tests for MCP Schema Validation
 *
 * Tests the schema validator for MCP server configurations.
 */

import { describe, it, expect } from 'bun:test';
import {
  validateSchema,
  validateServerSchema,
} from '../../../../../src/tools/config/mcp/validators/schema';
import { parseMcpConfig } from '../../../../../src/tools/config/mcp/parser';
import type { McpFormat } from '../../../../../src/tools/config/mcp/types';

describe('validateSchema', () => {
  // T021: valid config passes schema
  describe('valid configurations', () => {
    it('should pass for valid stdio server config', () => {
      const content = JSON.stringify({
        mcpServers: {
          github: {
            command: 'npx',
            args: ['-y', '@mcp/github'],
            env: { GITHUB_TOKEN: '${GITHUB_TOKEN}' },
          },
        },
      });
      const parseResult = parseMcpConfig(content);
      expect(parseResult.success).toBe(true);

      const issues = validateSchema(
        parseResult.config!,
        parseResult.tree!,
        content,
        '/test/.mcp.json',
        'standard'
      );

      // No errors expected for valid config
      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it('should pass for valid HTTP server config', () => {
      const content = JSON.stringify({
        mcpServers: {
          remote: {
            type: 'http',
            url: 'https://example.com/mcp',
            headers: { Authorization: 'Bearer token' },
          },
        },
      });
      const parseResult = parseMcpConfig(content);

      const issues = validateSchema(
        parseResult.config!,
        parseResult.tree!,
        content,
        '/test/.mcp.json',
        'standard'
      );

      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it('should pass for valid OpenCode format config', () => {
      const content = JSON.stringify({
        mcp: {
          github: {
            type: 'local',
            command: ['npx', '-y', '@mcp/github'],
            enabled: true,
            environment: { GITHUB_TOKEN: 'token' },
          },
        },
      });
      const parseResult = parseMcpConfig(content);

      const issues = validateSchema(
        parseResult.config!,
        parseResult.tree!,
        content,
        '/test/opencode.json',
        'opencode'
      );

      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors).toHaveLength(0);
    });
  });

  // T022: missing required field returns MCP001
  describe('MCP001 - missing required field', () => {
    it('should return MCP001 for server without command or url', () => {
      const content = JSON.stringify({
        mcpServers: {
          invalid: {
            args: ['-y', '@mcp/test'],
            env: { KEY: 'value' },
          },
        },
      });
      const parseResult = parseMcpConfig(content);

      const issues = validateSchema(
        parseResult.config!,
        parseResult.tree!,
        content,
        '/test/.mcp.json',
        'standard'
      );

      const mcp001 = issues.find((i) => i.code === 'MCP001');
      expect(mcp001).toBeDefined();
      expect(mcp001!.severity).toBe('error');
      expect(mcp001!.serverName).toBe('invalid');
      expect(mcp001!.message).toContain('command');
    });

    it('should include file position in MCP001 issue', () => {
      const content = `{
  "mcpServers": {
    "invalid": {
      "args": ["-y"]
    }
  }
}`;
      const parseResult = parseMcpConfig(content);

      const issues = validateSchema(
        parseResult.config!,
        parseResult.tree!,
        content,
        '/test/.mcp.json',
        'standard'
      );

      const mcp001 = issues.find((i) => i.code === 'MCP001');
      expect(mcp001).toBeDefined();
      expect(mcp001!.line).toBeGreaterThan(1);
      expect(mcp001!.column).toBeGreaterThan(0);
    });
  });

  // T023: invalid types return MCP002 with position
  describe('MCP002 - invalid field type', () => {
    it('should return MCP002 for non-string command', () => {
      const content = JSON.stringify({
        mcpServers: {
          test: {
            command: 123,
            args: ['-y'],
          },
        },
      });
      const parseResult = parseMcpConfig(content);

      const issues = validateSchema(
        parseResult.config!,
        parseResult.tree!,
        content,
        '/test/.mcp.json',
        'standard'
      );

      const mcp002 = issues.find((i) => i.code === 'MCP002');
      expect(mcp002).toBeDefined();
      expect(mcp002!.severity).toBe('error');
      expect(mcp002!.field).toBe('command');
      expect(mcp002!.message).toContain('string');
    });

    it('should return MCP002 for non-array args', () => {
      const content = JSON.stringify({
        mcpServers: {
          test: {
            command: 'npx',
            args: 'not-an-array',
          },
        },
      });
      const parseResult = parseMcpConfig(content);

      const issues = validateSchema(
        parseResult.config!,
        parseResult.tree!,
        content,
        '/test/.mcp.json',
        'standard'
      );

      const mcp002 = issues.find((i) => i.code === 'MCP002');
      expect(mcp002).toBeDefined();
      expect(mcp002!.field).toBe('args');
    });

    it('should return MCP002 for non-object env', () => {
      const content = JSON.stringify({
        mcpServers: {
          test: {
            command: 'npx',
            env: 'not-an-object',
          },
        },
      });
      const parseResult = parseMcpConfig(content);

      const issues = validateSchema(
        parseResult.config!,
        parseResult.tree!,
        content,
        '/test/.mcp.json',
        'standard'
      );

      const mcp002 = issues.find((i) => i.code === 'MCP002');
      expect(mcp002).toBeDefined();
      expect(mcp002!.field).toBe('env');
    });

    it('should include position in MCP002 issue', () => {
      const content = `{
  "mcpServers": {
    "test": {
      "command": 123
    }
  }
}`;
      const parseResult = parseMcpConfig(content);

      const issues = validateSchema(
        parseResult.config!,
        parseResult.tree!,
        content,
        '/test/.mcp.json',
        'standard'
      );

      const mcp002 = issues.find((i) => i.code === 'MCP002');
      expect(mcp002).toBeDefined();
      expect(mcp002!.line).toBeGreaterThan(1);
      expect(mcp002!.column).toBeGreaterThan(0);
    });
  });

  // MCP015 - ambiguous transport
  describe('MCP015 - ambiguous transport', () => {
    it('should return MCP015 when both command and url are present', () => {
      const content = JSON.stringify({
        mcpServers: {
          ambiguous: {
            command: 'npx',
            url: 'https://example.com/mcp',
          },
        },
      });
      const parseResult = parseMcpConfig(content);

      const issues = validateSchema(
        parseResult.config!,
        parseResult.tree!,
        content,
        '/test/.mcp.json',
        'standard'
      );

      const mcp015 = issues.find((i) => i.code === 'MCP015');
      expect(mcp015).toBeDefined();
      expect(mcp015!.severity).toBe('warning');
      expect(mcp015!.serverName).toBe('ambiguous');
    });
  });

  // MCP016 - unknown field
  describe('MCP016 - unknown field', () => {
    it('should return MCP016 for unrecognized fields in standard format', () => {
      const content = JSON.stringify({
        mcpServers: {
          test: {
            command: 'npx',
            unknownField: 'value',
            anotherUnknown: 123,
          },
        },
      });
      const parseResult = parseMcpConfig(content);

      const issues = validateSchema(
        parseResult.config!,
        parseResult.tree!,
        content,
        '/test/.mcp.json',
        'standard'
      );

      const mcp016 = issues.filter((i) => i.code === 'MCP016');
      expect(mcp016.length).toBeGreaterThanOrEqual(1);
      expect(mcp016[0]!.severity).toBe('info');
    });

    it('should not flag OpenCode fields in OpenCode format', () => {
      const content = JSON.stringify({
        mcp: {
          test: {
            type: 'local',
            command: ['npx'],
            enabled: true,
            environment: {},
          },
        },
      });
      const parseResult = parseMcpConfig(content);

      const issues = validateSchema(
        parseResult.config!,
        parseResult.tree!,
        content,
        '/test/opencode.json',
        'opencode'
      );

      // Should not have MCP016 for standard OpenCode fields
      const mcp016 = issues.filter((i) => i.code === 'MCP016');
      expect(mcp016).toHaveLength(0);
    });
  });

  // MCP020 - disabled server
  describe('MCP020 - disabled server', () => {
    it('should return MCP020 for disabled server', () => {
      const content = JSON.stringify({
        mcpServers: {
          disabled: {
            command: 'npx',
            disabled: true,
          },
        },
      });
      const parseResult = parseMcpConfig(content);

      const issues = validateSchema(
        parseResult.config!,
        parseResult.tree!,
        content,
        '/test/.mcp.json',
        'standard'
      );

      const mcp020 = issues.find((i) => i.code === 'MCP020');
      expect(mcp020).toBeDefined();
      expect(mcp020!.severity).toBe('info');
      expect(mcp020!.serverName).toBe('disabled');
    });

    it('should return MCP020 for OpenCode enabled: false', () => {
      const content = JSON.stringify({
        mcp: {
          disabled: {
            command: ['npx'],
            enabled: false,
          },
        },
      });
      const parseResult = parseMcpConfig(content);

      const issues = validateSchema(
        parseResult.config!,
        parseResult.tree!,
        content,
        '/test/opencode.json',
        'opencode'
      );

      const mcp020 = issues.find((i) => i.code === 'MCP020');
      expect(mcp020).toBeDefined();
    });
  });
});

describe('validateServerSchema', () => {
  it('should validate individual server config', () => {
    const serverConfig = {
      command: 'npx',
      args: ['-y', '@mcp/test'],
    };

    const issues = validateServerSchema(
      'test',
      serverConfig,
      '/test/.mcp.json',
      { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } },
      'standard'
    );

    const errors = issues.filter((i) => i.severity === 'error');
    expect(errors).toHaveLength(0);
  });
});
