/**
 * EP07 Causal Tracing Engine - Config State Snapshot Tests (T056)
 *
 * Unit tests for ConfigSnapshot that captures configuration state
 * at the time an issue was detected for causal analysis.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// =============================================================================
// Test Fixtures
// =============================================================================

const TEST_BASE_DIR = join(tmpdir(), 'agentlint-config-snapshot-test');

/**
 * Create a test project with config files.
 */
function createTestProject(): string {
  const projectDir = join(TEST_BASE_DIR, `project-${Date.now()}`);
  mkdirSync(projectDir, { recursive: true });

  // Create CLAUDE.md
  writeFileSync(
    join(projectDir, 'CLAUDE.md'),
    `# Test Project

## Guidelines
- Use TypeScript
- Follow TDD

## Secrets
Never commit API keys.
`
  );

  // Create .claude directory
  const claudeDir = join(projectDir, '.claude');
  mkdirSync(claudeDir, { recursive: true });

  // Create settings.json
  writeFileSync(
    join(claudeDir, 'settings.json'),
    JSON.stringify(
      {
        model: 'claude-sonnet',
        permissions: {
          allow: ['Edit', 'Read'],
        },
      },
      null,
      2
    )
  );

  // Create .mcp.json
  writeFileSync(
    join(projectDir, '.mcp.json'),
    JSON.stringify(
      {
        mcpServers: {
          filesystem: {
            command: 'fs-server',
          },
        },
      },
      null,
      2
    )
  );

  return projectDir;
}

// =============================================================================
// ConfigSnapshot Tests
// =============================================================================

