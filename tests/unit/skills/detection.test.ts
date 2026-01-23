/**
 * T021: Unit tests for skill invocation detection
 *
 * Tests the detection of Skill tool_use entries in session logs.
 */

import { describe, it, expect } from 'bun:test';
import {
  isSkillInvocation,
  extractSkillCommand,
  extractUserPromptContext,
  detectSkillInvocations,
  isSkillToolUse,
} from '../../../src/skills/detection';
import type { SessionEntry, ContentBlock } from '../../../src/tools/sessions/types';

// =============================================================================
// Test Fixtures
// =============================================================================

const createSkillToolUseEntry = (skillName: string, timestamp: string = '2026-01-24T10:00:00Z'): SessionEntry => ({
  type: 'assistant',
  uuid: 'test-uuid-1',
  timestamp,
  message: {
    role: 'assistant',
    content: [
      {
        type: 'tool_use',
        id: 'tool-1',
        name: 'Skill',
        input: { skill: skillName, args: '' },
      },
    ],
  },
});

const createUserEntry = (text: string, timestamp: string = '2026-01-24T09:59:00Z'): SessionEntry => ({
  type: 'user',
  uuid: 'test-uuid-2',
  timestamp,
  message: {
    role: 'user',
    content: [
      {
        type: 'text',
        text,
      },
    ],
  },
});

const createAssistantTextEntry = (text: string): SessionEntry => ({
  type: 'assistant',
  uuid: 'test-uuid-3',
  timestamp: '2026-01-24T10:00:00Z',
  message: {
    role: 'assistant',
    content: [
      {
        type: 'text',
        text,
      },
    ],
  },
});

const createNonSkillToolUseEntry = (toolName: string): SessionEntry => ({
  type: 'assistant',
  uuid: 'test-uuid-4',
  timestamp: '2026-01-24T10:00:00Z',
  message: {
    role: 'assistant',
    content: [
      {
        type: 'tool_use',
        id: 'tool-2',
        name: toolName,
        input: { path: '/some/file' },
      },
    ],
  },
});

// =============================================================================
// isSkillInvocation Tests
// =============================================================================

describe('isSkillInvocation', () => {
  it('returns true for entry with Skill tool_use', () => {
    const entry = createSkillToolUseEntry('commit');
    expect(isSkillInvocation(entry)).toBe(true);
  });

  it('returns false for entry with non-Skill tool_use', () => {
    const entry = createNonSkillToolUseEntry('Read');
    expect(isSkillInvocation(entry)).toBe(false);
  });

  it('returns false for user entry', () => {
    const entry = createUserEntry('run /commit');
    expect(isSkillInvocation(entry)).toBe(false);
  });

  it('returns false for assistant text entry', () => {
    const entry = createAssistantTextEntry('I will run the commit skill');
    expect(isSkillInvocation(entry)).toBe(false);
  });

  it('returns false for entry with no message', () => {
    const entry: SessionEntry = {
      type: 'system',
      uuid: 'test-uuid',
      timestamp: '2026-01-24T10:00:00Z',
    };
    expect(isSkillInvocation(entry)).toBe(false);
  });

  it('returns false for entry with empty content', () => {
    const entry: SessionEntry = {
      type: 'assistant',
      uuid: 'test-uuid',
      timestamp: '2026-01-24T10:00:00Z',
      message: {
        role: 'assistant',
        content: [],
      },
    };
    expect(isSkillInvocation(entry)).toBe(false);
  });

  it('handles entry with multiple tool_use blocks including Skill', () => {
    const entry: SessionEntry = {
      type: 'assistant',
      uuid: 'test-uuid',
      timestamp: '2026-01-24T10:00:00Z',
      message: {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Let me run some tools' },
          { type: 'tool_use', id: 't1', name: 'Read', input: { path: '/foo' } },
          { type: 'tool_use', id: 't2', name: 'Skill', input: { skill: 'commit' } },
        ],
      },
    };
    expect(isSkillInvocation(entry)).toBe(true);
  });
});

// =============================================================================
// extractSkillCommand Tests
// =============================================================================

describe('extractSkillCommand', () => {
  it('extracts skill name from Skill tool_use', () => {
    const entry = createSkillToolUseEntry('commit');
    expect(extractSkillCommand(entry)).toBe('commit');
  });

  it('extracts skill name with args', () => {
    const entry: SessionEntry = {
      type: 'assistant',
      uuid: 'test-uuid',
      timestamp: '2026-01-24T10:00:00Z',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'tool-1',
            name: 'Skill',
            input: { skill: 'review-pr', args: '123' },
          },
        ],
      },
    };
    expect(extractSkillCommand(entry)).toBe('review-pr');
  });

  it('returns null for non-Skill tool_use', () => {
    const entry = createNonSkillToolUseEntry('Read');
    expect(extractSkillCommand(entry)).toBeNull();
  });

  it('returns null for entry with no message', () => {
    const entry: SessionEntry = {
      type: 'system',
      uuid: 'test-uuid',
      timestamp: '2026-01-24T10:00:00Z',
    };
    expect(extractSkillCommand(entry)).toBeNull();
  });

  it('returns null for Skill tool_use with missing skill field', () => {
    const entry: SessionEntry = {
      type: 'assistant',
      uuid: 'test-uuid',
      timestamp: '2026-01-24T10:00:00Z',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'tool-1',
            name: 'Skill',
            input: { args: 'some-args' }, // Missing 'skill' field
          },
        ],
      },
    };
    expect(extractSkillCommand(entry)).toBeNull();
  });
});

