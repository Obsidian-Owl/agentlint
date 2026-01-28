/**
 * Orchestration Core - Tool Registry
 *
 * Registry for managing MCP tools available to the orchestrator.
 *
 * @module orchestration/tool-registry
 */

import { ToolRegistrationError } from '../errors';

// =============================================================================
// Tool Definition Type
// =============================================================================

/**
 * Opaque tool definition type.
 *
 * Tools are created by adaptTool() (opencode) or other adapters and registered here.
 * The registry probes the internal structure via extractToolName() using `as any` casts.
 * This permissive type allows any tool shape to be registered.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ToolDefinition = Record<string, any>;

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
 * registry.register(adaptTool({ name: 'analyze_config', ... }));
 * const tool = registry.get('analyze_config');
 * ```
 */
export class ToolRegistry implements IToolRegistry {
  /** Internal storage for tools - maintains registration order */
  private tools: ToolDefinition[] = [];

  /** Name to index mapping for O(1) lookup and duplicate detection */
  private nameToIndex: Map<string, number> = new Map();

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
