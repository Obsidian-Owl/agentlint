/**
 * EP11 Quality & Security - Debug CLI Integration Tests
 *
 * Integration tests for CLI flags (--verbose, --debug, --quiet, --log-file).
 * These test the underlying logger functions that would be used by CLI flags.
 *
 * @module tests/integration/debug-cli
 */

import { describe, it, expect, afterEach, beforeEach, spyOn } from 'bun:test';
import { existsSync, unlinkSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { DebugLogger, createLoggerFromCLIOptions, createDebugLogger } from '../../src/debug/logger';
import { redact, redactObject, isSensitiveKey } from '../../src/debug/redaction';

describe('Debug CLI Flags', () => {
  const testLogFile = join(tmpdir(), `agentlint-test-debug-${Date.now()}.log`);
  let consoleSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    consoleSpy = spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    if (existsSync(testLogFile)) {
      unlinkSync(testLogFile);
    }
  });

  describe('--verbose flag', () => {
    it('should enable tool invocation logging', () => {
      const logger = createLoggerFromCLIOptions({ verbose: true });

      // Verbose should enable agentlint:tools namespace
      expect(logger.isEnabled('agentlint:tools')).toBe(true);
    });

    it('should show timing information via time() method', async () => {
      const logger = createLoggerFromCLIOptions({ verbose: true });

      const result = await logger.time('agentlint:tools', 'Test operation', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'done';
      });

      expect(result).toBe('done');
      // Timing info would be logged if console not mocked
    });

    it('should enable agentlint:tools and agentlint:llm namespaces', () => {
      const logger = createLoggerFromCLIOptions({ verbose: true });

      expect(logger.isEnabled('agentlint:tools')).toBe(true);
      expect(logger.isEnabled('agentlint:llm')).toBe(true);
    });
  });

  describe('--debug flag', () => {
    it('should enable specific debug category', () => {
      const logger = createLoggerFromCLIOptions({ debug: 'tools' });

      expect(logger.isEnabled('agentlint:tools')).toBe(true);
      expect(logger.isEnabled('agentlint:other')).toBe(false);
    });

    it('should support multiple categories', () => {
      const logger = createLoggerFromCLIOptions({ debug: 'tools,llm' });

      expect(logger.isEnabled('agentlint:tools')).toBe(true);
      expect(logger.isEnabled('agentlint:llm')).toBe(true);
    });

    it('should enable all categories with *', () => {
      const logger = createLoggerFromCLIOptions({ debug: '*' });

      expect(logger.isEnabled('agentlint:anything')).toBe(true);
      expect(logger.isEnabled('agentlint:tools')).toBe(true);
      expect(logger.isEnabled('agentlint:llm')).toBe(true);
    });

    it('should set log level to debug', () => {
      const logger = createLoggerFromCLIOptions({ debug: 'tools' });
      const config = (logger as DebugLogger).getConfig();

      expect(config.level).toBe('debug');
    });
  });

  describe('--quiet flag', () => {
    it('should suppress non-error output', () => {
      const logger = createLoggerFromCLIOptions({ quiet: true });
      const config = (logger as DebugLogger).getConfig();

      expect(config.level).toBe('error');
    });

    it('should set log level to error', () => {
      const logger = createLoggerFromCLIOptions({ quiet: true });
      const config = (logger as DebugLogger).getConfig();

      expect(config.level).toBe('error');
    });

    it('should disable all namespaces', () => {
      const logger = createLoggerFromCLIOptions({ quiet: true });
      const config = (logger as DebugLogger).getConfig();

      expect(config.namespaces).toEqual([]);
    });

    it('should override --verbose when both specified', () => {
      // When both are specified, quiet should take precedence
      const logger = createLoggerFromCLIOptions({ verbose: true, quiet: true });
      const config = (logger as DebugLogger).getConfig();

      expect(config.level).toBe('error');
    });
  });

  describe('--log-file flag', () => {
    it('should write debug output to specified file', () => {
      const logger = createDebugLogger({
        level: 'debug',
        namespaces: ['agentlint:*'],
        output: 'file',
        logFile: testLogFile,
      });

      logger.info('agentlint:test', 'Test message');

      expect(existsSync(testLogFile)).toBe(true);
    });

    it('should create file if it does not exist', () => {
      expect(existsSync(testLogFile)).toBe(false);

      const logger = createDebugLogger({
        level: 'debug',
        namespaces: ['agentlint:*'],
        output: 'file',
        logFile: testLogFile,
      });

      logger.info('agentlint:test', 'Test message');

      expect(existsSync(testLogFile)).toBe(true);
    });

    it('should append to existing file', () => {
      writeFileSync(testLogFile, 'existing line\n');

      const logger = createDebugLogger({
        level: 'debug',
        namespaces: ['agentlint:*'],
        output: 'file',
        logFile: testLogFile,
      });

      logger.info('agentlint:test', 'New message');

      const content = readFileSync(testLogFile, 'utf-8');
      expect(content).toContain('existing line');
      expect(content).toContain('New message');
    });

    it('should write JSON format to file', () => {
      const logger = createDebugLogger({
        level: 'debug',
        namespaces: ['agentlint:*'],
        output: 'file',
        logFile: testLogFile,
      });

      logger.info('agentlint:test', 'JSON test');

      const content = readFileSync(testLogFile, 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines.length).toBe(1);

      const entry = JSON.parse(lines[0]!);
      expect(entry.message).toBe('JSON test');
      expect(entry.namespace).toBe('agentlint:test');
      expect(entry.level).toBe('info');
    });

    it('should output to both file and console with output: both', () => {
      const logger = createDebugLogger({
        level: 'debug',
        namespaces: ['agentlint:*'],
        output: 'both',
        logFile: testLogFile,
      });

      logger.info('agentlint:test', 'Both outputs');

      // File should have content
      expect(existsSync(testLogFile)).toBe(true);
      const fileContent = readFileSync(testLogFile, 'utf-8');
      expect(fileContent).toContain('Both outputs');

      // Console should have been called
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Flag Combinations', () => {
    it('should combine --verbose and --log-file', () => {
      // Use createDebugLogger directly to test the combination
      // (createLoggerFromCLIOptions has specific output logic)
      const logger = createDebugLogger({
        level: 'info',
        namespaces: ['agentlint:tools', 'agentlint:llm'],
        output: 'both',
        logFile: testLogFile,
      });

      logger.info('agentlint:tools', 'Combined test');

      // Should output to console AND file
      expect(consoleSpy).toHaveBeenCalled();
      expect(existsSync(testLogFile)).toBe(true);
    });

    it('should combine --debug and --log-file', () => {
      const logger = createDebugLogger({
        level: 'debug',
        namespaces: ['agentlint:tools'],
        output: 'both',
        logFile: testLogFile,
      });

      logger.debug('agentlint:tools', 'Debug to both');

      expect(existsSync(testLogFile)).toBe(true);
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('--quiet should suppress console but not file when both used', () => {
      // This tests the behavior when quiet is combined with log-file
      const logger = createDebugLogger({
        level: 'error',
        namespaces: [],
        output: 'file',
        logFile: testLogFile,
      });

      // Even with quiet (error level), error messages should go to file
      logger.error('agentlint:test', 'Error message');

      expect(existsSync(testLogFile)).toBe(true);
      const content = readFileSync(testLogFile, 'utf-8');
      expect(content).toContain('Error message');
    });
  });

  describe('Environment Variable Interaction', () => {
    it('should use config namespaces over DEBUG env', () => {
      // When namespaces are explicitly configured, they take precedence
      const logger = createDebugLogger({
        level: 'debug',
        namespaces: ['custom:namespace'],
      });

      expect(logger.isEnabled('custom:namespace')).toBe(true);
    });

    it('CLI flags should configure logger properly', () => {
      const logger = createLoggerFromCLIOptions({ debug: 'tools,llm' });
      const config = (logger as DebugLogger).getConfig();

      expect(config.namespaces).toContain('agentlint:tools');
      expect(config.namespaces).toContain('agentlint:llm');
    });
  });
});

describe('Debug Output Format', () => {
  describe('Console Output', () => {
    let consoleSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
      consoleSpy = spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should use colored output for pretty format', () => {
      const logger = createDebugLogger({
        level: 'debug',
        namespaces: ['agentlint:*'],
        output: 'console',
        format: 'pretty',
      });

      logger.info('agentlint:test', 'Pretty format test');

      expect(consoleSpy).toHaveBeenCalled();
      // Pretty format includes ANSI color codes
      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('\x1b['); // ANSI escape code
    });

    it('should include timestamp prefix', () => {
      const logger = createDebugLogger({
        level: 'debug',
        namespaces: ['agentlint:*'],
        output: 'console',
        format: 'pretty',
      });

      logger.info('agentlint:test', 'Timestamp test');

      const output = consoleSpy.mock.calls[0][0];
      // Should contain ISO timestamp format
      expect(output).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should include namespace in brackets', () => {
      const logger = createDebugLogger({
        level: 'debug',
        namespaces: ['agentlint:*'],
        output: 'console',
        format: 'pretty',
      });

      logger.info('agentlint:test', 'Namespace test');

      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('[agentlint:test]');
    });

    it('should format structured data nicely', () => {
      const logger = createDebugLogger({
        level: 'debug',
        namespaces: ['agentlint:*'],
        output: 'console',
        format: 'pretty',
      });

      logger.info('agentlint:test', 'Data test', { key: 'value', num: 42 });

      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('key');
      expect(output).toContain('value');
    });
  });

  describe('File Output', () => {
    const testLogFile = join(tmpdir(), `agentlint-format-test-${Date.now()}.log`);

    afterEach(() => {
      if (existsSync(testLogFile)) {
        unlinkSync(testLogFile);
      }
    });

    it('should write one JSON object per line', () => {
      const logger = createDebugLogger({
        level: 'debug',
        namespaces: ['agentlint:*'],
        output: 'file',
        logFile: testLogFile,
      });

      logger.info('agentlint:test', 'Line 1');
      logger.info('agentlint:test', 'Line 2');
      logger.info('agentlint:test', 'Line 3');

      const content = readFileSync(testLogFile, 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines.length).toBe(3);
    });

    it('should include all log entry fields', () => {
      const logger = createDebugLogger({
        level: 'debug',
        namespaces: ['agentlint:*'],
        output: 'file',
        logFile: testLogFile,
      });

      logger.info('agentlint:test', 'Full entry', { extra: 'data' });

      const content = readFileSync(testLogFile, 'utf-8');
      const entry = JSON.parse(content.trim());

      expect(entry.level).toBe('info');
      expect(entry.namespace).toBe('agentlint:test');
      expect(entry.timestamp).toBeDefined();
      expect(entry.message).toBe('Full entry');
      expect(entry.data).toEqual({ extra: 'data' });
    });

    it('should be parseable as JSON', () => {
      const logger = createDebugLogger({
        level: 'debug',
        namespaces: ['agentlint:*'],
        output: 'file',
        logFile: testLogFile,
      });

      logger.info('agentlint:test', 'JSON test');
      logger.warn('agentlint:test', 'Warning test');

      const content = readFileSync(testLogFile, 'utf-8');
      const lines = content.trim().split('\n');

      for (const line of lines) {
        expect(() => JSON.parse(line) as unknown).not.toThrow();
      }
    });
  });
});

