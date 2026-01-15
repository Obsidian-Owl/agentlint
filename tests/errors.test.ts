/**
 * Error handling tests
 */

import { describe, test, expect } from 'bun:test';
import {
  ExitCode,
  AgentlintError,
  InvalidArgumentError,
  NetworkError,
  ChecksumMismatchError,
  getExitCode,
  formatError,
} from '../src/errors';

describe('errors', () => {
  describe('ExitCode constants', () => {
    test('defines correct exit code values', () => {
      expect(ExitCode.Success).toBe(0);
      expect(ExitCode.GeneralError).toBe(1);
      expect(ExitCode.InvalidArgument).toBe(2);
      expect(ExitCode.NetworkError).toBe(3);
      expect(ExitCode.ChecksumMismatch).toBe(4);
    });
  });

  describe('AgentlintError', () => {
    test('creates error with message and default code', () => {
      const error = new AgentlintError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe(ExitCode.GeneralError);
      expect(error.name).toBe('AgentlintError');
    });

    test('creates error with custom exit code', () => {
      const error = new AgentlintError('Custom error', ExitCode.NetworkError);
      expect(error.message).toBe('Custom error');
      expect(error.code).toBe(ExitCode.NetworkError);
    });

    test('is instance of Error', () => {
      const error = new AgentlintError('Test');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('InvalidArgumentError', () => {
    test('creates error with InvalidArgument exit code', () => {
      const error = new InvalidArgumentError('Invalid option: --foo');
      expect(error.message).toBe('Invalid option: --foo');
      expect(error.code).toBe(ExitCode.InvalidArgument);
      expect(error.name).toBe('InvalidArgumentError');
    });

    test('is instance of AgentlintError', () => {
      const error = new InvalidArgumentError('Test');
      expect(error).toBeInstanceOf(AgentlintError);
    });
  });

  describe('NetworkError', () => {
    test('creates error with NetworkError exit code', () => {
      const error = new NetworkError('Connection refused');
      expect(error.message).toBe('Connection refused');
      expect(error.code).toBe(ExitCode.NetworkError);
      expect(error.name).toBe('NetworkError');
    });

    test('is instance of AgentlintError', () => {
      const error = new NetworkError('Test');
      expect(error).toBeInstanceOf(AgentlintError);
    });
  });

  describe('ChecksumMismatchError', () => {
    test('creates error with formatted message', () => {
      const expected = 'abc123';
      const actual = 'def456';
      const error = new ChecksumMismatchError(expected, actual);

      expect(error.message).toContain('abc123');
      expect(error.message).toContain('def456');
      expect(error.code).toBe(ExitCode.ChecksumMismatch);
      expect(error.name).toBe('ChecksumMismatchError');
    });

    test('is instance of AgentlintError', () => {
      const error = new ChecksumMismatchError('a', 'b');
      expect(error).toBeInstanceOf(AgentlintError);
    });
  });

  describe('getExitCode', () => {
    test('returns code from AgentlintError', () => {
      const error = new AgentlintError('Test', ExitCode.NetworkError);
      expect(getExitCode(error)).toBe(ExitCode.NetworkError);
    });

    test('returns code from InvalidArgumentError', () => {
      const error = new InvalidArgumentError('Test');
      expect(getExitCode(error)).toBe(ExitCode.InvalidArgument);
    });

    test('returns GeneralError for standard Error', () => {
      const error = new Error('Standard error');
      expect(getExitCode(error)).toBe(ExitCode.GeneralError);
    });

    test('returns GeneralError for non-Error values', () => {
      expect(getExitCode('string error')).toBe(ExitCode.GeneralError);
      expect(getExitCode(42)).toBe(ExitCode.GeneralError);
      expect(getExitCode(null)).toBe(ExitCode.GeneralError);
      expect(getExitCode(undefined)).toBe(ExitCode.GeneralError);
      expect(getExitCode({ custom: 'object' })).toBe(ExitCode.GeneralError);
    });
  });

  describe('formatError', () => {
    test('formats Error with message', () => {
      const error = new Error('Something went wrong');
      expect(formatError(error)).toBe('Error: Something went wrong');
    });

    test('formats AgentlintError', () => {
      const error = new NetworkError('Connection failed');
      expect(formatError(error)).toBe('Error: Connection failed');
    });

    test('formats string values', () => {
      expect(formatError('string error')).toBe('Error: string error');
    });

    test('formats number values', () => {
      expect(formatError(42)).toBe('Error: 42');
    });

    test('formats null and undefined', () => {
      expect(formatError(null)).toBe('Error: null');
      expect(formatError(undefined)).toBe('Error: undefined');
    });

    test('formats objects', () => {
      const result = formatError({ code: 500 });
      expect(result).toBe('Error: [object Object]');
    });
  });
});
