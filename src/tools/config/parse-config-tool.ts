/**
 * T038: parse_config tool definition
 *
 * SDK tool definition for parsing AI configuration files.
 * Uses the Claude Agent SDK's tool() pattern for MCP integration.
 *
 * @module tools/config/parse-config-tool
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { parseConfig } from './parse-config';
import { assessQuality } from './quality';
import type { ParsedConfig, ParseConfigResult, QualityAssessment } from './types';

/**
 * Input schema for parse_config tool.
 */
const parseConfigInputSchema = {
  filePath: z.string().describe('Absolute path to the configuration file to parse'),
  includeQuality: z
    .boolean()
    .optional()
    .describe('Include quality assessment in output (default: true)'),
  includeRaw: z.boolean().optional().describe('Include raw file content in output (default: true)'),
  includeFormatValidation: z
    .boolean()
    .optional()
    .describe(
      'Include ACT format validation (frontmatter requirements) in quality assessment (default: false)'
    ),
};

/**
 * Format quality assessment for tool output.
 *
 * Per ADR-0019, presents raw metrics for agent interpretation.
 * The agent makes quality judgments based on these factual observations.
 */
function formatQualityOutput(quality: QualityAssessment): string {
  const lines: string[] = [];

  lines.push(`## Quality Analysis\n`);

  // Structure analysis (factual observations)
  lines.push(`### Structure\n`);
  lines.push(`- **Sections**: ${quality.structure.sectionCount}`);
  lines.push(`- **Max heading depth**: ${quality.structure.maxHeadingDepth}`);
  lines.push(`- **Has nested sections**: ${quality.structure.hasNestedSections ? 'Yes' : 'No'}`);
  lines.push(`- **Has structure**: ${quality.structure.hasStructure ? 'Yes' : 'No'}`);
  if (quality.structure.isEmpty) {
    lines.push(`- **Note**: File is empty`);
  }

  // Size analysis (factual observations with threshold flags)
  lines.push(`\n### Size Analysis\n`);
  lines.push(`- **Lines**: ${quality.sizeAnalysis.lineCount}`);
  lines.push(`- **Token estimate**: ~${quality.sizeAnalysis.tokenEstimate}`);
  if (quality.sizeAnalysis.exceedsOptimalLines) {
    lines.push(`- **Exceeds optimal (60 lines)**: Yes`);
  }
  if (quality.sizeAnalysis.exceedsMaxLines) {
    lines.push(`- **Exceeds max (300 lines)**: Yes`);
  }
  if (quality.sizeAnalysis.exceedsLightweightTokens) {
    lines.push(`- **Exceeds lightweight tokens (3000)**: Yes`);
  }
  if (quality.sizeAnalysis.exceedsProblematicTokens) {
    lines.push(`- **Exceeds problematic tokens (25000)**: Yes`);
  }

  // Completeness analysis (present/missing sections)
  lines.push(`\n### Completeness\n`);
  if (quality.completeness.totalRecommendedSections > 0) {
    const presentCount = quality.completeness.presentSections.length;
    const totalCount = quality.completeness.totalRecommendedSections;
    lines.push(`- **Present sections**: ${presentCount}/${totalCount}`);
    if (quality.completeness.presentSections.length > 0) {
      lines.push(`  - ${quality.completeness.presentSections.join(', ')}`);
    }
    if (quality.completeness.missingSections.length > 0) {
      lines.push(`- **Missing sections**: ${quality.completeness.missingSections.join(', ')}`);
    }
  } else {
    lines.push(`- **Note**: Section analysis not applicable for this file type`);
  }

  // Issues (factual pattern detection)
  if (quality.issues.length > 0) {
    lines.push(`\n### Detected Issues (${quality.issues.length})\n`);
    for (const issue of quality.issues) {
      const pos = issue.position ? ` (L${issue.position.start.line})` : '';
      const severityEmoji = getSeverityEmoji(issue.severity);
      lines.push(`- ${severityEmoji} **${issue.type}**${pos}: ${issue.message}`);
      if (issue.suggestion) {
        lines.push(`  - Suggestion: ${issue.suggestion}`);
      }
    }
  } else {
    lines.push(`\n### Detected Issues\n`);
    lines.push(`- No anti-patterns detected`);
  }

  return lines.join('\n');
}

