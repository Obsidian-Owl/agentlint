/**
 * T059: Integration tests for skill discovery and bundled files
 *
 * Tests the end-to-end skill discovery and parsing flow,
 * including bundled file cataloging.
 *
 * @module tests/integration/tools/config/skills.test.ts
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import type { Skill } from '../../../../src/tools/config/types';

// Lazy load to allow tests to be written first (TDD)
type DiscoverSkillsFn = (options: {
  cwd: string;
  maxDepth?: number;
}) => Promise<Skill[]>;

let discoverSkills: DiscoverSkillsFn;

// Test fixture paths
const FIXTURES_DIR = path.join(__dirname, '../../../fixtures/configs');
const VALID_DIR = path.join(FIXTURES_DIR, 'valid');

describe('Skills Integration Tests', () => {
  beforeAll(async () => {
    try {
      const skillsModule = await import('../../../../src/tools/config/skills');
      discoverSkills = skillsModule.discoverSkills;
    } catch {
      discoverSkills = async () => {
        throw new Error('discoverSkills not yet implemented');
      };
    }
  });

  describe('bundled files integration', () => {
    it('should catalog all bundled files in test fixture', async () => {
      const skills = await discoverSkills({
        cwd: VALID_DIR,
        maxDepth: 5,
      });

      const testSkill = skills.find((s) => s.name === 'test-skill');
      expect(testSkill).toBeDefined();

      // Should have cataloged the bundled files
      expect(testSkill!.bundledFiles.length).toBeGreaterThanOrEqual(2);

      // Check for specific files
      const scriptFile = testSkill!.bundledFiles.find(
        (f) => f.path.includes('helper.sh')
      );
      const refFile = testSkill!.bundledFiles.find(
        (f) => f.path.includes('example.md')
      );

      expect(scriptFile).toBeDefined();
      expect(scriptFile?.type).toBe('script');

      expect(refFile).toBeDefined();
      expect(refFile?.type).toBe('reference');
    });

    it('should handle complex skill directory structures', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentlint-complex-'));
      const skillDir = path.join(tempDir, 'complex-skill');
      fs.mkdirSync(skillDir, { recursive: true });

      // Create SKILL.md
      fs.writeFileSync(
        path.join(skillDir, 'SKILL.md'),
        `---
name: complex-skill
description: A complex skill with many bundled files
allowed_tools: Read, Write, Bash, Grep
---

# Complex Skill

## Overview

A skill with multiple bundled files.

## Scripts

The scripts/ directory contains helper utilities.

## References

The references/ directory contains documentation.
`
      );

      // Create bundled files
      const files = [
        { path: 'scripts/init.sh', content: '#!/bin/bash\necho "init"' },
        { path: 'scripts/utils/helpers.sh', content: 'helper functions' },
        { path: 'scripts/lib/common.sh', content: 'common functions' },
        { path: 'references/api.md', content: '# API Documentation' },
        { path: 'references/examples/basic.md', content: '# Basic Example' },
        { path: 'assets/config.json', content: '{"key": "value"}' },
        { path: 'assets/templates/email.txt', content: 'Dear {{name}}' },
      ];

      for (const file of files) {
        const filePath = path.join(skillDir, file.path);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, file.content);
      }

      try {
        const skills = await discoverSkills({ cwd: tempDir, maxDepth: 5 });

        expect(skills.length).toBe(1);
        const skill = skills[0]!;

        // Check all file types are cataloged
        const scripts = skill.bundledFiles.filter((f) => f.type === 'script');
        const refs = skill.bundledFiles.filter((f) => f.type === 'reference');
        const assets = skill.bundledFiles.filter((f) => f.type === 'asset');

        expect(scripts.length).toBe(3);
        expect(refs.length).toBe(2);
        expect(assets.length).toBe(2);

        // Check allowed tools were parsed
        expect(skill.allowedTools).toContain('Read');
        expect(skill.allowedTools).toContain('Bash');
      } finally {
        fs.rmSync(tempDir, { recursive: true });
      }
    });
  });

  describe('multiple skills discovery', () => {
    it('should discover all skills in a skills directory', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentlint-multiskill-'));
      // Use plain directory names (not dotted) to avoid any hidden file handling
      const skillsBase = path.join(tempDir, 'claude-config', 'skills');
      fs.mkdirSync(skillsBase, { recursive: true });

      // Create multiple skills
      const skillConfigs = [
        { name: 'skill-alpha', description: 'First skill' },
        { name: 'skill-beta', description: 'Second skill', model: 'claude-opus-4-20250514' },
        { name: 'skill-gamma', description: 'Third skill', user_invocable: 'false' },
      ];

      for (const config of skillConfigs) {
        const skillDir = path.join(skillsBase, config.name);
        fs.mkdirSync(skillDir, { recursive: true });

        const fm = Object.entries(config)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n');
        fs.writeFileSync(
          path.join(skillDir, 'SKILL.md'),
          `---\n${fm}\n---\n\n# ${config.name}\n`
        );
      }

      try {
        const skills = await discoverSkills({ cwd: tempDir, maxDepth: 10 });

        expect(skills.length).toBe(3);

        const names = skills.map((s) => s.name);
        expect(names).toContain('skill-alpha');
        expect(names).toContain('skill-beta');
        expect(names).toContain('skill-gamma');

        // Check specific skill properties
        const betaSkill = skills.find((s) => s.name === 'skill-beta');
        expect(betaSkill?.model).toBe('claude-opus-4-20250514');

        const gammaSkill = skills.find((s) => s.name === 'skill-gamma');
        expect(gammaSkill?.userInvocable).toBe(false);
      } finally {
        fs.rmSync(tempDir, { recursive: true });
      }
    });
  });

  describe('skill content integration', () => {
    it('should extract and structure content sections', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentlint-content-'));
      fs.mkdirSync(tempDir, { recursive: true });

      fs.writeFileSync(
        path.join(tempDir, 'SKILL.md'),
        `---
name: content-skill
description: Skill with rich content
---

# Content Skill

This is the main introduction.

## When to Use

Use this skill when you need to process data.

### Specific Cases

- Case A: Processing JSON
- Case B: Processing CSV

## Workflow

1. Load the data
2. Transform the data
3. Save the result

## Prerequisites

- Node.js 18+
- Access to filesystem
`
      );

      try {
        const skills = await discoverSkills({ cwd: tempDir, maxDepth: 3 });

        expect(skills.length).toBe(1);
        const skill = skills[0]!;

        // Check sections are extracted
        expect(skill.contentSections.length).toBeGreaterThan(0);

        // Find main section
        const mainSection = skill.contentSections.find(
          (s) => s.title === 'Content Skill'
        );
        expect(mainSection).toBeDefined();
        expect(mainSection!.children.length).toBeGreaterThan(0);

        // Check nested sections
        const whenToUse = skill.contentSections
          .flatMap((s) => [s, ...s.children])
          .find((s) => s.title === 'When to Use');
        expect(whenToUse).toBeDefined();
      } finally {
        fs.rmSync(tempDir, { recursive: true });
      }
    });
  });

  describe('error handling', () => {
    it('should handle skill with missing SKILL.md gracefully', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentlint-missing-'));
      const skillDir = path.join(tempDir, 'broken-skill');
      fs.mkdirSync(skillDir, { recursive: true });

      // Create just a scripts directory without SKILL.md
      fs.mkdirSync(path.join(skillDir, 'scripts'));
      fs.writeFileSync(path.join(skillDir, 'scripts', 'test.sh'), 'echo test');

      try {
        const skills = await discoverSkills({ cwd: tempDir, maxDepth: 3 });

        // Should not crash, should return empty or skip invalid
        expect(skills).toBeInstanceOf(Array);
      } finally {
        fs.rmSync(tempDir, { recursive: true });
      }
    });

    it('should continue discovery after encountering invalid skill', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentlint-mixed-'));

      // Create one valid skill
      const validDir = path.join(tempDir, 'valid-skill');
      fs.mkdirSync(validDir, { recursive: true });
      fs.writeFileSync(
        path.join(validDir, 'SKILL.md'),
        '---\nname: valid-skill\ndescription: Valid\n---\n\n# Valid'
      );

      // Create one invalid skill (bad YAML)
      const invalidDir = path.join(tempDir, 'invalid-skill');
      fs.mkdirSync(invalidDir, { recursive: true });
      fs.writeFileSync(
        path.join(invalidDir, 'SKILL.md'),
        '---\nname: [broken\n---\n\n# Broken'
      );

      try {
        const skills = await discoverSkills({ cwd: tempDir, maxDepth: 3 });

        // Should find at least the valid skill
        expect(skills.length).toBeGreaterThanOrEqual(1);

        const validSkill = skills.find((s) => s.name === 'valid-skill');
        expect(validSkill).toBeDefined();
      } finally {
        fs.rmSync(tempDir, { recursive: true });
      }
    });
  });

  describe('performance', () => {
    it('should discover skills efficiently', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentlint-perf-'));

      // Create 10 skills
      for (let i = 0; i < 10; i++) {
        const skillDir = path.join(tempDir, `skill-${i}`);
        fs.mkdirSync(skillDir, { recursive: true });
        fs.writeFileSync(
          path.join(skillDir, 'SKILL.md'),
          `---\nname: skill-${i}\ndescription: Perf test skill ${i}\n---\n\n# Skill ${i}\n`
        );

        // Add some bundled files
        fs.mkdirSync(path.join(skillDir, 'scripts'));
        fs.writeFileSync(path.join(skillDir, 'scripts', 'test.sh'), `echo ${i}`);
      }

      try {
        const start = performance.now();
        const skills = await discoverSkills({ cwd: tempDir, maxDepth: 5 });
        const elapsed = performance.now() - start;

        expect(skills.length).toBe(10);
        // Should complete in reasonable time (< 2s for 10 skills)
        expect(elapsed).toBeLessThan(2000);
      } finally {
        fs.rmSync(tempDir, { recursive: true });
      }
    });
  });
});
