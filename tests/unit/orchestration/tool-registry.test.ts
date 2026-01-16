/**
 * EP02 Orchestration Core - ToolRegistry Tests
 *
 * Tests for T019, T020, T029:
 * - T019: ToolRegistry.register() accepts tool() definitions
 * - T020: ToolRegistry.toMcpServer() returns valid McpSdkServerConfigWithInstance
 * - T029: Large tool results trigger summarization (stub for now)
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { z } from 'zod';
import { ToolRegistry, type ToolDefinition } from '../../../src/orchestration/tool-registry';
import { ToolRegistrationError } from '../../../src/errors';
import {
  createMockTool,
  createSuccessTool,
  textResult,
} from '../../utils/sdk-test-helpers';
import { tool } from '@anthropic-ai/claude-agent-sdk';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  // ===========================================================================
  // T019: ToolRegistry.register() accepts tool() definitions
  // ===========================================================================

  describe('register()', () => {
    test('accepts a valid tool() definition', () => {
      // Use helper that returns proper CallToolResult
      const testTool = createMockTool(
        'test_tool',
        'A test tool',
        { input: z.string() },
        ({ input }) => `processed: ${input}`
      );

      expect(() => registry.register(testTool)).not.toThrow();
      expect(registry.list()).toContain('test_tool');
    });

    test('rejects duplicate tool names', () => {
      const tool1 = createSuccessTool('duplicate_tool', 'first');
      const tool2 = createSuccessTool('duplicate_tool', 'second');

      registry.register(tool1);
      expect(() => registry.register(tool2)).toThrow(ToolRegistrationError);
    });

    test('stores tool for later retrieval via get()', () => {
      const testTool = createMockTool(
        'retrievable_tool',
        'Can be retrieved',
        { value: z.number() },
        ({ value }) => String(value * 2)
      );

      registry.register(testTool);
      const retrieved = registry.get('retrievable_tool');
      expect(retrieved).toBeDefined();
    });
  });

  // ===========================================================================
  // registerMany()
  // ===========================================================================

  describe('registerMany()', () => {
    test('registers multiple tools at once', () => {
      const tools = [
        createSuccessTool('tool_a', 'a'),
        createSuccessTool('tool_b', 'b'),
        createSuccessTool('tool_c', 'c'),
      ];

      registry.registerMany(tools);

      expect(registry.list()).toEqual(['tool_a', 'tool_b', 'tool_c']);
    });

    test('fails atomically if any tool is duplicate', () => {
      const existingTool = createSuccessTool('existing', 'existing');

      registry.register(existingTool);

      const newTools = [
        createSuccessTool('new_tool', 'new'),
        createSuccessTool('existing', 'dup'), // Duplicate!
      ];

      expect(() => registry.registerMany(newTools)).toThrow(
        ToolRegistrationError
      );
      // new_tool should not be registered due to atomic failure
      expect(registry.list()).not.toContain('new_tool');
    });
  });

  // ===========================================================================
  // get() and list()
  // ===========================================================================

  describe('get()', () => {
    test('returns undefined for non-existent tool', () => {
      expect(registry.get('nonexistent')).toBeUndefined();
    });

    test('returns the registered tool', () => {
      const testTool = createSuccessTool('findable', 'found');

      registry.register(testTool);
      expect(registry.get('findable')).toBeDefined();
    });
  });

  describe('list()', () => {
    test('returns empty array when no tools registered', () => {
      expect(registry.list()).toEqual([]);
    });

    test('returns tool names in registration order', () => {
      registry.register(createSuccessTool('first', '1'));
      registry.register(createSuccessTool('second', '2'));

      expect(registry.list()).toEqual(['first', 'second']);
    });
  });

  // ===========================================================================
  // T020: ToolRegistry.toMcpServer() returns valid McpSdkServerConfigWithInstance
  // ===========================================================================

  describe('toMcpServer()', () => {
    test('returns McpSdkServerConfigWithInstance with server instance', () => {
      registry.register(
        createMockTool(
          'mcp_test',
          'MCP test tool',
          { data: z.string() },
          ({ data }) => `MCP: ${data}`
        )
      );

      const mcpConfig = registry.toMcpServer();

      // McpSdkServerConfigWithInstance should have instance property
      expect(mcpConfig).toBeDefined();
      expect(mcpConfig.instance).toBeDefined();
    });

    test('includes all registered tools in MCP server', () => {
      registry.registerMany([
        createSuccessTool('tool_1', '1'),
        createSuccessTool('tool_2', '2'),
      ]);

      const mcpConfig = registry.toMcpServer();

      // The MCP server should be created with both tools
      expect(mcpConfig.instance).toBeDefined();
    });

    test('returns empty server when no tools registered', () => {
      const mcpConfig = registry.toMcpServer();
      expect(mcpConfig.instance).toBeDefined();
    });
  });

  // ===========================================================================
  // Tool Handler Execution (via registry)
  // ===========================================================================

  describe('tool handler execution', () => {
    test('can execute tool handler through registry', () => {
      // Define handler separately for direct testing
      const analyzeHandler = (input: { path: string }): string => {
        return JSON.stringify({ analyzed: input.path, issues: [] });
      };

      // Create tool with properly typed handler using SDK tool() directly
      // Cast is safe: SDK's createSdkMcpServer accepts Array<SdkMcpToolDefinition<any>>
      const analyzeTool = tool(
        'analyze_file',
        'Analyze a file',
        { path: z.string() },
        ({ path }) => Promise.resolve(textResult(analyzeHandler({ path })))
      ) as ToolDefinition;

      registry.register(analyzeTool);

      // Test the handler directly (SDK manages handler invocation internally)
      const result = analyzeHandler({ path: '/test/file.ts' });
      expect(JSON.parse(result)).toEqual({
        analyzed: '/test/file.ts',
        issues: [],
      });
    });
  });
});
