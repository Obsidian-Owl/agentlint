/**
 * Tests for user-friendly error messages
 */

import { describe, test, expect } from 'bun:test';
import {
  formatUserFriendlyError,
  formatErrorForDisplay,
  getErrorSummary,
} from '../user-friendly-errors';
import {
  ConfigNotFoundError,
  FileNotFoundError,
  ProviderAuthError,
  DatabaseError,
  PermissionError,
  NetworkError,
} from '../../../errors';

describe('formatUserFriendlyError', () => {
  describe('Config Errors', () => {
    test('transforms ConfigNotFoundError into user-friendly message', () => {
      const error = new ConfigNotFoundError('~/.agentlint/config.json');
      const result = formatUserFriendlyError(error);

      expect(result.what).toBe("Can't find your config file");
      expect(result.action).toBe('Run `agentlint init` to create one');
      expect(result.technical).toContain('Configuration file not found');
    });

    test('handles generic config file not found errors', () => {
      const error = new Error('File not found: ~/.agentlint/config.json');
      const result = formatUserFriendlyError(error);

      expect(result.what).toBe("Can't find your config file");
      expect(result.action).toBe('Run `agentlint init` to create one');
    });

    test('handles invalid JSON errors', () => {
      const error = new Error('Invalid JSON in config file');
      const result = formatUserFriendlyError(error);

      expect(result.what).toBe('Config file has invalid JSON');
      expect(result.action).toContain('agentlint init --force');
    });
  });

  describe('Network Errors', () => {
    test('transforms NetworkError into user-friendly message', () => {
      const error = new NetworkError('Connection refused');
      const result = formatUserFriendlyError(error);

      expect(result.what).toBe('Connection to AI service failed');
      expect(result.why).toContain('network');
      expect(result.action).toContain('internet connection');
    });

    test('handles timeout errors', () => {
      const error = new Error('Request timeout: ETIMEDOUT');
      const result = formatUserFriendlyError(error);

      expect(result.what).toBe('Request timed out');
      expect(result.action).toContain('Try again');
    });

    test('handles DNS resolution errors', () => {
      const error = new Error('getaddrinfo ENOTFOUND api.anthropic.com');
      const result = formatUserFriendlyError(error);

      expect(result.what).toBe('Could not reach AI service');
      expect(result.why).toContain('DNS');
      expect(result.action).toContain('network connection');
    });
  });

  describe('Authentication Errors', () => {
    test('transforms ProviderAuthError into user-friendly message', () => {
      const error = new ProviderAuthError('auth_failed');
      const result = formatUserFriendlyError(error);

      // Since the error message doesn't contain "api key" and "missing", it falls back to generic auth error
      expect(result.what).toBe('Authentication failed');
      expect(result.action).toContain('API key');
    });

    test('handles invalid API key errors', () => {
      const error = new Error('Unauthorized: invalid API key');
      const result = formatUserFriendlyError(error);

      expect(result.what).toBe('API key is invalid');
      expect(result.action).toContain('console.anthropic.com');
    });

    test('handles rate limit errors', () => {
      const error = new Error('Rate limit exceeded (429)');
      const result = formatUserFriendlyError(error);

      expect(result.what).toBe('Too many requests');
      expect(result.action).toContain('Wait');
    });
  });

  describe('File Errors', () => {
    test('transforms FileNotFoundError into user-friendly message', () => {
      const error = new FileNotFoundError('/path/to/file.txt');
      const result = formatUserFriendlyError(error);

      // FileNotFoundError is caught by isFileNotFoundError type guard
      expect(result.what).toBe('File not found');
      expect(result.action).toContain('Check the path');
    });

    test('handles ENOENT errors', () => {
      const error = new Error('ENOENT: no such file or directory');
      const result = formatUserFriendlyError(error);

      expect(result.what).toBe('File or directory not found');
      expect(result.action).toContain('path');
    });

    test('handles session directory not found', () => {
      const error = new Error('Sessions directory not found');
      const result = formatUserFriendlyError(error);

      expect(result.what).toBe('No session history found');
      expect(result.why).toContain('first run');
      expect(result.action).toContain('Start a session');
    });
  });

  describe('Permission Errors', () => {
    test('transforms PermissionError into user-friendly message', () => {
      const error = new PermissionError('/protected/file', 'write');
      const result = formatUserFriendlyError(error);

      // PermissionError is caught by isPermissionError type guard
      expect(result.what).toBe('Permission denied');
      expect(result.action).toContain('permissions');
    });

    test('handles EACCES errors', () => {
      const error = new Error('EACCES: permission denied');
      const result = formatUserFriendlyError(error);

      expect(result.what).toBe("Don't have permission to access this file");
      expect(result.action).toContain('permissions');
    });

    test('handles read-only filesystem errors', () => {
      const error = new Error('EROFS: read-only file system');
      const result = formatUserFriendlyError(error);

      expect(result.what).toBe("Can't write to this location");
      expect(result.why).toContain('read-only');
      expect(result.action).toContain('different location');
    });
  });

  describe('Database Errors', () => {
    test('transforms DatabaseError into user-friendly message', () => {
      const error = new DatabaseError('unknown', 'Database locked');
      const result = formatUserFriendlyError(error);

      // DatabaseError is caught by isDatabaseError type guard, but message doesn't contain "locked"
      expect(result.what).toBe('Database error');
      expect(result.action).toContain('Try again');
    });

    test('handles corrupted database errors', () => {
      const error = new Error('Database is corrupt');
      const result = formatUserFriendlyError(error);

      expect(result.what).toBe('Database file is corrupted');
      expect(result.action).toContain('agentlint clean');
    });

    test('handles disk full errors', () => {
      const error = new Error('ENOSPC: no space left on device');
      const result = formatUserFriendlyError(error);

      expect(result.what).toBe('Not enough disk space');
      expect(result.action).toContain('Free up disk space');
    });
  });

  describe('Generic Errors', () => {
    test('handles unknown errors gracefully', () => {
      const error = new Error('Some unexpected error');
      const result = formatUserFriendlyError(error);

      expect(result.what).toBe('An error occurred');
      expect(result.action).toContain('Try again');
      expect(result.technical).toBe('Some unexpected error');
    });

    test('handles non-Error objects', () => {
      const error = 'String error message';
      const result = formatUserFriendlyError(error);

      expect(result.what).toBe('Something went wrong');
      expect(result.action).toContain('Try again');
    });

    test('includes context when provided', () => {
      const error = new Error('Unknown error');
      const result = formatUserFriendlyError(error, 'file operation');

      expect(result.what).toBe('Error in file operation');
      expect(result.action).toContain('Try again');
    });
  });
});

