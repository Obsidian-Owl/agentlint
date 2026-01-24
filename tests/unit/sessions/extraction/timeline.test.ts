/**
 * Unit tests for session timeline extraction
 *
 * Tests intent extraction and outcome signal extraction from session entries.
 *
 * @module tests/unit/sessions/extraction/timeline.test.ts
 */

import { describe, it, expect } from 'bun:test';
import type { SessionEntry } from '../../../../src/tools/sessions/types';
import {
  extractIntent,
  extractOutcome,
  extractSessionTimeline,
} from '../../../../src/sessions/extraction/timeline';

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Create a minimal user entry for testing.
 */
function createUserEntry(content: string, timestamp: string, lineNumber: number = 1): SessionEntry {
  return {
    type: 'user',
    uuid: `user-${lineNumber}`,
    timestamp,
    lineNumber,
    message: {
      role: 'user',
      content: [{ type: 'text', text: content }],
    },
  };
}

/**
 * Create a minimal assistant entry for testing.
 */
function createAssistantEntry(
  timestamp: string,
  lineNumber: number = 2,
  toolUseBlocks: Array<{ name: string; input: Record<string, unknown> }> = []
): SessionEntry {
  const content: Array<
    | { type: 'text'; text: string }
    | { type: 'tool_use'; name: string; input: Record<string, unknown> }
  > = [];

  if (toolUseBlocks.length === 0) {
    content.push({ type: 'text', text: 'Assistant response' });
  } else {
    for (const tool of toolUseBlocks) {
      content.push({ type: 'tool_use', name: tool.name, input: tool.input });
    }
  }

  return {
    type: 'assistant',
    uuid: `assistant-${lineNumber}`,
    timestamp,
    lineNumber,
    message: {
      role: 'assistant',
      content,
    },
  };
}

/**
 * Create a tool result entry.
 */
function createToolResultEntry(
  toolUseId: string,
  content: string,
  isError: boolean,
  timestamp: string,
  lineNumber: number
): SessionEntry {
  return {
    type: 'tool_result',
    uuid: `tool-result-${lineNumber}`,
    timestamp,
    lineNumber,
    toolResult: {
      toolUseId,
      content,
      isError,
    },
  };
}

// =============================================================================
// Intent Extraction Tests (T017)
// =============================================================================

describe('extractIntent', () => {
  it('should extract intent from first user message', () => {
    const entries: SessionEntry[] = [
      createUserEntry('Help me fix the login bug', '2026-01-24T00:00:00Z', 1),
      createAssistantEntry('2026-01-24T00:00:01Z', 2),
      createUserEntry('Second message', '2026-01-24T00:00:02Z', 3),
    ];

    const intent = extractIntent(entries);

    expect(intent.firstUserPrompt).toBe('Help me fix the login bug');
    expect(intent.timestamp).toBe('2026-01-24T00:00:00Z');
    expect(intent.promptLength).toBe(25);
  });

  it('should handle multi-line user prompts', () => {
    const entries: SessionEntry[] = [
      createUserEntry('First line\nSecond line\nThird line', '2026-01-24T00:00:00Z', 1),
    ];

    const intent = extractIntent(entries);

    expect(intent.firstUserPrompt).toBe('First line\nSecond line\nThird line');
    expect(intent.promptLength).toBe(33);
  });

  it('should return empty intent when no user messages', () => {
    const entries: SessionEntry[] = [createAssistantEntry('2026-01-24T00:00:00Z', 1)];

    const intent = extractIntent(entries);

    expect(intent.firstUserPrompt).toBe('');
    expect(intent.timestamp).toBe('');
    expect(intent.promptLength).toBe(0);
  });

  it('should skip system and summary entries to find first user', () => {
    const entries: SessionEntry[] = [
      {
        type: 'system',
        uuid: 'system-1',
        timestamp: '2026-01-24T00:00:00Z',
        lineNumber: 1,
      },
      {
        type: 'summary',
        uuid: 'summary-1',
        timestamp: '2026-01-24T00:00:01Z',
        lineNumber: 2,
      },
      createUserEntry('Actual first user message', '2026-01-24T00:00:02Z', 3),
    ];

    const intent = extractIntent(entries);

    expect(intent.firstUserPrompt).toBe('Actual first user message');
  });

  it('should handle user entry without message content', () => {
    const entries: SessionEntry[] = [
      {
        type: 'user',
        uuid: 'user-1',
        timestamp: '2026-01-24T00:00:00Z',
        lineNumber: 1,
        // No message field
      },
    ];

    const intent = extractIntent(entries);

    expect(intent.firstUserPrompt).toBe('');
    expect(intent.promptLength).toBe(0);
  });

  it('should concatenate multiple text blocks in user message', () => {
    const entries: SessionEntry[] = [
      {
        type: 'user',
        uuid: 'user-1',
        timestamp: '2026-01-24T00:00:00Z',
        lineNumber: 1,
        message: {
          role: 'user',
          content: [
            { type: 'text', text: 'Part one. ' },
            { type: 'text', text: 'Part two.' },
          ],
        },
      },
    ];

    const intent = extractIntent(entries);

    expect(intent.firstUserPrompt).toBe('Part one. Part two.');
    expect(intent.promptLength).toBe(19);
  });
});

