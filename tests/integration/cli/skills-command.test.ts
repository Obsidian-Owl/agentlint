/**
 * T050: Integration test - agentlint skills command
 *
 * Verifies that the `agentlint skills` command works correctly.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { skillsCommand, type SkillsResult } from '../../../src/cli/commands/skills';

// =============================================================================
// Test Setup
// =============================================================================

const TEST_DIR = join(tmpdir(), 'agentlint-skills-command-' + Date.now());

function setupTestEnvironment(withSkills = true) {
  mkdirSync(TEST_DIR, { recursive: true });

  if (withSkills) {
    // Create .claude/skills/<skill-name>/SKILL.md structure
    const skillsBaseDir = join(TEST_DIR, '.claude', 'skills');

    // Create commit skill
    const commitDir = join(skillsBaseDir, 'commit');
    mkdirSync(commitDir, { recursive: true });
    writeFileSync(
      join(commitDir, 'SKILL.md'),
      `---
name: commit
description: Commit changes with a well-formatted message
---

# commit

Commit changes with a well-formatted message.

## When to use

Use this skill when you need to commit code changes.
`
    );

    // Create test skill
    const testDir = join(skillsBaseDir, 'test');
    mkdirSync(testDir, { recursive: true });
    writeFileSync(
      join(testDir, 'SKILL.md'),
      `---
name: test
description: Run project tests
---

# test

Run project tests.

## When to use

Use this skill to run the test suite.
`
    );
  }

  // Create .agentlint directory
  mkdirSync(join(TEST_DIR, '.agentlint'), { recursive: true });
}

function cleanupTestEnvironment() {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

// Capture console output
function captureConsoleOutput(): { getOutput: () => string; restore: () => void } {
  const originalLog = console.log;
  let output = '';
  console.log = (...args: unknown[]) => {
    output += args.map(String).join(' ') + '\n';
  };
  return {
    getOutput: () => output,
    restore: () => {
      console.log = originalLog;
    },
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('agentlint skills command', () => {
  beforeEach(() => {
    cleanupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment();
  });

  describe('basic functionality', () => {
    it('lists skills in a project', async () => {
      setupTestEnvironment(true);

      const capture = captureConsoleOutput();
      try {
        // Use plain: true to get terminal output format (tests are non-TTY)
        const exitCode = await skillsCommand({ directory: TEST_DIR, plain: true });
        const output = capture.getOutput();

        expect(exitCode).toBe(0);
        expect(output).toContain('Skills Inventory');
        expect(output).toContain('commit');
        expect(output).toContain('test');
      } finally {
        capture.restore();
      }
    });

    it('returns empty inventory for project without skills', async () => {
      setupTestEnvironment(false);

      const capture = captureConsoleOutput();
      try {
        // Use plain: true to get terminal output format (tests are non-TTY)
        const exitCode = await skillsCommand({ directory: TEST_DIR, plain: true });
        const output = capture.getOutput();

        expect(exitCode).toBe(0);
        expect(output).toContain('Total Skills: 0');
        expect(output).toContain('No skills found');
      } finally {
        capture.restore();
      }
    });
  });

  describe('--detail flag', () => {
    it('shows details for a specific skill', async () => {
      setupTestEnvironment(true);

      const capture = captureConsoleOutput();
      try {
        // Use plain: true to get terminal output format (tests are non-TTY)
        const exitCode = await skillsCommand({ directory: TEST_DIR, detail: 'commit', plain: true });
        const output = capture.getOutput();

        expect(exitCode).toBe(0);
        expect(output).toContain('Skill: commit');
        expect(output).toContain('Description:');
      } finally {
        capture.restore();
      }
    });

    it('returns error for non-existent skill', async () => {
      setupTestEnvironment(true);

      const capture = captureConsoleOutput();
      try {
        // Use plain: true to get terminal output format (tests are non-TTY)
        const exitCode = await skillsCommand({ directory: TEST_DIR, detail: 'nonexistent', plain: true });
        const output = capture.getOutput();

        expect(exitCode).toBe(1);
        expect(output).toContain('Skill not found');
      } finally {
        capture.restore();
      }
    });
  });

  describe('--json flag', () => {
    it('outputs valid JSON', async () => {
      setupTestEnvironment(true);

      const capture = captureConsoleOutput();
      try {
        const exitCode = await skillsCommand({ directory: TEST_DIR, json: true });
        const output = capture.getOutput().trim();

        expect(exitCode).toBe(0);

        // Should be valid JSON
        const result = JSON.parse(output) as SkillsResult;
        expect(result.status).toBe('success');
        expect(result.inventory).toBeDefined();
        expect(result.inventory?.total).toBe(2);
      } finally {
        capture.restore();
      }
    });

    it('JSON output includes skill details', async () => {
      setupTestEnvironment(true);

      const capture = captureConsoleOutput();
      try {
        await skillsCommand({ directory: TEST_DIR, json: true });
        const output = capture.getOutput().trim();

        const result = JSON.parse(output) as SkillsResult;
        expect(result.inventory?.skills).toBeDefined();
        expect(result.inventory?.skills.length).toBe(2);

        const commitSkill = result.inventory?.skills.find((s) => s.name === 'commit');
        expect(commitSkill).toBeDefined();
        expect(commitSkill?.description).toBeDefined();
        expect(commitSkill?.path).toBeDefined();
      } finally {
        capture.restore();
      }
    });
  });

  describe('--stats flag', () => {
    it('includes invocation stats when --stats is provided', async () => {
      setupTestEnvironment(true);

      const capture = captureConsoleOutput();
      try {
        // Use plain: true to get terminal output format (tests are non-TTY)
        const exitCode = await skillsCommand({ directory: TEST_DIR, stats: true, plain: true });
        const output = capture.getOutput();

        expect(exitCode).toBe(0);
        // Stats section should be present (even if zeros)
        expect(output).toContain('Usage Statistics');
      } finally {
        capture.restore();
      }
    });

    it('JSON includes invocationStats when --stats is provided', async () => {
      setupTestEnvironment(true);

      const capture = captureConsoleOutput();
      try {
        await skillsCommand({ directory: TEST_DIR, json: true, stats: true });
        const output = capture.getOutput().trim();

        const result = JSON.parse(output) as SkillsResult;
        expect(result.invocationStats).toBeDefined();
        expect(result.invocationStats?.totalInvocations).toBeDefined();
      } finally {
        capture.restore();
      }
    });
  });

  describe('--markdown flag', () => {
    it('outputs markdown format', async () => {
      setupTestEnvironment(true);

      const capture = captureConsoleOutput();
      try {
        const exitCode = await skillsCommand({ directory: TEST_DIR, markdown: true });
        const output = capture.getOutput();

        expect(exitCode).toBe(0);
        // Should have markdown headers
        expect(output).toContain('# Skills Inventory');
        // Should have table format
        expect(output).toContain('| Name |');
      } finally {
        capture.restore();
      }
    });
  });

  describe('error handling', () => {
    it('handles directory not found gracefully', async () => {
      const capture = captureConsoleOutput();
      try {
        // Use plain: true to get terminal output format (tests are non-TTY)
        const exitCode = await skillsCommand({ directory: '/nonexistent/path', plain: true });
        const output = capture.getOutput();

        expect(exitCode).toBe(0); // Skill discovery returns empty, not error
        expect(output).toContain('Total Skills: 0');
      } finally {
        capture.restore();
      }
    });
  });
});
