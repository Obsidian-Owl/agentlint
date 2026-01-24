/**
 * EP15 Session Intelligence - spawn_session_analyst Integration Tests
 *
 * Tests for the session analyst spawn tool.
 *
 * @module tests/integration/sessions/tools/spawn-session-analyst
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  spawnSessionAnalystTool,
  buildAnalysisContext,
  buildQueryPrompt,
} from '../../../../src/sessions/tools/spawn-session-analyst';
import {
  SESSION_ANALYST_TOOLS,
  type SessionAnalysisContext,
} from '../../../../src/sessions/subagent/types';
import { buildSessionAnalystAgent } from '../../../../src/sessions/subagent/session-analyst';
import type { AnalysisFocus } from '../../../../src/sessions/types';

describe('spawn_session_analyst integration', () => {
  let tempDir: string;
  let sessionFile: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'spawn-analyst-test-'));
    sessionFile = join(tempDir, 'test-session.jsonl');

    // Create a minimal session file
    const entries = [
      {
        type: 'user',
        timestamp: '2026-01-24T10:00:00Z',
        sessionId: 'test-session-123',
        message: { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
      },
      {
        type: 'assistant',
        timestamp: '2026-01-24T10:00:05Z',
        sessionId: 'test-session-123',
        message: { role: 'assistant', content: [{ type: 'text', text: 'Hi there!' }] },
      },
    ];

    await writeFile(sessionFile, entries.map((e) => JSON.stringify(e)).join('\n'));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Tool Definition', () => {
    it('should have correct tool name', () => {
      const toolDef = spawnSessionAnalystTool as unknown as { name: string };
      expect(toolDef.name).toBe('spawn_session_analyst');
    });

    it('should have informative description', () => {
      const toolDef = spawnSessionAnalystTool as unknown as { description: string };
      expect(toolDef.description).toContain('session analyst');
      expect(toolDef.description).toContain('workflow patterns');
      expect(toolDef.description).toContain('narrative');
    });

    it('should be defined', () => {
      expect(spawnSessionAnalystTool).toBeDefined();
    });
  });

  describe('Context Building', () => {
    it('should build context with required fields', async () => {
      const context = await buildAnalysisContext({
        sessionId: 'test-123',
        focus: 'narrative',
      });

      expect(context.sessionId).toBe('test-123');
      expect(context.focus).toBe('narrative');
      expect(context.sessionFileExists).toBe(false); // No file path provided
    });

    it('should detect existing session file', async () => {
      const context = await buildAnalysisContext({
        sessionId: 'test-session-123',
        filePath: sessionFile,
        focus: 'comprehensive',
      });

      expect(context.sessionFileExists).toBe(true);
      expect(context.sessionFilePath).toBe(sessionFile);
    });

    it('should handle non-existent session file', async () => {
      const context = await buildAnalysisContext({
        sessionId: 'test-123',
        filePath: '/nonexistent/path.jsonl',
        focus: 'flow',
      });

      expect(context.sessionFileExists).toBe(false);
    });

    it('should include comparison session if provided', async () => {
      const context = await buildAnalysisContext({
        sessionId: 'session-a',
        compareToSessionId: 'session-b',
        focus: 'quality',
      });

      expect(context.sessionId).toBe('session-a');
      expect(context.compareToSessionId).toBe('session-b');
    });

    it('should include query if provided', async () => {
      const context = await buildAnalysisContext({
        sessionId: 'test-123',
        query: 'Why did the test fail?',
        focus: 'quality',
      });

      expect(context.query).toBe('Why did the test fail?');
    });
  });

  describe('Query Prompt Building', () => {
    it('should build narrative-focused prompt', () => {
      const context: SessionAnalysisContext = {
        sessionId: 'test-123',
        focus: 'narrative',
        sessionFileExists: true,
      };
      const prompt = buildQueryPrompt('narrative', context);

      expect(prompt).toContain('Analyze session: test-123');
      expect(prompt).toContain('Focus: NARRATIVE ANALYSIS');
      expect(prompt).toContain('get_session_timeline');
    });

    it('should build flow-focused prompt', () => {
      const context: SessionAnalysisContext = {
        sessionId: 'test-123',
        focus: 'flow',
        sessionFileExists: true,
      };
      const prompt = buildQueryPrompt('flow', context);

      expect(prompt).toContain('Focus: FLOW ANALYSIS');
      expect(prompt).toContain('get_tool_sequences');
      expect(prompt).toContain('repeat patterns');
    });

    it('should build quality-focused prompt', () => {
      const context: SessionAnalysisContext = {
        sessionId: 'test-123',
        focus: 'quality',
        sessionFileExists: true,
      };
      const prompt = buildQueryPrompt('quality', context);

      expect(prompt).toContain('Focus: QUALITY ANALYSIS');
      expect(prompt).toContain('get_quality_signals');
      expect(prompt).toContain('get_mcp_usage');
    });

    it('should build comprehensive prompt', () => {
      const context: SessionAnalysisContext = {
        sessionId: 'test-123',
        focus: 'comprehensive',
        sessionFileExists: true,
      };
      const prompt = buildQueryPrompt('comprehensive', context);

      expect(prompt).toContain('Focus: COMPREHENSIVE ANALYSIS');
      expect(prompt).toContain('all available tools');
    });

    it('should include comparison session in prompt', () => {
      const context: SessionAnalysisContext = {
        sessionId: 'session-a',
        compareToSessionId: 'session-b',
        focus: 'comprehensive',
        sessionFileExists: true,
      };
      const prompt = buildQueryPrompt('comprehensive', context);

      expect(prompt).toContain('Compare to session: session-b');
    });

    it('should include user query in prompt', () => {
      const context: SessionAnalysisContext = {
        sessionId: 'test-123',
        query: 'Why did tests fail repeatedly?',
        focus: 'quality',
        sessionFileExists: true,
      };
      const prompt = buildQueryPrompt('quality', context);

      expect(prompt).toContain('User question: Why did tests fail repeatedly?');
      expect(prompt).toContain('Address this question directly');
    });
  });

  describe('Agent Definition', () => {
    it('should build valid agent definition', () => {
      const agent = buildSessionAnalystAgent();

      expect(agent.description).toBeDefined();
      expect(agent.prompt).toBeDefined();
      expect(agent.tools).toBeDefined();
    });

    it('should have correct tools count', () => {
      const agent = buildSessionAnalystAgent();
      const tools = agent.tools ?? [];

      expect(tools).toEqual([...SESSION_ANALYST_TOOLS]);
      expect(tools).toHaveLength(6); // 6 EP15 tools
    });

    it('should NOT include Task tool (C8 constraint)', () => {
      const agent = buildSessionAnalystAgent();
      const tools = agent.tools ?? [];

      expect(tools).not.toContain('Task');
    });

    it('should include all EP15 session intelligence tools', () => {
      const agent = buildSessionAnalystAgent();
      const tools = agent.tools ?? [];

      expect(tools).toContain('get_session_timeline');
      expect(tools).toContain('get_tool_sequences');
      expect(tools).toContain('get_file_accesses');
      expect(tools).toContain('get_delegation_events');
      expect(tools).toContain('get_quality_signals');
      expect(tools).toContain('get_mcp_usage');
    });

    it('should have informative description', () => {
      const agent = buildSessionAnalystAgent();

      expect(agent.description).toContain('session');
      expect(agent.description).toContain('workflow');
    });
  });

  describe('Session Analyst Prompt', () => {
    it('should follow 4-layer structure', () => {
      const agent = buildSessionAnalystAgent();
      const prompt = agent.prompt;

      expect(prompt).toContain('ROLE IDENTITY');
      expect(prompt).toContain('DOMAIN KNOWLEDGE');
      expect(prompt).toContain('YOUR TASK');
      expect(prompt).toContain('TOOLS AVAILABLE');
    });

    it('should include tool guidance', () => {
      const agent = buildSessionAnalystAgent();
      const prompt = agent.prompt;

      expect(prompt).toContain('get_session_timeline');
      expect(prompt).toContain('get_tool_sequences');
      expect(prompt).toContain('get_quality_signals');
    });

    it('should reference Constitution Principle VII', () => {
      const agent = buildSessionAnalystAgent();
      const prompt = agent.prompt;

      expect(prompt).toContain('Constitution');
      expect(prompt).toContain('DATA');
      expect(prompt).toContain('JUDGMENT');
    });

    it('should explain phase detection is agent interpretation', () => {
      const agent = buildSessionAnalystAgent();
      const prompt = agent.prompt;

      expect(prompt).toContain('YOUR INTERPRETATION');
      expect(prompt).toContain('exploration');
      expect(prompt).toContain('implementation');
      expect(prompt).toContain('debugging');
    });
  });

  describe('Constitution Compliance', () => {
    it('should not include Task tool in subagent tools (C8 constraint)', () => {
      // This is critical for Constitution Principle C8
      expect(SESSION_ANALYST_TOOLS).not.toContain('Task');
    });

    it('should provide data structures, not judgments', async () => {
      // The context contains session IDs and focus, not quality assessments
      const context = await buildAnalysisContext({
        sessionId: 'test-123',
        focus: 'quality',
      });

      // Context has identifiers, not judgments
      expect(context.sessionId).toBe('test-123');
      expect(context.focus).toBe('quality');
      // No "quality is good" or "session was successful"
      expect('quality' in context).toBeFalsy();
      expect('success' in context).toBeFalsy();
    });

    it('should let agent make quality judgments', () => {
      // The prompt instructs agent to make judgments
      const agent = buildSessionAnalystAgent();
      const prompt = agent.prompt;

      // Prompt explains what ARE agent judgments
      expect(prompt).toContain('phaseType');
      expect(prompt).toContain('sessionQuality');
      expect(prompt).toContain('isStuck');
      expect(prompt).toContain('YOUR interpretations');
    });
  });

  describe('Focus Options', () => {
    const focuses: AnalysisFocus[] = ['narrative', 'flow', 'quality', 'comprehensive'];

    it.each(focuses)('should handle %s focus', async (focus) => {
      const context = await buildAnalysisContext({
        sessionId: 'test-123',
        focus,
      });
      const prompt = buildQueryPrompt(focus, context);

      expect(context.focus).toBe(focus);
      expect(prompt).toContain(`Focus: ${focus.toUpperCase()}`);
    });
  });
});
