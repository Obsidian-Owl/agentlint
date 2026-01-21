/**
 * EP11 Quality & Security - DebugLogger Unit Tests
 *
 * Tests for the debug logging system including log levels,
 * namespace filtering, redaction, and output formatting.
 *
 * @module tests/unit/debug/logger
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  DebugLogger,
  createDebugLogger,
  createLoggerFromCLIOptions,
  DEFAULT_DEBUG_CONFIG,
} from '../../../src/debug/logger';
import { existsSync, unlinkSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Helper to get a log entry safely from consoleLogs array.
 */
function getLogEntry(
  logs: Array<{ method: string; args: unknown[] }>,
  index: number
): { method: string; args: unknown[] } {
  const entry = logs[index];
  if (!entry) {
    throw new Error(`No log entry at index ${index}`);
  }
  return entry;
}

/**
 * Helper to get and parse JSON from log entry.
 */
function getLogJson(logs: Array<{ method: string; args: unknown[] }>, index: number): unknown {
  const entry = getLogEntry(logs, index);
  return JSON.parse(entry.args[0] as string);
}

describe('DebugLogger', () => {
  // Mock console for capturing output
  let consoleLogs: Array<{ method: string; args: unknown[] }> = [];
  let originalConsole: typeof console;

  beforeEach(() => {
    consoleLogs = [];
    originalConsole = console;
    // @ts-expect-error - mocking console
    globalThis.console = {
      log: (...args: unknown[]) => consoleLogs.push({ method: 'log', args }),
      debug: (...args: unknown[]) => consoleLogs.push({ method: 'debug', args }),
      info: (...args: unknown[]) => consoleLogs.push({ method: 'info', args }),
      warn: (...args: unknown[]) => consoleLogs.push({ method: 'warn', args }),
      error: (...args: unknown[]) => consoleLogs.push({ method: 'error', args }),
    };
  });

  afterEach(() => {
    globalThis.console = originalConsole;
  });

  describe('Log Levels', () => {
    it('should respect minimum log level', () => {
      const logger = new DebugLogger({
        level: 'warn',
        namespaces: ['agentlint:*'],
      });

      logger.debug('agentlint:test', 'Debug message');
      logger.info('agentlint:test', 'Info message');
      logger.warn('agentlint:test', 'Warn message');
      logger.error('agentlint:test', 'Error message');

      // Only warn and error should be output
      expect(consoleLogs.length).toBe(2);
      expect(getLogEntry(consoleLogs, 0).args[0]).toContain('Warn message');
      expect(getLogEntry(consoleLogs, 1).args[0]).toContain('Error message');
    });

    it('should output all levels when set to trace', () => {
      const logger = new DebugLogger({
        level: 'trace',
        namespaces: ['agentlint:*'],
      });

      logger.trace('agentlint:test', 'Trace message');
      logger.debug('agentlint:test', 'Debug message');
      logger.info('agentlint:test', 'Info message');
      logger.warn('agentlint:test', 'Warn message');
      logger.error('agentlint:test', 'Error message');

      expect(consoleLogs.length).toBe(5);
    });

    it('should output only errors when set to error', () => {
      const logger = new DebugLogger({
        level: 'error',
        namespaces: ['agentlint:*'],
      });

      logger.trace('agentlint:test', 'Trace message');
      logger.debug('agentlint:test', 'Debug message');
      logger.info('agentlint:test', 'Info message');
      logger.warn('agentlint:test', 'Warn message');
      logger.error('agentlint:test', 'Error message');

      expect(consoleLogs.length).toBe(1);
      expect(getLogEntry(consoleLogs, 0).args[0]).toContain('Error message');
    });

    it('should compare log levels correctly', () => {
      // Test that trace < debug < info < warn < error
      const loggerTrace = new DebugLogger({ level: 'trace', namespaces: ['agentlint:*'] });
      const loggerDebug = new DebugLogger({ level: 'debug', namespaces: ['agentlint:*'] });
      const loggerInfo = new DebugLogger({ level: 'info', namespaces: ['agentlint:*'] });

      // Trace should output trace messages
      loggerTrace.trace('agentlint:test', 'Trace');
      expect(consoleLogs.length).toBe(1);
      consoleLogs = [];

      // Debug should NOT output trace messages
      loggerDebug.trace('agentlint:test', 'Trace');
      expect(consoleLogs.length).toBe(0);
      loggerDebug.debug('agentlint:test', 'Debug');
      expect(consoleLogs.length).toBe(1);
      consoleLogs = [];

      // Info should NOT output debug messages
      loggerInfo.debug('agentlint:test', 'Debug');
      expect(consoleLogs.length).toBe(0);
      loggerInfo.info('agentlint:test', 'Info');
      expect(consoleLogs.length).toBe(1);
    });
  });

  describe('Namespace Filtering', () => {
    it('should enable all namespaces with wildcard pattern', () => {
      const logger = new DebugLogger({
        level: 'debug',
        namespaces: ['agentlint:*'],
      });

      logger.debug('agentlint:tools', 'Tools message');
      logger.debug('agentlint:llm', 'LLM message');
      logger.debug('agentlint:eval', 'Eval message');

      expect(consoleLogs.length).toBe(3);
    });

    it('should enable specific namespace only', () => {
      const logger = new DebugLogger({
        level: 'debug',
        namespaces: ['agentlint:tools'],
      });

      logger.debug('agentlint:tools', 'Tools message');
      logger.debug('agentlint:llm', 'LLM message');

      expect(consoleLogs.length).toBe(1);
      expect(getLogEntry(consoleLogs, 0).args[0]).toContain('Tools message');
    });

    it('should support multiple namespace patterns', () => {
      const logger = new DebugLogger({
        level: 'debug',
        namespaces: ['agentlint:tools', 'agentlint:llm'],
      });

      logger.debug('agentlint:tools', 'Tools message');
      logger.debug('agentlint:llm', 'LLM message');
      logger.debug('agentlint:eval', 'Eval message');

      expect(consoleLogs.length).toBe(2);
    });

    it('should disable logging for unmatched namespaces', () => {
      const logger = new DebugLogger({
        level: 'debug',
        namespaces: ['agentlint:tools'],
      });

      logger.debug('agentlint:llm', 'LLM message');
      logger.debug('express:router', 'Express message');

      expect(consoleLogs.length).toBe(0);
    });

    it('should check namespace enablement correctly', () => {
      const logger = new DebugLogger({
        level: 'debug',
        namespaces: ['agentlint:tools', 'agentlint:llm'],
      });

      expect(logger.isEnabled('agentlint:tools')).toBe(true);
      expect(logger.isEnabled('agentlint:llm')).toBe(true);
      expect(logger.isEnabled('agentlint:eval')).toBe(false);
      expect(logger.isEnabled('express:router')).toBe(false);
    });
  });

  describe('Child Loggers', () => {
    it('should create child logger with fixed namespace', () => {
      const logger = new DebugLogger({
        level: 'debug',
        namespaces: ['agentlint:*'],
      });

      const toolsLogger = logger.child('agentlint:tools');
      toolsLogger.debug('Using read_file tool');

      expect(consoleLogs.length).toBe(1);
      expect(getLogEntry(consoleLogs, 0).args[0]).toContain('[agentlint:tools]');
    });

    it('should inherit parent configuration', () => {
      const logger = new DebugLogger({
        level: 'warn',
        namespaces: ['agentlint:*'],
      });

      const toolsLogger = logger.child('agentlint:tools');
      toolsLogger.debug('Debug message'); // Should be suppressed
      toolsLogger.warn('Warn message');

      expect(consoleLogs.length).toBe(1);
      expect(getLogEntry(consoleLogs, 0).args[0]).toContain('Warn message');
    });

    it('should have all log level methods', () => {
      const logger = new DebugLogger({
        level: 'trace',
        namespaces: ['agentlint:*'],
      });

      const child = logger.child('agentlint:test');

      expect(typeof child.trace).toBe('function');
      expect(typeof child.debug).toBe('function');
      expect(typeof child.info).toBe('function');
      expect(typeof child.warn).toBe('function');
      expect(typeof child.error).toBe('function');
      expect(typeof child.time).toBe('function');
      expect(typeof child.isEnabled).toBe('function');
    });

    it('should check own namespace enablement', () => {
      const logger = new DebugLogger({
        level: 'debug',
        namespaces: ['agentlint:tools'],
      });

      const toolsLogger = logger.child('agentlint:tools');
      const llmLogger = logger.child('agentlint:llm');

      expect(toolsLogger.isEnabled()).toBe(true);
      expect(llmLogger.isEnabled()).toBe(false);
    });
  });

  describe('Log Entry Format', () => {
    it('should include timestamp in ISO-8601 format', () => {
      const logger = new DebugLogger({
        level: 'info',
        namespaces: ['agentlint:*'],
        format: 'json',
      });

      logger.info('agentlint:test', 'Test message');

      const output = getLogJson(consoleLogs, 0) as { timestamp: string };
      expect(output.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should include namespace in output', () => {
      const logger = new DebugLogger({
        level: 'info',
        namespaces: ['agentlint:*'],
      });

      logger.info('agentlint:tools', 'Test message');

      expect(getLogEntry(consoleLogs, 0).args[0]).toContain('[agentlint:tools]');
    });

    it('should include log level indicator', () => {
      const logger = new DebugLogger({
        level: 'info',
        namespaces: ['agentlint:*'],
      });

      logger.info('agentlint:test', 'Test message');

      expect(getLogEntry(consoleLogs, 0).args[0]).toContain('INFO');
    });

    it('should format structured data', () => {
      const logger = new DebugLogger({
        level: 'info',
        namespaces: ['agentlint:*'],
        format: 'json',
      });

      logger.info('agentlint:test', 'Test message', { key: 'value' });

      const output = getLogJson(consoleLogs, 0) as { data: { key: string } };
      expect(output.data).toEqual({ key: 'value' });
    });

    it('should support pretty format', () => {
      const logger = new DebugLogger({
        level: 'info',
        namespaces: ['agentlint:*'],
        format: 'pretty',
      });

      logger.info('agentlint:test', 'Test message');

      // Pretty format should be human-readable (not JSON)
      const output = getLogEntry(consoleLogs, 0).args[0] as string;
      expect(() => JSON.parse(output) as unknown).toThrow();
      expect(output).toContain('Test message');
    });

    it('should support JSON format', () => {
      const logger = new DebugLogger({
        level: 'info',
        namespaces: ['agentlint:*'],
        format: 'json',
      });

      logger.info('agentlint:test', 'Test message');

      const output = getLogEntry(consoleLogs, 0).args[0] as string;
      expect(() => JSON.parse(output) as unknown).not.toThrow();
      const parsed = JSON.parse(output) as { message: string };
      expect(parsed.message).toBe('Test message');
    });
  });

  describe('Timed Operations', () => {
    it('should measure async operation duration', async () => {
      const logger = new DebugLogger({
        level: 'debug',
        namespaces: ['agentlint:*'],
        format: 'json',
      });

      await logger.time('agentlint:test', 'Operation', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'result';
      });

      const output = getLogJson(consoleLogs, 0) as { data: { durationMs: number } };
      expect(output.data.durationMs).toBeGreaterThan(5);
    });

    it('should return operation result', async () => {
      const logger = new DebugLogger({
        level: 'debug',
        namespaces: ['agentlint:*'],
      });

      const result = await logger.time('agentlint:test', 'Operation', async () => {
        return 'test-result';
      });

      expect(result).toBe('test-result');
    });

    it('should log duration in milliseconds', async () => {
      const logger = new DebugLogger({
        level: 'debug',
        namespaces: ['agentlint:*'],
        format: 'json',
      });

      await logger.time('agentlint:test', 'Fast operation', async () => 'done');

      const output = getLogJson(consoleLogs, 0) as { data: { durationMs: number } };
      expect(typeof output.data.durationMs).toBe('number');
    });

    it('should handle operation errors', async () => {
      const logger = new DebugLogger({
        level: 'debug',
        namespaces: ['agentlint:*'],
        format: 'json',
      });

      await expect(
        logger.time('agentlint:test', 'Failing operation', async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');

      // Should still log the failure with duration
      expect(consoleLogs.length).toBe(1);
      const output = getLogJson(consoleLogs, 0) as { level: string; data: { error: string } };
      expect(output.level).toBe('error');
      expect(output.data.error).toContain('Test error');
    });
  });

  describe('Configuration', () => {
    it('should return current configuration', () => {
      const logger = new DebugLogger({
        level: 'debug',
        namespaces: ['agentlint:tools'],
      });

      const config = logger.getConfig();
      expect(config.level).toBe('debug');
      expect(config.namespaces).toContain('agentlint:tools');
    });

    it('should update configuration partially', () => {
      const logger = new DebugLogger({
        level: 'debug',
        namespaces: ['agentlint:tools'],
      });

      logger.setConfig({ level: 'info' });

      const config = logger.getConfig();
      expect(config.level).toBe('info');
      expect(config.namespaces).toContain('agentlint:tools'); // Unchanged
    });

    it('should apply new log level immediately', () => {
      const logger = new DebugLogger({
        level: 'debug',
        namespaces: ['agentlint:*'],
      });

      logger.debug('agentlint:test', 'Debug before');
      expect(consoleLogs.length).toBe(1);

      logger.setConfig({ level: 'warn' });
      logger.debug('agentlint:test', 'Debug after');
      expect(consoleLogs.length).toBe(1); // Should still be 1 (second call suppressed)
    });

    it('should apply new namespaces immediately', () => {
      const logger = new DebugLogger({
        level: 'debug',
        namespaces: ['agentlint:tools'],
      });

      logger.debug('agentlint:llm', 'LLM before'); // Suppressed
      expect(consoleLogs.length).toBe(0);

      logger.setConfig({ namespaces: ['agentlint:llm'] });
      logger.debug('agentlint:llm', 'LLM after');
      expect(consoleLogs.length).toBe(1);
    });
  });

  describe('Output Destinations', () => {
    const testLogFile = join(tmpdir(), `agentlint-logger-test-${Date.now()}.log`);

    afterEach(() => {
      if (existsSync(testLogFile)) {
        unlinkSync(testLogFile);
      }
    });

    it('should output to console when configured', () => {
      const logger = new DebugLogger({
        level: 'info',
        namespaces: ['agentlint:*'],
        output: 'console',
      });

      logger.info('agentlint:test', 'Console message');
      expect(consoleLogs.length).toBe(1);
    });

    it('should output to file when configured', () => {
      const logger = new DebugLogger({
        level: 'info',
        namespaces: ['agentlint:*'],
        output: 'file',
        logFile: testLogFile,
      });

      logger.info('agentlint:test', 'File message');

      expect(consoleLogs.length).toBe(0); // No console output
      expect(existsSync(testLogFile)).toBe(true);

      const content = readFileSync(testLogFile, 'utf-8');
      expect(content).toContain('File message');
    });

    it('should output to both when configured', () => {
      const logger = new DebugLogger({
        level: 'info',
        namespaces: ['agentlint:*'],
        output: 'both',
        logFile: testLogFile,
      });

      logger.info('agentlint:test', 'Both message');

      expect(consoleLogs.length).toBe(1);
      expect(existsSync(testLogFile)).toBe(true);

      const content = readFileSync(testLogFile, 'utf-8');
      expect(content).toContain('Both message');
    });
  });
});

describe('DebugLogger Integration', () => {
  let consoleLogs: Array<{ method: string; args: unknown[] }> = [];
  let originalConsole: typeof console;

  beforeEach(() => {
    consoleLogs = [];
    originalConsole = console;
    // @ts-expect-error - mocking console
    globalThis.console = {
      log: (...args: unknown[]) => consoleLogs.push({ method: 'log', args }),
      debug: (...args: unknown[]) => consoleLogs.push({ method: 'debug', args }),
      info: (...args: unknown[]) => consoleLogs.push({ method: 'info', args }),
      warn: (...args: unknown[]) => consoleLogs.push({ method: 'warn', args }),
      error: (...args: unknown[]) => consoleLogs.push({ method: 'error', args }),
    };
  });

  afterEach(() => {
    globalThis.console = originalConsole;
  });

  describe('Redaction Integration', () => {
    it('should redact sensitive data in messages', () => {
      const logger = new DebugLogger({
        level: 'info',
        namespaces: ['agentlint:*'],
        format: 'json',
      });

      logger.info('agentlint:test', 'Connecting with password=mysecretpassword');

      const output = JSON.parse(getLogEntry(consoleLogs, 0).args[0] as string) as {
        message: string;
      };
      expect(output.message).not.toContain('mysecretpassword');
      expect(output.message).toContain('[REDACTED');
    });

    it('should redact sensitive data in structured data', () => {
      const logger = new DebugLogger({
        level: 'info',
        namespaces: ['agentlint:*'],
        format: 'json',
      });

      logger.info('agentlint:test', 'Auth request', {
        user: 'admin',
        password: 'supersecret',
      });

      const output = JSON.parse(getLogEntry(consoleLogs, 0).args[0] as string) as {
        data: { user: string; password: string };
      };
      expect(output.data.user).toBe('admin');
      expect(output.data.password).toBe('[REDACTED]');
    });

    it('should redact sensitive key names', () => {
      const logger = new DebugLogger({
        level: 'info',
        namespaces: ['agentlint:*'],
        format: 'json',
      });

      logger.info('agentlint:test', 'Config', {
        apiKey: 'my-key-value',
        token: 'my-token',
        secret: 'my-secret',
      });

      const output = JSON.parse(getLogEntry(consoleLogs, 0).args[0] as string) as {
        data: { apiKey: string; token: string; secret: string };
      };
      expect(output.data.apiKey).toBe('[REDACTED]');
      expect(output.data.token).toBe('[REDACTED]');
      expect(output.data.secret).toBe('[REDACTED]');
    });
  });
});

describe('Factory Functions', () => {
  let originalConsole: typeof console;

  beforeEach(() => {
    originalConsole = console;
    // @ts-expect-error - mocking console
    globalThis.console = {
      log: () => {},
    };
  });

  afterEach(() => {
    globalThis.console = originalConsole;
  });

  describe('createDebugLogger', () => {
    it('should create logger with defaults', () => {
      const logger = createDebugLogger();
      expect(logger.getConfig().level).toBe(DEFAULT_DEBUG_CONFIG.level);
    });

    it('should create logger with custom config', () => {
      const logger = createDebugLogger({ level: 'trace' });
      expect(logger.getConfig().level).toBe('trace');
    });
  });

  describe('createLoggerFromCLIOptions', () => {
    it('should set error level with --quiet', () => {
      const logger = createLoggerFromCLIOptions({ quiet: true });
      expect(logger.getConfig().level).toBe('error');
    });

    it('should enable tools and llm namespaces with --verbose', () => {
      const logger = createLoggerFromCLIOptions({ verbose: true });
      const config = logger.getConfig();
      expect(config.namespaces).toContain('agentlint:tools');
      expect(config.namespaces).toContain('agentlint:llm');
    });

    it('should enable specific categories with --debug', () => {
      const logger = createLoggerFromCLIOptions({ debug: 'tools,eval' });
      const config = logger.getConfig();
      expect(config.namespaces).toContain('agentlint:tools');
      expect(config.namespaces).toContain('agentlint:eval');
      expect(config.level).toBe('debug');
    });

    it('should enable all categories with --debug=*', () => {
      const logger = createLoggerFromCLIOptions({ debug: '*' });
      const config = logger.getConfig();
      expect(config.namespaces).toContain('agentlint:*');
    });
  });
});
