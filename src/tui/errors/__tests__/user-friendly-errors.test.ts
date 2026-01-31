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

// Test helpers
function expectFields(
  result: ReturnType<typeof formatUserFriendlyError>,
  expected: {
    what?: string;
    why?: string;
    action?: string;
    technical?: string;
  }
): void {
  if (expected.what !== undefined) {
    expect(result.what).toBe(expected.what);
  }
  if (expected.why !== undefined) {
    expect(result.why).toContain(expected.why);
  }
  if (expected.action !== undefined) {
    expect(result.action).toContain(expected.action);
  }
  if (expected.technical !== undefined) {
    expect(result.technical).toContain(expected.technical);
  }
}

function testErrorTransform(
  error: Error | string,
  expected: {
    what?: string;
    why?: string;
    action?: string;
    technical?: string;
  }
): void {
  const result = formatUserFriendlyError(error);
  expectFields(result, expected);
}

describe('formatUserFriendlyError', () => {
  describe('Config Errors', () => {
    test('transforms ConfigNotFoundError into user-friendly message', () => {
      testErrorTransform(new ConfigNotFoundError('~/.agentlint/config.json'), {
        what: "Can't find your config file",
        action: 'Run `agentlint init` to create one',
        technical: 'Configuration file not found',
      });
    });

    test('handles generic config file not found errors', () => {
      testErrorTransform(new Error('File not found: ~/.agentlint/config.json'), {
        what: "Can't find your config file",
        action: 'Run `agentlint init` to create one',
      });
    });

    test('handles invalid JSON errors', () => {
      testErrorTransform(new Error('Invalid JSON in config file'), {
        what: 'Config file has invalid JSON',
        action: 'agentlint init --force',
      });
    });
  });

  describe('Network Errors', () => {
    test('transforms NetworkError into user-friendly message', () => {
      testErrorTransform(new NetworkError('Connection refused'), {
        what: 'Connection to AI service failed',
        why: 'network',
        action: 'internet connection',
      });
    });

    test('handles timeout errors', () => {
      testErrorTransform(new Error('Request timeout: ETIMEDOUT'), {
        what: 'Request timed out',
        action: 'Try again',
      });
    });

    test('handles DNS resolution errors', () => {
      testErrorTransform(new Error('getaddrinfo ENOTFOUND api.anthropic.com'), {
        what: 'Could not reach AI service',
        why: 'DNS',
        action: 'network connection',
      });
    });
  });

  describe('Authentication Errors', () => {
    test('transforms ProviderAuthError into user-friendly message', () => {
      // ProviderAuthError('auth_failed') message contains "authentication failed"
      // which matches the invalid API key pattern
      testErrorTransform(new ProviderAuthError('auth_failed'), {
        what: 'API key is invalid',
        action: 'console.anthropic.com',
      });
    });

    test('handles invalid API key errors', () => {
      testErrorTransform(new Error('Unauthorized: invalid API key'), {
        what: 'API key is invalid',
        action: 'console.anthropic.com',
      });
    });

    test('handles rate limit errors', () => {
      testErrorTransform(new Error('Rate limit exceeded (429)'), {
        what: 'Too many requests',
        action: 'Wait',
      });
    });
  });

  describe('File Errors', () => {
    test('transforms FileNotFoundError into user-friendly message', () => {
      // FileNotFoundError is caught by isFileNotFoundError type guard
      testErrorTransform(new FileNotFoundError('/path/to/file.txt'), {
        what: 'File not found',
        action: 'Check the path',
      });
    });

    test('handles ENOENT errors', () => {
      testErrorTransform(new Error('ENOENT: no such file or directory'), {
        what: 'File or directory not found',
        action: 'path',
      });
    });

    test('handles session directory not found', () => {
      testErrorTransform(new Error('Sessions directory not found'), {
        what: 'No session history found',
        why: 'first run',
        action: 'Start a session',
      });
    });
  });

  describe('Permission Errors', () => {
    test('transforms PermissionError into user-friendly message', () => {
      // PermissionError message contains "permission denied" which matches EACCES pattern
      testErrorTransform(new PermissionError('/protected/file', 'write'), {
        what: "Don't have permission to access this file",
        action: 'permissions',
      });
    });

    test('handles EACCES errors', () => {
      testErrorTransform(new Error('EACCES: permission denied'), {
        what: "Don't have permission to access this file",
        action: 'permissions',
      });
    });

    test('handles read-only filesystem errors', () => {
      testErrorTransform(new Error('EROFS: read-only file system'), {
        what: "Can't write to this location",
        why: 'read-only',
        action: 'different location',
      });
    });
  });

  describe('Database Errors', () => {
    test('transforms DatabaseError into user-friendly message', () => {
      // DatabaseError is caught by isDatabaseError type guard, but message doesn't contain "locked"
      testErrorTransform(new DatabaseError('unknown', 'Database locked'), {
        what: 'Database error',
        action: 'Try again',
      });
    });

    test('handles corrupted database errors', () => {
      testErrorTransform(new Error('Database is corrupt'), {
        what: 'Database file is corrupted',
        action: 'agentlint clean',
      });
    });

    test('handles disk full errors', () => {
      testErrorTransform(new Error('ENOSPC: no space left on device'), {
        what: 'Not enough disk space',
        action: 'Free up disk space',
      });
    });
  });

  describe('Generic Errors', () => {
    test('handles unknown errors gracefully', () => {
      const result = formatUserFriendlyError(new Error('Some unexpected error'));
      expect(result.what).toBe('An error occurred');
      expect(result.action).toContain('Try again');
      expect(result.technical).toBe('Some unexpected error');
    });

    test('handles non-Error objects', () => {
      testErrorTransform('String error message', {
        what: 'Something went wrong',
        action: 'Try again',
      });
    });

    test('includes context when provided', () => {
      const result = formatUserFriendlyError(new Error('Unknown error'), 'file operation');
      expect(result.what).toBe('Error in file operation');
      expect(result.action).toContain('Try again');
    });
  });
});

describe('formatErrorForDisplay', () => {
  function expectDisplayContains(error: Error | string, ...substrings: string[]): void {
    const result = formatErrorForDisplay(error);
    substrings.forEach((substring) => {
      expect(result).toContain(substring);
    });
  }

  test('formats error with what + action', () => {
    expectDisplayContains(
      new ConfigNotFoundError('Config not found'),
      "Can't find your config file",
      '→ Run `agentlint init` to create one'
    );
  });

  test('includes why when present', () => {
    expectDisplayContains(
      new Error('Sessions directory not found'),
      'No session history found',
      'This is expected on first run',
      '→ Start a session'
    );
  });

  test('formats network error with all fields', () => {
    expectDisplayContains(
      new NetworkError('Connection refused'),
      'Connection to AI service failed',
      'network',
      '→',
      'internet connection'
    );
  });
});

describe('getErrorSummary', () => {
  function expectSummary(error: Error | string, expected: string): void {
    const summary = getErrorSummary(error);
    expect(summary).toBe(expected);
  }

  test('returns short summary of error', () => {
    expectSummary(new ConfigNotFoundError('Config not found'), "Can't find your config file");
  });

  test('extracts what field only', () => {
    const summary = getErrorSummary(new NetworkError('ECONNREFUSED'));
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
