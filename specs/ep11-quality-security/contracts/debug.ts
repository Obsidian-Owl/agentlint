/**
 * EP11 Quality & Security - Debug Infrastructure Contracts
 *
 * TypeScript interfaces for the debug logging system.
 *
 * @module contracts/debug
 */

// =============================================================================
// Log Levels
// =============================================================================

/**
 * Available log levels in order of verbosity.
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

/**
 * Numeric log level values for comparison.
 */
export const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
};

// =============================================================================
// Namespaces
// =============================================================================

/**
 * Debug namespace hierarchy.
 */
export const DEBUG_NAMESPACES = {
  ALL: 'agentlint:*',
  TOOLS: 'agentlint:tools',
  LLM: 'agentlint:llm',
  SECRETS: 'agentlint:secrets',
  EVAL: 'agentlint:eval',
  CHECKPOINT: 'agentlint:checkpoint',
} as const;

export type DebugNamespace = (typeof DEBUG_NAMESPACES)[keyof typeof DEBUG_NAMESPACES];

// =============================================================================
// Configuration
// =============================================================================

/**
 * Debug logger configuration.
 */
export interface DebugConfig {
  /** Minimum log level to output */
  level: LogLevel;

  /** Active namespaces (supports wildcards like 'agentlint:*') */
  namespaces: string[];

  /** Output destination */
  output: 'console' | 'file' | 'both';

  /** File path for file output (required if output includes 'file') */
  logFile?: string;

  /** Output format */
  format: 'pretty' | 'json';

  /** Patterns to redact from output */
  redactionPatterns: RedactionPattern[];
}

/**
 * Pattern for redacting sensitive data.
 */
export interface RedactionPattern {
  /** Pattern to match */
  pattern: RegExp;

  /** Replacement function or string */
  replacement: string | ((match: string) => string);

  /** Optional identifier for the pattern type */
  type?: string;
}

// =============================================================================
// Log Entry
// =============================================================================

/**
 * A single log entry.
 */
export interface LogEntry {
  /** Log level */
  level: LogLevel;

  /** Namespace (e.g., 'agentlint:tools') */
  namespace: string;

  /** ISO-8601 timestamp */
  timestamp: string;

  /** Log message */
  message: string;

  /** Structured data (already redacted) */
  data?: Record<string, unknown>;

  /** Source location */
  source?: {
    file: string;
    line: number;
    function?: string;
  };

  /** Duration in ms (for timed operations) */
  durationMs?: number;
}

// =============================================================================
// Debug Logger Interface
// =============================================================================

/**
 * Interface for the debug logger.
 */
export interface IDebugLogger {
  /**
   * Log a trace message (most verbose).
   */
  trace(namespace: string, message: string, data?: Record<string, unknown>): void;

  /**
   * Log a debug message.
   */
  debug(namespace: string, message: string, data?: Record<string, unknown>): void;

  /**
   * Log an info message.
   */
  info(namespace: string, message: string, data?: Record<string, unknown>): void;

  /**
   * Log a warning message.
   */
  warn(namespace: string, message: string, data?: Record<string, unknown>): void;

  /**
   * Log an error message.
   */
  error(namespace: string, message: string, data?: Record<string, unknown>): void;

  /**
   * Create a child logger with a fixed namespace.
   */
  child(namespace: string): INamespacedLogger;

  /**
   * Check if a namespace is enabled.
   */
  isEnabled(namespace: string): boolean;

  /**
   * Time an async operation.
   */
  time<T>(
    namespace: string,
    message: string,
    operation: () => Promise<T>
  ): Promise<T>;

  /**
   * Get current configuration.
   */
  getConfig(): DebugConfig;

  /**
   * Update configuration.
   */
  setConfig(config: Partial<DebugConfig>): void;
}

/**
 * Logger with fixed namespace.
 */
export interface INamespacedLogger {
  trace(message: string, data?: Record<string, unknown>): void;
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  time<T>(message: string, operation: () => Promise<T>): Promise<T>;
  isEnabled(): boolean;
}

// =============================================================================
// CLI Integration
// =============================================================================

/**
 * CLI debug flags.
 */
export interface DebugCLIOptions {
  /** Enable verbose output (tool invocations, timing) */
  verbose?: boolean;

  /** Enable debug output for specific categories */
  debug?: string;

  /** Suppress non-essential output */
  quiet?: boolean;

  /** Write debug output to file */
  logFile?: string;
}

/**
 * Parse CLI options into debug configuration.
 */
export function parseDebugOptions(options: DebugCLIOptions): Partial<DebugConfig> {
  const config: Partial<DebugConfig> = {};

  if (options.quiet) {
    config.level = 'error';
    config.namespaces = [];
  } else if (options.verbose) {
    config.level = 'info';
    config.namespaces = [DEBUG_NAMESPACES.TOOLS, DEBUG_NAMESPACES.LLM];
  }

  if (options.debug) {
    config.level = 'debug';
    config.namespaces = options.debug
      .split(',')
      .map((cat) => `agentlint:${cat.trim()}`);
  }

  if (options.logFile) {
    config.output = 'file';
    config.logFile = options.logFile;
  }

  return config;
}

// =============================================================================
// Environment Variable Integration
// =============================================================================

/**
 * Parse DEBUG environment variable.
 */
export function parseDebugEnv(env: string | undefined): string[] {
  if (!env) return [];

  // Only activate for agentlint-specific namespaces
  if (!env.includes('agentlint')) return [];

  return env
    .split(',')
    .map((ns) => ns.trim())
    .filter((ns) => ns.startsWith('agentlint'));
}

/**
 * Check if debug is enabled for agentlint.
 */
export function isAgentlintDebugEnabled(env?: string): boolean {
  const debug = env ?? process.env.DEBUG ?? '';
  return debug.includes('agentlint:') || debug === 'agentlint';
}
