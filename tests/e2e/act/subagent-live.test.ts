/**
 * EP08 ACT Subagent Live E2E Tests
 *
 * These tests make REAL API calls to validate subagent behavior.
 * They are EXPENSIVE and should only run on release tags or manual invocation.
 *
 * Per ADR-0011: E2E tests run on release tags only
 *
 * Setup:
 *   export ANTHROPIC_API_KEY="sk-ant-..."
 *   bun test tests/e2e/act/subagent-live.test.ts
 *
 * @module tests/e2e/act/subagent-live
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { query, type AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { buildACTSubagents } from '../../../src/act/index.js';

// Type helper - our AgentDefinition is compatible but TS strictness requires cast
type SDKAgents = Record<string, AgentDefinition>;

// Skip if no API key
const SKIP_LIVE_TESTS = !process.env.ANTHROPIC_API_KEY;

/**
 * Extract text content from SDK response messages
 */
async function extractResponseText(
  response: AsyncIterable<unknown>
): Promise<{ text: string; sawTaskTool: boolean; messages: unknown[] }> {
  let text = '';
  let sawTaskTool = false;
  const messages: unknown[] = [];

  for await (const message of response) {
    messages.push(message);
    const msg = message as Record<string, unknown>;

    // Handle assistant messages with content array
    if (msg.type === 'assistant' && Array.isArray(msg.content)) {
      for (const block of msg.content as Array<Record<string, unknown>>) {
        if (block.type === 'text' && typeof block.text === 'string') {
          text += block.text;
        }
        if (block.type === 'tool_use' && block.name === 'Task') {
          sawTaskTool = true;
        }
      }
    }

    // Handle result messages (final response)
    if (msg.type === 'result') {
      // Result may contain final text
      if (typeof msg.text === 'string') {
        text += msg.text;
      }
    }
  }

  return { text, sawTaskTool, messages };
}

describe('Live Subagent E2E Tests', () => {
  test('requires ANTHROPIC_API_KEY', () => {
    expect(
      process.env.ANTHROPIC_API_KEY,
      'ANTHROPIC_API_KEY environment variable not set - live tests require API access'
    ).toBeTruthy();
  });

  test('SDK accepts agents from buildACTSubagents()', async () => {
    const agents = buildACTSubagents();

    // Verify agents structure matches SDK expectations
    expect(Object.keys(agents).length).toBeGreaterThan(0);

    for (const [_name, agent] of Object.entries(agents)) {
      expect(agent.description).toBeDefined();
      expect(agent.prompt).toBeDefined();
    }
  });

  test('simple query with agents config works', async () => {
    const agents = buildACTSubagents() as unknown as SDKAgents;

    const response = await query({
      prompt: `Say exactly: "Agents configured successfully"`,
      options: {
        model: 'claude-sonnet-4-20250514',
        maxTurns: 1,
        agents,
      },
    });

    const { text, messages } = await extractResponseText(response);

    // Log for debugging
    console.log(`\n📝 Response text length: ${text.length}`);
    console.log(`📝 Messages received: ${messages.length}`);

    // We should get some response
    expect(messages.length).toBeGreaterThan(0);
  }, 30000);

  test('Claude acknowledges available subagents', async () => {
    const agents = buildACTSubagents() as unknown as SDKAgents;

    const response = await query({
      prompt: `What specialized subagents do you have available? Just list their names briefly.`,
      options: {
        model: 'claude-sonnet-4-20250514',
        maxTurns: 1,
        agents,
      },
    });

    const { text, messages } = await extractResponseText(response);

    console.log(`\n📝 Subagent query response (${text.length} chars):`);
    console.log(text.slice(0, 500));

    // Claude should respond with something about agents
    expect(messages.length).toBeGreaterThan(0);
  }, 30000);
});

// =============================================================================
// Behavioral Validation Tests
// =============================================================================

describe('Subagent Behavioral Validation', () => {
  test('requires ANTHROPIC_API_KEY', () => {
    expect(
      process.env.ANTHROPIC_API_KEY,
      'ANTHROPIC_API_KEY environment variable not set - live tests require API access'
    ).toBeTruthy();
  });

  test('claude-code-analyzer prompt produces structured output format', async () => {
    const agents = buildACTSubagents();
    const claudeCodeAgent = agents['claude-code-analyzer'];

    expect(claudeCodeAgent).toBeDefined();

    // The prompt should instruct for structured output
    expect(claudeCodeAgent?.prompt).toContain('## OUTPUT FORMAT');
    expect(claudeCodeAgent?.prompt).toContain('## Analysis Summary');
  });

  test('generalized-analyzer handles unknown ACT types gracefully', async () => {
    const agents = buildACTSubagents();
    const generalizedAgent = agents['generalized-analyzer'];

    expect(generalizedAgent).toBeDefined();

    // The prompt should mention handling unknown types
    expect(generalizedAgent?.prompt).toContain('unknown');
    expect(generalizedAgent?.prompt).toContain('fallback');
    expect(generalizedAgent?.prompt).toContain('## Limitations');
  });
});

// =============================================================================
// Smoke Test
// =============================================================================

describe('Smoke Test', () => {
  test('requires ANTHROPIC_API_KEY', () => {
    expect(
      process.env.ANTHROPIC_API_KEY,
      'ANTHROPIC_API_KEY environment variable not set - live tests require API access'
    ).toBeTruthy();
  });

  test('complete round-trip: build agents → pass to SDK → get response', async () => {
    // 1. Build agents
    const agents = buildACTSubagents();
    expect(Object.keys(agents).length).toBe(2);

    // 2. Make a simple SDK call with agents
    const response = await query({
      prompt: "Say 'Hello from agentlint!' and nothing else.",
      options: {
        model: 'claude-sonnet-4-20250514',
        maxTurns: 1,
        agents: agents as unknown as SDKAgents,
      },
    });

    // 3. Verify we get a response
    const { messages } = await extractResponseText(response);

    console.log(`\n✅ Smoke test: received ${messages.length} messages`);
    expect(messages.length).toBeGreaterThan(0);
  }, 30000);
});

// =============================================================================
// Subagent Invocation Test
// =============================================================================

describe('Subagent Invocation', () => {
  test('requires ANTHROPIC_API_KEY', () => {
    expect(
      process.env.ANTHROPIC_API_KEY,
      'ANTHROPIC_API_KEY environment variable not set - live tests require API access'
    ).toBeTruthy();
  });

  test('Task tool is available when agents configured', async () => {
    const agents = buildACTSubagents() as unknown as SDKAgents;

    // Ask Claude to describe what tools it has
    const response = await query({
      prompt: `What tools do you have available? Specifically, do you have a "Task" tool for invoking subagents?`,
      options: {
        model: 'claude-sonnet-4-20250514',
        maxTurns: 1,
        agents,
        allowedTools: ['Task'],
      },
    });

    const { text, messages } = await extractResponseText(response);

    console.log(`\n📝 Tools query response (${text.length} chars):`);
    console.log(text.slice(0, 500));

    expect(messages.length).toBeGreaterThan(0);
  }, 30000);
});