// =============================================================================
// extractUserPromptContext Tests
// =============================================================================

describe('extractUserPromptContext', () => {
  it('extracts user prompt before skill invocation', () => {
    const entries: SessionEntry[] = [
      createUserEntry('Please run the commit skill'),
      createSkillToolUseEntry('commit'),
    ];
    const context = extractUserPromptContext(entries, 1);
    expect(context).toBe('Please run the commit skill');
  });

  it('returns empty string when no user entry before invocation', () => {
    const entries: SessionEntry[] = [
      createSkillToolUseEntry('commit'),
    ];
    const context = extractUserPromptContext(entries, 0);
    expect(context).toBe('');
  });

  it('skips non-user entries when looking backwards', () => {
    const entries: SessionEntry[] = [
      createUserEntry('Original user request'),
      createAssistantTextEntry('Let me help with that'),
      createSkillToolUseEntry('commit'),
    ];
    const context = extractUserPromptContext(entries, 2);
    expect(context).toBe('Original user request');
  });

  it('truncates long user prompts', () => {
    const longPrompt = 'A'.repeat(300);
    const entries: SessionEntry[] = [
      createUserEntry(longPrompt),
      createSkillToolUseEntry('commit'),
    ];
    const context = extractUserPromptContext(entries, 1, 200);
    expect(context.length).toBeLessThanOrEqual(200);
    expect(context.endsWith('...')).toBe(true);
  });

  it('handles entries with missing content', () => {
    const entries: SessionEntry[] = [
      {
        type: 'user',
        uuid: 'test-uuid',
        timestamp: '2026-01-24T09:59:00Z',
        message: {
          role: 'user',
          content: [], // Empty content
        },
      },
      createSkillToolUseEntry('commit'),
    ];
    const context = extractUserPromptContext(entries, 1);
    expect(context).toBe('');
  });
});

// =============================================================================
// detectSkillInvocations Tests
// =============================================================================

describe('detectSkillInvocations', () => {
  it('detects single skill invocation', () => {
    const entries: SessionEntry[] = [
      createUserEntry('Please commit my changes'),
      createSkillToolUseEntry('commit'),
    ];
    const invocations = detectSkillInvocations(entries, 'session-123');

    expect(invocations).toHaveLength(1);
    expect(invocations[0]?.skillName).toBe('commit');
    expect(invocations[0]?.sessionId).toBe('session-123');
    expect(invocations[0]?.userPromptSnippet).toBe('Please commit my changes');
  });

  it('detects multiple skill invocations', () => {
    const entries: SessionEntry[] = [
      createUserEntry('Run the tests'),
      createSkillToolUseEntry('test', '2026-01-24T10:00:00Z'),
      createUserEntry('Now commit the changes'),
      createSkillToolUseEntry('commit', '2026-01-24T10:01:00Z'),
    ];
    const invocations = detectSkillInvocations(entries, 'session-123');

    expect(invocations).toHaveLength(2);
    expect(invocations[0]?.skillName).toBe('test');
    expect(invocations[1]?.skillName).toBe('commit');
  });

  it('returns empty array when no skill invocations', () => {
    const entries: SessionEntry[] = [
      createUserEntry('Read the file'),
      createNonSkillToolUseEntry('Read'),
    ];
    const invocations = detectSkillInvocations(entries, 'session-123');

    expect(invocations).toHaveLength(0);
  });

  it('uses session ID from entry if available', () => {
    const entry = createSkillToolUseEntry('commit');
    entry.sessionId = 'entry-session-id';
    const entries: SessionEntry[] = [entry];

    const invocations = detectSkillInvocations(entries, 'fallback-session-id');
    expect(invocations[0]?.sessionId).toBe('entry-session-id');
  });

  it('includes file path when provided', () => {
    const entries: SessionEntry[] = [createSkillToolUseEntry('commit')];
    const invocations = detectSkillInvocations(entries, 'session-123', '/path/to/session.jsonl');

    expect(invocations[0]?.filePath).toBe('/path/to/session.jsonl');
  });
});

// =============================================================================
// isSkillToolUse Tests
// =============================================================================

describe('isSkillToolUse', () => {
  it('returns true for Skill tool_use block', () => {
    const block: ContentBlock = {
      type: 'tool_use',
      id: 'tool-1',
      name: 'Skill',
      input: { skill: 'commit' },
    };
    expect(isSkillToolUse(block)).toBe(true);
  });

  it('returns false for non-Skill tool_use block', () => {
    const block: ContentBlock = {
      type: 'tool_use',
      id: 'tool-1',
      name: 'Read',
      input: { path: '/foo' },
    };
    expect(isSkillToolUse(block)).toBe(false);
  });

  it('returns false for text block', () => {
    const block: ContentBlock = {
      type: 'text',
      text: 'Some text',
    };
    expect(isSkillToolUse(block)).toBe(false);
  });

  it('returns false for tool_result block', () => {
    const block: ContentBlock = {
      type: 'tool_result',
      tool_use_id: 'tool-1',
      content: 'Success',
    };
    expect(isSkillToolUse(block)).toBe(false);
  });
});
