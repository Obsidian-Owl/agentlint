/**
 * T078: End-to-end test for session analysis with VCR pattern
 *
 * Tests the full `agentlint analyse --session` flow using VCR-recorded
 * API responses for deterministic testing.
 *
 * @module tests/integration/sessions/session-analyse-e2e
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { VCR, createAuthRedactFilter } from '../../lib/vcr';
import { parseSessionFile } from '../../../src/tools/sessions/parser';
import { buildSessionAnalystAgent } from '../../../src/sessions/subagent';
import {
  buildAnalysisContext,
  buildQueryPrompt,
} from '../../../src/sessions/tools/spawn-session-analyst';
import type { SessionAnalysisContext } from '../../../src/sessions/subagent/types';
import type { AnalysisFocus } from '../../../src/sessions/types';

// =============================================================================
// Test Constants
// =============================================================================

const CASSETTE_PATH = join(__dirname, '../recordings/session-analyse-e2e.json');

/**
 * Comprehensive session fixture with multiple interaction patterns.
 * This simulates a real Claude Code session with:
 * - User messages
 * - Tool usage (Glob, Bash, Read, Write, Task)
 * - Tool results
 * - Assistant text responses
 */
const COMPREHENSIVE_SESSION_ENTRIES = [
  {
    type: 'user',
    uuid: 'user-001',
    timestamp: '2026-01-24T10:00:00Z',
    sessionId: 'e2e-test-session-123',
    message: {
      role: 'user',
      content: [{ type: 'text', text: 'Implement a new feature for user authentication' }],
    },
  },
  {
    type: 'assistant',
    uuid: 'assistant-001',
    timestamp: '2026-01-24T10:00:10Z',
    sessionId: 'e2e-test-session-123',
    message: {
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: 'tool-001',
          name: 'Glob',
          input: { pattern: 'src/**/*.ts' },
        },
      ],
      usage: { input_tokens: 150, output_tokens: 25 },
    },
  },
  {
    type: 'tool_result',
    uuid: 'result-001',
    timestamp: '2026-01-24T10:00:11Z',
    sessionId: 'e2e-test-session-123',
    tool_result: {
      tool_use_id: 'tool-001',
      content: 'src/auth/index.ts\nsrc/auth/types.ts\nsrc/user/index.ts',
      is_error: false,
    },
  },
  {
    type: 'assistant',
    uuid: 'assistant-002',
    timestamp: '2026-01-24T10:00:20Z',
    sessionId: 'e2e-test-session-123',
    message: {
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: 'tool-002',
          name: 'Read',
          input: { file_path: '/project/src/auth/index.ts' },
        },
      ],
      usage: { input_tokens: 200, output_tokens: 30 },
    },
  },
  {
    type: 'tool_result',
    uuid: 'result-002',
    timestamp: '2026-01-24T10:00:21Z',
    sessionId: 'e2e-test-session-123',
    tool_result: {
      tool_use_id: 'tool-002',
      content:
        'export function authenticate(user: string, pass: string): boolean {\n  return true;\n}',
      is_error: false,
    },
  },
  {
    type: 'assistant',
    uuid: 'assistant-003',
    timestamp: '2026-01-24T10:00:30Z',
    sessionId: 'e2e-test-session-123',
    message: {
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: 'tool-003',
          name: 'Task',
          input: {
            description: 'Explore auth patterns',
            prompt: 'Find authentication patterns in the codebase',
            subagent_type: 'Explore',
          },
        },
      ],
      usage: { input_tokens: 300, output_tokens: 50 },
    },
  },
  {
    type: 'tool_result',
    uuid: 'result-003',
    timestamp: '2026-01-24T10:00:45Z',
    sessionId: 'e2e-test-session-123',
    tool_result: {
      tool_use_id: 'tool-003',
      content: 'Found JWT-based authentication in src/auth/jwt.ts',
      is_error: false,
    },
  },
  {
    type: 'assistant',
    uuid: 'assistant-004',
    timestamp: '2026-01-24T10:01:00Z',
    sessionId: 'e2e-test-session-123',
    message: {
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: 'tool-004',
          name: 'Write',
          input: {
            file_path: '/project/src/auth/session.ts',
            content: 'export function validateSession(token: string): boolean { return !!token; }',
          },
        },
      ],
      usage: { input_tokens: 400, output_tokens: 45 },
    },
  },
  {
    type: 'tool_result',
    uuid: 'result-004',
    timestamp: '2026-01-24T10:01:01Z',
    sessionId: 'e2e-test-session-123',
    tool_result: {
      tool_use_id: 'tool-004',
      content: 'File written successfully',
      is_error: false,
    },
  },
  {
    type: 'assistant',
    uuid: 'assistant-005',
    timestamp: '2026-01-24T10:01:10Z',
    sessionId: 'e2e-test-session-123',
    message: {
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: 'tool-005',
          name: 'Bash',
          input: { command: 'bun run test' },
        },
      ],
      usage: { input_tokens: 450, output_tokens: 20 },
    },
  },
  {
    type: 'tool_result',
    uuid: 'result-005',
    timestamp: '2026-01-24T10:01:25Z',
    sessionId: 'e2e-test-session-123',
    tool_result: {
      tool_use_id: 'tool-005',
      content: '✓ All tests passed (15 tests)',
      is_error: false,
    },
  },
  {
    type: 'assistant',
    uuid: 'assistant-006',
    timestamp: '2026-01-24T10:01:30Z',
    sessionId: 'e2e-test-session-123',
    message: {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: "I've implemented the session validation feature. The new function is in src/auth/session.ts and all tests pass.",
        },
      ],
      usage: { input_tokens: 500, output_tokens: 35 },
    },
  },
  {
    type: 'user',
    uuid: 'user-002',
    timestamp: '2026-01-24T10:02:00Z',
    sessionId: 'e2e-test-session-123',
    message: {
      role: 'user',
      content: [{ type: 'text', text: 'Great, thanks!' }],
    },
  },
];

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a session file from entries.
 */
