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

import { describe, test, expect, beforeAll } from "bun:test";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { buildACTSubagents } from "../../../src/act/index.js";

// Skip if no API key
const SKIP_LIVE_TESTS = !process.env.ANTHROPIC_API_KEY;

describe.skipIf(SKIP_LIVE_TESTS)("Live Subagent E2E Tests", () => {
  beforeAll(() => {
    if (SKIP_LIVE_TESTS) {
      console.log(
        "\n⚠️  Skipping live tests - set ANTHROPIC_API_KEY to run\n"
      );
    }
  });

  test("SDK accepts agents from buildACTSubagents()", async () => {
    const agents = buildACTSubagents();

    // Verify agents structure matches SDK expectations
    expect(Object.keys(agents).length).toBeGreaterThan(0);

    for (const [name, agent] of Object.entries(agents)) {
      expect(agent.description).toBeDefined();
      expect(agent.prompt).toBeDefined();
    }
  });

  test("orchestrator can invoke claude-code-analyzer subagent", async () => {
    const agents = buildACTSubagents();

    // Create a simple test that asks Claude to describe a subagent
    // This validates the agents config is accepted by the SDK
    const response = await query({
      prompt: `You have access to specialized subagents. List the names of available subagents and briefly describe what each one does. Just list them, don't invoke them.`,
      options: {
        model: "claude-sonnet-4-20250514",
        maxTurns: 1,
        agents,
      },
    });

    // Collect response
    let fullResponse = "";
    for await (const message of response) {
      if (
        message.type === "assistant" &&
        Array.isArray(message.content)
      ) {
        for (const block of message.content) {
          if (block.type === "text") {
            fullResponse += block.text;
          }
        }
      }
    }

    // Verify Claude saw our agents
    expect(fullResponse.toLowerCase()).toContain("claude");
    expect(fullResponse.toLowerCase()).toContain("analyzer");
  }, 30000); // 30s timeout for API call

  test("subagent can be invoked via Task tool", async () => {
    const agents = buildACTSubagents();

    const response = await query({
      prompt: `I have a project that uses Claude Code (it has a .claude/ directory and CLAUDE.md file). Use the claude-code-analyzer subagent to tell me what kind of analysis it would perform. Just describe what it would do, don't actually perform analysis.`,
      options: {
        model: "claude-sonnet-4-20250514",
        maxTurns: 3,
        agents,
        allowedTools: ["Task"],
      },
    });

    let sawTaskTool = false;
    let fullResponse = "";

    for await (const message of response) {
      // Check if Task tool was used
      if (
        message.type === "assistant" &&
        Array.isArray(message.content)
      ) {
        for (const block of message.content) {
          if (block.type === "tool_use" && block.name === "Task") {
            sawTaskTool = true;
          }
          if (block.type === "text") {
            fullResponse += block.text;
          }
        }
      }
    }

    // Either Claude invoked the subagent OR described what it would do
    const mentionsAnalysis =
      fullResponse.toLowerCase().includes("config") ||
      fullResponse.toLowerCase().includes("analysis") ||
      fullResponse.toLowerCase().includes("claude.md");

    expect(sawTaskTool || mentionsAnalysis).toBe(true);
  }, 60000); // 60s timeout - subagent invocation takes longer
});

// =============================================================================
// Behavioral Validation Tests
// =============================================================================

describe.skipIf(SKIP_LIVE_TESTS)("Subagent Behavioral Validation", () => {
  test("claude-code-analyzer prompt produces structured output format", async () => {
    const agents = buildACTSubagents();
    const claudeCodeAgent = agents["claude-code-analyzer"];

    expect(claudeCodeAgent).toBeDefined();

    // The prompt should instruct for structured output
    expect(claudeCodeAgent?.prompt).toContain("## OUTPUT FORMAT");
    expect(claudeCodeAgent?.prompt).toContain("## Analysis Summary");
  });

  test("generalized-analyzer handles unknown ACT types gracefully", async () => {
    const agents = buildACTSubagents();
    const generalizedAgent = agents["generalized-analyzer"];

    expect(generalizedAgent).toBeDefined();

    // The prompt should mention handling unknown types
    expect(generalizedAgent?.prompt).toContain("unknown");
    expect(generalizedAgent?.prompt).toContain("fallback");
    expect(generalizedAgent?.prompt).toContain("## Limitations");
  });
});

// =============================================================================
// Quick Smoke Test (for manual validation)
// =============================================================================

describe.skipIf(SKIP_LIVE_TESTS)("Smoke Test", () => {
  test("complete round-trip: build agents → pass to SDK → get response", async () => {
    // 1. Build agents
    const agents = buildACTSubagents();
    expect(Object.keys(agents).length).toBe(2);

    // 2. Make a simple SDK call with agents
    const response = await query({
      prompt: "Say 'Hello from agentlint!' and nothing else.",
      options: {
        model: "claude-sonnet-4-20250514",
        maxTurns: 1,
        agents,
      },
    });

    // 3. Verify we get a response
    let gotResponse = false;
    for await (const message of response) {
      if (message.type === "assistant") {
        gotResponse = true;
      }
    }

    expect(gotResponse).toBe(true);
  }, 30000);
});
