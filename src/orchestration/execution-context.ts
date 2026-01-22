/**
 * EP11 Quality & Security - Execution Context
 *
 * Provides AsyncLocalStorage-based context for passing the target directory
 * to tools during orchestrated analysis. This allows tools like
 * create_recommendation to store files in the correct project directory
 * rather than process.cwd().
 *
 * @module orchestration/execution-context
 */

import { AsyncLocalStorage } from 'node:async_hooks';

// =============================================================================
// Types
// =============================================================================

/**
 * Execution context passed to tools during analysis.
 */
export interface ExecutionContext {
  /** The target directory being analyzed */
  targetDirectory: string;
  /** The current session ID (optional) */
  sessionId?: string;
}

// =============================================================================
// AsyncLocalStorage Instance
// =============================================================================

/**
 * AsyncLocalStorage for execution context.
 * Allows tools to access the target directory without explicit parameter passing.
 */
const storage = new AsyncLocalStorage<ExecutionContext>();

// =============================================================================
// Context Functions
// =============================================================================

/**
 * Run a function with an execution context.
 *
 * All tools called within the function (including async calls) will have
 * access to the context via getTargetDirectory() and getExecutionContext().
 *
 * @param context - The execution context to provide
 * @param fn - The function to run with the context
 * @returns The result of the function
 *
 * @example
 * ```typescript
 * await runWithExecutionContext(
 *   { targetDirectory: '/path/to/project' },
 *   async () => {
 *     // Tools called here will use /path/to/project as their target
 *     await runOrchestrator();
 *   }
 * );
 * ```
 */
export function runWithExecutionContext<T>(
  context: ExecutionContext,
  fn: () => T | Promise<T>
): T | Promise<T> {
  return storage.run(context, fn);
}

/**
 * Get the target directory from the current execution context.
 *
 * Falls back to process.cwd() if no context is available, which ensures
 * backward compatibility with direct tool calls outside of orchestration.
 *
 * @returns The target directory for the current analysis
 *
 * @example
 * ```typescript
 * // Inside a tool implementation
 * const projectPath = getTargetDirectory();
 * const recommendation = {
 *   projectPath,
 *   // ...
 * };
 * ```
 */
export function getTargetDirectory(): string {
  return storage.getStore()?.targetDirectory ?? process.cwd();
}

/**
 * Get the full execution context.
 *
 * Returns undefined if no context is available (e.g., direct tool call
 * outside of orchestration).
 *
 * @returns The execution context or undefined
 */
export function getExecutionContext(): ExecutionContext | undefined {
  return storage.getStore();
}

/**
 * Check if an execution context is currently active.
 *
 * @returns true if running within a context
 */
export function hasExecutionContext(): boolean {
  return storage.getStore() !== undefined;
}
