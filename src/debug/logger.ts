/**
 * EP11 Quality & Security - Debug Logger
 *
 * DebugLogger implementation with namespace filtering, log levels,
 * redaction, and multiple output destinations.
 *
 * Default behavior (following Claude Code / OpenCode pattern):
 * - Log level: info (not warn)
 * - Output: both console and file
 * - Default log file: ~/.agentlint/logs/{date}.ndjson
 * - Use --no-log to disable file logging
 *
 * @module debug/logger
 */

import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';
import type { DebugConfig, LogLevel, LogEntry, IDebugLogger, INamespacedLogger } from './types';
import { LOG_LEVEL_VALUES } from './types';
import { isNamespaceEnabled, parseDebugEnv } from './namespaces';
import { redact, redactObject, BUILTIN_REDACTION_PATTERNS } from './redaction';

// =============================================================================
// Default Configuration
// =============================================================================

/**
 * Get the default log directory path (~/.agentlint/logs).
 */
export function getDefaultLogDir(): string {
  return join(homedir(), '.agentlint', 'logs');
}

/**
 * Generate a default log file path for the current date.
 * Format: ~/.agentlint/logs/{YYYY-MM-DD}.ndjson
 */
export function getDefaultLogFilePath(): string {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return join(getDefaultLogDir(), `${date}.ndjson`);
}

/**
 * Default debug configuration.
 *
 * Following Claude Code / OpenCode pattern:
 * - Log level: info (log everything useful by default)
 * - Output: console (file logging is set up separately)
 *
 * Note: logFile is NOT set in defaults - it's set explicitly in createLoggerFromCLIOptions
 * when file logging is enabled. This allows --no-log to properly disable file logging.
 *
 * Use --no-log to disable file logging, --quiet to suppress console output.
 */
export const DEFAULT_DEBUG_CONFIG: DebugConfig = {
  level: 'info',
  namespaces: ['agentlint:*'],
  output: 'console',
  format: 'pretty',
  redactionPatterns: BUILTIN_REDACTION_PATTERNS,
};

// =============================================================================
// DebugLogger Implementation
// =============================================================================

/**
 * Debug logger with namespace filtering, log levels, and redaction.
 *
 * @example
 * ```typescript
 * const logger = new DebugLogger({
 *   level: 'debug',
 *   namespaces: ['agentlint:*'],
 *   output: 'console',
 *   format: 'pretty',
 * });
 *
 * logger.debug('agentlint:tools', 'Tool invoked', { tool: 'read_file' });
 *
 * // Create child logger with fixed namespace
 * const toolsLogger = logger.child('agentlint:tools');
 * toolsLogger.info('Processing file', { path: '/src/index.ts' });
 * ```
 */
export class DebugLogger implements IDebugLogger {
  private config: DebugConfig;

  /**
   * Process-global flag indicating TUI is active.
   * When true, console output is suppressed (file logging continues).
   *
   * NOTE: This is process-global state. Test isolation should use
   * beforeEach/afterEach to reset: DebugLogger.setTuiActive(false)
   */
  private static tuiActive = false;

  public static setTuiActive(active: boolean): void {
    DebugLogger.tuiActive = active;
  }

  public static isTuiActive(): boolean {
    return DebugLogger.tuiActive;
  }

