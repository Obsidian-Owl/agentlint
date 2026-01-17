/**
 * T070: analyze_hierarchy tool definition
 *
 * SDK tool() pattern for analyzing configuration hierarchy.
 *
 * @module tools/config/analyze-hierarchy-tool
 */

import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import type { AnalyzeHierarchyResult } from './types';
import { analyzeHierarchy } from './hierarchy';

/**
 * Input schema for analyze_hierarchy tool.
 */
const analyzeHierarchyInputSchema = {
  cwd: z.string().describe('Project root directory to analyze'),
  includeGlobal: z
    .boolean()
    .optional()
    .describe('Include global configs from ~/.claude/'),
};

/**
 * Format hierarchy output for display.
 */
function formatHierarchyOutput(result: AnalyzeHierarchyResult): string {
  const lines: string[] = [];
  const { hierarchy, summary } = result;

  // Header
  lines.push('# Configuration Hierarchy Analysis');
  lines.push('');

  // Summary section
  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Overall Grade**: ${summary.overallGrade}`);
  lines.push(`- **Project Config**: ${summary.projectConfigExists ? 'Yes' : 'No'}`);
  lines.push(`- **Global Config**: ${summary.globalConfigExists ? 'Yes' : 'No'}`);
  lines.push(`- **Local Configs**: ${summary.localConfigCount}`);
  lines.push(`- **Skills**: ${summary.skillCount}`);
  lines.push(`- **Conflicts**: ${summary.conflictCount}`);
  lines.push('');

  // Project config
  if (hierarchy.project) {
    lines.push('## Project Configuration');
    lines.push('');
    lines.push(`- **Path**: ${hierarchy.project.file.relativePath}`);
    lines.push(`- **Lines**: ${hierarchy.project.metrics.lineCount}`);
    lines.push(`- **Sections**: ${hierarchy.project.metrics.sectionCount}`);
    lines.push('');
  }

  // Local configs
  if (hierarchy.local.length > 0) {
    lines.push('## Local Configurations');
    lines.push('');
    for (const config of hierarchy.local) {
      lines.push(`### ${config.file.relativePath}`);
      lines.push(`- Lines: ${config.metrics.lineCount}`);
      lines.push(`- Sections: ${config.metrics.sectionCount}`);
      lines.push('');
    }
  }

  // Skills
  if (hierarchy.skills.length > 0) {
    lines.push('## Skills');
    lines.push('');
    for (const skill of hierarchy.skills) {
      lines.push(`- **${skill.name}**: ${skill.description}`);
      if (skill.allowedTools && skill.allowedTools.length > 0) {
        lines.push(`  - Allowed tools: ${skill.allowedTools.join(', ')}`);
      }
    }
    lines.push('');
  }

  // Conflicts
  if (hierarchy.conflicts.length > 0) {
    lines.push('## Conflicts Detected');
    lines.push('');
    for (const conflict of hierarchy.conflicts) {
      const severityEmoji =
        conflict.severity === 'high'
          ? '🔴'
          : conflict.severity === 'medium'
            ? '🟡'
            : '🟢';
      lines.push(`### ${severityEmoji} ${conflict.type.charAt(0).toUpperCase() + conflict.type.slice(1)} Conflict`);
      lines.push('');
      lines.push(`**Description**: ${conflict.description}`);
      lines.push('');
      lines.push('**Files involved**:');
      for (const file of conflict.files) {
        lines.push(`- ${file.relativePath}`);
      }
      if (conflict.resolution) {
        lines.push('');
        lines.push(`**Suggested resolution**: ${conflict.resolution}`);
      }
      lines.push('');
    }
  }

  // Effective config metrics
  lines.push('## Effective Configuration Metrics');
  lines.push('');
  const metrics = hierarchy.effectiveConfig.aggregateMetrics;
  lines.push(`- **Total Files**: ${hierarchy.effectiveConfig.fileCount}`);
  lines.push(`- **Total Lines**: ${metrics.lineCount}`);
  lines.push(`- **Total Sections**: ${metrics.sectionCount}`);
  lines.push(`- **Code Blocks**: ${metrics.codeBlockCount}`);
  lines.push(`- **Token Estimate**: ~${metrics.tokenEstimate}`);
  lines.push('');

  // Emphasis markers
  if (metrics.emphasisMarkerCount.total > 0) {
    lines.push('### Emphasis Markers');
    lines.push('');
    lines.push(`- MUST: ${metrics.emphasisMarkerCount.must}`);
    lines.push(`- ALWAYS: ${metrics.emphasisMarkerCount.always}`);
    lines.push(`- NEVER: ${metrics.emphasisMarkerCount.never}`);
    lines.push(`- CRITICAL: ${metrics.emphasisMarkerCount.critical}`);
    lines.push(`- IMPORTANT: ${metrics.emphasisMarkerCount.important}`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * analyze_hierarchy tool definition using SDK tool() pattern.
 *
 * Analyzes the configuration hierarchy of a project, detecting conflicts
 * and merging configurations from global, project, and local levels.
 */
export const analyzeHierarchyTool = tool(
  'analyze_hierarchy',
  `Analyze the configuration hierarchy for a project, detecting conflicts between different configuration levels.

Returns:
- Configuration hierarchy (global → project → local)
- Discovered skills
- Detected conflicts (contradicting, overlapping guidance)
- Effective merged configuration metrics
- Overall quality grade

Use this tool to understand how configurations at different levels interact and to identify potential conflicts or redundancies.`,
  analyzeHierarchyInputSchema,
  async (args) => {
    try {
      const result = await analyzeHierarchy({
        cwd: args.cwd,
        includeGlobal: args.includeGlobal ?? false,
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: formatHierarchyOutput(result),
          },
        ],
        _rawData: result,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error analyzing hierarchy: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);

/**
 * Export raw function for programmatic use.
 */
export { analyzeHierarchy } from './hierarchy';
