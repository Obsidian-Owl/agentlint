/**
 * T057-T058: Unit tests for skill discovery and parsing
 *
 * Tests the discoverSkills() and parseSkill() functions for
 * discovering and parsing SKILL.md files with frontmatter validation.
 *
 * @module tests/unit/tools/config/skills.test.ts
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import type { Skill, ParseWarning } from '../../../../src/tools/config/types';

// Import functions we're testing (will be implemented in T060-T063)
type DiscoverSkillsFn = (options: {
  cwd: string;
  maxDepth?: number;
}) => Promise<Skill[]>;

type ParseSkillFn = (skillDir: string) => Promise<Skill>;

// Lazy load to allow tests to be written first (TDD)
let discoverSkills: DiscoverSkillsFn;
let parseSkill: ParseSkillFn;

// Test fixture paths
const FIXTURES_DIR = path.join(__dirname, '../../../fixtures/configs');
const VALID_DIR = path.join(FIXTURES_DIR, 'valid');
const SKILL_DIR = path.join(VALID_DIR, 'skill');

// Helper to create temp skill directory for testing
function createTempSkill(
  frontmatter: Record<string, unknown>,
  content: string,
  bundledFiles?: Array<{ relativePath: string; content: string }>
): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentlint-skill-'));

  // Build SKILL.md content
  const frontmatterYaml = Object.entries(frontmatter)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
  const skillContent = `---\n${frontmatterYaml}\n---\n\n${content}`;

  fs.writeFileSync(path.join(tempDir, 'SKILL.md'), skillContent);

  // Create bundled files if specified
  if (bundledFiles) {
    for (const file of bundledFiles) {
      const filePath = path.join(tempDir, file.relativePath);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, file.content);
    }
  }

  return tempDir;
}

// Helper to clean up temp directories
function cleanupTempDir(dirPath: string): void {
  fs.rmSync(dirPath, { recursive: true });
}

describe('discoverSkills (T057)', () => {
  beforeAll(async () => {
    try {
      const skillsModule = await import('../../../../src/tools/config/skills');
      discoverSkills = skillsModule.discoverSkills;
      parseSkill = skillsModule.parseSkill;
    } catch {
      discoverSkills = async () => {
        throw new Error('discoverSkills not yet implemented');
      };
      parseSkill = async () => {
        throw new Error('parseSkill not yet implemented');
      };
    }
  });

  describe('skill discovery', () => {
    it('should discover SKILL.md in valid fixtures', async () => {
      const skills = await discoverSkills({
        cwd: VALID_DIR,
        maxDepth: 5,
      });

      // Should find at least the test skill
      expect(skills.length).toBeGreaterThan(0);
    });

    it('should return empty array when no skills found', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentlint-empty-'));
      try {
        const skills = await discoverSkills({
          cwd: tempDir,
          maxDepth: 3,
        });

        expect(skills).toBeInstanceOf(Array);
        expect(skills.length).toBe(0);
      } finally {
        fs.rmSync(tempDir, { recursive: true });
      }
    });

    it('should discover nested skills', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentlint-nested-'));
      try {
        // Create nested skill structure (not using .claude which might have special handling)
        const skillDir = path.join(tempDir, 'project', 'skills', 'my-skill');
        fs.mkdirSync(skillDir, { recursive: true });
        fs.writeFileSync(
          path.join(skillDir, 'SKILL.md'),
          '---\nname: nested-skill\ndescription: A nested skill\n---\n\n# Nested Skill\n'
        );

        const skills = await discoverSkills({
          cwd: tempDir,
          maxDepth: 10,
        });

        expect(skills.length).toBe(1);
        expect(skills[0].name).toBe('nested-skill');
      } finally {
        fs.rmSync(tempDir, { recursive: true });
      }
    });

    it('should respect maxDepth option', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentlint-depth-'));
      try {
        // Create skill at depth 5
        const deepDir = path.join(tempDir, 'a', 'b', 'c', 'd', 'skill');
        fs.mkdirSync(deepDir, { recursive: true });
        fs.writeFileSync(
          path.join(deepDir, 'SKILL.md'),
          '---\nname: deep-skill\ndescription: A deep skill\n---\n\n# Deep\n'
        );

        // Should find with high depth
        const skillsDeep = await discoverSkills({ cwd: tempDir, maxDepth: 10 });
        expect(skillsDeep.length).toBe(1);

        // Should NOT find with low depth
        const skillsShallow = await discoverSkills({ cwd: tempDir, maxDepth: 2 });
        expect(skillsShallow.length).toBe(0);
      } finally {
        fs.rmSync(tempDir, { recursive: true });
      }
    });

    it('should discover multiple skills', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentlint-multi-'));
      try {
        // Create two skill directories
        for (const name of ['skill-a', 'skill-b']) {
          const skillDir = path.join(tempDir, name);
          fs.mkdirSync(skillDir, { recursive: true });
          fs.writeFileSync(
            path.join(skillDir, 'SKILL.md'),
            `---\nname: ${name}\ndescription: Test skill ${name}\n---\n\n# ${name}\n`
          );
        }

        const skills = await discoverSkills({ cwd: tempDir, maxDepth: 3 });
        expect(skills.length).toBe(2);

        const names = skills.map((s) => s.name);
        expect(names).toContain('skill-a');
        expect(names).toContain('skill-b');
      } finally {
        fs.rmSync(tempDir, { recursive: true });
      }
    });
  });
});

describe('parseSkill - frontmatter validation (T058)', () => {
  beforeAll(async () => {
    try {
      const skillsModule = await import('../../../../src/tools/config/skills');
      discoverSkills = skillsModule.discoverSkills;
      parseSkill = skillsModule.parseSkill;
    } catch {
      discoverSkills = async () => {
        throw new Error('discoverSkills not yet implemented');
      };
      parseSkill = async () => {
        throw new Error('parseSkill not yet implemented');
      };
    }
  });

  describe('required fields', () => {
    it('should parse name from frontmatter', async () => {
      const skill = await parseSkill(SKILL_DIR);
      expect(skill.name).toBe('test-skill');
    });

    it('should parse description from frontmatter', async () => {
      const skill = await parseSkill(SKILL_DIR);
      expect(skill.description).toBe('A test skill for validation');
    });

    it('should warn when name is missing', async () => {
      const skillDir = createTempSkill(
        { description: 'Missing name field' },
        '# Skill without name'
      );
      try {
        const skill = await parseSkill(skillDir);

        // Should have a warning about missing name
        const nameWarning = skill.warnings.find(
          (w) => w.message.toLowerCase().includes('name')
        );
        expect(nameWarning).toBeDefined();
      } finally {
        cleanupTempDir(skillDir);
      }
    });

    it('should warn when description is missing', async () => {
      const skillDir = createTempSkill(
        { name: 'missing-description' },
        '# Skill without description'
      );
      try {
        const skill = await parseSkill(skillDir);

        const descWarning = skill.warnings.find(
          (w) => w.message.toLowerCase().includes('description')
        );
        expect(descWarning).toBeDefined();
      } finally {
        cleanupTempDir(skillDir);
      }
    });

    it('should truncate name to 64 characters', async () => {
      const longName = 'a'.repeat(100);
      const skillDir = createTempSkill(
        { name: longName, description: 'Test' },
        '# Long name skill'
      );
      try {
        const skill = await parseSkill(skillDir);
        expect(skill.name.length).toBeLessThanOrEqual(64);
      } finally {
        cleanupTempDir(skillDir);
      }
    });

    it('should truncate description to 200 characters', async () => {
      const longDesc = 'b'.repeat(300);
      const skillDir = createTempSkill(
        { name: 'test', description: longDesc },
        '# Long description skill'
      );
      try {
        const skill = await parseSkill(skillDir);
        expect(skill.description.length).toBeLessThanOrEqual(200);
      } finally {
        cleanupTempDir(skillDir);
      }
    });
  });

  describe('optional fields', () => {
    it('should parse allowedTools from frontmatter', async () => {
      const skillDir = createTempSkill(
        {
          name: 'tools-skill',
          description: 'Skill with tools',
          allowed_tools: 'Read, Write, Bash',
        },
        '# Tools skill'
      );
      try {
        const skill = await parseSkill(skillDir);

        expect(skill.allowedTools).toBeDefined();
        expect(skill.allowedTools).toContain('Read');
        expect(skill.allowedTools).toContain('Write');
        expect(skill.allowedTools).toContain('Bash');
      } finally {
        cleanupTempDir(skillDir);
      }
    });

    it('should parse model from frontmatter', async () => {
      const skillDir = createTempSkill(
        {
          name: 'model-skill',
          description: 'Skill with model',
          model: 'claude-sonnet-4-20250514',
        },
        '# Model skill'
      );
      try {
        const skill = await parseSkill(skillDir);
        expect(skill.model).toBe('claude-sonnet-4-20250514');
      } finally {
        cleanupTempDir(skillDir);
      }
    });

    it('should default userInvocable to true', async () => {
      const skillDir = createTempSkill(
        { name: 'default-skill', description: 'Test' },
        '# Default skill'
      );
      try {
        const skill = await parseSkill(skillDir);
        expect(skill.userInvocable).toBe(true);
      } finally {
        cleanupTempDir(skillDir);
      }
    });

    it('should parse user_invocable as false', async () => {
      const skillDir = createTempSkill(
        {
          name: 'hidden-skill',
          description: 'Not in menu',
          user_invocable: 'false',
        },
        '# Hidden skill'
      );
      try {
        const skill = await parseSkill(skillDir);
        expect(skill.userInvocable).toBe(false);
      } finally {
        cleanupTempDir(skillDir);
      }
    });

    it('should default disableModelInvocation to false', async () => {
      const skillDir = createTempSkill(
        { name: 'callable-skill', description: 'Test' },
        '# Callable skill'
      );
      try {
        const skill = await parseSkill(skillDir);
        expect(skill.disableModelInvocation).toBe(false);
      } finally {
        cleanupTempDir(skillDir);
      }
    });

    it('should parse disable_model_invocation as true', async () => {
      const skillDir = createTempSkill(
        {
          name: 'user-only-skill',
          description: 'User only',
          disable_model_invocation: 'true',
        },
        '# User only skill'
      );
      try {
        const skill = await parseSkill(skillDir);
        expect(skill.disableModelInvocation).toBe(true);
      } finally {
        cleanupTempDir(skillDir);
      }
    });
  });

  describe('frontmatter edge cases', () => {
    it('should handle missing frontmatter entirely', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentlint-nofm-'));
      fs.writeFileSync(
        path.join(tempDir, 'SKILL.md'),
        '# Skill without frontmatter\n\nJust content.'
      );
      try {
        const skill = await parseSkill(tempDir);

        // Should have warnings for missing required fields
        expect(skill.warnings.length).toBeGreaterThan(0);
        // Name should be derived from directory or default
        expect(skill.name).toBeDefined();
      } finally {
        cleanupTempDir(tempDir);
      }
    });

    it('should handle invalid YAML frontmatter', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentlint-badyaml-'));
      fs.writeFileSync(
        path.join(tempDir, 'SKILL.md'),
        '---\nname: test\nbad yaml: [unclosed\n---\n\n# Content'
      );
      try {
        const skill = await parseSkill(tempDir);

        // Should have YAML warning
        const yamlWarning = skill.warnings.find(
          (w) => w.code === 'INVALID_YAML' || w.message.toLowerCase().includes('yaml')
        );
        expect(yamlWarning).toBeDefined();
      } finally {
        cleanupTempDir(tempDir);
      }
    });

    it('should handle empty frontmatter', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentlint-emptyfm-'));
      fs.writeFileSync(
        path.join(tempDir, 'SKILL.md'),
        '---\n---\n\n# Skill with empty frontmatter'
      );
      try {
        const skill = await parseSkill(tempDir);
        expect(skill.warnings.length).toBeGreaterThan(0);
      } finally {
        cleanupTempDir(tempDir);
      }
    });
  });

  describe('content sections', () => {
    it('should extract content sections from markdown', async () => {
      const skill = await parseSkill(SKILL_DIR);

      expect(skill.contentSections).toBeInstanceOf(Array);
      expect(skill.contentSections.length).toBeGreaterThan(0);
    });

    it('should include section titles', async () => {
      const skill = await parseSkill(SKILL_DIR);

      const titles = skill.contentSections.map((s) => s.title);
      expect(titles).toContain('Test Skill');
    });

    it('should extract section hierarchy', async () => {
      const skillDir = createTempSkill(
        { name: 'hierarchy-skill', description: 'Test' },
        `# Main Section

Content here.

## Subsection A

Details A.

## Subsection B

Details B.

### Nested

More details.
`
      );
      try {
        const skill = await parseSkill(skillDir);

        // Should have main section with children
        const mainSection = skill.contentSections.find(
          (s) => s.title === 'Main Section'
        );
        expect(mainSection).toBeDefined();
        expect(mainSection?.children.length).toBeGreaterThan(0);
      } finally {
        cleanupTempDir(skillDir);
      }
    });
  });

  describe('bundled files', () => {
    it('should detect files in scripts/ directory', async () => {
      const skill = await parseSkill(SKILL_DIR);

      const scripts = skill.bundledFiles.filter((f) => f.type === 'script');
      expect(scripts.length).toBeGreaterThan(0);
    });

    it('should detect files in references/ directory', async () => {
      const skill = await parseSkill(SKILL_DIR);

      const refs = skill.bundledFiles.filter((f) => f.type === 'reference');
      expect(refs.length).toBeGreaterThan(0);
    });

    it('should detect files in assets/ directory', async () => {
      const skillDir = createTempSkill(
        { name: 'assets-skill', description: 'Test' },
        '# Assets skill',
        [
          { relativePath: 'assets/image.png', content: 'fake-png-data' },
          { relativePath: 'assets/data.json', content: '{}' },
        ]
      );
      try {
        const skill = await parseSkill(skillDir);

        const assets = skill.bundledFiles.filter((f) => f.type === 'asset');
        expect(assets.length).toBe(2);
      } finally {
        cleanupTempDir(skillDir);
      }
    });

    it('should include file paths relative to skill directory', async () => {
      const skill = await parseSkill(SKILL_DIR);

      const scriptFile = skill.bundledFiles.find(
        (f) => f.path.includes('helper.sh')
      );
      expect(scriptFile).toBeDefined();
      expect(scriptFile?.path).toContain('scripts/');
    });

    it('should include file sizes', async () => {
      const skill = await parseSkill(SKILL_DIR);

      for (const file of skill.bundledFiles) {
        expect(file.size).toBeGreaterThan(0);
      }
    });

    it('should handle nested files in bundled directories', async () => {
      const skillDir = createTempSkill(
        { name: 'nested-files-skill', description: 'Test' },
        '# Nested files skill',
        [
          { relativePath: 'scripts/utils/helper.sh', content: 'echo "hello"' },
          { relativePath: 'scripts/lib/common.sh', content: 'echo "common"' },
        ]
      );
      try {
        const skill = await parseSkill(skillDir);

        const scripts = skill.bundledFiles.filter((f) => f.type === 'script');
        expect(scripts.length).toBe(2);
      } finally {
        cleanupTempDir(skillDir);
      }
    });

    it('should return empty array when no bundled files', async () => {
      const skillDir = createTempSkill(
        { name: 'no-files-skill', description: 'Test' },
        '# No bundled files'
      );
      try {
        const skill = await parseSkill(skillDir);
        expect(skill.bundledFiles).toBeInstanceOf(Array);
        expect(skill.bundledFiles.length).toBe(0);
      } finally {
        cleanupTempDir(skillDir);
      }
    });
  });

  describe('skill path', () => {
    it('should include absolute path to SKILL.md', async () => {
      const skill = await parseSkill(SKILL_DIR);

      expect(skill.path).toBeDefined();
      expect(path.isAbsolute(skill.path)).toBe(true);
      expect(skill.path).toContain('SKILL.md');
    });
  });

  describe('edge cases', () => {
    it('should handle skill.md (lowercase) files', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentlint-lower-'));
      fs.writeFileSync(
        path.join(tempDir, 'skill.md'),
        '---\nname: lowercase-skill\ndescription: Test\n---\n\n# Lowercase'
      );
      try {
        // parseSkill should handle lowercase
        const skill = await parseSkill(tempDir);
        expect(skill.name).toBe('lowercase-skill');
      } finally {
        cleanupTempDir(tempDir);
      }
    });

    it('should handle empty SKILL.md', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentlint-empty-'));
      fs.writeFileSync(path.join(tempDir, 'SKILL.md'), '');
      try {
        const skill = await parseSkill(tempDir);

        // Should have warnings
        expect(skill.warnings.length).toBeGreaterThan(0);
        // Should still have default values
        expect(skill.name).toBeDefined();
      } finally {
        cleanupTempDir(tempDir);
      }
    });
  });
});
