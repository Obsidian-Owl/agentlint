/**
 * Opencode SDK Migration - Tool Definition Adapter
 *
 * Adapts Claude Agent SDK tool definitions to Opencode MCP format.
 * Handles schema conversion (Zod → JSON Schema) and return format transformation.
 *
 * @module opencode/tool-adapter
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ToolDefinition } from './mcp-server';

export interface SdkToolDefinition {
  name: string;
  description: string;
  schema: Record<string, z.ZodTypeAny>;
  handler: (args: unknown) => Promise<unknown>;
}

export function adaptTool(sdkTool: SdkToolDefinition): ToolDefinition {
  const zodSchema = z.object(sdkTool.schema);
  const inputSchema = zodToJsonSchema(zodSchema as never, { $refStrategy: 'none' });

  return {
    name: sdkTool.name,
    description: sdkTool.description,
    inputSchema: inputSchema as Record<string, unknown>,
    handler: async (args: unknown): Promise<unknown> => {
      const result = await sdkTool.handler(args);

      if (result && typeof result === 'object' && 'content' in result) {
        return (result as { content: unknown }).content;
      }

      return result;
    },
  };
}

export function adaptTools(sdkTools: SdkToolDefinition[]): ToolDefinition[] {
  return sdkTools.map(adaptTool);
}
