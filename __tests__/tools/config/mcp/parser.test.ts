/**
 * Unit tests for MCP Config JSONC Parser
 *
 * Tests the parser module for JSONC parsing with position tracking.
 */

import { describe, it, expect } from 'bun:test';
import {
  offsetToPosition,
  parseMcpConfig,
  getPositionAtPath,
  buildPositionMap,
  extractServers,
} from '../../../../src/tools/config/mcp/parser';

describe('offsetToPosition', () => {
  it('should return line 1, column 1 for offset 0', () => {
    const content = 'hello world';
    const result = offsetToPosition(content, 0);
    expect(result).toEqual({ line: 1, column: 1, offset: 0 });
  });

  it('should handle single line content', () => {
    const content = 'hello world';
    const result = offsetToPosition(content, 6);
    expect(result).toEqual({ line: 1, column: 7, offset: 6 });
  });

  it('should handle multi-line content', () => {
    const content = 'line1\nline2\nline3';
    // Position of 'l' in 'line2' (offset 6)
    const result = offsetToPosition(content, 6);
    expect(result).toEqual({ line: 2, column: 1, offset: 6 });
  });

  it('should handle offset in middle of second line', () => {
    const content = 'line1\nline2\nline3';
    // Position of '2' in 'line2' (offset 10)
    const result = offsetToPosition(content, 10);
    expect(result).toEqual({ line: 2, column: 5, offset: 10 });
  });

  it('should handle third line', () => {
    const content = 'line1\nline2\nline3';
    // Position of 'l' in 'line3' (offset 12)
    const result = offsetToPosition(content, 12);
    expect(result).toEqual({ line: 3, column: 1, offset: 12 });
  });
});

