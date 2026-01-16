/**
 * Test utilities for Claude Agent SDK integration.
 *
 * Provides properly-typed helpers for creating mock tools that satisfy
 * the SDK's strict TypeScript requirements while being simple to use in tests.
 *
 * @module tests/utils/sdk-test-helpers
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { z } from 'zod';
import type { ToolDefinition } from '../../src/orchestration/tool-registry';

// =============================================================================
// Types
// =============================================================================

/**
 * Type alias for Zod raw shape (the schema format expected by SDK tool()).
 * Uses Record<string, z.ZodTypeAny> to represent the raw object shape.
 */
type ZodRawShape = Record<string, z.ZodTypeAny>;

/**
 * Infers the args type from a Zod raw shape.
 */
type InferArgs<T extends ZodRawShape> = {
  [K in keyof T]: z.infer<T[K]>;
};

// =============================================================================
// Result Builders
// =============================================================================

/**
 * Create a successful MCP tool result with text content.
 *
 * @param text - The text content to return
 * @returns A properly structured CallToolResult
 *
 * @example
 * ```typescript
 * const handler = async ({ input }) => textResult(`Processed: ${input}`);
 * ```
 */
export function textResult(text: string): CallToolResult {
  return {
    content: [{ type: 'text', text }],
  };
}

/**
 * Create an error MCP tool result.
 *
 * @param message - The error message
 * @returns A properly structured CallToolResult with isError flag
 *
 * @example
 * ```typescript
 * const handler = async ({ path }) => {
 *   if (!exists(path)) return errorResult('File not found');
 *   return textResult('Success');
 * };
 * ```
 */
export function errorResult(message: string): CallToolResult {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

/**
 * Create an MCP tool result with JSON content.
 *
 * @param data - The data to serialize as JSON
 * @returns A properly structured CallToolResult with JSON text
 *
 * @example
 * ```typescript
 * const handler = async ({ path }) => jsonResult({ analyzed: path, issues: [] });
 * ```
 */
export function jsonResult(data: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
  };
}

// =============================================================================
// Mock Tool Factories
// =============================================================================

/**
 * Create a mock tool with a simple string handler.
 *
 * Wraps the handler to return proper CallToolResult format
 * while allowing simple string returns in tests.
 *
 * @param name - Tool name
 * @param description - Tool description
 * @param schema - Zod raw shape schema
 * @param simpleHandler - Handler that returns a string
 * @returns SDK tool definition compatible with ToolRegistry
 *
 * @example
 * ```typescript
 * const analyzeTool = createMockTool(
 *   'analyze',
 *   'Analyze something',
 *   { target: z.string() },
 *   ({ target }) => `Analyzed: ${target}`
 * );
 * ```
 */
export function createMockTool<Schema extends ZodRawShape>(
  name: string,
  description: string,
  schema: Schema,
  simpleHandler: (args: InferArgs<Schema>) => string | Promise<string>
): ToolDefinition {
  // Cast is safe: SDK's createSdkMcpServer accepts Array<SdkMcpToolDefinition<any>>
  // TypeScript's contravariance on handler args is stricter than runtime behavior
  return tool(name, description, schema, async (args, _extra) => {
    const result = await simpleHandler(args as InferArgs<Schema>);
    return textResult(result);
  }) as ToolDefinition;
}

/**
 * Create a mock tool with a JSON handler.
 *
 * @param name - Tool name
 * @param description - Tool description
 * @param schema - Zod raw shape schema
 * @param jsonHandler - Handler that returns data to be JSON serialized
 * @returns SDK tool definition compatible with ToolRegistry
 *
 * @example
 * ```typescript
 * const listTool = createMockJsonTool(
 *   'list_items',
 *   'List items',
 *   { filter: z.string().optional() },
 *   ({ filter }) => ({ items: ['a', 'b', 'c'], filter })
 * );
 * ```
 */
export function createMockJsonTool<Schema extends ZodRawShape>(
  name: string,
  description: string,
  schema: Schema,
  jsonHandler: (args: InferArgs<Schema>) => Promise<unknown>
): ToolDefinition {
  // Cast is safe: SDK's createSdkMcpServer accepts Array<SdkMcpToolDefinition<any>>
  return tool(name, description, schema, async (args, _extra) => {
    const result = await jsonHandler(args as InferArgs<Schema>);
    return jsonResult(result);
  }) as ToolDefinition;
}

/**
 * Create a mock tool that always succeeds with a fixed message.
 *
 * @param name - Tool name
 * @param message - Fixed success message
 * @returns SDK tool definition compatible with ToolRegistry
 *
 * @example
 * ```typescript
 * const noopTool = createSuccessTool('noop', 'completed');
 * ```
 */
export function createSuccessTool(name: string, message = 'success'): ToolDefinition {
  // Cast is safe: SDK's createSdkMcpServer accepts Array<SdkMcpToolDefinition<any>>
  return tool(name, `Mock ${name} tool`, {}, () =>
    Promise.resolve(textResult(message))
  ) as ToolDefinition;
}

/**
 * Create a mock tool that always fails with a fixed error.
 *
 * @param name - Tool name
 * @param error - Fixed error message
 * @returns SDK tool definition compatible with ToolRegistry
 *
 * @example
 * ```typescript
 * const failTool = createFailureTool('fail', 'Something went wrong');
 * ```
 */
export function createFailureTool(name: string, error = 'error'): ToolDefinition {
  // Cast is safe: SDK's createSdkMcpServer accepts Array<SdkMcpToolDefinition<any>>
  return tool(name, `Mock ${name} tool`, {}, () =>
    Promise.resolve(errorResult(error))
  ) as ToolDefinition;
}
