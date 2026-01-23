/**
 * EP14: Skills Effectiveness Analysis - Skill Discovery
 *
 * Wraps existing src/tools/config/skills.ts to provide skill inventory
 * data for the get_skill_inventory tool.
 *
 * @module src/skills/discovery
 */

import { join } from 'node:path';
import { discoverSkills } from '../tools/config/skills';
import type { SkillInventoryItem, GetSkillInventoryResult } from './types';

// =============================================================================
// Constants
// =============================================================================

/** Default skills directory relative to project root */
const DEFAULT_SKILLS_DIR = '.claude/skills';

// =============================================================================
// Skill Inventory
// =============================================================================

/**
 * Get the skill inventory from a project's .claude/skills/ directory.
 *
 * Returns raw data - the agent reasons about skill coverage and relevance.
 *
 * @param projectPath - Project root path (defaults to cwd)
 * @returns Skill inventory result
 */
export async function getSkillInventory(projectPath?: string): Promise<GetSkillInventoryResult> {
  const startTime = Date.now();
  const cwd = projectPath ?? process.cwd();
  const skillsDir = join(cwd, DEFAULT_SKILLS_DIR);

  // Discover skills using existing implementation
  const skills = await discoverSkills({
    cwd: skillsDir,
    maxDepth: 2, // Skills are typically at top level or one deep
  });

  // Transform to SkillInventoryItem format
  const inventoryItems: SkillInventoryItem[] = skills.map((skill) => ({
    name: skill.name,
    description: skill.description,
    path: skill.path,
    filePatterns: extractFilePatterns(skill),
    contentSections: skill.contentSections.map((s) => s.title),
    userInvocable: skill.userInvocable,
  }));

  return {
    skills: inventoryItems,
    discoveryPath: skillsDir,
    skillCount: inventoryItems.length,
    queryTimeMs: Date.now() - startTime,
  };
}

/**
 * Extract file patterns from skill content.
 *
 * Looks for patterns in the skill's sections that might indicate
 * relevant file types (e.g., "*.ts", "src/**", ".md files").
 *
 * Note: These are HINTS for agent reasoning, NOT programmatic rules.
 * The agent decides whether to use these patterns.
 *
 * @param skill - Parsed skill object
 * @returns Array of file pattern hints
 */
function extractFilePatterns(skill: {
  contentSections: Array<{ title: string; content: string }>;
}): string[] {
  const patterns: Set<string> = new Set();

  // Look for common file pattern indicators in section content
  const patternRegex = /(?:[*][*/]*[\w.-]+|\.[\w]+\s+files?|src\/[\w/*]+)/gi;

  for (const section of skill.contentSections) {
    const matches = section.content.match(patternRegex);
    if (matches) {
      for (const match of matches) {
        // Clean up the match
        const cleaned = match.trim().toLowerCase();
        if (cleaned.length > 1) {
          patterns.add(cleaned);
        }
      }
    }
  }

  return Array.from(patterns);
}

/**
 * Check if a project has any skills defined.
 *
 * @param projectPath - Project root path
 * @returns True if skills directory exists and has skills
 */
export async function hasSkills(projectPath?: string): Promise<boolean> {
  const result = await getSkillInventory(projectPath);
  return result.skillCount > 0;
}

/**
 * Get a specific skill by name.
 *
 * @param skillName - Name of the skill to find
 * @param projectPath - Project root path
 * @returns The skill if found, null otherwise
 */
export async function getSkillByName(
  skillName: string,
  projectPath?: string
): Promise<SkillInventoryItem | null> {
  const result = await getSkillInventory(projectPath);
  return result.skills.find((s) => s.name === skillName) ?? null;
}
