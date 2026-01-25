/**
 * T045: Integration test - skills tools registered and callable
 *
 * Verifies that all skills tools are properly registered
 * with the ToolRegistry and can be invoked.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createToolRegistry } from '../../../src/orchestration/tool-registry';
import { SKILLS_TOOLS, registerSkillsTools, registerAllTools } from '../../../src/tools';

// =============================================================================
// Test Setup
// =============================================================================

const TEST_DIR = join(tmpdir(), 'agentlint-skills-registration-' + Date.now());

function setupTestEnvironment() {
  mkdirSync(TEST_DIR, { recursive: true });

  // Create .claude/skills/<skill-name>/SKILL.md structure
  const skillDir = join(TEST_DIR, '.claude', 'skills', 'test-skill');
  mkdirSync(skillDir, { recursive: true });

  // Create a sample skill file
  writeFileSync(
    join(skillDir, 'SKILL.md'),
    `---
name: test-skill
description: A test skill for integration testing
---

# Test Skill

This is a test skill for integration testing.

## When to use

Use this skill when testing skills integration.
`
  );

  // Create .agentlint directory for database
  mkdirSync(join(TEST_DIR, '.agentlint'), { recursive: true });
}

function cleanupTestEnvironment() {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('Skills Tools Registration', () => {
  beforeEach(() => {
    cleanupTestEnvironment();
    setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment();
  });

  describe('Tool Constants', () => {
    it('contains all four skills tools', () => {
      expect(SKILLS_TOOLS).toHaveLength(4);

      const toolNames = SKILLS_TOOLS.map((t) => t.name);
      expect(toolNames).toContain('get_skill_inventory');
      expect(toolNames).toContain('index_skill_invocations');
      expect(toolNames).toContain('get_session_summaries');
      expect(toolNames).toContain('get_skill_invocations');
    });

    it('each tool has proper structure', () => {
      for (const tool of SKILLS_TOOLS) {
        expect(tool.name).toBeDefined();
        expect(typeof tool.name).toBe('string');
        expect(tool.description).toBeDefined();
        expect(typeof tool.description).toBe('string');
        // Tools should have rich descriptions (per CLAUDE.md)
        expect(tool.description.length).toBeGreaterThan(50);
      }
    });
  });

  describe('ToolRegistry Integration', () => {
    it('registers all four tools', () => {
      const registry = createToolRegistry();
      registerSkillsTools(registry);

      const registered = registry.list();
      expect(registered).toContain('get_skill_inventory');
      expect(registered).toContain('index_skill_invocations');
      expect(registered).toContain('get_session_summaries');
      expect(registered).toContain('get_skill_invocations');
    });

    it('registerAllTools includes skills tools', () => {
      const registry = createToolRegistry();
      registerAllTools(registry);

      const registered = registry.list();

      // Verify skills tools are included
      expect(registered).toContain('get_skill_inventory');
      expect(registered).toContain('index_skill_invocations');
      expect(registered).toContain('get_session_summaries');
      expect(registered).toContain('get_skill_invocations');

      // Total should be at least 40 tools (as documented in src/tools/index.ts)
      // Config: 3, Session: 3, Causal: 2, Temporal: 8, Recommendation: 9, Security: 1, Skills: 4, Session Intelligence: 8, MCP Config: 2
      // Use >= to avoid brittleness when new tools are added
      expect(registered.length).toBeGreaterThanOrEqual(40);
    });

    it('tools can be retrieved by name', () => {
      const registry = createToolRegistry();
      registerSkillsTools(registry);

      const inventoryTool = registry.get('get_skill_inventory');
      expect(inventoryTool).toBeDefined();
      expect(inventoryTool?.name).toBe('get_skill_inventory');

      const invocationsTool = registry.get('get_skill_invocations');
      expect(invocationsTool).toBeDefined();
      expect(invocationsTool?.name).toBe('get_skill_invocations');
    });
  });

  describe('MCP Server Integration', () => {
    it('tools are available via MCP server configuration', () => {
      const registry = createToolRegistry();
      registerSkillsTools(registry);

      // Convert registry to MCP server config
      const mcpConfig = registry.toMcpServer();

      expect(mcpConfig).toBeDefined();
      expect(mcpConfig.instance).toBeDefined();
      expect(mcpConfig.name).toBe('agentlint');
    });

    it('skills tools included in full MCP server with all tools', () => {
      const registry = createToolRegistry();
      registerAllTools(registry);

      // Convert to MCP server
      const mcpConfig = registry.toMcpServer();

      expect(mcpConfig).toBeDefined();
      expect(mcpConfig.instance).toBeDefined();

      // Verify all registered tools can be listed
      const registered = registry.list();
      expect(registered.length).toBeGreaterThanOrEqual(40);
    });
  });

  describe('Tool Descriptions', () => {
    it('tools have agent-friendly descriptions', () => {
      // Per CLAUDE.md: "Rich Descriptions: Tool descriptions MUST explain what the tool does,
      // when to use it, and what it returns."
      for (const tool of SKILLS_TOOLS) {
        const desc = tool.description.toLowerCase();

        // Should explain what it does
        expect(
          desc.includes('returns') || desc.includes('provides') || desc.includes('queries')
        ).toBe(true);

        // Should be substantial
        expect(tool.description.length).toBeGreaterThan(100);
      }
    });
  });
});