describe('ConfigSnapshot', () => {
  let ConfigSnapshot: typeof import('../../../../src/tools/causal/config-snapshot').ConfigSnapshot;
  let createConfigSnapshot: typeof import('../../../../src/tools/causal/config-snapshot').createConfigSnapshot;
  let captureConfigState: typeof import('../../../../src/tools/causal/config-snapshot').captureConfigState;

  beforeEach(async () => {
    if (existsSync(TEST_BASE_DIR)) {
      rmSync(TEST_BASE_DIR, { recursive: true });
    }
    mkdirSync(TEST_BASE_DIR, { recursive: true });

    const module = await import('../../../../src/tools/causal/config-snapshot');
    ConfigSnapshot = module.ConfigSnapshot;
    createConfigSnapshot = module.createConfigSnapshot;
    captureConfigState = module.captureConfigState;
  });

  afterEach(() => {
    if (existsSync(TEST_BASE_DIR)) {
      rmSync(TEST_BASE_DIR, { recursive: true });
    }
  });

  // ===========================================================================
  // Factory Function
  // ===========================================================================

  describe('createConfigSnapshot', () => {
    it('should create a ConfigSnapshot instance', () => {
      const projectDir = createTestProject();
      const snapshot = createConfigSnapshot(projectDir);
      expect(snapshot).toBeInstanceOf(ConfigSnapshot);
    });
  });

  // ===========================================================================
  // Capture Config State
  // ===========================================================================

  describe('captureConfigState', () => {
    it('should capture CLAUDE.md content', async () => {
      const projectDir = createTestProject();
      const snapshot = createConfigSnapshot(projectDir);

      const state = snapshot.capture();

      expect(state.claudeMd).toBeDefined();
      expect(state.claudeMd?.content).toContain('# Test Project');
      expect(state.claudeMd?.content).toContain('Guidelines');
    });

    it('should capture settings.json content', async () => {
      const projectDir = createTestProject();
      const snapshot = createConfigSnapshot(projectDir);

      const state = snapshot.capture();

      expect(state.projectSettings).toBeDefined();
      expect(state.projectSettings?.model).toBe('claude-sonnet');
    });

    it('should capture .mcp.json content', async () => {
      const projectDir = createTestProject();
      const snapshot = createConfigSnapshot(projectDir);

      const state = snapshot.capture();

      expect(state.mcpConfig).toBeDefined();
      const mcpServers = state.mcpConfig?.mcpServers as Record<string, unknown> | undefined;
      expect(mcpServers?.filesystem).toBeDefined();
    });

    it('should include capture timestamp', async () => {
      const projectDir = createTestProject();
      const snapshot = createConfigSnapshot(projectDir);

      const before = new Date().toISOString();
      const state = snapshot.capture();
      const after = new Date().toISOString();

      expect(state.capturedAt).toBeDefined();
      expect(state.capturedAt >= before).toBe(true);
      expect(state.capturedAt <= after).toBe(true);
    });

    it('should include project path', async () => {
      const projectDir = createTestProject();
      const snapshot = createConfigSnapshot(projectDir);

      const state = snapshot.capture();

      expect(state.projectPath).toBe(projectDir);
    });

    it('should handle missing CLAUDE.md gracefully', async () => {
      const projectDir = join(TEST_BASE_DIR, 'no-claude-md');
      mkdirSync(projectDir, { recursive: true });

      const snapshot = createConfigSnapshot(projectDir);
      const state = snapshot.capture();

      expect(state.claudeMd).toBeUndefined();
    });

    it('should handle missing settings.json gracefully', async () => {
      const projectDir = join(TEST_BASE_DIR, 'no-settings');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'CLAUDE.md'), '# Test');

      const snapshot = createConfigSnapshot(projectDir);
      const state = snapshot.capture();

      expect(state.projectSettings).toBeUndefined();
    });

    it('should handle invalid JSON in settings gracefully', async () => {
      const projectDir = join(TEST_BASE_DIR, 'invalid-json');
      mkdirSync(projectDir, { recursive: true });
      mkdirSync(join(projectDir, '.claude'), { recursive: true });
      writeFileSync(join(projectDir, '.claude', 'settings.json'), 'not valid json');

      const snapshot = createConfigSnapshot(projectDir);
      const state = snapshot.capture();

      expect(state.projectSettings).toBeUndefined();
      expect(state.warnings).toBeDefined();
      expect(state.warnings!.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // Config Comparison
  // ===========================================================================

  describe('compare', () => {
    it('should detect added config sections', async () => {
      const projectDir = createTestProject();
      const snapshot = createConfigSnapshot(projectDir);

      // Capture initial state
      const before = snapshot.capture();

      // Add new section to CLAUDE.md
      const claudeMdPath = join(projectDir, 'CLAUDE.md');
      const currentContent = before.claudeMd?.content || '';
      writeFileSync(claudeMdPath, currentContent + '\n## New Section\nNew content here.');

      // Capture after state
      const after = snapshot.capture();

      // Compare
      const diff = snapshot.compare(before, after);

      expect(diff.changes.length).toBeGreaterThan(0);
      expect(diff.changes.some((c) => c.type === 'modified' && c.file === 'CLAUDE.md')).toBe(true);
    });

    it('should detect removed config sections', async () => {
      const projectDir = createTestProject();
      const snapshot = createConfigSnapshot(projectDir);

      const before = snapshot.capture();

      // Remove a file
      rmSync(join(projectDir, '.mcp.json'));

      const after = snapshot.capture();
      const diff = snapshot.compare(before, after);

      expect(diff.changes.some((c) => c.type === 'removed' && c.file === '.mcp.json')).toBe(true);
    });

    it('should detect no changes when config unchanged', async () => {
      const projectDir = createTestProject();
      const snapshot = createConfigSnapshot(projectDir);

      const before = snapshot.capture();
      const after = snapshot.capture();
      const diff = snapshot.compare(before, after);

      expect(diff.changes).toHaveLength(0);
      expect(diff.hasChanges).toBe(false);
    });
  });

  // ===========================================================================
  // Guidance Extraction
  // ===========================================================================

  describe('extractGuidance', () => {
    it('should extract guidance sections from CLAUDE.md', async () => {
      const projectDir = createTestProject();
      const snapshot = createConfigSnapshot(projectDir);

      const state = snapshot.capture();
      const guidance = snapshot.extractGuidance(state);

      expect(guidance.length).toBeGreaterThan(0);
    });

    it('should identify guidance about secrets', async () => {
      const projectDir = createTestProject();
      const snapshot = createConfigSnapshot(projectDir);

      const state = snapshot.capture();
      const guidance = snapshot.extractGuidance(state);

      const secretGuidance = guidance.find(
        (g) =>
          g.topic.toLowerCase().includes('secret') || g.content.toLowerCase().includes('api key')
      );
      expect(secretGuidance).toBeDefined();
    });

    it('should categorize guidance by type', async () => {
      const projectDir = createTestProject();
      const snapshot = createConfigSnapshot(projectDir);

      const state = snapshot.capture();
      const guidance = snapshot.extractGuidance(state);

      for (const g of guidance) {
        expect(['convention', 'security', 'process', 'other']).toContain(g.category);
      }
    });
  });

  // ===========================================================================
  // Standalone Function
  // ===========================================================================

  describe('captureConfigState function', () => {
    it('should capture config state with one call', async () => {
      const projectDir = createTestProject();

      const state = captureConfigState(projectDir);

      expect(state.projectPath).toBe(projectDir);
      expect(state.claudeMd).toBeDefined();
    });
  });
});

// =============================================================================
// ConfigState Type Tests
// =============================================================================

describe('ConfigState type', () => {
  it('should have required fields', async () => {
    const { createConfigSnapshot } = await import('../../../../src/tools/causal/config-snapshot');

    const projectDir = join(TEST_BASE_DIR, 'type-test');
    mkdirSync(projectDir, { recursive: true });

    const snapshot = createConfigSnapshot(projectDir);
    const state = snapshot.capture();

    // Required fields
    expect(typeof state.projectPath).toBe('string');
    expect(typeof state.capturedAt).toBe('string');
  });
});
