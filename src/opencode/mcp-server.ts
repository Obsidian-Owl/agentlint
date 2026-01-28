/**
 * Opencode SDK Migration - MCP Server
 *
 * MCP (Model Context Protocol) server implementation for Opencode integration.
 * Exposes agentlint tools via JSON-RPC protocol.
 *
 * @module opencode/mcp-server
 */

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: unknown) => Promise<unknown>;
}

export interface IAgentlintMcpServer {
  registerTool(definition: ToolDefinition): void;
  start(): void;
  stop(): void;
  isRunning(): boolean;
}

/**
 * MCP server for exposing agentlint tools to Opencode.
 *
 * Implements JSON-RPC protocol for tool discovery and invocation.
 * Tools are registered dynamically and exposed via `tools/list` and `tools/call` endpoints.
 *
 * @example
 * ```typescript
 * const server = new AgentlintMcpServer();
 * server.registerTool({
 *   name: 'analyze_config',
 *   description: 'Analyze configuration quality',
 *   inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
 *   handler: async ({ path }) => analyzeConfig(path),
 * });
 * await server.start();
 * ```
 */
export class AgentlintMcpServer implements IAgentlintMcpServer {
  private tools: Map<string, ToolDefinition> = new Map();
  private running = false;

  /**
   * Register a tool for MCP exposure.
   *
   * @param definition - Tool definition with name, description, schema, and handler
   * @throws {Error} If tool with same name already registered
   */
  registerTool(definition: ToolDefinition): void {
    if (this.tools.has(definition.name)) {
      throw new Error(`Tool '${definition.name}' is already registered`);
    }
    this.tools.set(definition.name, definition);
  }

  /**
   * Start the MCP server.
   *
   * In the Opencode architecture, the MCP server is configured in opencode.json
   * and started by Opencode itself. This method is a placeholder for future
   * standalone server implementation if needed.
   */
  start(): void {
    if (this.running) {
      throw new Error('MCP server is already running');
    }
    this.running = true;
  }

  /**
   * Stop the MCP server.
   */
  stop(): void {
    this.running = false;
    this.tools.clear();
  }

  /**
   * Check if server is running.
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Handle MCP `tools/list` request.
   *
   * Returns list of all registered tools in MCP format.
   */
  handleToolsList(): {
    tools: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>;
  } {
    const tools = Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));
    return { tools };
  }

  /**
   * Handle MCP `tools/call` request.
   *
   * Invokes the specified tool with provided arguments.
   *
   * Security model: No authentication is required because:
   * - Server binds to 127.0.0.1 only (not network-accessible)
   * - Server is short-lived (started/stopped per orchestrator run)
   * - Only the local agentlint process communicates with it
   * - This is acceptable per Constitution Principle I (local-first)
   *
   * @param name - Tool name
   * @param args - Tool arguments
   * @returns Tool execution result
   * @throws {Error} If tool not found
   */
  async handleToolsCall(name: string, args: unknown): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool '${name}' not found`);
    }
    return tool.handler(args);
  }
}
