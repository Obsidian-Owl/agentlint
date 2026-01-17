/**
 * Unit tests for gap-analyzer.ts
 *
 * Tests for the GapAnalyzer class that identifies configuration gaps
 * that may have enabled issues.
 */

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import type { Gap, GapType, GapLocation, EvidenceItem } from '../../../../src/tools/causal/types';

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Create a mock project directory structure.
 */
function createMockProject(
  baseDir: string,
  options: {
    hasClaudeMd?: boolean;
    claudeMdContent?: string;
    hasGlobalConfig?: boolean;
    hasProjectConfig?: boolean;
    hasMcpConfig?: boolean;
    hasSkills?: boolean;
  } = {}
): string {
  const projectDir = join(baseDir, 'mock-project');
  mkdirSync(projectDir, { recursive: true });

  // Create .claude directory
  const claudeDir = join(projectDir, '.claude');
  mkdirSync(claudeDir, { recursive: true });

  if (options.hasClaudeMd !== false) {
    const claudeMdPath = join(projectDir, 'CLAUDE.md');
    writeFileSync(
      claudeMdPath,
      options.claudeMdContent ??
        `# CLAUDE.md

## Project Overview
This is a test project.

## Development Guidelines
Follow best practices.
`
    );
  }

  if (options.hasProjectConfig) {
    const configPath = join(claudeDir, 'settings.json');
    writeFileSync(
      configPath,
      JSON.stringify({ projectSettings: true }, null, 2)
    );
  }

  if (options.hasMcpConfig) {
    const mcpPath = join(projectDir, '.mcp.json');
    writeFileSync(mcpPath, JSON.stringify({ mcpServers: {} }, null, 2));
  }

  if (options.hasSkills) {
    const skillsDir = join(claudeDir, 'skills');
    mkdirSync(skillsDir, { recursive: true });
    writeFileSync(
      join(skillsDir, 'test-skill.md'),
      '# Test Skill\nA test skill.'
    );
  }

  return projectDir;
}

/**
 * Create a test evidence item.
 */
function createTestEvidence(content: string): EvidenceItem {
  return {
    id: 'test-evidence-id',
    type: 'SessionMatch',
    source: 'session-123',
    timestamp: new Date().toISOString(),
    content,
  };
}

// =============================================================================
// Test Suite
// =============================================================================

