/**
 * EP08 ACT Subagent Integration Tests
 *
 * Tests the full subagent integration with the orchestrator.
 * Uses mocked SDK responses for CI, can use live API for manual testing.
 *
 * Per ADR-0011: VCR integration tests run on pull requests
 *
 * @module tests/integration/act/subagent-integration
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { z } from 'zod';

// ACT module imports
import { buildACTSubagents, ACTSubagentRegistry } from '../../../src/act/index.js';
import { claudeCodeInstructions } from '../../../src/act/instructions/claude-code.js';
import { generalizedInstructions } from '../../../src/act/instructions/generalized.js';
import { bundledInstructions } from '../../../src/act/instructions/index.js';
import type { ACTInstructions } from '../../../src/act/types.js';

// Orchestration imports
import { Orchestrator } from '../../../src/orchestration/orchestrator.js';
import { ToolRegistry } from '../../../src/orchestration/tool-registry.js';
import { loadConfig } from '../../../src/orchestration/config.js';
import { createMockTool } from '../../utils/sdk-test-helpers.js';

// =============================================================================
// Test: Registry Integration
// =============================================================================

describe('ACT Registry Integration', () => {
  let registry: ACTSubagentRegistry;

  beforeEach(() => {
    registry = new ACTSubagentRegistry();
  });

  test('registers all bundled instructions without errors', () => {
    for (const instructions of bundledInstructions) {
      expect(() => registry.register(instructions)).not.toThrow();
    }

    expect(registry.list()).toHaveLength(bundledInstructions.length);
  });

  test('correctly routes claude-code ACT type to specialist', () => {
    for (const instructions of bundledInstructions) {
      registry.register(instructions);
    }

    const matched = registry.getForACTType('claude-code');
    expect(matched).toBeDefined();
    expect(matched?.name).toBe('claude-code-analyzer');
    expect(matched?.priority).toBe(100);
  });

  test('correctly routes unknown ACT type to generalized fallback', () => {
    for (const instructions of bundledInstructions) {
      registry.register(instructions);
    }

    const matched = registry.getForACTType('unknown');
    expect(matched).toBeDefined();
    expect(matched?.name).toBe('generalized-analyzer');
    expect(matched?.priority).toBe(10);
  });

  test('correctly routes agents-md to generalized', () => {
    for (const instructions of bundledInstructions) {
      registry.register(instructions);
    }

    const matched = registry.getForACTType('agents-md');
    expect(matched).toBeDefined();
    expect(matched?.name).toBe('generalized-analyzer');
  });

  test('priority ordering works - higher priority wins', () => {
    // Create two analyzers for the same type with different priorities
    const lowPriority: ACTInstructions = {
      ...claudeCodeInstructions,
      name: 'low-priority-analyzer',
      priority: 5,
    };

    const highPriority: ACTInstructions = {
      ...claudeCodeInstructions,
      name: 'high-priority-analyzer',
      priority: 95,
    };

    // Register low first, high second
    registry.register(lowPriority);
    registry.register(highPriority);

    const matched = registry.getForACTType('claude-code');
    expect(matched?.name).toBe('high-priority-analyzer');
  });
});

// =============================================================================
// Test: SDK Integration Format
// =============================================================================

describe('SDK Integration Format', () => {
  test('buildACTSubagents() returns valid SDK agents format', () => {
    const agents = buildACTSubagents();

    // Should have all bundled agents
    expect(Object.keys(agents)).toHaveLength(bundledInstructions.length);

    // Each agent should have required SDK fields
    for (const [name, agent] of Object.entries(agents)) {
      expect(typeof name).toBe('string');
      expect(name).toMatch(/^[a-z0-9-]+$/);

      // Required fields
      expect(agent.description).toBeDefined();
      expect(typeof agent.description).toBe('string');
      expect(agent.description.length).toBeGreaterThan(0);

      expect(agent.prompt).toBeDefined();
      expect(typeof agent.prompt).toBe('string');
      expect(agent.prompt.length).toBeGreaterThan(0);

      // Tools should be defined and not include Task
      if (agent.tools) {
        expect(Array.isArray(agent.tools)).toBe(true);
        expect(agent.tools).not.toContain('Task');
      }
    }
  });

  test('agent descriptions are suitable for Claude delegation', () => {
    const agents = buildACTSubagents();

    const claudeCodeAgent = agents['claude-code-analyzer'];
    expect(claudeCodeAgent?.description).toContain('Claude Code');

    const generalizedAgent = agents['generalized-analyzer'];
    expect(generalizedAgent?.description.toLowerCase()).toContain('fallback');
  });

  test('agent prompts follow context engineering structure', () => {
    const agents = buildACTSubagents();

    for (const agent of Object.values(agents)) {
      // All prompts should have the 4-layer structure
      expect(agent.prompt).toContain('## ROLE IDENTITY');
      expect(agent.prompt).toContain('## DOMAIN KNOWLEDGE');
      expect(agent.prompt).toContain('## YOUR TASK');
      expect(agent.prompt).toContain('## OUTPUT FORMAT');
    }
  });
});

// =============================================================================
// Test: Orchestrator Configuration
// =============================================================================

describe('Orchestrator ACT Configuration', () => {
  test('orchestrator config includes allowedTools with Task', () => {
    const config = loadConfig({});

    expect(config.allowedTools).toBeDefined();
    expect(config.allowedTools).toContain('Task');
  });

  test('orchestrator can be created with ACT-enabled config', () => {
    const toolRegistry = new ToolRegistry();
    toolRegistry.register(
      createMockTool(
        'discover_configs',
        'Discover configuration files',
        { path: z.string() },
        () => '[]'
      )
    );

    const config = loadConfig({
      allowedTools: ['Task', 'Read', 'Write'],
    });

    const orchestrator = new Orchestrator(config, toolRegistry);

    expect(orchestrator.config.allowedTools).toContain('Task');
    expect(orchestrator.depth).toBe(0);
    expect(orchestrator.canSpawnSubagent()).toBe(true);
  });

  test('subagent config has incremented depth', () => {
    const toolRegistry = new ToolRegistry();
    const orchestrator = new Orchestrator({}, toolRegistry);

    const subConfig = orchestrator.getSubagentConfig();

    expect(subConfig.depth).toBe(1);
    expect(orchestrator.depth).toBe(0);
  });

  test('depth=1 orchestrator cannot spawn further subagents', () => {
    const toolRegistry = new ToolRegistry();
    const orchestrator = new Orchestrator({ depth: 1 }, toolRegistry);

    expect(orchestrator.canSpawnSubagent()).toBe(false);
  });
});

// =============================================================================
// Test: Tool Constraints
// =============================================================================

describe('Subagent Tool Constraints', () => {
  test('claude-code-analyzer has 5 default tools', () => {
    expect(claudeCodeInstructions.tools).toHaveLength(5);
    expect(claudeCodeInstructions.tools).toContain('discover_configs');
    expect(claudeCodeInstructions.tools).toContain('parse_config');
    expect(claudeCodeInstructions.tools).toContain('analyze_hierarchy');
    expect(claudeCodeInstructions.tools).toContain('search_sessions');
    expect(claudeCodeInstructions.tools).toContain('get_session_stats');
  });

  test('generalized-analyzer has 2 limited tools', () => {
    expect(generalizedInstructions.tools).toHaveLength(2);
    expect(generalizedInstructions.tools).toContain('discover_configs');
    expect(generalizedInstructions.tools).toContain('parse_config');

    // Should NOT have session tools
    expect(generalizedInstructions.tools).not.toContain('search_sessions');
    expect(generalizedInstructions.tools).not.toContain('get_session_stats');
    expect(generalizedInstructions.tools).not.toContain('analyze_hierarchy');
  });

  test('no subagent can invoke Task (single-depth constraint)', () => {
    const agents = buildACTSubagents();

    for (const [_name, agent] of Object.entries(agents)) {
      if (agent.tools) {
        expect(agent.tools).not.toContain('Task');
      }
    }
  });
});

// =============================================================================
// Test: Prompt Size Limits (NFR-002)
// =============================================================================

describe('Prompt Size Limits (NFR-002)', () => {
  const MAX_PROMPT_SIZE = 50 * 1024; // 50KB

  test('all bundled prompts are under 50KB', () => {
    for (const instructions of bundledInstructions) {
      const sizeBytes = new TextEncoder().encode(instructions.prompt).length;

      expect(sizeBytes).toBeLessThan(MAX_PROMPT_SIZE);
    }
  });

  test('claude-code prompt is under 10KB (efficient)', () => {
    const sizeBytes = new TextEncoder().encode(claudeCodeInstructions.prompt).length;
    expect(sizeBytes).toBeLessThan(10 * 1024);
  });

  test('generalized prompt is under 10KB (efficient)', () => {
    const sizeBytes = new TextEncoder().encode(generalizedInstructions.prompt).length;
    expect(sizeBytes).toBeLessThan(10 * 1024);
  });
});

// =============================================================================
// Test: Constitution Compliance (C8 - Single Subagent Depth)
// =============================================================================

describe('Constitution C8 Compliance', () => {
  test('registry validates against Task in tools array', () => {
    const registry = new ACTSubagentRegistry();

    const invalidInstructions: ACTInstructions = {
      name: 'invalid-analyzer',
      displayName: 'Invalid',
      description: 'This has Task tool which is forbidden',
      prompt: 'Some prompt',
      tools: ['discover_configs', 'Task'], // INVALID
      actTypes: ['unknown'],
      priority: 50,
    };

    expect(() => registry.register(invalidInstructions)).toThrow();
  });

  test('AgentDefinition output excludes Task tool', () => {
    const agents = buildACTSubagents();

    for (const agent of Object.values(agents)) {
      if (agent.tools) {
        expect(agent.tools.includes('Task')).toBe(false);
      }
    }
  });
});