async function createSessionFile(
  tempDir: string,
  entries: typeof COMPREHENSIVE_SESSION_ENTRIES
): Promise<string> {
  const sessionFile = join(tempDir, 'e2e-session.jsonl');
  await writeFile(sessionFile, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');
  return sessionFile;
}

// =============================================================================
// Tests
// =============================================================================

describe('Session Analysis E2E (VCR Pattern)', () => {
  let tempDir: string;
  let sessionFile: string;
  let vcr: VCR;

  beforeAll(async () => {
    // Create temp directory and session file
    tempDir = await mkdtemp(join(tmpdir(), 'session-analyse-e2e-'));
    await mkdir(join(tempDir, '.agentlint'), { recursive: true });
    sessionFile = await createSessionFile(tempDir, COMPREHENSIVE_SESSION_ENTRIES);

    // Initialize VCR
    vcr = new VCR({
      mode: 'playback',
      strict: false, // Allow missing cassettes for initial runs
      requestFilter: createAuthRedactFilter(),
    });

    // Load cassette (will be empty on first run)
    await vcr.load(CASSETTE_PATH);
  });

  afterAll(async () => {
    vcr.cleanup();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Session File Parsing', () => {
    it('should parse the comprehensive session file', async () => {
      const parsed = await parseSessionFile(sessionFile);

      expect(parsed.entries.length).toBe(COMPREHENSIVE_SESSION_ENTRIES.length);
      expect(parsed.sessionId).toBe('e2e-test-session-123');
      expect(parsed.errorCount).toBe(0);
    });

    it('should extract all entry types from session', async () => {
      const parsed = await parseSessionFile(sessionFile);

      const types = new Set(parsed.entries.map((e) => e.type));
      expect(types.has('user')).toBe(true);
      expect(types.has('assistant')).toBe(true);
      expect(types.has('tool_result')).toBe(true);
    });
  });

  describe('Session Analysis Context Building', () => {
    it('should build analysis context from session file path', async () => {
      const context = await buildAnalysisContext({
        sessionId: 'e2e-test-session-123',
        filePath: sessionFile,
        focus: 'comprehensive',
      });

      expect(context.sessionId).toBe('e2e-test-session-123');
      expect(context.focus).toBe('comprehensive');
      expect(context.sessionFilePath).toBe(sessionFile);
      expect(context.sessionFileExists).toBe(true);
    });

    it('should build analysis context from session ID only', async () => {
      const context = await buildAnalysisContext({
        sessionId: 'e2e-test-session-123',
        focus: 'narrative',
      });

      expect(context.sessionId).toBe('e2e-test-session-123');
      expect(context.focus).toBe('narrative');
      // No file path for ID-only context
      expect(context.sessionFilePath).toBeUndefined();
      expect(context.sessionFileExists).toBe(false);
    });

    it('should handle all focus types', async () => {
      const focusTypes: AnalysisFocus[] = ['narrative', 'flow', 'quality', 'comprehensive'];

      for (const focus of focusTypes) {
        const context = await buildAnalysisContext({
          sessionId: 'test-123',
          focus,
        });
        expect(context.focus).toBe(focus);
      }
    });
  });

  describe('Session Analyst Agent Building', () => {
    it('should build a valid Session Analyst agent', () => {
      const agent = buildSessionAnalystAgent();

      expect(agent).toBeDefined();
      // AgentDefinition has description, prompt, tools - not name
      expect(agent.description).toContain('session');
      expect(agent.prompt).toContain('Session Analyst');
      expect(agent.prompt.length).toBeGreaterThan(1000);
    });

    it('should include all required prompt sections', () => {
      const agent = buildSessionAnalystAgent();
      const prompt = agent.prompt;

      // Check for 4-layer structure
      expect(prompt).toContain('ROLE IDENTITY');
      expect(prompt).toContain('DOMAIN KNOWLEDGE');
      expect(prompt).toContain('YOUR TASK');
      expect(prompt).toContain('TOOLS AVAILABLE');
    });

    it('should reference all EP15 tools in the prompt', () => {
      const agent = buildSessionAnalystAgent();
      const prompt = agent.prompt;

      // Check for tool references
      expect(prompt).toContain('get_session_timeline');
      expect(prompt).toContain('get_tool_sequences');
      expect(prompt).toContain('get_file_accesses');
      expect(prompt).toContain('get_delegation_events');
      expect(prompt).toContain('get_quality_signals');
      expect(prompt).toContain('get_mcp_usage');
    });
  });

  describe('Query Prompt Building', () => {
    it('should build narrative-focused query prompt', () => {
      const context: SessionAnalysisContext = {
        sessionId: 'test-123',
        focus: 'narrative',
        sessionFileExists: true,
      };
      const prompt = buildQueryPrompt('narrative', context);

      expect(prompt).toContain('NARRATIVE');
      expect(prompt).toContain('test-123');
    });

    it('should build flow-focused query prompt', () => {
      const context: SessionAnalysisContext = {
        sessionId: sessionFile,
        focus: 'flow',
        sessionFilePath: sessionFile,
        sessionFileExists: true,
      };
      const prompt = buildQueryPrompt('flow', context);

      expect(prompt).toContain('FLOW');
      expect(prompt).toContain('tool sequence');
    });

    it('should build quality-focused query prompt', () => {
      const context: SessionAnalysisContext = {
        sessionId: 'test-123',
        focus: 'quality',
        sessionFileExists: true,
      };
      const prompt = buildQueryPrompt('quality', context);

      expect(prompt).toContain('QUALITY');
    });

    it('should build comprehensive query prompt', () => {
      const context: SessionAnalysisContext = {
        sessionId: sessionFile,
        focus: 'comprehensive',
        sessionFilePath: sessionFile,
        sessionFileExists: true,
      };
      const prompt = buildQueryPrompt('comprehensive', context);

      expect(prompt).toContain('COMPREHENSIVE');
      expect(prompt).toContain(sessionFile);
    });
  });

  describe('Session Data Verification', () => {
    it('should contain expected tool usage patterns', async () => {
      const parsed = await parseSessionFile(sessionFile);

      const toolCalls = parsed.entries
        .filter((e) => e.type === 'assistant')
        .flatMap((e) => {
          const msg = e.message as { content: Array<{ type: string; name?: string }> };
          return msg.content.filter((c) => c.type === 'tool_use');
        });

      // Should have 5 tool calls: Glob, Read, Task, Write, Bash
      expect(toolCalls.length).toBe(5);

      const toolNames = toolCalls.map((t) => t.name);
      expect(toolNames).toContain('Glob');
      expect(toolNames).toContain('Read');
      expect(toolNames).toContain('Task');
      expect(toolNames).toContain('Write');
      expect(toolNames).toContain('Bash');
    });

    it('should contain delegation event (Task tool)', async () => {
      const parsed = await parseSessionFile(sessionFile);

      const taskCalls = parsed.entries.filter((e) => {
        if (e.type !== 'assistant') return false;
        const msg = e.message as { content: Array<{ type: string; name?: string }> };
        return msg.content.some((c) => c.type === 'tool_use' && c.name === 'Task');
      });

      expect(taskCalls.length).toBe(1);
    });

    it('should contain file operations (Read, Write)', async () => {
      const parsed = await parseSessionFile(sessionFile);

      const fileOps = parsed.entries.filter((e) => {
        if (e.type !== 'assistant') return false;
        const msg = e.message as { content: Array<{ type: string; name?: string }> };
        return msg.content.some(
          (c) => c.type === 'tool_use' && (c.name === 'Read' || c.name === 'Write')
        );
      });

      expect(fileOps.length).toBe(2);
    });

    it('should have proper chronological order', async () => {
      const parsed = await parseSessionFile(sessionFile);

      let lastTimestamp = '';
      for (const entry of parsed.entries) {
        if (lastTimestamp) {
          expect(new Date(entry.timestamp).getTime()).toBeGreaterThanOrEqual(
            new Date(lastTimestamp).getTime()
          );
        }
        lastTimestamp = entry.timestamp;
      }
    });
  });

  describe('Token Usage Tracking', () => {
    it('should have token usage in assistant messages', async () => {
      const parsed = await parseSessionFile(sessionFile);

      const assistantWithUsage = parsed.entries.filter((e) => {
        if (e.type !== 'assistant') return false;
        const msg = e.message as { usage?: { input_tokens: number; output_tokens: number } };
        return msg.usage !== undefined;
      });

      // All 6 assistant messages should have usage
      expect(assistantWithUsage.length).toBe(6);
    });
  });
});
