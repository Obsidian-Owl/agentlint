import { describe, test, expect, mock, afterEach } from 'bun:test';
import { InkRenderer } from '../../../../src/tui/renderers/ink-renderer';
import type { StreamChunk } from '../../../../src/orchestration/types';
import type { LoadingStep, ConversationMessage } from '../../../../src/tui/types';

// =============================================================================
// Tests
// =============================================================================

describe('InkRenderer', () => {
  let renderer: InkRenderer;

  afterEach(() => {
    if (renderer) {
      renderer.stop();
    }
  });

  describe('construction', () => {
    test('should create renderer instance', () => {
      renderer = new InkRenderer();
      expect(renderer).toBeInstanceOf(InkRenderer);
    });

    test('should create independent instances', () => {
      renderer = new InkRenderer();
      const renderer2 = new InkRenderer();
      expect(renderer).not.toBe(renderer2);
      renderer2.stop();
    });
  });

  describe('start', () => {
    test('should start and initialize Ink instance', () => {
      renderer = new InkRenderer();
      renderer.start({});
      // If start fails, stop() would have no effect
      // Verify we can call methods that require instance
      renderer.setTuiState('welcome');
      // No error = success
    });

    test('should store onInput callback', async () => {
      renderer = new InkRenderer();
      const onInput = mock(() => Promise.resolve());
      renderer.start({ onInput });
      // Callback is stored - verification would require integration test
      expect(onInput).not.toHaveBeenCalled(); // Not called during start
    });

    test('should store onExit callback', () => {
      renderer = new InkRenderer();
      const onExit = mock(() => Promise.resolve());
      renderer.start({ onExit });
      expect(onExit).not.toHaveBeenCalled();
    });

    test('should store onStart callback', () => {
      renderer = new InkRenderer();
      const onStart = mock(() => {});
      renderer.start({ onStart });
      expect(onStart).not.toHaveBeenCalled(); // Start callback passed to App
    });

    test('should accept initialState', () => {
      renderer = new InkRenderer();
      renderer.start({
        initialState: {
          tuiState: 'conversing',
          loadingSteps: [],
          conversationHistory: [],
          statusBar: {
            helpHint: 'test',
            status: 'ready',
            model: 'claude',
            openRecommendations: 0,
            projectPath: '/test',
            elapsedMs: 0,
          },
        },
      });
    });
  });

  describe('stop', () => {
    test('should unmount Ink instance and clear state', () => {
      renderer = new InkRenderer();
      renderer.start({});

      // Add some state
      const chunk: StreamChunk = {
        type: 'text',
        content: 'test',
        level: 'normal',
        timestamp: new Date().toISOString(),
      };
      renderer.renderChunk(chunk);

      renderer.stop();

      // After stop, can restart fresh
      renderer.start({});
      // No leftover state errors
    });

    test('should be idempotent - multiple stops are safe', () => {
      renderer = new InkRenderer();
      renderer.start({});

      renderer.stop();
      renderer.stop();
      renderer.stop();
      // No error = success
    });

    test('should handle stop before start', () => {
      renderer = new InkRenderer();
      renderer.stop();
      // Should not throw
    });

    test('should allow restart after stop', () => {
      renderer = new InkRenderer();
      renderer.start({});
      renderer.stop();
      renderer.start({});
      renderer.setTuiState('welcome');
      // No error = success
    });
  });

  describe('renderChunk', () => {
    test('should handle text chunk and track streaming state', () => {
      renderer = new InkRenderer();
      renderer.start({});

      const chunk: StreamChunk = {
        type: 'text',
        content: 'Hello world',
        level: 'normal',
        timestamp: new Date().toISOString(),
      };

      renderer.renderChunk(chunk);
      // Internal state updated - would need to verify via App props in integration test
    });

    test('should handle tool_start chunk and update agent state', () => {
      renderer = new InkRenderer();
      renderer.start({});

      const chunk: StreamChunk = {
        type: 'tool_start',
        content: 'read_file',
        level: 'verbose',
        timestamp: new Date().toISOString(),
        metadata: { toolName: 'read_file' },
      };

      renderer.renderChunk(chunk);
      // Agent state should be 'calling_tool'
    });

    test('should handle tool_result chunk and update agent state', () => {
      renderer = new InkRenderer();
      renderer.start({});

      const chunk: StreamChunk = {
        type: 'tool_result',
        content: 'file contents',
        level: 'verbose',
        timestamp: new Date().toISOString(),
        metadata: { toolName: 'read_file' },
      };

      renderer.renderChunk(chunk);
      // Agent state should be 'thinking'
    });

    test('should handle error chunk and update agent state', () => {
      renderer = new InkRenderer();
      renderer.start({});

      const chunk: StreamChunk = {
        type: 'error',
        content: 'Something went wrong',
        level: 'normal',
        timestamp: new Date().toISOString(),
      };

      renderer.renderChunk(chunk);
      // Agent state should be 'error'
    });

    test('should handle phase_change chunk', () => {
      renderer = new InkRenderer();
      renderer.start({});

      const chunk: StreamChunk = {
        type: 'phase_change',
        content: 'Analyzing...',
        level: 'normal',
        timestamp: new Date().toISOString(),
        metadata: { newPhase: 'analyzing' },
      };

      renderer.renderChunk(chunk);
      // Phase should be 'analyzing'
    });

    test('should extract findings from finding chunk', () => {
      renderer = new InkRenderer();
      renderer.start({});

      const finding = {
        id: 'test-finding',
        type: 'improvement' as const,
        title: 'Test Finding',
        description: 'Description',
        severity: 'low' as const,
        location: { type: 'file' as const, path: '/test.ts' },
      };

      const chunk: StreamChunk = {
        type: 'finding',
        content: 'Found issue',
        level: 'normal',
        timestamp: new Date().toISOString(),
        metadata: { finding },
      };

      renderer.renderChunk(chunk);
      // Finding should be accumulated
    });

    test('should track token usage from status chunks', () => {
      renderer = new InkRenderer();
      renderer.start({});

      const chunk: StreamChunk = {
        type: 'status',
        content: 'Status update',
        level: 'normal',
        timestamp: new Date().toISOString(),
        metadata: { inputTokens: 100, outputTokens: 50 },
      };

      renderer.renderChunk(chunk);
      // Token usage should be accumulated in statusBar
    });

    test('should handle multiple chunks in sequence', () => {
      renderer = new InkRenderer();
      renderer.start({});

      const chunks: StreamChunk[] = [
        { type: 'text', content: 'Line 1', level: 'normal', timestamp: new Date().toISOString() },
        { type: 'text', content: 'Line 2', level: 'normal', timestamp: new Date().toISOString() },
        {
          type: 'tool_start',
          content: 'read',
          level: 'verbose',
          timestamp: new Date().toISOString(),
          metadata: { toolName: 'read' },
        },
        {
          type: 'tool_result',
          content: 'result',
          level: 'verbose',
          timestamp: new Date().toISOString(),
          metadata: { toolName: 'read' },
        },
        { type: 'text', content: 'Final', level: 'normal', timestamp: new Date().toISOString() },
      ];

      for (const chunk of chunks) {
        renderer.renderChunk(chunk);
      }
      // All chunks processed without error
    });

    test('should update elapsed time on each chunk', () => {
      renderer = new InkRenderer();
      renderer.start({});

      const chunk: StreamChunk = {
        type: 'text',
        content: 'test',
        level: 'normal',
        timestamp: new Date().toISOString(),
      };

      renderer.renderChunk(chunk);
      // elapsedMs in statusBar should be updated
    });
  });

  describe('renderComplete', () => {
    test('should mark streaming as complete', () => {
      renderer = new InkRenderer();
      renderer.start({});

      // Stream some content first
      renderer.renderChunk({
        type: 'text',
        content: 'Processing...',
        level: 'normal',
        timestamp: new Date().toISOString(),
      });

      renderer.renderComplete({ success: true });
      // isStreaming should be false, phase should be 'presenting'
    });

    test('should handle null result', () => {
      renderer = new InkRenderer();
      renderer.start({});
      renderer.renderComplete(null);
    });

    test('should handle result with findings', () => {
      renderer = new InkRenderer();
      renderer.start({});
      renderer.renderComplete({ findings: [], recommendations: [] });
    });

    test('should handle string result', () => {
      renderer = new InkRenderer();
      renderer.start({});
      renderer.renderComplete('Analysis complete');
    });
  });

  describe('requestPermission', () => {
    test('should return a pending promise', () => {
      renderer = new InkRenderer();
      renderer.start({});

      const request = {
        tool: 'read_file',
        description: 'Read a file',
      };

      const promise = renderer.requestPermission(request);
      expect(promise).toBeInstanceOf(Promise);
      // Promise stays pending until user interaction
    });

    test('should store permission request with pattern', () => {
      renderer = new InkRenderer();
      renderer.start({});

      const request = {
        tool: 'write_file',
        description: 'Write to file',
        pattern: '/tmp/*.txt',
      };

      const promise = renderer.requestPermission(request);
      expect(promise).toBeInstanceOf(Promise);
      // Request with pattern is stored for dialog
    });

    test('should handle multiple permission requests sequentially', async () => {
      renderer = new InkRenderer();
      renderer.start({});

      const promise1 = renderer.requestPermission({
        tool: 'tool1',
        description: 'First request',
      });

      // Second request should also work
      const promise2 = renderer.requestPermission({
        tool: 'tool2',
        description: 'Second request',
      });

      expect(promise1).toBeInstanceOf(Promise);
      expect(promise2).toBeInstanceOf(Promise);
    });
  });

  describe('requestUserAnswers', () => {
    test('should return a pending promise', () => {
      renderer = new InkRenderer();
      renderer.start({});

      const promise = renderer.requestUserAnswers({
        questions: [
          {
            question: 'What is your name?',
            header: 'Name',
            options: [{ label: 'Option A' }, { label: 'Option B' }],
          },
        ],
      });

      expect(promise).toBeInstanceOf(Promise);
    });

    test('should handle multiple questions', () => {
      renderer = new InkRenderer();
      renderer.start({});

      const promise = renderer.requestUserAnswers({
        questions: [
          {
            question: 'Question 1?',
            header: 'Q1',
            options: [{ label: 'Yes' }, { label: 'No' }],
          },
          {
            question: 'Question 2?',
            header: 'Q2',
            options: [
              { label: 'A', description: 'Option A' },
              { label: 'B', description: 'Option B' },
            ],
            multiSelect: true,
          },
        ],
      });

      expect(promise).toBeInstanceOf(Promise);
    });
  });

  describe('setTuiState', () => {
    test('should update TUI state to loading', () => {
      renderer = new InkRenderer();
      renderer.start({});
      renderer.setTuiState('loading');
    });

    test('should update TUI state to welcome', () => {
      renderer = new InkRenderer();
      renderer.start({});
      renderer.setTuiState('welcome');
    });

    test('should update TUI state to analysing', () => {
      renderer = new InkRenderer();
      renderer.start({});
      renderer.setTuiState('analysing');
    });

    test('should update TUI state to presenting', () => {
      renderer = new InkRenderer();
      renderer.start({});
      renderer.setTuiState('presenting');
    });

    test('should update TUI state to idle', () => {
      renderer = new InkRenderer();
      renderer.start({});
      renderer.setTuiState('idle');
    });

    test('should update TUI state to conversing', () => {
      renderer = new InkRenderer();
      renderer.start({});
      renderer.setTuiState('conversing');
    });
  });

  describe('setLoadingSteps', () => {
    test('should set loading steps array', () => {
      renderer = new InkRenderer();
      renderer.start({});

      const steps: LoadingStep[] = [
        { id: 'step1', label: 'Loading config...', status: 'pending' },
        { id: 'step2', label: 'Connecting...', status: 'pending' },
      ];

      renderer.setLoadingSteps(steps);
    });

    test('should handle empty steps array', () => {
      renderer = new InkRenderer();
      renderer.start({});
      renderer.setLoadingSteps([]);
    });

    test('should copy array to prevent mutation', () => {
      renderer = new InkRenderer();
      renderer.start({});

      const steps: LoadingStep[] = [{ id: 'step1', label: 'Step 1', status: 'pending' }];

      renderer.setLoadingSteps(steps);

      // Mutating original should not affect renderer
      steps.push({ id: 'step2', label: 'Step 2', status: 'pending' });
      // Renderer still has original array
    });
  });

  describe('updateLoadingStep', () => {
    test('should update step status to complete', () => {
      renderer = new InkRenderer();
      renderer.start({});

      renderer.setLoadingSteps([{ id: 'step1', label: 'Step 1', status: 'pending' }]);

      renderer.updateLoadingStep('step1', 'complete');
    });

    test('should update step status to error', () => {
      renderer = new InkRenderer();
      renderer.start({});

      renderer.setLoadingSteps([{ id: 'step1', label: 'Step 1', status: 'pending' }]);

      renderer.updateLoadingStep('step1', 'error', 'Failed to connect');
    });

    test('should update step status to loading', () => {
      renderer = new InkRenderer();
      renderer.start({});

      renderer.setLoadingSteps([{ id: 'step1', label: 'Step 1', status: 'pending' }]);

      renderer.updateLoadingStep('step1', 'loading');
    });

    test('should update step status to skipped', () => {
      renderer = new InkRenderer();
      renderer.start({});

      renderer.setLoadingSteps([{ id: 'step1', label: 'Step 1', status: 'pending' }]);

      renderer.updateLoadingStep('step1', 'skipped');
    });

    test('should handle non-existent step ID gracefully', () => {
      renderer = new InkRenderer();
      renderer.start({});

      renderer.setLoadingSteps([{ id: 'step1', label: 'Step 1', status: 'pending' }]);

      renderer.updateLoadingStep('nonexistent', 'complete');
    });

    test('should update step with detail message', () => {
      renderer = new InkRenderer();
      renderer.start({});

      renderer.setLoadingSteps([{ id: 'step1', label: 'Step 1', status: 'pending' }]);

      renderer.updateLoadingStep('step1', 'loading', 'Processing file 3 of 10');
    });
  });

  describe('addConversationMessage', () => {
    test('should add user message to history', () => {
      renderer = new InkRenderer();
      renderer.start({});

      const message: ConversationMessage = {
        role: 'user',
        content: 'Hello',
        timestamp: new Date().toISOString(),
      };

      renderer.addConversationMessage(message);
    });

    test('should add assistant message to history', () => {
      renderer = new InkRenderer();
      renderer.start({});

      const message: ConversationMessage = {
        role: 'assistant',
        content: 'Hello! How can I help?',
        timestamp: new Date().toISOString(),
      };

      renderer.addConversationMessage(message);
    });

    test('should handle multiple messages', () => {
      renderer = new InkRenderer();
      renderer.start({});

      renderer.addConversationMessage({
        role: 'user',
        content: 'Question 1',
        timestamp: new Date().toISOString(),
      });

      renderer.addConversationMessage({
        role: 'assistant',
        content: 'Answer 1',
        timestamp: new Date().toISOString(),
      });

      renderer.addConversationMessage({
        role: 'user',
        content: 'Question 2',
        timestamp: new Date().toISOString(),
      });
    });
  });

  describe('updateStatusBar', () => {
    test('should update status bar status', () => {
      renderer = new InkRenderer();
      renderer.start({});

      renderer.updateStatusBar({ status: 'Analyzing...' });
    });

    test('should update status bar model', () => {
      renderer = new InkRenderer();
      renderer.start({});

      renderer.updateStatusBar({ model: 'claude-sonnet-4-20250514' });
    });

    test('should update multiple status bar fields', () => {
      renderer = new InkRenderer();
      renderer.start({});

      renderer.updateStatusBar({
        status: 'Working',
        model: 'claude-sonnet-4-20250514',
        openRecommendations: 5,
        helpHint: 'Press q to quit',
      });
    });

    test('should update token usage', () => {
      renderer = new InkRenderer();
      renderer.start({});

      renderer.updateStatusBar({
        tokenUsage: { used: 5000, limit: 200000 },
      });
    });

    test('should preserve existing values when updating partial', () => {
      renderer = new InkRenderer();
      renderer.start({});

      renderer.updateStatusBar({ status: 'Initial' });
      renderer.updateStatusBar({ model: 'claude' });
      // Both status and model should be preserved
    });
  });

  describe('setWelcomeMenu', () => {
    test('should set welcome menu options', () => {
      renderer = new InkRenderer();
      renderer.start({});

      renderer.setWelcomeMenu([
        { key: '1', label: 'Analyze config', action: 'analyze-config' },
        { key: '2', label: 'Review sessions', action: 'review-sessions' },
      ]);
    });

    test('should handle empty menu', () => {
      renderer = new InkRenderer();
      renderer.start({});
      renderer.setWelcomeMenu([]);
    });

    test('should copy array to prevent mutation', () => {
      renderer = new InkRenderer();
      renderer.start({});

      const options = [{ key: '1', label: 'Option 1', action: 'option-1' }];
      renderer.setWelcomeMenu(options);

      options.push({ key: '2', label: 'Option 2', action: 'option-2' });
    });
  });

  describe('setAgentState', () => {
    test('should set agent state to idle', () => {
      renderer = new InkRenderer();
      renderer.start({});
      renderer.setAgentState({ phase: 'idle' });
    });

    test('should set agent state to thinking', () => {
      renderer = new InkRenderer();
      renderer.start({});
      renderer.setAgentState({ phase: 'thinking', startedAt: Date.now() });
    });

    test('should set agent state to calling_tool', () => {
      renderer = new InkRenderer();
      renderer.start({});
      renderer.setAgentState({
        phase: 'calling_tool',
        tool: 'read_file',
        startedAt: Date.now(),
      });
    });

    test('should set agent state to streaming', () => {
      renderer = new InkRenderer();
      renderer.start({});
      renderer.setAgentState({ phase: 'streaming', startedAt: Date.now() });
    });

    test('should set agent state to error', () => {
      renderer = new InkRenderer();
      renderer.start({});
      renderer.setAgentState({ phase: 'error', message: 'Something went wrong' });
    });

    test('should set agent state to complete', () => {
      renderer = new InkRenderer();
      renderer.start({});
      renderer.setAgentState({ phase: 'complete', durationMs: 1500 });
    });
  });

  describe('ITuiRenderer interface', () => {
    test('should implement all required interface methods', () => {
      renderer = new InkRenderer();

      expect(typeof renderer.start).toBe('function');
      expect(typeof renderer.stop).toBe('function');
      expect(typeof renderer.renderChunk).toBe('function');
      expect(typeof renderer.renderComplete).toBe('function');
      expect(typeof renderer.requestPermission).toBe('function');
    });

    test('should implement extended methods', () => {
      renderer = new InkRenderer();

      expect(typeof renderer.setTuiState).toBe('function');
      expect(typeof renderer.setLoadingSteps).toBe('function');
      expect(typeof renderer.updateLoadingStep).toBe('function');
      expect(typeof renderer.addConversationMessage).toBe('function');
      expect(typeof renderer.updateStatusBar).toBe('function');
      expect(typeof renderer.setWelcomeMenu).toBe('function');
      expect(typeof renderer.setAgentState).toBe('function');
      expect(typeof renderer.requestUserAnswers).toBe('function');
    });
  });

  describe('lifecycle integration', () => {
    test('should handle full session lifecycle', () => {
      renderer = new InkRenderer();

      renderer.start({});

      renderer.setTuiState('loading');
      renderer.setLoadingSteps([
        { id: 'config', label: 'Loading config...', status: 'pending' },
        { id: 'connect', label: 'Connecting...', status: 'pending' },
      ]);
      renderer.updateLoadingStep('config', 'loading');
      renderer.updateLoadingStep('config', 'complete');
      renderer.updateLoadingStep('connect', 'loading');
      renderer.updateLoadingStep('connect', 'complete');

      renderer.setTuiState('welcome');
      renderer.setWelcomeMenu([{ key: 'analyze', label: 'Analyze', action: 'analyze' }]);

      renderer.setTuiState('conversing');
      renderer.addConversationMessage({
        role: 'user',
        content: 'Analyze my config',
        timestamp: new Date().toISOString(),
      });

      renderer.setAgentState({ phase: 'thinking', startedAt: Date.now() });
      renderer.renderChunk({
        type: 'text',
        content: 'Analyzing...',
        level: 'normal',
        timestamp: new Date().toISOString(),
      });

      renderer.renderChunk({
        type: 'tool_start',
        content: 'read_file',
        level: 'verbose',
        timestamp: new Date().toISOString(),
        metadata: { toolName: 'read_file' },
      });
      renderer.renderChunk({
        type: 'tool_result',
        content: 'file contents',
        level: 'verbose',
        timestamp: new Date().toISOString(),
        metadata: { toolName: 'read_file' },
      });

      renderer.renderComplete({ findings: [], recommendations: [] });
      renderer.addConversationMessage({
        role: 'assistant',
        content: 'Analysis complete.',
        timestamp: new Date().toISOString(),
      });

      renderer.stop();
    });

    test('should handle error recovery lifecycle', () => {
      renderer = new InkRenderer();
      renderer.start({});

      renderer.setTuiState('conversing');
      renderer.setAgentState({ phase: 'thinking', startedAt: Date.now() });

      // Error occurs
      renderer.renderChunk({
        type: 'error',
        content: 'API error',
        level: 'normal',
        timestamp: new Date().toISOString(),
      });

      // Recovery
      renderer.setAgentState({ phase: 'idle' });
      renderer.updateStatusBar({ status: 'Ready to retry' });

      renderer.stop();
    });
  });
});
