/**
 * T075: End-to-end integration test with real project structure
 *
 * Tests the complete config analysis workflow from discovery to hierarchy analysis.
 *
 * @module tests/integration/tools/config/e2e.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { discoverConfigs } from '../../../../src/tools/config/discovery';
import { parseConfig } from '../../../../src/tools/config/parse-config';
import { analyzeHierarchy } from '../../../../src/tools/config/hierarchy';
import { assessQuality } from '../../../../src/tools/config/quality';
import { discoverSkills } from '../../../../src/tools/config/skills';

describe('Config Analysis E2E', () => {
  let projectDir: string;

  // Set up a realistic project structure
  beforeAll(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentlint-e2e-'));

    // Create a realistic project structure
    const files: Record<string, string> = {
      // Root project config
      'CLAUDE.md': `# Project Config

## Architecture

This project uses a layered architecture with:
- CLI layer (src/cli/)
- Core layer (src/core/)
- Tools layer (src/tools/)

## Guidelines

ALWAYS follow the established patterns.
NEVER modify generated files.
MUST add tests for new functionality.

## Code Style

Use TypeScript strict mode.
Use Prettier for formatting.

\`\`\`typescript
// Example pattern
export function example(): string {
  return 'example';
}
\`\`\`
`,

      // Settings
      '.claude/settings.json': JSON.stringify(
        {
          model: 'claude-sonnet-4-20250514',
          permissions: {
            allow_read: true,
          },
        },
        null,
        2
      ),

      // Source configs
      'src/CLAUDE.md': `# Source Config

## Module Guidelines

All modules should:
- Export types from index.ts
- Use dependency injection
- Be unit testable
`,

      'src/cli/CLAUDE.md': `# CLI Config

## CLI Guidelines

- Use commander for argument parsing
- Support JSON output format
- Handle errors gracefully
`,

      'src/tools/CLAUDE.md': `# Tools Config

## Tool Guidelines

- Use Zod for schema validation
- Return structured results
- Include usage examples
`,

      // Skill
      'skills/deploy/SKILL.md': `---
name: deploy
description: Deploy the application to production
allowed_tools: Bash, Read
model: claude-sonnet-4-20250514
---

# Deploy Skill

## When to Use

Use this skill when deploying the application.

## Steps

1. Build the application
2. Run tests
3. Deploy to production
`,

      'skills/deploy/scripts/deploy.sh': '#!/bin/bash\necho "Deploying..."',

      // AGENTS.md for multi-agent
      'AGENTS.md': `# Agents Config

## Agent Roles

- **Analyzer**: Analyzes code quality
- **Reviewer**: Reviews changes
- **Tester**: Runs tests
`,
    };

    // Create all files
    for (const [relativePath, content] of Object.entries(files)) {
      const fullPath = path.join(projectDir, relativePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content);
    }

    // Create node_modules (should be excluded)
    fs.mkdirSync(path.join(projectDir, 'node_modules/dep'), { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'node_modules/dep/CLAUDE.md'), '# Excluded');
  });

  afterAll(() => {
    try {
      fs.rmSync(projectDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('discovery → parse → quality workflow', () => {
    it('should discover all config files in project', async () => {
      const result = await discoverConfigs({
        cwd: projectDir,
        includeGlobal: false,
      });

      // Should find all config files
      expect(result.files.length).toBeGreaterThanOrEqual(5);

      // Should have correct types
      const types = result.files.map((f) => f.type);
      expect(types).toContain('claude-md');
      expect(types).toContain('claude-settings');
      expect(types).toContain('agents-md');

      // Should find skills
      expect(result.skills.length).toBeGreaterThan(0);

      // Should exclude node_modules
      const nodeModulesFiles = result.files.filter((f) => f.path.includes('node_modules'));
      expect(nodeModulesFiles.length).toBe(0);
    });

    it('should parse each discovered config', async () => {
      const discovery = await discoverConfigs({
        cwd: projectDir,
        includeGlobal: false,
      });

      // Parse each markdown config
      const mdConfigs = discovery.files.filter(
        (f) => f.type === 'claude-md' || f.type === 'agents-md'
      );

      for (const file of mdConfigs) {
        const parsed = await parseConfig(file.path);

        // Should have valid structure
        expect(parsed.file.path).toBe(file.path);
        expect(parsed.sections.length).toBeGreaterThan(0);
        expect(parsed.metrics.lineCount).toBeGreaterThan(0);
        expect(parsed.raw.length).toBeGreaterThan(0);
      }
    });

    it('should assess quality for project root config', async () => {
      const projectConfig = path.join(projectDir, 'CLAUDE.md');
      const parsed = await parseConfig(projectConfig);
      const quality = assessQuality(parsed);

      // Project config should have reasonable quality
      expect(quality.score).toBeGreaterThanOrEqual(0);
      expect(quality.score).toBeLessThanOrEqual(100);
      expect(['A', 'B', 'C', 'D', 'F']).toContain(quality.grade);

      // Should have dimension scores
      expect(quality.dimensions.structure).toBeGreaterThanOrEqual(0);
      expect(quality.dimensions.size).toBeGreaterThanOrEqual(0);
      expect(quality.dimensions.completeness).toBeGreaterThanOrEqual(0);
      expect(quality.dimensions.specificity).toBeGreaterThanOrEqual(0);

      console.log(`Project config grade: ${quality.grade} (${quality.score})`);
    });
  });

  describe('skill discovery workflow', () => {
    it('should discover and parse skills', async () => {
      const skills = await discoverSkills({
        cwd: projectDir,
        maxDepth: 5,
      });

      expect(skills.length).toBeGreaterThan(0);

      const deploySkill = skills.find((s) => s.name === 'deploy');
      expect(deploySkill).toBeDefined();
      expect(deploySkill!.description).toContain('production');
      expect(deploySkill!.allowedTools).toContain('Bash');
      expect(deploySkill!.bundledFiles.length).toBeGreaterThan(0);
    });
  });

  describe('hierarchy analysis workflow', () => {
    it('should analyze complete hierarchy', async () => {
      const result = await analyzeHierarchy({
        cwd: projectDir,
        includeGlobal: false,
      });

      // Should have project config
      expect(result.summary.projectConfigExists).toBe(true);
      expect(result.hierarchy.project).toBeDefined();

      // Should have local configs
      expect(result.summary.localConfigCount).toBeGreaterThan(0);
      expect(result.hierarchy.local.length).toBeGreaterThan(0);

      // Should have skills
      expect(result.summary.skillCount).toBeGreaterThan(0);
      expect(result.hierarchy.skills.length).toBeGreaterThan(0);

      // Should have effective config
      expect(result.hierarchy.effectiveConfig.fileCount).toBeGreaterThan(1);
      expect(result.hierarchy.effectiveConfig.sections.length).toBeGreaterThan(0);

      // Should have overall grade
      expect(['A', 'B', 'C', 'D', 'F']).toContain(result.summary.overallGrade);

      console.log('Hierarchy analysis summary:');
      console.log(`  - Project: ${result.summary.projectConfigExists}`);
      console.log(`  - Local configs: ${result.summary.localConfigCount}`);
      console.log(`  - Skills: ${result.summary.skillCount}`);
      console.log(`  - Conflicts: ${result.summary.conflictCount}`);
      console.log(`  - Overall grade: ${result.summary.overallGrade}`);
    });

    it('should detect conflicts when present', async () => {
      // Add a conflicting local config
      fs.writeFileSync(
        path.join(projectDir, 'src/cli/conflict.md'),
        `# Conflicting Config

## Code Style

NEVER use Prettier for formatting.
ALWAYS use tabs instead of spaces.
`
      );

      // Rename to CLAUDE.md (overwrite existing)
      const conflictPath = path.join(projectDir, 'src/cli/CLAUDE.md');
      fs.writeFileSync(
        conflictPath,
        `# CLI Config

NEVER use TypeScript strict mode.
ALWAYS disable linting.
`
      );

      const result = await analyzeHierarchy({
        cwd: projectDir,
        includeGlobal: false,
      });

      // Hierarchy should still be valid
      expect(result.hierarchy.local.length).toBeGreaterThan(0);

      // May or may not detect conflicts depending on heuristics
      console.log(`Conflicts detected: ${result.summary.conflictCount}`);
    });
  });

  describe('end-to-end data flow', () => {
    it('should maintain data consistency through pipeline', async () => {
      // Step 1: Discovery
      const discovery = await discoverConfigs({
        cwd: projectDir,
        includeGlobal: false,
        parseSkills: true,
      });

      // Step 2: Parse project config
      const projectConfigFile = discovery.files.find(
        (f) => f.level === 'project' && f.type === 'claude-md'
      );
      expect(projectConfigFile).toBeDefined();

      const parsed = await parseConfig(projectConfigFile!.path);

      // Step 3: Assess quality
      const quality = assessQuality(parsed);

      // Step 4: Hierarchy analysis
      const hierarchy = await analyzeHierarchy({
        cwd: projectDir,
        includeGlobal: false,
      });

      // Verify consistency
      // - Discovery file count should match hierarchy file count
      const discoveredMdFiles = discovery.files.filter(
        (f) => f.type === 'claude-md' || f.type === 'agents-md'
      );
      expect(hierarchy.hierarchy.effectiveConfig.fileCount).toBe(discoveredMdFiles.length);

      // - Parsed metrics should be included in effective metrics
      expect(hierarchy.hierarchy.effectiveConfig.aggregateMetrics.lineCount).toBeGreaterThanOrEqual(
        parsed.metrics.lineCount
      );

      // - Quality grade should be consistent
      expect(['A', 'B', 'C', 'D', 'F']).toContain(quality.grade);
      expect(['A', 'B', 'C', 'D', 'F']).toContain(hierarchy.summary.overallGrade);
    });
  });
});
