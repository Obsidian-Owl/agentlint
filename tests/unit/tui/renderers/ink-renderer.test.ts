/**
 * Unit tests for InkRenderer
 *
 * Tests the Ink-based TUI renderer implementation.
 */

import { describe, test, expect, mock, afterEach } from 'bun:test';
import { InkRenderer } from '../../../../src/tui/renderers/ink-renderer';
import type { StreamChunk } from '../../../../src/orchestration/types';

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
      expect(renderer).toBeDefined();
    });
  });

  describe('start', () => {
    test('should start without throwing', () => {
      renderer = new InkRenderer();
      expect(() => {
        renderer.start({});
      }).not.toThrow();
    });

    test('should accept props', () => {
      renderer = new InkRenderer();
      const onInput = mock(() => {});
      const onExit = mock(() => {});

      expect(() => {
        renderer.start({
          onInput,
          onExit,
        });
      }).not.toThrow();
    });
  });

  describe('stop', () => {
    test('should stop without throwing', () => {
      renderer = new InkRenderer();
      renderer.start({});

      expect(() => {
        renderer.stop();
      }).not.toThrow();
    });

    test('should be idempotent', () => {
      renderer = new InkRenderer();
      renderer.start({});

      expect(() => {
        renderer.stop();
        renderer.stop();
      }).not.toThrow();
    });

    test('should be callable before start', () => {
      renderer = new InkRenderer();

      expect(() => {
        renderer.stop();
      }).not.toThrow();
    });
  });

  describe('renderChunk', () => {
    test('should accept text chunk', () => {
      renderer = new InkRenderer();
      renderer.start({});

      const chunk: StreamChunk = {
        type: 'text',
        content: 'Hello world',
        level: 'normal',
        timestamp: new Date().toISOString(),
      };

      expect(() => {
        renderer.renderChunk(chunk);
      }).not.toThrow();
    });

    test('should accept multiple chunks', () => {
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
      ];

      for (const chunk of chunks) {
        expect(() => {
          renderer.renderChunk(chunk);
        }).not.toThrow();
      }
    });
  });

  describe('renderComplete', () => {
    test('should handle completion', () => {
      renderer = new InkRenderer();
      renderer.start({});

      expect(() => {
        renderer.renderComplete({ success: true });
      }).not.toThrow();
    });

    test('should handle various result types', () => {
      renderer = new InkRenderer();
      renderer.start({});

      expect(() => {
        renderer.renderComplete(null);
        renderer.renderComplete({ findings: [] });
        renderer.renderComplete('done');
      }).not.toThrow();
    });
  });

  describe('requestPermission', () => {
    test('should return a promise', async () => {
      renderer = new InkRenderer();
      renderer.start({});

      const request = {
        tool: 'read_file',
        description: 'Read a file',
      };

      const promise = renderer.requestPermission(request);
      expect(promise).toBeInstanceOf(Promise);

      // Resolve immediately for testing (implementation may differ)
      // This is a basic test - full integration tests would handle the dialog
    });

    test('should accept pattern', async () => {
      renderer = new InkRenderer();
      renderer.start({});

      const request = {
        tool: 'write_file',
        description: 'Write to file',
        pattern: '/tmp/*.txt',
      };

      const promise = renderer.requestPermission(request);
      expect(promise).toBeInstanceOf(Promise);
    });
  });

  describe('ITuiRenderer interface', () => {
    test('should implement all interface methods', () => {
      renderer = new InkRenderer();

      expect(typeof renderer.start).toBe('function');
      expect(typeof renderer.stop).toBe('function');
      expect(typeof renderer.renderChunk).toBe('function');
      expect(typeof renderer.renderComplete).toBe('function');
      expect(typeof renderer.requestPermission).toBe('function');
    });
  });
});
