/**
 * Test utilities for creating mock tool definitions.
 *
 * @module tests/utils/sdk-test-helpers
 */

import type { z } from 'zod';
import type { ToolDefinition } from '../../src/orchestration/tool-registry';

type ZodRawShape = Record<string, z.ZodTypeAny>;

type InferArgs<T extends ZodRawShape> = {
  [K in keyof T]: z.infer<T[K]>;
};

interface CallToolResult {
  [x: string]: unknown;
  content: Array<{ type: 'text'; text: string; [x: string]: unknown }>;
  isError?: boolean;
}

export function textResult(text: string): CallToolResult {
  return {
    content: [{ type: 'text', text }],
  };
}

export function errorResult(message: string): CallToolResult {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

export function jsonResult(data: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
  };
}

export function createMockTool<Schema extends ZodRawShape>(
  name: string,
  description: string,
  schema: Schema,
  simpleHandler: (args: InferArgs<Schema>) => string | Promise<string>
): ToolDefinition {
  return {
    name,
    description,
    schema,
    handler: async (args: unknown): Promise<CallToolResult> => {
      const result = await simpleHandler(args as InferArgs<Schema>);
      return textResult(result);
    },
  };
}

export function createMockJsonTool<Schema extends ZodRawShape>(
  name: string,
  description: string,
  schema: Schema,
  jsonHandler: (args: InferArgs<Schema>) => Promise<unknown>
): ToolDefinition {
  return {
    name,
    description,
    schema,
    handler: async (args: unknown): Promise<CallToolResult> => {
      const result = await jsonHandler(args as InferArgs<Schema>);
      return jsonResult(result);
    },
  };
}

export function createSuccessTool(name: string, message = 'success'): ToolDefinition {
  return {
    name,
    description: `Mock ${name} tool`,
    schema: {},
    handler: () => Promise.resolve(textResult(message)),
  };
}

export function createFailureTool(name: string, error = 'error'): ToolDefinition {
  return {
    name,
    description: `Mock ${name} tool`,
    schema: {},
    handler: () => Promise.resolve(errorResult(error)),
  };
}
