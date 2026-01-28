import { describe, expect, it, mock } from 'bun:test';
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
    const result = await adapted.handler({ input: 'test' });

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
    const result = await adapted.handler({ input: 'test' });

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
    const result = await adapted.handler({ input: 'test' });

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

describe('input validation', () => {
  it('should validate args against Zod schema and pass parsed data to handler', async () => {
    const handlerMock = mock(async (args: unknown) => args);
    const sdkTool: SdkToolDefinition = {
      name: 'validated_tool',
      description: 'Test validation',
      schema: {
        name: z.string(),
        age: z.number(),
      },
      handler: handlerMock,
    };

    const adapted = adaptTool(sdkTool);
    await adapted.handler({ name: 'Alice', age: 30 });

    expect(handlerMock).toHaveBeenCalledTimes(1);
    const calledWith = handlerMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(calledWith.name).toBe('Alice');
    expect(calledWith.age).toBe(30);
  });

  it('should throw descriptive error for invalid args', async () => {
    const sdkTool: SdkToolDefinition = {
      name: 'strict_tool',
      description: 'Test strict validation',
      schema: {
        name: z.string(),
        count: z.number(),
      },
      handler: async () => ({}),
    };

    const adapted = adaptTool(sdkTool);

    await expect(adapted.handler({ name: 123, count: 'not-a-number' })).rejects.toThrow(
      "Tool 'strict_tool' received invalid arguments"
    );
  });

  it('should strip extra properties by default (Zod default behavior)', async () => {
    const handlerMock = mock(async (args: unknown) => args);
    const sdkTool: SdkToolDefinition = {
      name: 'strip_tool',
      description: 'Test stripping',
      schema: {
        name: z.string(),
      },
      handler: handlerMock,
    };

    const adapted = adaptTool(sdkTool);
    await adapted.handler({ name: 'Bob', extraField: 'should be stripped' });

    const calledWith = handlerMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(calledWith.name).toBe('Bob');
    expect('extraField' in calledWith).toBe(false);
  });
});
