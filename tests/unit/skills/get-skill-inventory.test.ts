/**
 * T017-T018: Unit tests for get_skill_inventory
 *
 * Tests skill discovery from .claude/skills/ directory.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getSkillInventory, hasSkills, getSkillByName } from '../../../src/skills/discovery';

// =============================================================================
// Test Setup
// =============================================================================

const TEST_DIR = join(tmpdir(), 'agentlint-test-skills-' + Date.now());

function createTestProject(skills: Array<{ name: string; description: string; content?: string }>) {
  const skillsDir = join(TEST_DIR, '.claude', 'skills');
  mkdirSync(skillsDir, { recursive: true });

  for (const skill of skills) {
    const skillDir = join(skillsDir, skill.name);
    mkdirSync(skillDir, { recursive: true });

    const content =
      skill.content ??
      `---
name: ${skill.name}
description: ${skill.description}
user_invocable: true
---

# ${skill.name}

${skill.description}

## Usage

Use this skill to do something useful.
`;

    writeFileSync(join(skillDir, 'SKILL.md'), content);
  }
}

function cleanupTestDir() {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('getSkillInventory', () => {
  beforeEach(() => {
    cleanupTestDir();
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    cleanupTestDir();
  });

  // T017: get_skill_inventory returns skills from .claude/skills/
  it('returns skills from .claude/skills/', async () => {
    createTestProject([
      { name: 'commit', description: 'Create git commits' },
      { name: 'test', description: 'Run tests' },
    ]);

    const result = await getSkillInventory(TEST_DIR);

    expect(result.skillCount).toBe(2);
    expect(result.skills).toHaveLength(2);

    const skillNames = result.skills.map((s) => s.name);
    expect(skillNames).toContain('commit');
    expect(skillNames).toContain('test');
  });

  it('includes skill descriptions', async () => {
    createTestProject([
      { name: 'commit', description: 'Create git commits with proper formatting' },
    ]);

    const result = await getSkillInventory(TEST_DIR);

    expect(result.skills[0]?.description).toBe('Create git commits with proper formatting');
  });

  it('includes skill paths', async () => {
    createTestProject([{ name: 'commit', description: 'Create git commits' }]);

    const result = await getSkillInventory(TEST_DIR);

    expect(result.skills[0]?.path).toContain('commit');
    expect(result.skills[0]?.path).toContain('SKILL.md');
  });

  it('includes content sections', async () => {
    createTestProject([{ name: 'commit', description: 'Create git commits' }]);

    const result = await getSkillInventory(TEST_DIR);

    // The skill has "# commit" and "## Usage" sections
    expect(result.skills[0]?.contentSections.length).toBeGreaterThan(0);
  });

  it('includes userInvocable flag', async () => {
    createTestProject([{ name: 'commit', description: 'Create git commits' }]);

    const result = await getSkillInventory(TEST_DIR);

    expect(result.skills[0]?.userInvocable).toBe(true);
  });

  it('returns discovery path', async () => {
    createTestProject([{ name: 'commit', description: 'Create git commits' }]);

    const result = await getSkillInventory(TEST_DIR);

    expect(result.discoveryPath).toContain('.claude/skills');
  });

  it('returns query time', async () => {
    createTestProject([{ name: 'commit', description: 'Create git commits' }]);

    const result = await getSkillInventory(TEST_DIR);

    expect(result.queryTimeMs).toBeGreaterThanOrEqual(0);
  });

  // T018: handles empty skills directory gracefully
  it('handles empty skills directory gracefully', async () => {
    // Create empty .claude/skills directory
    const skillsDir = join(TEST_DIR, '.claude', 'skills');
    mkdirSync(skillsDir, { recursive: true });

    const result = await getSkillInventory(TEST_DIR);

    expect(result.skillCount).toBe(0);
    expect(result.skills).toEqual([]);
  });

  it('handles missing .claude/skills directory gracefully', async () => {
    // Don't create any skills directory
    const result = await getSkillInventory(TEST_DIR);

    expect(result.skillCount).toBe(0);
    expect(result.skills).toEqual([]);
  });

  it('handles missing project path gracefully', async () => {
    const result = await getSkillInventory('/nonexistent/path/that/does/not/exist');

    expect(result.skillCount).toBe(0);
    expect(result.skills).toEqual([]);
  });

  it('extracts file patterns from skill content', async () => {
    const skillContent = `---
name: code-review
description: Review code changes
user_invocable: true
---

# code-review

Review code in **/*.ts files and src/**/*.tsx components.

Look for .md files for documentation.
`;
    createTestProject([
      { name: 'code-review', description: 'Review code changes', content: skillContent },
    ]);

    const result = await getSkillInventory(TEST_DIR);

    // Should extract file patterns as hints
    expect(result.skills[0]?.filePatterns).toBeDefined();
    // Note: The exact patterns depend on the regex in extractFilePatterns
  });
});

describe('hasSkills', () => {
  beforeEach(() => {
    cleanupTestDir();
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    cleanupTestDir();
  });

  it('returns true when skills exist', async () => {
    createTestProject([{ name: 'commit', description: 'Create git commits' }]);

    const result = await hasSkills(TEST_DIR);

    expect(result).toBe(true);
  });

  it('returns false when no skills exist', async () => {
    const skillsDir = join(TEST_DIR, '.claude', 'skills');
    mkdirSync(skillsDir, { recursive: true });

    const result = await hasSkills(TEST_DIR);

    expect(result).toBe(false);
  });
});

describe('getSkillByName', () => {
  beforeEach(() => {
    cleanupTestDir();
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    cleanupTestDir();
  });

  it('returns skill when found', async () => {
    createTestProject([
      { name: 'commit', description: 'Create git commits' },
      { name: 'test', description: 'Run tests' },
    ]);

    const skill = await getSkillByName('commit', TEST_DIR);

    expect(skill).not.toBeNull();
    expect(skill?.name).toBe('commit');
    expect(skill?.description).toBe('Create git commits');
  });

  it('returns null when skill not found', async () => {
    createTestProject([{ name: 'commit', description: 'Create git commits' }]);

    const skill = await getSkillByName('nonexistent', TEST_DIR);

    expect(skill).toBeNull();
  });
});