/**
 * Get emoji for severity level.
 */
function getSeverityEmoji(severity: string): string {
  switch (severity) {
    case 'critical':
      return '🔴';
    case 'high':
      return '🟠';
    case 'medium':
      return '🟡';
    case 'low':
      return '🟢';
    default:
      return 'ℹ️';
  }
}

/**
 * Format parse result for tool output.
 */
function formatToolOutput(
  result: ParsedConfig,
  includeRaw: boolean,
  quality?: QualityAssessment
): string {
  const lines: string[] = [];

  lines.push(`## Parse Results\n`);
  lines.push(`**File**: ${result.file.relativePath}`);
  lines.push(`**Type**: ${getTypeLabel(result.file.type)}`);
  lines.push(`**Level**: ${getLevelLabel(result.file.level)}`);
  lines.push(`**Size**: ${formatSize(result.file.size)}\n`);

  // Metrics section
  lines.push(`### Metrics\n`);
  lines.push(`- **Lines**: ${result.metrics.lineCount}`);
  lines.push(`- **Token estimate**: ~${result.metrics.tokenEstimate}`);
  lines.push(`- **Sections**: ${result.metrics.sectionCount}`);
  lines.push(`- **Max heading depth**: ${result.metrics.maxHeadingDepth}`);
  lines.push(`- **Code blocks**: ${result.metrics.codeBlockCount}`);
  if (result.metrics.codeBlockLanguages.length > 0) {
    lines.push(`- **Languages**: ${result.metrics.codeBlockLanguages.join(', ')}`);
  }
  lines.push(`- **Word count**: ${result.metrics.wordCount}`);

  // Emphasis markers
  if (result.metrics.emphasisMarkerCount.total > 0) {
    lines.push(`\n### Emphasis Markers\n`);
    const em = result.metrics.emphasisMarkerCount;
    if (em.must > 0) lines.push(`- MUST: ${em.must}`);
    if (em.important > 0) lines.push(`- IMPORTANT: ${em.important}`);
    if (em.critical > 0) lines.push(`- CRITICAL: ${em.critical}`);
    if (em.never > 0) lines.push(`- NEVER: ${em.never}`);
    if (em.always > 0) lines.push(`- ALWAYS: ${em.always}`);
    lines.push(`- **Total**: ${em.total}`);
  }

  // Sections (top-level only, with child counts)
  if (result.sections.length > 0) {
    lines.push(`\n### Sections\n`);
    for (const section of result.sections) {
      const childCount = countAllChildren(section);
      const childInfo = childCount > 0 ? ` (+${childCount} subsections)` : '';
      lines.push(
        `- **${section.title}** (L${section.position.start.line}-${section.position.end.line})${childInfo}`
      );
    }
  }

  // Code blocks summary
  if (result.codeBlocks.length > 0) {
    lines.push(`\n### Code Blocks\n`);
    for (const block of result.codeBlocks) {
      const lang = block.language || 'unknown';
      lines.push(`- \`${lang}\` (${block.lineCount} lines, L${block.position.start.line})`);
    }
  }

  // Frontmatter
  if (result.frontmatter && Object.keys(result.frontmatter).length > 0) {
    lines.push(`\n### Frontmatter\n`);
    lines.push('```json');
    lines.push(JSON.stringify(result.frontmatter, null, 2));
    lines.push('```');
  }

  // Warnings
  if (result.warnings.length > 0) {
    lines.push(`\n### Warnings (${result.warnings.length})\n`);
    for (const warning of result.warnings) {
      const position = warning.position
        ? ` (L${warning.position.start.line}:${warning.position.start.column})`
        : '';
      lines.push(`- **${warning.code}**${position}: ${warning.message}`);
    }
  }

  // Raw content (optional)
  if (includeRaw && result.raw) {
    lines.push(`\n### Raw Content\n`);
    lines.push('```');
    // Truncate if very long
    if (result.raw.length > 5000) {
      lines.push(result.raw.slice(0, 5000));
      lines.push(`\n... (truncated, ${result.raw.length - 5000} more characters)`);
    } else {
      lines.push(result.raw);
    }
    lines.push('```');
  }

  // Quality assessment (if included)
  if (quality) {
    lines.push('\n' + formatQualityOutput(quality));
  }

  return lines.join('\n');
}

