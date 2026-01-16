/**
 * EP02 Orchestration Core - Quickstart Pattern Validation
 *
 * T056: Validate against quickstart.md code examples
 *
 * This test verifies that the patterns documented in quickstart.md
 * work as expected with the implemented orchestration layer.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { z } from 'zod';

import {
  // Factory functions
  createToolRegistry,
  createCheckpointHandler,
  // Functions
  loadConfig,
  filterByVerbosity,
  saveState,
  loadState,
  listSessions,
  buildStateSummary,
  // Types
  type SessionState,
  type CheckpointEvent,
  type StreamChunk,
} from '../../../src/orchestration';

// Import test helper for creating mock tools
import { createMockTool } from '../../utils/sdk-test-helpers';

import {
  OrchestrationError,
  SessionResumeError,
  ApiKeyError,
} from '../../../src/errors';

// =============================================================================
// Test Fixture
// =============================================================================

function createTestState(): SessionState {
  return {
    id: `qs-test-${Date.now()}`,
    phase: 'analysis',
    startedAt: new Date().toISOString(),
    lastCheckpointAt: null,
    findings: [],
    toolResultCache: {},
    checkpointSequence: 0,
    taskGoal: 'Quickstart pattern validation',
    projectContext: {
      name: 'quickstart-test',
      path: '/tmp/quickstart-test',
      hasClaudeMd: true,
      primaryLanguage: 'typescript',
      agentType: 'claude-code',
    },
  };
}

// =============================================================================
// Quickstart Pattern: Programmatic Config
// =============================================================================

describe('Quickstart: Programmatic Config', () => {
  test('config options match quickstart.md examples', () => {
    // From quickstart.md:
    // const orchestrator = new Orchestrator({
    //   model: 'claude-opus-4-20250514',
    //   checkpointIntervalMs: 30000,
    //   verbosity: 'verbose',
    //   systemPromptAppend: `...`
    // });

    const config = loadConfig({
      model: 'claude-opus-4-20250514',
      checkpointIntervalMs: 30000,
      verbosity: 'verbose',
      systemPromptAppend: 'Focus on security-related configuration gaps.',
    });

    expect(config.model).toBe('claude-opus-4-20250514');
    expect(config.checkpointIntervalMs).toBe(30000);
    expect(config.verbosity).toBe('verbose');
    expect(config.systemPromptAppend).toContain('security-related');
  });
});

// =============================================================================
// Quickstart Pattern: Registering Custom Tools
// =============================================================================

describe('Quickstart: Registering Custom Tools', () => {
  test('tool registration pattern works', () => {
    // From quickstart.md:
    // const myTool = tool(
    //   'my_custom_analyzer',
    //   'Analyzes project for custom patterns',
    //   { pattern: z.string(), directory: z.string().optional() },
    //   async ({ pattern, directory }) => { ... }
    // );
    //
    // orchestrator.toolRegistry.register(myTool);

    // SDK tool() uses positional args: tool(name, description, schema, handler)
    const myTool = createMockTool(
      'my_custom_analyzer',
      'Analyzes project for custom patterns',
      {
        pattern: z.string().describe('The pattern to search for'),
        directory: z.string().optional().describe('Directory to search'),
      },
      ({ pattern, directory }) => `Searched for ${pattern} in ${directory ?? '.'}`
    );

    const registry = createToolRegistry();
    registry.register(myTool);

    expect(registry.list()).toContain('my_custom_analyzer');
    expect(registry.get('my_custom_analyzer')).toBeDefined();
  });
});

// =============================================================================
// Quickstart Pattern: Handling Checkpoints
// =============================================================================

describe('Quickstart: Handling Checkpoints', () => {
  test('checkpoint handler pattern works', () => {
    // From quickstart.md:
    // const checkpointHandler: CheckpointHandler = {
    //   async onCheckpoint(event) {
    //     console.log(`Checkpoint ${event.sequence}: ${event.trigger}`);
    //     await myStorage.save(event.sessionId, event.state);
    //   }
    // };

    const events: CheckpointEvent[] = [];

    const handler = createCheckpointHandler({
      onCheckpoint: (event) => {
        events.push(event);
        // console.log(`Checkpoint ${event.sequence}: ${event.trigger}`);
        // await myStorage.save(event.sessionId, event.state);
      },
    });

    const state = createTestState();
    handler.emit('tool_complete', state, { toolName: 'read_file' });

    expect(events).toHaveLength(1);
    expect(events[0]?.sequence).toBe(1);
    expect(events[0]?.trigger).toBe('tool_complete');
    expect(events[0]?.sessionId).toBe(state.id);
  });
});

// =============================================================================
// Quickstart Pattern: Session Management
// =============================================================================

describe('Quickstart: Session Management', () => {
  const testDir = '/tmp/agentlint-quickstart-test';

  afterEach(async () => {
    try {
      const { readdir, unlink, rmdir } = await import('node:fs/promises');
      const files = await readdir(testDir);
      for (const file of files) {
        await unlink(`${testDir}/${file}`);
      }
      await rmdir(testDir);
    } catch {
      // Cleanup errors are ok
    }
  });

  test('session save/load/list pattern works', async () => {
    // From quickstart.md:
    // const sessions = await orchestrator.listSessions();
    // if (sessions.length > 0) {
    //   const lastSession = sessions[0];
    //   console.log(`Found interrupted session: ${lastSession.id}`);
    // }

    const state = createTestState();
    state.phase = 'discovery';
    state.findings.push({
      id: 'f1',
      type: 'config_gap',
      severity: 'medium',
      title: 'Test finding',
      description: 'Test',
      location: null,
      origin: null,
      recommendations: [],
      detectedAt: new Date().toISOString(),
      detectedInPhase: 'discovery',
    });

    // Save
    await saveState(state, testDir);

    // List sessions
    const sessions = await listSessions(testDir);
    expect(sessions.length).toBeGreaterThan(0);

    // Load latest
    const loaded = await loadState(sessions[0]!, testDir);
    expect(loaded).not.toBeNull();
    expect(loaded!.phase).toBe('discovery');
    expect(loaded!.findings).toHaveLength(1);
  });

  test('buildStateSummary provides resume context', () => {
    const state = createTestState();
    state.findings.push({
      id: 'f1',
      type: 'config_gap',
      severity: 'high',
      title: 'Missing CLAUDE.md',
      description: 'No CLAUDE.md found',
      location: null,
      origin: null,
      recommendations: [],
      detectedAt: new Date().toISOString(),
      detectedInPhase: 'discovery',
    });

    const summary = buildStateSummary(state);

    expect(summary.formattedSummary).toContain('[Session Resume Context]');
    expect(summary.formattedSummary).toContain('Task Goal:');
    expect(summary.formattedSummary).toContain('Current Phase:');
    expect(summary.formattedSummary).toContain('Findings:');
  });
});

// =============================================================================
// Quickstart Pattern: Streaming with Verbosity Filter
// =============================================================================

describe('Quickstart: Streaming with Verbosity Filter', () => {
  test('filterByVerbosity pattern works', () => {
    // From quickstart.md:
    // for await (const chunk of orchestrator.run('Analyze project')) {
    //   const filtered = filterByVerbosity([chunk], 'normal');
    //   for (const c of filtered) {
    //     console.log(`[${c.type}] ${c.content}`);
    //   }
    // }

    const chunks: StreamChunk[] = [
      {
        type: 'text',
        level: 'normal',
        content: 'Analyzing project...',
        timestamp: new Date().toISOString(),
      },
      {
        type: 'tool_start',
        level: 'verbose',
        content: 'Calling tool: read_file',
        timestamp: new Date().toISOString(),
      },
      {
        type: 'tool_result',
        level: 'debug',
        content: 'Tool returned 1000 chars',
        timestamp: new Date().toISOString(),
      },
    ];

    // Filter to normal - should exclude verbose and debug
    const normalFiltered = filterByVerbosity(chunks, 'normal');
    expect(normalFiltered).toHaveLength(1);
    expect(normalFiltered[0]?.type).toBe('text');

    // Filter to verbose - should include text and tool_start
    const verboseFiltered = filterByVerbosity(chunks, 'verbose');
    expect(verboseFiltered).toHaveLength(2);

    // Filter to debug - should include all
    const debugFiltered = filterByVerbosity(chunks, 'debug');
    expect(debugFiltered).toHaveLength(3);

    // Filter to quiet - should exclude normal+
    const quietFiltered = filterByVerbosity(chunks, 'quiet');
    expect(quietFiltered).toHaveLength(0);
  });
});

// =============================================================================
// Quickstart Pattern: Stream Chunk Types
// =============================================================================

describe('Quickstart: Stream Chunk Types', () => {
  test('all documented chunk types are valid', () => {
    // From quickstart.md:
    // | Type | Description |
    // | `text` | Agent reasoning/response text |
    // | `tool_start` | Tool invocation beginning |
    // | `tool_result` | Tool execution result |
    // | `finding` | New finding detected |
    // | `phase_change` | Analysis phase transition |
    // | `checkpoint` | Checkpoint saved |
    // | `error` | Error occurred |
    // | `status` | Status update |

    const documentedTypes = [
      'text',
      'tool_start',
      'tool_result',
      'finding',
      'phase_change',
      'checkpoint',
      'error',
      'status',
    ] as const;

    // Verify each type can be assigned to StreamChunk
    for (const chunkType of documentedTypes) {
      const chunk: StreamChunk = {
        type: chunkType,
        level: 'normal',
        content: `Test ${chunkType}`,
        timestamp: new Date().toISOString(),
      };

      // Type should be assignable without error
      expect(chunk.type).toBe(chunkType);
    }
  });
});

// =============================================================================
// Quickstart Pattern: Error Handling
// =============================================================================

describe('Quickstart: Error Handling', () => {
  test('error types are importable and have correct hierarchy', () => {
    // From quickstart.md:
    // import {
    //   OrchestrationError,
    //   SessionResumeError,
    //   ApiKeyError
    // } from '@agentlint/orchestration';

    // Verify error classes exist
    expect(OrchestrationError).toBeDefined();
    expect(SessionResumeError).toBeDefined();
    expect(ApiKeyError).toBeDefined();

    // Verify inheritance
    const orchError = new OrchestrationError('test', { code: 1 });
    expect(orchError).toBeInstanceOf(Error);

    // SessionResumeError takes (sessionId, reason, optionalMessage)
    const resumeError = new SessionResumeError('test-id', 'not_found');
    expect(resumeError).toBeInstanceOf(OrchestrationError);

    // ApiKeyError takes (reason, optionalMessage)
    const apiError = new ApiKeyError('missing');
    expect(apiError).toBeInstanceOf(OrchestrationError);
  });

  test('error messages are descriptive', () => {
    // SessionResumeError takes (sessionId, reason, optionalMessage)
    const resumeError = new SessionResumeError('sess-123', 'corrupted');
    expect(resumeError.message).toContain('sess-123');
    expect(resumeError.message).toContain('corrupted');

    // ApiKeyError takes (reason, optionalMessage)
    const apiError = new ApiKeyError('missing');
    expect(apiError.message).toContain('ANTHROPIC_API_KEY');
  });
});

// =============================================================================
// Quickstart Pattern: Verbosity Levels
// =============================================================================

describe('Quickstart: Verbosity Levels', () => {
  test('all documented verbosity levels are valid', () => {
    // From quickstart.md:
    // | Level | What You See |
    // | `quiet` | Errors only |
    // | `normal` | Progress indicators, results, findings |
    // | `verbose` | Agent reasoning, tool invocations |
    // | `debug` | All events including internal state |

    const config1 = loadConfig({ verbosity: 'quiet' });
    expect(config1.verbosity).toBe('quiet');

    const config2 = loadConfig({ verbosity: 'normal' });
    expect(config2.verbosity).toBe('normal');

    const config3 = loadConfig({ verbosity: 'verbose' });
    expect(config3.verbosity).toBe('verbose');

    const config4 = loadConfig({ verbosity: 'debug' });
    expect(config4.verbosity).toBe('debug');
  });
});
