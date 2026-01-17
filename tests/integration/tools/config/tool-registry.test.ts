/**
 * T076: Test tool integration with ToolRegistry
 *
 * Tests that EP05 tools register correctly with the ToolRegistry
 * and can be converted to MCP server configuration.
 *
 * @module tests/integration/tools/config/tool-registry.test.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { createToolRegistry, ToolRegistry } from '../../../../src/orchestration/tool-registry';
import {
  discoverConfigsTool,
  parseConfigTool,
  analyzeHierarchyTool,
  EP05_CONFIG_TOOLS,
  registerEP05Tools,
  registerAllTools,
} from '../../../../src/tools';

describe('EP05 Tool Registration', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('individual tool registration', () => {
    it('should register discover_configs tool', () => {
      registry.register(discoverConfigsTool);

      const tools = registry.list();
      expect(tools).toContain('discover_configs');
    });

    it('should register parse_config tool', () => {
      registry.register(parseConfigTool);

      const tools = registry.list();
      expect(tools).toContain('parse_config');
    });

    it('should register analyze_hierarchy tool', () => {
      registry.register(analyzeHierarchyTool);

      const tools = registry.list();
      expect(tools).toContain('analyze_hierarchy');
    });

    it('should retrieve registered tools by name', () => {
      registry.register(discoverConfigsTool);
      registry.register(parseConfigTool);
      registry.register(analyzeHierarchyTool);

      expect(registry.get('discover_configs')).toBeDefined();
      expect(registry.get('parse_config')).toBeDefined();
      expect(registry.get('analyze_hierarchy')).toBeDefined();
      expect(registry.get('nonexistent')).toBeUndefined();
    });
  });

  describe('bulk registration', () => {
    it('should register all EP05 tools via registerMany', () => {
      registry.registerMany([...EP05_CONFIG_TOOLS]);

      const tools = registry.list();
      expect(tools.length).toBe(3);
      expect(tools).toContain('discover_configs');
      expect(tools).toContain('parse_config');
      expect(tools).toContain('analyze_hierarchy');
    });

    it('should register all EP05 tools via registerEP05Tools helper', () => {
      registerEP05Tools(registry);

      const tools = registry.list();
      expect(tools.length).toBe(3);
      expect(tools).toContain('discover_configs');
      expect(tools).toContain('parse_config');
      expect(tools).toContain('analyze_hierarchy');
    });

    it('should register all tools via registerAllTools helper', () => {
      registerAllTools(registry);

      const tools = registry.list();
      expect(tools.length).toBeGreaterThanOrEqual(3);
      expect(tools).toContain('discover_configs');
      expect(tools).toContain('parse_config');
      expect(tools).toContain('analyze_hierarchy');
    });

    it('should reject duplicate registrations', () => {
      registry.register(discoverConfigsTool);

      expect(() => {
        registry.register(discoverConfigsTool);
      }).toThrow();
    });
  });

  describe('MCP server generation', () => {
    it('should generate MCP server config with all tools', () => {
      registerEP05Tools(registry);

      const mcpServer = registry.toMcpServer();

      expect(mcpServer).toBeDefined();
      expect(mcpServer).toHaveProperty('instance');
      expect(mcpServer).toHaveProperty('name');
    });

    it('should cache MCP server config', () => {
      registerEP05Tools(registry);

      const server1 = registry.toMcpServer();
      const server2 = registry.toMcpServer();

      // Should return the same instance (cached)
      expect(server1).toBe(server2);
    });

    it('should invalidate cache on new registration', () => {
      registry.register(discoverConfigsTool);
      const server1 = registry.toMcpServer();

      registry.register(parseConfigTool);
      const server2 = registry.toMcpServer();

      // Should return different instances
      expect(server1).not.toBe(server2);
    });
  });

  describe('createToolRegistry factory', () => {
    it('should create a new registry instance', () => {
      const reg = createToolRegistry();

      expect(reg).toBeDefined();
      expect(reg.list()).toEqual([]);
    });

    it('should support full workflow', () => {
      const reg = createToolRegistry();

      registerAllTools(reg);

      const tools = reg.list();
      expect(tools.length).toBeGreaterThan(0);

      const mcpServer = reg.toMcpServer();
      expect(mcpServer).toBeDefined();
    });
  });

  describe('EP05_CONFIG_TOOLS constant', () => {
    it('should export all EP05 tools as array', () => {
      expect(EP05_CONFIG_TOOLS).toBeInstanceOf(Array);
      expect(EP05_CONFIG_TOOLS.length).toBe(3);
    });

    it('should contain valid tool definitions', () => {
      for (const tool of EP05_CONFIG_TOOLS) {
        expect(tool).toBeDefined();
        // Tools should have name property (internal structure)
        expect(typeof tool).toBe('object');
      }
    });
  });

  describe('integration with orchestration', () => {
    it('should be usable with Orchestrator pattern', () => {
      // Create registry and register tools
      const reg = createToolRegistry();
      registerAllTools(reg);

      // Get MCP server for SDK
      const mcpServer = reg.toMcpServer();

      // Verify it has the expected structure for SDK integration
      expect(mcpServer).toHaveProperty('instance');
      expect(mcpServer).toHaveProperty('name');

      // This would be passed to query() options as:
      // mcpServers: [mcpServer]
    });
  });
});