/**
 * Count all nested children in a section.
 */
function countAllChildren(section: ParsedConfig['sections'][0]): number {
  let count = section.children.length;
  for (const child of section.children) {
    count += countAllChildren(child);
  }
  return count;
}

/**
 * Get human-readable label for config type.
 */
function getTypeLabel(type: string): string {
  switch (type) {
    case 'claude-md':
      return 'CLAUDE.md';
    case 'agents-md':
      return 'AGENTS.md';
    case 'claude-settings':
      return 'settings.json';
    case 'skill-md':
      return 'SKILL.md';
    default:
      return type;
  }
}

/**
 * Get human-readable label for hierarchy level.
 */
function getLevelLabel(level: string): string {
  switch (level) {
    case 'global':
      return 'Global (~/.claude)';
    case 'project':
      return 'Project Root';
    case 'local':
      return 'Nested';
    default:
      return level;
  }
}

/**
 * Format file size in human-readable format.
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} bytes`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * parse_config tool definition.
 *
 * Parses AI configuration files (CLAUDE.md, AGENTS.md, settings.json, SKILL.md)
 * into structured data including AST, sections, code blocks, metrics, and warnings.
 *
 * @example
 * ```typescript
 * import { parseConfigTool } from './tools/config/parse-config-tool';
 * import { ToolRegistry } from './orchestration/tool-registry';
 *
 * const registry = new ToolRegistry();
 * registry.register(parseConfigTool);
 * ```
 */
export const parseConfigTool = tool(
  'parse_config',
  `Parse an AI configuration file into structured data.

Parses the following file types:
- CLAUDE.md - Claude Code configuration (markdown)
- AGENTS.md - Multi-agent configuration (markdown)
- .claude/settings.json - Claude settings (JSON)
- SKILL.md - Custom skill definitions (markdown with frontmatter)

Returns:
- AST (Abstract Syntax Tree) for markdown files
- Sections with hierarchy and positions
- Code blocks with language and content
- Metrics (line count, token estimate, emphasis markers)
- Warnings for any parsing issues

Handles malformed files gracefully by returning partial results with warnings.`,
  parseConfigInputSchema,
  async (args) => {
    try {
      const result = await parseConfig(args.filePath);
      const includeRaw = args.includeRaw !== false; // Default true
      const includeQuality = args.includeQuality !== false; // Default true
      const includeFormatValidation = args.includeFormatValidation === true; // Default false

      // Optionally assess quality (with optional format validation)
      const quality = includeQuality
        ? assessQuality(result, { validateFormat: includeFormatValidation })
        : undefined;

      const output = formatToolOutput(result, includeRaw, quality);

      // Build the result object
      const toolResult: ParseConfigResult = {
        success: true,
        config: result,
      };
      // Only add quality if it was computed
      if (quality !== undefined) {
        (toolResult as { quality?: typeof quality }).quality = quality;
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: output,
          },
        ],
        // Include structured data for programmatic access
        _rawData: toolResult,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      const failureResult: ParseConfigResult = {
        success: false,
        error: {
          code: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
          message: errorMessage,
          suggestion: 'Verify the file path exists and is readable',
        },
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: `Error parsing config: ${errorMessage}`,
          },
        ],
        isError: true,
        _rawData: failureResult,
      };
    }
  }
);
