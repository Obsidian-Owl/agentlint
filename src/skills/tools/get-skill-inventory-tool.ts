/**
 * EP14: Skills Effectiveness Analysis - get_skill_inventory Tool
 *
 * SDK tool definition for getting the skill inventory from a project.
 * Returns data about available skills - agent reasons about relevance.
 *
 * @module src/skills/tools/get-skill-inventory-tool
 */

import { z } from 'zod';
import { adaptTool } from '../../opencode/tool-adapter';
import { getSkillInventory } from '../discovery';
import type { GetSkillInventoryResult, SkillInventoryItem } from '../types';

/**
 * Input schema for get_skill_inventory tool.
 */
const getSkillInventoryInputSchema = {
  projectPath: z
    .string()
    .optional()
    .describe('Project root path (defaults to current working directory)'),
};

/**
 * Format skill inventory for human-readable output.
 */
function formatToolOutput(result: GetSkillInventoryResult): string {
  const lines: string[] = [];

  lines.push(`## Skill Inventory\n`);
  lines.push(`**Discovery Path**: ${result.discoveryPath}`);
  lines.push(`**Skills Found**: ${result.skillCount}`);
  lines.push('');

  if (result.skills.length === 0) {
    lines.push('No skills found in .claude/skills/ directory.\n');
    lines.push('Skills enable reusable workflows and commands.');
    lines.push('Create a skill by adding a SKILL.md file to .claude/skills/[skill-name]/');
    return lines.join('\n');
  }

  lines.push('### Skills\n');

  for (const skill of result.skills) {
    lines.push(formatSkill(skill));
  }

  lines.push(`\n*Query completed in ${result.queryTimeMs}ms*`);

  return lines.join('\n');
}

/**
 * Format a single skill for display.
 */
function formatSkill(skill: SkillInventoryItem): string {
  const lines: string[] = [];

  // Skill header with user-invocable indicator
  const invocable = skill.userInvocable ? ' (user invocable via /)' : '';
  lines.push(`#### ${skill.name}${invocable}\n`);

  // Description
  if (skill.description) {
    lines.push(`${skill.description}\n`);
  }

  // Path
  lines.push(`- **Path**: ${skill.path}`);

  // Sections
  if (skill.contentSections.length > 0) {
    lines.push(`- **Sections**: ${skill.contentSections.join(', ')}`);
  }

  // File patterns (hints)
  if (skill.filePatterns.length > 0) {
    lines.push(`- **Pattern hints**: ${skill.filePatterns.join(', ')}`);
  }

  lines.push('');

  return lines.join('\n');
}

/**
 * get_skill_inventory tool definition.
 *
 * Enumerates skills from the project's .claude/skills/ directory.
 * Returns skill metadata for agent reasoning about skill coverage and relevance.
 *
 * Per Constitution Principle VII:
 * - Tool returns DATA: skill names, descriptions, paths, patterns
 * - Agent DECIDES: which skills are relevant, whether coverage is adequate
 *
 * @example
 * ```typescript
 * import { getSkillInventoryTool } from './skills/tools/get-skill-inventory-tool';
 * import { ToolRegistry } from './orchestration/tool-registry';
 *
 * const registry = new ToolRegistry();
 * registry.register(getSkillInventoryTool);
 * ```
 */
export const getSkillInventoryTool = adaptTool({
  name: 'get_skill_inventory',
  description: `Enumerate skills defined in a project's .claude/skills/ directory.

Returns for each skill:
- **name**: Skill identifier from SKILL.md frontmatter
- **description**: What the skill does (max 200 chars)
- **path**: Location of the SKILL.md file
- **filePatterns**: Hint patterns for agent reasoning (NOT programmatic rules)
- **contentSections**: Section headings in SKILL.md
- **userInvocable**: Whether user can invoke directly via /command

Use this to understand what skills exist in a project before analyzing invocations.
The filePatterns are HINTS for agent reasoning - the agent decides if they're relevant.`,
  schema: getSkillInventoryInputSchema,
  handler: async (args: unknown) => {
    try {
      const typedArgs = args as { projectPath?: string };
      const result = await getSkillInventory(typedArgs.projectPath);
      const output = formatToolOutput(result);

      return {
        content: [
          {
            type: 'text' as const,
            text: output,
          },
        ],
        _rawData: result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        content: [
          {
            type: 'text' as const,
            text: `Error getting skill inventory: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  },
});
