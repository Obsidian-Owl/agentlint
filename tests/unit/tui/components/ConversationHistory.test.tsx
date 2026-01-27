import { describe, test, expect, afterEach } from 'bun:test';
import { render, cleanup } from 'ink-testing-library';
import { ConversationHistory } from '../../../../src/tui/components/ConversationHistory';
import type { ConversationMessage } from '../../../../src/tui/types';

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

function createMessage(role: 'user' | 'assistant', content: string): ConversationMessage {
  return {
    role,
    content,
    timestamp: new Date().toISOString(),
  };
}

describe('ConversationHistory', () => {
  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    test('should return null for empty messages', async () => {
      const { lastFrame } = render(<ConversationHistory messages={[]} />);

      await tick();

      expect(lastFrame()).toBe('');
    });

    test('should render user message with correct icon', async () => {
      const messages = [createMessage('user', 'Hello, agent!')];
      const { lastFrame } = render(<ConversationHistory messages={messages} />);

      await tick();

      expect(lastFrame()).toContain('>');
      expect(lastFrame()).toContain('Hello, agent!');
    });

    test('should render assistant message with correct icon', async () => {
      const messages = [createMessage('assistant', 'Hello, user!')];
      const { lastFrame } = render(<ConversationHistory messages={messages} />);

      await tick();

      expect(lastFrame()).toContain('◆');
      expect(lastFrame()).toContain('Hello, user!');
    });

    test('should render multiple messages', async () => {
      const messages = [
        createMessage('user', 'First message'),
        createMessage('assistant', 'First response'),
        createMessage('user', 'Second message'),
      ];
      const { lastFrame } = render(<ConversationHistory messages={messages} />);

      await tick();

      expect(lastFrame()).toContain('First message');
      expect(lastFrame()).toContain('First response');
      expect(lastFrame()).toContain('Second message');
    });
  });

  describe('display limiting', () => {
    test('should display only last N messages by default (6)', async () => {
      const messages = Array.from({ length: 10 }, (_, i) =>
        createMessage(i % 2 === 0 ? 'user' : 'assistant', `Msg-${String(i + 1).padStart(2, '0')}`)
      );
      const { lastFrame } = render(<ConversationHistory messages={messages} />);

      await tick();

      expect(lastFrame()).not.toContain('Msg-01');
      expect(lastFrame()).not.toContain('Msg-04');
      expect(lastFrame()).toContain('Msg-05');
      expect(lastFrame()).toContain('Msg-10');
    });

    test('should respect custom maxDisplay', async () => {
      const messages = Array.from({ length: 10 }, (_, i) =>
        createMessage(i % 2 === 0 ? 'user' : 'assistant', `Msg-${String(i + 1).padStart(2, '0')}`)
      );
      const { lastFrame } = render(<ConversationHistory messages={messages} maxDisplay={3} />);

      await tick();

      expect(lastFrame()).not.toContain('Msg-07');
      expect(lastFrame()).toContain('Msg-08');
      expect(lastFrame()).toContain('Msg-09');
      expect(lastFrame()).toContain('Msg-10');
    });

    test('should show all messages when fewer than maxDisplay', async () => {
      const messages = [
        createMessage('user', 'Only message'),
        createMessage('assistant', 'Only response'),
      ];
      const { lastFrame } = render(<ConversationHistory messages={messages} maxDisplay={6} />);

      await tick();

      expect(lastFrame()).toContain('Only message');
      expect(lastFrame()).toContain('Only response');
    });
  });

  describe('message content', () => {
    test('should handle long messages', async () => {
      const longContent = 'A'.repeat(200);
      const messages = [createMessage('user', longContent)];
      const { lastFrame } = render(<ConversationHistory messages={messages} />);

      await tick();

      expect(lastFrame()).toContain('A'.repeat(50));
    });

    test('should handle messages with special characters', async () => {
      const messages = [createMessage('user', 'Hello! @#$%^&*() special chars')];
      const { lastFrame } = render(<ConversationHistory messages={messages} />);

      await tick();

      expect(lastFrame()).toContain('@#$%^&*()');
    });

    test('should handle unicode content', async () => {
      const messages = [createMessage('assistant', 'こんにちは 👋')];
      const { lastFrame } = render(<ConversationHistory messages={messages} />);

      await tick();

      expect(lastFrame()).toContain('こんにちは');
    });
  });
});
