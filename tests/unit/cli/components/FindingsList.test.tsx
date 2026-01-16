/**
 * T037: Unit tests for FindingsList component
 *
 * Tests US-001: Analyse with Streaming Output
 * Tests FR-005: Display findings as they are discovered
 */

import { describe, test, expect } from 'bun:test';
import { render } from 'ink-testing-library';
import { FindingsList } from '../../../../src/cli/components/FindingsList';
import type { Finding } from '../../../../src/orchestration';

// Helper to create test findings
function createFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: 'test-finding-1',
    type: 'config_gap',
    severity: 'medium',
    title: 'Test Finding',
    description: 'This is a test finding description',
    location: null,
    origin: null,
    recommendations: [],
    detectedAt: new Date().toISOString(),
    detectedInPhase: 'analyzing',
    ...overrides,
  };
}

describe('FindingsList component', () => {
  describe('rendering', () => {
    test('renders without crashing with empty list', () => {
      const { lastFrame } = render(<FindingsList findings={[]} />);
      expect(lastFrame()).toBeDefined();
    });

    test('renders single finding', () => {
      const findings = [createFinding({ title: 'Missing CLAUDE.md' })];
      const { lastFrame } = render(<FindingsList findings={findings} />);
      expect(lastFrame()).toContain('Missing CLAUDE.md');
    });

    test('renders multiple findings', () => {
      const findings = [
        createFinding({ id: '1', title: 'First finding' }),
        createFinding({ id: '2', title: 'Second finding' }),
        createFinding({ id: '3', title: 'Third finding' }),
      ];
      const { lastFrame } = render(<FindingsList findings={findings} />);
      const frame = lastFrame() ?? '';
      expect(frame).toContain('First finding');
      expect(frame).toContain('Second finding');
      expect(frame).toContain('Third finding');
    });
  });

  describe('severity display', () => {
    test('displays critical severity', () => {
      const findings = [createFinding({ severity: 'critical', title: 'Critical issue' })];
      const { lastFrame } = render(<FindingsList findings={findings} />);
      const frame = lastFrame() ?? '';
      expect(frame.toLowerCase()).toContain('critical');
    });

    test('displays high severity', () => {
      const findings = [createFinding({ severity: 'high', title: 'High issue' })];
      const { lastFrame } = render(<FindingsList findings={findings} />);
      const frame = lastFrame() ?? '';
      expect(frame.toLowerCase()).toContain('high');
    });

    test('displays medium severity', () => {
      const findings = [createFinding({ severity: 'medium', title: 'Medium issue' })];
      const { lastFrame } = render(<FindingsList findings={findings} />);
      const frame = lastFrame() ?? '';
      expect(frame.toLowerCase()).toContain('medium');
    });

    test('displays low severity', () => {
      const findings = [createFinding({ severity: 'low', title: 'Low issue' })];
      const { lastFrame } = render(<FindingsList findings={findings} />);
      const frame = lastFrame() ?? '';
      expect(frame.toLowerCase()).toContain('low');
    });

    test('displays info severity', () => {
      const findings = [createFinding({ severity: 'info', title: 'Info item' })];
      const { lastFrame } = render(<FindingsList findings={findings} />);
      const frame = lastFrame() ?? '';
      // Info might not be explicitly labeled but should render
      expect(frame).toContain('Info item');
    });
  });

  describe('finding types', () => {
    test('displays config gap findings', () => {
      const findings = [createFinding({ type: 'config_gap', title: 'Config gap' })];
      const { lastFrame } = render(<FindingsList findings={findings} />);
      expect(lastFrame()).toContain('Config gap');
    });

    test('displays config antipattern findings', () => {
      const findings = [createFinding({ type: 'config_antipattern', title: 'Bad pattern' })];
      const { lastFrame } = render(<FindingsList findings={findings} />);
      expect(lastFrame()).toContain('Bad pattern');
    });

    test('displays session pattern findings', () => {
      const findings = [createFinding({ type: 'session_pattern', title: 'Session issue' })];
      const { lastFrame } = render(<FindingsList findings={findings} />);
      expect(lastFrame()).toContain('Session issue');
    });
  });

  describe('location display', () => {
    test('shows file location when present', () => {
      const findings = [
        createFinding({
          title: 'Located finding',
          location: { file: 'CLAUDE.md', line: 42 },
        }),
      ];
      const { lastFrame } = render(<FindingsList findings={findings} />);
      const frame = lastFrame() ?? '';
      expect(frame).toContain('CLAUDE.md');
    });

    test('shows line number when present', () => {
      const findings = [
        createFinding({
          title: 'Located finding',
          location: { file: 'CLAUDE.md', line: 42 },
        }),
      ];
      const { lastFrame } = render(<FindingsList findings={findings} />);
      const frame = lastFrame() ?? '';
      expect(frame).toContain('42');
    });

    test('handles findings without location', () => {
      const findings = [createFinding({ location: null })];
      const { lastFrame } = render(<FindingsList findings={findings} />);
      expect(lastFrame()).toBeDefined();
    });
  });

  describe('empty state', () => {
    test('shows message when no findings', () => {
      const { lastFrame } = render(<FindingsList findings={[]} showEmpty={true} />);
      const frame = lastFrame() ?? '';
      // Should show some indication of empty state
      expect(frame.length).toBeGreaterThan(0);
    });

    test('renders nothing with empty list by default', () => {
      const { lastFrame } = render(<FindingsList findings={[]} />);
      // May render empty or minimal output
      expect(lastFrame()).toBeDefined();
    });
  });

  describe('compact mode', () => {
    test('renders in compact mode', () => {
      const findings = [createFinding({ title: 'Compact finding' })];
      const { lastFrame } = render(<FindingsList findings={findings} compact={true} />);
      expect(lastFrame()).toContain('Compact finding');
    });

    test('compact mode shows less detail', () => {
      const findings = [
        createFinding({
          title: 'Test',
          description: 'A very long description that should be hidden in compact mode',
        }),
      ];
      const compactRender = render(<FindingsList findings={findings} compact={true} />);
      const fullRender = render(<FindingsList findings={findings} compact={false} />);

      // Compact should generally be shorter or equal
      const compactLength = (compactRender.lastFrame() ?? '').length;
      const fullLength = (fullRender.lastFrame() ?? '').length;
      expect(compactLength).toBeLessThanOrEqual(fullLength);
    });
  });

  describe('streaming updates', () => {
    test('can be updated with new findings', () => {
      const { lastFrame, rerender } = render(<FindingsList findings={[]} />);
      expect(lastFrame()).toBeDefined();

      const newFindings = [createFinding({ title: 'New finding' })];
      rerender(<FindingsList findings={newFindings} />);
      expect(lastFrame()).toContain('New finding');
    });

    test('handles rapid updates', () => {
      const { lastFrame, rerender } = render(<FindingsList findings={[]} />);

      for (let i = 0; i < 5; i++) {
        const findings = [createFinding({ id: `f-${i}`, title: `Finding ${i}` })];
        rerender(<FindingsList findings={findings} />);
      }

      expect(lastFrame()).toContain('Finding 4');
    });
  });

  describe('recommendations', () => {
    test('shows recommendation count when present', () => {
      const findings = [
        createFinding({
          title: 'With recs',
          recommendations: [
            {
              type: 'preventive',
              action: 'Add project context',
              rationale: 'Helps Claude understand',
              priority: 'high',
            },
          ],
        }),
      ];
      const { lastFrame } = render(<FindingsList findings={findings} showRecommendations={true} />);
      const frame = lastFrame() ?? '';
      // Should indicate recommendations exist
      expect(frame).toContain('Add project context');
    });
  });
});
