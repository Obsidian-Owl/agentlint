/**
 * Unit tests for TuiPermissionHandler
 */

/* eslint-disable @typescript-eslint/unbound-method */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import {
  TuiPermissionHandler,
  createTuiCanUseTool,
} from '../../../../src/tui/permissions/tui-permission-handler';
import type { ITuiRenderer, PermissionDecision, AppProps } from '../../../../src/tui/types';
import type { StreamChunk } from '../../../../src/orchestration/types';

// =============================================================================
// Mock Renderer
// =============================================================================

/** Extract first call from mock, casting through unknown for type safety */
function getFirstCall<T>(mockFn: ReturnType<typeof mock>): T {
  const calls = mockFn.mock.calls as unknown[][];
  return calls[0] as T;
}

function createMockRenderer(): ITuiRenderer & { mockDecision: PermissionDecision } {
  const mockDecision: PermissionDecision = {
    allowed: true,
    scope: 'session',
    grantedAt: new Date().toISOString(),
    tool: 'test',
    pattern: null,
  };

  return {
    mockDecision,
    start: mock((_props: AppProps) => {}),
    stop: mock(() => {}),
    renderChunk: mock((_chunk: StreamChunk) => {}),
    renderComplete: mock((_result: unknown) => {}),
    requestPermission: mock(async (_request) => mockDecision),
    requestUserAnswers: mock(async (_request) => ({})),
    setTuiState: mock(() => {}),
    setLoadingSteps: mock(() => {}),
    updateLoadingStep: mock(() => {}),
    addConversationMessage: mock(() => {}),
    updateStatusBar: mock(() => {}),
    setWelcomeMenu: mock(() => {}),
    setAgentState: mock(() => {}),
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('TuiPermissionHandler', () => {
  let mockRenderer: ReturnType<typeof createMockRenderer>;
  let handler: TuiPermissionHandler;

  beforeEach(() => {
    mockRenderer = createMockRenderer();
    handler = new TuiPermissionHandler(mockRenderer);
  });

  describe('canUseTool', () => {
    test('should call requestPermission on renderer', async () => {
      await handler.canUseTool('read_file', { file_path: '/tmp/test.txt' });

      expect(mockRenderer.requestPermission).toHaveBeenCalled();
    });

    test('should return allow behavior when permission granted', async () => {
      mockRenderer.mockDecision.allowed = true;

      const result = await handler.canUseTool('read_file', {});

      expect(result.behavior).toBe('allow');
    });

    test('should return deny behavior when permission denied', async () => {
      mockRenderer.mockDecision.allowed = false;

      const result = await handler.canUseTool('read_file', {});

      expect(result.behavior).toBe('deny');
    });

    test('should include tool name in request', async () => {
      await handler.canUseTool('Bash', { command: 'ls -la' });

      const call = getFirstCall<[{ tool: string; description: string; pattern?: string }]>(
        mockRenderer.requestPermission as ReturnType<typeof mock>
      );
      expect(call[0].tool).toBe('Bash');
    });

    test('should include pattern from file_path', async () => {
      await handler.canUseTool('Read', { file_path: '/home/user/file.txt' });

      const call = getFirstCall<[{ tool: string; description: string; pattern?: string }]>(
        mockRenderer.requestPermission as ReturnType<typeof mock>
      );
      expect(call[0].pattern).toBe('/home/user/file.txt');
    });
  });

  describe('caching', () => {
    test('should cache session decisions', async () => {
      mockRenderer.mockDecision.scope = 'session';
      mockRenderer.mockDecision.allowed = true;

      // First call - should request permission
      await handler.canUseTool('read_file', { file_path: '/tmp/test.txt' });
      expect(mockRenderer.requestPermission).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result = await handler.canUseTool('read_file', { file_path: '/tmp/test.txt' });
      expect(mockRenderer.requestPermission).toHaveBeenCalledTimes(1);
      expect(result.behavior).toBe('allow');
    });

    test('should cache permanent decisions', async () => {
      mockRenderer.mockDecision.scope = 'permanent';
      mockRenderer.mockDecision.allowed = true;

      await handler.canUseTool('read_file', {});
      await handler.canUseTool('read_file', {});

      expect(mockRenderer.requestPermission).toHaveBeenCalledTimes(1);
    });

    test('clearCache should clear all cached decisions', async () => {
      mockRenderer.mockDecision.scope = 'session';

      await handler.canUseTool('read_file', {});
      handler.clearCache();
      await handler.canUseTool('read_file', {});

      expect(mockRenderer.requestPermission).toHaveBeenCalledTimes(2);
    });

    test('getCache should return cached decisions', async () => {
      mockRenderer.mockDecision.scope = 'session';
      mockRenderer.mockDecision.tool = 'read_file';

      await handler.canUseTool('read_file', {});

      const cache = handler.getCache();
      expect(cache.size).toBe(1);
    });
  });

  describe('auto modes', () => {
    test('should auto-approve when autoApprove is true', async () => {
      handler = new TuiPermissionHandler(mockRenderer, { autoApprove: true });

      const result = await handler.canUseTool('dangerous_tool', {});

      expect(result.behavior).toBe('allow');
      expect(mockRenderer.requestPermission).not.toHaveBeenCalled();
    });

    test('should auto-deny when autoDeny is true', async () => {
      handler = new TuiPermissionHandler(mockRenderer, { autoDeny: true });

      const result = await handler.canUseTool('any_tool', {});

      expect(result.behavior).toBe('deny');
      expect(mockRenderer.requestPermission).not.toHaveBeenCalled();
    });
  });

  describe('description building', () => {
    test('should use explicit description if provided', async () => {
      await handler.canUseTool('custom_tool', { description: 'Custom operation' });

      const call = getFirstCall<[{ tool: string; description: string; pattern?: string }]>(
        mockRenderer.requestPermission as ReturnType<typeof mock>
      );
      expect(call[0].description).toBe('Custom operation');
    });

    test('should build description for Bash commands', async () => {
      await handler.canUseTool('Bash', { command: 'npm install' });

      const call = getFirstCall<[{ tool: string; description: string; pattern?: string }]>(
        mockRenderer.requestPermission as ReturnType<typeof mock>
      );
      expect(call[0].description).toContain('npm install');
    });

    test('should build description for Read tool', async () => {
      await handler.canUseTool('Read', { file_path: '/etc/passwd' });

      const call = getFirstCall<[{ tool: string; description: string; pattern?: string }]>(
        mockRenderer.requestPermission as ReturnType<typeof mock>
      );
      expect(call[0].description).toContain('/etc/passwd');
    });

    test('should build description for Write tool', async () => {
      await handler.canUseTool('Write', { file_path: '/tmp/output.txt' });

      const call = getFirstCall<[{ tool: string; description: string; pattern?: string }]>(
        mockRenderer.requestPermission as ReturnType<typeof mock>
      );
      expect(call[0].description).toContain('/tmp/output.txt');
    });
  });
});

describe('AskUserQuestion handling', () => {
  let mockRenderer: ReturnType<typeof createMockRenderer>;
  let handler: TuiPermissionHandler;

  beforeEach(() => {
    mockRenderer = createMockRenderer();
    handler = new TuiPermissionHandler(mockRenderer);
  });

  test('should call requestUserAnswers for AskUserQuestion tool', async () => {
    const questions = [
      {
        question: 'What framework?',
        header: 'Framework',
        options: [{ label: 'React' }, { label: 'Vue' }],
      },
    ];

    await handler.canUseTool('AskUserQuestion', { questions });

    expect(mockRenderer.requestUserAnswers).toHaveBeenCalled();
  });

  test('should not call requestPermission for AskUserQuestion', async () => {
    const questions = [
      {
        question: 'What framework?',
        header: 'Framework',
        options: [{ label: 'React' }, { label: 'Vue' }],
      },
    ];

    await handler.canUseTool('AskUserQuestion', { questions });

    expect(mockRenderer.requestPermission).not.toHaveBeenCalled();
  });

  test('should return allow behavior with answers in updatedInput', async () => {
    const mockAnswers = { 'What framework?': 'React' };
    mockRenderer.requestUserAnswers = mock(async () => mockAnswers);

    const questions = [
      {
        question: 'What framework?',
        header: 'Framework',
        options: [{ label: 'React' }, { label: 'Vue' }],
      },
    ];

    const result = await handler.canUseTool('AskUserQuestion', { questions });

    expect(result.behavior).toBe('allow');
    if (result.behavior === 'allow') {
      expect(result.updatedInput).toBeDefined();
      expect((result.updatedInput as { answers: Record<string, string> }).answers).toEqual(
        mockAnswers
      );
    }
  });

  test('should auto-approve in autoApprove mode without asking questions', async () => {
    handler = new TuiPermissionHandler(mockRenderer, { autoApprove: true });

    const questions = [
      {
        question: 'What framework?',
        header: 'Framework',
        options: [{ label: 'React' }],
      },
    ];

    const result = await handler.canUseTool('AskUserQuestion', { questions });

    expect(result.behavior).toBe('allow');
    expect(mockRenderer.requestUserAnswers).not.toHaveBeenCalled();
  });

  test('should auto-deny in autoDeny mode', async () => {
    handler = new TuiPermissionHandler(mockRenderer, { autoDeny: true });

    const questions = [
      {
        question: 'What framework?',
        header: 'Framework',
        options: [{ label: 'React' }],
      },
    ];

    const result = await handler.canUseTool('AskUserQuestion', { questions });

    expect(result.behavior).toBe('deny');
    expect(mockRenderer.requestUserAnswers).not.toHaveBeenCalled();
  });

  test('should handle empty questions array', async () => {
    const result = await handler.canUseTool('AskUserQuestion', { questions: [] });

    expect(result.behavior).toBe('allow');
    expect(mockRenderer.requestUserAnswers).not.toHaveBeenCalled();
  });
});

describe('createTuiCanUseTool', () => {
  test('should return a function', () => {
    const mockRenderer = createMockRenderer();
    const canUseTool = createTuiCanUseTool(mockRenderer);

    expect(typeof canUseTool).toBe('function');
  });

  test('should work as a callback', async () => {
    const mockRenderer = createMockRenderer();
    mockRenderer.mockDecision.allowed = true;

    const canUseTool = createTuiCanUseTool(mockRenderer);
    const result = await canUseTool('test_tool', {});

    expect(result.behavior).toBe('allow');
  });
});