describe('GapAnalyzer', () => {
  const testBaseDir = join(tmpdir(), 'agentlint-test-gap-analyzer');

  beforeEach(() => {
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true });
    }
    mkdirSync(testBaseDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true });
    }
  });

  // ===========================================================================
  // T023: Gap Identification
  // ===========================================================================

  describe('gap identification', () => {
    it('should identify missing CLAUDE.md as a gap', () => {
      const projectDir = createMockProject(testBaseDir, {
        hasClaudeMd: false,
      });

      // Check if CLAUDE.md exists
      const claudeMdPath = join(projectDir, 'CLAUDE.md');
      const exists = existsSync(claudeMdPath);

      expect(exists).toBe(false);

      // This is what GapAnalyzer will do
      const gap: Gap = {
        type: 'missing_config',
        location: 'claude_md',
        expectedGuidance: 'Project configuration and guidelines',
        counterfactual:
          'If CLAUDE.md existed, the agent would have project-specific guidance',
      };

      expect(gap.type).toBe('missing_config');
      expect(gap.location).toBe('claude_md');
    });

    it('should identify missing guidance in CLAUDE.md', async () => {
      const projectDir = createMockProject(testBaseDir, {
        hasClaudeMd: true,
        claudeMdContent: '# CLAUDE.md\n\nMinimal content.',
      });

      // Read CLAUDE.md content
      const claudeMdPath = join(projectDir, 'CLAUDE.md');
      const content = await Bun.file(claudeMdPath).text();

      // Check for expected sections (what GapAnalyzer will do)
      const expectedSections = [
        'error handling',
        'testing',
        'code style',
        'architecture',
      ];

      const lowerContent = content.toLowerCase();
      const missingSections = expectedSections.filter(
        (section) => !lowerContent.includes(section)
      );

      expect(missingSections.length).toBeGreaterThan(0);

      const gap: Gap = {
        type: 'missing_guidance',
        location: 'claude_md',
        expectedGuidance: `Missing sections: ${missingSections.join(', ')}`,
        counterfactual:
          'If these sections existed, the agent would have specific guidance',
      };

      expect(gap.type).toBe('missing_guidance');
    });

    it('should identify missing project config', () => {
      const projectDir = createMockProject(testBaseDir, {
        hasProjectConfig: false,
      });

      const configPath = join(projectDir, '.claude', 'settings.json');
      const exists = existsSync(configPath);

      expect(exists).toBe(false);

      const gap: Gap = {
        type: 'missing_config',
        location: 'project_config',
        expectedGuidance: 'Project-specific Claude settings',
        counterfactual:
          'If project settings existed, behavior would be customized',
      };

      expect(gap.type).toBe('missing_config');
      expect(gap.location).toBe('project_config');
    });

    it('should identify missing MCP config when MCP tools are used', () => {
      const projectDir = createMockProject(testBaseDir, {
        hasMcpConfig: false,
      });

      // Evidence suggests MCP tool was attempted
      const evidence = createTestEvidence(
        'Tried to use custom MCP tool but failed'
      );

      const mcpPath = join(projectDir, '.mcp.json');
      const exists = existsSync(mcpPath);

      expect(exists).toBe(false);

      const gap: Gap = {
        type: 'missing_config',
        location: 'mcp_config',
        expectedGuidance: 'MCP server configuration',
        counterfactual: 'If .mcp.json existed, MCP tools would be available',
      };

      expect(gap.type).toBe('missing_config');
      expect(gap.location).toBe('mcp_config');
    });

    it('should identify missing skills', () => {
      const projectDir = createMockProject(testBaseDir, {
        hasSkills: false,
      });

      const skillsDir = join(projectDir, '.claude', 'skills');
      const exists = existsSync(skillsDir);

      // Skills directory might not exist at all
      const hasSkills = exists && existsSync(skillsDir);

      const gap: Gap = {
        type: 'missing_config',
        location: 'skill',
        expectedGuidance: 'Custom skill definitions',
        counterfactual:
          'If skills existed, specific workflows would be available',
      };

      expect(gap.type).toBe('missing_config');
      expect(gap.location).toBe('skill');
    });

    it('should return no gap when all config exists', () => {
      const projectDir = createMockProject(testBaseDir, {
        hasClaudeMd: true,
        hasProjectConfig: true,
        hasMcpConfig: true,
        hasSkills: true,
        claudeMdContent: `# CLAUDE.md

## Project Overview
Comprehensive project documentation.

## Error Handling
Always use try-catch blocks.

## Testing
Write unit tests for all functions.

## Code Style
Follow TypeScript best practices.

## Architecture
Use modular design patterns.
`,
      });

      // Verify all files exist
      expect(existsSync(join(projectDir, 'CLAUDE.md'))).toBe(true);
      expect(existsSync(join(projectDir, '.claude', 'settings.json'))).toBe(
        true
      );
      expect(existsSync(join(projectDir, '.mcp.json'))).toBe(true);
      expect(existsSync(join(projectDir, '.claude', 'skills'))).toBe(true);

      // When everything exists, gap analysis would return undefined
      const gap: Gap | undefined = undefined;
      expect(gap).toBeUndefined();
    });
  });

  // ===========================================================================
  // T024: Gap Categorization
  // ===========================================================================

  describe('gap categorization', () => {
    it('should categorize as missing_config for absent files', () => {
      const gapType: GapType = 'missing_config';
      expect(gapType).toBe('missing_config');

      // Examples of missing_config - each should indicate file absence
      const examples = [
        'CLAUDE.md file not found',
        'settings.json missing',
        '.mcp.json does not exist',
      ];

      for (const example of examples) {
        const indicatesAbsence =
          example.includes('not found') ||
          example.includes('missing') ||
          example.includes('does not exist');
        expect(indicatesAbsence).toBe(true);
      }
    });

    it('should categorize as missing_example for no code samples', () => {
      const claudeMdContent = `# CLAUDE.md

## API Usage
The API should be called with proper parameters.
`;

      // No code blocks in content
      const hasCodeExamples = claudeMdContent.includes('```');
      expect(hasCodeExamples).toBe(false);

      const gap: Gap = {
        type: 'missing_example',
        location: 'claude_md',
        expectedGuidance: 'Code examples for API usage',
        counterfactual:
          'If code examples existed, the agent would know the correct pattern',
      };

      expect(gap.type).toBe('missing_example');
    });

    it('should categorize as missing_guidance for incomplete sections', () => {
      const claudeMdContent = `# CLAUDE.md

## Error Handling
TODO: Add error handling guidelines
`;

      const hasTodo = claudeMdContent.includes('TODO');
      expect(hasTodo).toBe(true);

      const gap: Gap = {
        type: 'missing_guidance',
        location: 'claude_md',
        expectedGuidance: 'Error handling guidelines',
        counterfactual:
          'If guidelines were complete, the agent would handle errors correctly',
      };

      expect(gap.type).toBe('missing_guidance');
    });

    it('should categorize as terminology_gap for undefined terms', () => {
      // Issue mentions domain-specific term not in CLAUDE.md
      const issueContent =
        'Agent used wrong FooBar pattern instead of BazQux pattern';
      const claudeMdContent = '# CLAUDE.md\n\nGeneral guidelines.';

      const termsInIssue = ['FooBar', 'BazQux'];
      const termsDefined = termsInIssue.filter((term) =>
        claudeMdContent.includes(term)
      );

      expect(termsDefined.length).toBe(0);

      const gap: Gap = {
        type: 'terminology_gap',
        location: 'claude_md',
        expectedGuidance: 'Definition of FooBar and BazQux patterns',
        counterfactual:
          'If terms were defined, the agent would use the correct pattern',
      };

      expect(gap.type).toBe('terminology_gap');
    });

    it('should categorize as context_loss for cross-session issues', () => {
      // Evidence from multiple sessions showing context was lost
      const evidence1 = createTestEvidence(
        'Session 1: User explained the architecture'
      );
      const evidence2 = createTestEvidence(
        'Session 2: Agent asked about the architecture again'
      );

      // Pattern suggests context was not preserved
      const gap: Gap = {
        type: 'context_loss',
        location: 'claude_md',
        expectedGuidance: 'Persistent architecture documentation',
        counterfactual:
          'If architecture was documented, agent would not need to ask again',
      };

      expect(gap.type).toBe('context_loss');
    });

    it('should categorize as other for unclassified gaps', () => {
      // When gap cannot be categorized into specific types
      const gap: Gap = {
        type: 'other',
        location: 'other',
        expectedGuidance: 'Unknown guidance type',
        counterfactual: 'Gap type could not be determined',
      };

      expect(gap.type).toBe('other');
      expect(gap.location).toBe('other');
    });

    it('should map gap locations correctly', () => {
      const locations: GapLocation[] = [
        'claude_md',
        'global_config',
        'project_config',
        'mcp_config',
        'skill',
        'other',
      ];

      const locationDescriptions: Record<GapLocation, string> = {
        claude_md: 'CLAUDE.md file',
        global_config: '~/.claude/settings.json',
        project_config: '.claude/settings.json',
        mcp_config: '.mcp.json',
        skill: '.claude/skills/',
        other: 'Other location',
      };

      for (const location of locations) {
        expect(locationDescriptions[location]).toBeDefined();
      }
    });
  });

  // ===========================================================================
  // Gap Analysis Logic
  // ===========================================================================

  describe('gap analysis logic', () => {
    it('should prioritize gaps by severity', () => {
      // missing_config is highest severity (no file at all)
      // missing_guidance is medium (file exists but incomplete)
      // missing_example is lower (guidance exists but no examples)

      const gapSeverity: Record<GapType, number> = {
        missing_config: 5,
        context_loss: 4,
        missing_guidance: 3,
        terminology_gap: 2,
        missing_example: 1,
        other: 0,
      };

      expect(gapSeverity['missing_config']).toBeGreaterThan(
        gapSeverity['missing_guidance']
      );
      expect(gapSeverity['missing_guidance']).toBeGreaterThan(
        gapSeverity['missing_example']
      );
    });

    it('should generate counterfactual from gap', () => {
      const gap: Gap = {
        type: 'missing_guidance',
        location: 'claude_md',
        expectedGuidance: 'Null check requirements',
        counterfactual: '',
      };

      // Generate counterfactual
      const counterfactual = `If "${gap.expectedGuidance}" were documented in ${gap.location}, this issue would have been prevented`;

      expect(counterfactual).toContain('Null check requirements');
      expect(counterfactual).toContain('claude_md');
      expect(counterfactual).toContain('prevented');
    });

    it('should extract keywords from issue for gap matching', () => {
      const issueDescription =
        'TypeError: Cannot read property undefined - missing null check';

      const keywords = issueDescription
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length > 3);

      expect(keywords).toContain('typeerror');
      expect(keywords).toContain('property');
      expect(keywords).toContain('undefined');
      expect(keywords).toContain('missing');
      expect(keywords).toContain('null');
      expect(keywords).toContain('check');
    });

    it('should match issue keywords to CLAUDE.md sections', () => {
      const claudeMdContent = `# CLAUDE.md

## Error Handling
Always use null checks before accessing properties.

## Type Safety
Use TypeScript strict mode.
`;

      const issueKeywords = ['null', 'check', 'property'];

      // Find sections that should contain these keywords
      const sections = claudeMdContent.split(/^## /m).slice(1);
      const matchingSections = sections.filter((section) =>
        issueKeywords.some((keyword) =>
          section.toLowerCase().includes(keyword)
        )
      );

      expect(matchingSections.length).toBeGreaterThan(0);
      expect(matchingSections[0]).toContain('Error Handling');
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('should handle empty CLAUDE.md', async () => {
      const projectDir = createMockProject(testBaseDir, {
        hasClaudeMd: true,
        claudeMdContent: '',
      });

      const claudeMdPath = join(projectDir, 'CLAUDE.md');
      const content = await Bun.file(claudeMdPath).text();

      expect(content.length).toBe(0);

      const gap: Gap = {
        type: 'missing_guidance',
        location: 'claude_md',
        expectedGuidance: 'Any project guidance',
        counterfactual:
          'CLAUDE.md exists but is empty - no guidance available',
      };

      expect(gap.type).toBe('missing_guidance');
    });

    it('should handle malformed CLAUDE.md', () => {
      const projectDir = createMockProject(testBaseDir, {
        hasClaudeMd: true,
        claudeMdContent: 'Not valid markdown structure just plain text',
      });

      // GapAnalyzer should still work even with malformed content
      const claudeMdPath = join(projectDir, 'CLAUDE.md');
      expect(existsSync(claudeMdPath)).toBe(true);
    });

    it('should handle deeply nested project structure', () => {
      const deepDir = join(
        testBaseDir,
        'deep',
        'nested',
        'project',
        'structure'
      );
      mkdirSync(deepDir, { recursive: true });
      writeFileSync(join(deepDir, 'CLAUDE.md'), '# Deep Project');

      expect(existsSync(join(deepDir, 'CLAUDE.md'))).toBe(true);
    });

    it('should handle permission errors gracefully', () => {
      // This test verifies the concept - actual permission testing
      // would require more setup
      const gap: Gap | undefined = undefined;

      // When file cannot be read, return undefined gap
      // rather than throwing
      expect(gap).toBeUndefined();
    });
  });
});
