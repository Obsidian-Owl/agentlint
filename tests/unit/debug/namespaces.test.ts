/**
 * EP11 Quality & Security - Namespace Filtering Unit Tests
 *
 * Tests for debug namespace constants and matching utilities.
 *
 * @module tests/unit/debug/namespaces
 */

import { describe, it, expect } from 'bun:test';
import {
  DEBUG_NAMESPACES,
  matchesNamespace,
  isNamespaceEnabled,
  parseDebugEnv,
  isAgentlintDebugEnabled,
  createSubNamespace,
  getSpecificNamespaces,
} from '../../../src/debug/namespaces';

describe('DEBUG_NAMESPACES', () => {
  it('should have ALL wildcard pattern', () => {
    expect(DEBUG_NAMESPACES.ALL).toBe('agentlint:*');
  });

  it('should have standard namespace constants', () => {
    expect(DEBUG_NAMESPACES.TOOLS).toBe('agentlint:tools');
    expect(DEBUG_NAMESPACES.LLM).toBe('agentlint:llm');
    expect(DEBUG_NAMESPACES.SECRETS).toBe('agentlint:secrets');
    expect(DEBUG_NAMESPACES.EVAL).toBe('agentlint:eval');
    expect(DEBUG_NAMESPACES.CHECKPOINT).toBe('agentlint:checkpoint');
  });

  it('should have extended namespace constants', () => {
    expect(DEBUG_NAMESPACES.ORCHESTRATION).toBe('agentlint:orchestration');
    expect(DEBUG_NAMESPACES.CAUSAL).toBe('agentlint:causal');
    expect(DEBUG_NAMESPACES.ACT).toBe('agentlint:act');
    expect(DEBUG_NAMESPACES.ADVISOR).toBe('agentlint:advisor');
  });

  it('should all start with agentlint:', () => {
    for (const namespace of Object.values(DEBUG_NAMESPACES)) {
      expect(namespace.startsWith('agentlint:')).toBe(true);
    }
  });
});

describe('matchesNamespace', () => {
  it('should match exact namespace', () => {
    expect(matchesNamespace('agentlint:tools', 'agentlint:tools')).toBe(true);
    expect(matchesNamespace('agentlint:llm', 'agentlint:llm')).toBe(true);
  });

  it('should not match different namespace', () => {
    expect(matchesNamespace('agentlint:tools', 'agentlint:llm')).toBe(false);
  });

  it('should match with wildcard pattern', () => {
    expect(matchesNamespace('agentlint:tools', 'agentlint:*')).toBe(true);
    expect(matchesNamespace('agentlint:llm', 'agentlint:*')).toBe(true);
    expect(matchesNamespace('agentlint:secrets', 'agentlint:*')).toBe(true);
  });

  it('should match sub-namespaces with wildcard', () => {
    expect(matchesNamespace('agentlint:tools:read', 'agentlint:tools:*')).toBe(true);
    expect(matchesNamespace('agentlint:tools:write', 'agentlint:tools:*')).toBe(true);
  });

  it('should not match non-agentlint namespaces with agentlint wildcard', () => {
    expect(matchesNamespace('express:router', 'agentlint:*')).toBe(false);
  });

  it('should handle partial matches correctly', () => {
    // 'agentlint:tool' should not match 'agentlint:tools' (exact match required)
    expect(matchesNamespace('agentlint:tool', 'agentlint:tools')).toBe(false);
  });
});

describe('isNamespaceEnabled', () => {
  it('should return false for empty patterns', () => {
    expect(isNamespaceEnabled('agentlint:tools', [])).toBe(false);
  });

  it('should return true when namespace matches a pattern', () => {
    expect(isNamespaceEnabled('agentlint:tools', ['agentlint:tools'])).toBe(true);
    expect(isNamespaceEnabled('agentlint:tools', ['agentlint:*'])).toBe(true);
  });

  it('should return true when namespace matches any pattern', () => {
    expect(isNamespaceEnabled('agentlint:llm', ['agentlint:tools', 'agentlint:llm'])).toBe(true);
  });

  it('should return false when namespace matches no patterns', () => {
    expect(isNamespaceEnabled('agentlint:secrets', ['agentlint:tools', 'agentlint:llm'])).toBe(
      false
    );
  });
});

describe('parseDebugEnv', () => {
  it('should return empty array for undefined', () => {
    expect(parseDebugEnv(undefined)).toEqual([]);
  });

  it('should return empty array for empty string', () => {
    expect(parseDebugEnv('')).toEqual([]);
  });

  it('should return empty array for non-agentlint values', () => {
    expect(parseDebugEnv('express:*')).toEqual([]);
    expect(parseDebugEnv('http,socket')).toEqual([]);
  });

  it('should parse single agentlint namespace', () => {
    expect(parseDebugEnv('agentlint:tools')).toEqual(['agentlint:tools']);
  });

  it('should parse wildcard', () => {
    expect(parseDebugEnv('agentlint:*')).toEqual(['agentlint:*']);
  });

  it('should parse multiple namespaces', () => {
    expect(parseDebugEnv('agentlint:tools,agentlint:llm')).toEqual([
      'agentlint:tools',
      'agentlint:llm',
    ]);
  });

  it('should filter out non-agentlint namespaces from mixed input', () => {
    expect(parseDebugEnv('express:*,agentlint:tools,socket')).toEqual(['agentlint:tools']);
  });

  it('should trim whitespace', () => {
    expect(parseDebugEnv('agentlint:tools , agentlint:llm')).toEqual([
      'agentlint:tools',
      'agentlint:llm',
    ]);
  });
});

describe('isAgentlintDebugEnabled', () => {
  it('should return false for undefined', () => {
    expect(isAgentlintDebugEnabled(undefined)).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isAgentlintDebugEnabled('')).toBe(false);
  });

  it('should return false for non-agentlint values', () => {
    expect(isAgentlintDebugEnabled('express:*')).toBe(false);
  });

  it('should return true for agentlint namespace', () => {
    expect(isAgentlintDebugEnabled('agentlint:tools')).toBe(true);
    expect(isAgentlintDebugEnabled('agentlint:*')).toBe(true);
  });

  it('should return true for mixed values containing agentlint', () => {
    expect(isAgentlintDebugEnabled('express:*,agentlint:tools')).toBe(true);
  });
});

describe('createSubNamespace', () => {
  it('should create sub-namespace from parent and child', () => {
    expect(createSubNamespace('agentlint:tools', 'read')).toBe('agentlint:tools:read');
    expect(createSubNamespace('agentlint:tools', 'write')).toBe('agentlint:tools:write');
  });

  it('should work with any parent namespace', () => {
    expect(createSubNamespace('agentlint:llm', 'request')).toBe('agentlint:llm:request');
  });
});

describe('getSpecificNamespaces', () => {
  it('should return all namespaces except wildcards', () => {
    const specific = getSpecificNamespaces();

    // Should not include the wildcard
    expect(specific).not.toContain('agentlint:*');

    // Should include specific namespaces
    expect(specific).toContain('agentlint:tools');
    expect(specific).toContain('agentlint:llm');
    expect(specific).toContain('agentlint:secrets');
  });

  it('should return only non-wildcard namespaces', () => {
    const specific = getSpecificNamespaces();

    for (const ns of specific) {
      expect(ns.endsWith('*')).toBe(false);
    }
  });
});
