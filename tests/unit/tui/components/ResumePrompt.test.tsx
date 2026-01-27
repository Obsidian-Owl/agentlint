import { describe, test, expect, mock, afterEach } from 'bun:test';
import { render, cleanup } from 'ink-testing-library';
import { ResumePrompt } from '../../../../src/tui/components/ResumePrompt';
import type { EpicAutoModeState } from '../../../../src/tui/components/ResumePrompt';

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

function createMockState(): EpicAutoModeState {
  return {
    epicId: 'EP15',
    epicTitle: 'Session Intelligence',
    lastTask: 'T003',
    lastTaskTitle: 'Session metadata extraction',
    completedTasks: 3,
    totalTasks: 8,
    featureDir: '/path/to/feature',
  };
}

describe('ResumePrompt', () => {
  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    test('should render title', async () => {
      const { lastFrame } = render(<ResumePrompt state={createMockState()} onSelect={() => {}} />);

      await tick();

      expect(lastFrame()).toContain('Interrupted work detected!');
    });

    test('should render epic information', async () => {
      const { lastFrame } = render(<ResumePrompt state={createMockState()} onSelect={() => {}} />);

      await tick();

      expect(lastFrame()).toContain('EP15');
      expect(lastFrame()).toContain('Session Intelligence');
    });

    test('should render last task information', async () => {
      const { lastFrame } = render(<ResumePrompt state={createMockState()} onSelect={() => {}} />);

      await tick();

      expect(lastFrame()).toContain('T003');
      expect(lastFrame()).toContain('Session metadata extraction');
    });

    test('should render progress information', async () => {
      const { lastFrame } = render(<ResumePrompt state={createMockState()} onSelect={() => {}} />);

      await tick();

      expect(lastFrame()).toContain('3/8');
      expect(lastFrame()).toContain('tasks complete');
    });

    test('should render all three options', async () => {
      const { lastFrame } = render(<ResumePrompt state={createMockState()} onSelect={() => {}} />);

      await tick();

      expect(lastFrame()).toContain('[1]');
      expect(lastFrame()).toContain('Resume where you left off');
      expect(lastFrame()).toContain('[2]');
      expect(lastFrame()).toContain('Start fresh analysis');
      expect(lastFrame()).toContain('[3]');
      expect(lastFrame()).toContain('Discard interrupted state');
    });

    test('should render recommended label on first option', async () => {
      const { lastFrame } = render(<ResumePrompt state={createMockState()} onSelect={() => {}} />);

      await tick();

      expect(lastFrame()).toContain('Recommended');
    });

    test('should render hint text', async () => {
      const { lastFrame } = render(<ResumePrompt state={createMockState()} onSelect={() => {}} />);

      await tick();

      expect(lastFrame()).toContain('Press 1, 2, or 3 to choose');
    });
  });

  describe('keyboard selection', () => {
    test('should call onSelect with resume when 1 is pressed', async () => {
      const onSelect = mock(() => {});
      const { stdin } = render(<ResumePrompt state={createMockState()} onSelect={onSelect} />);

      await tick();
      stdin.write('1');
      await tick();

      expect(onSelect).toHaveBeenCalledWith('resume');
    });

    test('should call onSelect with fresh when 2 is pressed', async () => {
      const onSelect = mock(() => {});
      const { stdin } = render(<ResumePrompt state={createMockState()} onSelect={onSelect} />);

      await tick();
      stdin.write('2');
      await tick();

      expect(onSelect).toHaveBeenCalledWith('fresh');
    });

    test('should call onSelect with discard when 3 is pressed', async () => {
      const onSelect = mock(() => {});
      const { stdin } = render(<ResumePrompt state={createMockState()} onSelect={onSelect} />);

      await tick();
      stdin.write('3');
      await tick();

      expect(onSelect).toHaveBeenCalledWith('discard');
    });

    test('should not call onSelect for unrecognized key', async () => {
      const onSelect = mock(() => {});
      const { stdin } = render(<ResumePrompt state={createMockState()} onSelect={onSelect} />);

      await tick();
      stdin.write('9');
      await tick();

      expect(onSelect).not.toHaveBeenCalled();
    });

    test('should not call onSelect when disabled', async () => {
      const onSelect = mock(() => {});
      const { stdin } = render(
        <ResumePrompt state={createMockState()} onSelect={onSelect} disabled={true} />
      );

      await tick();
      stdin.write('1');
      await tick();

      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('different epic states', () => {
    test('should render different epic IDs', async () => {
      const state = createMockState();
      state.epicId = 'EP20';
      const { lastFrame } = render(<ResumePrompt state={state} onSelect={() => {}} />);

      await tick();

      expect(lastFrame()).toContain('EP20');
    });

    test('should render different progress values', async () => {
      const state = createMockState();
      state.completedTasks = 7;
      state.totalTasks = 10;
      const { lastFrame } = render(<ResumePrompt state={state} onSelect={() => {}} />);

      await tick();

      expect(lastFrame()).toContain('7/10');
    });

    test('should render zero progress', async () => {
      const state = createMockState();
      state.completedTasks = 0;
      state.totalTasks = 5;
      const { lastFrame } = render(<ResumePrompt state={state} onSelect={() => {}} />);

      await tick();

      expect(lastFrame()).toContain('0/5');
    });
  });
});
