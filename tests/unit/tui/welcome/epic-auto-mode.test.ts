import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  detectInterruptedEpic,
  clearEpicAutoMode,
  getEpicAutoModePath,
} from '../../../../src/tui/welcome/epic-auto-mode';

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `agentlint-test-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

describe('epic-auto-mode utilities', () => {
  describe('getEpicAutoModePath', () => {
    test('should return correct path', () => {
      const path = getEpicAutoModePath(testDir);
      expect(path).toBe(join(testDir, '.agent', 'epic-auto-mode'));
    });

    test('should work with different project paths', () => {
      const path1 = getEpicAutoModePath('/path/to/project1');
      const path2 = getEpicAutoModePath('/path/to/project2');

      expect(path1).not.toBe(path2);
      expect(path1).toContain('project1');
      expect(path2).toContain('project2');
    });
  });

  describe('detectInterruptedEpic', () => {
    test('should return null when file does not exist', () => {
      const result = detectInterruptedEpic(testDir);
      expect(result).toBeNull();
    });

    test('should return null when .agent directory does not exist', () => {
      const result = detectInterruptedEpic(testDir);
      expect(result).toBeNull();
    });

    test('should parse valid epic-auto-mode file', () => {
      const agentDir = join(testDir, '.agent');
      mkdirSync(agentDir, { recursive: true });

      const fileContent = {
        epicId: 'EP15',
        epicTitle: 'Session Intelligence',
        lastTask: 'T003',
        lastTaskTitle: 'Session metadata extraction',
        completedTasks: 3,
        totalTasks: 8,
        featureDir: '/path/to/feature',
      };

      writeFileSync(join(agentDir, 'epic-auto-mode'), JSON.stringify(fileContent));

      const result = detectInterruptedEpic(testDir);

      expect(result).not.toBeNull();
      expect(result?.epicId).toBe('EP15');
      expect(result?.epicTitle).toBe('Session Intelligence');
      expect(result?.lastTask).toBe('T003');
      expect(result?.lastTaskTitle).toBe('Session metadata extraction');
      expect(result?.completedTasks).toBe(3);
      expect(result?.totalTasks).toBe(8);
      expect(result?.featureDir).toBe('/path/to/feature');
    });

    test('should return null for malformed JSON', () => {
      const agentDir = join(testDir, '.agent');
      mkdirSync(agentDir, { recursive: true });

      writeFileSync(join(agentDir, 'epic-auto-mode'), 'not valid json {');

      const result = detectInterruptedEpic(testDir);
      expect(result).toBeNull();
    });

    test('should return null for empty file', () => {
      const agentDir = join(testDir, '.agent');
      mkdirSync(agentDir, { recursive: true });

      writeFileSync(join(agentDir, 'epic-auto-mode'), '');

      const result = detectInterruptedEpic(testDir);
      expect(result).toBeNull();
    });

    test('should handle file with missing fields gracefully', () => {
      const agentDir = join(testDir, '.agent');
      mkdirSync(agentDir, { recursive: true });

      const fileContent = {
        epicId: 'EP15',
        epicTitle: 'Session Intelligence',
      };

      writeFileSync(join(agentDir, 'epic-auto-mode'), JSON.stringify(fileContent));

      const result = detectInterruptedEpic(testDir);
      expect(result).not.toBeNull();
      expect(result?.epicId).toBe('EP15');
      expect(result?.lastTask).toBeUndefined();
    });

    test('should handle different epic IDs', () => {
      const agentDir = join(testDir, '.agent');
      mkdirSync(agentDir, { recursive: true });

      const fileContent = {
        epicId: 'EP20',
        epicTitle: 'Different Epic',
        lastTask: 'T001',
        lastTaskTitle: 'First task',
        completedTasks: 1,
        totalTasks: 5,
        featureDir: '/path/to/feature',
      };

      writeFileSync(join(agentDir, 'epic-auto-mode'), JSON.stringify(fileContent));

      const result = detectInterruptedEpic(testDir);
      expect(result?.epicId).toBe('EP20');
      expect(result?.epicTitle).toBe('Different Epic');
    });

    test('should handle zero progress', () => {
      const agentDir = join(testDir, '.agent');
      mkdirSync(agentDir, { recursive: true });

      const fileContent = {
        epicId: 'EP15',
        epicTitle: 'Session Intelligence',
        lastTask: 'T001',
        lastTaskTitle: 'First task',
        completedTasks: 0,
        totalTasks: 8,
        featureDir: '/path/to/feature',
      };

      writeFileSync(join(agentDir, 'epic-auto-mode'), JSON.stringify(fileContent));

      const result = detectInterruptedEpic(testDir);
      expect(result?.completedTasks).toBe(0);
      expect(result?.totalTasks).toBe(8);
    });
  });

  describe('clearEpicAutoMode', () => {
    test('should delete the epic-auto-mode file', () => {
      const agentDir = join(testDir, '.agent');
      mkdirSync(agentDir, { recursive: true });

      const filePath = join(agentDir, 'epic-auto-mode');
      writeFileSync(filePath, JSON.stringify({ epicId: 'EP15' }));

      expect(existsSync(filePath)).toBe(true);

      clearEpicAutoMode(testDir);

      expect(existsSync(filePath)).toBe(false);
    });

    test('should not throw when file does not exist', () => {
      expect(() => {
        clearEpicAutoMode(testDir);
      }).not.toThrow();
    });

    test('should not throw when .agent directory does not exist', () => {
      expect(() => {
        clearEpicAutoMode(testDir);
      }).not.toThrow();
    });

    test('should only delete epic-auto-mode file, not entire directory', () => {
      const agentDir = join(testDir, '.agent');
      mkdirSync(agentDir, { recursive: true });

      const filePath = join(agentDir, 'epic-auto-mode');
      const otherFile = join(agentDir, 'other-file');

      writeFileSync(filePath, JSON.stringify({ epicId: 'EP15' }));
      writeFileSync(otherFile, 'other content');

      clearEpicAutoMode(testDir);

      expect(existsSync(filePath)).toBe(false);
      expect(existsSync(otherFile)).toBe(true);
      expect(existsSync(agentDir)).toBe(true);
    });
  });

  describe('integration', () => {
    test('should detect, then clear epic-auto-mode', () => {
      const agentDir = join(testDir, '.agent');
      mkdirSync(agentDir, { recursive: true });

      const fileContent = {
        epicId: 'EP15',
        epicTitle: 'Session Intelligence',
        lastTask: 'T003',
        lastTaskTitle: 'Session metadata extraction',
        completedTasks: 3,
        totalTasks: 8,
        featureDir: '/path/to/feature',
      };

      writeFileSync(join(agentDir, 'epic-auto-mode'), JSON.stringify(fileContent));

      const detected = detectInterruptedEpic(testDir);
      expect(detected).not.toBeNull();
      expect(detected?.epicId).toBe('EP15');

      clearEpicAutoMode(testDir);

      const afterClear = detectInterruptedEpic(testDir);
      expect(afterClear).toBeNull();
    });
  });
});
