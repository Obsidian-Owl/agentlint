/**
 * TUI Permission Handler
 *
 * Integrates with ITuiRenderer to show PermissionDialog for tool approvals.
 * Replaces the readline-based approach when TUI mode is active.
 *
 * @module tui/permissions/tui-permission-handler
 */

import type { PermissionResult } from '@anthropic-ai/claude-agent-sdk';
import type { ITuiRenderer, PermissionDecision } from '../types';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for TuiPermissionHandler.
 */
export interface TuiPermissionHandlerOptions {
  /** Whether to auto-approve all permissions (non-interactive) */
  autoApprove?: boolean;
  /** Whether to auto-deny all permissions */
  autoDeny?: boolean;
}

// =============================================================================
// TuiPermissionHandler
// =============================================================================

/**
 * Handles tool permission requests via the TUI.
 *
 * Uses ITuiRenderer.requestPermission() to show a PermissionDialog
 * and get the user's decision.
 */
export class TuiPermissionHandler {
  private renderer: ITuiRenderer;
  private options: TuiPermissionHandlerOptions;
  private cache: Map<string, PermissionDecision> = new Map();

  constructor(renderer: ITuiRenderer, options: TuiPermissionHandlerOptions = {}) {
    this.renderer = renderer;
    this.options = options;
  }

  /**
   * Check if a tool can be used.
   *
   * Implements the canUseTool callback interface expected by the SDK.
   *
   * @param toolName - Name of the tool
   * @param input - Tool input parameters
   * @returns Permission result
   */
  async canUseTool(toolName: string, input: Record<string, unknown>): Promise<PermissionResult> {
    // Generate cache key
    const pattern = this.extractPattern(toolName, input);
    const cacheKey = pattern ? `${toolName}:${pattern}` : toolName;

    // Check cache for permanent or session decision
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached.allowed
        ? { behavior: 'allow' }
        : { behavior: 'deny', message: 'Permission denied from cache' };
    }

    // Auto-approve mode
    if (this.options.autoApprove) {
      return { behavior: 'allow' };
    }

    // Auto-deny mode
    if (this.options.autoDeny) {
      return { behavior: 'deny', message: 'Permission auto-denied' };
    }

    // Build description from input
    const description = this.buildDescription(toolName, input);

    // Request permission via TUI
    const request = pattern
      ? { tool: toolName, description, pattern }
      : { tool: toolName, description };
    const decision = await this.renderer.requestPermission(request);

    // Cache the decision
    if (decision.scope === 'permanent' || decision.scope === 'session') {
      this.cache.set(cacheKey, decision);
    }

    return decision.allowed
      ? { behavior: 'allow' }
      : { behavior: 'deny', message: 'Permission denied by user' };
  }

  /**
   * Clear the permission cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get the current cache.
   */
  getCache(): Map<string, PermissionDecision> {
    return new Map(this.cache);
  }

  /**
   * Extract a pattern from the tool input for caching.
   */
  private extractPattern(toolName: string, input: Record<string, unknown>): string | undefined {
    // Extract file paths
    if (typeof input.file_path === 'string') {
      return input.file_path;
    }
    if (typeof input.path === 'string') {
      return input.path;
    }

    // For Bash, use the command
    if (toolName === 'Bash' && typeof input.command === 'string') {
      // Extract just the command name for caching
      const command = input.command;
      const match = command.match(/^(\S+)/);
      return match ? match[1] : undefined;
    }

    return undefined;
  }

  /**
   * Build a human-readable description from tool input.
   */
  private buildDescription(toolName: string, input: Record<string, unknown>): string {
    // Use explicit description if provided
    if (typeof input.description === 'string') {
      return input.description;
    }

    // Build description based on tool type
    switch (toolName) {
      case 'Bash':
        if (typeof input.command === 'string') {
          return `Execute command: ${input.command}`;
        }
        return 'Execute a shell command';

      case 'Read':
      case 'read_file':
        if (typeof input.file_path === 'string') {
          return `Read file: ${input.file_path}`;
        }
        return 'Read a file';

      case 'Write':
      case 'write_file':
        if (typeof input.file_path === 'string') {
          return `Write to file: ${input.file_path}`;
        }
        return 'Write to a file';

      case 'Edit':
      case 'edit_file':
        if (typeof input.file_path === 'string') {
          return `Edit file: ${input.file_path}`;
        }
        return 'Edit a file';

      case 'Glob':
      case 'glob':
        if (typeof input.pattern === 'string') {
          return `Search for files matching: ${input.pattern}`;
        }
        return 'Search for files';

      case 'Grep':
      case 'grep':
        if (typeof input.pattern === 'string') {
          return `Search for content matching: ${input.pattern}`;
        }
        return 'Search file contents';

      default:
        return `Use tool: ${toolName}`;
    }
  }
}

/**
 * Create a canUseTool callback for the SDK.
 *
 * This is a convenience function that wraps TuiPermissionHandler
 * in a callback suitable for the SDK's canUseTool option.
 */
export function createTuiCanUseTool(
  renderer: ITuiRenderer,
  options?: TuiPermissionHandlerOptions
): (toolName: string, input: Record<string, unknown>) => Promise<PermissionResult> {
  const handler = new TuiPermissionHandler(renderer, options);
  return (toolName, input) => handler.canUseTool(toolName, input);
}
