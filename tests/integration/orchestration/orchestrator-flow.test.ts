/**
 * EP02 Orchestration Core - Integration Test
 *
 * T055: Full orchestrator flow with mock tools
 *
 * This integration test validates the complete orchestration flow:
 * 1. Tool registration and MCP server creation
 * 2. Orchestrator configuration and initialization
 * 3. Streaming output processing
 * 4. Checkpoint emission
 * 5. Session state management
 * 6. Cognitive workspace building
 *
 * Uses mocked SDK components (no API calls) per ADR-0011.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { z } from 'zod';

// Import orchestration components
import {
  // Tool Registry
  ToolRegistry,
  createToolRegistry,
  // Configuration
  loadConfig,
  getDefaultConfig,
  // Streaming
  StreamProcessor,
  filterByVerbosity,
  createStreamChunk,
  // Checkpointing
  createCheckpointHandler,
  type ICheckpointHandler,
  // Session State
  saveState,
  loadState,
  deleteSession,
  buildStateSummary,
  // Cognitive Workspace
  buildCognitiveWorkspace,
  formatWorkspaceForPrompt,
  // Context
  handleToolResult,
  isLargeResult,
  // Types
  type SessionState,
  type CheckpointEvent,
} from '../../../src/orchestration';

// =============================================================================
// Test Fixtures
// =============================================================================

// Import the test helper for creating mock tools with proper SDK format
import { createMockTool as createMockToolHelper } from '../../utils/sdk-test-helpers';

import type { ToolDefinition } from '../../../src/orchestration/tool-registry';

/**
 * Create a mock tool for testing.
 */
function createMockTool(name: string, description: string): ToolDefinition {
  return createMockToolHelper(
    name,
    description,
    { input: z.string().describe('Input parameter') },
    ({ input }) => `Processed: ${input} (${name})`
  );
}

/**
 * Create test session state.
 */
function createTestSessionState(overrides: Partial<SessionState> = {}): SessionState {
  return {
    id: `test-session-${Date.now()}`,
    phase: 'analysis',
    startedAt: new Date(Date.now() - 60000).toISOString(),
    lastCheckpointAt: null,
    findings: [
      {
        id: 'finding-1',
        type: 'config_gap',
        severity: 'high',
        title: 'Missing sections in CLAUDE.md',
        description: 'The CLAUDE.md file is missing recommended sections',
        location: { file: '/project/CLAUDE.md', line: 1 },
        origin: null,
        recommendations: [
          {
            type: 'preventive',
            action: 'Add missing sections',
            rationale: 'Improves agent effectiveness',
            priority: 'high',
          },
        ],
        detectedAt: new Date().toISOString(),
        detectedInPhase: 'discovery',
      },
    ],
    toolResultCache: {
      'read_file_1': {
        toolName: 'read_file',
        input: { path: '/project/CLAUDE.md' },
        output: '# CLAUDE.md\n\nMinimal content',
        timestamp: new Date().toISOString(),
        durationMs: 15,
      },
    },
    checkpointSequence: 0,
    taskGoal: 'Analyze project configuration quality',
    projectContext: {
      name: 'test-project',
      path: '/tmp/test-project',
      hasClaudeMd: true,
      primaryLanguage: 'typescript',
      agentType: 'claude-code',
    },
    ...overrides,
  };
}

// =============================================================================
// Integration Test: Tool Registry Flow
// =============================================================================

