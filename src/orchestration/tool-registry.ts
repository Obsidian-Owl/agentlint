/**
 * EP02 Orchestration Core - Tool Registry
 *
 * Registry for managing MCP tools available to the orchestrator.
 * Uses Claude Agent SDK's tool() and createSdkMcpServer() patterns.
 *
 * Implementation tasks:
 * - T021: Create IToolRegistry interface implementation
 * - T022: Implement register() and registerMany() methods
 * - T023: Implement toMcpServer() using createSdkMcpServer()
 *
 * @module orchestration/tool-registry
 */

import {
  createSdkMcpServer,
  type McpSdkServerConfigWithInstance,
  type SdkMcpToolDefinition,
} from '@anthropic-ai/claude-agent-sdk';
import { ToolRegistrationError } from '../errors';

// =============================================================================
// Tool Definition Type
// =============================================================================

/**
 * Type alias for SDK tool definitions.
 *
 * Uses SdkMcpToolDefinition<any> to match the SDK's internal CreateSdkMcpServerOptions.tools type.
 * This allows registering tools with any schema shape, since:
 * 1. Tools can have various schema shapes (different Zod raw shapes)
 * 2. The SDK's createSdkMcpServer() expects Array<SdkMcpToolDefinition<any>>
 * 3. TypeScript's contravariance on handler args requires the permissive <any> type
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ToolDefinition = SdkMcpToolDefinition<any>;

// =============================================================================
// IToolRegistry Interface
// =============================================================================

/**
 * Interface for the tool registry.
 * Manages registration and retrieval of MCP tools.
 */
export interface IToolRegistry {
  /** Register a single tool */
  register(tool: ToolDefinition): void;

  /** Register multiple tools atomically */
  registerMany(tools: ToolDefinition[]): void;

  /** Get tool by name */
  get(name: string): ToolDefinition | undefined;

  /** List all registered tool names */
  list(): string[];

  /** Get MCP server configuration for SDK */
  toMcpServer(): McpSdkServerConfigWithInstance;
}

// =============================================================================
// ToolRegistry Implementation
// =============================================================================

/**
 * Registry for managing MCP tools.
 *
 * The SDK's tool() function returns an internal structure where tool names
 * are not directly accessible as properties. This registry maintains a
 * separate name→tool mapping for lookup operations.
 *
 * @example
 * ```typescript
 * const registry = new ToolRegistry();
 *
 * registry.register(tool({
 *   name: 'analyze_config',
 *   description: 'Analyze configuration quality',
 *   schema: z.object({ path: z.string() }),
 *   handler: async ({ path }) => analyzeConfig(path),
 * }));
 *
 * const mcpServer = registry.toMcpServer();
 * // Pass to SDK query() via mcpServers option
 * ```
 */
export class ToolRegistry implements IToolRegistry {
  /** Internal storage for tools - maintains registration order */
  private tools: ToolDefinition[] = [];

  /** Name to index mapping for O(1) lookup and duplicate detection */
  private nameToIndex: Map<string, number> = new Map();

  /** Cached MCP server instance - invalidated on registration */
  private cachedMcpServer: McpSdkServerConfigWithInstance | null = null;

  /**
   * Register a single tool.
   *
   * @param toolDef - Tool definition created with SDK's tool() function
   * @throws ToolRegistrationError if tool name is already registered
   */
  register(toolDef: ToolDefinition): void {
    const toolName = this.extractToolName(toolDef);

    if (this.nameToIndex.has(toolName)) {
      throw new ToolRegistrationError(toolName, 'duplicate');
    }

    const index = this.tools.length;
    this.tools.push(toolDef);
    this.nameToIndex.set(toolName, index);

    // Invalidate cache
    this.cachedMcpServer = null;
  }

  /**
   * Register multiple tools atomically.
   * If any tool fails validation, no tools are registered.
   *
   * @param toolDefs - Array of tool definitions
   * @throws ToolRegistrationError if any tool name is duplicate
   */
  registerMany(toolDefs: ToolDefinition[]): void {
    // Extract all names first and check for duplicates
    const newNames: string[] = [];

    for (const toolDef of toolDefs) {
      const name = this.extractToolName(toolDef);

      // Check against existing tools
      if (this.nameToIndex.has(name)) {
        throw new ToolRegistrationError(name, 'duplicate');
      }

      // Check against other tools in this batch
      if (newNames.includes(name)) {
        throw new ToolRegistrationError(
          name,
          'duplicate',
          `Tool '${name}' appears multiple times in the registration batch`
        );
      }

      newNames.push(name);
    }

    // All validation passed - register atomically
    for (let i = 0; i < toolDefs.length; i++) {
      const toolDef = toolDefs[i];
      const toolName = newNames[i];
      if (toolDef !== undefined && toolName !== undefined) {
        const index = this.tools.length;
        this.tools.push(toolDef);
        this.nameToIndex.set(toolName, index);
      }
    }

    // Invalidate cache
    this.cachedMcpServer = null;
  }

  /**
   * Get a tool by name.
   *
   * @param name - The tool name
   * @returns The tool definition or undefined if not found
   */
  get(name: string): ToolDefinition | undefined {
    const index = this.nameToIndex.get(name);
    if (index === undefined) {
      return undefined;
    }
    return this.tools[index];
  }

  /**
   * List all registered tool names in registration order.
   *
   * @returns Array of tool names
   */
  list(): string[] {
    // Return names in registration order
    return Array.from(this.nameToIndex.keys());
  }

  /**
   * Get MCP server configuration for SDK query() options.
   *
   * Uses SDK's createSdkMcpServer() to bundle all registered tools
   * into a single MCP server instance.
   *
   * @returns McpSdkServerConfigWithInstance for SDK mcpServers option
   */
  toMcpServer(): McpSdkServerConfigWithInstance {
    // Return cached server if available
    if (this.cachedMcpServer !== null) {
      return this.cachedMcpServer;
    }

    // Create new MCP server with all tools
    this.cachedMcpServer = createSdkMcpServer({
      name: 'agentlint',
      tools: this.tools,
    });
    return this.cachedMcpServer;
  }

  /**
   * Extract tool name from SDK tool definition.
   *
   * The SDK's tool() function returns an internal structure.
   * We access the name property which holds the tool's name.
   */
  private extractToolName(toolDef: ToolDefinition): string {
    // The SDK tool definition has a 'name' property that contains the tool name
    // Disable strict checks for SDK interop - we need to probe internal structure
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
    const toolAny = toolDef as any;

    // Try common patterns for accessing the name
    if (typeof toolAny.name === 'string') {
      return toolAny.name;
    }

    // If name is nested (SDK internal structure)
    if (toolAny.name?.name && typeof toolAny.name.name === 'string') {
      return toolAny.name.name;
    }

    // Fallback: try to access definition
    if (toolAny.definition?.name && typeof toolAny.definition.name === 'string') {
      return toolAny.definition.name;
    }
    /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */

    throw new ToolRegistrationError(
      'unknown',
      'invalid_definition',
      'Could not extract tool name from definition'
    );
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new tool registry.
 *
 * @returns A new ToolRegistry instance
 */
export function createToolRegistry(): IToolRegistry {
  return new ToolRegistry();
}
