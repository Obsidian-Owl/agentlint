/**
 * Unit tests for MCP Environment Variable Validation
 *
 * Tests the env validator for MCP server environment variables.
 */

import { describe, it, expect } from 'bun:test';
import {
  validateEnv,
  analyzeEnvVar,
  isSensitiveName,
  detectVariableRefs,
} from '../../../../../src/tools/config/mcp/validators/env';
import type { Position } from '../../../../../src/tools/config/mcp/types';

const defaultPosition: Position = {
  start: { line: 1, column: 1 },
  end: { line: 1, column: 1 },
};

describe('isSensitiveName', () => {
  it('should detect PASSWORD in name', () => {
    expect(isSensitiveName('DATABASE_PASSWORD')).toBe(true);
    expect(isSensitiveName('password')).toBe(true);
    expect(isSensitiveName('PASS_WORD')).toBe(false); // Not matching exactly
  });

  it('should detect SECRET in name', () => {
    expect(isSensitiveName('CLIENT_SECRET')).toBe(true);
    expect(isSensitiveName('secret_key')).toBe(true);
  });

  it('should detect KEY at end of name', () => {
    expect(isSensitiveName('API_KEY')).toBe(true);
    expect(isSensitiveName('GITHUB_KEY')).toBe(true);
    expect(isSensitiveName('KEYBOARD')).toBe(false); // KEY not at end
  });

  it('should detect TOKEN in name', () => {
    expect(isSensitiveName('GITHUB_TOKEN')).toBe(true);
    expect(isSensitiveName('access_token')).toBe(true);
  });

  it('should detect CREDENTIAL in name', () => {
    expect(isSensitiveName('AWS_CREDENTIALS')).toBe(true);
    expect(isSensitiveName('credential_file')).toBe(true);
  });

  it('should detect AUTH in name', () => {
    expect(isSensitiveName('AUTH_TOKEN')).toBe(true);
    expect(isSensitiveName('oauth_secret')).toBe(true);
  });

  it('should detect PRIVATE in name', () => {
    expect(isSensitiveName('PRIVATE_KEY')).toBe(true);
    expect(isSensitiveName('private_cert')).toBe(true);
  });

  it('should not flag non-sensitive names', () => {
    expect(isSensitiveName('NODE_ENV')).toBe(false);
    expect(isSensitiveName('PATH')).toBe(false);
    expect(isSensitiveName('HOME')).toBe(false);
    expect(isSensitiveName('DEBUG')).toBe(false);
    expect(isSensitiveName('LOG_LEVEL')).toBe(false);
  });
});

describe('detectVariableRefs', () => {
  it('should detect ${VAR} pattern', () => {
    const refs = detectVariableRefs('${GITHUB_TOKEN}');
    expect(refs).toHaveLength(1);
    expect(refs[0]!.pattern).toBe('${GITHUB_TOKEN}');
    expect(refs[0]!.varName).toBe('GITHUB_TOKEN');
  });

  it('should detect ${env:VAR} pattern', () => {
    const refs = detectVariableRefs('${env:API_KEY}');
    expect(refs).toHaveLength(1);
    expect(refs[0]!.pattern).toBe('${env:API_KEY}');
    expect(refs[0]!.varName).toBe('API_KEY');
  });

  it('should detect $VAR pattern', () => {
    const refs = detectVariableRefs('$HOME/bin');
    expect(refs).toHaveLength(1);
    expect(refs[0]!.pattern).toBe('$HOME');
    expect(refs[0]!.varName).toBe('HOME');
  });

  it('should detect multiple variable references', () => {
    const refs = detectVariableRefs('${HOME}/${USER}/.config');
    expect(refs).toHaveLength(2);
    expect(refs.map((r) => r.varName)).toContain('HOME');
    expect(refs.map((r) => r.varName)).toContain('USER');
  });

  it('should return empty array for no references', () => {
    const refs = detectVariableRefs('plain-value');
    expect(refs).toHaveLength(0);
  });
});

describe('analyzeEnvVar', () => {
  it('should analyze a normal env var', () => {
    const result = analyzeEnvVar('NODE_ENV', 'production', defaultPosition);
    expect(result.name).toBe('NODE_ENV');
    expect(result.value).toBe('production');
    expect(result.isSensitive).toBe(false);
    expect(result.hasVariableRef).toBe(false);
  });

  it('should flag sensitive env var names', () => {
    const result = analyzeEnvVar('API_KEY', 'sk-12345', defaultPosition);
    expect(result.isSensitive).toBe(true);
  });

  it('should detect variable references in values', () => {
    const result = analyzeEnvVar('TOKEN', '${GITHUB_TOKEN}', defaultPosition);
    expect(result.hasVariableRef).toBe(true);
  });
});