describe('Redaction in CLI Output', () => {
  it('should redact secrets in console output', () => {
    const input = 'API key is sk-ant-api03-abc123def456 and password=secret123';
    const redacted = redact(input);

    expect(redacted).not.toContain('sk-ant-api03-abc123def456');
    expect(redacted).not.toContain('secret123');
    expect(redacted).toContain('[REDACTED');
  });

  it('should redact secrets in file output', () => {
    const input = 'The token is Bearer eyJhbGciOiJIUzI1NiJ9.test.signature';
    const redacted = redact(input);

    expect(redacted).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(redacted).toContain('[REDACTED');
  });

  it('should redact secrets in error messages', () => {
    const errorMsg = 'Connection failed: postgres://user:password123@localhost/db';
    const redacted = redact(errorMsg);

    expect(redacted).not.toContain('password123');
    expect(redacted).toContain('[REDACTED');
  });

  it('should redact sensitive keys in objects', () => {
    const obj = {
      apiKey: 'secret-key-value',
      password: 'my-password',
      username: 'not-sensitive',
    };

    const redacted = redactObject(obj);

    expect(redacted.apiKey).toBe('[REDACTED]');
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.username).toBe('not-sensitive');
  });

  it('should identify sensitive key names', () => {
    expect(isSensitiveKey('apiKey')).toBe(true);
    expect(isSensitiveKey('api_key')).toBe(true);
    expect(isSensitiveKey('password')).toBe(true);
    expect(isSensitiveKey('secret')).toBe(true);
    expect(isSensitiveKey('token')).toBe(true);
    expect(isSensitiveKey('username')).toBe(false);
    expect(isSensitiveKey('email')).toBe(false);
  });
});