  constructor(config: Partial<DebugConfig> = {}) {
    // Merge with defaults and check environment
    const envNamespaces = parseDebugEnv(process.env.DEBUG);

    // Determine namespaces:
    // 1. If config.namespaces is explicitly set (even empty array), use it
    // 2. Else if DEBUG env var is set, use those
    // 3. Else use defaults
    let namespaces: string[];
    if (config.namespaces !== undefined) {
      namespaces = config.namespaces; // Respect explicit empty array
    } else if (envNamespaces.length > 0) {
      namespaces = envNamespaces;
    } else {
      namespaces = DEFAULT_DEBUG_CONFIG.namespaces;
    }

    this.config = {
      ...DEFAULT_DEBUG_CONFIG,
      ...config,
      namespaces,
      redactionPatterns: config.redactionPatterns ?? DEFAULT_DEBUG_CONFIG.redactionPatterns,
    };

    // Ensure log directory exists when file logging is enabled
    // Use mode 0o700 for owner-only access (defense-in-depth)
    if ((this.config.output === 'file' || this.config.output === 'both') && this.config.logFile) {
      const dir = dirname(this.config.logFile);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true, mode: 0o700 });
      }
    }
  }

  // ===========================================================================
  // Log Methods
  // ===========================================================================

  trace(namespace: string, message: string, data?: Record<string, unknown>): void {
    this.log('trace', namespace, message, data);
  }

  debug(namespace: string, message: string, data?: Record<string, unknown>): void {
    this.log('debug', namespace, message, data);
  }

  info(namespace: string, message: string, data?: Record<string, unknown>): void {
    this.log('info', namespace, message, data);
  }

  warn(namespace: string, message: string, data?: Record<string, unknown>): void {
    this.log('warn', namespace, message, data);
  }

  error(namespace: string, message: string, data?: Record<string, unknown>): void {
    this.log('error', namespace, message, data);
  }

  // ===========================================================================
  // Child Logger
  // ===========================================================================

  child(namespace: string): INamespacedLogger {
    return new NamespacedLogger(this, namespace);
  }

  // ===========================================================================
  // Namespace Checking
  // ===========================================================================

  isEnabled(namespace: string): boolean {
    return isNamespaceEnabled(namespace, this.config.namespaces);
  }

  // ===========================================================================
  // Timed Operations
  // ===========================================================================

  async time<T>(namespace: string, message: string, operation: () => Promise<T>): Promise<T> {
    const start = performance.now();

    try {
      const result = await operation();
      const durationMs = performance.now() - start;

      this.log('debug', namespace, message, { durationMs });

      return result;
    } catch (error) {
      const durationMs = performance.now() - start;

      this.log('error', namespace, `${message} (failed)`, {
        durationMs,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  getConfig(): DebugConfig {
    return { ...this.config };
  }

  setConfig(config: Partial<DebugConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  // ===========================================================================
  // Internal Methods
  // ===========================================================================

  private log(
    level: LogLevel,
    namespace: string,
    message: string,
    data?: Record<string, unknown>
  ): void {
    // Check if this level should be logged
    if (!this.shouldLog(level, namespace)) {
      return;
    }

    // Create log entry
    const entry: LogEntry = {
      level,
      namespace,
      timestamp: new Date().toISOString(),
      message: this.redactMessage(message),
      ...(data !== undefined && { data: this.redactData(data) }),
    };

    // Output based on configuration
    this.output(entry);
  }

  private shouldLog(level: LogLevel, namespace: string): boolean {
    // Check log level
    if (LOG_LEVEL_VALUES[level] < LOG_LEVEL_VALUES[this.config.level]) {
      return false;
    }

    // Check namespace (if namespaces are configured)
    if (this.config.namespaces.length > 0 && !this.isEnabled(namespace)) {
      return false;
    }

    return true;
  }

  private redactMessage(message: string): string {
    return redact(message, this.config.redactionPatterns);
  }

  private redactData(data: Record<string, unknown>): Record<string, unknown> {
    return redactObject(data, this.config.redactionPatterns);
  }

  private output(entry: LogEntry): void {
    const { output, format, logFile } = this.config;

    if (output === 'console' || output === 'both') {
      this.outputToConsole(entry, format);
    }

    if ((output === 'file' || output === 'both') && logFile) {
      this.outputToFile(entry, logFile);
    }
  }

  private outputToConsole(entry: LogEntry, format: 'pretty' | 'json'): void {
    // Suppress console output when TUI is active (log to file only)
    if (DebugLogger.tuiActive) {
      return;
    }

    // Use stderr for debug output to avoid polluting stdout (AGE-663)
    if (format === 'json') {
      console.error(JSON.stringify(entry));
    } else {
      console.error(this.formatPretty(entry));
    }
  }

  private outputToFile(entry: LogEntry, filePath: string): void {
    // Ensure directory exists
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Always write JSON to file (one entry per line - NDJSON format)
    const line = JSON.stringify(entry) + '\n';
    appendFileSync(filePath, line);
  }

  private formatPretty(entry: LogEntry): string {
    const { level, namespace, timestamp, message, data, durationMs } = entry;

    // Color codes for different levels
    const colors: Record<LogLevel, string> = {
      trace: '\x1b[90m', // gray
      debug: '\x1b[36m', // cyan
      info: '\x1b[32m', // green
      warn: '\x1b[33m', // yellow
      error: '\x1b[31m', // red
    };
    const reset = '\x1b[0m';
    const dim = '\x1b[2m';

    const levelStr = level.toUpperCase().padEnd(5);
    const color = colors[level];

    let output = `${dim}${timestamp}${reset} ${color}${levelStr}${reset} [${namespace}] ${message}`;

    if (durationMs !== undefined) {
      output += ` ${dim}(${durationMs.toFixed(2)}ms)${reset}`;
    }

    if (data && Object.keys(data).length > 0) {
      output += `\n  ${dim}${JSON.stringify(data)}${reset}`;
    }

    return output;
  }
}

// =============================================================================
// NamespacedLogger Implementation
// =============================================================================

/**
 * Logger with a fixed namespace.
 */
class NamespacedLogger implements INamespacedLogger {
  constructor(
    private parent: DebugLogger,
    private namespace: string
  ) {}

  trace(message: string, data?: Record<string, unknown>): void {
    this.parent.trace(this.namespace, message, data);
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.parent.debug(this.namespace, message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.parent.info(this.namespace, message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.parent.warn(this.namespace, message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.parent.error(this.namespace, message, data);
  }

  async time<T>(message: string, operation: () => Promise<T>): Promise<T> {
    return this.parent.time(this.namespace, message, operation);
  }

  isEnabled(): boolean {
    return this.parent.isEnabled(this.namespace);
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new DebugLogger instance.
 *
 * @param config - Logger configuration
 * @returns Configured DebugLogger
 */
export function createDebugLogger(config: Partial<DebugConfig> = {}): IDebugLogger {
  return new DebugLogger(config);
}

/**
 * Create a logger from CLI options.
 *
 * By default, logging is enabled:
 * - Level: info
 * - Output: both console stderr and file
 * - File: ~/.agentlint/logs/{date}.ndjson
 *
 * Use --no-log to disable file logging.
 * Use --quiet to suppress console output (file logging continues).
 * Use --verbose to increase console verbosity.
 *
 * @param options - CLI debug options
 * @returns Configured DebugLogger
 */
export function createLoggerFromCLIOptions(options: {
  verbose?: boolean;
  quiet?: boolean;
  logFile?: string;
  noLog?: boolean;
}): IDebugLogger {
  // Determine if file logging is enabled
  const enableFileLogging = !options.noLog;

  // Start with defaults (info level, both outputs, default log file)
  const config: Partial<DebugConfig> = {
    level: 'info',
    namespaces: ['agentlint:*'],
    output: enableFileLogging ? 'both' : 'console',
  };

  // Only set logFile if file logging is enabled
  if (enableFileLogging) {
    config.logFile = options.logFile ?? getDefaultLogFilePath();
  }

  // --verbose: increase console verbosity to debug level
  // Note: must check before --quiet so quiet can override
  if (options.verbose && !options.quiet) {
    config.level = 'debug';
    config.namespaces = ['agentlint:*'];
  }

  // --quiet: suppress most output, error level only, no namespaces
  // Takes precedence over --verbose
  if (options.quiet) {
    config.level = 'error';
    config.namespaces = []; // Disable all namespaces in quiet mode
    if (enableFileLogging) {
      config.output = 'file'; // Only file, no console
    }
    // If noLog is also set, output stays as 'console' for errors only
  }

  return new DebugLogger(config);
}

// =============================================================================
// Singleton Instance
// =============================================================================

let defaultLogger: IDebugLogger | null = null;

/**
 * Get the default logger instance.
 * Creates one if it doesn't exist.
 */
export function getDefaultLogger(): IDebugLogger {
  if (!defaultLogger) {
    defaultLogger = new DebugLogger();
  }
  return defaultLogger;
}

/**
 * Set the default logger instance.
 */
export function setDefaultLogger(logger: IDebugLogger): void {
  defaultLogger = logger;
}