describe('validateEnv', () => {
  // T033: sensitive name detection MCP014
  describe('MCP014 - sensitive data in config', () => {
    it('should return MCP014 for sensitive env var with literal value', () => {
      const env = {
        API_KEY: 'sk-1234567890abcdef',
      };

      const issues = validateEnv(env, '/test/.mcp.json', 'test-server', defaultPosition);

      const mcp014 = issues.find((i) => i.code === 'MCP014');
      expect(mcp014).toBeDefined();
      expect(mcp014!.severity).toBe('warning');
      expect(mcp014!.serverName).toBe('test-server');
      expect(mcp014!.field).toBe('API_KEY');
    });

    it('should not return MCP014 for sensitive env var with variable reference', () => {
      const env = {
        API_KEY: '${API_KEY}',
      };

      const issues = validateEnv(env, '/test/.mcp.json', 'test-server', defaultPosition);

      // MCP014 should NOT be present because value is a variable reference
      const mcp014 = issues.find(
        (i) => i.code === 'MCP014' && i.message.includes('literal value')
      );
      expect(mcp014).toBeUndefined();
    });

    it('should return MCP014 for GITHUB_TOKEN with literal value', () => {
      const env = {
        GITHUB_TOKEN: 'ghp_1234567890abcdef',
      };

      const issues = validateEnv(env, '/test/.mcp.json', 'test-server', defaultPosition);

      const mcp014 = issues.find((i) => i.code === 'MCP014');
      expect(mcp014).toBeDefined();
    });

    it('should not flag non-sensitive env vars', () => {
      const env = {
        NODE_ENV: 'production',
        DEBUG: 'true',
        LOG_LEVEL: 'info',
      };

      const issues = validateEnv(env, '/test/.mcp.json', 'test-server', defaultPosition);

      const mcp014 = issues.filter((i) => i.code === 'MCP014');
      expect(mcp014).toHaveLength(0);
    });
  });

  // T034: variable reference detection MCP023
  describe('MCP023 - variable reference detected', () => {
    it('should return MCP023 for ${VAR} pattern', () => {
      const env = {
        TOKEN: '${GITHUB_TOKEN}',
      };

      const issues = validateEnv(env, '/test/.mcp.json', 'test-server', defaultPosition);

      const mcp023 = issues.find((i) => i.code === 'MCP023');
      expect(mcp023).toBeDefined();
      expect(mcp023!.severity).toBe('info');
      expect(mcp023!.field).toBe('TOKEN');
      expect(mcp023!.context?.variableRefs).toContain('${GITHUB_TOKEN}');
    });

    it('should return MCP023 for ${env:VAR} pattern', () => {
      const env = {
        KEY: '${env:API_KEY}',
      };

      const issues = validateEnv(env, '/test/.mcp.json', 'test-server', defaultPosition);

      const mcp023 = issues.find((i) => i.code === 'MCP023');
      expect(mcp023).toBeDefined();
      expect(mcp023!.context?.variableRefs).toContain('${env:API_KEY}');
    });

    it('should detect multiple variable references in one value', () => {
      const env = {
        CONFIG: '${HOME}/${USER}/.config',
      };

      const issues = validateEnv(env, '/test/.mcp.json', 'test-server', defaultPosition);

      const mcp023 = issues.find((i) => i.code === 'MCP023');
      expect(mcp023).toBeDefined();
      const refs = mcp023!.context?.variableRefs as string[];
      expect(refs).toContain('${HOME}');
      expect(refs).toContain('${USER}');
    });

    it('should not return MCP023 for literal values', () => {
      const env = {
        NODE_ENV: 'production',
        DEBUG: 'true',
      };

      const issues = validateEnv(env, '/test/.mcp.json', 'test-server', defaultPosition);

      const mcp023 = issues.filter((i) => i.code === 'MCP023');
      expect(mcp023).toHaveLength(0);
    });
  });

  describe('combined scenarios', () => {
    it('should handle multiple env vars with mixed issues', () => {
      const env = {
        NODE_ENV: 'production',
        API_KEY: 'literal-secret-value',
        TOKEN: '${GITHUB_TOKEN}',
        DEBUG: 'true',
      };

      const issues = validateEnv(env, '/test/.mcp.json', 'test-server', defaultPosition);

      // Should have MCP014 for API_KEY
      const mcp014 = issues.find((i) => i.code === 'MCP014' && i.field === 'API_KEY');
      expect(mcp014).toBeDefined();

      // Should have MCP023 for TOKEN
      const mcp023 = issues.find((i) => i.code === 'MCP023' && i.field === 'TOKEN');
      expect(mcp023).toBeDefined();
    });

    it('should return EnvVarInfo for all analyzed vars', () => {
      const env = {
        VAR1: 'value1',
        VAR2: '${REF}',
        API_KEY: 'secret',
      };

      const issues = validateEnv(env, '/test/.mcp.json', 'test-server', defaultPosition);

      // All issues should have proper position
      for (const issue of issues) {
        expect(issue.line).toBeGreaterThan(0);
        expect(issue.column).toBeGreaterThan(0);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty env object', () => {
      const issues = validateEnv({}, '/test/.mcp.json', 'test-server', defaultPosition);
      expect(issues).toHaveLength(0);
    });

    it('should handle non-string env values gracefully', () => {
      const env = {
        NUM: 123 as unknown as string,
        BOOL: true as unknown as string,
      };

      // Should not throw
      expect(() => validateEnv(env, '/test/.mcp.json', 'test-server', defaultPosition)).not.toThrow();
    });
  });
});