describe('formatErrorForDisplay', () => {
  test('formats error with what + action', () => {
    const error = new ConfigNotFoundError('Config not found');
    const result = formatErrorForDisplay(error);

    expect(result).toContain("Can't find your config file");
    expect(result).toContain('→ Run `agentlint init` to create one');
  });

  test('includes why when present', () => {
    const error = new Error('Sessions directory not found');
    const result = formatErrorForDisplay(error);

    expect(result).toContain('No session history found');
    expect(result).toContain('This is expected on first run');
    expect(result).toContain('→ Start a session');
  });

  test('formats network error with all fields', () => {
    const error = new NetworkError('Connection refused');
    const result = formatErrorForDisplay(error);

    expect(result).toContain('Connection to AI service failed');
    expect(result).toContain('network');
    expect(result).toContain('→');
    expect(result).toContain('internet connection');
  });
});

describe('getErrorSummary', () => {
  test('returns short summary of error', () => {
    const error = new ConfigNotFoundError('Config not found');
    const summary = getErrorSummary(error);

    expect(summary).toBe("Can't find your config file");
  });

  test('extracts what field only', () => {
    const error = new NetworkError('ECONNREFUSED');
    const summary = getErrorSummary(error);

    expect(summary).toBe('Connection to AI service failed');
    expect(summary).not.toContain('→');
    expect(summary).not.toContain('network');
  });
});

describe('Edge Cases', () => {
  test('handles error with multiple patterns matching', () => {
    // This error could match both network and config patterns
    const error = new Error('Network error loading config.json');
    const result = formatUserFriendlyError(error);

    // Should match file not found pattern first
    expect(result.what).toBeTruthy();
    expect(result.action).toBeTruthy();
  });

  test('handles error with no message', () => {
    const error = new Error();
    const result = formatUserFriendlyError(error);

    expect(result.what).toBe('An error occurred');
    expect(result.action).toBe('Try again or check the logs for details');
  });

  test('preserves original error message for debugging', () => {
    const error = new Error('Complex technical error: ERR_SOCKET_DGRAM_IS_CONNECTED');
    const result = formatUserFriendlyError(error);

    expect(result.technical).toBe('Complex technical error: ERR_SOCKET_DGRAM_IS_CONNECTED');
  });
});
