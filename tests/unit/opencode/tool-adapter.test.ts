import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { adaptTool, adaptTools, type SdkToolDefinition } from '../../../src/opencode/tool-adapter';

describe('adaptTool', () => {
  it('should adapt SDK tool to MCP format', () => {
    const sdkTool: SdkToolDefinition = {
      name: 'test_tool',
      description: 'A test tool',
      schema: {
        input: z.string(),
      },
      handler: async (args) => args,
    };

    const adapted = adaptTool(sdkTool);

    expect(adapted.name).toBe('test_tool');
    expect(adapted.description).toBe('A test tool');
    expect(adapted.inputSchema).toBeDefined();
    expect(typeof adapted.handler).toBe('function');
  });

  it('should convert schema to JSON Schema format', () => {
    const sdkTool: SdkToolDefinition = {
      name: 'schema_test',
      description: 'Schema test',
      schema: {
        name: z.string(),
        age: z.number(),
      },
      handler: async () => ({}),
    };

    const adapted = adaptTool(sdkTool);

    expect(adapted.inputSchema).toHaveProperty('type', 'object');
    expect(adapted.inputSchema).toHaveProperty('properties');
  });

  it('should unwrap content wrapper from SDK response', async () => {
    const sdkTool: SdkToolDefinition = {
      name: 'content_wrapper',
      description: 'Test content unwrapping',
      schema: {
        input: z.string(),
      },
      handler: async () => ({ content: 'unwrapped data' }),
    };

    const adapted = adaptTool(sdkTool);
    const result = await adapted.handler({});

    expect(result).toBe('unwrapped data');
  });

  it('should pass through non-wrapped responses', async () => {
    const sdkTool: SdkToolDefinition = {
      name: 'direct_response',
      description: 'Test direct response',
      schema: {
        input: z.string(),
      },
      handler: async () => ({ data: 'direct' }),
    };

    const adapted = adaptTool(sdkTool);
    const result = await adapted.handler({});

    expect(result).toEqual({ data: 'direct' });
  });

  it('should handle primitive responses', async () => {
    const sdkTool: SdkToolDefinition = {
      name: 'primitive',
      description: 'Test primitive',
      schema: {
        input: z.string(),
      },
      handler: async () => 'string result',
    };

    const adapted = adaptTool(sdkTool);
    const result = await adapted.handler({});

    expect(result).toBe('string result');
  });
});

describe('adaptTools', () => {
  it('should adapt multiple tools', () => {
    const sdkTools: SdkToolDefinition[] = [
      {
        name: 'tool1',
        description: 'First tool',
        schema: {
          input: z.string(),
        },
        handler: async () => ({}),
      },
      {
        name: 'tool2',
        description: 'Second tool',
        schema: {
          input: z.number(),
        },
        handler: async () => ({}),
      },
    ];

    const adapted = adaptTools(sdkTools);

    expect(adapted).toHaveLength(2);
    expect(adapted[0]?.name).toBe('tool1');
    expect(adapted[1]?.name).toBe('tool2');
  });

  it('should handle empty array', () => {
    const adapted = adaptTools([]);
    expect(adapted).toEqual([]);
  });
});