// =============================================================================
// Outcome Extraction Tests (T018)
// =============================================================================

describe('extractOutcome', () => {
  describe('lastUserPrompt', () => {
    it('should extract last user message', () => {
      const entries: SessionEntry[] = [
        createUserEntry('First message', '2026-01-24T00:00:00Z', 1),
        createAssistantEntry('2026-01-24T00:00:01Z', 2),
        createUserEntry('Last message', '2026-01-24T00:00:02Z', 3),
        createAssistantEntry('2026-01-24T00:00:03Z', 4),
      ];

      const outcome = extractOutcome(entries);

      expect(outcome.lastUserPrompt).toBe('Last message');
    });

    it('should return null when no user messages', () => {
      const entries: SessionEntry[] = [createAssistantEntry('2026-01-24T00:00:00Z', 1)];

      const outcome = extractOutcome(entries);

      expect(outcome.lastUserPrompt).toBeNull();
    });
  });

  describe('lastToolCall', () => {
    it('should extract last tool call from assistant', () => {
      const entries: SessionEntry[] = [
        createUserEntry('Fix the bug', '2026-01-24T00:00:00Z', 1),
        createAssistantEntry('2026-01-24T00:00:01Z', 2, [
          { name: 'Read', input: { file_path: '/src/index.ts' } },
        ]),
        createToolResultEntry('tool-1', 'File contents...', false, '2026-01-24T00:00:02Z', 3),
        createAssistantEntry('2026-01-24T00:00:03Z', 4, [
          { name: 'Edit', input: { file_path: '/src/index.ts' } },
        ]),
        createToolResultEntry('tool-2', 'Edit successful', false, '2026-01-24T00:00:04Z', 5),
      ];

      const outcome = extractOutcome(entries);

      expect(outcome.lastToolCall).not.toBeNull();
      expect(outcome.lastToolCall?.name).toBe('Edit');
      expect(outcome.lastToolCall?.success).toBe(true);
    });

    it('should detect failed tool call', () => {
      const entries: SessionEntry[] = [
        createUserEntry('Run the build', '2026-01-24T00:00:00Z', 1),
        createAssistantEntry('2026-01-24T00:00:01Z', 2, [
          { name: 'Bash', input: { command: 'npm run build' } },
        ]),
        createToolResultEntry('tool-1', 'Error: Build failed', true, '2026-01-24T00:00:02Z', 3),
      ];

      const outcome = extractOutcome(entries);

      expect(outcome.lastToolCall?.name).toBe('Bash');
      expect(outcome.lastToolCall?.success).toBe(false);
    });

    it('should return null when no tool calls', () => {
      const entries: SessionEntry[] = [
        createUserEntry('Hello', '2026-01-24T00:00:00Z', 1),
        createAssistantEntry('2026-01-24T00:00:01Z', 2),
      ];

      const outcome = extractOutcome(entries);

      expect(outcome.lastToolCall).toBeNull();
    });
  });

  describe('hasCommitActivity', () => {
    it('should detect git commit in Bash command', () => {
      const entries: SessionEntry[] = [
        createUserEntry('Commit the changes', '2026-01-24T00:00:00Z', 1),
        createAssistantEntry('2026-01-24T00:00:01Z', 2, [
          { name: 'Bash', input: { command: 'git commit -m "Fix bug"' } },
        ]),
        createToolResultEntry('tool-1', 'Committed', false, '2026-01-24T00:00:02Z', 3),
      ];

      const outcome = extractOutcome(entries);

      expect(outcome.hasCommitActivity).toBe(true);
    });

    it('should detect git push activity', () => {
      const entries: SessionEntry[] = [
        createUserEntry('Push to remote', '2026-01-24T00:00:00Z', 1),
        createAssistantEntry('2026-01-24T00:00:01Z', 2, [
          { name: 'Bash', input: { command: 'git push origin main' } },
        ]),
        createToolResultEntry('tool-1', 'Pushed', false, '2026-01-24T00:00:02Z', 3),
      ];

      const outcome = extractOutcome(entries);

      expect(outcome.hasCommitActivity).toBe(true);
    });

    it('should return false when no commit activity', () => {
      const entries: SessionEntry[] = [
        createUserEntry('Read the file', '2026-01-24T00:00:00Z', 1),
        createAssistantEntry('2026-01-24T00:00:01Z', 2, [
          { name: 'Read', input: { file_path: '/src/index.ts' } },
        ]),
        createToolResultEntry('tool-1', 'Contents...', false, '2026-01-24T00:00:02Z', 3),
      ];

      const outcome = extractOutcome(entries);

      expect(outcome.hasCommitActivity).toBe(false);
    });
  });

  describe('turnCount', () => {
    it('should count user-assistant turn pairs', () => {
      const entries: SessionEntry[] = [
        createUserEntry('Turn 1', '2026-01-24T00:00:00Z', 1),
        createAssistantEntry('2026-01-24T00:00:01Z', 2),
        createUserEntry('Turn 2', '2026-01-24T00:00:02Z', 3),
        createAssistantEntry('2026-01-24T00:00:03Z', 4),
        createUserEntry('Turn 3', '2026-01-24T00:00:04Z', 5),
        createAssistantEntry('2026-01-24T00:00:05Z', 6),
      ];

      const outcome = extractOutcome(entries);

      expect(outcome.turnCount).toBe(6);
    });
  });

  describe('signals.containsThanks', () => {
    it('should detect "thanks" in last user message', () => {
      const entries: SessionEntry[] = [
        createUserEntry('Fix the bug', '2026-01-24T00:00:00Z', 1),
        createAssistantEntry('2026-01-24T00:00:01Z', 2),
        createUserEntry('Thanks, that works!', '2026-01-24T00:00:02Z', 3),
      ];

      const outcome = extractOutcome(entries);

      expect(outcome.signals.containsThanks).toBe(true);
    });

    it('should detect "thank you" in last user message', () => {
      const entries: SessionEntry[] = [
        createUserEntry('Fix the bug', '2026-01-24T00:00:00Z', 1),
        createAssistantEntry('2026-01-24T00:00:01Z', 2),
        createUserEntry('Thank you!', '2026-01-24T00:00:02Z', 3),
      ];

      const outcome = extractOutcome(entries);

      expect(outcome.signals.containsThanks).toBe(true);
    });

    it('should be case-insensitive', () => {
      const entries: SessionEntry[] = [
        createUserEntry('Fix the bug', '2026-01-24T00:00:00Z', 1),
        createAssistantEntry('2026-01-24T00:00:01Z', 2),
        createUserEntry('THANKS', '2026-01-24T00:00:02Z', 3),
      ];

      const outcome = extractOutcome(entries);

      expect(outcome.signals.containsThanks).toBe(true);
    });

    it('should return false when no thanks', () => {
      const entries: SessionEntry[] = [
        createUserEntry('Fix the bug', '2026-01-24T00:00:00Z', 1),
        createAssistantEntry('2026-01-24T00:00:01Z', 2),
      ];

      const outcome = extractOutcome(entries);

      expect(outcome.signals.containsThanks).toBe(false);
    });
  });

  describe('signals.containsDone', () => {
    it('should detect "done" in last user message', () => {
      const entries: SessionEntry[] = [
        createUserEntry('Fix the bug', '2026-01-24T00:00:00Z', 1),
        createAssistantEntry('2026-01-24T00:00:01Z', 2),
        createUserEntry("That's done", '2026-01-24T00:00:02Z', 3),
      ];

      const outcome = extractOutcome(entries);

      expect(outcome.signals.containsDone).toBe(true);
    });

    it('should detect "that\'s it" in last user message', () => {
      const entries: SessionEntry[] = [
        createUserEntry('Fix the bug', '2026-01-24T00:00:00Z', 1),
        createAssistantEntry('2026-01-24T00:00:01Z', 2),
        createUserEntry("That's it, we're finished", '2026-01-24T00:00:02Z', 3),
      ];

      const outcome = extractOutcome(entries);

      expect(outcome.signals.containsDone).toBe(true);
    });

    it('should detect "perfect" in last user message', () => {
      const entries: SessionEntry[] = [
        createUserEntry('Fix the bug', '2026-01-24T00:00:00Z', 1),
        createAssistantEntry('2026-01-24T00:00:01Z', 2),
        createUserEntry('Perfect!', '2026-01-24T00:00:02Z', 3),
      ];

      const outcome = extractOutcome(entries);

      expect(outcome.signals.containsDone).toBe(true);
    });
  });

  describe('signals.endsWithError', () => {
    it('should detect error in last tool result', () => {
      const entries: SessionEntry[] = [
        createUserEntry('Run build', '2026-01-24T00:00:00Z', 1),
        createAssistantEntry('2026-01-24T00:00:01Z', 2, [
          { name: 'Bash', input: { command: 'npm run build' } },
        ]),
        createToolResultEntry('tool-1', 'Build failed', true, '2026-01-24T00:00:02Z', 3),
      ];

      const outcome = extractOutcome(entries);

      expect(outcome.signals.endsWithError).toBe(true);
    });

    it('should return false when last tool succeeded', () => {
      const entries: SessionEntry[] = [
        createUserEntry('Run build', '2026-01-24T00:00:00Z', 1),
        createAssistantEntry('2026-01-24T00:00:01Z', 2, [
          { name: 'Bash', input: { command: 'npm run build' } },
        ]),
        createToolResultEntry('tool-1', 'Build succeeded', false, '2026-01-24T00:00:02Z', 3),
      ];

      const outcome = extractOutcome(entries);

      expect(outcome.signals.endsWithError).toBe(false);
    });
  });

  describe('signals.hasUnresolvedError', () => {
    it('should detect unresolved error (error with no subsequent success)', () => {
      const entries: SessionEntry[] = [
        createUserEntry('Run tests', '2026-01-24T00:00:00Z', 1),
        createAssistantEntry('2026-01-24T00:00:01Z', 2, [
          { name: 'Bash', input: { command: 'npm test' } },
        ]),
        createToolResultEntry('tool-1', 'Tests failed', true, '2026-01-24T00:00:02Z', 3),
        createAssistantEntry('2026-01-24T00:00:03Z', 4), // Response but no fix
      ];

      const outcome = extractOutcome(entries);

      expect(outcome.signals.hasUnresolvedError).toBe(true);
    });

    it('should return false when error was resolved', () => {
      const entries: SessionEntry[] = [
        createUserEntry('Run tests', '2026-01-24T00:00:00Z', 1),
        createAssistantEntry('2026-01-24T00:00:01Z', 2, [
          { name: 'Bash', input: { command: 'npm test' } },
        ]),
        createToolResultEntry('tool-1', 'Tests failed', true, '2026-01-24T00:00:02Z', 3),
        createAssistantEntry('2026-01-24T00:00:03Z', 4, [
          { name: 'Edit', input: { file_path: '/src/fix.ts' } },
        ]),
        createToolResultEntry('tool-2', 'Fixed', false, '2026-01-24T00:00:04Z', 5),
        createAssistantEntry('2026-01-24T00:00:05Z', 6, [
          { name: 'Bash', input: { command: 'npm test' } },
        ]),
        createToolResultEntry('tool-3', 'Tests passed', false, '2026-01-24T00:00:06Z', 7),
      ];

      const outcome = extractOutcome(entries);

      expect(outcome.signals.hasUnresolvedError).toBe(false);
    });
  });
});

