/**
 * T076: Test tool integration with ToolRegistry
 *
 * Tests that config tools register correctly with the ToolRegistry
 * and can be converted to MCP server configuration.
 *
 * @module tests/integration/tools/config/tool-registry.test.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import {
  createToolRegistry,
  ToolRegistry,
  type ToolDefinition,
} from '../../../../src/orchestration/tool-registry';
import {
  discoverConfigsTool,
  parseConfigTool,
  analyzeHierarchyTool,
  CONFIG_TOOLS,
  registerConfigTools,
  registerAllTools,
} from '../../../../src/tools';

// Cast tools to ToolDefinition for direct registration
// (The helper functions handle this internally, but direct registration needs explicit casts)
const discoverTool = discoverConfigsTool as ToolDefinition;
const parseTool = parseConfigTool as ToolDefinition;
const hierarchyTool = analyzeHierarchyTool as ToolDefinition;

describe('Config Tool Registration', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('individual tool registration', () => {
    it('should register discover_configs tool', () => {
      registry.register(discoverTool);

      const tools = registry.list();
      expect(tools).toContain('discover_configs');
    });

    it('should register parse_config tool', () => {
      registry.register(parseTool);

      const tools = registry.list();
      expect(tools).toContain('parse_config');
    });

    it('should register analyze_hierarchy tool', () => {
      registry.register(hierarchyTool);

      const tools = registry.list();
      expect(tools).toContain('analyze_hierarchy');
    });

    it('should retrieve registered tools by name', () => {
      registry.register(discoverTool);
      registry.register(parseTool);
      registry.register(hierarchyTool);

      expect(registry.get('discover_configs')).toBeDefined();
      expect(registry.get('parse_config')).toBeDefined();
      expect(registry.get('analyze_hierarchy')).toBeDefined();
      expect(registry.get('nonexistent')).toBeUndefined();
    });
  });

  describe('bulk registration', () => {
    it('should register all config tools via registerMany', () => {
      registry.registerMany([...CONFIG_TOOLS]);

      const tools = registry.list();
      expect(tools.length).toBe(3);
      expect(tools).toContain('discover_configs');
      expect(tools).toContain('parse_config');
      expect(tools).toContain('analyze_hierarchy');
    });

    it('should register all config tools via registerConfigTools helper', () => {
      registerConfigTools(registry);

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
      registry.register(discoverTool);

      expect(() => {
        registry.register(discoverTool);
      }).toThrow();
    });
  });

  describe('MCP server generation', () => {
    it('should generate MCP server config with all tools', () => {
      registerConfigTools(registry);

      const mcpServer = registry.toMcpServer();

      expect(mcpServer).toBeDefined();
      expect(mcpServer).toHaveProperty('instance');
      expect(mcpServer).toHaveProperty('name');
    });

    it('should cache MCP server config', () => {
      registerConfigTools(registry);

      const server1 = registry.toMcpServer();
      const server2 = registry.toMcpServer();

      // Should return the same instance (cached)
      expect(server1).toBe(server2);
    });

    it('should invalidate cache on new registration', () => {
      registry.register(discoverTool);
      const server1 = registry.toMcpServer();

      registry.register(parseTool);
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

  describe('CONFIG_TOOLS constant', () => {
    it('should export all config tools as array', () => {
      expect(CONFIG_TOOLS).toBeInstanceOf(Array);
      expect(CONFIG_TOOLS.length).toBe(3);
    });

    it('should contain valid tool definitions', () => {
      for (const tool of CONFIG_TOOLS) {
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
