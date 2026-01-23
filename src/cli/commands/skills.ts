/**
 * EP14 Skills Effectiveness - CLI Skills Command
 *
 * Implements US7: Standalone CLI command for skills effectiveness analysis.
 *
 * This command provides quick access to skill inventory and invocation
 * statistics without running a full analysis.
 *
 * @module cli/commands/skills
 */

import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import { getOutputMode } from '../utils/output';
import type { GlobalOptions } from '../types';
import type { SkillInventoryItem, GetSkillInventoryResult } from '../../skills/types';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for the skills command.
 */
export interface SkillsOptions extends GlobalOptions {
  /** Directory to analyze (default: current directory) */
  directory?: string;
  /** Show detailed information for a specific skill */
  detail?: string;
  /** Include invocation statistics (requires indexed sessions) */
  stats?: boolean;
}

/**
 * Skills command result for JSON output.
 */
export interface SkillsResult {
  /** Status of the operation */
  status: 'success' | 'error';
  /** Error message if status is 'error' */
  error?: string;
  /** Project path analyzed */
  projectPath: string;
  /** Skills inventory */
  inventory?: {
    /** Total skills defined */
    total: number;
    /** Skill details */
    skills: SkillInventoryItem[];
  };
  /** Invocation statistics (if --stats) */
  invocationStats?: {
    /** Total invocations across all sessions */
    totalInvocations: number;
    /** Number of unique skills used */
    uniqueSkillsUsed: number;
    /** Sessions that used at least one skill */
    sessionsWithSkills: number;
    /** Per-skill invocation counts */
    perSkill: Array<{
      name: string;
      invocations: number;
    }>;
  };
  /** Single skill detail (if --detail) */
  skillDetail?: SkillInventoryItem & {
    invocations?: number;
  };
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Execute the skills command.
 *
 * @param options - Command options
 * @returns Exit code (0 for success, non-zero for error)
 */
export async function skillsCommand(options: SkillsOptions): Promise<number> {
  const outputMode = getOutputMode(options);
  const directory = resolve(options.directory ?? process.cwd());

  try {
    // Import skills modules
    const { getSkillInventory, getSkillByName } = await import('../../skills/discovery');

    // Get skill inventory
    const inventoryResult: GetSkillInventoryResult = await getSkillInventory(directory);

    // Build result
    const result: SkillsResult = {
      status: 'success',
      projectPath: directory,
    };

    // Handle --detail for single skill
    if (options.detail) {
      const skill = await getSkillByName(options.detail, directory);
      if (!skill) {
        result.status = 'error';
        result.error = `Skill not found: ${options.detail}`;
        outputResult(result, outputMode);
        return 1;
      }

      result.skillDetail = { ...skill };

      // Add invocation count if --stats
      if (options.stats) {
        const invocations = await getSkillInvocationCount(directory, options.detail);
        result.skillDetail.invocations = invocations;
      }

      outputResult(result, outputMode);
      return 0;
    }

    // Build full inventory result
    result.inventory = {
      total: inventoryResult.skillCount,
      skills: inventoryResult.skills,
    };

    // Add invocation stats if --stats
    if (options.stats) {
      result.invocationStats = await getInvocationStats(directory);
    }

    outputResult(result, outputMode);
    return 0;
  } catch (error) {
    const result: SkillsResult = {
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      projectPath: directory,
    };
    outputResult(result, outputMode);
    return 1;
  }
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Get invocation count for a specific skill.
 */
async function getSkillInvocationCount(projectPath: string, skillName: string): Promise<number> {
  try {
    const dbPath = join(projectPath, '.agentlint', 'sessions.db');
    if (!existsSync(dbPath)) {
      return 0;
    }

    const { Database } = await import('bun:sqlite');
    const { countSkillInvocations } = await import('../../skills/storage');

    const db = new Database(dbPath, { readonly: true });
    try {
      return countSkillInvocations(db, { skillName });
    } finally {
      db.close();
    }
  } catch {
    return 0;
  }
}

/**
 * Get invocation statistics for all skills.
 */
async function getInvocationStats(
  projectPath: string
): Promise<NonNullable<SkillsResult['invocationStats']>> {
  const defaultStats = {
    totalInvocations: 0,
    uniqueSkillsUsed: 0,
    sessionsWithSkills: 0,
    perSkill: [] as Array<{ name: string; invocations: number }>,
  };

  try {
    const dbPath = join(projectPath, '.agentlint', 'sessions.db');
    if (!existsSync(dbPath)) {
      return defaultStats;
    }

    const { Database } = await import('bun:sqlite');
    const { countSkillInvocations, countUniqueSkills, countUniqueSessions, querySkillInvocations } =
      await import('../../skills/storage');

    const db = new Database(dbPath, { readonly: true });
    try {
      const totalInvocations = countSkillInvocations(db, {});
      const uniqueSkillsUsed = countUniqueSkills(db, {});
      const sessionsWithSkills = countUniqueSessions(db, {});

      // Get per-skill counts
      const invocations = querySkillInvocations(db, {});
      const skillCounts = new Map<string, number>();

      for (const inv of invocations) {
        const current = skillCounts.get(inv.skillName) ?? 0;
        skillCounts.set(inv.skillName, current + 1);
      }

      const perSkill = Array.from(skillCounts.entries())
        .map(([name, invocations]) => ({ name, invocations }))
        .sort((a, b) => b.invocations - a.invocations);

      return {
        totalInvocations,
        uniqueSkillsUsed,
        sessionsWithSkills,
        perSkill,
      };
    } finally {
      db.close();
    }
  } catch {
    return defaultStats;
  }
}

/**
 * Output the result in the appropriate format.
 */
function outputResult(result: SkillsResult, outputMode: 'json' | 'markdown' | 'plain' | 'terminal'): void {
  if (outputMode === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (outputMode === 'markdown') {
    console.log(formatMarkdown(result));
    return;
  }

  // 'plain' and 'terminal' both use terminal format
  console.log(formatTerminal(result));
}

/**
 * Format result for terminal output.
 */
function formatTerminal(result: SkillsResult): string {
  const lines: string[] = [''];

  if (result.status === 'error') {
    lines.push(`Error: ${result.error}`);
    lines.push('');
    return lines.join('\n');
  }

  // Single skill detail
  if (result.skillDetail) {
    lines.push(`Skill: ${result.skillDetail.name}`);
    lines.push('='.repeat(result.skillDetail.name.length + 7));
    lines.push('');
    lines.push(`Description: ${result.skillDetail.description}`);
    lines.push(`File: ${result.skillDetail.path}`);

    if (result.skillDetail.invocations !== undefined) {
      lines.push(`Invocations: ${result.skillDetail.invocations}`);
    }

    lines.push('');
    return lines.join('\n');
  }

  // Full inventory
  if (result.inventory) {
    lines.push('Skills Inventory');
    lines.push('================');
    lines.push('');
    lines.push(`Total Skills: ${result.inventory.total}`);
    lines.push('');

    if (result.inventory.skills.length === 0) {
      lines.push('No skills found in .claude/skills/');
      lines.push('');
      lines.push('Create skills by adding .md files to .claude/skills/');
    } else {
      lines.push('Skills:');
      for (const skill of result.inventory.skills) {
        const desc = skill.description.slice(0, 60);
        const truncated = skill.description.length > 60 ? '...' : '';
        lines.push(`  - ${skill.name}: ${desc}${truncated}`);
      }
    }
  }

  // Invocation stats
  if (result.invocationStats) {
    lines.push('');
    lines.push('Usage Statistics');
    lines.push('----------------');
    lines.push(`Total Invocations: ${result.invocationStats.totalInvocations}`);
    lines.push(`Skills Used: ${result.invocationStats.uniqueSkillsUsed}`);
    lines.push(`Sessions with Skills: ${result.invocationStats.sessionsWithSkills}`);

    if (result.invocationStats.perSkill.length > 0) {
      lines.push('');
      lines.push('Per-Skill Usage:');
      for (const stat of result.invocationStats.perSkill) {
        lines.push(`  - ${stat.name}: ${stat.invocations} invocations`);
      }
    }
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Format result for markdown output.
 */
function formatMarkdown(result: SkillsResult): string {
  const lines: string[] = [];

  if (result.status === 'error') {
    lines.push(`**Error:** ${result.error}`);
    return lines.join('\n');
  }

  // Single skill detail
  if (result.skillDetail) {
    lines.push(`# Skill: ${result.skillDetail.name}`);
    lines.push('');
    lines.push(`**Description:** ${result.skillDetail.description}`);
    lines.push(`**File:** \`${result.skillDetail.path}\``);

    if (result.skillDetail.invocations !== undefined) {
      lines.push(`**Invocations:** ${result.skillDetail.invocations}`);
    }

    return lines.join('\n');
  }

  // Full inventory
  lines.push('# Skills Inventory');
  lines.push('');

  if (result.inventory) {
    lines.push(`**Total Skills:** ${result.inventory.total}`);
    lines.push('');

    if (result.inventory.skills.length > 0) {
      lines.push('## Defined Skills');
      lines.push('');
      lines.push('| Name | Description | File |');
      lines.push('|------|-------------|------|');
      for (const skill of result.inventory.skills) {
        const desc = skill.description.slice(0, 50) + (skill.description.length > 50 ? '...' : '');
        lines.push(`| ${skill.name} | ${desc} | \`${skill.path}\` |`);
      }
    }
  }

  // Invocation stats
  if (result.invocationStats) {
    lines.push('');
    lines.push('## Usage Statistics');
    lines.push('');
    lines.push(`- **Total Invocations:** ${result.invocationStats.totalInvocations}`);
    lines.push(`- **Skills Used:** ${result.invocationStats.uniqueSkillsUsed}`);
    lines.push(`- **Sessions with Skills:** ${result.invocationStats.sessionsWithSkills}`);

    if (result.invocationStats.perSkill.length > 0) {
      lines.push('');
      lines.push('### Per-Skill Usage');
      lines.push('');
      lines.push('| Skill | Invocations |');
      lines.push('|-------|-------------|');
      for (const stat of result.invocationStats.perSkill) {
        lines.push(`| ${stat.name} | ${stat.invocations} |`);
      }
    }
  }

  return lines.join('\n');
}
