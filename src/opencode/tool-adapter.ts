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

/**
 * Converts a Zod object schema to JSON Schema format.
 * Isolates the `as never` cast required by zod-to-json-schema's overly strict generics.
 */
function zodToInputSchema(schema: z.ZodObject<z.ZodRawShape>): Record<string, unknown> {
  // zod-to-json-schema has overly strict generic constraints that don't match
  // Zod's actual runtime behavior. The `as never` is required to bridge this gap.
  return zodToJsonSchema(schema as never, { $refStrategy: 'none' }) as Record<string, unknown>;
}

export function adaptTool(sdkTool: SdkToolDefinition): ToolDefinition {
  const zodSchema = z.object(sdkTool.schema);
  const inputSchema = zodToInputSchema(zodSchema);

  return {
    name: sdkTool.name,
    description: sdkTool.description,
    inputSchema,
    handler: async (args: unknown): Promise<unknown> => {
      const parsed = zodSchema.safeParse(args);
      if (!parsed.success) {
        const issues = parsed.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ');
        throw new Error(`Tool '${sdkTool.name}' received invalid arguments: ${issues}`);
      }

      const result = await sdkTool.handler(parsed.data);

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