describe('Integration: Tool Registry Flow', () => {
  test('registers tools and tracks names', () => {
    const registry = createToolRegistry();

    // Register multiple tools
    const analyzeTool = createMockTool('analyze_config', 'Analyze configuration');
    const validateTool = createMockTool('validate_schema', 'Validate schema');

    registry.register(analyzeTool);
    registry.register(validateTool);

    // Verify registration
    expect(registry.list()).toEqual(['analyze_config', 'validate_schema']);

    // Verify retrieval
    expect(registry.get('analyze_config')).toBeDefined();
    expect(registry.get('validate_schema')).toBeDefined();
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  test('registerMany works atomically', () => {
    const registry = new ToolRegistry();

    const tools = [
      createMockTool('tool_a', 'Tool A'),
      createMockTool('tool_b', 'Tool B'),
      createMockTool('tool_c', 'Tool C'),
    ];

    registry.registerMany(tools);

    expect(registry.list()).toHaveLength(3);
    expect(registry.get('tool_b')).toBeDefined();
  });

  test('prevents duplicate tool registration', () => {
    const registry = createToolRegistry();

    registry.register(createMockTool('my_tool', 'My Tool'));

    expect(() => {
      registry.register(createMockTool('my_tool', 'Duplicate Tool'));
    }).toThrow();
  });
});

// =============================================================================
// Integration Test: Streaming Flow
// =============================================================================

describe('Integration: Streaming Flow', () => {
  test('processes messages and filters by verbosity', () => {
    const processor = new StreamProcessor();

    // Simulate SDK message
    const sdkMessage = {
      type: 'assistant',
      content: [
        { type: 'text', text: 'Analyzing configuration...' },
        { type: 'tool_use', name: 'read_file', input: { path: '/CLAUDE.md' } },
      ],
    };

    const chunks = processor.process(sdkMessage);

    // Should produce text and tool_start chunks
    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.type).toBe('text');
    expect(chunks[1]?.type).toBe('tool_start');

    // Filter for normal verbosity (should exclude tool_start which is verbose)
    const normalChunks = filterByVerbosity(chunks, 'normal');
    expect(normalChunks).toHaveLength(1);
    expect(normalChunks[0]?.type).toBe('text');

    // Filter for verbose verbosity (should include both)
    const verboseChunks = filterByVerbosity(chunks, 'verbose');
    expect(verboseChunks).toHaveLength(2);
  });

  test('creates finding chunks with metadata', () => {
    const chunk = createStreamChunk('finding', 'normal', 'Found configuration gap', {
      findingId: 'F001',
      severity: 'high',
      type: 'config_gap',
    });

    expect(chunk.type).toBe('finding');
    expect(chunk.level).toBe('normal');
    expect(chunk.metadata?.findingId).toBe('F001');
    expect(chunk.timestamp).toBeDefined();
  });
});

// =============================================================================
// Integration Test: Checkpoint Flow
// =============================================================================

describe('Integration: Checkpoint Flow', () => {
  let handler: ICheckpointHandler;
  let capturedEvents: CheckpointEvent[];

  beforeEach(() => {
    capturedEvents = [];
    handler = createCheckpointHandler({
      intervalMs: 100, // Fast interval for testing
      onCheckpoint: (event) => capturedEvents.push(event),
    });
  });

  afterEach(() => {
    handler.stop();
    handler.reset();
  });

  test('emits checkpoints on various triggers', () => {
    const state = createTestSessionState();

    // Emit on tool completion
    handler.emit('tool_complete', state, { toolName: 'read_file' });
    expect(capturedEvents).toHaveLength(1);
    expect(capturedEvents[0]?.trigger).toBe('tool_complete');
    expect(capturedEvents[0]?.sequence).toBe(1);

    // Emit on finding
    handler.emit('finding', state, { findingId: 'F001' });
    expect(capturedEvents).toHaveLength(2);
    expect(capturedEvents[1]?.trigger).toBe('finding');
    expect(capturedEvents[1]?.sequence).toBe(2);

    // Emit on phase change
    handler.emit('phase_change', state, { previousPhase: 'discovery', newPhase: 'analysis' });
    expect(capturedEvents).toHaveLength(3);
    expect(capturedEvents[2]?.trigger).toBe('phase_change');
  });

  test('captures full session state in checkpoint', () => {
    const state = createTestSessionState();

    handler.emit('user_request', state);

    const event = capturedEvents[0]!;
    expect(event.state.id).toBe(state.id);
    expect(event.state.taskGoal).toBe(state.taskGoal);
    expect(event.state.findings).toHaveLength(1);
    expect(event.state.lastCheckpointAt).toBe(event.timestamp);
    expect(event.state.checkpointSequence).toBe(1);
  });

  test('interval timer fires checkpoints', async () => {
    const state = createTestSessionState();
    const getState = (): SessionState => state;

    const timerHandler = createCheckpointHandler({
      intervalMs: 50,
      onCheckpoint: (event) => capturedEvents.push(event),
      getState,
    });

    timerHandler.start();
    expect(timerHandler.isRunning()).toBe(true);

    // Wait for interval to fire
    await new Promise((resolve) => setTimeout(resolve, 120));

    timerHandler.stop();
    expect(timerHandler.isRunning()).toBe(false);

    // Should have at least one interval checkpoint
    const intervalEvents = capturedEvents.filter((e) => e.trigger === 'interval');
    expect(intervalEvents.length).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// Integration Test: Session State Persistence
// =============================================================================

describe('Integration: Session State Persistence', () => {
  const testDir = '/tmp/agentlint-test-sessions';

  afterEach(async () => {
    // Clean up test sessions
    try {
      const { readdir, unlink, rmdir } = await import('node:fs/promises');
      const files = await readdir(testDir);
      for (const file of files) {
        await unlink(`${testDir}/${file}`);
      }
      await rmdir(testDir);
    } catch {
      // Directory may not exist
    }
  });

  test('saves and loads session state', async () => {
    const state = createTestSessionState();

    // Save state
    const filePath = await saveState(state, testDir);
    expect(filePath).toContain(state.id);

    // Load state
    const loaded = await loadState(state.id, testDir);
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe(state.id);
    expect(loaded!.taskGoal).toBe(state.taskGoal);
    expect(loaded!.findings).toHaveLength(1);
  });

  test('returns null for non-existent session', async () => {
    const loaded = await loadState('non-existent-session', testDir);
    expect(loaded).toBeNull();
  });

  test('deletes session files', async () => {
    const state = createTestSessionState();

    await saveState(state, testDir);

    // Verify it exists
    const loaded = await loadState(state.id, testDir);
    expect(loaded).not.toBeNull();

    // Delete it
    const deleted = await deleteSession(state.id, testDir);
    expect(deleted).toBe(true);

    // Verify it's gone
    const afterDelete = await loadState(state.id, testDir);
    expect(afterDelete).toBeNull();
  });

  test('builds session summary for resume', () => {
    const state = createTestSessionState();

    const summary = buildStateSummary(state);

    expect(summary.taskGoal).toBe(state.taskGoal);
    expect(summary.currentPhase).toBe('analysis');
    expect(summary.findingsCount).toBe(1);
    expect(summary.findingSummaries).toHaveLength(1);
    expect(summary.formattedSummary).toContain('[Session Resume Context]');
    expect(summary.formattedSummary).toContain('Analyze project configuration quality');
  });
});

// =============================================================================
// Integration Test: Cognitive Workspace
// =============================================================================

describe('Integration: Cognitive Workspace', () => {
  test('builds workspace from session state', () => {
    const state = createTestSessionState();

    const workspace = buildCognitiveWorkspace(state);

    expect(workspace.taskGoal).toBe(state.taskGoal);
    expect(workspace.projectContext.name).toBe('test-project');
    expect(workspace.progress.currentPhase).toBe('analysis');
    expect(workspace.progress.findingsCount).toBe(1);
    expect(workspace.findings).toHaveLength(1);
    expect(workspace.baselineAwareness).toBeNull();
    expect(workspace.globalLearnings).toEqual([]);
  });

  test('formats workspace for system prompt', () => {
    const state = createTestSessionState();
    const workspace = buildCognitiveWorkspace(state);

    const formatted = formatWorkspaceForPrompt(workspace);

    expect(formatted).toContain('[Cognitive Workspace]');
    expect(formatted).toContain('Task Goal: Analyze project configuration quality');
    expect(formatted).toContain('Project:');
    expect(formatted).toContain('Name: test-project');
    expect(formatted).toContain('Progress:');
    expect(formatted).toContain('Phase: analysis');
    expect(formatted).toContain('Current Findings:');
    expect(formatted).toContain('[HIGH] Missing sections in CLAUDE.md');
    expect(formatted).toContain('[End Cognitive Workspace]');
  });

  test('includes baseline awareness when provided', () => {
    const state = createTestSessionState();
    const baseline = {
      lastAnalysisDate: '2026-01-15T10:00:00.000Z',
      previousScore: 72,
      deltaFindings: -3,
      improvementAreas: ['testing', 'documentation'],
    };

    const workspace = buildCognitiveWorkspace(state, baseline);
    const formatted = formatWorkspaceForPrompt(workspace);

    expect(formatted).toContain('Baseline:');
    expect(formatted).toContain('Previous Score: 72');
    expect(formatted).toContain('Delta: -3 findings');
    expect(formatted).toContain('Focus Areas: testing, documentation');
  });
});

// =============================================================================
// Integration Test: Context Management
// =============================================================================

describe('Integration: Context Management', () => {
  test('handles small results without summarization', () => {
    const result = { status: 'ok', data: [1, 2, 3] };

    const handled = handleToolResult('test_tool', result);

    expect(handled.summarized).toBe(false);
    expect(handled.content).toEqual(result);
    expect(handled.summary).toBeUndefined();
  });

  test('summarizes large results', () => {
    // Create a large result (>10KB)
    const largeContent = 'x'.repeat(15000);

    const handled = handleToolResult('read_file', largeContent);

    expect(handled.summarized).toBe(true);
    expect(handled.originalSize).toBe(15000);
    expect(handled.fullContentRef).toBeDefined();
    expect(handled.summary).toContain('[Large result from read_file');
    expect(handled.summary).toContain('Preview:');
  });

  test('isLargeResult correctly identifies large content', () => {
    const small = 'small content';
    const large = 'x'.repeat(15000);

    expect(isLargeResult(small)).toBe(false);
    expect(isLargeResult(large)).toBe(true);
    expect(isLargeResult({ data: 'x'.repeat(15000) })).toBe(true);
  });
});

// =============================================================================
// Integration Test: Configuration
// =============================================================================

describe('Integration: Configuration', () => {
  test('loads config with defaults', () => {
    const config = loadConfig({});

    expect(config.model).toBe('claude-sonnet-4-20250514');
    expect(config.verbosity).toBe('normal');
    expect(config.checkpointIntervalMs).toBe(60000);
    expect(config.depth).toBe(0);
  });

  test('applies overrides to config', () => {
    const config = loadConfig({
      verbosity: 'verbose',
      checkpointIntervalMs: 30000,
      depth: 1,
    });

    expect(config.verbosity).toBe('verbose');
    expect(config.checkpointIntervalMs).toBe(30000);
    expect(config.depth).toBe(1);
  });

  test('getDefaultConfig returns complete config', () => {
    const defaults = getDefaultConfig();

    expect(defaults.model).toBeDefined();
    expect(defaults.verbosity).toBeDefined();
    expect(defaults.checkpointIntervalMs).toBeDefined();
    expect(defaults.cwd).toBeDefined();
    expect(defaults.systemPromptAppend).toBeDefined();
    expect(defaults.settingSources).toBeDefined();
    expect(defaults.depth).toBeDefined();
  });
});

// =============================================================================
// Integration Test: Full Flow Scenario
// =============================================================================

describe('Integration: Full Analysis Flow Scenario', () => {
  test('simulates complete analysis session', async () => {
    // 1. Setup tool registry
    const registry = createToolRegistry();
    registry.register(createMockTool('analyze_config', 'Analyze configuration'));
    registry.register(createMockTool('read_file', 'Read file contents'));

    // 2. Create checkpoint handler
    const checkpointEvents: CheckpointEvent[] = [];
    const checkpointHandler = createCheckpointHandler({
      onCheckpoint: (event) => checkpointEvents.push(event),
    });

    // 3. Initialize session state
    const sessionState = createTestSessionState({
      id: 'integration-test-session',
      phase: 'init',
      findings: [],
    });

    // 4. Simulate phase transition
    sessionState.phase = 'discovery';
    checkpointHandler.emit('phase_change', sessionState, {
      previousPhase: 'init',
      newPhase: 'discovery',
    });

    // 5. Simulate tool execution
    const streamProcessor = new StreamProcessor();
    const toolMessage = {
      type: 'assistant',
      content: [
        { type: 'text', text: 'Reading CLAUDE.md...' },
        { type: 'tool_use', name: 'read_file', input: { path: '/CLAUDE.md' } },
      ],
    };
    const chunks = streamProcessor.process(toolMessage);
    expect(chunks.length).toBeGreaterThan(0);

    // 6. Handle tool result
    const toolResult = handleToolResult('read_file', '# CLAUDE.md\n\nProject configuration');
    expect(toolResult.summarized).toBe(false);

    // 7. Emit tool completion checkpoint
    checkpointHandler.emit('tool_complete', sessionState, { toolName: 'read_file' });

    // 8. Add finding
    sessionState.findings.push({
      id: 'finding-integration-1',
      type: 'config_gap',
      severity: 'medium',
      title: 'Missing build section',
      description: 'No build instructions found',
      location: { file: '/CLAUDE.md', line: 1 },
      origin: null,
      recommendations: [],
      detectedAt: new Date().toISOString(),
      detectedInPhase: 'discovery',
    });

    // 9. Emit finding checkpoint
    checkpointHandler.emit('finding', sessionState, { findingId: 'finding-integration-1' });

    // 10. Transition to analysis phase
    sessionState.phase = 'analysis';
    checkpointHandler.emit('phase_change', sessionState, {
      previousPhase: 'discovery',
      newPhase: 'analysis',
    });

    // 11. Build cognitive workspace
    const workspace = buildCognitiveWorkspace(sessionState);
    const workspacePrompt = formatWorkspaceForPrompt(workspace);
    expect(workspacePrompt).toContain('Phase: analysis');
    expect(workspacePrompt).toContain('Findings: 1');

    // 12. Save session state
    const testDir = '/tmp/agentlint-integration-test';
    const savedPath = await saveState(sessionState, testDir);
    expect(savedPath).toContain('integration-test-session');

    // 13. Load and verify session state
    const loadedState = await loadState('integration-test-session', testDir);
    expect(loadedState).not.toBeNull();
    expect(loadedState!.phase).toBe('analysis');
    expect(loadedState!.findings).toHaveLength(1);

    // 14. Build resume summary
    const summary = buildStateSummary(loadedState!);
    expect(summary.formattedSummary).toContain('analysis');

    // 15. Verify checkpoint sequence
    expect(checkpointEvents).toHaveLength(4); // phase_change, tool_complete, finding, phase_change
    expect(checkpointHandler.getSequence()).toBe(4);

    // Cleanup
    await deleteSession('integration-test-session', testDir);
  });
});
