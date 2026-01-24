/**
 * TUI Permission Handler
 *
 * Integrates with ITuiRenderer to show PermissionDialog for tool approvals.
 * Replaces the readline-based approach when TUI mode is active.
 *
 * @module tui/permissions/tui-permission-handler
 */

import type { PermissionResult } from '@anthropic-ai/claude-agent-sdk';
import type { ITuiRenderer, PermissionDecision, UserQuestion, UserQuestionOption } from '../types';

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
    // Special handling for AskUserQuestion tool
    if (toolName === 'AskUserQuestion') {
      return this.handleAskUserQuestion(input);
    }

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
   * Handle AskUserQuestion tool specially.
   *
   * Instead of asking for permission, presents questions to the user
   * and returns the answers via updatedInput.
   */
  private async handleAskUserQuestion(input: Record<string, unknown>): Promise<PermissionResult> {
    // Auto-approve mode - skip questions
    if (this.options.autoApprove) {
      return { behavior: 'allow' };
    }

    // Auto-deny mode - deny the tool entirely
    if (this.options.autoDeny) {
      return { behavior: 'deny', message: 'Questions auto-denied' };
    }

    // Extract questions from input
    const rawQuestions = input.questions;
    if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
      // No questions to ask, allow the tool
      return { behavior: 'allow' };
    }

    // Convert SDK question format to our UserQuestion format
    const questions: UserQuestion[] = rawQuestions.map((q: unknown) => {
      const question = q as Record<string, unknown>;
      const options = (question.options as Array<Record<string, unknown>> | undefined) ?? [];

      return {
        question: (question.question as string) ?? '',
        header: (question.header as string) ?? 'Question',
        options: options.map((opt): UserQuestionOption => {
          const optionObj: UserQuestionOption = {
            label: (opt.label as string) ?? '',
          };
          if (typeof opt.description === 'string') {
            optionObj.description = opt.description;
          }
          return optionObj;
        }),
        multiSelect: (question.multiSelect as boolean) ?? false,
      };
    });

    // Request answers from user via TUI
    const answers = await this.renderer.requestUserAnswers({ questions });

    // Return with updatedInput containing answers
    return {
      behavior: 'allow',
      updatedInput: {
        ...input,
        answers,
      },
    };
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

    // For Bash, do NOT cache - each command should require explicit permission
    // This prevents security issues where approving 'git status' would auto-approve 'git push --force'
    if (toolName === 'Bash') {
      return undefined;
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
