import { describe, expect, it } from 'bun:test';
import { AgentlintMcpServer, type ToolDefinition } from '../../../src/opencode/mcp-server';

describe('AgentlintMcpServer', () => {
  describe('registerTool', () => {
    it('should register a tool successfully', () => {
      const server = new AgentlintMcpServer();
      const tool: ToolDefinition = {
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => ({ success: true }),
      };

      server.registerTool(tool);
      const list = server.handleToolsList();

      expect(list.tools).toHaveLength(1);
      expect(list.tools[0]?.name).toBe('test_tool');
    });

    it('should throw error when registering duplicate tool', () => {
      const server = new AgentlintMcpServer();
      const tool: ToolDefinition = {
        name: 'duplicate',
        description: 'A tool',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => ({}),
      };

      server.registerTool(tool);

      expect(() => server.registerTool(tool)).toThrow("Tool 'duplicate' is already registered");
    });
  });

  describe('start/stop', () => {
    it('should start server successfully', () => {
      const server = new AgentlintMcpServer();

      expect(server.isRunning()).toBe(false);
      server.start();
      expect(server.isRunning()).toBe(true);
    });

    it('should throw error when starting already running server', () => {
      const server = new AgentlintMcpServer();
      server.start();

      expect(() => server.start()).toThrow('MCP server is already running');
    });

    it('should stop server and clear tools', () => {
      const server = new AgentlintMcpServer();
      const tool: ToolDefinition = {
        name: 'test',
        description: 'Test',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => ({}),
      };

      server.registerTool(tool);
      server.start();
      server.stop();

      expect(server.isRunning()).toBe(false);
      expect(server.handleToolsList().tools).toHaveLength(0);
    });
  });

  describe('handleToolsList', () => {
    it('should return empty list when no tools registered', () => {
      const server = new AgentlintMcpServer();
      const list = server.handleToolsList();

      expect(list.tools).toEqual([]);
    });

    it('should return all registered tools', () => {
      const server = new AgentlintMcpServer();
      const tool1: ToolDefinition = {
        name: 'tool1',
        description: 'First tool',
        inputSchema: { type: 'object', properties: { a: { type: 'string' } } },
        handler: async () => ({}),
      };
      const tool2: ToolDefinition = {
        name: 'tool2',
        description: 'Second tool',
        inputSchema: { type: 'object', properties: { b: { type: 'number' } } },
        handler: async () => ({}),
      };

      server.registerTool(tool1);
      server.registerTool(tool2);

      const list = server.handleToolsList();
      expect(list.tools).toHaveLength(2);
      expect(list.tools[0]).toEqual({
        name: 'tool1',
        description: 'First tool',
        inputSchema: { type: 'object', properties: { a: { type: 'string' } } },
      });
      expect(list.tools[1]).toEqual({
        name: 'tool2',
        description: 'Second tool',
        inputSchema: { type: 'object', properties: { b: { type: 'number' } } },
      });
    });
  });

  describe('handleToolsCall', () => {
    it('should invoke tool handler with arguments', async () => {
      const server = new AgentlintMcpServer();
      const tool: ToolDefinition = {
        name: 'echo',
        description: 'Echo tool',
        inputSchema: { type: 'object', properties: { message: { type: 'string' } } },
        handler: async (args) => args,
      };

      server.registerTool(tool);

      const result = await server.handleToolsCall('echo', { message: 'hello' });
      expect(result).toEqual({ message: 'hello' });
    });

    it('should throw error when tool not found', async () => {
      const server = new AgentlintMcpServer();

      await expect(server.handleToolsCall('nonexistent', {})).rejects.toThrow(
        "Tool 'nonexistent' not found"
      );
    });

    it('should propagate handler errors', async () => {
      const server = new AgentlintMcpServer();
      const tool: ToolDefinition = {
        name: 'failing',
        description: 'Failing tool',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => {
          throw new Error('Handler failed');
        },
      };

      server.registerTool(tool);

      await expect(server.handleToolsCall('failing', {})).rejects.toThrow('Handler failed');
    });
  });
});