describe('parseMcpConfig', () => {
  it('should parse valid JSON', () => {
    const content = '{"mcpServers": {"test": {"command": "npx"}}}';
    const result = parseMcpConfig(content);

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.config).toEqual({
      mcpServers: { test: { command: 'npx' } },
    });
    expect(result.tree).not.toBeNull();
  });

  it('should parse JSONC with comments', () => {
    const content = `{
      // This is a comment
      "mcpServers": {
        /* Another comment */
        "test": {
          "command": "npx"
        }
      }
    }`;
    const result = parseMcpConfig(content);

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.config).toEqual({
      mcpServers: { test: { command: 'npx' } },
    });
  });

  it('should parse JSONC with trailing commas', () => {
    const content = `{
      "mcpServers": {
        "test": {
          "command": "npx",
          "args": ["arg1", "arg2",],
        },
      },
    }`;
    const result = parseMcpConfig(content);

    expect(result.success).toBe(true);
    expect(result.config).toEqual({
      mcpServers: { test: { command: 'npx', args: ['arg1', 'arg2'] } },
    });
  });

  it('should handle empty content', () => {
    const content = '';
    const result = parseMcpConfig(content);

    // Empty content is valid (returns null config)
    expect(result.success).toBe(true);
    expect(result.config).toBeNull();
  });

  it('should handle invalid JSON with parse errors', () => {
    const content = '{ invalid json }';
    const result = parseMcpConfig(content);

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toHaveProperty('line');
    expect(result.errors[0]).toHaveProperty('column');
  });

  it('should handle unclosed braces', () => {
    const content = '{ "mcpServers": {';
    const result = parseMcpConfig(content);

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('getPositionAtPath', () => {
  it('should find position of root-level property', () => {
    const content = '{\n  "mcpServers": {}\n}';
    const result = parseMcpConfig(content);

    expect(result.tree).not.toBeNull();
    const position = getPositionAtPath(content, result.tree!, ['mcpServers']);

    expect(position).not.toBeNull();
    expect(position!.start.line).toBe(2);
  });

  it('should find position of nested property', () => {
    const content = `{
  "mcpServers": {
    "github": {
      "command": "npx"
    }
  }
}`;
    const result = parseMcpConfig(content);

    expect(result.tree).not.toBeNull();
    const position = getPositionAtPath(content, result.tree!, [
      'mcpServers',
      'github',
      'command',
    ]);

    expect(position).not.toBeNull();
    expect(position!.start.line).toBe(4);
  });

  it('should return null for non-existent path', () => {
    const content = '{"mcpServers": {}}';
    const result = parseMcpConfig(content);

    expect(result.tree).not.toBeNull();
    const position = getPositionAtPath(content, result.tree!, [
      'mcpServers',
      'nonexistent',
    ]);

    expect(position).toBeNull();
  });
});

describe('buildPositionMap', () => {
  it('should build position map for all paths', () => {
    const content = `{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y"]
    }
  }
}`;
    const result = parseMcpConfig(content);

    expect(result.tree).not.toBeNull();
    const map = buildPositionMap(content, result.tree!);

    expect(map.has('mcpServers')).toBe(true);
    expect(map.has('mcpServers.github')).toBe(true);
    expect(map.has('mcpServers.github.command')).toBe(true);
    expect(map.has('mcpServers.github.args')).toBe(true);
    expect(map.has('mcpServers.github.args.0')).toBe(true);
  });
});

describe('extractServers', () => {
  it('should extract servers from standard mcpServers format', () => {
    const content = `{
  "mcpServers": {
    "github": {"command": "npx", "args": ["-y", "@mcp/github"]},
    "filesystem": {"command": "node", "args": ["server.js"]}
  }
}`;
    const result = parseMcpConfig(content);

    expect(result.tree).not.toBeNull();
    expect(result.config).not.toBeNull();

    const servers = extractServers(content, result.tree!, result.config!);

    expect(servers).toHaveLength(2);
    expect(servers[0].name).toBe('github');
    expect(servers[0].config).toHaveProperty('command', 'npx');
    expect(servers[0].position.start.line).toBeGreaterThan(1);

    expect(servers[1].name).toBe('filesystem');
    expect(servers[1].config).toHaveProperty('command', 'node');
  });

  it('should extract servers from OpenCode mcp format', () => {
    const content = `{
  "mcp": {
    "github": {
      "type": "local",
      "command": ["npx", "-y", "@mcp/github"]
    }
  }
}`;
    const result = parseMcpConfig(content);

    expect(result.tree).not.toBeNull();
    expect(result.config).not.toBeNull();

    const servers = extractServers(content, result.tree!, result.config!);

    expect(servers).toHaveLength(1);
    expect(servers[0].name).toBe('github');
    expect(servers[0].config).toHaveProperty('type', 'local');
    expect(servers[0].config).toHaveProperty('command');
    expect(Array.isArray(servers[0].config.command)).toBe(true);
  });

  it('should extract servers from VS Code servers format', () => {
    const content = `{
  "servers": {
    "myserver": {"command": "npx", "args": ["server"]}
  }
}`;
    const result = parseMcpConfig(content);

    expect(result.tree).not.toBeNull();
    expect(result.config).not.toBeNull();

    const servers = extractServers(content, result.tree!, result.config!);

    expect(servers).toHaveLength(1);
    expect(servers[0].name).toBe('myserver');
  });

  it('should return empty array for config with no servers', () => {
    const content = '{"version": 1}';
    const result = parseMcpConfig(content);

    expect(result.config).not.toBeNull();

    const servers = extractServers(content, result.tree!, result.config!);

    expect(servers).toHaveLength(0);
  });

  it('should include position information for each server', () => {
    const content = `{
  "mcpServers": {
    "test": {
      "command": "npx"
    }
  }
}`;
    const result = parseMcpConfig(content);

    const servers = extractServers(content, result.tree!, result.config!);

    expect(servers).toHaveLength(1);
    expect(servers[0].position).toHaveProperty('start');
    expect(servers[0].position).toHaveProperty('end');
    expect(servers[0].position.start.line).toBe(3);
    expect(servers[0].position.start.column).toBeGreaterThan(0);
  });
});
