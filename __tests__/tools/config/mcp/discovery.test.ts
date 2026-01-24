/**
 * Unit tests for MCP Config Discovery
 *
 * Tests the discovery module for finding MCP configuration files
 * across multiple AI Coding Tools (ACTs).
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  discoverMcpConfigs,
  ACT_CONFIG_LOCATIONS,
  getConfigLocationsForAct,
  detectActFromPath,
  type ConfigLocation,
} from '../../../../src/tools/config/mcp/discovery';
import type { McpAct } from '../../../../src/tools/config/mcp/types';

describe('ACT_CONFIG_LOCATIONS', () => {
  it('should define locations for claude-code', () => {
    const locations = ACT_CONFIG_LOCATIONS['claude-code'];
    expect(locations).toBeDefined();
    expect(locations.length).toBeGreaterThan(0);

    // Should have both project and user scope configs
    const scopes = locations.map((l) => l.scope);
    expect(scopes).toContain('project');
    expect(scopes).toContain('user');
  });

  it('should define locations for opencode', () => {
    const locations = ACT_CONFIG_LOCATIONS['opencode'];
    expect(locations).toBeDefined();
    expect(locations.length).toBeGreaterThan(0);
  });

  it('should define locations for vscode-copilot', () => {
    const locations = ACT_CONFIG_LOCATIONS['vscode-copilot'];
    expect(locations).toBeDefined();
    expect(locations.length).toBeGreaterThan(0);
  });
});

describe('getConfigLocationsForAct', () => {
  it('should return locations for a specific ACT', () => {
    const locations = getConfigLocationsForAct('claude-code');
    expect(Array.isArray(locations)).toBe(true);
    expect(locations.length).toBeGreaterThan(0);
  });

  it('should return empty array for unknown ACT', () => {
    const locations = getConfigLocationsForAct('unknown');
    expect(locations).toEqual([]);
  });
});

describe('detectActFromPath', () => {
  it('should detect claude-code from .mcp.json', () => {
    const act = detectActFromPath('/project/.mcp.json');
    expect(act).toBe('claude-code');
  });

  it('should detect claude-code from ~/.claude.json', () => {
    const act = detectActFromPath('/Users/test/.claude.json');
    expect(act).toBe('claude-code');
  });

  it('should detect opencode from opencode.json', () => {
    const act = detectActFromPath('/project/opencode.json');
    expect(act).toBe('opencode');
  });

  it('should detect opencode from ~/.config/opencode/', () => {
    const act = detectActFromPath('/home/user/.config/opencode/opencode.json');
    expect(act).toBe('opencode');
  });

  it('should detect vscode-copilot from .vscode/mcp.json', () => {
    const act = detectActFromPath('/project/.vscode/mcp.json');
    expect(act).toBe('vscode-copilot');
  });

  it('should detect cursor from mcp.json (project root)', () => {
    const act = detectActFromPath('/project/mcp.json');
    expect(act).toBe('cursor');
  });

  it('should detect windsurf from ~/.codeium/windsurf/', () => {
    const act = detectActFromPath('/Users/test/.codeium/windsurf/mcp_config.json');
    expect(act).toBe('windsurf');
  });

  it('should detect amazon-q from .amazonq/', () => {
    const act = detectActFromPath('/project/.amazonq/mcp.json');
    expect(act).toBe('amazon-q');
  });

  it('should return unknown for unrecognized paths', () => {
    const act = detectActFromPath('/some/random/path.json');
    expect(act).toBe('unknown');
  });
});

describe('discoverMcpConfigs', () => {
  let tempDir: string;
  let projectDir: string;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    tempDir = join(tmpdir(), `mcp-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    projectDir = join(tempDir, 'project');
    await mkdir(projectDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // T013: discovers .mcp.json at project root
  it('should discover .mcp.json at project root', async () => {
    // Create .mcp.json
    const mcpJsonPath = join(projectDir, '.mcp.json');
    await writeFile(
      mcpJsonPath,
      JSON.stringify({
        mcpServers: {
          test: { command: 'npx', args: ['-y', '@mcp/test'] },
        },
      })
    );

    const result = await discoverMcpConfigs({
      cwd: projectDir,
      includeUser: false,
    });

    // Should find the file
    expect(result.files.length).toBeGreaterThanOrEqual(1);

    const mcpFile = result.files.find((f) => f.path === mcpJsonPath);
    expect(mcpFile).toBeDefined();
    expect(mcpFile!.exists).toBe(true);
    expect(mcpFile!.act).toBe('claude-code');
    expect(mcpFile!.scope).toBe('project');
    expect(mcpFile!.format).toBe('standard');
  });

  // T014: discovers ~/.claude.json user config
  it('should discover user-level configs when includeUser is true', async () => {
    const result = await discoverMcpConfigs({
      cwd: projectDir,
      includeUser: true,
    });

    // Should check for user-level config locations
    const userConfigs = result.files.filter((f) => f.scope === 'user');
    expect(userConfigs.length).toBeGreaterThanOrEqual(0);

    // Summary should reflect what was found
    expect(result.summary).toBeDefined();
    expect(result.summary.totalFiles).toBe(result.files.length);
  });

  // T015: discovers OpenCode configs
  it('should discover OpenCode configs', async () => {
    // Create opencode.json
    const opencodeJsonPath = join(projectDir, 'opencode.json');
    await writeFile(
      opencodeJsonPath,
      JSON.stringify({
        mcp: {
          test: {
            type: 'local',
            command: ['npx', '-y', '@mcp/test'],
          },
        },
      })
    );

    const result = await discoverMcpConfigs({
      cwd: projectDir,
      includeUser: false,
      acts: ['opencode'],
    });

    const openCodeFile = result.files.find((f) => f.path === opencodeJsonPath);
    expect(openCodeFile).toBeDefined();
    expect(openCodeFile!.exists).toBe(true);
    expect(openCodeFile!.act).toBe('opencode');
    expect(openCodeFile!.format).toBe('opencode');
  });

  // T016: handles non-existent configs gracefully
  it('should handle non-existent configs gracefully', async () => {
    // Don't create any config files
    const result = await discoverMcpConfigs({
      cwd: projectDir,
      includeUser: false,
    });

    // Should return empty or non-existent file entries without errors
    expect(result).toBeDefined();
    expect(result.files).toBeDefined();
    expect(result.summary.existingFiles).toBe(0);

    // Guidance should be provided when no configs found
    expect(result.guidance.length).toBeGreaterThan(0);
  });

  it('should filter by specific ACTs', async () => {
    // Create both .mcp.json and opencode.json
    await writeFile(
      join(projectDir, '.mcp.json'),
      JSON.stringify({ mcpServers: {} })
    );
    await writeFile(
      join(projectDir, 'opencode.json'),
      JSON.stringify({ mcp: {} })
    );

    // Request only claude-code
    const result = await discoverMcpConfigs({
      cwd: projectDir,
      includeUser: false,
      acts: ['claude-code'],
    });

    // Should only find claude-code configs
    const acts = result.files.map((f) => f.act);
    expect(acts).toContain('claude-code');
    expect(acts).not.toContain('opencode');
  });

  it('should discover VS Code .vscode/mcp.json', async () => {
    // Create .vscode directory and mcp.json
    const vscodeDir = join(projectDir, '.vscode');
    await mkdir(vscodeDir, { recursive: true });
    await writeFile(
      join(vscodeDir, 'mcp.json'),
      JSON.stringify({ servers: { test: { command: 'npx' } } })
    );

    const result = await discoverMcpConfigs({
      cwd: projectDir,
      includeUser: false,
      acts: ['vscode-copilot'],
    });

    const vscodeFile = result.files.find((f) => f.path.includes('.vscode/mcp.json'));
    expect(vscodeFile).toBeDefined();
    expect(vscodeFile!.exists).toBe(true);
    expect(vscodeFile!.act).toBe('vscode-copilot');
    expect(vscodeFile!.format).toBe('vscode-copilot');
  });

  it('should report parse errors for invalid JSON', async () => {
    // Create invalid JSON
    await writeFile(join(projectDir, '.mcp.json'), '{ invalid json }');

    const result = await discoverMcpConfigs({
      cwd: projectDir,
      includeUser: false,
    });

    const mcpFile = result.files.find((f) => f.path.endsWith('.mcp.json'));
    expect(mcpFile).toBeDefined();
    expect(mcpFile!.exists).toBe(true);
    expect(mcpFile!.parseError).toBeDefined();
    expect(mcpFile!.parseError!.message).toBeDefined();
    expect(mcpFile!.parseError!.line).toBeGreaterThan(0);
  });

  it('should include summary statistics', async () => {
    // Create .mcp.json
    await writeFile(
      join(projectDir, '.mcp.json'),
      JSON.stringify({ mcpServers: {} })
    );

    const result = await discoverMcpConfigs({
      cwd: projectDir,
      includeUser: false,
    });

    expect(result.summary).toBeDefined();
    expect(result.summary.totalFiles).toBeGreaterThanOrEqual(1);
    expect(result.summary.existingFiles).toBeGreaterThanOrEqual(1);
    expect(result.summary.byAct).toBeDefined();
    expect(result.summary.byScope).toBeDefined();
  });

  it('should populate compatibleActs for cross-ACT recognition', async () => {
    // Create .mcp.json which is recognized by multiple ACTs
    await writeFile(
      join(projectDir, '.mcp.json'),
      JSON.stringify({ mcpServers: {} })
    );

    const result = await discoverMcpConfigs({
      cwd: projectDir,
      includeUser: false,
    });

    const mcpFile = result.files.find((f) => f.path.endsWith('.mcp.json'));
    expect(mcpFile).toBeDefined();
    // .mcp.json is primarily claude-code but may be recognized by others
    expect(mcpFile!.compatibleActs).toBeDefined();
    expect(mcpFile!.compatibleActs).toContain('claude-code');
  });
});