// =============================================================================
// Full Timeline Extraction Tests
// =============================================================================

describe('extractSessionTimeline', () => {
  it('should extract complete timeline from session entries', () => {
    const entries: SessionEntry[] = [
      {
        type: 'user',
        uuid: 'user-1',
        timestamp: '2026-01-24T00:00:00Z',
        lineNumber: 1,
        sessionId: 'session-123',
        message: {
          role: 'user',
          content: [{ type: 'text', text: 'Help me fix the login bug' }],
        },
      },
      createAssistantEntry('2026-01-24T00:00:01Z', 2, [
        { name: 'Read', input: { file_path: '/src/login.ts' } },
      ]),
      createToolResultEntry('tool-1', 'File contents', false, '2026-01-24T00:00:02Z', 3),
      createAssistantEntry('2026-01-24T00:00:03Z', 4, [
        { name: 'Edit', input: { file_path: '/src/login.ts' } },
      ]),
      createToolResultEntry('tool-2', 'Edit done', false, '2026-01-24T00:00:04Z', 5),
      createUserEntry('Thanks, that works!', '2026-01-24T00:00:05Z', 6),
      createAssistantEntry('2026-01-24T00:00:06Z', 7),
    ];

    const timeline = extractSessionTimeline(entries, {
      sessionId: 'session-123',
      projectPath: '/Users/test/project',
      totalInputTokens: 1000,
      totalOutputTokens: 500,
      cacheTokens: 200,
      compressionCount: 0,
    });

    expect(timeline.sessionId).toBe('session-123');
    expect(timeline.projectPath).toBe('/Users/test/project');
    expect(timeline.startTime).toBe('2026-01-24T00:00:00Z');
    expect(timeline.endTime).toBe('2026-01-24T00:00:06Z');
    expect(timeline.intent.firstUserPrompt).toBe('Help me fix the login bug');
    expect(timeline.outcome.lastUserPrompt).toBe('Thanks, that works!');
    expect(timeline.outcome.signals.containsThanks).toBe(true);
    expect(timeline.metrics.inputTokens).toBe(1000);
    expect(timeline.metrics.outputTokens).toBe(500);
  });

  it('should calculate duration in milliseconds', () => {
    const entries: SessionEntry[] = [
      createUserEntry('Start', '2026-01-24T00:00:00Z', 1),
      createAssistantEntry('2026-01-24T00:01:30Z', 2), // 90 seconds later
    ];

    const timeline = extractSessionTimeline(entries, {
      sessionId: 'session-456',
      projectPath: '/test',
      totalInputTokens: 0,
      totalOutputTokens: 0,
      cacheTokens: 0,
      compressionCount: 0,
    });

    expect(timeline.duration).toBe(90000); // 90 seconds in ms
  });
});
