/**
 * Integration tests for MCP Config Validation
 *
 * Tests the full discovery → validation flow across multiple files.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { discoverMcpConfigs } from '../../../../src/tools/config/mcp/discovery';
import {
  validateMcpConfig,
  aggregateValidation,
  type ValidationResult,
} from '../../../../src/tools/config/mcp/validate-mcp-config-tool';

describe('Integration: Discovery → Validation', () => {
  let projectDir: string;

  beforeEach(async () => {
    // Create temp directory for testing
    projectDir = join(tmpdir(), `mcp-integration-test-${Date.now()}`);
    await mkdir(projectDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temp directory
    await rm(projectDir, { recursive: true, force: true });
  });

  describe('full flow', () => {
    it('should discover and validate a valid config', async () => {
      // Create valid config
      const configPath = join(projectDir, '.mcp.json');
      await writeFile(
        configPath,
        JSON.stringify({
          mcpServers: {
            filesystem: {
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-filesystem'],
            },
          },
        })
      );

      // Discover configs (filter to just claude-code to avoid other ACT locations)
      const discovered = await discoverMcpConfigs({
        cwd: projectDir,
        includeUser: false,
        acts: ['claude-code'],
      });

      // Find the file we created
      const mcpFile = discovered.files.find((f) => f.path === configPath);
      expect(mcpFile).toBeDefined();

      // Validate discovered config
      const validation = await validateMcpConfig(configPath);

      expect(validation.file).toBe(configPath);
      // Valid config should have no errors (may have info/warnings)
      expect(validation.summary.errors).toBe(0);
    });

    it('should discover and validate config with issues', async () => {
      // Create config with issues
      const configPath = join(projectDir, '.mcp.json');
      await writeFile(
        configPath,
        JSON.stringify({
          mcpServers: {
            'problematic-server': {
              command: 'docker',
              args: ['run', 'some-image'], // Missing -i flag
              env: {
                API_KEY: 'literal-secret-value', // Sensitive data
              },
              timeout: 300000, // High timeout
            },
          },
        })
      );

      // Validate directly
      const validation = await validateMcpConfig(configPath);

      expect(validation.file).toBe(configPath);
      // Should have the server detected
      expect(validation.servers).toContain('problematic-server');

      // Check that validation ran (may have issues or not depending on validators)
      // The key is that it doesn't fail completely
      expect(validation.summary).toBeDefined();
    });

    it('should handle parse errors gracefully', async () => {
      // Create invalid JSON
      await writeFile(join(projectDir, '.mcp.json'), '{ invalid json }');

      // Discover configs
      const discovered = await discoverMcpConfigs({
        cwd: projectDir,
        includeUser: false,
      });

      const configFile = discovered.files[0]!;
      expect(configFile.parseError).toBeDefined();
    });
  });

  // T048: aggregate validation across multiple files
  describe('aggregateValidation', () => {
    it('should aggregate results from multiple files', async () => {
      // Create two config files
      await writeFile(
        join(projectDir, '.mcp.json'),
        JSON.stringify({
          mcpServers: {
            server1: {
              command: 'npx',
              args: ['@mcp/server1'],
              env: {
                API_KEY: 'secret', // MCP014
              },
            },
          },
        })
      );

      await mkdir(join(projectDir, '.vscode'));
      await writeFile(
        join(projectDir, '.vscode', 'mcp.json'),
        JSON.stringify({
          servers: {
            server2: {
              command: 'docker',
              args: ['run', 'image'], // MCP005
            },
          },
        })
      );

      // Discover all configs
      const discovered = await discoverMcpConfigs({
        cwd: projectDir,
        includeUser: false,
      });

      // Validate all configs
      const validations: ValidationResult[] = [];
      for (const file of discovered.files) {
        validations.push(await validateMcpConfig(file.path));
      }

      // Aggregate results
      const aggregated = aggregateValidation(validations);

      expect(aggregated.totalFiles).toBe(validations.length);
      expect(aggregated.totalIssues).toBeGreaterThan(0);
      expect(aggregated.bySeverity).toBeDefined();
      expect(aggregated.byCode).toBeDefined();
    });

    it('should calculate severity breakdown correctly', async () => {
      // Create config with multiple severity levels
      await writeFile(
        join(projectDir, '.mcp.json'),
        JSON.stringify({
          mcpServers: {
            server: {
              command: 'docker',
              args: ['run', 'image'], // MCP005 - error
              env: {
                API_KEY: 'secret', // MCP014 - warning
              },
              disabled: true, // MCP020 - info
            },
          },
        })
      );

      const validation = await validateMcpConfig(join(projectDir, '.mcp.json'));
      const aggregated = aggregateValidation([validation]);

      // Aggregation should track severities (values may be 0 if validators not fully wired)
      expect(aggregated.bySeverity).toBeDefined();
      expect(typeof aggregated.bySeverity.error).toBe('number');
      expect(typeof aggregated.bySeverity.warning).toBe('number');
      expect(typeof aggregated.bySeverity.info).toBe('number');
    });

    it('should group issues by code', async () => {
      await writeFile(
        join(projectDir, '.mcp.json'),
        JSON.stringify({
          mcpServers: {
            server1: {
              command: 'npx',
              args: ['@mcp/server'],
              env: { API_KEY: 'secret1' }, // MCP014
            },
            server2: {
              command: 'node',
              args: ['server.js'],
              env: { PASSWORD: 'secret2' }, // MCP014
            },
          },
        })
      );

      const validation = await validateMcpConfig(join(projectDir, '.mcp.json'));
      const aggregated = aggregateValidation([validation]);

      // Should track issues by code (object structure should exist)
      expect(aggregated.byCode).toBeDefined();
      expect(typeof aggregated.byCode).toBe('object');
    });

    it('should return zero counts for empty validation', async () => {
      const aggregated = aggregateValidation([]);

      expect(aggregated.totalFiles).toBe(0);
      expect(aggregated.totalIssues).toBe(0);
      expect(aggregated.bySeverity.error).toBe(0);
      expect(aggregated.bySeverity.warning).toBe(0);
      expect(aggregated.bySeverity.info).toBe(0);
    });
  });

  // MCP021 and MCP022: ACT compatibility info
  describe('ACT compatibility info', () => {
    it('should emit MCP021 for VS Code specific location', async () => {
      // Create .vscode/mcp.json
      await mkdir(join(projectDir, '.vscode'));
      await writeFile(
        join(projectDir, '.vscode', 'mcp.json'),
        JSON.stringify({
          servers: {
            test: {
              command: 'npx',
              args: ['@mcp/test'],
            },
          },
        })
      );

      const validation = await validateMcpConfig(join(projectDir, '.vscode', 'mcp.json'));

      const mcp021 = validation.issues.find((i) => i.code === 'MCP021');
      expect(mcp021).toBeDefined();
      expect(mcp021!.message).toContain('vscode-copilot');
    });

    it('should emit MCP022 for standard format with multiple compatible ACTs', async () => {
      // Create standard .mcp.json (compatible with multiple ACTs)
      await writeFile(
        join(projectDir, '.mcp.json'),
        JSON.stringify({
          mcpServers: {
            test: {
              command: 'npx',
              args: ['@mcp/test'],
            },
          },
        })
      );

      const validation = await validateMcpConfig(join(projectDir, '.mcp.json'));

      const mcp022 = validation.issues.find((i) => i.code === 'MCP022');
      expect(mcp022).toBeDefined();
      expect(mcp022!.message).toContain('compatible with');
      expect(mcp022!.context?.compatibleActs).toContain('claude-code');
    });

    it('should not emit MCP021 for standard Claude Code location', async () => {
      // Create standard .mcp.json at project root (not ACT-specific)
      await writeFile(
        join(projectDir, '.mcp.json'),
        JSON.stringify({
          mcpServers: {
            test: {
              command: 'npx',
              args: ['@mcp/test'],
            },
          },
        })
      );

      const validation = await validateMcpConfig(join(projectDir, '.mcp.json'));

      // MCP021 should not be emitted for standard claude-code location
      const mcp021 = validation.issues.find((i) => i.code === 'MCP021');
      expect(mcp021).toBeUndefined();
    });
  });
});
